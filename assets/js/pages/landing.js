import { PlatformService } from "../services/platform.service.js";
import ApiService from "../services/api.service.js";
import { APP_CONFIG } from "../config/app.config.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const catalogRoot = $("#publicCatalogGrid");
const recentRoot = $("#recentJobResults");
const recommendedRoot = $("#recommendedJobResults");
const emptyState = $("#publicEmpty");
const countLabel = $("#publicResultCount");
const notice = $("#catalogNotice");
const modal = $("#publicModal");
const modalBody = $("#publicModalBody");
const modalTitleId = "publicModalTitle";
let allJobs = [];
let catalogMode = "demo";
let activeType = "";
let toastTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function readableDate(value) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}
function initials(value) {
  return String(value || "SM").trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toLocaleUpperCase("pt-BR");
}
function companyFor(job) {
  return PlatformService.getCompany(job.companyId)?.name || job.companyName || "Empresa não informada";
}
function isDemo(job) {
  return job.isDemo === true || job.confirmed === false || job.status === "demo";
}
function statusPresentation(job) {
  if (isDemo(job)) return { label: "Demonstração · não confirmada", className: "demo" };
  const status = normalize(job.status);
  if (status === "confirmed") return { label: "Vaga confirmada", className: "confirmed" };
  if (status === "possibly_closed") return { label: "Possivelmente encerrada", className: "closed" };
  return { label: "Encontrada · não verificada", className: "unverified" };
}
function publicDistance(job) {
  const parts = String($("#publicLocation")?.value || "").split(",").map((part) => part.trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) return "Distância não calculada";
  const distance = PlatformService.distanceEstimate({ city: parts[0], state: parts[1] }, job);
  return distance === null ? "Distância não calculada" : `≈ ${distance} km entre centros urbanos`;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}
function toast(message) {
  const el = $("#landingToast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function getVisibleJobs() {
  const term = normalize($("#publicKeyword").value);
  const location = normalize($("#publicLocation").value);
  const sort = $("#publicSort").value;
  return allJobs.filter((job) => {
    const company = companyFor(job);
    const words = normalize(`${job.title} ${company} ${job.area} ${job.description} ${(job.requirements || []).join(" ")} ${job.type}`);
    const place = normalize(`${job.city || ""} ${job.state || ""} ${job.address || ""}`);
    return (!term || words.includes(term)) && (!location || place.includes(location)) && (!activeType || normalize(job.type) === normalize(activeType));
  }).sort((a, b) => {
    if (sort === "title") return String(a.title).localeCompare(String(b.title), "pt-BR");
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}
function jobCard(job) {
  const name = companyFor(job);
  const location = [job.city, job.state].filter(Boolean).join(", ") || "Localização não informada";
  const skills = (Array.isArray(job.requirements) ? job.requirements : []).slice(0, 3);
  const status = statusPresentation(job);
  const desc = job.description || "Descrição não informada pela fonte.";
  return `<article class="public-job-card" data-job-card="${escapeHtml(job.id)}">
    <div class="job-card-top"><span class="company-monogram" aria-hidden="true">${escapeHtml(initials(name))}</span><div class="public-job-heading"><h3>${escapeHtml(job.title || "Cargo não informado")}</h3><p>${escapeHtml(name)}</p></div><span class="job-status ${status.className}">${escapeHtml(status.label)}</span></div>
    <div class="job-card-meta"><span><b class="meta-symbol" aria-hidden="true">⌖</b>${escapeHtml(location)}</span><span><b class="meta-symbol" aria-hidden="true">↔</b>${escapeHtml(publicDistance(job))}</span><span><b class="meta-symbol" aria-hidden="true">◷</b>${escapeHtml(job.type || "Tipo não informado")}</span><span><b class="meta-symbol" aria-hidden="true">▤</b>${escapeHtml(job.modality || "Modalidade não informada")}</span></div>
    <p class="job-description">${escapeHtml(desc)}</p>
    ${skills.length ? `<div class="job-tags">${skills.map((skill) => `<span class="job-tag">${escapeHtml(skill)}</span>`).join("")}</div>` : ""}
    <div class="job-card-footer"><small>${isDemo(job) ? "Exemplo fictício · nenhum processo seletivo" : `Publicado ${escapeHtml(readableDate(job.createdAt))}`}</small><div class="job-card-actions"><button class="btn btn-ghost" type="button" data-action="details" data-id="${escapeHtml(job.id)}">Detalhes</button><button class="btn btn-ghost" type="button" data-action="save" data-id="${escapeHtml(job.id)}">Salvar</button><button class="btn btn-primary" type="button" data-action="apply" data-id="${escapeHtml(job.id)}">Quero me candidatar</button></div></div>
  </article>`;
}
function renderCompanies() {
  const container = $("#catalogCompanyList");
  const statusCopy = $("#catalogCompanies .catalog-company-heading span");
  statusCopy.textContent = allJobs.some((job) => !isDemo(job))
    ? "Derivadas de anúncios ativos; confira o status individual e a fonte."
    : "Exemplos demonstrativos · sem contratação confirmada";
  const companies = new Map();
  for (const job of allJobs) {
    const company = PlatformService.getCompany(job.companyId);
    const name = company?.name || job.companyName;
    if (name && !companies.has(name)) companies.set(name, company?.sector || job.area || "Empresa participante");
  }
  container.innerHTML = [...companies].slice(0, 5).map(([name, sector]) => `<span class="catalog-company-pill"><span>${escapeHtml(initials(name))}</span><b>${escapeHtml(name)}</b><small>${escapeHtml(sector)}</small></span>`).join("") || `<p class="company-list-empty">Ainda não há empresas com anúncios neste catálogo.</p>`;
}
function render() {
  const jobs = getVisibleJobs();
  const recent = jobs.slice(0, 2);
  const beginnerTypes = new Set(["jovem aprendiz", "primeiro emprego"]);
  const recommended = jobs.slice(2).sort((a, b) => {
    const beginnerA = beginnerTypes.has(normalize(a.type)) ? 0 : 1;
    const beginnerB = beginnerTypes.has(normalize(b.type)) ? 0 : 1;
    return beginnerA - beginnerB || String(a.title).localeCompare(String(b.title), "pt-BR");
  });
  catalogRoot.setAttribute("aria-busy", "false");
  recentRoot.innerHTML = recent.map(jobCard).join("");
  recommendedRoot.innerHTML = recommended.map(jobCard).join("");
  $("#recentGroup").hidden = recent.length === 0;
  $("#recommendedGroup").hidden = recommended.length === 0;
  emptyState.hidden = jobs.length > 0;
  catalogRoot.hidden = jobs.length === 0;
  countLabel.textContent = catalogMode === "live"
    ? `${jobs.length} ${jobs.length === 1 ? "oportunidade pública encontrada" : "oportunidades públicas encontradas"} · confira status e publicação original.`
    : `${jobs.length} ${jobs.length === 1 ? "oportunidade demonstrativa encontrada" : "oportunidades demonstrativas encontradas"} · nenhuma vaga foi confirmada.`;
}
function showModal(title, html, icon = "✦") {
  $("#publicModalIcon").textContent = icon;
  modalBody.innerHTML = `<h2 id="${modalTitleId}">${escapeHtml(title)}</h2>${html}`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  $("#publicModalClose").focus();
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}
function openAccountGate(kind) {
  const isApply = kind === "apply";
  showModal(isApply ? "Crie sua conta para seguir" : "Salve oportunidades no seu perfil", `<p>${isApply ? "Para se candidatar e acompanhar suas oportunidades, crie um perfil gratuito. As vagas exibidas aqui são exemplos demonstrativos; esta ação não envia candidatura a uma empresa." : "Com uma conta, você poderá organizar oportunidades e acompanhar seu perfil. Este catálogo demonstrativo não salva vagas em uma conta real."}</p><div class="modal-status">Ação demonstrativa · sem envio para empresas</div><div class="modal-actions"><a class="btn btn-primary" href="cadastro.html">Criar conta grátis <span aria-hidden="true">→</span></a><a class="btn btn-ghost" href="login.html">Já tenho conta</a></div>`, "↗");
}
function openJobDetails(job) {
  const company = companyFor(job);
  const requirements = Array.isArray(job.requirements) && job.requirements.length ? job.requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Não informado pela publicação</li>";
  const source = safeUrl(job.sourceUrl || job.applicationUrl || job.url);
  const education = job.education || "Não informada";
  const checked = job.lastVerifiedAt ? readableDate(job.lastVerifiedAt) : "Ainda não verificada";
  const status = isDemo(job) ? "Demonstrativa — vaga não confirmada" : (job.statusLabel || "Encontrada — verificação pendente");
  showModal(job.title || "Detalhes da oportunidade", `<p><strong>${escapeHtml(company)}</strong> · ${escapeHtml([job.city, job.state].filter(Boolean).join(", ") || "Localização não informada")}</p><p><strong>Distância aproximada:</strong> ${escapeHtml(publicDistance(job))}. A estimativa usa apenas centros urbanos conhecidos, nunca endereço exato.</p><p>${escapeHtml(job.description || "Descrição não informada pela fonte.")}</p><div class="modal-detail-list"><div><strong>Tipo:</strong> ${escapeHtml(job.type || "Não informado")} · <strong>Modalidade:</strong> ${escapeHtml(job.modality || "Não informada")}</div><div><strong>Escolaridade:</strong> ${escapeHtml(education)}</div><div><strong>Requisitos:</strong><ul>${requirements}</ul></div><div><strong>Publicação:</strong> ${escapeHtml(readableDate(job.createdAt))} · <strong>Última verificação:</strong> ${escapeHtml(checked)}</div><div><strong>Fonte:</strong> ${escapeHtml(job.sourceName || (isDemo(job) ? "Dados demonstrativos SkillMatch" : "Fonte não informada"))}</div></div><span class="modal-status">${escapeHtml(status)}</span>${source ? `<p><a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Abrir publicação original ↗</a></p>` : `<p>Não há link externo de candidatura nesta oportunidade demonstrativa.</p>`}<div class="modal-actions"><button class="btn btn-primary" type="button" data-action="apply">Quero me candidatar</button><button class="btn btn-ghost" type="button" data-modal-close>Fechar</button></div>`, "⌕");
}
function updateFilterButtons(value) {
  activeType = value;
  $$(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === value));
  render();
}
async function loadOpportunities() {
  PlatformService.init();
  const demos = PlatformService.getPublishedJobs();
  const apiBase = APP_CONFIG.apiBaseUrl;
  if (apiBase) {
    try {
      const response = await ApiService.get("/api/jobs");
      const remoteJobs = Array.isArray(response) ? response : response.jobs || response.items || [];
      allJobs = Array.isArray(remoteJobs) ? remoteJobs : [];
      catalogMode = "live";
      notice.innerHTML = `<span class="notice-mark">i</span><p><strong>Oportunidades públicas da plataforma.</strong> Os estados de verificação e as fontes exibidos em cada vaga são fornecidos pelo serviço configurado. Confira sempre a publicação original antes de se candidatar.</p>`;
      if (!allJobs.length) notice.innerHTML = `<span class="notice-mark">i</span><p><strong>Nenhuma oportunidade pública encontrada.</strong> Não há anúncios ativos retornados pelo serviço conectado. Não mostramos empresas como contratantes sem vaga publicada.</p>`;
    } catch (error) {
      allJobs = demos;
      notice.innerHTML = `<span class="notice-mark">i</span><p><strong>Serviço de oportunidades indisponível.</strong> ${escapeHtml(error.message)} Exibimos apenas registros demonstrativos locais; nenhuma pesquisa externa ocorreu.</p>`;
    }
  } else {
    allJobs = demos;
    notice.innerHTML = `<span class="notice-mark">i</span><p><strong>Catálogo demonstrativo.</strong> As oportunidades disponíveis nesta versão são dados fictícios para você conhecer as funcionalidades. Nenhuma vaga real foi pesquisada ou confirmada.</p>`;
  }
  renderCompanies();
  render();
}

$("#publicSearchForm").addEventListener("submit", (event) => { event.preventDefault(); render(); $("#oportunidades").scrollIntoView({ behavior: "smooth", block: "start" }); });
$("#publicKeyword").addEventListener("input", render);
$("#publicLocation").addEventListener("input", render);
$("#publicSort").addEventListener("change", render);
$$(".filter-chip").forEach((chip) => chip.addEventListener("click", () => updateFilterButtons(chip.dataset.filter)));
$("#showAllJobs").addEventListener("click", () => { $("#publicKeyword").value = ""; $("#publicLocation").value = ""; updateFilterButtons(""); $("#oportunidades").scrollIntoView({ behavior: "smooth" }); });
$("#clearPublicFilters").addEventListener("click", () => { $("#publicKeyword").value = ""; $("#publicLocation").value = ""; $("#publicSort").value = "recent"; updateFilterButtons(""); });
$("#publicModalClose").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal || event.target.closest("[data-modal-close]")) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) closeModal(); });
catalogRoot.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const job = allJobs.find((item) => String(item.id) === button.dataset.id);
  if (button.dataset.action === "details" && job) openJobDetails(job);
  if (button.dataset.action === "apply") openAccountGate("apply");
  if (button.dataset.action === "save") openAccountGate("save");
});
modal.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="apply"], [data-action="save"]');
  if (button) openAccountGate(button.dataset.action);
});
$("#landingMenuToggle").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  $("#landingNav").classList.toggle("open", !expanded);
});
$$("#landingNav a").forEach((link) => link.addEventListener("click", () => {
  $("#landingMenuToggle").setAttribute("aria-expanded", "false");
  $("#landingNav").classList.remove("open");
}));

loadOpportunities().catch((error) => {
  catalogRoot.setAttribute("aria-busy", "false");
  allJobs = [];
  render();
  toast(`Não foi possível carregar o catálogo: ${error.message}`);
});
