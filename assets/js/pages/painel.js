import { $, $$, showToast, setFieldError, clearFieldError } from "../utils/dom.js";
import { Validators } from "../utils/validators.js";
import { Formatters } from "../utils/formatters.js";
import { APP_CONFIG, CATALOGS, USER_ROLES } from "../config/app.config.js";
import { AuthService } from "../services/auth.service.js";
import { UserService } from "../services/user.service.js";
import { PlatformService } from "../services/platform.service.js";
import { MatchService } from "../services/match.service.js";
import { InterviewPracticeService } from "../services/interview-practice.service.js";
import { formatCnpj } from "../../../shared/cnpj.js";

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
let interviewDraft = { jobType: "Primeiro Emprego", experienceLevel: "Primeira oportunidade", targetRole: "", questionId: "", answer: "" };
let interviewReviewId = null;

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
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z"/></svg>',
};

const NAV_ITEMS = {
  candidate: [
    { id: "home", label: "Início", icon: "home" },
    { id: "radar", label: "Radar de oportunidades", icon: "radar" },
    { id: "jobs", label: "Vagas", icon: "jobs" },
    { id: "favorites", label: "Vagas salvas", icon: "bookmark" },
    { id: "applications", label: "Minhas candidaturas", icon: "applications" },
    { id: "resume", label: "Currículo", icon: "resume" },
    { id: "courses", label: "Cursos e desenvolvimento", icon: "courses" },
    { id: "interviews", label: "Preparação para entrevistas", icon: "sparkles" },
    { id: "connections", label: "Empresas e mensagens", icon: "people" },
    { id: "notifications", label: "Notificações", icon: "notifications" },
    { id: "profile", label: "Meu perfil", icon: "profile", href: "perfil.html" },
    { id: "settings", label: "Configurações", icon: "settings" },
  ],
  company: [
    { id: "home", label: "Painel principal", icon: "home" },
    { id: "company-profile", label: "Dados da empresa", icon: "company" },
    { id: "company-jobs", label: "Vagas publicadas", icon: "jobs" },
    { id: "company-applicants", label: "Candidaturas", icon: "applications" },
    { id: "company-talent", label: "Banco de talentos", icon: "people" },
    { id: "company-connections", label: "Conexões e mensagens", icon: "notifications" },
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
    favorites: ["Sua lista pessoal", "Vagas salvas", "Organize oportunidades guardadas somente neste navegador."],
    applications: ["Acompanhamento local", "Minhas candidaturas", "Veja os interesses que você registrou neste navegador e os status de demonstração."],
    resume: ["Seu perfil profissional", "Currículo", "Visualize um currículo organizado com suas informações e use a impressão do navegador para salvar como PDF."],
    courses: ["Aprendizado contínuo", "Cursos e desenvolvimento", "Sugestões de temas para estudar. Não são cursos parceiros nem certificados oficiais."],
    interviews: ["Treino guiado", "Preparação para entrevistas", "Pratique respostas com perguntas estruturadas e feedback por regras locais. A integração de IA está pendente."],
    connections: ["Conexão profissional", "Empresas e mensagens", "Explore perfis empresariais e converse somente após iniciar ou aceitar uma conexão demonstrativa."],
    notifications: ["Atualizações", "Notificações", "Avisos gerados pela demonstração local. Nenhuma comunicação foi enviada por e-mail."],
    settings: ["Conta e privacidade", "Configurações", "Preferências salvas neste navegador. Para produção, autenticação e privacidade precisam de backend."],
  },
  company: {
    home: ["Área da empresa", "Painel principal", "Gerencie seu perfil demonstrativo, anúncios de vaga e candidaturas recebidas localmente."],
    "company-profile": ["Perfil empresarial", "Dados da empresa", "Edite os dados da conta de demonstração. A validação real da empresa requer serviço externo."],
    "company-jobs": ["Publicação e gestão", "Vagas publicadas", "Crie, edite, arquive e acompanhe anúncios demonstrativos. Novas vagas aguardam revisão do admin local."],
    "company-applicants": ["Processos demonstrativos", "Candidaturas", "Consulte currículos de pessoas que demonstraram interesse e atualize o status local."],
    "company-talent": ["Busca com consentimento", "Banco de talentos", "Consulte somente candidatos que permitiram aparecer no banco demonstrativo. Compatibilidade segue critérios transparentes."],
    "company-connections": ["Contato autorizado", "Conexões e mensagens", "Envie convites a perfis visíveis e converse apenas quando a conexão for aceita."],
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

function radarDistanceOrigin(candidate) {
  const address = candidate?.id ? PlatformService.getCandidateSettings(candidate.id).radarAddress : "";
  return address ? { address } : candidate;
}

function distanceLabel(candidate, place) {
  const origin = session?.role === "candidate" && currentView === "radar" ? radarDistanceOrigin(candidate) : candidate;
  const distance = PlatformService.distanceEstimate(origin, place);
  return distance === null ? "Distância não calculada" : `≈ ${distance} km entre centros urbanos · demo`;
}

function jobScore(job, candidate) {
  return MatchService.score(candidate, job).percentage;
}

function explainJobMatch(job, candidate) {
  const match = MatchService.score(candidate, job);
  return {
    matched: match.matchedSkills,
    missing: match.missingSkills,
    reasons: match.reasons,
    improvement: match.tips.join(" "),
    educationMatch: match.educationMatch,
  };
}

function hasApplied(jobId) {
  return PlatformService.getCandidateApplications(currentUser.id).some((application) => application.jobId === jobId && application.status !== "Desistiu");
}

function jobCard(job, { showScore = false, showDescription = true, applications = null } = {}) {
  const company = PlatformService.getCompany(job.companyId);
  const score = showScore ? jobScore(job, currentUser) : null;
  const alreadyApplied = applications ? applications.has(job.id) : hasApplied(job.id);
  const isFavorite = session.role === "candidate" && PlatformService.isFavorite(currentUser.id, job.id);
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
        <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-favorite" data-id="${escapeHtml(job.id)}" aria-pressed="${isFavorite}">${isFavorite ? "Remover salva" : "Salvar vaga"}</button>
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
    else if (currentView === "favorites") html = renderFavoritesPage();
    else if (currentView === "applications") html = renderApplicationsPage();
    else if (currentView === "resume") html = renderResumePage();
    else if (currentView === "courses") html = renderCoursesPage();
    else if (currentView === "interviews") html = renderInterviewPracticePage();
    else if (currentView === "connections") html = renderCandidateConnectionsPage();
    else if (currentView === "notifications") html = renderNotificationsPage();
    else if (currentView === "settings") html = renderSettingsPage();
  } else if (session.role === "company") {
    if (currentView === "home") html = renderCompanyHome();
    else if (currentView === "company-profile") html = renderCompanyProfilePage();
    else if (currentView === "company-jobs") html = renderCompanyJobsPage();
    else if (currentView === "company-applicants") html = renderCompanyApplicantsPage();
    else if (currentView === "company-talent") html = renderCompanyTalentPage();
    else if (currentView === "company-connections") html = renderCompanyConnectionsPage();
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
  if (currentView === "company-talent") renderCompanyTalentResults();
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
  const notifications = PlatformService.getCandidateNotifications(currentUser.id);
  const unread = notifications.filter((item) => !item.read).length;
  const appliedJobIds = new Set(applications.filter((application) => application.status !== "Desistiu").map((application) => application.jobId));
  const recommendations = MatchService.recommend(
    currentUser,
    PlatformService.getPublishedJobs().filter((job) => !appliedJobIds.has(job.id)),
    { limit: 3 },
  );
  const ads = PlatformService.getCandidateAds();
  const newest = notifications.find((notification) => !notification.read);
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
    <div class="card-head"><div class="card-head-copy"><h2>Oportunidades recomendadas</h2><p class="panel-card-subtitle">Anúncios fictícios; as sugestões podem variar diariamente e não repetem oportunidades nas quais você já registrou interesse.</p></div>${button("Ver todas", "go-view", { style: "btn-ghost", small: true, id: "jobs" })}</div>
    <div class="job-list">${recommendations.length ? recommendations.map(({ job }) => jobCard(job, { showScore: true, showDescription: false })).join("") : emptyState("Sem novas sugestões", "Você já registrou interesse em todas as oportunidades disponíveis ou não há anúncios no catálogo.")}</div>
  </section>
  <div class="panel-grid two" style="margin-top:1rem">
    <section class="panel-card"><div class="card-head"><div><h2>Notificação recente</h2><p class="panel-card-subtitle">Avisos são gerados localmente na demonstração.</p></div>${button("Abrir notificações", "go-view", { style: "btn-ghost", small: true, id: "notifications" })}</div>
      ${newest ? `<div class="notification-card unread"><span class="notification-icon">${ICONS.notifications}</span><div class="notification-copy"><strong>${escapeHtml(newest.title)}</strong><p>${escapeHtml(newest.message)}</p><small>${formattedDate(newest.createdAt, true)}</small></div></div>` : emptyState("Tudo em dia", "Não há avisos novos. Consulte a área de notificações para ver os avisos já lidos.", "notifications")}
    </section>
    <section class="panel-card"><div class="card-head"><div><h2>Plano de desenvolvimento</h2><p class="panel-card-subtitle">Sugestões de estudo, sem vínculo com cursos pagos ou certificados.</p></div>${button("Explorar temas", "go-view", { style: "btn-ghost", small: true, id: "courses" })}</div><p style="color:var(--text-muted);font-size:.85rem">${PlatformService.getCourseProgress(currentUser.id).planned.length} tema(s) no seu plano e ${PlatformService.getCourseProgress(currentUser.id).completed.length} marcado(s) como concluído(s).</p></section>
  </div>`;
}

function renderRadar() {
  const settings = PlatformService.getCandidateSettings(currentUser.id);
  const companies = PlatformService.getCompanies();
  const publishedJobs = PlatformService.getPublishedJobs();
  const maxDistance = Number(settings.distanceMaxKm) || 50;
  const address = settings.radarAddress || "";
  const city = settings.radarCity || "";
  const state = settings.radarState || "";
  const neighborhood = settings.radarNeighborhood || "";
  const origin = address ? { address } : currentUser;
  const originKnown = PlatformService.hasLocationCoordinates(origin);
  const withinRadius = (place) => {
    if (!originKnown) return true;
    const distance = PlatformService.distanceEstimate(origin, place);
    return distance !== null && distance <= maxDistance;
  };
  const matchesPlaceFilters = (place) => {
    const cityMatch = !city || normalizedText(`${place.city || ""} ${place.state || ""}`).includes(normalizedText(city));
    const stateMatch = !state || normalizedText(place.state) === normalizedText(state);
    const neighborhoodMatch = !neighborhood || normalizedText(`${place.address || ""} ${place.city || ""}`).includes(normalizedText(neighborhood));
    return cityMatch && stateMatch && neighborhoodMatch && withinRadius(place);
  };
  const filteredJobs = publishedJobs.filter((job) => matchesPlaceFilters(job)
    && (!settings.radarType || job.type === settings.radarType)
    && (!settings.radarArea || job.area === settings.radarArea)
    && (!settings.radarModality || job.modality === settings.radarModality));
  const visibleJobs = MatchService.recommend(currentUser, filteredJobs, { limit: filteredJobs.length }).map(({ job }) => job);
  const sortedCompanies = companies
    .filter(matchesPlaceFilters)
    .map((company) => ({ company, distance: PlatformService.distanceEstimate(origin, company) }))
    .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER));
  const radiusSelect = `<select class="input" id="radarRadius" aria-label="Distância máxima">${DISTANCE_OPTIONS.map((distance) => `<option value="${distance}" ${maxDistance === distance ? "selected" : ""}>${distance} km</option>`).join("")}</select>`;
  const stateSelect = `<select class="input" id="radarState" aria-label="Filtrar por estado">${optionList(CATALOGS.estados, state, "Todas as UFs")}</select>`;
  const distanceStatus = originKnown
    ? `Raio de até ${maxDistance} km aplicado a partir de ${address ? "uma cidade reconhecida no endereço informado" : "uma cidade reconhecida no seu perfil"}.`
    : address
      ? "Endereço não reconhecido na base demonstrativa; o raio não foi aplicado. Informe cidade e UF de uma região atendida."
      : "A cidade do perfil não consta na base demonstrativa; o raio não foi aplicado.";
  return `<section class="panel-card radar-filter-card" style="margin-bottom:1rem">
    <div class="card-head"><div class="card-head-copy"><h2>Configure seu Radar</h2><p class="panel-card-subtitle">Busque oportunidades a partir de um endereço de referência e ajuste o raio e os filtros.</p></div><span class="demo-tag">Consulta local</span></div>
    <div class="radar-filter-fields">
      <form class="field radar-address-field" data-form="radar-address" role="search"><label for="radarAddress">Endereço de referência</label><div class="radar-address-control"><input class="input" id="radarAddress" type="search" autocomplete="street-address" maxlength="180" value="${escapeHtml(address)}" placeholder="Rua, bairro, cidade e UF" /><button class="btn btn-ghost btn-sm" type="submit">Buscar</button></div><p class="form-help">Processado só neste navegador; a distância usa o centro urbano reconhecido, não o ponto exato da rua.</p></form>
      <div class="field"><label for="radarRadius">Distância máxima</label>${radiusSelect}</div>
      <div class="field"><label for="radarCity">Filtrar por cidade</label><input class="input" id="radarCity" value="${escapeHtml(city)}" placeholder="Ex.: Araucária" /></div>
      <div class="field"><label for="radarState">Filtrar por UF</label>${stateSelect}</div>
      <div class="field"><label for="radarNeighborhood">Filtrar por bairro / região</label><input class="input" id="radarNeighborhood" value="${escapeHtml(neighborhood)}" placeholder="Ex.: Centro" /></div>
      <div class="field"><label for="radarType">Tipo de oportunidade</label><select class="input" id="radarType">${optionList(CATALOGS.tiposVaga, settings.radarType || "", "Todos os tipos")}</select></div>
      <div class="field"><label for="radarArea">Área de interesse</label><select class="input" id="radarArea">${optionList(CATALOGS.areasInteresse, settings.radarArea || "", "Todas as áreas")}</select></div>
      <div class="field"><label for="radarModality">Modalidade</label><select class="input" id="radarModality">${optionList(CATALOGS.modalidades, settings.radarModality || "", "Todas as modalidades")}</select></div>
    </div>
    <p class="form-help" role="status">${escapeHtml(distanceStatus)} O reconhecimento local cobre Curitiba, Araucária, São José dos Pinhais, Pinhais, Colombo, Campo Largo e Fazenda Rio Grande.</p>
    <p class="form-help">Estimativa em linha reta entre centros urbanos conhecidos (não rota de rua); endereço não é enviado a geocodificador ou serviço externo. Anúncios sem distância calculável ficam fora do raio quando a origem é reconhecida.</p>
  </section>
  <div class="panel-grid two">
    <section class="panel-card"><div class="card-head"><div><h2>Empresas no catálogo demonstrativo</h2><p class="panel-card-subtitle">São entidades fictícias para teste. Não as apresentamos como contratantes sem anúncio confirmado.</p></div></div>
      <div class="job-list">${sortedCompanies.map(({ company, distance }) => `<article class="company-found-card"><span class="company-found-icon">${ICONS.company}</span><div><h3>${escapeHtml(company.name)}</h3><p>${escapeHtml(company.sector || "Setor não informado")} · ${escapeHtml(locationText(company))}</p><p>${escapeHtml(company.address || "Localização demonstrativa")}</p><p>${distance === null ? "Distância não calculada sem dados demonstrativos para a cidade." : `≈ ${distance} km entre centros urbanos (estimativa demonstrativa, não endereço real).`}</p><p><strong>Vagas confirmadas: nenhuma.</strong> ${company.id === "company-demo" ? `${publishedJobs.filter((job) => job.companyId === company.id).length} anúncio(s) demonstrativo(s) no catálogo.` : "Não há anúncio associado a este registro."}</p></div><span class="demo-tag">Fictícia</span></article>`).join("") || emptyState("Nenhum registro encontrado", "Nenhuma empresa corresponde aos filtros e ao raio disponíveis.", "company")}</div>
    </section>
    <section class="panel-card"><div class="card-head"><div><h2>Oportunidades compatíveis</h2><p class="panel-card-subtitle">${visibleJobs.length} anúncio(s) demonstrativo(s) correspondem aos filtros. Nenhum deles é uma vaga real confirmada.</p></div></div>
      <div class="job-list">${visibleJobs.length ? visibleJobs.map((job) => jobCard(job, { showScore: true, showDescription: false })).join("") : emptyState("Nenhum anúncio neste filtro", "Altere endereço, raio, cidade, modalidade ou preferências para explorar outros exemplos.")}</div>
    </section>
  </div>
  <section class="panel-card radar-map-note"><div class="map-note-icon">⌖</div><div><h3>Visualização em mapa</h3><p>Mapa indisponível nesta versão: Google Maps/serviço equivalente ainda não foi conectado. A lista acima usa apenas coordenadas demonstrativas de centros urbanos.</p></div><span class="demo-tag">Integração pendente</span></section>
  <p class="form-help" style="margin-top:.9rem">Compatibilidade percentual = regra demonstrativa baseada em campos do perfil. Não prevê contratação nem representa inteligência artificial.</p>`;
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

function renderFavoritesPage() {
  const favorites = PlatformService.getCandidateFavorites(currentUser.id);
  const publishedIds = new Set(PlatformService.getPublishedJobs().map((job) => job.id));
  const cards = favorites.map(({ job }) => {
    if (!job) return "";
    if (publishedIds.has(job.id)) return jobCard(job, { showScore: true });
    return `<article class="application-card"><div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(companyName(job.companyId))} · ${escapeHtml(locationText(job))}</p><p>Este anúncio não está ativo no catálogo demonstrativo.</p></div><div class="job-card-actions"><span class="status-pill">Indisponível</span><button type="button" class="btn btn-ghost btn-sm" data-action="toggle-favorite" data-id="${escapeHtml(job.id)}">Remover salva</button></div></article>`;
  }).join("");
  return `<section class="panel-card" style="margin-bottom:1rem"><div class="card-head"><div><h2>Suas vagas favoritas</h2><p class="panel-card-subtitle">Lista privada deste navegador. Favoritar não envia seus dados à empresa.</p></div><span class="demo-tag">${favorites.length} salva(s)</span></div></section><div class="job-list">${cards || emptyState("Nenhuma vaga salva", "Use “Salvar vaga” no catálogo demonstrativo para organizar oportunidades de interesse.", "bookmark")}</div>`;
}

function renderInterviewPracticePage() {
  const jobTypes = CATALOGS.tiposVaga;
  if (!jobTypes.includes(interviewDraft.jobType)) interviewDraft.jobType = "Primeiro Emprego";
  const questions = InterviewPracticeService.questionsFor(interviewDraft.jobType);
  if (!questions.some((question) => question.id === interviewDraft.questionId)) interviewDraft.questionId = questions[0]?.id || "";
  const history = PlatformService.getInterviewHistory(currentUser.id);
  const selectedQuestion = questions.find((question) => question.id === interviewDraft.questionId) || questions[0];
  const questionOptions = questions.map((question) => `<option value="${escapeHtml(question.id)}" ${question.id === interviewDraft.questionId ? "selected" : ""}>${escapeHtml(question.question)}</option>`).join("");
  const activeReview = history.find((entry) => entry.id === interviewReviewId);
  const speechSupported = Boolean(globalThis.window?.SpeechRecognition || globalThis.window?.webkitSpeechRecognition);
  const feedback = activeReview?.feedback;
  return `<section class="panel-card" style="margin-bottom:1rem"><div class="card-head"><div><h2>Pratique no seu ritmo</h2><p class="panel-card-subtitle">Perguntas estruturadas para Jovem Aprendiz, estágio e primeiro emprego. Suas respostas ficam neste navegador.</p></div><span class="demo-tag">Treino guiado</span></div><p class="form-help">A IA não está conectada nesta versão. O retorno abaixo usa somente uma checklist simples de extensão e palavras-chave: não atribui nota, não mede aptidão e não prevê contratação. Não inclua dados pessoais sensíveis.</p></section>
    <form class="form-panel" data-form="interview-practice" novalidate>
      <div class="form-row"><div class="field"><label for="interviewType">Tipo de oportunidade</label><select class="input" id="interviewType">${optionList(jobTypes, interviewDraft.jobType, "Selecione")}</select></div><div class="field"><label for="interviewExperience">Experiência que deseja praticar</label><select class="input" id="interviewExperience">${optionList(["Primeira oportunidade", "Tenho projetos ou atividades", "Já tive experiência formal"], interviewDraft.experienceLevel, "Selecione")}</select></div></div>
      <div class="field"><label for="interviewTargetRole">Cargo ou área desejada <span class="optional">(opcional)</span></label><input class="input" id="interviewTargetRole" maxlength="120" value="${escapeHtml(interviewDraft.targetRole)}" placeholder="Ex.: atendimento, auxiliar administrativo" /></div>
      <div class="field"><label for="interviewQuestion">Pergunta para praticar</label><select class="input" id="interviewQuestion">${questionOptions}</select></div>
      <div class="field"><label for="interviewAnswer">Sua resposta</label><textarea class="input" id="interviewAnswer" rows="6" maxlength="2000" placeholder="Responda com suas palavras. Experiências escolares, projetos e atividades também contam.">${escapeHtml(interviewDraft.answer)}</textarea><p class="error-msg">Escreva ao menos 10 caracteres para revisar sua resposta.</p><p class="form-help">${speechSupported ? "Você pode usar a entrada por voz do navegador; a disponibilidade e o processamento dependem dele." : "Entrada por voz não está disponível neste navegador; responda por texto."}</p></div>
      <div class="form-actions">${speechSupported ? button("Ditado por voz", "speech-to-text", { style: "btn-ghost", small: true }) : ""}<button type="submit" class="btn btn-primary">Revisar minha resposta</button></div>
    </form>
    ${feedback ? `<section class="panel-card" style="margin-top:1rem"><div class="card-head"><div><h2>Reflexão guiada</h2><p class="panel-card-subtitle">${escapeHtml(activeReview.question)}</p></div><span class="demo-tag">Sem nota / sem IA</span></div><div class="panel-grid two">${feedback.observations.map((item) => `<article class="application-card"><div><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.text)}</p></div></article>`).join("")}</div><div class="app-modal-section"><h3>Pontos para experimentar</h3><ul>${feedback.improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p style="margin-top:.6rem"><strong>Estrutura possível:</strong> ${escapeHtml(feedback.answerStructure)}</p><p class="form-help" style="margin-top:.6rem">${escapeHtml(feedback.disclaimer)}</p></div></section>` : ""}
    <section class="panel-card" style="margin-top:1rem"><div class="card-head"><div><h2>Histórico de prática</h2><p class="panel-card-subtitle">Registros locais para acompanhar respostas e revisar sua própria evolução; não são avaliações de recrutamento.</p></div><span class="demo-tag">${history.length} sessão(ões)</span></div><div class="job-list">${history.length ? history.slice(0, 8).map((entry) => `<article class="application-card"><div><h3>${escapeHtml(entry.jobType)}${entry.targetRole ? ` · ${escapeHtml(entry.targetRole)}` : ""}</h3><p>${formattedDate(entry.createdAt, true)} · ${escapeHtml(entry.question)}</p><details><summary>Rever sua resposta</summary><p style="margin-top:.5rem;white-space:pre-wrap">${escapeHtml(entry.answer)}</p></details></div><button type="button" class="btn btn-ghost btn-sm" data-action="delete-interview" data-id="${escapeHtml(entry.id)}">Excluir</button></article>`).join("") : emptyState("Nenhuma prática salva", "Envie uma resposta para criar seu primeiro registro local.", "sparkles")}</div></section>`;
}

function renderConversationCard(connection, otherName, otherSubtitle) {
  const statusText = { connected: "Conexão aceita", pending: "Convite pendente", declined: "Convite recusado", blocked: "Contato bloqueado" }[connection.status] || "Status indisponível";
  const candidateControls = session.role === "candidate" && connection.status === "pending" && connection.initiatedBy === "company"
    ? `<div class="job-card-actions"><button type="button" class="btn btn-primary btn-sm" data-action="accept-connection" data-id="${escapeHtml(connection.id)}">Aceitar convite</button><button type="button" class="btn btn-ghost btn-sm" data-action="decline-connection" data-id="${escapeHtml(connection.id)}">Recusar</button></div>`
    : "";
  let thread = "";
  if (connection.status === "connected") {
    PlatformService.markConnectionMessagesRead(connection.id, session.userId);
    const messages = PlatformService.getConnectionMessages(connection.id, session.userId);
    thread = `<ol class="application-history">${messages.length ? messages.map((message) => `<li><strong>${message.senderId === session.userId ? "Você" : escapeHtml(otherName)}</strong> · ${formattedDate(message.createdAt, true)}<br>${escapeHtml(message.body)}</li>`).join("") : "<li>Conexão aceita. Envie uma mensagem profissional para iniciar a conversa.</li>"}</ol>
      <form class="form-panel" data-form="connection-message" data-connection-id="${escapeHtml(connection.id)}" novalidate><div class="field"><label for="message-${escapeHtml(connection.id)}">Nova mensagem</label><textarea class="input" id="message-${escapeHtml(connection.id)}" rows="3" maxlength="2000" placeholder="Escreva uma mensagem respeitosa e objetiva."></textarea><p class="error-msg">Escreva uma mensagem.</p></div><div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">Enviar mensagem</button></div></form>
      <div class="job-card-actions" style="margin-top:.65rem"><button type="button" class="btn btn-ghost btn-sm" data-action="report-connection" data-id="${escapeHtml(connection.id)}">Denunciar contato</button><button type="button" class="btn btn-danger-ghost btn-sm" data-action="block-connection" data-id="${escapeHtml(connection.id)}">Bloquear contato</button></div>`;
  } else if (connection.status === "pending" && connection.invitationMessage) {
    thread = `<p class="panel-card-subtitle" style="margin:.6rem 0">${escapeHtml(connection.invitationMessage)}</p>`;
  } else if (connection.status === "blocked") {
    thread = `<p class="form-help">A conversa foi bloqueada e não aceita novas mensagens.</p>`;
  }
  return `<article class="panel-card"><div class="card-head"><div><h2>${escapeHtml(otherName)}</h2><p class="panel-card-subtitle">${escapeHtml(otherSubtitle)} · ${escapeHtml(statusText)} · demonstração local</p></div>${candidateControls}</div>${thread}</article>`;
}

function openConnectionIntroduction(companyId) {
  const company = PlatformService.getCompany(companyId);
  if (!company || !company.ownerId) { showToast("Esta empresa não possui conta habilitada para conexões nesta demonstração.", "info"); return; }
  const body = `<form data-form="connection-introduction" data-company-id="${escapeHtml(company.id)}" novalidate><div class="field"><label for="connectionIntroduction">Sua apresentação</label><textarea class="input" id="connectionIntroduction" rows="5" maxlength="1200" placeholder="Apresente seu interesse profissional, uma habilidade ou projeto e o que gostaria de conhecer."></textarea><p class="error-msg">Escreva ao menos 10 caracteres.</p></div><p class="form-help">Sua mensagem será entregue somente à conta empresarial associada, neste navegador. Seus dados de contato não são incluídos automaticamente.</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">Enviar apresentação</button></div></form>`;
  openDialog("Demonstrar interesse na empresa", company.name, body);
}

function openCandidateInvite(candidateId) {
  const candidate = UserService.listByRole("candidate").find((entry) => entry.id === candidateId);
  if (!candidate || !PlatformService.canCompanyViewCandidate(session.companyId, candidateId)) { showToast("Este perfil não está disponível para convite.", "error"); return; }
  const body = `<form data-form="connection-invite" data-candidate-id="${escapeHtml(candidateId)}" novalidate><div class="field"><label for="candidateInvitation">Mensagem do convite</label><textarea class="input" id="candidateInvitation" rows="5" maxlength="1200" placeholder="Explique o motivo do convite e o próximo passo proposto."></textarea><p class="error-msg">Escreva ao menos 10 caracteres.</p></div><p class="form-help">O candidato poderá aceitar ou recusar. A conversa só será aberta após a aceitação; os dados de contato permanecem ocultos.</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">Enviar convite</button></div></form>`;
  openDialog("Convidar candidato", candidate.nome, body);
}

function renderCandidateConnectionsPage() {
  const connections = PlatformService.getCandidateConnections(currentUser.id);
  const companies = PlatformService.getCompanies({ includeInactive: true }).filter((company) => company.active !== false);
  const directory = companies.map((company) => {
    const connection = connections.find((entry) => entry.companyId === company.id);
    const website = safeHttpUrl(company.website);
    let action = "";
    if (connection?.status === "connected") action = `<span class="status-pill success">Conectada</span>`;
    else if (connection?.status === "pending") action = `<span class="status-pill pending">Convite recebido</span>`;
    else if (connection) action = `<span class="status-pill">${connection.status === "blocked" ? "Bloqueada" : "Contato encerrado"}</span>`;
    else if (company.ownerId) action = `<button type="button" class="btn btn-primary btn-sm" data-action="start-company-connection" data-id="${escapeHtml(company.id)}">Demonstrar interesse</button>`;
    else action = `<span class="form-help">Sem conta habilitada para receber mensagens.</span>`;
    return `<article class="company-found-card"><span class="company-found-icon">${ICONS.company}</span><div><h3>${escapeHtml(company.name)}</h3><p>${escapeHtml(company.sector || "Setor não informado")} · ${escapeHtml(locationText(company))}</p><p>${escapeHtml(company.description || "Descrição não informada.")}</p>${website ? `<p><a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Site da empresa ↗</a></p>` : ""}<span class="demo-tag">${company.isDemo ? "Demonstração" : "Cadastro local"}</span></div>${action}</article>`;
  }).join("");
  const threads = connections.map((connection) => renderConversationCard(connection, connection.company?.name || "Empresa", locationText(connection.company))).join("");
  const unread = PlatformService.getUnreadMessageCount(session.userId);
  return `<section class="panel-card" style="margin-bottom:1rem"><div class="card-head"><div><h2>Conheça empresas e inicie uma conversa</h2><p class="panel-card-subtitle">Somente empresas com conta neste navegador podem receber uma apresentação. Conectar é uma ação explícita; nenhuma mensagem é enviada a empresas reais.</p></div><span class="demo-tag">${unread} não lida(s)</span></div><div class="job-list">${directory || emptyState("Nenhuma empresa disponível", "Empresas aparecem aqui quando há um perfil empresarial local ativo.", "company")}</div></section>
    <section class="panel-card"><div class="card-head"><div><h2>Convites, conexões e mensagens</h2><p class="panel-card-subtitle">Aceite um convite antes de trocar mensagens. Você pode denunciar ou bloquear contatos.</p></div></div><div class="job-list">${threads || emptyState("Sem conexões", "Demonstre interesse em uma empresa para criar uma conexão de demonstração.", "people")}</div></section>`;
}

function renderCompanyTalentPage() {
  return `<section class="panel-card" style="margin-bottom:1rem"><div class="card-head"><div><h2>Banco de talentos com consentimento</h2><p class="panel-card-subtitle">A lista contém apenas perfis ativos que autorizaram visibilidade. E-mail e telefone ficam ocultos até candidatura ou conexão aceita.</p></div><span class="demo-tag">Dados deste navegador</span></div>
      <div class="panel-grid three"><div class="field"><label for="talentSkills">Habilidade ou palavra-chave</label><input class="input" id="talentSkills" data-filter="company-talents" type="search" placeholder="Ex.: Excel, comunicação" /></div><div class="field"><label for="talentEducation">Escolaridade</label><select class="input" id="talentEducation" data-filter="company-talents">${optionList(CATALOGS.escolaridades, "", "Qualquer escolaridade")}</select></div><div class="field"><label for="talentCity">Cidade / UF</label><input class="input" id="talentCity" data-filter="company-talents" type="search" placeholder="Ex.: Araucária, PR" /></div></div>
      <label class="check-row"><input id="talentOnlySaved" data-filter="company-talents" type="checkbox" /><span>Mostrar somente talentos salvos pela empresa.</span></label>
    </section><p class="results-caption" id="talentResultsCaption"></p><div class="job-list" id="companyTalentResults"></div>`;
}

function renderCompanyTalentResults() {
  const target = $("#companyTalentResults", appContent);
  if (!target) return;
  const skillTerm = normalizedText($("#talentSkills", appContent)?.value);
  const education = normalizedText($("#talentEducation", appContent)?.value);
  const cityTerm = normalizedText($("#talentCity", appContent)?.value);
  const savedOnly = Boolean($("#talentOnlySaved", appContent)?.checked);
  const savedIds = new Set(PlatformService.getSavedTalentIds(session.companyId));
  const candidates = UserService.listByRole("candidate").filter((candidate) => {
    if (candidate.status !== "active" || !PlatformService.getCandidateSettings(candidate.id).visibleToCompanies) return false;
    const searchText = normalizedText(`${candidate.habilidades.join(" ")} ${candidate.curso} ${candidate.resumo}`);
    const candidateLocation = normalizedText(`${candidate.cidade} ${candidate.estado}`);
    return (!skillTerm || searchText.includes(skillTerm))
      && (!education || normalizedText(candidate.escolaridade).includes(education))
      && (!cityTerm || candidateLocation.includes(cityTerm))
      && (!savedOnly || savedIds.has(candidate.id));
  });
  const companyJobs = PlatformService.getCompanyJobs(session.companyId).filter((job) => job.approved && job.active !== false && !job.removed);
  const ranked = candidates.map((candidate) => {
    const best = companyJobs.map((job) => ({ job, match: MatchService.score(candidate, job) })).sort((a, b) => b.match.percentage - a.match.percentage)[0] || null;
    return { candidate, best };
  }).sort((a, b) => (b.best?.match.percentage ?? -1) - (a.best?.match.percentage ?? -1));
  $("#talentResultsCaption", appContent).textContent = `${ranked.length} perfil(is) visível(is) após aplicar os filtros e a preferência de privacidade.`;
  target.innerHTML = ranked.length ? ranked.map(({ candidate, best }) => {
    const saved = savedIds.has(candidate.id);
    const connection = PlatformService.getCompanyConnections(session.companyId).find((entry) => entry.candidateId === candidate.id);
    const connectionAction = connection?.status === "connected"
      ? `<span class="status-pill success">Conectado</span>`
      : connection?.status === "pending"
        ? `<span class="status-pill pending">Convite pendente</span>`
        : connection
          ? `<span class="status-pill">${connection.status === "blocked" ? "Contato bloqueado" : "Convite encerrado"}</span>`
          : `<button type="button" class="btn btn-ghost btn-sm" data-action="invite-candidate" data-id="${escapeHtml(candidate.id)}">Convidar</button>`;
    const match = best ? `<p><strong>${best.match.percentage}% de compatibilidade estimada</strong> com “${escapeHtml(best.job.title)}” — regra local por habilidades, área, tipo, escolaridade e região; não é IA nem decisão de contratação.</p><p>${escapeHtml(best.match.reasons.slice(0, 3).join(" · "))}</p>` : `<p>Publique e aprove uma vaga demonstrativa para comparar requisitos de forma explicável.</p>`;
    return `<article class="application-card"><div><h3>${escapeHtml(candidate.nome)}</h3><p>${escapeHtml(locationText(candidate))} · ${escapeHtml(candidate.escolaridade || "Escolaridade não informada")}</p><p>${escapeHtml(candidate.curso || "Curso não informado")}</p><div class="tag-list">${candidate.habilidades.slice(0, 6).map((skill) => `<span class="tag-view">${escapeHtml(skill)}</span>`).join("")}</div>${match}</div><div class="job-card-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="view-candidate" data-id="${escapeHtml(candidate.id)}">Ver perfil autorizado</button><button type="button" class="btn btn-ghost btn-sm" data-action="toggle-saved-talent" data-id="${escapeHtml(candidate.id)}">${saved ? "Remover salvo" : "Salvar talento"}</button>${connectionAction}</div></article>`;
  }).join("") : emptyState("Nenhum perfil corresponde", "Ajuste os filtros ou aguarde candidatos que optem por aparecer no banco de talentos.", "people");
}

function renderCompanyConnectionsPage() {
  const connections = PlatformService.getCompanyConnections(session.companyId);
  connections.forEach((connection) => {
    if (connection.status === "connected") PlatformService.markConnectionMessagesRead(connection.id, session.userId);
  });
  const unread = PlatformService.getUnreadMessageCount(session.userId);
  const cards = connections.map((connection) => renderConversationCard(
    connection,
    connection.candidate?.nome || "Perfil indisponível",
    connection.candidate ? `${locationText(connection.candidate)} · ${connection.candidate.escolaridade || "Formação não informada"}` : "Candidato indisponível",
  )).join("");
  return `<section class="panel-card" style="margin-bottom:1rem"><div class="card-head"><div><h2>Conversas autorizadas</h2><p class="panel-card-subtitle">Convites aparecem aqui até o candidato decidir. Mensagens só são habilitadas após conexão aceita.</p></div><span class="demo-tag">${unread} não lida(s)</span></div><div class="job-list">${cards || emptyState("Sem conexões ainda", "Consulte o banco de talentos autorizado ou aguarde apresentações de candidatos.", "people")}</div><div class="quick-link-row">${button("Abrir banco de talentos", "go-view", { style: "btn-ghost", small: true, id: "company-talent" })}</div></section>`;
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
        <label class="check-row"><input type="checkbox" id="settingVisible" ${settings.visibleToCompanies ? "checked" : ""} /><span>Permitir que empresas me encontrem no banco de talentos demonstrativo. Contato só é exibido após candidatura ou conexão aceita.</span></label>
        <p class="form-help">Esta preferência é apenas demonstrativa e vale neste navegador. Desativá-la remove seu perfil das novas buscas de talentos; não substitui autorização no servidor.</p>
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
    <section class="panel-card"><div class="card-head"><div><h2>Privacidade e ajuda</h2><p class="panel-card-subtitle">Preferências de visibilidade demonstrativas.</p></div></div><p style="font-size:.84rem;color:var(--text-muted)">O controle de visibilidade se aplica somente ao conteúdo salvo neste navegador. Não é uma regra de autorização para produção.</p><p style="margin-top:.7rem;font-size:.82rem"><a href="privacidade.html">Política demonstrativa de privacidade</a></p><div class="job-card-actions" style="margin-top:.75rem">${button("Relatar um problema", "open-report", { style: "btn-ghost", small: true, icon: "issue" })}${APP_CONFIG.useApi ? "" : button("Excluir conta e dados locais", "delete-demo-account", { style: "btn-danger-ghost", small: true })}</div><p class="form-help">A exclusão remove a conta e os registros associados somente deste navegador; não apaga dados enviados a terceiros nem substitui um pedido de exclusão em produção.</p></section>
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
    <section class="panel-card"><div class="card-head"><div><h2>Olá, ${escapeHtml(firstName(currentCompany?.name || currentUser.nome))}</h2><p class="panel-card-subtitle">Este painel está ligado à conta empresarial demonstrativa.</p></div><span class="demo-tag">Empresa fictícia</span></div><p style="color:var(--text-muted);font-size:.86rem">${escapeHtml(currentCompany?.description || "Complete o cadastro empresarial para apresentar melhor sua organização.")}</p><div class="quick-link-row">${button("Editar dados da empresa", "go-view", { style: "btn-ghost", small: true, id: "company-profile" })}${button("Publicar nova vaga", "new-job", { small: true })}${button("Banco de talentos", "go-view", { style: "btn-ghost", small: true, id: "company-talent" })}${button("Conexões e mensagens", "go-view", { style: "btn-ghost", small: true, id: "company-connections" })}</div></section>
    <section class="panel-card is-tinted"><div class="eyebrow">Transparência</div><h2>Publicação demonstrativa</h2><p style="margin-top:.45rem">Novos anúncios são fictícios, ficam pendentes da revisão local e só aparecem no catálogo após aprovação pela conta de administração.</p><div class="quick-link-row">${button("Gerenciar anúncios", "go-view", { style: "btn-ghost", small: true, id: "company-jobs" })}</div></section>
  </div>
  <section class="panel-card" style="margin-top:1rem"><div class="card-head"><div><h2>Atividade recente</h2><p class="panel-card-subtitle">Candidaturas relacionadas às suas vagas demonstrativas.</p></div>${button("Ver candidatos", "go-view", { style: "btn-ghost", small: true, id: "company-applicants" })}</div>
  ${applications.length ? `<div class="job-list">${applications.slice(0, 4).map((application) => `<div class="application-card"><div><h3>${escapeHtml(application.candidate?.nome || "Conta de candidato indisponível")}</h3><p>${escapeHtml(application.job?.title || "Vaga arquivada")} · ${formattedDate(application.createdAt, true)}</p></div>${statusBadge(application.status)}</div>`).join("")}</div>` : emptyState("Sem candidaturas ainda", "Quando um candidato demonstrativo registrar interesse, ele será listado aqui.", "people")}</section>`;
}

function renderCompanyProfilePage() {
  const company = currentCompany || {};
  const formattedCnpj = company.cnpj ? formatCnpj(company.cnpj) : "";
  return `<section class="panel-card" style="margin-bottom:1rem"><h2>Perfil da conta de empresa</h2><p class="panel-card-subtitle">O perfil permanece demonstrativo e salvo neste navegador. A validação do CNPJ confere apenas os dígitos verificadores; não confirma existência, situação cadastral ou titularidade.</p></section>
    <form class="form-panel" data-form="company-profile" novalidate>
      <div class="form-row"><div class="field"><label for="companyName">Nome da empresa</label><input class="input" id="companyName" value="${escapeHtml(company.name)}" /><p class="error-msg">Informe o nome da empresa.</p></div><div class="field"><label for="companySector">Setor</label><select class="input" id="companySector">${optionList(CATALOGS.areasInteresse, company.sector || "", "Selecione o setor")}</select><p class="error-msg">Selecione o setor.</p></div></div>
      <div class="field"><label for="companyCnpj">CNPJ</label><input class="input" id="companyCnpj" value="${escapeHtml(formattedCnpj)}" placeholder="Não informado" readonly aria-describedby="companyCnpjHelp" /><p class="form-help" id="companyCnpjHelp">${formattedCnpj ? "Informado no cadastro. A validação matemática não consulta a Receita Federal nem confirma existência ou situação cadastral." : "Este perfil demonstrativo anterior não tem CNPJ informado."}</p></div>
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
  const explanation = session.role === "candidate" ? explainJobMatch(job, currentUser) : null;
  const matchDetails = explanation ? `<div class="app-modal-section"><h3>Por que esta oportunidade combina?</h3><p><strong>${score}% de compatibilidade estimada</strong> — cálculo explicável por regras locais, não IA nem promessa de contratação.</p><ul>${explanation.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul><p><strong>Requisitos atendidos:</strong> ${explanation.matched.length ? explanation.matched.map(escapeHtml).join(", ") : "nenhum dos requisitos listados consta no perfil ainda"}.</p><p><strong>A desenvolver:</strong> ${explanation.missing.length ? explanation.missing.map(escapeHtml).join(", ") : "nenhum requisito listado pendente"}.</p><p><strong>Próximo passo:</strong> ${escapeHtml(explanation.improvement)}</p></div>` : "";
  const body = `<div class="app-modal-section"><span class="demo-tag">Vaga demonstrativa · contratação não confirmada</span><p style="margin-top:.6rem"><strong>Empresa:</strong> ${escapeHtml(company?.name || "Empresa demonstrativa")}</p><p><strong>Local:</strong> ${escapeHtml(job.address || locationText(job))}</p><p><strong>Distância:</strong> ${session.role === "candidate" ? escapeHtml(distanceLabel(currentUser, job)) : "Não calculada neste painel."}</p><p><strong>Tipo / modalidade:</strong> ${escapeHtml(job.type)} · ${escapeHtml(job.modality)}</p><p><strong>Escolaridade:</strong> ${escapeHtml(job.education || "Não informada")}</p></div>${matchDetails}<div class="app-modal-section"><h3>Descrição</h3><p>${escapeHtml(job.description)}</p></div><div class="app-modal-section"><h3>Requisitos</h3>${requirements ? `<ul>${requirements}</ul>` : `<p>Não informados.</p>`}</div><div class="app-modal-section"><h3>Benefícios</h3>${benefits ? `<ul>${benefits}</ul>` : `<p>Não informados.</p>`}</div>${url ? `<div class="app-modal-section"><h3>Canal externo</h3><p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Acessar link informado pela empresa</a></p></div>` : ""}<p class="form-help" style="margin-top:1rem">Este anúncio existe apenas no protótipo local. Registrar interesse não envia candidatura a uma empresa real.</p>`;
  const actions = session.role === "candidate" && !hasApplied(job.id) && job.approved && job.active !== false
    ? `<button type="button" class="btn btn-ghost" data-action="close-modal">Fechar</button><button type="button" class="btn btn-primary" data-action="apply-job" data-id="${escapeHtml(job.id)}">Registrar interesse</button>`
    : `<button type="button" class="btn btn-primary" data-action="close-modal">Fechar</button>`;
  openDialog(job.title, company?.name || "Detalhes da oportunidade", body, actions);
}

function openReportDialog(connectionId = "") {
  const body = `<form data-form="report" data-connection-id="${escapeHtml(connectionId)}" novalidate><div class="field"><label for="reportCategory">Categoria</label><select class="input" id="reportCategory">${optionList(["Dúvida", "Problema técnico", "Conteúdo inadequado", "Contato inadequado", "Privacidade", "Outro"], "", "Selecione")}</select><p class="error-msg">Selecione uma categoria.</p></div><div class="field"><label for="reportDescription">Descreva o relato</label><textarea class="input" id="reportDescription" rows="5" maxlength="1000" placeholder="Conte o que aconteceu (mínimo de 10 caracteres)."></textarea><p class="error-msg">Escreva ao menos 10 caracteres.</p></div><p class="form-help">Relato salvo apenas localmente; nenhum suporte real receberá sua mensagem.</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">Salvar relato local</button></div></form>`;
  openDialog("Relatar um problema", "Formulário de demonstração", body);
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const textarea = $("#interviewAnswer", appContent);
  if (!SpeechRecognition || !textarea) { showToast("Ditado por voz não está disponível neste navegador.", "info"); return; }
  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim();
    if (!transcript) return;
    textarea.value = `${textarea.value.trim()}${textarea.value.trim() ? " " : ""}${transcript}`.slice(0, 2000);
    interviewDraft.answer = textarea.value;
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    showToast("Transcrição inserida; revise o texto antes de enviar.", "success");
  };
  recognition.onerror = () => showToast("O navegador não conseguiu transcrever. Você pode responder por texto.", "error");
  try { recognition.start(); showToast("Ditado iniciado pelo navegador.", "info"); }
  catch { showToast("Não foi possível iniciar o ditado por voz.", "error"); }
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
  if (session.role === "company" && !PlatformService.canCompanyViewCandidate(session.companyId, candidate.id)) {
    showToast("Este perfil não está disponível para sua empresa.", "error");
    return;
  }
  const canSeeContact = session.role === "company" && PlatformService.canCompanyViewContact(session.companyId, candidate.id);
  const contacts = canSeeContact ? `${escapeHtml(candidate.email)}${candidate.telefone ? ` · ${escapeHtml(candidate.telefone)}` : ""}` : "Dados de contato ocultos pela preferência de privacidade até candidatura ou conexão autorizada.";
  const picture = candidate.fotoDataUrl ? `<img src="${escapeHtml(candidate.fotoDataUrl)}" alt="" style="width:50px;height:50px;object-fit:cover;border-radius:50%" />` : "";
  const body = `<div class="app-modal-section"><div style="display:flex;align-items:center;gap:.8rem">${picture}<div><h3>${escapeHtml(candidate.nome)}</h3><p>${escapeHtml(locationText(candidate))} · ${escapeHtml(candidate.escolaridade)}</p></div></div><p style="margin-top:.65rem"><strong>Contato:</strong> ${contacts}</p><p><strong>Curso:</strong> ${escapeHtml(candidate.curso || "Não informado")}${candidate.instituicao ? ` · ${escapeHtml(candidate.instituicao)}` : ""}</p></div><div class="app-modal-section"><h3>Resumo</h3><p>${escapeHtml(candidate.resumo || "Não informado")}</p></div><div class="app-modal-section"><h3>Habilidades</h3><p>${escapeHtml((candidate.habilidades || []).join(" · ") || "Não informadas")}</p></div><div class="app-modal-section"><h3>Cursos complementares</h3>${candidate.cursos?.length ? `<ul>${candidate.cursos.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Não informados.</p>`}</div><div class="app-modal-section"><h3>Experiência e projetos</h3>${candidate.experiencias?.length ? `<ul>${candidate.experiencias.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Não informados.</p>`}</div>`;
  const intro = session.role === "company"
    ? "Consulta local de perfil autorizada pela candidatura ou pela visibilidade escolhida pelo candidato. Contato só aparece após autorização apropriada."
    : "Consulta administrativa demonstrativa; este perfil e seus dados permanecem locais.";
  openDialog("Currículo demonstrativo", intro, body, `<button type="button" class="btn btn-primary" data-action="close-modal">Fechar</button>`);
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
    case "toggle-favorite": {
      try {
        const saved = PlatformService.toggleFavorite(currentUser.id, id);
        showToast(saved ? "Vaga salva na sua lista local." : "Vaga removida das suas salvas.", "success");
        if (currentView === "jobs") renderFilteredJobs();
        else renderPage();
      } catch (error) { showToast(error.message, "error"); }
      break;
    }
    case "start-company-connection": openConnectionIntroduction(id); break;
    case "invite-candidate": openCandidateInvite(id); break;
    case "accept-connection":
    case "decline-connection": {
      try {
        const accepted = action === "accept-connection";
        PlatformService.respondToConnection(id, currentUser.id, accepted);
        renderPage();
        showToast(accepted ? "Convite aceito; a conversa está liberada." : "Convite recusado. Nenhum contato foi compartilhado.", "success");
      } catch (error) { showToast(error.message, "error"); }
      break;
    }
    case "toggle-saved-talent": {
      try {
        const saved = PlatformService.toggleSavedTalent(session.companyId, session.userId, id);
        renderCompanyTalentResults();
        showToast(saved ? "Talento salvo na lista local da empresa." : "Talento removido da lista local.", "success");
      } catch (error) { showToast(error.message, "error"); }
      break;
    }
    case "block-connection":
      askConfirmation("Bloquear este contato?", "A conversa será encerrada neste navegador e não aceitará novas mensagens.", "Bloquear contato", () => {
        PlatformService.blockConnection(id, session.userId);
        closeDialog();
        renderPage();
        showToast("Contato bloqueado localmente.", "info");
      }, true);
      break;
    case "report-connection": openReportDialog(id); break;
    case "delete-interview":
      askConfirmation("Excluir esta prática?", "A resposta e o feedback serão removidos do histórico local deste navegador.", "Excluir prática", () => {
        PlatformService.deleteInterviewPractice(id, currentUser.id);
        if (interviewReviewId === id) interviewReviewId = null;
        closeDialog();
        renderPage();
        showToast("Registro de prática removido.", "info");
      }, true);
      break;
    case "speech-to-text": startSpeechRecognition(); break;
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
    case "delete-demo-account":
      askConfirmation("Excluir sua conta e dados locais?", "A ação remove este perfil, conexões, mensagens, favoritos, relatórios e práticas deste navegador e encerra a sessão. Não pode ser desfeita; não afeta dados enviados a terceiros.", "Excluir dados locais", async () => {
        await UserService.deleteAccount(session.userId, session.token);
        AuthService.logout();
        window.location.replace("login.html");
      }, true);
      break;
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
    if (kind === "interview-practice") {
      const answer = $("#interviewAnswer", form);
      if (!markField(answer, answer.value.trim().length >= 10, "Escreva ao menos 10 caracteres para revisar sua resposta.")) return;
      const jobType = $("#interviewType", form).value;
      const questionId = $("#interviewQuestion", form).value;
      const question = InterviewPracticeService.questionsFor(jobType).find((item) => item.id === questionId);
      if (!question) { showToast("Selecione uma pergunta válida para continuar.", "error"); return; }
      interviewDraft = {
        jobType,
        experienceLevel: $("#interviewExperience", form).value,
        targetRole: formValue(form, "interviewTargetRole"),
        questionId,
        answer: answer.value.trim(),
      };
      const feedback = InterviewPracticeService.reviewAnswer({ answer: interviewDraft.answer, candidate: currentUser });
      const saved = PlatformService.saveInterviewPractice(currentUser.id, {
        ...interviewDraft, question: question.question, feedback,
      });
      interviewReviewId = saved.id;
      interviewDraft.answer = "";
      renderPage();
      showToast("Revisão guiada salva apenas neste navegador.", "success");
      return;
    }
    if (kind === "connection-introduction") {
      const introduction = $("#connectionIntroduction", form);
      if (!markField(introduction, introduction.value.trim().length >= 10, "Escreva ao menos 10 caracteres.")) return;
      PlatformService.startCandidateConnection(form.dataset.companyId, currentUser.id, introduction.value);
      closeDialog();
      currentView = "connections";
      renderPage();
      showToast("Apresentação enviada; a conexão demonstrativa está aberta.", "success");
      return;
    }
    if (kind === "connection-invite") {
      const invitation = $("#candidateInvitation", form);
      if (!markField(invitation, invitation.value.trim().length >= 10, "Escreva ao menos 10 caracteres.")) return;
      PlatformService.inviteCandidate(session.companyId, session.userId, form.dataset.candidateId, invitation.value);
      closeDialog();
      currentView = "company-connections";
      renderPage();
      showToast("Convite demonstrativo enviado; aguarda a decisão do candidato.", "success");
      return;
    }
    if (kind === "connection-message") {
      const message = form.querySelector("textarea");
      if (!markField(message, message.value.trim().length >= 1, "Escreva uma mensagem.")) return;
      PlatformService.sendConnectionMessage(form.dataset.connectionId, session.userId, message.value);
      renderPage();
      showToast("Mensagem salva na conversa local.", "success");
      return;
    }
    if (kind === "radar-address") {
      const settings = PlatformService.getCandidateSettings(currentUser.id);
      PlatformService.saveCandidateSettings(currentUser.id, { ...settings, radarAddress: $("#radarAddress", form).value });
      renderPage();
      showToast("Endereço de referência atualizado localmente.", "success");
      return;
    }
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
      PlatformService.createReport(currentUser, { category: category.value, description: description.value, connectionId: form.dataset.connectionId });
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
  if (event.target.dataset.filter === "company-talents") renderCompanyTalentResults();
  if (event.target.id === "interviewAnswer") interviewDraft.answer = event.target.value;
  if (event.target.id === "interviewTargetRole") interviewDraft.targetRole = event.target.value;
});
appContent.addEventListener("change", (event) => {
  if (["jobArea", "jobType", "jobModality"].includes(event.target.id)) renderFilteredJobs();
  if (event.target.id === "interviewType") {
    interviewDraft.jobType = event.target.value;
    interviewDraft.questionId = "";
    interviewReviewId = null;
    renderPage();
    return;
  }
  if (event.target.id === "interviewQuestion") { interviewDraft.questionId = event.target.value; interviewReviewId = null; }
  if (event.target.id === "interviewExperience") interviewDraft.experienceLevel = event.target.value;
  if (event.target.dataset.filter === "company-talents") renderCompanyTalentResults();
  if (["radarRadius", "radarCity", "radarState", "radarNeighborhood", "radarType", "radarArea", "radarModality"].includes(event.target.id)) {
    const settings = PlatformService.getCandidateSettings(currentUser.id);
    const keyById = { radarRadius: "distanceMaxKm", radarCity: "radarCity", radarState: "radarState", radarNeighborhood: "radarNeighborhood", radarType: "radarType", radarArea: "radarArea", radarModality: "radarModality" };
    PlatformService.saveCandidateSettings(currentUser.id, { ...settings, [keyById[event.target.id]]: event.target.value });
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
  window.location.replace("login.html");
}));
$("#logoutButtonSide").addEventListener("click", () => askConfirmation("Sair e trocar de acesso?", "A sessão será encerrada para que você possa entrar com outra conta demonstrativa.", "Sair", () => {
  AuthService.logout();
  window.location.replace("login.html");
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
      window.location.replace("login.html?redirect=painel");
      return;
    }
    if (session.role !== currentUser.role) {
      AuthService.logout();
      window.location.replace("login.html?redirect=painel");
      return;
    }
    PlatformService.init();
    if (session.role === "company") {
      currentCompany = PlatformService.getCompany(session.companyId || currentUser.companyId);
      if (!currentCompany) {
        showToast("O perfil empresarial desta conta não foi encontrado.", "error");
        AuthService.logout();
        window.location.replace("login.html");
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
