import { $, setFieldError, clearFieldError, bindAutoClear, showToast } from "../utils/dom.js";
import { Validators } from "../utils/validators.js";
import { AuthService } from "../services/auth.service.js";
import { initPasswordToggles } from "../components/password-toggle.js";

/* Inicialização */
AuthService.seedDemoUser();
initPasswordToggles();

/* Se já estiver logado, vai direto para o perfil */
if (AuthService.isAuthenticated()) {
  window.location.replace("perfil.html");
}

const form = $("#loginForm");
const emailInput = $("#email");
const senhaInput = $("#senha");
const lembrarMeInput = $("#lembrarMe");
const loginButton = $("#loginButton");
const alertError = $("#loginAlert");
const alertSuccess = $("#loginSuccess");

[emailInput, senhaInput].forEach(bindAutoClear);

function showAlert(el, textEl, message) {
  $(textEl).textContent = message;
  el.classList.add("show");
}
function hideAlerts() {
  alertError.classList.remove("show");
  alertSuccess.classList.remove("show");
}

/* Avisos vindos de outras telas (cadastro concluído, conta excluída etc.) */
const params = new URLSearchParams(window.location.search);
if (params.get("cadastrado")) {
  showAlert(alertSuccess, "#loginSuccessText", "Conta criada com sucesso! Faça login para continuar.");
}
if (params.get("redirect")) {
  showAlert(alertError, "#loginAlertText", "Faça login para acessar seu perfil.");
}

/* Conta de demonstração */
$("#fillDemo").addEventListener("click", () => {
  emailInput.value = "demo@skillmatch.com";
  senhaInput.value = "Skill@123";
  lembrarMeInput.checked = true;
  hideAlerts();
  [emailInput, senhaInput].forEach(clearFieldError);
  showToast("Dados da conta demo preenchidos. É só clicar em entrar!", "info");
});

/* Recuperação de senha — será ligada ao backend em etapa futura */
$("#forgotLink").addEventListener("click", (event) => {
  event.preventDefault();
  showToast("Recuperação de senha estará disponível na próxima etapa do projeto.", "info");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlerts();

  let valid = true;
  if (!Validators.email(emailInput.value)) { setFieldError(emailInput); valid = false; }
  if (!Validators.required(senhaInput.value)) { setFieldError(senhaInput); valid = false; }
  if (!valid) return;

  loginButton.disabled = true;
  loginButton.innerHTML = '<span class="spinner"></span><span>Entrando...</span>';

  try {
    /* Simula o tempo de resposta de uma API real */
    await new Promise((resolve) => setTimeout(resolve, 650));
    const user = await AuthService.login(emailInput.value, senhaInput.value, lembrarMeInput.checked);
    showToast(`Olá, ${user.nome.split(" ")[0]}! Login realizado com sucesso.`);
    setTimeout(() => window.location.replace("perfil.html"), 500);
  } catch (error) {
    showAlert(alertError, "#loginAlertText", error.message);
    loginButton.disabled = false;
    loginButton.innerHTML =
      '<span class="btn-label">Entrar na plataforma</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  }
});
