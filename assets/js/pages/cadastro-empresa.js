import { $, showToast, setFieldError, clearFieldError, bindAutoClear } from "../utils/dom.js";
import { Validators } from "../utils/validators.js";
import { CATALOGS } from "../config/app.config.js";
import { AuthService } from "../services/auth.service.js";

const form = $("#companyRegisterForm");
const alertBox = $("#companyRegisterAlert");
const alertText = $("#companyRegisterAlertText");
const button = $("#companyRegisterButton");
const fields = ["companyName", "companySector", "companyWebsite", "companyDescription", "companyCity", "companyState", "contactName", "companyEmail", "companyPassword", "companyPasswordConfirm"];
fields.forEach((id) => bindAutoClear($("#" + id)));
for (const state of CATALOGS.estados) {
  const option = document.createElement("option");
  option.value = state;
  option.textContent = state;
  $("#companyState").append(option);
}
try { await AuthService.seedDemoUser(); } catch (error) { alertText.textContent = error.message; alertBox.classList.add("show"); }
if (AuthService.isAuthenticated()) window.location.replace("painel.html");

function validWebUrl(value) {
  if (!value.trim()) return true;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".");
  } catch { return false; }
}
function validate() {
  const rules = [
    ["companyName", Validators.required($("#companyName").value), "Informe o nome da empresa."],
    ["companySector", Validators.required($("#companySector").value), "Selecione uma área."],
    ["companyWebsite", validWebUrl($("#companyWebsite").value), "Informe um endereço http(s) válido."],
    ["companyDescription", $("#companyDescription").value.trim().length >= 20, "Escreva pelo menos 20 caracteres."],
    ["companyCity", Validators.required($("#companyCity").value), "Informe a cidade."],
    ["companyState", /^[A-Z]{2}$/.test($("#companyState").value), "Selecione o estado."],
    ["contactName", Validators.fullName($("#contactName").value), "Informe nome e sobrenome."],
    ["companyEmail", Validators.email($("#companyEmail").value), "Informe um e-mail válido."],
    ["companyPassword", Validators.password($("#companyPassword").value) && $("#companyPassword").value.length >= 10, "Use ao menos 10 caracteres, com letras e números."],
    ["companyPasswordConfirm", $("#companyPasswordConfirm").value === $("#companyPassword").value && Boolean($("#companyPassword").value), "As senhas não coincidem."],
  ];
  let valid = true;
  for (const [id, ok, message] of rules) {
    const input = $("#" + id);
    if (!ok) { setFieldError(input, message); valid = false; } else clearFieldError(input);
  }
  if (!$("#companyTerms").checked) {
    setFieldError($("#companyTerms"), "É necessário aceitar os termos para continuar.");
    valid = false;
  } else clearFieldError($("#companyTerms"));
  return valid;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  alertBox.classList.remove("show");
  if (!validate()) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  if (AuthService.emailJaCadastrado($("#companyEmail").value)) {
    setFieldError($("#companyEmail"), "Este e-mail já está cadastrado. Tente fazer login.");
    $("#companyEmail").focus();
    return;
  }
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span><span>Salvando cadastro local...</span>';
  try {
    await AuthService.registerCompany({
      nome: $("#contactName").value.trim(),
      email: $("#companyEmail").value.trim(),
      senha: $("#companyPassword").value,
      confirmarSenha: $("#companyPasswordConfirm").value,
      companyName: $("#companyName").value.trim(),
      sector: $("#companySector").value,
      description: $("#companyDescription").value.trim(),
      city: $("#companyCity").value.trim(),
      state: $("#companyState").value,
      website: $("#companyWebsite").value.trim(),
    });
    showToast("Perfil empresarial demonstrativo criado.", "success");
    setTimeout(() => window.location.replace("painel.html?bemvindo=empresa"), 550);
  } catch (error) {
    alertText.textContent = error.message || "Não foi possível criar o cadastro empresarial.";
    alertBox.classList.add("show");
    button.disabled = false;
    button.innerHTML = 'Criar conta empresarial demonstrativa <span aria-hidden="true">→</span>';
  }
});
