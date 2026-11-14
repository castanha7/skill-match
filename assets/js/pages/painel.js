import { $, $$, showToast, setFieldError, clearFieldError } from "../utils/dom.js";
import { Validators } from "../utils/validators.js";
import { Formatters } from "../utils/formatters.js";
import { APP_CONFIG, CATALOGS, USER_ROLES } from "../config/app.config.js";
import { AuthService } from "../services/auth.service.js";
import { UserService } from "../services/user.service.js";
import { PlatformService } from "../services/platform.service.js";

const appNav = $("#appNav");
const appContent = $("#appContent");
const pageHeader = $("#pageHeader");
const appModal = $("#appModal");
const appModalPanel = $("#appModalPanel");
const appModalContent = $("#appModalContent");
const appSidebar = $("#appSidebar");
const sidebarScrim = $("#sidebarScrim");
const menuToggle = $("#menuToggle");

let session = null;
let currentUser = null;
let currentCompany = null;
let currentView = "home";
let pendingModalAction = null;

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/></svg>',
  radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4-6.4M12 12l6.4 6.4"/><circle cx="12" cy="12" r="2"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
  applications: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-3M8 2h8v5H8zM7 12h10M7 16h7"/></svg>',
  resume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8zM14 2v6h6M8 13h8M8 17h6"/></svg>',
  courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 8 10-5 10 5-10 5zM6 10v6c3 3 9 3 12 0v-6M22 8v7"/></svg>',
  notifications: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.5-2.6 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.5-2.6 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h3l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.5 2.6-1.4 1.1a7 7 0 0 1 0 1.7z" transform="translate(-1 -1)"/></svg>',
  company: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 2.8-5.5 7-5.5s7 2 7 5.5M16 5.5a3.5 3.5 0 0 1 0 6.8M18 15c2.4.6 4 2.2 4 5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></svg>',
  ad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h2l9 5V4l-9 5H5a2 2 0 0 0-2 2zM16 9a4 4 0 0 1 0 6M7 15l1.5 5"/></svg>',
  issue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="m10.3 3.9-8.5 14a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3l-8.5-14a2 2 0 0 0-3.4 0z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
};

const NAV_ITEMS = {
  candidate: [
    { id: "home", label: "Início", icon: "home" },
    { id: "radar", label: "Radar de oportunidades", icon: "radar" },
    { id: "jobs", label: "Vagas", icon: "jobs" },
    { id: "applications", label: "Minhas candidaturas", icon: "applications" },
    { id: "resume", label: "Currículo", icon: "resume" },
    { id: "courses", label: "Cursos e desenvolvimento", icon: "courses" },
    { id: "notifications", label: "Notificações", icon: "notifications" },
    { id: "profile", label: "Meu perfil", icon: "profile", href: "perfil.html" },
    { id: "settings", label: "Configurações", icon: "settings" },
  ],
  company: [
    { id: "home", label: "Painel principal", icon: "home" },
    { id: "company-profile", label: "Dados da empresa", icon: "company" },
    { id: "company-jobs", label: "Vagas publicadas", icon: "jobs" },
    { id: "company-applicants", label: "Candidatos", icon: "people" },
  ],
  admin: [
    { id: "home", label: "Dashboard", icon: "home" },
    { id: "admin-candidates", label: "Candidatos", icon: "people" },
    { id: "admin-companies", label: "Empresas", icon: "company" },
    { id: "admin-jobs", label: "Vagas", icon: "jobs" },
    { id: "admin-ads", label: "Anúncios", icon: "ad" },
    { id: "admin-reports", label: "Relatos e problemas", icon: "issue" },
  ],
};

const PAGE_META = {
  candidate: {
    home: ["Visão geral", "Início", "Seu próximo passo profissional começa com um perfil completo e oportunidades que façam sentido."],
    radar: ["Descoberta demonstrativa", "Radar de oportunidades", "Empresas de exemplo e anúncios fictícios ordenados por compatibilidade estimada e região."],
    jobs: ["Catálogo local", "Vagas", "Pesquise e filtre anúncios demonstrativos. Nenhuma vaga exibida representa contratação confirmada."],
    applications: ["Acompanhamento local", "Minhas candidaturas", "Veja os interesses que você registrou neste navegador e os status de demonstração."],
    resume: ["Seu perfil profissional", "Currículo", "Visualize um currículo organizado com suas informações e use a impressão do navegador para salvar como PDF."],
    courses: ["Aprendizado contínuo", "Cursos e desenvolvimento", "Sugestões de temas para estudar. Não são cursos parceiros nem certificados oficiais."],
    notifications: ["Atualizações", "Notificações", "Avisos gerados pela demonstração local. Nenhuma comunicação foi enviada por e-mail."],
    settings: ["Conta e privacidade", "Configurações", "Preferências salvas neste navegador. Para produção, autenticação e privacidade precisam de backend."],
  },
  company: {
    home: ["Área da empresa", "Painel principal", "Gerencie seu perfil demonstrativo, anúncios de vaga e candidaturas recebidas localmente."],
    "company-profile": ["Perfil empresarial", "Dados da empresa", "Edite os dados da conta de demonstração. A validação real da empresa requer serviço externo."],
    "company-jobs": ["Publicação e gestão", "Vagas publicadas", "Crie, edite, arquive e acompanhe anúncios demonstrativos. Novas vagas aguardam revisão do admin local."],
    "company-applicants": ["Processos demonstrativos", "Candidatos interessados", "Consulte currículos e altere status de candidaturas registradas neste navegador."],
  },
  admin: {
    home: ["Administração separada", "Dashboard", "Indicadores sobre os dados fictícios locais. Este painel não concede segurança real em uma hospedagem estática."],
    "admin-candidates": ["Contas locais", "Gerenciamento de candidatos", "Consulte perfis e simule bloqueio ou desbloqueio de contas de demonstração."],
    "admin-companies": ["Cadastros locais", "Gerenciamento de empresas", "Revise dados, simule verificação e controle de disponibilidade das empresas demonstrativas."],
    "admin-jobs": ["Moderação local", "Gerenciamento de vagas", "Edite, aprove, suspenda ou remova anúncios demonstrativos antes de mostrá-los ao candidato."],
    "admin-ads": ["Conteúdo institucional", "Controle de anúncios", "Crie comunicados demonstrativos e controle sua exibição no painel do candidato."],
    "admin-reports": ["Suporte local", "Relatos e problemas", "Revise relatos enviados pela interface. Eles permanecem apenas no armazenamento deste navegador."],
  },
};

const COURSES = [
  { id: "web-basics", area: "Tecnologia", title: "Fundamentos de HTML e CSS", description: "Monte páginas acessíveis, entenda estrutura semântica e pratique layouts responsivos.", skills: ["HTML e CSS", "Acessibilidade", "Responsividade"] },
  { id: "logic", area: "Tecnologia", title: "Lógica de programação", description: "Pratique variáveis, decisões, repetição e resolução de problemas com pequenos exercícios.", skills: ["Lógica de programação", "JavaScript"] },
  { id: "spreadsheets", area: "Administração", title: "Planilhas e Excel para iniciantes", description: "Explore organização de dados, fórmulas simples, filtros e apresentação de resultados.", skills: ["Excel", "Pacote Office", "Organização"] },
  { id: "customer-service", area: "Carreira", title: "Atendimento e comunicação profissional", description: "Desenvolva escuta ativa, comunicação clara e resolução respeitosa de demandas.", skills: ["Comunicação", "Atendimento ao cliente"] },
  { id: "resume-interview", area: "Carreira", title: "Currículo e entrevista: preparação", description: "Organize experiências escolares e projetos e pratique respostas para entrevistas.", skills: ["Comunicação", "Organização"] },
  { id: "digital-safety", area: "Carreira", title: "Segurança digital e cidadania", description: "Aprenda noções de privacidade, senhas, golpes e cuidado com dados pessoais.", skills: ["Segurança digital", "Privacidade"] },
];

const DISTANCE_OPTIONS = [10, 25, 50, 100, 250];
const APPLICATION_STATUSES = ["Recebida", "Em análise", "Entrevista", "Não selecionada", "Contratada"];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function safeHttpUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".") ? url.href : "";
  } catch {
    return "";
  }
}

function normalizedText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function firstName(name) {
  return String(name ?? "").trim().split(/\s+/)[0] || "Olá";
}

function initials(name) {
  return Formatters.initials(name);
}

function formattedDate(value, withTime = false) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function locationText(place) {
  if (!place?.city) return "Localização não informada";
  return `${place.city}${place.state ? `, ${place.state}` : ""}`;
}

function statusClass(status) {
  const normalized = normalizedText(status);
  if (["contratada", "entrevista", "aprovada", "ativo", "resolvido", "verificada"].some((key) => normalized.includes(key))) return "success";
  if (["nao selecionada", "bloqueada", "suspensa", "removida", "desistiu"].some((key) => normalized.includes(key))) return "danger";
  if (["recebida", "análise", "pendente", "aberto", "aguardando"].some((key) => normalized.includes(key))) return "pending";
  return "";
}

function statusBadge(label) {
  return `<span class="status-pill ${statusClass(label)}">${escapeHtml(label)}</span>`;
}

function optionList(items, selected = "", placeholder = "Selecione") {
  return `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}`;
}

function setHeader(eyebrow, title, description, action = "") {
  pageHeader.innerHTML = `<div class="page-header-copy"><div class="page-eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action ? `<div class="page-header-action">${action}</div>` : ""}`;
}

function button(label, action, options = {}) {
  const style = options.style || "btn-primary";
  const icon = options.icon ? ICONS[options.icon] || "" : "";
  return `<button type="button" class="btn ${style} ${options.small ? "btn-sm" : ""}" data-action="${escapeHtml(action)}" ${options.id ? `data-id="${escapeHtml(options.id)}"` : ""}>${icon}${escapeHtml(label)}</button>`;
}

function companyName(companyId) {
  return PlatformService.getCompany(companyId)?.name || "Empresa demonstrativa";
}

function distanceLabel(candidate, place) {
  const distance = PlatformService.distanceEstimate(candidate, place);
  return distance === null ? "Distância não calculada" : `≈ ${distance} km entre centros urbanos · demo`;
}

function jobScore(job, candidate) {
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];
  const candidateSkills = (candidate.habilidades || []).map(normalizedText);
  const overlap = requirements.filter((skill) => candidateSkills.includes(normalizedText(skill))).length;
  let score = 15;
  if (candidate.areaInteresse && normalizedText(candidate.areaInteresse) === normalizedText(job.area)) score += 24;
  else if (candidate.areaInteresse && normalizedText(candidate.areaInteresse).includes(normalizedText(job.area).slice(0, 7))) score += 10;
  if ((candidate.tiposVaga || []).some((type) => normalizedText(type) === normalizedText(job.type))) score += 17;
  if (requirements.length) score += Math.round((overlap / requirements.length) * 32);
  if (candidate.escolaridade && job.education && normalizedText(candidate.escolaridade).split(" ").some((part) => part.length > 4 && normalizedText(job.education).includes(part))) score += 8;
  if (candidate.cidade && normalizedText(candidate.cidade) === normalizedText(job.city) && candidate.estado === job.state) score += 10;
  else if (candidate.estado && candidate.estado === job.state) score += 4;
  return Math.max(10, Math.min(99, score));
}

function candidateJobMeta(job) {
  return {
    score: jobScore(job, currentUser),
    distance: PlatformService.distanceEstimate(currentUser, job),
  };
}

function hasApplied(jobId) {
  return PlatformService.getCandidateApplications(currentUser.id).some((application) => application.jobId === jobId && application.status !== "Desistiu");
}

function jobCard(job, { showScore = false, showDescription = true, applications = null } = {}) {
  const company = PlatformService.getCompany(job.companyId);
  const score = showScore ? jobScore(job, currentUser) : null;
  const alreadyApplied = applications ? applications.has(job.id) : hasApplied(job.id);
  const requirementTags = (job.requirements || []).slice(0, 4).map((skill) => `<span class="tag-view">${escapeHtml(skill)}</span>`).join("");
  const url = safeHttpUrl(job.applicationUrl);
  return `<article class="job-card">
    <div class="job-card-head">
      <div><h3 class="job-card-title">${escapeHtml(job.title)}</h3><p class="job-company">${escapeHtml(company?.name || "Empresa demonstrativa")}</p></div>
      ${score !== null ? `<span class="compat-pill">${score}% compatibilidade estimada</span>` : ""}
    </div>
    <div class="job-card-meta">
      <span>${ICONS.location}${escapeHtml(locationText(job))}</span>
      ${session.role === "candidate" ? `<span>${ICONS.radar}${escapeHtml(distanceLabel(currentUser, job))}</span>` : ""}
      <span>${ICONS.jobs}${escapeHtml(job.type || "Tipo não informado")}</span>
      <span>${escapeHtml(job.modality || "Modalidade não informada")}</span>
    </div>
    ${showDescription ? `<p class="job-card-description">${escapeHtml(job.description)}</p>` : ""}
    ${requirementTags ? `<div class="tag-list">${requirementTags}</div>` : ""}
    <div class="job-card-footer">
      <span class="demo-tag">Demonstração · contratação não confirmada</span>
      <div class="job-card-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="job-details" data-id="${escapeHtml(job.id)}">Ver detalhes</button>
        ${alreadyApplied ? '<span class="status-pill success">Interesse registrado</span>' : `<button type="button" class="btn btn-primary btn-sm" data-action="apply-job" data-id="${escapeHtml(job.id)}">Registrar interesse</button>`}
        ${url ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Canal externo</a>` : ""}
      </div>
    </div>
  </article>`;
}

function emptyState(title, message, icon = "search") {
  return `<div class="empty-state-card">${ICONS[icon] || ICONS.search}<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
}

function renderNavigation() {
  const items = NAV_ITEMS[session.role] || [];
  appNav.innerHTML = items.map((item) => item.href
    ? `<a class="app-nav-item external" href="${escapeHtml(item.href)}">${ICONS[item.icon]}<span>${escapeHtml(item.label)}</span></a>`
    : `<button type="button" class="app-nav-item" data-view="${escapeHtml(item.id)}">${ICONS[item.icon]}<span>${escapeHtml(item.label)}</span></button>`).join("");
  $("#sidebarAvatar").innerHTML = currentUser.fotoDataUrl
    ? `<img src="${escapeHtml(currentUser.fotoDataUrl)}" alt="" />`
    : escapeHtml(initials(currentUser.nome));
  $("#sidebarName").textContent = currentUser.nome || USER_ROLES[session.role];
  $("#sidebarRole").textContent = USER_ROLES[session.role] || "SkillMatch";
  $("#notificationShortcut").hidden = session.role !== "candidate";
  updateNotificationCount();
}

function viewIsAllowed(view) {
  return (NAV_ITEMS[session.role] || []).some((item) => item.id === view && !item.href);
}

function setView(view) {
  if (!viewIsAllowed(view)) return;
  currentView = view;
  renderPage();
  closeMobileMenu();
}

function updateNotificationCount() {
  const badge = $("#notificationCount");
  if (session?.role !== "candidate" || !currentUser) {
    badge.hidden = true;
    return;
  }
  const count = PlatformService.getCandidateNotifications(currentUser.id).filter((item) => !item.read).length;
  badge.textContent = count > 9 ? "9+" : String(count);
  badge.hidden = count === 0;
}

function renderPage() {
  if (!session || !currentUser) return;
  if (!viewIsAllowed(currentView)) currentView = "home";
  const meta = PAGE_META[session.role]?.[currentView] || PAGE_META[session.role].home;
  renderNavigation();
  $$("[data-view]", appNav).forEach((item) => item.classList.toggle("active", item.dataset.view === currentView));

  let html = "";
  if (session.role === "candidate") {
    if (currentView === "home") html = renderCandidateHome();
    else if (currentView === "radar") html = renderRadar();
    else if (currentView === "jobs") html = renderJobsPage();
    else if (currentView === "applications") html = renderApplicationsPage();
    else if (currentView === "resume") html = renderResumePage();
    else if (currentView === "courses") html = renderCoursesPage();
    else if (currentView === "notifications") html = renderNotificationsPage();
    else if (currentView === "settings") html = renderSettingsPage();
  } else if (session.role === "company") {
    if (currentView === "home") html = renderCompanyHome();
    else if (currentView === "company-profile") html = renderCompanyProfilePage();
    else if (currentView === "company-jobs") html = renderCompanyJobsPage();
    else if (currentView === "company-applicants") html = renderCompanyApplicantsPage();
  } else if (session.role === "admin") {
    if (currentView === "home") html = renderAdminHome();
    else if (currentView === "admin-candidates") html = renderAdminCandidatesPage();
    else if (currentView === "admin-companies") html = renderAdminCompaniesPage();
    else if (currentView === "admin-jobs") html = renderAdminJobsPage();
    else if (currentView === "admin-ads") html = renderAdminAdsPage();
    else if (currentView === "admin-reports") html = renderAdminReportsPage();
  }
  const headerAction = getHeaderAction();
  setHeader(meta[0], meta[1], meta[2], headerAction);
  appContent.innerHTML = html || emptyState("Área indisponível", "Selecione uma seção no menu para continuar.");
  if (currentView === "jobs") renderFilteredJobs();
  if (currentView === "admin-candidates") renderAdminCandidatesTable();
  if (currentView === "admin-companies") renderAdminCompaniesTable();
  updateNotificationCount();
}

function getHeaderAction() {
  if (session.role === "candidate" && currentView === "home") return button("Completar meu perfil", "go-profile", { small: true, icon: "profile" });
  if (session.role === "candidate" && currentView === "jobs") return button("Limpar filtros", "clear-job-filters", { style: "btn-ghost", small: true });
  if (session.role === "company" && currentView === "company-jobs") return button("Publicar vaga", "new-job", { small: true, icon: "jobs" });
  if (session.role === "admin" && currentView === "admin-ads") return button("Novo anúncio demonstrativo", "new-ad", { small: true, icon: "ad" });
  if (currentView === "resume") return button("Imprimir / salvar em PDF", "print-resume", { style: "btn-primary", small: true });
  return "";
}

function renderCandidateHome() {
  const completeness = UserService.calculateCompleteness(currentUser);
  const applications = PlatformService.getCandidateApplications(currentUser.id);
  const activeApplications = applications.filter((application) => !["Desistiu", "Não selecionada", "Contratada"].includes(application.status)).length;
  const unread = PlatformService.getCandidateNotifications(currentUser.id).filter((item) => !item.read).length;
  const recommendations = PlatformService.getPublishedJobs().map((job) => ({ job, score: jobScore(job, currentUser) })).sort((a, b) => b.score - a.score).slice(0, 2);
  const ads = PlatformService.getCandidateAds();
  const newest = PlatformService.getCandidateNotifications(currentUser.id)[0];
  const completedItems = completeness.checklist.filter((item) => item.done && !item.optional).length;
  const requiredItems = completeness.checklist.filter((item) => !item.optional).length;
  return `<div class="stat-grid">
    <div class="stat-card"><div class="stat-card-top"><span>Compatíveis no catálogo</span><span class="stat-icon">${ICONS.radar}</span></div><strong>${PlatformService.getPublishedJobs().length}</strong><span>Anúncios de demonstração, não confirmados</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Candidaturas em andamento</span><span class="stat-icon">${ICONS.applications}</span></div><strong>${activeApplications}</strong><span>Registros locais do seu perfil</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Perfil completo</span><span class="stat-icon">${ICONS.profile}</span></div><strong>${completeness.percentage}%</strong><span>${completedItems} de ${requiredItems} itens essenciais</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Não lidas</span><span class="stat-icon">${ICONS.notifications}</span></div><strong>${unread}</strong><span>Avisos somente deste navegador</span></div>
  </div>
  ${ads.map((ad) => `<section class="panel-card is-tinted" style="margin-bottom:1rem"><div class="eyebrow">Comunicado demonstrativo</div><h2>${escapeHtml(ad.title)}</h2><p style="margin-top:.4rem">${escapeHtml(ad.message)}</p></section>`).join("")}
  <div class="panel-grid two">
    <section class="panel-card">
      <div class="card-head"><div class="card-head-copy"><h2>Olá, ${escapeHtml(firstName(currentUser.nome))} 👋</h2><p class="panel-card-subtitle">Ajuste seu perfil para melhorar a estimativa de compatibilidade.</p></div>${statusBadge(`${completeness.percentage}% completo`)}</div>
      <div class="progress-track"><span style="width:${completeness.percentage}%"></span></div>
      <div class="progress-meta"><span>Itens essenciais preenchidos</span><strong>${completeness.percentage}%</strong></div>
      <div class="quick-link-row">${button("Editar meu perfil", "go-profile", { small: true })}${button("Ver currículo", "go-view", { style: "btn-ghost", small: true, id: "resume" })}</div>
    </section>
    <section class="panel-card is-tinted">
      <div class="eyebrow">Radar SkillMatch · demonstração</div><h2>Oportunidades que combinam com você</h2>
      <p style="margin-top:.45rem">A compatibilidade usa regras locais de área, habilidades, tipo de vaga e região. Não é inteligência artificial nem integração de vagas.</p>
      <div class="quick-link-row">${button("Abrir meu radar", "go-view", { style: "btn-ghost", small: true, id: "radar" })}</div>
    </section>
  </div>
  <section class="panel-card" style="margin-top:1rem">
    <div class="card-head"><div class="card-head-copy"><h2>Oportunidades recomendadas</h2><p class="panel-card-subtitle">Anúncios fictícios para você experimentar os filtros e o fluxo de interesse.</p></div>${button("Ver todas", "go-view", { style: "btn-ghost", small: true, id: "jobs" })}</div>
    <div class="job-list">${recommendations.length ? recommendations.map(({ job }) => jobCard(job, { showScore: true, showDescription: false })).join("") : emptyState("Sem anúncios no catálogo", "Volte mais tarde ou ajuste seus filtros.")}</div>
  </section>
  <div class="panel-grid two" style="margin-top:1rem">
    <section class="panel-card"><div class="card-head"><div><h2>Notificação recente</h2><p class="panel-card-subtitle">Avisos são gerados localmente na demonstração.</p></div>${button("Abrir notificações", "go-view", { style: "btn-ghost", small: true, id: "notifications" })}</div>
      ${newest ? `<div class="notification-card ${newest.read ? "" : "unread"}"><span class="notification-icon">${ICONS.notifications}</span><div class="notification-copy"><strong>${escapeHtml(newest.title)}</strong><p>${escapeHtml(newest.message)}</p><small>${formattedDate(newest.createdAt, true)}</small></div></div>` : emptyState("Tudo em dia", "Ainda não há avisos.", "notifications")}
    </section>
    <section class="panel-card"><div class="card-head"><div><h2>Plano de desenvolvimento</h2><p class="panel-card-subtitle">Sugestões de estudo, sem vínculo com cursos pagos ou certificados.</p></div>${button("Explorar temas", "go-view", { style: "btn-ghost", small: true, id: "courses" })}</div><p style="color:var(--text-muted);font-size:.85rem">${PlatformService.getCourseProgress(currentUser.id).planned.length} tema(s) no seu plano e ${PlatformService.getCourseProgress(currentUser.id).completed.length} marcado(s) como concluído(s).</p></section>
  </div>`;
}

function renderRadar() {
  const settings = PlatformService.getCandidateSettings(currentUser.id);
  const companies = PlatformService.getCompanies();
  const publishedJobs = PlatformService.getPublishedJobs();
  const maxDistance = Number(settings.distanceMaxKm) || 50;
  const visibleJobs = publishedJobs.filter((job) => {
    const distance = PlatformService.distanceEstimate(currentUser, job);
    return distance === null || distance <= maxDistance;
  }).sort((a, b) => jobScore(b, currentUser) - jobScore(a, currentUser));
  const sortedCompanies = companies.map((company) => ({ company, distance: PlatformService.distanceEstimate(currentUser, company) }))
    .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER));
  const radiusSelect = `<select class="input" id="radarRadius" aria-label="Distância máxima">${DISTANCE_OPTIONS.map((distance) => `<option value="${distance}" ${maxDistance === distance ? "selected" : ""}>${distance} km</option>`).join("")}</select>`;
  return `<section class="panel-card" style="margin-bottom:1rem">
    <div class="card-head"><div class="card-head-copy"><h2>Como o radar funciona nesta versão</h2><p class="panel-card-subtitle">Usa sua cidade/UF, área, tipos de vaga, escolaridade e habilidades para ordenar os exemplos. A distância é aproximada entre centros urbanos conhecidos; sem Google Maps.</p></div><span class="demo-tag">Sem integração externa</span></div>
    <div class="form-row" style="align-items:end"><div><label for="radarRadius" style="display:block;font-size:.78rem;font-weight:700;color:var(--navy-800);margin-bottom:.35rem">Distância máxima desejada</label>${radiusSelect}</div><p class="form-help">Ajuste este valor em Configurações para manter sua preferência. Cidades sem coordenadas demonstrativas aparecem como distância não calculada.</p></div>
    ${!currentUser.cidade || !currentUser.estado ? `<p class="form-help" style="margin-top:.6rem">Complete sua cidade e estado em Meu perfil para estimativas regionais melhores.</p>` : ""}
  </section>
  <div class="panel-grid two">
    <section class="panel-card"><div class="card-head"><div><h2>Empresas demonstrativas encontradas</h2><p class="panel-card-subtitle">Registros fictícios para testar localização. Não são empresas confirmadas no radar.</p></div></div>
      <div class="job-list">${sortedCompanies.map(({ company, distance }) => `<article class="company-found-card"><span class="company-found-icon">${ICONS.company}</span><div><h3>${escapeHtml(company.name)}</h3><p>${escapeHtml(company.sector || "Setor não informado")} · ${escapeHtml(locationText(company))}</p><p>${escapeHtml(company.address || "Localização demonstrativa")}</p><p>${distance === null ? "Distância não calculada sem dados demonstrativos para a cidade." : `≈ ${distance} km entre centros urbanos (estimativa demonstrativa, não endereço real).`}</p><p><strong>Vagas confirmadas: nenhuma.</strong> ${company.id === "company-demo" ? `${publishedJobs.filter((job) => job.companyId === company.id).length} anúncio(s) demonstrativo(s) no catálogo.` : "Não há anúncio associado a este registro."}</p></div><span class="demo-tag">Fictícia</span></article>`).join("") || emptyState("Nenhum registro encontrado", "Não há empresas demonstrativas neste catálogo.", "company")}</div>
    </section>
    <section class="panel-card"><div class="card-head"><div><h2>Oportunidades compatíveis</h2><p class="panel-card-subtitle">${visibleJobs.length} anúncio(s) demonstrativo(s) dentro do filtro regional atual.</p></div></div>
      <div class="job-list">${visibleJobs.length ? visibleJobs.map((job) => jobCard(job, { showScore: true, showDescription: false })).join("") : emptyState("Nenhum anúncio nesta distância", "Tente ampliar o raio ou atualizar cidade, área e tipos de vaga no perfil.")}</div>
    </section>
  </div>
  <p class="form-help" style="margin-top:.9rem">Compatibilidade percentual = regra demonstrativa baseada em campos do perfil. Não prevê contratação nem representa avaliação automatizada real.</p>`;
}

function renderJobsPage() {
  return `<section class="panel-card filter-panel" aria-label="Filtros de vagas">
    <div class="field"><label for="jobSearch">Pesquisar</label><input class="input" id="jobSearch" type="search" placeholder="Cargo, empresa ou palavra-chave" /></div>
    <div class="field"><label for="jobArea">Área</label><select class="input" id="jobArea">${optionList(CATALOGS.areasInteresse, "", "Todas as áreas")}</select></div>
    <div class="field"><label for="jobType">Tipo</label><select class="input" id="jobType">${optionList(CATALOGS.tiposVaga, "", "Todos os tipos")}</select></div>
    <div class="field"><label for="jobModality">Modalidade</label><select class="input" id="jobModality">${optionList(CATALOGS.modalidades, "", "Todas")}</select></div>
    <div class="field"><label for="jobCity">Cidade ou UF</label><input class="input" id="jobCity" type="search" placeholder="Ex.: Curitiba ou PR" /></div>
  </section>
  <p class="results-caption" id="jobResultsCaption"></p>
  <div class="job-list" id="jobResults"></div>`;
}

function renderFilteredJobs() {
  const results = $("#jobResults", appContent);
  if (!results) return;
  const term = normalizedText($("#jobSearch", appContent)?.value);
  const area = $("#jobArea", appContent)?.value || "";
  const type = $("#jobType", appContent)?.value || "";
  const modality = $("#jobModality", appContent)?.value || "";
  const city = normalizedText($("#jobCity", appContent)?.value);
  const jobs = PlatformService.getPublishedJobs().filter((job) => {
    const company = companyName(job.companyId);
    const termMatches = !term || normalizedText(`${job.title} ${company} ${job.area} ${job.description} ${(job.requirements || []).join(" ")}`).includes(term);
    const cityMatches = !city || normalizedText(`${job.city} ${job.state} ${job.address}`).includes(city);
    return termMatches && (!area || job.area === area) && (!type || job.type === type) && (!modality || job.modality === modality) && cityMatches;
  });
  $("#jobResultsCaption", appContent).textContent = `${jobs.length} resultado(s) · todos os anúncios são demonstrativos e não confirmam contratação.`;
  results.innerHTML = jobs.length ? jobs.map((job) => jobCard(job, { showScore: true })).join("") : emptyState("Nenhuma oportunidade encontrada", "Altere os filtros ou aguarde a aprovação de novos anúncios demonstrativos.");
}

function renderApplicationsPage() {
  const applications = PlatformService.getCandidateApplications(currentUser.id);
  return `<section class="panel-card" style="margin-bottom:1rem"><div class="card-head"><div><h2>Interesses registrados</h2><p class="panel-card-subtitle">Ao clicar em “Registrar interesse”, nenhuma candidatura é enviada para fora deste navegador. Status alterados por empresa são apenas demonstrações.</p></div><span class="demo-tag">Local</span></div></section>
    <div class="job-list">${applications.length ? applications.map((application) => {
      const job = application.job;
      const company = application.company;
      return `<article class="application-card"><div><div style="display:flex;align-items:center;gap:.55rem;flex-wrap:wrap"><h3>${escapeHtml(job?.title || "Anúncio indisponível")}</h3>${statusBadge(application.status)}</div><p>${escapeHtml(company?.name || "Empresa demonstrativa")} · ${escapeHtml(locationText(job))} · registrada ${formattedDate(application.createdAt, true)}</p><ul class="application-history">${(application.history || []).slice(-3).reverse().map((entry) => `<li>${escapeHtml(entry.status)} — ${formattedDate(entry.at, true)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</li>`).join("")}</ul></div><div class="job-card-actions">${job ? `<button type="button" class="btn btn-ghost btn-sm" data-action="job-details" data-id="${escapeHtml(job.id)}">Ver vaga</button>` : ""}${application.status !== "Desistiu" && !["Não selecionada", "Contratada"].includes(application.status) ? `<button type="button" class="btn btn-danger-ghost btn-sm" data-action="withdraw-application" data-id="${escapeHtml(application.id)}">Desistir</button>` : ""}</div></article>`;
    }).join("") : emptyState("Você ainda não registrou interesse", "Explore o catálogo demonstrativo e use o botão “Registrar interesse” para testar o acompanhamento.", "applications")}</div>`;
}

function resumeLink(label, value) {
  const url = safeHttpUrl(value);
  return url ? `<a class="resume-links" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : "";
}

function renderResumePage() {
  const courses = [...(currentUser.cursos || [])];
  if (currentUser.curso) courses.unshift(`${currentUser.curso}${currentUser.instituicao ? ` — ${currentUser.instituicao}` : ""}`);
  const age = currentUser.dataNascimento && Validators.birthDate(currentUser.dataNascimento) ? `${Validators.age(currentUser.dataNascimento)} anos` : "";
  const image = currentUser.fotoDataUrl ? `<img src="${escapeHtml(currentUser.fotoDataUrl)}" alt="Foto de ${escapeHtml(currentUser.nome)}" />` : escapeHtml(initials(currentUser.nome));
  return `<div class="print-hide" style="margin-bottom:.8rem;color:var(--text-muted);font-size:.82rem">Confira as informações e edite os campos pela aba <button type="button" class="link-button" data-action="go-profile">Meu perfil</button>. A impressão/PDF é gerada pelo navegador.</div>
    <article class="resume-paper">
      <header class="resume-top"><div><h2>${escapeHtml(currentUser.nome || "Seu nome")}</h2><p>${escapeHtml([currentUser.areaInteresse, currentUser.curso].filter(Boolean).join(" · ") || "Perfil profissional em construção")}</p><p>${escapeHtml([currentUser.email, currentUser.telefone, locationText(currentUser), age].filter((value) => value && value !== "Localização não informada").join(" · "))}</p><p>${[resumeLink("LinkedIn", currentUser.linkedin), resumeLink("GitHub", currentUser.github), resumeLink("Portfólio", currentUser.portfolio)].filter(Boolean).join(" · ")}</p></div><div class="resume-avatar">${image}</div></header>
      <section class="resume-section"><h3>Objetivo e resumo</h3><p>${escapeHtml(currentUser.resumo || "Adicione um resumo no seu perfil para apresentar seus objetivos profissionais.")}</p></section>
      <section class="resume-section"><h3>Formação</h3><p>${escapeHtml([currentUser.escolaridade, currentUser.curso, currentUser.instituicao].filter(Boolean).join(" · ") || "Formação ainda não informada.")}</p></section>
      <section class="resume-section"><h3>Cursos complementares</h3>${courses.length ? `<ul>${courses.map((course) => `<li>${escapeHtml(course)}</li>`).join("")}</ul>` : `<p>Nenhum curso complementar cadastrado.</p>`}</section>
      <section class="resume-section"><h3>Experiência e projetos</h3>${currentUser.experiencias?.length ? `<ul>${currentUser.experiencias.map((experience) => `<li>${escapeHtml(experience)}</li>`).join("")}</ul>` : `<p>Nenhuma experiência cadastrada. Projetos escolares, atividades voluntárias e trabalhos informais também podem ser incluídos no perfil.</p>`}</section>
      <section class="resume-section"><h3>Habilidades</h3><p>${escapeHtml((currentUser.habilidades || []).join(" · ") || "Adicione suas habilidades no perfil.")}</p></section>
      <section class="resume-section"><h3>Interesses profissionais</h3><p>${escapeHtml([currentUser.areaInteresse, ...(currentUser.tiposVaga || []), currentUser.disponibilidade].filter(Boolean).join(" · ") || "Preferências ainda não informadas.")}</p></section>
      <p class="form-help print-hide" style="margin-top:1.5rem">Prévia gerada com seus dados locais; revise antes de compartilhar o arquivo.</p>
    </article>`;
}

function renderCoursesPage() {
  const progress = PlatformService.getCourseProgress(currentUser.id);
  return `<section class="panel-card" style="margin-bottom:1rem"><h2>Aprender também é experiência</h2><p class="panel-card-subtitle">As trilhas abaixo são sugestões de temas criadas para a demonstração. Não são matrículas, cursos oferecidos por uma instituição ou certificados reconhecidos.</p></section>
    <div class="panel-grid three">${COURSES.map((course) => {
      const completed = progress.completed.includes(course.id);
      const planned = progress.planned.includes(course.id);
      return `<article class="panel-card course-card"><div class="course-meta">${escapeHtml(course.area)}</div><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description)}</p><div class="tag-list">${course.skills.map((skill) => `<span class="tag-view">${escapeHtml(skill)}</span>`).join("")}</div><span class="course-note">Sugestão de aprendizagem · sem integração externa</span><div class="course-actions">${completed ? `<button type="button" class="btn btn-ghost btn-sm" data-action="course-progress" data-id="${escapeHtml(course.id)}" data-progress="reset">Reabrir tema</button>` : `<button type="button" class="btn ${planned ? "btn-ghost" : "btn-primary"} btn-sm" data-action="course-progress" data-id="${escapeHtml(course.id)}" data-progress="${planned ? "reset" : "plan"}">${planned ? "Remover do plano" : "Adicionar ao plano"}</button><button type="button" class="btn btn-ghost btn-sm" data-action="course-progress" data-id="${escapeHtml(course.id)}" data-progress="complete">Marcar concluído</button>`}${completed ? `<span class="status-pill success">Concluído por você</span>` : ""}</div></article>`;
    }).join("")}</div>`;
}

function renderNotificationsPage() {
  const notifications = PlatformService.getCandidateNotifications(currentUser.id);
  const header = notifications.some((item) => !item.read) ? button("Marcar todas como lidas", "mark-all-notifications", { style: "btn-ghost", small: true }) : "";
  const list = notifications.map((notification) => `<article class="notification-card ${notification.read ? "" : "unread"}"><span class="notification-icon">${ICONS[notification.type === "application" ? "applications" : notification.type === "job" ? "jobs" : "notifications"]}</span><div class="notification-copy"><strong>${escapeHtml(notification.title)}</strong><p>${escapeHtml(notification.message)}</p><small>${formattedDate(notification.createdAt, true)} · ${notification.read ? "lida" : "não lida"}</small></div><button type="button" class="btn btn-ghost btn-sm" data-action="open-notification" data-id="${escapeHtml(notification.id)}">Abrir</button></article>`).join("");
  return `<section class="panel-card"><div class="card-head"><div><h2>Avisos da demonstração</h2><p class="panel-card-subtitle">Os avisos são armazenados localmente; não há envio de e-mail, SMS ou push.</p></div>${header}</div><div class="notification-list">${list || emptyState("Sem notificações", "Quando houver uma candidatura ou atualização de demonstração, ela aparecerá aqui.", "notifications")}</div></section>`;
}

function renderSettingsPage() {
  const settings = PlatformService.getCandidateSettings(currentUser.id);
  return `<div class="panel-grid two">
    <section class="panel-card"><div class="card-head"><div><h2>Preferências de oportunidades</h2><p class="panel-card-subtitle">Aplicadas ao radar e às notificações locais.</p></div></div>
      <form class="form-panel" data-form="candidate-settings" novalidate>
        <div class="field"><label for="settingDistance">Distância máxima desejada</label><select class="input" id="settingDistance">${DISTANCE_OPTIONS.map((distance) => `<option value="${distance}" ${Number(settings.distanceMaxKm) === distance ? "selected" : ""}>Até ${distance} km</option>`).join("")}</select><p class="form-help">Estimativa regional ilustrativa; não usa GPS nem Google Maps.</p></div>
        <label class="check-row"><input type="checkbox" id="settingJobNotifications" ${settings.notifyNewJobs ? "checked" : ""} /><span>Receber notificações demonstrativas sobre novas oportunidades no painel.</span></label>
        <label class="check-row"><input type="checkbox" id="settingVisible" ${settings.visibleToCompanies ? "checked" : ""} /><span>Permitir que a área de empresa de demonstração consulte meus dados de contato quando eu registrar interesse.</span></label>
        <p class="form-help">Esta preferência é apenas demonstrativa; não substitui controles de privacidade ou autorização no servidor.</p>
        <div class="form-actions"><button type="submit" class="btn btn-primary">Salvar preferências</button></div>
      </form>
    </section>
    <section class="panel-card"><div class="card-head"><div><h2>Dados da conta</h2><p class="panel-card-subtitle">Altere o e-mail usado para entrar. A demonstração não verifica a propriedade do novo endereço.</p></div></div>
      <form class="form-panel" data-form="account-email" novalidate>
        <div class="field"><label for="accountEmail">E-mail de acesso</label><input class="input" id="accountEmail" type="email" autocomplete="email" value="${escapeHtml(currentUser.email)}" /><p class="error-msg">Informe um e-mail válido.</p></div>
        <p class="form-help">Não há envio de confirmação. Em produção, a troca deve ser verificada pelo servidor.</p>
        <div class="form-actions"><button type="submit" class="btn btn-primary">Salvar e-mail</button></div>
      </form>
    </section>
  </div>
  <div class="panel-grid two" style="margin-top:1rem">
    <section class="panel-card"><div class="card-head"><div><h2>Segurança da conta demonstrativa</h2><p class="panel-card-subtitle">Troca de senha local, sem servidor.</p></div><span class="demo-tag">Não é produção</span></div>
      <form class="form-panel" data-form="password-change" novalidate>
        <div class="field"><label for="currentPassword">Senha atual</label><input class="input" id="currentPassword" type="password" autocomplete="current-password" /><p class="error-msg">Informe a senha atual.</p></div>
        <div class="field"><label for="newPassword">Nova senha</label><input class="input" id="newPassword" type="password" autocomplete="new-password" /><p class="error-msg">Use 8 ou mais caracteres, com letras e números.</p></div>
        <div class="field"><label for="confirmNewPassword">Confirmar nova senha</label><input class="input" id="confirmNewPassword" type="password" autocomplete="new-password" /><p class="error-msg">As senhas não coincidem.</p></div>
        <div class="form-actions"><button type="submit" class="btn btn-primary">Atualizar senha</button></div>
      </form>
      <p class="form-help" style="margin-top:.8rem">A senha é derivada com PBKDF2 antes de ser guardada localmente. Isso não torna o localStorage seguro nem equivale a autenticação real.</p>
    </section>
    <section class="panel-card"><div class="card-head"><div><h2>Privacidade e ajuda</h2><p class="panel-card-subtitle">Preferências de visibilidade demonstrativas.</p></div></div><p style="font-size:.84rem;color:var(--text-muted)">O controle de visibilidade se aplica somente ao conteúdo salvo neste navegador. Não é uma regra de autorização para produção.</p><p style="margin-top:.7rem;font-size:.82rem"><a href="privacidade.html">Política demonstrativa de privacidade</a></p>${button("Relatar um problema", "open-report", { style: "btn-ghost", small: true, icon: "issue" })}</section>
  </div>`;
}

function renderCompanyHome() {
  const jobs = PlatformService.getCompanyJobs(session.companyId);
  const visibleJobs = jobs.filter((job) => job.active !== false && job.approved);
  const pendingJobs = jobs.filter((job) => job.active !== false && !job.approved && !job.removed);
  const applications = PlatformService.getCompanyApplications(session.companyId);
  const applicants = new Set(applications.map((application) => application.candidateId)).size;
  return `<div class="stat-grid">
    <div class="stat-card"><div class="stat-card-top"><span>Anúncios ativos</span><span class="stat-icon">${ICONS.jobs}</span></div><strong>${visibleJobs.length}</strong><span>Visíveis no catálogo demonstrativo</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Aguardando revisão</span><span class="stat-icon">${ICONS.shield}</span></div><strong>${pendingJobs.length}</strong><span>Moderação da conta admin local</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Interesses registrados</span><span class="stat-icon">${ICONS.applications}</span></div><strong>${applications.length}</strong><span>Sem envio para sistemas externos</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Candidatos únicos</span><span class="stat-icon">${ICONS.people}</span></div><strong>${applicants}</strong><span>Perfis demonstrativos neste navegador</span></div>
  </div>
  <div class="panel-grid two">
    <section class="panel-card"><div class="card-head"><div><h2>Olá, ${escapeHtml(firstName(currentCompany?.name || currentUser.nome))}</h2><p class="panel-card-subtitle">Este painel está ligado à conta empresarial demonstrativa.</p></div><span class="demo-tag">Empresa fictícia</span></div><p style="color:var(--text-muted);font-size:.86rem">${escapeHtml(currentCompany?.description || "Complete o cadastro empresarial para apresentar melhor sua organização.")}</p><div class="quick-link-row">${button("Editar dados da empresa", "go-view", { style: "btn-ghost", small: true, id: "company-profile" })}${button("Publicar nova vaga", "new-job", { small: true })}</div></section>
    <section class="panel-card is-tinted"><div class="eyebrow">Transparência</div><h2>Publicação demonstrativa</h2><p style="margin-top:.45rem">Novos anúncios são fictícios, ficam pendentes da revisão local e só aparecem no catálogo após aprovação pela conta de administração.</p><div class="quick-link-row">${button("Gerenciar anúncios", "go-view", { style: "btn-ghost", small: true, id: "company-jobs" })}</div></section>
  </div>
  <section class="panel-card" style="margin-top:1rem"><div class="card-head"><div><h2>Atividade recente</h2><p class="panel-card-subtitle">Candidaturas relacionadas às suas vagas demonstrativas.</p></div>${button("Ver candidatos", "go-view", { style: "btn-ghost", small: true, id: "company-applicants" })}</div>
  ${applications.length ? `<div class="job-list">${applications.slice(0, 4).map((application) => `<div class="application-card"><div><h3>${escapeHtml(application.candidate?.nome || "Conta de candidato indisponível")}</h3><p>${escapeHtml(application.job?.title || "Vaga arquivada")} · ${formattedDate(application.createdAt, true)}</p></div>${statusBadge(application.status)}</div>`).join("")}</div>` : emptyState("Sem candidaturas ainda", "Quando um candidato demonstrativo registrar interesse, ele será listado aqui.", "people")}</section>`;
}

function renderCompanyProfilePage() {
  const company = currentCompany || {};
  return `<section class="panel-card" style="margin-bottom:1rem"><h2>Perfil da conta de empresa</h2><p class="panel-card-subtitle">O registro vem da conta demo; no produto real seriam necessários validação de identidade empresarial, permissões e armazenamento no servidor.</p></section>
    <form class="form-panel" data-form="company-profile" novalidate>
      <div class="form-row"><div class="field"><label for="companyName">Nome da empresa</label><input class="input" id="companyName" value="${escapeHtml(company.name)}" /><p class="error-msg">Informe o nome da empresa.</p></div><div class="field"><label for="companySector">Setor</label><select class="input" id="companySector">${optionList(CATALOGS.areasInteresse, company.sector || "", "Selecione o setor")}</select><p class="error-msg">Selecione o setor.</p></div></div>
      <div class="field"><label for="companyDescription">Descrição</label><textarea class="input" id="companyDescription" maxlength="1200" rows="4">${escapeHtml(company.description)}</textarea><p class="error-msg">Informe uma breve descrição.</p></div>
      <div class="form-row-3"><div class="field"><label for="companyCity">Cidade</label><input class="input" id="companyCity" value="${escapeHtml(company.city)}" /><p class="error-msg">Informe a cidade.</p></div><div class="field"><label for="companyState">UF</label><select class="input" id="companyState">${optionList(CATALOGS.estados, company.state || "", "UF")}</select><p class="error-msg">Selecione a UF.</p></div></div>
      <div class="form-row"><div class="field"><label for="companyAddress">Endereço ou região</label><input class="input" id="companyAddress" value="${escapeHtml(company.address)}" /><p class="error-msg">Informe uma região ou endereço.</p></div><div class="field"><label for="companyPhone">Telefone</label><input class="input" id="companyPhone" value="${escapeHtml(company.phone)}" placeholder="(00) 00000-0000" /></div></div>
      <div class="form-row"><div class="field"><label for="companyEmail">E-mail de contato</label><input class="input" id="companyEmail" type="email" value="${escapeHtml(company.contactEmail)}" /><p class="error-msg">Informe um e-mail válido.</p></div><div class="field"><label for="companyWebsite">Site <span class="optional">(opcional)</span></label><input class="input" id="companyWebsite" type="url" value="${escapeHtml(company.website)}" placeholder="https://..." /><p class="error-msg">Informe uma URL válida.</p></div></div>
      <div class="form-actions"><button type="submit" class="btn btn-primary">Salvar dados da empresa</button></div>
    </form>`;
}

function companyJobStatus(job) {
  if (job.removed) return "Arquivada";
  if (job.active === false) return "Pausada";
  return job.approved ? "No catálogo demonstrativo" : "Aguardando revisão";
}

function renderCompanyJobsPage() {
  const jobs = PlatformService.getCompanyJobs(session.companyId);
  return `<section class="panel-card" style="margin-bottom:1rem"><div class="card-head"><div><h2>Gerencie seus anúncios</h2><p class="panel-card-subtitle">Qualquer anúncio criado aqui é marcado como demonstração e não confirma contratação.</p></div>${button("Publicar vaga", "new-job", { small: true })}</div></section>
    ${jobs.length ? `<div class="job-list">${jobs.map((job) => `<article class="job-card"><div class="job-card-head"><div><h3 class="job-card-title">${escapeHtml(job.title)}</h3><p class="job-company">${escapeHtml(job.area)} · ${escapeHtml(job.type)} · ${escapeHtml(locationText(job))}</p></div>${statusBadge(companyJobStatus(job))}</div><p class="job-card-description">${escapeHtml(job.description)}</p><div class="job-card-footer"><span class="demo-tag">Demonstração · não confirmada</span><div class="job-card-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-company-job" data-id="${escapeHtml(job.id)}">Editar</button><button type="button" class="btn btn-ghost btn-sm" data-action="toggle-company-job" data-id="${escapeHtml(job.id)}" data-active="${job.active === false || job.removed ? "true" : "false"}">${job.active === false || job.removed ? "Reativar" : "Pausar"}</button><button type="button" class="btn btn-danger-ghost btn-sm" data-action="archive-company-job" data-id="${escapeHtml(job.id)}">Excluir</button></div></div></article>`).join("")}</div>` : emptyState("Nenhum anúncio publicado", "Use “Publicar vaga” para criar um anúncio demonstrativo que poderá ser revisado pela administração.", "jobs")}`;
}

function renderCompanyApplicantsPage() {
  const applications = PlatformService.getCompanyApplications(session.companyId);
  if (!applications.length) return `<section class="panel-card"><div class="card-head"><div><h2>Candidatos interessados</h2><p class="panel-card-subtitle">Os perfis só aparecem aqui após a pessoa registrar interesse em uma vaga local.</p></div></div>${emptyState("Sem candidaturas", "Entre na conta demonstrativa de candidato, registre interesse em uma vaga e volte para consultar o fluxo.", "people")}</section>`;
  return `<section class="panel-card" style="margin-bottom:1rem"><h2>Currículos e candidaturas</h2><p class="panel-card-subtitle">Os status não enviam mensagens nem representam processos seletivos reais.</p></section><div class="job-list">${applications.map((application) => {
    const candidate = application.candidate;
    return `<article class="application-card"><div><div style="display:flex;gap:.55rem;align-items:center;flex-wrap:wrap"><h3>${escapeHtml(candidate?.nome || "Perfil indisponível")}</h3>${statusBadge(application.status)}</div><p>${escapeHtml(application.job?.title || "Vaga arquivada")} · ${escapeHtml(locationText(candidate))} · ${formattedDate(application.createdAt, true)}</p><p>${escapeHtml(candidate?.curso || candidate?.escolaridade || "Formação não informada")}</p><div class="tag-list">${(candidate?.habilidades || []).slice(0, 5).map((skill) => `<span class="tag-view">${escapeHtml(skill)}</span>`).join("")}</div></div><div class="job-card-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="view-candidate" data-id="${escapeHtml(candidate?.id || "")}">Consultar currículo</button><select class="input" style="width:auto;min-width:140px" data-application-status="${escapeHtml(application.id)}" aria-label="Atualizar status da candidatura">${[...APPLICATION_STATUSES, ...(application.status === "Desistiu" ? ["Desistiu"] : [])].map((status) => `<option value="${escapeHtml(status)}" ${application.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></div></article>`;
  }).join("")}</div>`;
}

function renderAdminHome() {
  const candidates = UserService.listByRole("candidate");
  const companies = PlatformService.getCompanies({ includeInactive: true });
  const jobs = PlatformService.getAllJobs();
  const reports = PlatformService.getReports();
  const pendingJobs = jobs.filter((job) => !job.approved && !job.removed && job.active !== false);
  const openReports = reports.filter((report) => report.status === "Aberto");
  return `<div class="stat-grid">
    <div class="stat-card"><div class="stat-card-top"><span>Candidatos cadastrados</span><span class="stat-icon">${ICONS.people}</span></div><strong>${candidates.length}</strong><span>Contas salvas localmente</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Empresas demonstrativas</span><span class="stat-icon">${ICONS.company}</span></div><strong>${companies.length}</strong><span>Registros fictícios ou de teste</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Anúncios aguardando revisão</span><span class="stat-icon">${ICONS.jobs}</span></div><strong>${pendingJobs.length}</strong><span>Não aparecem para candidatos</span></div>
    <div class="stat-card"><div class="stat-card-top"><span>Relatos abertos</span><span class="stat-icon">${ICONS.issue}</span></div><strong>${openReports.length}</strong><span>Mensagens locais da demonstração</span></div>
  </div>
  <div class="panel-grid two"><section class="panel-card is-tinted"><div class="eyebrow">Área administrativa separada</div><h2>Olá, ${escapeHtml(firstName(currentUser.nome))}</h2><p style="margin-top:.45rem">As ações de moderação abaixo funcionam apenas nos dados locais deste navegador. Em produção, exija servidor, permissões e auditoria.</p></section>
  <section class="panel-card"><div class="card-head"><div><h2>Ações rápidas</h2><p class="panel-card-subtitle">Acesse as filas de moderação.</p></div></div><div class="quick-link-row">${button("Revisar vagas", "go-view", { style: "btn-ghost", small: true, id: "admin-jobs" })}${button("Ver empresas", "go-view", { style: "btn-ghost", small: true, id: "admin-companies" })}${button("Relatos", "go-view", { style: "btn-ghost", small: true, id: "admin-reports" })}</div></section></div>
  <section class="panel-card" style="margin-top:1rem"><div class="card-head"><div><h2>Fila de anúncios</h2><p class="panel-card-subtitle">Vagas pendentes de aprovação local.</p></div>${button("Gerenciar todas", "go-view", { style: "btn-ghost", small: true, id: "admin-jobs" })}</div>
    ${pendingJobs.length ? `<div class="job-list">${pendingJobs.slice(0,4).map((job) => `<div class="application-card"><div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(companyName(job.companyId))} · ${escapeHtml(locationText(job))}</p></div>${statusBadge("Aguardando revisão")}</div>`).join("")}</div>` : emptyState("Fila vazia", "Nenhum anúncio novo aguarda revisão.", "check")}</section>`;
}

function renderAdminCandidatesPage() {
  return `<section class="panel-card"><div class="card-head"><div><h2>Contas de candidatos</h2><p class="panel-card-subtitle">Bloqueio e consulta são ações locais sem efeito em outras cópias do projeto.</p></div></div><div class="search-row"><input class="input" type="search" id="adminCandidatesSearch" data-filter="admin-candidates" placeholder="Pesquisar nome, e-mail ou cidade" aria-label="Pesquisar candidatos" /></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Localidade</th><th>Status</th><th>Ações</th></tr></thead><tbody id="adminCandidateResults"></tbody></table></div></section>`;
}

function renderAdminCandidatesTable(term = $("#adminCandidatesSearch", appContent)?.value || "") {
  const target = $("#adminCandidateResults", appContent);
  if (!target) return;
  const query = normalizedText(term);
  const candidates = UserService.listByRole("candidate").filter((candidate) => normalizedText(`${candidate.nome} ${candidate.email} ${candidate.cidade} ${candidate.estado}`).includes(query));
  target.innerHTML = candidates.length ? candidates.map((candidate) => `<tr><td><strong>${escapeHtml(candidate.nome)}</strong><br><span class="form-help">${candidate.isDemoAccount ? "Conta demonstrativa" : "Cadastro local"}</span></td><td>${escapeHtml(candidate.email)}</td><td>${escapeHtml(locationText(candidate))}</td><td>${statusBadge(candidate.status === "blocked" ? "Bloqueada" : "Ativa")}</td><td><div class="table-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="view-candidate" data-id="${escapeHtml(candidate.id)}">Ver perfil</button><button type="button" class="btn ${candidate.status === "blocked" ? "btn-primary" : "btn-danger-ghost"} btn-sm" data-action="toggle-candidate-status" data-id="${escapeHtml(candidate.id)}" data-status="${candidate.status === "blocked" ? "active" : "blocked"}">${candidate.status === "blocked" ? "Desbloquear" : "Bloquear"}</button></div></td></tr>`).join("") : `<tr><td colspan="5">Nenhum candidato encontrado.</td></tr>`;
}

function renderAdminCompaniesPage() {
  return `<section class="panel-card"><div class="card-head"><div><h2>Registros de empresas</h2><p class="panel-card-subtitle">“Verificada” é uma marca de teste, não uma verificação legal de CNPJ ou identidade.</p></div></div><div class="search-row"><input class="input" type="search" id="adminCompaniesSearch" data-filter="admin-companies" placeholder="Pesquisar empresa, setor ou cidade" aria-label="Pesquisar empresas" /></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Empresa / setor</th><th>Localidade</th><th>Conta vinculada</th><th>Revisão local</th><th>Ações</th></tr></thead><tbody id="adminCompanyResults"></tbody></table></div></section>`;
}

function renderAdminCompaniesTable(term = $("#adminCompaniesSearch", appContent)?.value || "") {
  const target = $("#adminCompanyResults", appContent);
  if (!target) return;
  const query = normalizedText(term);
  const companies = PlatformService.getCompanies({ includeInactive: true }).filter((company) => normalizedText(`${company.name} ${company.sector} ${company.city} ${company.state}`).includes(query));
  target.innerHTML = companies.length ? companies.map((company) => `<tr><td><strong>${escapeHtml(company.name)}</strong><br><span class="form-help">${escapeHtml(company.sector || "Setor não informado")} · ${company.isDemo ? "Fictícia / demonstrativa" : "Cadastro local"}</span></td><td>${escapeHtml(locationText(company))}</td><td>${escapeHtml(company.ownerId ? UserService.listAll().find((user) => user.id === company.ownerId)?.email || "Conta vinculada" : "Sem conta de acesso")}</td><td>${statusBadge(company.verified ? "Verificada no demo" : "Não verificada")}${company.active === false ? ` ${statusBadge("Inativa")}` : ""}</td><td><div class="table-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-admin-company" data-id="${escapeHtml(company.id)}">Editar</button><button type="button" class="btn ${company.verified ? "btn-ghost" : "btn-primary"} btn-sm" data-action="toggle-company-verification" data-id="${escapeHtml(company.id)}" data-verified="${company.verified ? "false" : "true"}">${company.verified ? "Retirar marca" : "Marcar revisada"}</button><button type="button" class="btn btn-danger-ghost btn-sm" data-action="toggle-company-active" data-id="${escapeHtml(company.id)}" data-active="${company.active === false ? "true" : "false"}">${company.active === false ? "Ativar" : "Desativar"}</button></div></td></tr>`).join("") : `<tr><td colspan="5">Nenhuma empresa encontrada.</td></tr>`;
}

function renderAdminJobsPage() {
  const jobs = PlatformService.getAllJobs();
  const companies = PlatformService.getCompanies({ includeInactive: true });
  return `<section class="panel-card"><div class="card-head"><div><h2>Moderação de vagas</h2><p class="panel-card-subtitle">Anúncios reprovados ou inativos deixam de aparecer ao candidato. Todos os anúncios deste ambiente são demonstrativos.</p></div><span class="demo-tag">${jobs.length} registro(s)</span></div>
    <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Cargo</th><th>Empresa</th><th>Tipo / localidade</th><th>Status de moderação</th><th>Ações</th></tr></thead><tbody>${jobs.length ? jobs.map((job) => `<tr><td><strong>${escapeHtml(job.title)}</strong><br><span class="form-help">${job.isDemo ? "Demonstração · não confirmada" : "Anúncio local"}</span></td><td>${escapeHtml(companies.find((company) => company.id === job.companyId)?.name || "Empresa removida")}</td><td>${escapeHtml(job.type)}<br>${escapeHtml(locationText(job))}</td><td>${statusBadge(job.removed ? "Removida" : job.approved && job.active !== false ? "Aprovada no demo" : job.active === false ? "Suspensa" : "Aguardando revisão")}</td><td><div class="table-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-admin-job" data-id="${escapeHtml(job.id)}">Editar</button>${job.approved && job.active !== false ? `<button type="button" class="btn btn-ghost btn-sm" data-action="toggle-job-approval" data-id="${escapeHtml(job.id)}" data-approved="false">Suspender</button>` : `<button type="button" class="btn btn-primary btn-sm" data-action="toggle-job-approval" data-id="${escapeHtml(job.id)}" data-approved="true">Aprovar</button>`}<button type="button" class="btn btn-danger-ghost btn-sm" data-action="remove-admin-job" data-id="${escapeHtml(job.id)}">Remover</button></div></td></tr>`).join("") : `<tr><td colspan="5">Nenhum anúncio cadastrado.</td></tr>`}</tbody></table></div></section>`;
}

function renderAdminAdsPage() {
  const ads = PlatformService.getAds();
  return `<section class="panel-card" style="margin-bottom:1rem"><h2>Comunicados demonstrativos</h2><p class="panel-card-subtitle">O painel de candidato mostrará os comunicados ativos. Não são campanhas de publicidade reais e não há faturamento ou integração.</p></section>
    <section class="panel-card"><div class="card-head"><div><h2>Conteúdo cadastrado</h2><p class="panel-card-subtitle">${ads.length} comunicado(s) local(is).</p></div>${button("Criar comunicado", "new-ad", { small: true })}</div>
    ${ads.length ? `<div class="job-list">${ads.map((ad) => `<article class="application-card"><div><h3>${escapeHtml(ad.title)}</h3><p>${escapeHtml(ad.message)}</p><p>${formattedDate(ad.createdAt, true)} · ${ad.isDemo ? "demonstrativo" : "local"}</p></div><div class="job-card-actions">${statusBadge(ad.active ? "Ativo" : "Pausado")}<button type="button" class="btn btn-ghost btn-sm" data-action="edit-ad" data-id="${escapeHtml(ad.id)}">Editar</button><button type="button" class="btn btn-ghost btn-sm" data-action="toggle-ad" data-id="${escapeHtml(ad.id)}" data-active="${ad.active ? "false" : "true"}">${ad.active ? "Pausar" : "Ativar"}</button><button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-ad" data-id="${escapeHtml(ad.id)}">Excluir</button></div></article>`).join("")}</div>` : emptyState("Nenhum comunicado criado", "Crie um comunicado para testar o controle de anúncios no painel do candidato.", "ad")}</section>`;
}

function renderAdminReportsPage() {
  const reports = PlatformService.getReports();
  return `<section class="panel-card"><div class="card-head"><div><h2>Relatos recebidos localmente</h2><p class="panel-card-subtitle">Nenhum relato é enviado a uma equipe real. O conteúdo fica no armazenamento local da demonstração.</p></div></div>
    ${reports.length ? `<div class="job-list">${reports.map((report) => `<article class="application-card"><div><div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap"><h3>${escapeHtml(report.category)}</h3>${statusBadge(report.status)}</div><p><strong>${escapeHtml(report.userName)}</strong> · ${escapeHtml(USER_ROLES[report.role] || report.role)} · ${formattedDate(report.createdAt, true)}</p><p>${escapeHtml(report.description)}</p></div><button type="button" class="btn ${report.status === "Resolvido" ? "btn-ghost" : "btn-primary"} btn-sm" data-action="toggle-report" data-id="${escapeHtml(report.id)}" data-status="${report.status === "Resolvido" ? "Aberto" : "Resolvido"}">${report.status === "Resolvido" ? "Reabrir" : "Marcar resolvido"}</button></article>`).join("")}</div>` : emptyState("Nenhum relato", "Use o formulário de relato no painel demonstrativo para testar esta fila.", "issue")}</section>`;
}

function openDialog(title, intro, body, actions = "") {
  pendingModalAction = null;
  appModalContent.innerHTML = `<button type="button" class="modal-close" data-action="close-modal" aria-label="Fechar">×</button><h2 id="appModalTitle">${escapeHtml(title)}</h2>${intro ? `<p class="modal-intro">${escapeHtml(intro)}</p>` : ""}${body}${actions ? `<div class="modal-actions">${actions}</div>` : ""}`;
  appModal.classList.add("open");
  setTimeout(() => appModalPanel.focus(), 0);
}

function closeDialog() {
  appModal.classList.remove("open");
  appModalContent.innerHTML = "";
  pendingModalAction = null;
}

function askConfirmation(title, text, label, action, danger = false) {
  openDialog(title, text, "", `<button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="button" class="btn ${danger ? "btn-danger-ghost" : "btn-primary"}" data-action="confirm-modal">${escapeHtml(label)}</button>`);
  pendingModalAction = action;
}

function openJobDetails(jobId) {
  const job = PlatformService.getAllJobs().find((entry) => entry.id === jobId);
  if (!job) { showToast("Este anúncio não está mais disponível.", "error"); return; }
  const company = PlatformService.getCompany(job.companyId);
  const requirements = (job.requirements || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const benefits = (job.benefits || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const url = safeHttpUrl(job.applicationUrl);
  const score = session.role === "candidate" ? jobScore(job, currentUser) : null;
  const body = `<div class="app-modal-section"><span class="demo-tag">Vaga demonstrativa · contratação não confirmada</span><p style="margin-top:.6rem"><strong>Empresa:</strong> ${escapeHtml(company?.name || "Empresa demonstrativa")}</p><p><strong>Local:</strong> ${escapeHtml(job.address || locationText(job))}</p><p><strong>Distância:</strong> ${session.role === "candidate" ? escapeHtml(distanceLabel(currentUser, job)) : "Não calculada neste painel."}</p><p><strong>Tipo / modalidade:</strong> ${escapeHtml(job.type)} · ${escapeHtml(job.modality)}</p><p><strong>Escolaridade:</strong> ${escapeHtml(job.education || "Não informada")}</p>${score !== null ? `<p><strong>Compatibilidade estimada:</strong> ${score}% (regra local demonstrativa, não IA).</p>` : ""}</div><div class="app-modal-section"><h3>Descrição</h3><p>${escapeHtml(job.description)}</p></div><div class="app-modal-section"><h3>Requisitos</h3>${requirements ? `<ul>${requirements}</ul>` : `<p>Não informados.</p>`}</div><div class="app-modal-section"><h3>Benefícios</h3>${benefits ? `<ul>${benefits}</ul>` : `<p>Não informados.</p>`}</div>${url ? `<div class="app-modal-section"><h3>Canal externo</h3><p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Acessar link informado pela empresa</a></p></div>` : ""}<p class="form-help" style="margin-top:1rem">Este anúncio existe apenas no protótipo local. Registrar interesse não envia candidatura a uma empresa real.</p>`;
  const actions = session.role === "candidate" && !hasApplied(job.id) && job.approved && job.active !== false
    ? `<button type="button" class="btn btn-ghost" data-action="close-modal">Fechar</button><button type="button" class="btn btn-primary" data-action="apply-job" data-id="${escapeHtml(job.id)}">Registrar interesse</button>`
    : `<button type="button" class="btn btn-primary" data-action="close-modal">Fechar</button>`;
  openDialog(job.title, company?.name || "Detalhes da oportunidade", body, actions);
}

function openReportDialog() {
  const body = `<form data-form="report" novalidate><div class="field"><label for="reportCategory">Categoria</label><select class="input" id="reportCategory">${optionList(["Dúvida", "Problema técnico", "Conteúdo inadequado", "Privacidade", "Outro"], "", "Selecione")}</select><p class="error-msg">Selecione uma categoria.</p></div><div class="field"><label for="reportDescription">Descreva o relato</label><textarea class="input" id="reportDescription" rows="5" maxlength="1000" placeholder="Conte o que aconteceu (mínimo de 10 caracteres)."></textarea><p class="error-msg">Escreva ao menos 10 caracteres.</p></div><p class="form-help">Relato salvo apenas localmente; nenhum suporte real receberá sua mensagem.</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">Salvar relato local</button></div></form>`;
  openDialog("Relatar um problema", "Formulário de demonstração", body);
}

function openJobEditor(jobId = null, actorRole = "company") {
  const job = jobId ? PlatformService.getAllJobs().find((entry) => entry.id === jobId) : null;
  if (jobId && !job) { showToast("Vaga não encontrada.", "error"); return; }
  const body = `<form data-form="job" data-job-id="${escapeHtml(job?.id || "")}" data-company-id="${escapeHtml(job?.companyId || session.companyId || "")}" data-actor-role="${escapeHtml(actorRole)}" novalidate>
      <div class="form-row"><div class="field"><label for="jobTitle">Cargo</label><input class="input" id="jobTitle" value="${escapeHtml(job?.title || "")}" maxlength="120" /><p class="error-msg">Informe o cargo.</p></div><div class="field"><label for="jobArea">Área</label><select class="input" id="jobArea">${optionList(CATALOGS.areasInteresse, job?.area || "", "Selecione")}</select><p class="error-msg">Selecione a área.</p></div></div>
      <div class="form-row"><div class="field"><label for="jobType">Tipo de oportunidade</label><select class="input" id="jobType">${optionList(CATALOGS.tiposVaga, job?.type || "", "Selecione")}</select><p class="error-msg">Selecione o tipo.</p></div><div class="field"><label for="jobModality">Modalidade</label><select class="input" id="jobModality">${optionList(CATALOGS.modalidades, job?.modality || "", "Selecione")}</select><p class="error-msg">Selecione a modalidade.</p></div></div>
      <div class="form-row-3"><div class="field"><label for="jobCity">Cidade</label><input class="input" id="jobCity" value="${escapeHtml(job?.city || currentCompany?.city || "")}" /><p class="error-msg">Informe a cidade.</p></div><div class="field"><label for="jobState">UF</label><select class="input" id="jobState">${optionList(CATALOGS.estados, job?.state || currentCompany?.state || "", "UF")}</select><p class="error-msg">Selecione a UF.</p></div></div>
      <div class="field"><label for="jobAddress">Endereço ou região</label><input class="input" id="jobAddress" value="${escapeHtml(job?.address || "")}" placeholder="Bairro, região ou referência" /><p class="error-msg">Informe uma referência de localização.</p></div>
      <div class="form-row"><div class="field"><label for="jobEducation">Escolaridade exigida</label><input class="input" id="jobEducation" value="${escapeHtml(job?.education || "")}" placeholder="Ex.: Ensino Médio em curso" /><p class="error-msg">Informe a escolaridade.</p></div><div class="field"><label for="jobApplicationUrl">Link para candidatura externa <span class="optional">(opcional)</span></label><input class="input" type="url" id="jobApplicationUrl" value="${escapeHtml(job?.applicationUrl || "")}" placeholder="https://..." /><p class="error-msg">Informe uma URL http(s) válida.</p></div></div>
      <div class="field"><label for="jobDescription">Descrição da oportunidade</label><textarea class="input" id="jobDescription" rows="4" maxlength="2000">${escapeHtml(job?.description || "")}</textarea><p class="error-msg">Descreva a oportunidade com pelo menos 20 caracteres.</p></div>
      <div class="form-row"><div class="field"><label for="jobRequirements">Requisitos <span class="optional">(um por linha)</span></label><textarea class="input" id="jobRequirements" rows="4">${escapeHtml((job?.requirements || []).join("\n"))}</textarea><p class="error-msg">Informe ao menos um requisito.</p></div><div class="field"><label for="jobBenefits">Benefícios <span class="optional">(um por linha)</span></label><textarea class="input" id="jobBenefits" rows="4">${escapeHtml((job?.benefits || []).join("\n"))}</textarea></div></div>
      <label class="check-row"><input type="checkbox" id="jobActive" ${job?.active === false ? "" : "checked"} /><span>Manter anúncio ativo (se aprovado).</span></label>
      <p class="form-help">${job && actorRole === "company" ? "Ao editar, o anúncio volta para revisão local." : "Este anúncio será identificado como fictício/demonstrativo e não confirma contratação."}</p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">${job ? "Salvar alterações" : "Publicar para revisão"}</button></div>
    </form>`;
  openDialog(job ? "Editar anúncio demonstrativo" : "Publicar vaga demonstrativa", "Nenhum anúncio é enviado para plataformas externas.", body);
}

function openCompanyAdminEditor(companyId) {
  const company = PlatformService.getCompany(companyId);
  if (!company) return;
  const body = `<form data-form="admin-company" data-id="${escapeHtml(company.id)}" novalidate>
    <div class="form-row"><div class="field"><label for="adminCompanyName">Nome</label><input class="input" id="adminCompanyName" value="${escapeHtml(company.name)}" /><p class="error-msg">Informe um nome.</p></div><div class="field"><label for="adminCompanySector">Setor</label><input class="input" id="adminCompanySector" value="${escapeHtml(company.sector)}" /></div></div>
    <div class="field"><label for="adminCompanyDescription">Descrição</label><textarea class="input" id="adminCompanyDescription" rows="3">${escapeHtml(company.description)}</textarea></div>
    <div class="form-row-3"><div class="field"><label for="adminCompanyCity">Cidade</label><input class="input" id="adminCompanyCity" value="${escapeHtml(company.city)}" /></div><div class="field"><label for="adminCompanyState">UF</label><select class="input" id="adminCompanyState">${optionList(CATALOGS.estados, company.state, "UF")}</select></div></div>
    <div class="field"><label for="adminCompanyAddress">Endereço/região</label><input class="input" id="adminCompanyAddress" value="${escapeHtml(company.address)}" /></div>
    <div class="form-row"><div class="field"><label for="adminCompanyEmail">E-mail de contato</label><input class="input" type="email" id="adminCompanyEmail" value="${escapeHtml(company.contactEmail)}" /><p class="error-msg">Informe um e-mail válido.</p></div><div class="field"><label for="adminCompanyWebsite">Site</label><input class="input" id="adminCompanyWebsite" value="${escapeHtml(company.website)}" /><p class="error-msg">Informe uma URL válida.</p></div></div>
    <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">Salvar edição local</button></div></form>`;
  openDialog("Editar registro de empresa", "Edição administrativa demonstrativa", body);
}

function openAdEditor(adId = null) {
  const ad = adId ? PlatformService.getAds().find((entry) => entry.id === adId) : null;
  const body = `<form data-form="ad" data-id="${escapeHtml(ad?.id || "")}" novalidate>
    <div class="field"><label for="adTitle">Título</label><input class="input" id="adTitle" maxlength="100" value="${escapeHtml(ad?.title || "")}" /><p class="error-msg">Informe um título.</p></div>
    <div class="field"><label for="adMessage">Texto do comunicado</label><textarea class="input" id="adMessage" maxlength="500" rows="4">${escapeHtml(ad?.message || "")}</textarea><p class="error-msg">Escreva ao menos 10 caracteres.</p></div>
    ${ad ? `<label class="check-row"><input type="checkbox" id="adActive" ${ad.active ? "checked" : ""} /><span>Exibir no painel do candidato.</span></label>` : ""}
    <p class="form-help">Comunicado local, sem anúncio pago ou serviço externo.</p>
    <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">Salvar comunicado</button></div></form>`;
  openDialog(ad ? "Editar comunicado demonstrativo" : "Novo comunicado demonstrativo", "O conteúdo aparecerá aos candidatos somente neste navegador.", body);
}

function openCandidateResume(candidateId) {
  const candidate = UserService.listByRole("candidate").find((entry) => entry.id === candidateId);
  if (!candidate) { showToast("Perfil de candidato não encontrado.", "error"); return; }
  const settings = PlatformService.getCandidateSettings(candidate.id);
  const contacts = settings.visibleToCompanies ? `${escapeHtml(candidate.email)}${candidate.telefone ? ` · ${escapeHtml(candidate.telefone)}` : ""}` : "Dados de contato ocultos pela preferência de privacidade do candidato.";
  const picture = candidate.fotoDataUrl ? `<img src="${escapeHtml(candidate.fotoDataUrl)}" alt="" style="width:50px;height:50px;object-fit:cover;border-radius:50%" />` : "";
  const body = `<div class="app-modal-section"><div style="display:flex;align-items:center;gap:.8rem">${picture}<div><h3>${escapeHtml(candidate.nome)}</h3><p>${escapeHtml(locationText(candidate))} · ${escapeHtml(candidate.escolaridade)}</p></div></div><p style="margin-top:.65rem"><strong>Contato:</strong> ${contacts}</p><p><strong>Curso:</strong> ${escapeHtml(candidate.curso || "Não informado")}${candidate.instituicao ? ` · ${escapeHtml(candidate.instituicao)}` : ""}</p></div><div class="app-modal-section"><h3>Resumo</h3><p>${escapeHtml(candidate.resumo || "Não informado")}</p></div><div class="app-modal-section"><h3>Habilidades</h3><p>${escapeHtml((candidate.habilidades || []).join(" · ") || "Não informadas")}</p></div><div class="app-modal-section"><h3>Cursos complementares</h3>${candidate.cursos?.length ? `<ul>${candidate.cursos.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Não informados.</p>`}</div><div class="app-modal-section"><h3>Experiência e projetos</h3>${candidate.experiencias?.length ? `<ul>${candidate.experiencias.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Não informados.</p>`}</div>`;
  openDialog("Currículo demonstrativo", "A consulta é exibida apenas porque houve interesse em uma vaga deste navegador.", body, `<button type="button" class="btn btn-primary" data-action="close-modal">Fechar</button>`);
}

function openCompanyEditorForSelf() {
  const company = currentCompany || {};
  // A tela de edição é renderizada no painel principal para evitar uma segunda cópia do formulário.
  setView("company-profile");
  setTimeout(() => $("#companyName", appContent)?.focus(), 0);
  if (!company.id) showToast("Complete os dados da sua conta empresarial.", "info");
}

function closeMobileMenu() {
  appSidebar.classList.remove("open");
  sidebarScrim.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menu");
}

function openMobileMenu() {
  appSidebar.classList.add("open");
  sidebarScrim.classList.add("open");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Fechar menu");
}

function runAction(element) {
  const action = element.dataset.action;
  const id = element.dataset.id;
  if (!action) return;
  switch (action) {
    case "go-view": setView(element.dataset.id); break;
    case "go-profile": window.location.href = "perfil.html"; break;
    case "print-resume": window.print(); break;
    case "job-details": openJobDetails(id); break;
    case "apply-job": {
      try {
        PlatformService.applyToJob(id, currentUser);
        closeDialog();
        showToast("Interesse registrado somente no ambiente demonstrativo.", "success");
        renderPage();
      } catch (error) { showToast(error.message, "error"); }
      break;
    }
    case "withdraw-application": {
      askConfirmation("Desistir deste interesse?", "O registro ficará como “Desistiu” no ambiente local. Nenhuma empresa real será avisada.", "Desistir", () => {
        PlatformService.withdrawApplication(id, currentUser.id);
        closeDialog();
        showToast("Interesse encerrado localmente.", "info");
        renderPage();
      }, true);
      break;
    }
    case "mark-all-notifications":
      PlatformService.markAllNotificationsRead(currentUser.id);
      renderPage();
      showToast("Notificações marcadas como lidas.", "success");
      break;
    case "open-notification": {
      const notification = PlatformService.getCandidateNotifications(currentUser.id).find((entry) => entry.id === id);
      if (!notification) break;
      PlatformService.markNotificationRead(id, currentUser.id);
      const target = viewIsAllowed(notification.targetView) ? notification.targetView : "notifications";
      setView(target);
      if (notification.targetView === "jobs" && notification.linkId) setTimeout(() => openJobDetails(notification.linkId), 0);
      break;
    }
    case "course-progress":
      PlatformService.setCourseProgress(currentUser.id, id, element.dataset.progress);
      renderPage();
      showToast(element.dataset.progress === "complete" ? "Tema marcado como concluído neste navegador." : "Plano de desenvolvimento atualizado.", "success");
      break;
    case "clear-job-filters":
      ["jobSearch", "jobCity"].forEach((inputId) => { const input = $(`#${inputId}`, appContent); if (input) input.value = ""; });
      ["jobArea", "jobType", "jobModality"].forEach((inputId) => { const input = $(`#${inputId}`, appContent); if (input) input.value = ""; });
      renderFilteredJobs();
      break;
    case "new-job": openJobEditor(); break;
    case "edit-company-job": openJobEditor(id, "company"); break;
    case "toggle-company-job": {
      const active = element.dataset.active === "true";
      try {
        PlatformService.setJobActive(id, session.companyId, session.userId, active, "company");
        renderPage();
        showToast(active ? "Anúncio reativado; aguarda moderação se necessário." : "Anúncio pausado.", "success");
      } catch (error) { showToast(error.message, "error"); }
      break;
    }
    case "archive-company-job":
      askConfirmation("Excluir este anúncio?", "O anúncio será arquivado no ambiente demonstrativo e deixará de aparecer aos candidatos. Candidaturas existentes permanecem registradas.", "Excluir anúncio", () => {
        PlatformService.archiveCompanyJob(id, session.companyId, session.userId);
        closeDialog();
        renderPage();
        showToast("Anúncio arquivado.", "success");
      }, true);
      break;
    case "view-candidate": openCandidateResume(id); break;
    case "toggle-candidate-status": {
      const user = UserService.updateAccountStatus(id, element.dataset.status);
      renderPage();
      showToast(`Conta ${user.status === "blocked" ? "bloqueada" : "desbloqueada"} localmente.`, "info");
      break;
    }
    case "edit-admin-company": openCompanyAdminEditor(id); break;
    case "toggle-company-verification":
      PlatformService.setCompanyVerified(id, element.dataset.verified === "true");
      renderPage();
      showToast("Marca de revisão demonstrativa atualizada.", "success");
      break;
    case "toggle-company-active":
      PlatformService.setCompanyActive(id, element.dataset.active === "true");
      renderPage();
      showToast("Disponibilidade da empresa atualizada no catálogo local.", "success");
      break;
    case "edit-admin-job": openJobEditor(id, "admin"); break;
    case "toggle-job-approval":
      PlatformService.setJobApproval(id, element.dataset.approved === "true");
      renderPage();
      showToast(element.dataset.approved === "true" ? "Anúncio aprovado no catálogo demonstrativo." : "Anúncio suspenso localmente.", "success");
      break;
    case "remove-admin-job":
      askConfirmation("Remover anúncio?", "Ele deixará de aparecer para candidatos, mas o registro de demonstração permanece na lista administrativa.", "Remover", () => {
        PlatformService.setJobActive(id, "", "", false, "admin");
        closeDialog();
        renderPage();
        showToast("Anúncio removido do catálogo local.", "success");
      }, true);
      break;
    case "new-ad": openAdEditor(); break;
    case "edit-ad": openAdEditor(id); break;
    case "toggle-ad":
      PlatformService.setAdActive(id, element.dataset.active === "true");
      renderPage();
      showToast("Exibição do comunicado atualizada.", "success");
      break;
    case "delete-ad":
      askConfirmation("Excluir comunicado?", "O comunicado será removido do armazenamento local da demonstração.", "Excluir", () => {
        PlatformService.deleteAd(id);
        closeDialog();
        renderPage();
        showToast("Comunicado excluído.", "success");
      }, true);
      break;
    case "toggle-report":
      PlatformService.setReportStatus(id, element.dataset.status);
      renderPage();
      showToast("Status do relato atualizado.", "success");
      break;
    case "open-report": openReportDialog(); break;
    case "close-modal": closeDialog(); break;
    case "confirm-modal": {
      const confirmButton = element;
      confirmButton.disabled = true;
      Promise.resolve().then(() => pendingModalAction?.()).catch((error) => showToast(error.message || "Não foi possível concluir a ação.", "error")).finally(() => {
        if (appModal.classList.contains("open")) closeDialog();
      });
      break;
    }
    default: break;
  }
}

function markField(input, valid, message) {
  if (valid) { clearFieldError(input); return true; }
  setFieldError(input, message);
  return false;
}

function formValue(form, id) {
  return $(`#${id}`, form)?.value?.trim() ?? "";
}

async function handleFormSubmit(form) {
  const kind = form.dataset.form;
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (kind === "candidate-settings") {
      PlatformService.saveCandidateSettings(currentUser.id, {
        distanceMaxKm: $("#settingDistance", form).value,
        notifyNewJobs: $("#settingJobNotifications", form).checked,
        visibleToCompanies: $("#settingVisible", form).checked,
      });
      showToast("Preferências salvas neste navegador.", "success");
      renderPage();
      return;
    }
    if (kind === "account-email") {
      const email = $("#accountEmail", form);
      if (!markField(email, Validators.email(email.value), "Informe um e-mail válido.")) return;
      currentUser = await UserService.updateEmail(session.userId, email.value, session.token);
      AuthService.updateSessionProfile(currentUser);
      showToast("E-mail atualizado para esta demonstração local.", "success");
      renderPage();
      return;
    }
    if (kind === "password-change") {
      const current = $("#currentPassword", form);
      const next = $("#newPassword", form);
      const confirm = $("#confirmNewPassword", form);
      let valid = true;
      valid = markField(current, Validators.required(current.value), "Informe a senha atual.") && valid;
      valid = markField(next, Validators.password(next.value), "Use 8 ou mais caracteres, com letras e números.") && valid;
      valid = markField(confirm, confirm.value === next.value && confirm.value.length > 0, "As senhas não coincidem.") && valid;
      if (!valid) return;
      await AuthService.changePassword(session.userId, current.value, next.value, session.token);
      form.reset();
      showToast("Senha atualizada para esta demonstração local.", "success");
      return;
    }
    if (kind === "company-profile") {
      const name = $("#companyName", form);
      const sector = $("#companySector", form);
      const description = $("#companyDescription", form);
      const city = $("#companyCity", form);
      const state = $("#companyState", form);
      const address = $("#companyAddress", form);
      const email = $("#companyEmail", form);
      const website = $("#companyWebsite", form);
      let valid = true;
      valid = markField(name, Validators.required(name.value), "Informe o nome da empresa.") && valid;
      valid = markField(sector, Validators.required(sector.value), "Selecione o setor.") && valid;
      valid = markField(description, Validators.required(description.value), "Informe uma breve descrição.") && valid;
      valid = markField(city, Validators.required(city.value), "Informe a cidade.") && valid;
      valid = markField(state, Validators.required(state.value), "Selecione a UF.") && valid;
      valid = markField(address, Validators.required(address.value), "Informe uma região ou endereço.") && valid;
      valid = markField(email, Validators.email(email.value), "Informe um e-mail válido.") && valid;
      valid = markField(website, Validators.url(website.value), "Informe uma URL válida.") && valid;
      if (!valid) return;
      currentCompany = PlatformService.saveCompany(session.companyId, session.userId, {
        name: name.value, sector: sector.value, description: description.value, city: city.value,
        state: state.value, address: address.value, contactEmail: email.value, website: website.value,
        phone: formValue(form, "companyPhone"),
      });
      showToast("Dados da empresa atualizados localmente.", "success");
      renderPage();
      return;
    }
    if (kind === "job") {
      const title = $("#jobTitle", form);
      const area = $("#jobArea", form);
      const type = $("#jobType", form);
      const modality = $("#jobModality", form);
      const city = $("#jobCity", form);
      const state = $("#jobState", form);
      const address = $("#jobAddress", form);
      const education = $("#jobEducation", form);
      const description = $("#jobDescription", form);
      const requirements = $("#jobRequirements", form);
      const applicationUrl = $("#jobApplicationUrl", form);
      let valid = true;
      valid = markField(title, Validators.required(title.value), "Informe o cargo.") && valid;
      valid = markField(area, Validators.required(area.value), "Selecione a área.") && valid;
      valid = markField(type, Validators.required(type.value), "Selecione o tipo.") && valid;
      valid = markField(modality, Validators.required(modality.value), "Selecione a modalidade.") && valid;
      valid = markField(city, Validators.required(city.value), "Informe a cidade.") && valid;
      valid = markField(state, Validators.required(state.value), "Selecione a UF.") && valid;
      valid = markField(address, Validators.required(address.value), "Informe uma referência de localização.") && valid;
      valid = markField(education, Validators.required(education.value), "Informe a escolaridade.") && valid;
      valid = markField(description, description.value.trim().length >= 20, "Descreva a oportunidade com pelo menos 20 caracteres.") && valid;
      valid = markField(requirements, Validators.required(requirements.value), "Informe ao menos um requisito.") && valid;
      valid = markField(applicationUrl, Validators.url(applicationUrl.value), "Informe uma URL http(s) válida.") && valid;
      if (!valid) return;
      const fields = {
        title: title.value, area: area.value, type: type.value, modality: modality.value,
        city: city.value, state: state.value, address: address.value, education: education.value,
        description: description.value, requirements: requirements.value, benefits: formValue(form, "jobBenefits"),
        applicationUrl: applicationUrl.value, active: $("#jobActive", form).checked,
      };
      const jobId = form.dataset.jobId;
      if (jobId) {
        const existing = PlatformService.getAllJobs().find((entry) => entry.id === jobId);
        PlatformService.updateJob(jobId, form.dataset.companyId || existing?.companyId, session.userId, fields, form.dataset.actorRole);
      } else {
        PlatformService.createJob(session.companyId, session.userId, fields);
      }
      closeDialog();
      renderPage();
      showToast(jobId && form.dataset.actorRole === "company" ? "Alterações salvas; o anúncio voltou para revisão." : jobId ? "Vaga editada localmente." : "Anúncio enviado para revisão local.", "success");
      return;
    }
    if (kind === "admin-company") {
      const name = $("#adminCompanyName", form);
      const email = $("#adminCompanyEmail", form);
      const website = $("#adminCompanyWebsite", form);
      let valid = true;
      valid = markField(name, Validators.required(name.value), "Informe um nome.") && valid;
      valid = markField(email, !email.value || Validators.email(email.value), "Informe um e-mail válido.") && valid;
      valid = markField(website, Validators.url(website.value), "Informe uma URL válida.") && valid;
      if (!valid) return;
      PlatformService.adminUpdateCompany(form.dataset.id, {
        name: name.value, sector: formValue(form, "adminCompanySector"), description: formValue(form, "adminCompanyDescription"),
        city: formValue(form, "adminCompanyCity"), state: formValue(form, "adminCompanyState"), address: formValue(form, "adminCompanyAddress"),
        contactEmail: email.value, website: website.value,
      });
      closeDialog();
      renderPage();
      showToast("Registro empresarial editado localmente.", "success");
      return;
    }
    if (kind === "ad") {
      const title = $("#adTitle", form);
      const message = $("#adMessage", form);
      let valid = true;
      valid = markField(title, Validators.required(title.value), "Informe um título.") && valid;
      valid = markField(message, message.value.trim().length >= 10, "Escreva ao menos 10 caracteres.") && valid;
      if (!valid) return;
      PlatformService.saveAd({ title: title.value, message: message.value, active: $("#adActive", form)?.checked ?? true }, form.dataset.id || null);
      closeDialog();
      renderPage();
      showToast("Comunicado demonstrativo salvo.", "success");
      return;
    }
    if (kind === "report") {
      const category = $("#reportCategory", form);
      const description = $("#reportDescription", form);
      let valid = true;
      valid = markField(category, Validators.required(category.value), "Selecione uma categoria.") && valid;
      valid = markField(description, description.value.trim().length >= 10, "Escreva ao menos 10 caracteres.") && valid;
      if (!valid) return;
      PlatformService.createReport(currentUser, { category: category.value, description: description.value });
      closeDialog();
      if (session.role === "candidate") { currentView = "notifications"; renderPage(); }
      showToast("Relato guardado apenas localmente.", "success");
    }
  } catch (error) {
    showToast(error.message || "Não foi possível salvar os dados.", "error");
  } finally {
    if (submitButton && submitButton.isConnected) submitButton.disabled = false;
  }
}

appNav.addEventListener("click", (event) => {
  const item = event.target.closest("[data-view]");
  if (item) setView(item.dataset.view);
});
pageHeader.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) runAction(action);
});
appContent.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) runAction(action);
});
appModalContent.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) runAction(action);
});

appContent.addEventListener("input", (event) => {
  if (["jobSearch", "jobCity"].includes(event.target.id)) renderFilteredJobs();
  if (event.target.dataset.filter === "admin-candidates") renderAdminCandidatesTable(event.target.value);
  if (event.target.dataset.filter === "admin-companies") renderAdminCompaniesTable(event.target.value);
});
appContent.addEventListener("change", (event) => {
  if (["jobArea", "jobType", "jobModality"].includes(event.target.id)) renderFilteredJobs();
  if (event.target.id === "radarRadius") {
    const settings = PlatformService.getCandidateSettings(currentUser.id);
    PlatformService.saveCandidateSettings(currentUser.id, { ...settings, distanceMaxKm: event.target.value });
    renderPage();
  }
  if (event.target.matches("[data-application-status]")) {
    try {
      PlatformService.updateApplicationStatus(event.target.dataset.applicationStatus, session.companyId, event.target.value);
      renderPage();
      showToast("Status atualizado e notificação local registrada.", "success");
    } catch (error) { showToast(error.message, "error"); }
  }
});
appContent.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  handleFormSubmit(form);
});
appModalContent.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  handleFormSubmit(form);
});

$("#notificationShortcut").addEventListener("click", () => setView("notifications"));
$("#logoutButtonTop").addEventListener("click", () => askConfirmation("Sair da conta?", "A sessão demonstrativa será encerrada e você voltará à tela de acesso.", "Sim, sair", () => {
  AuthService.logout();
  window.location.replace("index.html");
}));
$("#logoutButtonSide").addEventListener("click", () => askConfirmation("Sair e trocar de acesso?", "A sessão será encerrada para que você possa entrar com outra conta demonstrativa.", "Sair", () => {
  AuthService.logout();
  window.location.replace("index.html");
}));
menuToggle.addEventListener("click", () => appSidebar.classList.contains("open") ? closeMobileMenu() : openMobileMenu());
sidebarScrim.addEventListener("click", closeMobileMenu);
appModal.addEventListener("click", (event) => { if (event.target === appModal) closeDialog(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDialog();
    closeMobileMenu();
  }
});

async function bootstrap() {
  try {
    await AuthService.seedDemoUser();
    session = AuthService.requireAuth(["candidate", "company", "admin"]);
    if (!session) return;
    currentUser = await UserService.getById(session.userId, session.token);
    if (!currentUser || currentUser.status === "blocked") {
      AuthService.logout();
      window.location.replace("index.html?redirect=painel");
      return;
    }
    if (session.role !== currentUser.role) {
      AuthService.logout();
      window.location.replace("index.html?redirect=painel");
      return;
    }
    PlatformService.init();
    if (session.role === "company") {
      currentCompany = PlatformService.getCompany(session.companyId || currentUser.companyId);
      if (!currentCompany) {
        showToast("O perfil empresarial desta conta não foi encontrado.", "error");
        AuthService.logout();
        window.location.replace("index.html");
        return;
      }
      session.companyId = currentCompany.id;
      AuthService.updateSessionProfile(currentUser);
    }
    const requestedView = new URLSearchParams(window.location.search).get("view");
    currentView = requestedView && viewIsAllowed(requestedView) ? requestedView : "home";
    renderPage();
    document.title = `${USER_ROLES[session.role]} — SkillMatch`;
    if (new URLSearchParams(window.location.search).has("bemvindo")) {
      showToast(`Bem-vindo(a), ${firstName(currentUser.nome)}! Esta área usa dados demonstrativos locais.`, "success");
    }
  } catch (error) {
    console.error("SkillMatch bootstrap error:", error);
    showToast(error.message || "Não foi possível carregar o painel.", "error");
  }
}

await bootstrap();
