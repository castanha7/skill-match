import { APP_CONFIG } from "../config/app.config.js";
import ApiService from "../services/api.service.js";
import { AuthService } from "../services/auth.service.js";

const $ = (selector) => document.querySelector(selector);
const title = $("#callbackTitle");
const status = $("#callbackStatus");
const errorBox = $("#callbackError");
const recoveryForm = $("#recoveryForm");
const newPassword = $("#newPassword");
const confirmPassword = $("#confirmPassword");
const submit = $("#savePassword");
let recoveryToken = "";

function clearSensitiveUrl() {
  const safeParams = new URLSearchParams(location.search);
  for (const key of ["access_token", "refresh_token", "token_hash", "code", "type", "expires_at", "expires_in", "token_type", "error", "error_code", "error_description", "provider_token", "provider_refresh_token"]) {
    safeParams.delete(key);
  }
  const search = safeParams.toString();
  history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}`);
}

function fail(message) {
  clearSensitiveUrl();
  title.textContent = "Não foi possível confirmar o link";
  status.textContent = "Solicite um novo e-mail de confirmação ou recuperação e tente novamente.";
  errorBox.textContent = message;
  errorBox.hidden = false;
  recoveryForm.hidden = true;
  recoveryToken = "";
}

const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
const params = new URLSearchParams(location.search);
const type = fragment.get("type") || params.get("type") || "";
const accessToken = fragment.get("access_token") || params.get("access_token") || "";
const tokenHash = params.get("token_hash") || fragment.get("token_hash") || "";
const authError = fragment.get("error_description") || fragment.get("error") || params.get("error_description") || params.get("error") || params.get("error_code") || "";

if (!APP_CONFIG.useApi) {
  fail("A API do SkillMatch não está configurada para validar confirmações de e-mail.");
} else if (authError) {
  fail(authError.replaceAll("+", " "));
} else if (!new Set(["signup", "email", "email_change", "recovery", "invite", "magiclink"]).has(type)) {
  fail("O link está incompleto ou expirou. Solicite um novo link pela tela de acesso.");
} else {
  try {
    let token = accessToken;
    let verifiedUser = null;
    if (tokenHash) {
      const verification = await ApiService.post("/api/auth/verify-email", { tokenHash, type });
      token = verification?.session?.access_token || token;
      verifiedUser = verification?.user || null;
    }

    if (type === "recovery") {
      recoveryToken = token;
      if (!recoveryToken) throw new Error("O link de recuperação não contém uma sessão válida.");
      await ApiService.get("/api/auth/me", recoveryToken);
      clearSensitiveUrl();
      title.textContent = "Definir uma nova senha";
      status.textContent = "O link foi validado. Escolha uma senha nova para sua conta.";
      recoveryForm.hidden = false;
      newPassword.focus();
    } else {
      if (token) await ApiService.get("/api/auth/me", token);
      else if (!verifiedUser) throw new Error("Não foi possível validar a confirmação da conta.");
      clearSensitiveUrl();
      const query = type === "email_change" ? "emailAtualizado=1" : "confirmacao=1";
      window.location.replace(`login.html?${query}`);
    }
  } catch (error) {
    fail(error.message || "Este link expirou ou já foi utilizado.");
  }
}

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  newPassword.removeAttribute("aria-invalid");
  confirmPassword.removeAttribute("aria-invalid");
  const password = newPassword.value;
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)) {
    newPassword.setAttribute("aria-invalid", "true");
    errorBox.textContent = "Use de 8 a 128 caracteres, com letras e números.";
    errorBox.hidden = false;
    return;
  }
  if (confirmPassword.value !== password) {
    confirmPassword.setAttribute("aria-invalid", "true");
    errorBox.textContent = "As senhas não coincidem.";
    errorBox.hidden = false;
    return;
  }
  if (!recoveryToken) {
    fail("A sessão de recuperação expirou. Solicite um novo link.");
    return;
  }

  submit.disabled = true;
  const original = submit.textContent;
  submit.textContent = "Atualizando senha…";
  try {
    await AuthService.setPasswordAfterRecovery(password, recoveryToken);
    recoveryToken = "";
    newPassword.value = "";
    confirmPassword.value = "";
    title.textContent = "Senha atualizada";
    status.textContent = "Sua senha foi alterada. Entre novamente com sua nova senha.";
    recoveryForm.hidden = true;
    setTimeout(() => window.location.replace("login.html?senhaAtualizada=1"), 900);
  } catch (error) {
    errorBox.textContent = error.message || "Não foi possível atualizar a senha. Solicite um novo link.";
    errorBox.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
});
