import { $, $$, setFieldError, clearFieldError, bindAutoClear, showToast } from "../utils/dom.js";
import { Validators } from "../utils/validators.js";
import { AuthService } from "../services/auth.service.js";
import { initPasswordToggles } from "../components/password-toggle.js";

const form = $("#loginForm");
const emailInput = $("#email");
const senhaInput = $("#senha");
const lembrarMeInput = $("#lembrarMe");
const loginButton = $("#loginButton");
const roleInput = $("#loginRole");
const alertError = $("#loginAlert");
const alertSuccess = $("#loginSuccess");
const forgotModal = $("#forgotPasswordModal");
const resetRequestForm = $("#forgotRequestForm");
const resetCompleteForm = $("#forgotCompleteForm");
const resetEmailInput = $("#resetEmail");
const resetCodeInput = $("#resetCode");
const resetPasswordInput = $("#resetNewPassword");
const resetConfirmInput = $("#resetConfirmPassword");

function showAlert(element, textSelector, message) {
  $(textSelector).textContent = message;
  element.classList.add("show");
}

function hideAlerts() {
  alertError.classList.remove("show");
  alertSuccess.classList.remove("show");
}

try {
  await AuthService.seedDemoUser();
} catch (error) {
  showAlert(alertError, "#loginAlertText", error.message || "Não foi possível preparar o modo demonstrativo.");
}

initPasswordToggles();
if (AuthService.isAuthenticated()) window.location.replace("painel.html");

[emailInput, senhaInput, resetEmailInput, resetCodeInput, resetPasswordInput, resetConfirmInput].forEach(bindAutoClear);

const params = new URLSearchParams(window.location.search);
if (params.get("cadastrado")) {
  showAlert(alertSuccess, "#loginSuccessText", "Conta criada. Entre para continuar no SkillMatch.");
}
if (params.get("redirect")) {
  showAlert(alertError, "#loginAlertText", "Faça login para acessar essa área.");
}

$$("[data-demo-role]").forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.demoRole;
    const accounts = {
      candidate: ["demo@skillmatch.com", "Skill@123"],
      company: ["empresa@skillmatch.com", "Skill@123"],
      admin: ["admin@skillmatch.com", "Admin@123"],
    };
    if (!accounts[role]) return;
    roleInput.value = role;
    [emailInput.value, senhaInput.value] = accounts[role];
    lembrarMeInput.checked = false;
    hideAlerts();
    [emailInput, senhaInput].forEach(clearFieldError);
    showToast(`Acesso de ${role === "admin" ? "administração" : role === "company" ? "empresa" : "candidato"} demonstrativo preenchido.`, "info");
    emailInput.focus();
  });
});

function openResetModal() {
  forgotModal.classList.add("open");
  resetRequestForm.hidden = false;
  resetCompleteForm.hidden = true;
  $("#resetError").classList.remove("show");
  $("#resetCodeNotice").classList.remove("show");
  resetEmailInput.value = emailInput.value.trim();
  resetCodeInput.value = "";
  resetPasswordInput.value = "";
  resetConfirmInput.value = "";
  setTimeout(() => (resetEmailInput.value ? $("#resetCode").focus() : resetEmailInput.focus()), 0);
}

function closeResetModal() {
  forgotModal.classList.remove("open");
}

$("#forgotLink").addEventListener("click", openResetModal);
$("#forgotClose").addEventListener("click", closeResetModal);
$("#forgotCancel").addEventListener("click", closeResetModal);
$("#resetBack").addEventListener("click", () => {
  resetCompleteForm.hidden = true;
  resetRequestForm.hidden = false;
  $("#resetError").classList.remove("show");
  resetEmailInput.focus();
});
forgotModal.addEventListener("click", (event) => { if (event.target === forgotModal) closeResetModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeResetModal(); });

resetRequestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  $("#resetError").classList.remove("show");
  $("#resetCodeNotice").classList.remove("show");
  if (!Validators.email(resetEmailInput.value)) {
    setFieldError(resetEmailInput, "Informe um e-mail válido.");
    return;
  }
  try {
    const code = AuthService.requestPasswordResetDemo(resetEmailInput.value);
    if (!code) {
      showAlert($("#resetError"), "#resetErrorText", "Não foi possível iniciar a recuperação. Confira o e-mail e tente novamente.");
      return;
    }
    $("#resetCodeText").textContent = `Código local de demonstração: ${code}. Ele expira em 15 minutos; nenhum e-mail foi enviado.`;
    $("#resetCodeNotice").classList.add("show");
    resetCompleteForm.hidden = false;
    resetRequestForm.hidden = true;
    resetCodeInput.focus();
  } catch (error) {
    showAlert($("#resetError"), "#resetErrorText", error.message);
  }
});

resetCompleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#resetError").classList.remove("show");
  let valid = true;
  if (!/^\d{6}$/.test(resetCodeInput.value.trim())) {
    setFieldError(resetCodeInput, "Informe o código de seis dígitos.");
    valid = false;
  }
  if (!Validators.password(resetPasswordInput.value)) {
    setFieldError(resetPasswordInput, "Use pelo menos 8 caracteres, com letras e números.");
    valid = false;
  }
  if (resetConfirmInput.value !== resetPasswordInput.value) {
    setFieldError(resetConfirmInput, "As senhas não coincidem.");
    valid = false;
  }
  if (!valid) return;
  const submit = resetCompleteForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await AuthService.completePasswordResetDemo(resetEmailInput.value, resetCodeInput.value, resetPasswordInput.value);
    emailInput.value = resetEmailInput.value.trim().toLowerCase();
    senhaInput.value = "";
    closeResetModal();
    showToast("Senha atualizada no armazenamento local da demonstração. Faça login novamente.", "success");
    senhaInput.focus();
  } catch (error) {
    showAlert($("#resetError"), "#resetErrorText", error.message);
  } finally {
    submit.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlerts();
  let valid = true;
  if (!Validators.email(emailInput.value)) {
    setFieldError(emailInput, "Informe um e-mail válido.");
    valid = false;
  }
  if (!Validators.required(senhaInput.value)) {
    setFieldError(senhaInput, "Informe sua senha.");
    valid = false;
  }
  if (!valid) return;

  loginButton.disabled = true;
  loginButton.innerHTML = '<span class="spinner"></span><span>Validando acesso...</span>';
  try {
    await AuthService.login(emailInput.value, senhaInput.value, lembrarMeInput.checked, roleInput.value);
    window.location.replace("painel.html");
  } catch (error) {
    showAlert(alertError, "#loginAlertText", error.message);
    loginButton.disabled = false;
    loginButton.innerHTML = '<span class="btn-label">Entrar na plataforma</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  }
});
