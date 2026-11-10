import { $, $$, setFieldError, clearFieldError, showToast } from "../utils/dom.js";
import { Validators } from "../utils/validators.js";
import { Formatters } from "../utils/formatters.js";
import { CATALOGS } from "../config/app.config.js";
import { AuthService } from "../services/auth.service.js";
import { UserService } from "../services/user.service.js";
import { createSkillsEditor } from "../components/skills-editor.js";

/* ---------- Proteção de rota ---------- */
AuthService.seedDemoUser();
const session = AuthService.requireAuth();

let currentUser = null;

/* ---------- Prepara selects e pills de edição ---------- */
function fillSelect(id, items) {
  const select = $(id);
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}
fillSelect("#edit-estado", CATALOGS.estados);
fillSelect("#edit-escolaridade", CATALOGS.escolaridades);
fillSelect("#edit-areaInteresse", CATALOGS.areasInteresse);
fillSelect("#edit-disponibilidade", CATALOGS.disponibilidades);

const editTiposGroup = $("#editTiposVagaGroup");
CATALOGS.tiposVaga.forEach((tipo) => {
  const label = document.createElement("label");
  label.className = "pill-check";
  label.innerHTML = `<input type="checkbox" name="editTiposVaga" value=""><span></span>`;
  label.querySelector("input").value = tipo;
  label.querySelector("span").textContent = tipo;
  editTiposGroup.appendChild(label);
});

const profileSkills = createSkillsEditor($("#profileSkillsEditor"));

/* Máscara de telefone na edição */
const telefoneEdit = $("#edit-telefone");
telefoneEdit.addEventListener("input", () => {
  telefoneEdit.value = Formatters.phone(telefoneEdit.value);
});
$("#edit-resumo").addEventListener("input", (e) => {
  $("#editResumoCount").textContent = e.target.value.length;
});

/* ---------- Renderização (modo visualização) ---------- */
function setViewText(key, value) {
  const el = $(`[data-view="${key}"]`);
  if (!el) return;
  const isEmpty = !value || (Array.isArray(value) && value.length === 0);
  el.textContent = isEmpty ? "Não informado" : value;
  el.classList.toggle("empty", Boolean(isEmpty));
}

function renderProfile(user) {
  /* Cartão de identidade */
  $("#avatarInitials").textContent = Formatters.initials(user.nome);
  $("#displayName").textContent = user.nome;
  $("#displayHeadline").textContent = user.curso
    ? `${user.curso}${user.areaInteresse ? ` · ${user.areaInteresse}` : ""}`
    : user.areaInteresse || "Em busca da primeira oportunidade";
  $("#displayLocation").innerHTML = user.cidade
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg><span></span>`
    : "";
  if (user.cidade) {
    $("#displayLocation span").textContent = `${user.cidade}${user.estado ? `, ${user.estado}` : ""}`;
  }

  const meta = [];
  if (user.dataNascimento) meta.push(`${Validators.age(user.dataNascimento)} anos`);
  if (user.tiposVaga?.length) meta.push(user.tiposVaga.join(" · "));
  $("#displayMeta").innerHTML = "";
  meta.forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "meta-chip";
    chip.textContent = text;
    $("#displayMeta").appendChild(chip);
  });

  /* Seções */
  setViewText("nome", user.nome);
  setViewText("email", user.email);
  setViewText("telefone", user.telefone);
  setViewText("dataNascimento", user.dataNascimento ? `${Formatters.dateBR(user.dataNascimento)} (${Validators.age(user.dataNascimento)} anos)` : "");
  setViewText("localidade", user.cidade ? `${user.cidade}${user.estado ? ` — ${user.estado}` : ""}` : "");
  setViewText("escolaridade", user.escolaridade);
  setViewText("curso", user.curso);
  setViewText("instituicao", user.instituicao);
  setViewText("linkedin", user.linkedin);
  setViewText("github", user.github);
  setViewText("portfolio", user.portfolio);
  setViewText("areaInteresse", user.areaInteresse);
  setViewText("disponibilidade", user.disponibilidade);

  const resumoEl = $('[data-view="resumo"]');
  resumoEl.textContent = user.resumo || "Você ainda não escreveu sobre você. Clique em Editar e conte um pouco da sua história!";
  resumoEl.classList.toggle("empty", !user.resumo);

  const skillsBox = $('[data-view="habilidades"]');
  skillsBox.innerHTML = "";
  if (user.habilidades?.length) {
    user.habilidades.forEach((skill) => {
      const tag = document.createElement("span");
      tag.className = "tag-view";
      tag.textContent = skill;
      skillsBox.appendChild(tag);
    });
  } else {
    skillsBox.innerHTML = '<span class="empty-state">Nenhuma habilidade adicionada ainda.</span>';
  }

  const tiposBox = $('[data-view="tiposVaga"]');
  tiposBox.innerHTML = "";
  if (user.tiposVaga?.length) {
    user.tiposVaga.forEach((tipo) => {
      const tag = document.createElement("span");
      tag.className = "tag-view";
      tag.textContent = tipo;
      tiposBox.appendChild(tag);
    });
  } else {
    tiposBox.innerHTML = '<span class="empty-state">Nenhum tipo de vaga selecionado.</span>';
  }

  renderCompleteness(user);
}

function renderCompleteness(user) {
  const { checklist, percentage } = UserService.calculateCompleteness(user);
  const circumference = 194.8;
  $("#ringValue").style.strokeDashoffset = String(circumference - (circumference * percentage) / 100);
  $("#ringPercent").textContent = `${percentage}%`;
  $(".ring").setAttribute("aria-label", `Perfil ${percentage}% completo`);
  $("#completenessHint").textContent =
    percentage === 100
      ? "Perfil completo! Você está pronto(a) para receber matches 🎉"
      : percentage >= 70
        ? "Quase lá! Complete os itens restantes para se destacar."
        : "Complete as informações para receber melhores matches.";

  const list = $("#completenessList");
  list.innerHTML = "";
  checklist.forEach((item) => {
    const li = document.createElement("li");
    li.className = item.done ? "done" : "pending";
    li.innerHTML = item.done
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/></svg>';
    const span = document.createElement("span");
    span.textContent = item.label;
    li.appendChild(span);
    list.appendChild(li);
  });
}

/* ---------- Modo edição ---------- */
function fillEditForm(sectionId) {
  const formEl = $(`[data-form="${sectionId}"]`);
  $$("[data-field]", formEl).forEach((input) => {
    input.value = currentUser[input.dataset.field] ?? "";
    clearFieldError(input);
  });
  if (sectionId === "dados-pessoais") {
    telefoneEdit.value = Formatters.phone(currentUser.telefone || "");
  }
  if (sectionId === "sobre") {
    $("#editResumoCount").textContent = (currentUser.resumo || "").length;
  }
  if (sectionId === "habilidades") {
    profileSkills.setSkills(currentUser.habilidades || []);
  }
  if (sectionId === "preferencias") {
    $$('input[name="editTiposVaga"]').forEach((input) => {
      input.checked = (currentUser.tiposVaga || []).includes(input.value);
    });
    $("#editTiposVagaError").style.display = "none";
  }
}

function setEditing(sectionId, editing) {
  const section = document.getElementById(sectionId);
  section.classList.toggle("editing", editing);
  if (editing) fillEditForm(sectionId);
}

$$("[data-edit]").forEach((button) => {
  button.addEventListener("click", () => setEditing(button.dataset.edit, true));
});
$$("[data-cancel]").forEach((button) => {
  button.addEventListener("click", () => setEditing(button.dataset.cancel, false));
});

/* ---------- Salvamento das seções ---------- */
function collectFields(sectionId) {
  const formEl = $(`[data-form="${sectionId}"]`);
  const data = {};
  $$("[data-field]", formEl).forEach((input) => {
    data[input.dataset.field] = typeof input.value === "string" ? input.value.trim() : input.value;
  });
  return data;
}

function validateInput(input, isValid, message) {
  if (isValid) { clearFieldError(input); return true; }
  setFieldError(input, message);
  return false;
}

const sectionValidators = {
  "dados-pessoais": () => {
    let ok = true;
    ok = validateInput($("#edit-nome"), Validators.fullName($("#edit-nome").value), "Informe seu nome e sobrenome.") && ok;
    ok = validateInput(telefoneEdit, Validators.phone(telefoneEdit.value), "Informe um telefone válido com DDD.") && ok;
    ok = validateInput($("#edit-dataNascimento"), Validators.birthDate($("#edit-dataNascimento").value), "Informe uma data válida (idade entre 14 e 100 anos).") && ok;
    ok = validateInput($("#edit-cidade"), Validators.required($("#edit-cidade").value), "Informe sua cidade.") && ok;
    ok = validateInput($("#edit-estado"), Validators.required($("#edit-estado").value), "Selecione o estado.") && ok;
    ok = validateInput($("#edit-escolaridade"), Validators.required($("#edit-escolaridade").value), "Selecione sua escolaridade.") && ok;
    ["linkedin", "github", "portfolio"].forEach((key) => {
      const input = $(`#edit-${key}`);
      ok = validateInput(input, Validators.url(input.value), "Informe uma URL válida.") && ok;
    });
    return ok;
  },
  sobre: () => true,
  habilidades: () => true,
  preferencias: () => {
    let ok = true;
    ok = validateInput($("#edit-areaInteresse"), Validators.required($("#edit-areaInteresse").value), "Selecione uma área de interesse.") && ok;
    ok = validateInput($("#edit-disponibilidade"), Validators.required($("#edit-disponibilidade").value), "Selecione sua disponibilidade.") && ok;
    const hasTipo = $$('input[name="editTiposVaga"]:checked').length > 0;
    $("#editTiposVagaError").style.display = hasTipo ? "none" : "block";
    return ok && hasTipo;
  },
};

$$(".edit-form").forEach((formEl) => {
  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const sectionId = formEl.dataset.form;

    if (sectionValidators[sectionId] && !sectionValidators[sectionId]()) {
      showToast("Verifique os campos destacados.", "error");
      return;
    }

    let data = collectFields(sectionId);
    if (sectionId === "habilidades") data = { habilidades: profileSkills.getSkills() };
    if (sectionId === "preferencias") {
      data.tiposVaga = $$('input[name="editTiposVaga"]:checked').map((i) => i.value);
    }

    const submitBtn = formEl.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner"></span> Salvando...';

    try {
      await new Promise((resolve) => setTimeout(resolve, 450)); // simula resposta da API
      currentUser = await UserService.updateProfile(session.userId, data, session.token);

      /* Mantém o nome da sessão sincronizado */
      if (data.nome && data.nome !== session.nome) {
        const fresh = AuthService.getSession();
        if (fresh) { fresh.nome = data.nome; session.nome = data.nome; }
      }

      renderProfile(currentUser);
      setEditing(sectionId, false);
      showToast("Perfil atualizado com sucesso!");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
});

/* ---------- Modal de confirmação ---------- */
const modal = $("#confirmModal");
let modalAction = null;

function openModal({ title, text, confirmLabel, danger = false, onConfirm }) {
  $("#modalTitle").textContent = title;
  $("#modalText").textContent = text;
  const confirmBtn = $("#modalConfirm");
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = danger ? "btn btn-danger-ghost" : "btn btn-primary";
  if (danger) confirmBtn.style.cssText = "background:var(--danger);color:#fff;border-color:var(--danger)";
  else confirmBtn.style.cssText = "";
  const icon = $("#modalIcon");
  icon.className = `modal-icon ${danger ? "modal-icon--danger" : "modal-icon--info"}`;
  icon.innerHTML = danger
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>';
  modalAction = onConfirm;
  modal.classList.add("open");
}
function closeModal() { modal.classList.remove("open"); modalAction = null; }
$("#modalCancel").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
$("#modalConfirm").addEventListener("click", async () => {
  if (modalAction) await modalAction();
  closeModal();
});

/* ---------- Sair / excluir conta ---------- */
function handleLogout() {
  openModal({
    title: "Sair da conta?",
    text: "Você precisará fazer login novamente para acessar seu perfil e suas vagas.",
    confirmLabel: "Sim, sair",
    onConfirm: () => {
      AuthService.logout();
      window.location.replace("index.html");
    },
  });
}
$("#logoutButtonTop").addEventListener("click", handleLogout);
$("#logoutButtonSide").addEventListener("click", handleLogout);

$("#deleteAccountButton").addEventListener("click", () => {
  openModal({
    title: "Excluir sua conta?",
    text: "Esta ação é permanente: seu perfil, habilidades e preferências serão apagados e não poderão ser recuperados.",
    confirmLabel: "Excluir definitivamente",
    danger: true,
    onConfirm: async () => {
      await UserService.deleteAccount(session.userId, session.token);
      AuthService.logout();
      showToast("Sua conta foi excluída.", "info");
      setTimeout(() => window.location.replace("index.html"), 400);
    },
  });
});
$("#scrollDanger").addEventListener("click", () => {
  document.getElementById("zona-perigo").scrollIntoView({ behavior: "smooth" });
});

/* Links de funcionalidades futuras */
$$("[data-soon]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showToast("Esta área será desenvolvida nas próximas etapas do TCC 🚧", "info");
  });
});

/* ---------- Carregamento inicial ---------- */
(async function init() {
  if (!session) return;
  currentUser = await UserService.getById(session.userId, session.token);
  if (!currentUser) {
    AuthService.logout();
    window.location.replace("index.html");
    return;
  }
  renderProfile(currentUser);
  document.title = `${currentUser.nome.split(" ")[0]} — Meu Perfil | SkillMatch`;

  const params = new URLSearchParams(window.location.search);
  if (params.get("bemvindo")) {
    showToast(`Bem-vindo(a) ao SkillMatch, ${currentUser.nome.split(" ")[0]}! Complete seu perfil para receber matches 🎯`);
  }
})();
