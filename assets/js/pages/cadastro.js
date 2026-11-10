import { $, $$, setFieldError, clearFieldError, bindAutoClear, showToast } from "../utils/dom.js";
import { Validators, PASSWORD_STRENGTH_LABELS } from "../utils/validators.js";
import { Formatters } from "../utils/formatters.js";
import { CATALOGS } from "../config/app.config.js";
import { AuthService } from "../services/auth.service.js";
import { initPasswordToggles } from "../components/password-toggle.js";
import { createSkillsEditor } from "../components/skills-editor.js";

AuthService.seedDemoUser();
initPasswordToggles();

if (AuthService.isAuthenticated()) {
  window.location.replace("perfil.html");
}

/* ---------- Preenche os selects/pills a partir dos catálogos ---------- */
function fillSelect(select, items) {
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}
fillSelect($("#estado"), CATALOGS.estados);
fillSelect($("#escolaridade"), CATALOGS.escolaridades);
fillSelect($("#areaInteresse"), CATALOGS.areasInteresse);
fillSelect($("#disponibilidade"), CATALOGS.disponibilidades);

const tiposVagaGroup = $("#tiposVagaGroup");
CATALOGS.tiposVaga.forEach((tipo) => {
  const label = document.createElement("label");
  label.className = "pill-check";
  label.innerHTML = `<input type="checkbox" name="tiposVaga" value=""><span></span>`;
  label.querySelector("input").value = tipo;
  label.querySelector("span").textContent = tipo;
  tiposVagaGroup.appendChild(label);
});

/* ---------- Referências ---------- */
const form = $("#registerForm");
const alertError = $("#registerAlert");
const fields = {
  nome: $("#nome"), email: $("#email"), senha: $("#senha"), confirmarSenha: $("#confirmarSenha"),
  aceiteTermos: $("#aceiteTermos"), telefone: $("#telefone"), dataNascimento: $("#dataNascimento"),
  cidade: $("#cidade"), estado: $("#estado"), escolaridade: $("#escolaridade"),
  curso: $("#curso"), instituicao: $("#instituicao"), areaInteresse: $("#areaInteresse"),
  disponibilidade: $("#disponibilidade"), resumo: $("#resumo"),
};
Object.values(fields).forEach((el) => el && bindAutoClear(el));

const skillsEditor = createSkillsEditor($("#skillsEditor"));

/* ---------- Máscara de telefone ---------- */
fields.telefone.addEventListener("input", () => {
  fields.telefone.value = Formatters.phone(fields.telefone.value);
});

/* ---------- Medidor de força da senha ---------- */
const meter = $("#passwordMeter"), meterBar = $("#passwordMeterBar"), meterLabel = $("#passwordMeterLabel");
fields.senha.addEventListener("input", () => {
  const value = fields.senha.value;
  meter.classList.toggle("show", value.length > 0);
  meterLabel.classList.toggle("show", value.length > 0);
  if (!value) return;
  const strength = Validators.passwordStrength(value);
  const info = PASSWORD_STRENGTH_LABELS[strength];
  meterBar.style.width = `${Math.max(strength, 1) * 25}%`;
  meterBar.style.background = info.color;
  meterLabel.textContent = info.label;
  meterLabel.style.color = info.color;
});

/* ---------- Contador do resumo ---------- */
fields.resumo.addEventListener("input", () => {
  $("#resumoCount").textContent = fields.resumo.value.length;
});

/* ---------- Validações por passo ---------- */
function check(input, isValid, message) {
  if (isValid) { clearFieldError(input); return true; }
  setFieldError(input, message);
  return false;
}

function validateStep1() {
  let ok = true;
  ok = check(fields.nome, Validators.fullName(fields.nome.value), "Informe seu nome e sobrenome.") && ok;
  const emailOk = Validators.email(fields.email.value);
  ok = check(fields.email, emailOk, "Informe um e-mail válido.") && ok;
  if (emailOk && AuthService.emailJaCadastrado(fields.email.value)) {
    setFieldError(fields.email, "Este e-mail já está cadastrado. Tente fazer login.");
    ok = false;
  }
  ok = check(fields.senha, Validators.password(fields.senha.value), "A senha deve ter ao menos 8 caracteres, com letras e números.") && ok;
  ok = check(fields.confirmarSenha, fields.confirmarSenha.value === fields.senha.value && fields.confirmarSenha.value !== "", "As senhas não coincidem.") && ok;

  const termosError = $("#termosError");
  if (!fields.aceiteTermos.checked) {
    termosError.style.display = "block";
    ok = false;
  } else {
    termosError.style.display = "none";
  }
  return ok;
}

function validateStep2() {
  let ok = true;
  ok = check(fields.telefone, Validators.phone(fields.telefone.value), "Informe um telefone válido com DDD.") && ok;
  ok = check(fields.dataNascimento, Validators.birthDate(fields.dataNascimento.value), "Informe uma data válida (idade entre 14 e 100 anos).") && ok;
  ok = check(fields.cidade, Validators.required(fields.cidade.value), "Informe sua cidade.") && ok;
  ok = check(fields.estado, Validators.required(fields.estado.value), "Selecione o estado.") && ok;
  ok = check(fields.escolaridade, Validators.required(fields.escolaridade.value), "Selecione sua escolaridade.") && ok;
  return ok;
}

function getTiposVaga() {
  return $$('input[name="tiposVaga"]:checked').map((input) => input.value);
}

function validateStep3() {
  let ok = true;
  ok = check(fields.areaInteresse, Validators.required(fields.areaInteresse.value), "Selecione uma área de interesse.") && ok;
  ok = check(fields.disponibilidade, Validators.required(fields.disponibilidade.value), "Selecione sua disponibilidade.") && ok;

  const tiposError = $("#tiposVagaError");
  if (getTiposVaga().length === 0) { tiposError.style.display = "block"; ok = false; }
  else tiposError.style.display = "none";

  const skillsError = $("#skillsError");
  if (skillsEditor.getSkills().length < 3) { skillsError.style.display = "block"; ok = false; }
  else skillsError.style.display = "none";

  return ok;
}

tiposVagaGroup.addEventListener("change", () => { $("#tiposVagaError").style.display = "none"; });

/* ---------- Navegação entre passos ---------- */
let currentStep = 1;
const TOTAL_STEPS = 3;

function goToStep(step) {
  currentStep = step;
  $$(".step-panel").forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.step) === step);
  });
  $$("[data-step-indicator]").forEach((indicator) => {
    const n = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("active", n === step);
    indicator.classList.toggle("done", n < step);
  });
  $$("[data-line]").forEach((line) => {
    line.classList.toggle("filled", Number(line.dataset.line) < step);
  });
  alertError.classList.remove("show");
  $(".auth-form-panel").scrollTo({ top: 0, behavior: "smooth" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const validatorsByStep = { 1: validateStep1, 2: validateStep2, 3: validateStep3 };

$$("[data-next]").forEach((button) => {
  button.addEventListener("click", () => {
    if (validatorsByStep[currentStep]()) goToStep(currentStep + 1);
    else showToast("Verifique os campos destacados antes de continuar.", "error");
  });
});
$$("[data-back]").forEach((button) => {
  button.addEventListener("click", () => goToStep(currentStep - 1));
});

/* Evita enviar o formulário ao pressionar Enter fora do editor de habilidades */
form.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") event.preventDefault();
});

/* ---------- Envio final ---------- */
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateStep1()) { goToStep(1); return; }
  if (!validateStep2()) { goToStep(2); return; }
  if (!validateStep3()) { showToast("Verifique os campos destacados antes de concluir.", "error"); return; }

  const submitButton = $("#submitButton");
  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="spinner"></span><span>Criando sua conta...</span>';

  const dados = {
    nome: fields.nome.value,
    email: fields.email.value,
    senha: fields.senha.value,
    telefone: fields.telefone.value,
    dataNascimento: fields.dataNascimento.value,
    cidade: fields.cidade.value,
    estado: fields.estado.value,
    escolaridade: fields.escolaridade.value,
    curso: fields.curso.value.trim(),
    instituicao: fields.instituicao.value.trim(),
    areaInteresse: fields.areaInteresse.value,
    tiposVaga: getTiposVaga(),
    disponibilidade: fields.disponibilidade.value,
    habilidades: skillsEditor.getSkills(),
    resumo: fields.resumo.value.trim(),
  };

  try {
    await new Promise((resolve) => setTimeout(resolve, 700)); // simula resposta da API
    await AuthService.register(dados);
    showToast("Conta criada com sucesso! Bem-vindo(a) ao SkillMatch 🎉");
    setTimeout(() => window.location.replace("perfil.html?bemvindo=1"), 600);
  } catch (error) {
    $("#registerAlertText").textContent = error.message;
    alertError.classList.add("show");
    submitButton.disabled = false;
    submitButton.innerHTML =
      '<span class="btn-label">Criar minha conta</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M20 6 9 17l-5-5"/></svg>';
    if (/e-mail/i.test(error.message)) goToStep(1);
  }
});
