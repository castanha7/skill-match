import { APP_CONFIG } from "../config/app.config.js";
import { StorageService } from "./storage.service.js";
import { UserService } from "./user.service.js";

const DATA_KEY = APP_CONFIG.storageKeys.platform;
const APP_STATUS = new Set(["Recebida", "Em análise", "Entrevista", "Não selecionada", "Contratada", "Desistiu"]);

const DEMO_COMPANIES = [
  {
    id: "company-demo",
    name: "Empresa demonstrativa SkillMatch",
    sector: "Tecnologia da Informação",
    description: "Perfil empresarial fictício para testar o painel de publicação. Não representa uma empresa contratando.",
    city: "Curitiba",
    state: "PR",
    address: "Localização demonstrativa — região central",
    website: "",
    contactEmail: "empresa@skillmatch.com",
    phone: "",
    ownerId: "",
    verified: false,
    active: true,
    isDemo: true,
    createdAt: "2026-11-14T12:00:00.000Z",
  },
  {
    id: "company-demo-araucaria",
    name: "Organização fictícia — demonstração Araucária",
    sector: "Serviços",
    description: "Registro simulado usado apenas para demonstrar o radar. Empresa e localização fictícias; nenhuma vaga confirmada.",
    city: "Araucária",
    state: "PR",
    address: "Localização regional demonstrativa",
    website: "",
    contactEmail: "",
    phone: "",
    ownerId: "",
    verified: false,
    active: true,
    isDemo: true,
    createdAt: "2026-11-14T12:00:00.000Z",
  },
  {
    id: "company-demo-sjp",
    name: "Coletivo fictício — demonstração São José dos Pinhais",
    sector: "Comércio e Vendas",
    description: "Registro simulado, sem vínculo com uma empresa real ou com oportunidades de contratação.",
    city: "São José dos Pinhais",
    state: "PR",
    address: "Localização regional demonstrativa",
    website: "",
    contactEmail: "",
    phone: "",
    ownerId: "",
    verified: false,
    active: true,
    isDemo: true,
    createdAt: "2026-11-14T12:00:00.000Z",
  },
];

const DEMO_JOBS = [
  {
    id: "job-demo-ti",
    companyId: "company-demo",
    title: "Assistente de tecnologia — vaga demonstrativa",
    area: "Tecnologia da Informação",
    type: "Estágio",
    modality: "Híbrido",
    city: "Curitiba",
    state: "PR",
    address: "Localização demonstrativa — Curitiba, PR",
    education: "Ensino Técnico ou Superior em curso",
    description: "Exemplo de anúncio para demonstrar os filtros, os detalhes e a compatibilidade. Não é uma vaga real nem representa um processo seletivo aberto.",
    requirements: ["HTML e CSS", "JavaScript", "Comunicação"],
    benefits: ["Plano de aprendizagem demonstrativo", "Acompanhamento fictício"],
    applicationUrl: "",
    active: true,
    approved: true,
    confirmed: false,
    isDemo: true,
    createdAt: "2026-11-14T12:00:00.000Z",
  },
  {
    id: "job-demo-admin",
    companyId: "company-demo",
    title: "Apoio administrativo — oportunidade demonstrativa",
    area: "Administração",
    type: "Jovem Aprendiz",
    modality: "Presencial",
    city: "Curitiba",
    state: "PR",
    address: "Localização demonstrativa — Curitiba, PR",
    education: "Ensino Médio em curso",
    description: "Anúncio fictício para testar candidaturas e filtros. Nenhuma contratação está confirmada.",
    requirements: ["Pacote Office", "Organização", "Comunicação"],
    benefits: ["Conteúdo demonstrativo"],
    applicationUrl: "",
    active: true,
    approved: true,
    confirmed: false,
    isDemo: true,
    createdAt: "2026-11-14T12:00:00.000Z",
  },
  {
    id: "job-demo-atendimento",
    companyId: "company-demo",
    title: "Atendimento ao cliente — oportunidade demonstrativa",
    area: "Atendimento ao Cliente",
    type: "Primeiro Emprego",
    modality: "Presencial",
    city: "São José dos Pinhais",
    state: "PR",
    address: "Localização demonstrativa — São José dos Pinhais, PR",
    education: "Ensino Médio em curso ou concluído",
    description: "Oportunidade fictícia para testar o fluxo de candidatura. Não corresponde a uma empresa ou vaga real.",
    requirements: ["Comunicação", "Trabalho em equipe", "Atendimento ao cliente"],
    benefits: ["Informações demonstrativas"],
    applicationUrl: "",
    active: true,
    approved: true,
    confirmed: false,
    isDemo: true,
    createdAt: "2026-11-14T12:00:00.000Z",
  },
  {
    id: "job-demo-logistica",
    companyId: "company-demo",
    title: "Auxiliar de logística — vaga demonstrativa",
    area: "Logística",
    type: "Jovem Aprendiz",
    modality: "Presencial",
    city: "Araucária",
    state: "PR",
    address: "Localização demonstrativa — Araucária, PR",
    education: "Ensino Médio em curso",
    description: "Exemplo fictício para demonstrar como uma oportunidade regional apareceria no radar. Não está contratando.",
    requirements: ["Organização", "Estoque e logística", "Pontualidade"],
    benefits: ["Informações demonstrativas"],
    applicationUrl: "",
    active: true,
    approved: true,
    confirmed: false,
    isDemo: true,
    createdAt: "2026-11-14T12:00:00.000Z",
  },
];

const EMPTY_STATE = () => ({
  version: 1,
  companies: [],
  jobs: [],
  applications: [],
  notifications: [],
  preferences: {},
  reports: [],
  ads: [],
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function id(prefix) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`}`;
}

function persist(state) {
  state.updatedAt = new Date().toISOString();
  if (!StorageService.set(DATA_KEY, state)) {
    throw new Error("Não foi possível salvar a demonstração neste navegador. Confira o espaço de armazenamento local.");
  }
}

function addNotification(state, userId, { title, message, targetView = "notifications", type = "info", linkId = null }) {
  if (!userId) return;
  state.notifications.unshift({
    id: id("notification"),
    userId,
    title,
    message,
    targetView,
    linkId,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function ensureState() {
  const stored = StorageService.get(DATA_KEY);
  const state = stored && stored.version === 1 ? stored : EMPTY_STATE();
  for (const key of ["companies", "jobs", "applications", "notifications", "reports", "ads"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  let changed = !stored || stored.version !== 1;
  if (!state.preferences || typeof state.preferences !== "object") {
    state.preferences = {};
    changed = true;
  }

  const users = StorageService.get(APP_CONFIG.storageKeys.users, []);
  const companyUser = Array.isArray(users) ? users.find((user) => user.role === "company" && user.companyId === "company-demo") : null;
  DEMO_COMPANIES.forEach((company) => {
    if (!state.companies.some((entry) => entry.id === company.id)) {
      state.companies.push({ ...clone(company), ownerId: company.id === "company-demo" ? companyUser?.id || "" : "" });
      changed = true;
    }
  });
  const demoCompany = state.companies.find((company) => company.id === "company-demo");
  if (demoCompany && companyUser && demoCompany.ownerId !== companyUser.id) {
    demoCompany.ownerId = companyUser.id;
    changed = true;
  }
  DEMO_JOBS.forEach((job) => {
    if (!state.jobs.some((entry) => entry.id === job.id)) {
      state.jobs.push(clone(job));
      changed = true;
    }
  });
  if (Array.isArray(users)) {
    users.filter((user) => user.role === "candidate").forEach((user) => {
      if (!state.notifications.some((notification) => notification.userId === user.id && notification.type === "welcome")) {
        addNotification(state, user.id, {
          title: "Bem-vindo(a) ao SkillMatch",
          message: "Explore o painel e lembre-se: as vagas e empresas apresentadas nesta versão são demonstrativas.",
          targetView: "home",
          type: "welcome",
        });
        changed = true;
      }
      if (!state.preferences[user.id]) {
        state.preferences[user.id] = { distanceMaxKm: 50, visibleToCompanies: true, notifyNewJobs: true };
        changed = true;
      }
    });
  }
  if (changed) persist(state);
  return state;
}

function update(mutator) {
  const state = ensureState();
  const result = mutator(state);
  persist(state);
  return result;
}

function companyOwnsJob(state, job, companyId) {
  return job && job.companyId === companyId && state.companies.some((company) => company.id === companyId);
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

const CITY_COORDINATES = {
  "araucaria|pr": [-25.5925, -49.4107],
  "curitiba|pr": [-25.4284, -49.2733],
  "sao jose dos pinhais|pr": [-25.5347, -49.2030],
  "pinhais|pr": [-25.4429, -49.1926],
  "colombo|pr": [-25.2914, -49.2244],
  "campo largo|pr": [-25.4589, -49.5275],
  "fazenda rio grande|pr": [-25.6624, -49.3073],
};

function normalizedLocation(city, state) {
  const clean = String(city ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `${clean}|${String(state ?? "").trim().toUpperCase()}`;
}

export const PlatformService = {
  init() {
    return ensureState();
  },

  getSnapshot() {
    return ensureState();
  },

  getCompanies({ includeInactive = false } = {}) {
    return ensureState().companies.filter((company) => includeInactive || company.active !== false).map((company) => ({ ...company }));
  },

  getCompany(companyId) {
    const company = ensureState().companies.find((entry) => entry.id === companyId);
    return company ? { ...company } : null;
  },

  saveCompany(companyId, ownerId, fields) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId);
      if (!company || company.ownerId !== ownerId) throw new Error("Esta conta não pode editar esse perfil empresarial.");
      Object.assign(company, {
        name: String(fields.name ?? "").trim(),
        sector: String(fields.sector ?? "").trim(),
        description: String(fields.description ?? "").trim(),
        city: String(fields.city ?? "").trim(),
        state: String(fields.state ?? "").trim().toUpperCase(),
        address: String(fields.address ?? "").trim(),
        website: String(fields.website ?? "").trim(),
        contactEmail: String(fields.contactEmail ?? "").trim().toLowerCase(),
        phone: String(fields.phone ?? "").trim(),
        updatedAt: new Date().toISOString(),
      });
      return { ...company };
    });
  },

  getPublishedJobs() {
    const state = ensureState();
    const activeCompanyIds = new Set(state.companies.filter((company) => company.active !== false).map((company) => company.id));
    return state.jobs
      .filter((job) => job.active !== false && job.removed !== true && job.approved === true && activeCompanyIds.has(job.companyId))
      .map((job) => ({ ...job, requirements: normalizeList(job.requirements), benefits: normalizeList(job.benefits) }));
  },

  getAllJobs() {
    const state = ensureState();
    return state.jobs.map((job) => ({ ...job, requirements: normalizeList(job.requirements), benefits: normalizeList(job.benefits) }));
  },

  getCompanyJobs(companyId) {
    return this.getAllJobs().filter((job) => job.companyId === companyId);
  },

  createJob(companyId, ownerId, fields) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId && entry.ownerId === ownerId);
      if (!company) throw new Error("Perfil empresarial não encontrado para esta conta.");
      const job = {
        id: id("job"),
        companyId,
        title: String(fields.title ?? "").trim(),
        area: String(fields.area ?? "").trim(),
        type: String(fields.type ?? "").trim(),
        modality: String(fields.modality ?? "").trim(),
        city: String(fields.city ?? "").trim(),
        state: String(fields.state ?? "").trim().toUpperCase(),
        address: String(fields.address ?? "").trim(),
        education: String(fields.education ?? "").trim(),
        description: String(fields.description ?? "").trim(),
        requirements: normalizeList(fields.requirements),
        benefits: normalizeList(fields.benefits),
        applicationUrl: String(fields.applicationUrl ?? "").trim(),
        active: fields.active !== false,
        approved: false,
        confirmed: false,
        isDemo: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.jobs.unshift(job);
      return { ...job };
    });
  },

  updateJob(jobId, companyId, ownerId, fields, actorRole = "company") {
    return update((state) => {
      const job = state.jobs.find((entry) => entry.id === jobId);
      if (!job) throw new Error("Vaga não encontrada.");
      if (actorRole !== "admin" && (!companyOwnsJob(state, job, companyId) || state.companies.find((company) => company.id === companyId)?.ownerId !== ownerId)) {
        throw new Error("Esta conta não pode editar essa vaga.");
      }
      Object.assign(job, {
        title: String(fields.title ?? job.title).trim(),
        area: String(fields.area ?? job.area).trim(),
        type: String(fields.type ?? job.type).trim(),
        modality: String(fields.modality ?? job.modality).trim(),
        city: String(fields.city ?? job.city).trim(),
        state: String(fields.state ?? job.state).trim().toUpperCase(),
        address: String(fields.address ?? job.address).trim(),
        education: String(fields.education ?? job.education).trim(),
        description: String(fields.description ?? job.description).trim(),
        requirements: normalizeList(fields.requirements ?? job.requirements),
        benefits: normalizeList(fields.benefits ?? job.benefits),
        applicationUrl: String(fields.applicationUrl ?? job.applicationUrl).trim(),
        active: fields.active !== false,
        updatedAt: new Date().toISOString(),
        isDemo: true,
        confirmed: false,
      });
      if (actorRole !== "admin") job.approved = false;
      return { ...job };
    });
  },

  setJobActive(jobId, companyId, ownerId, active, actorRole = "company") {
    return update((state) => {
      const job = state.jobs.find((entry) => entry.id === jobId);
      if (!job) throw new Error("Vaga não encontrada.");
      if (actorRole !== "admin" && (!companyOwnsJob(state, job, companyId) || state.companies.find((company) => company.id === companyId)?.ownerId !== ownerId)) {
        throw new Error("Esta conta não pode alterar essa vaga.");
      }
      job.active = Boolean(active);
      job.removed = !active && actorRole === "admin";
      job.updatedAt = new Date().toISOString();
      return { ...job };
    });
  },

  archiveCompanyJob(jobId, companyId, ownerId) {
    return update((state) => {
      const job = state.jobs.find((entry) => entry.id === jobId);
      const company = state.companies.find((entry) => entry.id === companyId);
      if (!job || job.companyId !== companyId || company?.ownerId !== ownerId) throw new Error("Esta conta não pode excluir esse anúncio.");
      job.active = false;
      job.removed = true;
      job.updatedAt = new Date().toISOString();
      return { ...job };
    });
  },

  setJobApproval(jobId, approved) {
    return update((state) => {
      const job = state.jobs.find((entry) => entry.id === jobId);
      if (!job) throw new Error("Vaga não encontrada.");
      job.approved = Boolean(approved);
      job.active = Boolean(approved);
      job.removed = false;
      job.reviewedAt = new Date().toISOString();
      if (approved) {
        const candidates = UserService.listByRole("candidate");
        candidates.forEach((candidate) => {
          const settings = state.preferences[candidate.id] || { notifyNewJobs: true };
          if (settings.notifyNewJobs !== false) {
            addNotification(state, candidate.id, {
              title: "Nova oportunidade demonstrativa",
              message: `${job.title} foi aprovada para aparecer no catálogo de demonstração. Não é uma vaga real.`,
              targetView: "jobs",
              linkId: job.id,
              type: "job",
            });
          }
        });
      }
      return { ...job };
    });
  },

  applyToJob(jobId, candidate) {
    return update((state) => {
      const job = state.jobs.find((entry) => entry.id === jobId && entry.active !== false && entry.approved === true && entry.removed !== true);
      if (!job) throw new Error("Esta oportunidade não está disponível no catálogo demonstrativo.");
      const existing = state.applications.find((application) => application.jobId === jobId && application.candidateId === candidate.id && application.status !== "Desistiu");
      if (existing) throw new Error("Você já registrou interesse nesta oportunidade.");
      const application = {
        id: id("application"),
        jobId,
        candidateId: candidate.id,
        status: "Recebida",
        history: [{ status: "Recebida", at: new Date().toISOString(), note: "Interesse registrado no ambiente demonstrativo." }],
        createdAt: new Date().toISOString(),
        isDemo: true,
      };
      state.applications.unshift(application);
      addNotification(state, candidate.id, {
        title: "Interesse registrado",
        message: `Seu interesse em “${job.title}” foi registrado somente neste navegador. Nenhuma candidatura foi enviada a uma empresa real.`,
        targetView: "applications",
        linkId: application.id,
        type: "application",
      });
      return { ...application };
    });
  },

  getCandidateApplications(candidateId) {
    const state = ensureState();
    return state.applications
      .filter((application) => application.candidateId === candidateId)
      .map((application) => ({
        ...application,
        job: state.jobs.find((job) => job.id === application.jobId) || null,
        company: state.companies.find((company) => company.id === state.jobs.find((job) => job.id === application.jobId)?.companyId) || null,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  getCompanyApplications(companyId) {
    const state = ensureState();
    const jobIds = new Set(state.jobs.filter((job) => job.companyId === companyId).map((job) => job.id));
    return state.applications
      .filter((application) => jobIds.has(application.jobId))
      .map((application) => ({
        ...application,
        job: state.jobs.find((job) => job.id === application.jobId) || null,
        candidate: UserService.listByRole("candidate").find((candidate) => candidate.id === application.candidateId) || null,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  getAllApplications() {
    const state = ensureState();
    return state.applications.map((application) => ({
      ...application,
      job: state.jobs.find((job) => job.id === application.jobId) || null,
      candidate: UserService.listByRole("candidate").find((candidate) => candidate.id === application.candidateId) || null,
    }));
  },

  updateApplicationStatus(applicationId, companyId, status) {
    if (!APP_STATUS.has(status) || status === "Desistiu") throw new Error("Status de candidatura inválido.");
    return update((state) => {
      const application = state.applications.find((entry) => entry.id === applicationId);
      const job = state.jobs.find((entry) => entry.id === application?.jobId);
      if (!application || !job || job.companyId !== companyId) throw new Error("Candidatura não encontrada para esta empresa.");
      application.status = status;
      application.updatedAt = new Date().toISOString();
      application.history ||= [];
      application.history.push({ status, at: application.updatedAt, note: "Atualização demonstrativa pela empresa." });
      addNotification(state, application.candidateId, {
        title: "Atualização da candidatura",
        message: `O status da oportunidade “${job.title}” mudou para “${status}”. Atualização local de demonstração.`,
        targetView: "applications",
        linkId: application.id,
        type: "application",
      });
      return { ...application };
    });
  },

  withdrawApplication(applicationId, candidateId) {
    return update((state) => {
      const application = state.applications.find((entry) => entry.id === applicationId && entry.candidateId === candidateId);
      if (!application) throw new Error("Candidatura não encontrada.");
      application.status = "Desistiu";
      application.updatedAt = new Date().toISOString();
      application.history ||= [];
      application.history.push({ status: "Desistiu", at: application.updatedAt, note: "Candidatura encerrada pelo candidato neste navegador." });
      return { ...application };
    });
  },

  getCandidateNotifications(userId) {
    return ensureState().notifications
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((notification) => ({ ...notification }));
  },

  markNotificationRead(notificationId, userId) {
    return update((state) => {
      const notification = state.notifications.find((entry) => entry.id === notificationId && entry.userId === userId);
      if (!notification) return false;
      notification.read = true;
      notification.readAt = new Date().toISOString();
      return true;
    });
  },

  markAllNotificationsRead(userId) {
    return update((state) => {
      state.notifications.filter((notification) => notification.userId === userId).forEach((notification) => {
        notification.read = true;
        notification.readAt = new Date().toISOString();
      });
    });
  },

  getCandidateSettings(userId) {
    const settings = ensureState().preferences[userId];
    return { distanceMaxKm: 50, visibleToCompanies: true, notifyNewJobs: true, ...(settings || {}) };
  },

  saveCandidateSettings(userId, settings) {
    return update((state) => {
      state.preferences[userId] = {
        ...state.preferences[userId],
        distanceMaxKm: Math.min(500, Math.max(1, Number(settings.distanceMaxKm) || 50)),
        visibleToCompanies: Boolean(settings.visibleToCompanies),
        notifyNewJobs: Boolean(settings.notifyNewJobs),
        updatedAt: new Date().toISOString(),
      };
      return { ...state.preferences[userId] };
    });
  },

  getCourseProgress(userId) {
    const preferences = ensureState().preferences[userId] || {};
    return {
      planned: Array.isArray(preferences.plannedCourses) ? [...preferences.plannedCourses] : [],
      completed: Array.isArray(preferences.completedCourses) ? [...preferences.completedCourses] : [],
    };
  },

  setCourseProgress(userId, courseId, action) {
    return update((state) => {
      const preferences = state.preferences[userId] || { distanceMaxKm: 50, visibleToCompanies: true, notifyNewJobs: true };
      preferences.plannedCourses = Array.isArray(preferences.plannedCourses) ? preferences.plannedCourses : [];
      preferences.completedCourses = Array.isArray(preferences.completedCourses) ? preferences.completedCourses : [];
      const remove = (list) => { const index = list.indexOf(courseId); if (index >= 0) list.splice(index, 1); };
      if (action === "plan") {
        remove(preferences.completedCourses);
        if (!preferences.plannedCourses.includes(courseId)) preferences.plannedCourses.push(courseId);
      } else if (action === "complete") {
        remove(preferences.plannedCourses);
        if (!preferences.completedCourses.includes(courseId)) preferences.completedCourses.push(courseId);
      } else if (action === "reset") {
        remove(preferences.plannedCourses);
        remove(preferences.completedCourses);
      } else {
        throw new Error("Ação de curso inválida.");
      }
      state.preferences[userId] = preferences;
      return { planned: [...preferences.plannedCourses], completed: [...preferences.completedCourses] };
    });
  },

  getCandidateAds() {
    return ensureState().ads.filter((ad) => ad.active).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  getAds() {
    return ensureState().ads.map((ad) => ({ ...ad }));
  },

  saveAd(fields, adId = null) {
    return update((state) => {
      if (adId) {
        const ad = state.ads.find((entry) => entry.id === adId);
        if (!ad) throw new Error("Anúncio não encontrado.");
        Object.assign(ad, { title: String(fields.title).trim(), message: String(fields.message).trim(), active: Boolean(fields.active), updatedAt: new Date().toISOString() });
        return { ...ad };
      }
      const ad = { id: id("ad"), title: String(fields.title).trim(), message: String(fields.message).trim(), active: true, isDemo: true, createdAt: new Date().toISOString() };
      state.ads.unshift(ad);
      return { ...ad };
    });
  },

  setAdActive(adId, active) {
    return update((state) => {
      const ad = state.ads.find((entry) => entry.id === adId);
      if (!ad) throw new Error("Anúncio não encontrado.");
      ad.active = Boolean(active);
      ad.updatedAt = new Date().toISOString();
    });
  },

  deleteAd(adId) {
    return update((state) => { state.ads = state.ads.filter((ad) => ad.id !== adId); });
  },

  setCompanyVerified(companyId, verified) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId);
      if (!company) throw new Error("Empresa não encontrada.");
      company.verified = Boolean(verified);
      company.reviewedAt = new Date().toISOString();
      return { ...company };
    });
  },

  adminUpdateCompany(companyId, fields) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId);
      if (!company) throw new Error("Empresa não encontrada.");
      Object.assign(company, {
        name: String(fields.name ?? company.name).trim(),
        sector: String(fields.sector ?? company.sector).trim(),
        description: String(fields.description ?? company.description).trim(),
        city: String(fields.city ?? company.city).trim(),
        state: String(fields.state ?? company.state).trim().toUpperCase(),
        address: String(fields.address ?? company.address).trim(),
        website: String(fields.website ?? company.website).trim(),
        contactEmail: String(fields.contactEmail ?? company.contactEmail).trim().toLowerCase(),
        phone: String(fields.phone ?? company.phone).trim(),
        updatedAt: new Date().toISOString(),
      });
      return { ...company };
    });
  },

  setCompanyActive(companyId, active) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId);
      if (!company) throw new Error("Empresa não encontrada.");
      company.active = Boolean(active);
      company.reviewedAt = new Date().toISOString();
      return { ...company };
    });
  },

  createReport(user, fields) {
    return update((state) => {
      const report = {
        id: id("report"),
        userId: user.id,
        userName: user.nome,
        role: user.role,
        category: String(fields.category ?? "Dúvida"),
        description: String(fields.description ?? "").trim(),
        status: "Aberto",
        createdAt: new Date().toISOString(),
        isDemo: true,
      };
      state.reports.unshift(report);
      addNotification(state, user.id, {
        title: "Relato registrado",
        message: "Seu relato foi salvo localmente para a demonstração. Nenhuma equipe real recebeu o conteúdo.",
        targetView: "notifications",
        linkId: report.id,
        type: "report",
      });
      return { ...report };
    });
  },

  getReports() {
    return ensureState().reports.map((report) => ({ ...report }));
  },

  setReportStatus(reportId, status) {
    return update((state) => {
      const report = state.reports.find((entry) => entry.id === reportId);
      if (!report) throw new Error("Relato não encontrado.");
      report.status = status === "Resolvido" ? "Resolvido" : "Aberto";
      report.updatedAt = new Date().toISOString();
    });
  },

  removeUserData(userId) {
    return update((state) => {
      state.notifications = state.notifications.filter((notification) => notification.userId !== userId);
      state.applications = state.applications.filter((application) => application.candidateId !== userId);
      state.reports = state.reports.filter((report) => report.userId !== userId);
      delete state.preferences[userId];
    });
  },

  distanceEstimate(origin, destination) {
    if (!origin?.city || !origin?.state || !destination?.city || !destination?.state) return null;
    const from = CITY_COORDINATES[normalizedLocation(origin.city, origin.state)];
    const to = CITY_COORDINATES[normalizedLocation(destination.city, destination.state)];
    if (!from || !to) return null;
    const radians = (degrees) => degrees * Math.PI / 180;
    const [lat1, lon1] = from.map(radians);
    const [lat2, lon2] = to.map(radians);
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;
    const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  },
};
