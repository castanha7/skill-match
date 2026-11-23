import { APP_CONFIG } from "../config/app.config.js";
import { StorageService } from "./storage.service.js";
import { UserService } from "./user.service.js";
import { isValidCnpj, normalizeCnpj } from "../../../shared/cnpj.js";

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
    salaryMin: 1200,
    salaryMax: 1800,
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
    salaryMin: 900,
    salaryMax: 1200,
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
    salaryMin: 1600,
    salaryMax: 2100,
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
    salaryMin: 850,
    salaryMax: 1100,
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
  version: 2,
  companies: [],
  jobs: [],
  applications: [],
  favorites: [],
  connections: [],
  messages: [],
  savedTalents: [],
  interviewHistory: [],
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

function connectionCompany(state, connection) {
  return state.companies.find((company) => company.id === connection.companyId) || null;
}

function isConnectionParticipant(state, connection, userId) {
  return Boolean(connection && (connection.candidateId === userId || connectionCompany(state, connection)?.ownerId === userId));
}

function appendConnectionMessage(state, connection, senderId, body) {
  const company = connectionCompany(state, connection);
  const recipientId = senderId === connection.candidateId ? company?.ownerId : connection.candidateId;
  if (!recipientId) throw new Error("Não há uma conta ativa para receber esta mensagem.");
  const message = {
    id: id("message"),
    connectionId: connection.id,
    senderId,
    recipientId,
    body: String(body).trim().slice(0, 2000),
    read: false,
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
  state.messages.push(message);
  addNotification(state, recipientId, {
    title: "Nova mensagem demonstrativa",
    message: `Você recebeu uma mensagem sobre uma conexão com ${company?.name || "uma empresa"}.`,
    targetView: "connections",
    type: "message",
    linkId: connection.id,
  });
  return { ...message };
}

function addUniqueJobNotification(state, candidateId, job) {
  const title = "Nova oportunidade demonstrativa";
  const message = `${job.title} foi aprovada para aparecer no catálogo de demonstração. Não é uma vaga real.`;
  const matches = state.notifications
    .filter((notification) => notification.userId === candidateId && notification.type === "job" && notification.linkId === job.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (matches.length) {
    const [existing, ...duplicates] = matches;
    Object.assign(existing, { title, message, targetView: "jobs", linkId: job.id });
    const duplicateNotifications = new Set(duplicates);
    if (duplicateNotifications.size) state.notifications = state.notifications.filter((notification) => !duplicateNotifications.has(notification));
    return;
  }
  addNotification(state, candidateId, { title, message, targetView: "jobs", linkId: job.id, type: "job" });
}

function ensureState() {
  const stored = StorageService.get(DATA_KEY);
  const state = stored && [1, 2].includes(stored.version) ? stored : EMPTY_STATE();
  const migrateLegacyConsent = Boolean(stored && stored.version === 1);
  for (const key of ["companies", "jobs", "applications", "favorites", "connections", "messages", "savedTalents", "interviewHistory", "notifications", "reports", "ads"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  let changed = !stored || stored.version !== 2;
  if (!state.preferences || typeof state.preferences !== "object") {
    state.preferences = {};
    changed = true;
  }
  if (migrateLegacyConsent) {
    Object.values(state.preferences).forEach((preference) => {
      if (preference && typeof preference === "object") preference.visibleToCompanies = false;
    });
    state.version = 2;
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
  const expectedDemoOwnerId = companyUser?.id || "";
  if (demoCompany && demoCompany.ownerId !== expectedDemoOwnerId) {
    demoCompany.ownerId = expectedDemoOwnerId;
    changed = true;
  }
  DEMO_JOBS.forEach((job) => {
    const existing = state.jobs.find((entry) => entry.id === job.id);
    if (!existing) {
      state.jobs.push(clone(job));
      changed = true;
    } else if (!Object.hasOwn(existing, "salaryMin") && !Object.hasOwn(existing, "salaryMax")) {
      existing.salaryMin = job.salaryMin ?? null;
      existing.salaryMax = job.salaryMax ?? null;
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
        state.preferences[user.id] = { distanceMaxKm: 50, visibleToCompanies: false, notifyNewJobs: true };
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

function normalizeSalary(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) throw new Error("Informe uma remuneração mensal válida entre R$ 0 e R$ 1.000.000.");
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function validateSalaryRange(minimum, maximum) {
  if ((minimum === null) !== (maximum === null)) throw new Error("Informe os dois valores da faixa salarial ou deixe ambos em branco.");
  if (minimum !== null && maximum < minimum) throw new Error("O valor máximo deve ser igual ou maior que o mínimo.");
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
  return `${clean}|${String(state ?? "").trim().toLowerCase()}`;
}

function normalizedAddress(value) {
  return String(value ?? "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const KNOWN_LOCATION_ENTRIES = Object.entries(CITY_COORDINATES)
  .map(([key, coordinates]) => {
    const [city, state] = key.split("|");
    return { city, state, coordinates };
  })
  .sort((a, b) => b.city.length - a.city.length);

function coordinatesFor(place) {
  if (!place) return null;
  const latitude = Number(place.latitude ?? place.lat);
  const longitude = Number(place.longitude ?? place.lng ?? place.lon);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
    return [latitude, longitude];
  }

  const source = typeof place === "string" ? { address: place } : place;
  const city = String(source.city ?? source.cidade ?? "").trim();
  const state = String(source.state ?? source.estado ?? source.uf ?? "").trim().toUpperCase();
  if (city && state) {
    const exact = CITY_COORDINATES[normalizedLocation(city, state)];
    if (exact) return exact;
  }

  const query = normalizedAddress(`${source.address ?? source.query ?? ""} ${city} ${state}`);
  if (!query) return null;
  const stateMatch = (state.match(/^[A-Z]{2}$/) ? state : query.match(/(?:^| )(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)$/)?.[1])?.toLowerCase();
  const paddedQuery = ` ${query} `;
  const matches = KNOWN_LOCATION_ENTRIES
    .filter((entry) => !stateMatch || stateMatch === entry.state)
    .map((entry) => ({ ...entry, index: paddedQuery.lastIndexOf(` ${entry.city} `) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => (b.index + b.city.length) - (a.index + a.city.length) || b.city.length - a.city.length);
  return matches[0]?.coordinates || null;
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

  cnpjJaCadastrado(value) {
    const cnpj = normalizeCnpj(value);
    return Boolean(cnpj) && ensureState().companies.some((company) => normalizeCnpj(company.cnpj) === cnpj);
  },

  createCompany(companyId, ownerId, fields) {
    return update((state) => {
      if (state.companies.some((entry) => entry.id === companyId || entry.ownerId === ownerId)) {
        throw new Error("Esta conta já possui um cadastro empresarial.");
      }
      const name = String(fields.name ?? "").trim();
      const cnpj = normalizeCnpj(fields.cnpj);
      const city = String(fields.city ?? "").trim();
      const region = String(fields.state ?? "").trim().toUpperCase();
      if (!name || !city || !/^[A-Z]{2}$/.test(region)) throw new Error("Informe nome, cidade e UF válidos para a empresa.");
      if (!isValidCnpj(cnpj)) throw new Error("Informe um CNPJ com dígitos verificadores válidos.");
      if (state.companies.some((entry) => normalizeCnpj(entry.cnpj) === cnpj)) throw new Error("Este CNPJ já está cadastrado neste navegador.");
      const company = {
        id: companyId,
        ownerId,
        name,
        cnpj,
        sector: String(fields.sector ?? "").trim(),
        description: String(fields.description ?? "").trim(),
        city,
        state: region,
        address: "",
        website: String(fields.website ?? "").trim(),
        contactEmail: String(fields.contactEmail ?? "").trim().toLowerCase(),
        phone: "",
        verified: false,
        active: true,
        isDemo: true,
        createdAt: new Date().toISOString(),
      };
      state.companies.push(company);
      return { ...company };
    });
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
      const salaryMin = normalizeSalary(fields.salaryMin);
      const salaryMax = normalizeSalary(fields.salaryMax);
      validateSalaryRange(salaryMin, salaryMax);
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
        salaryMin,
        salaryMax,
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
      const salaryMin = normalizeSalary(Object.hasOwn(fields, "salaryMin") ? fields.salaryMin : job.salaryMin);
      const salaryMax = normalizeSalary(Object.hasOwn(fields, "salaryMax") ? fields.salaryMax : job.salaryMax);
      validateSalaryRange(salaryMin, salaryMax);
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
        salaryMin,
        salaryMax,
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
      const wasPublished = job.approved === true && job.active !== false && job.removed !== true;
      job.approved = Boolean(approved);
      job.active = Boolean(approved);
      job.removed = false;
      job.reviewedAt = new Date().toISOString();
      if (approved && !wasPublished) {
        const candidates = UserService.listByRole("candidate");
        candidates.forEach((candidate) => {
          const settings = state.preferences[candidate.id] || { notifyNewJobs: true };
          if (settings.notifyNewJobs !== false) addUniqueJobNotification(state, candidate.id, job);
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

  isFavorite(candidateId, jobId) {
    return ensureState().favorites.some((favorite) => favorite.candidateId === candidateId && favorite.jobId === jobId);
  },

  getCandidateFavorites(candidateId) {
    const state = ensureState();
    return state.favorites
      .filter((favorite) => favorite.candidateId === candidateId)
      .map((favorite) => ({ ...favorite, job: state.jobs.find((job) => job.id === favorite.jobId) || null }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  toggleFavorite(candidateId, jobId) {
    return update((state) => {
      if (!UserService.listByRole("candidate").some((candidate) => candidate.id === candidateId)) throw new Error("Conta de candidato não encontrada.");
      if (!state.jobs.some((job) => job.id === jobId)) throw new Error("Esta vaga não está disponível para salvar.");
      const index = state.favorites.findIndex((favorite) => favorite.candidateId === candidateId && favorite.jobId === jobId);
      if (index >= 0) {
        state.favorites.splice(index, 1);
        return false;
      }
      state.favorites.push({ candidateId, jobId, createdAt: new Date().toISOString(), isDemo: true });
      return true;
    });
  },

  saveInterviewPractice(candidateId, practice) {
    return update((state) => {
      if (!UserService.listByRole("candidate").some((candidate) => candidate.id === candidateId)) throw new Error("Conta de candidato não encontrada.");
      const question = String(practice.question ?? "").trim().slice(0, 500);
      const answer = String(practice.answer ?? "").trim().slice(0, 2000);
      if (!question || answer.length < 10) throw new Error("Escreva uma resposta com pelo menos 10 caracteres.");
      const entry = {
        id: id("interview"),
        candidateId,
        jobType: String(practice.jobType ?? "").trim().slice(0, 80),
        experienceLevel: String(practice.experienceLevel ?? "").trim().slice(0, 80),
        targetRole: String(practice.targetRole ?? "").trim().slice(0, 120),
        questionId: String(practice.questionId ?? "").trim().slice(0, 80),
        question,
        answer,
        feedback: clone(practice.feedback || {}),
        createdAt: new Date().toISOString(),
        provider: "guided-demo",
        isDemo: true,
      };
      state.interviewHistory.unshift(entry);
      const retainedIds = new Set(state.interviewHistory.filter((item) => item.candidateId === candidateId).slice(0, 30).map((item) => item.id));
      state.interviewHistory = state.interviewHistory.filter((item) => item.candidateId !== candidateId || retainedIds.has(item.id));
      return clone(entry);
    });
  },

  getInterviewHistory(candidateId) {
    return ensureState().interviewHistory
      .filter((entry) => entry.candidateId === candidateId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((entry) => clone(entry));
  },

  deleteInterviewPractice(interviewId, candidateId) {
    return update((state) => {
      const before = state.interviewHistory.length;
      state.interviewHistory = state.interviewHistory.filter((entry) => !(entry.id === interviewId && entry.candidateId === candidateId));
      return state.interviewHistory.length !== before;
    });
  },

  getCandidateConnections(candidateId) {
    const state = ensureState();
    return state.connections
      .filter((connection) => connection.candidateId === candidateId)
      .map((connection) => ({
        ...connection,
        company: connectionCompany(state, connection),
        messages: state.messages.filter((message) => message.connectionId === connection.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map((message) => ({ ...message })),
      }))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  },

  getCompanyConnections(companyId) {
    const state = ensureState();
    return state.connections
      .filter((connection) => connection.companyId === companyId)
      .map((connection) => ({
        ...connection,
        company: connectionCompany(state, connection),
        candidate: UserService.listByRole("candidate").find((candidate) => candidate.id === connection.candidateId) || null,
        messages: state.messages.filter((message) => message.connectionId === connection.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map((message) => ({ ...message })),
      }))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  },

  getConnection(connectionId) {
    const state = ensureState();
    const connection = state.connections.find((entry) => entry.id === connectionId);
    return connection ? { ...connection, company: connectionCompany(state, connection) } : null;
  },

  startCandidateConnection(companyId, candidateId, presentation) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId && entry.active !== false && entry.ownerId);
      const candidate = UserService.listByRole("candidate").find((entry) => entry.id === candidateId && entry.status === "active");
      const body = String(presentation ?? "").trim();
      if (!company || !candidate) throw new Error("Empresa ou conta de candidato indisponível.");
      if (body.length < 10 || body.length > 1200) throw new Error("Escreva uma apresentação entre 10 e 1.200 caracteres.");
      const existing = state.connections.find((entry) => entry.companyId === companyId && entry.candidateId === candidateId);
      if (existing) {
        if (existing.status === "connected") throw new Error("Esta conexão já está aberta.");
        if (existing.status === "pending") throw new Error("Responda ao convite pendente antes de iniciar outra conexão.");
        throw new Error("Esta conexão está encerrada ou bloqueada.");
      }
      const now = new Date().toISOString();
      const connection = { id: id("connection"), companyId, candidateId, initiatedBy: "candidate", status: "connected", createdAt: now, updatedAt: now, acceptedAt: now, isDemo: true };
      state.connections.unshift(connection);
      appendConnectionMessage(state, connection, candidateId, body);
      return { ...connection };
    });
  },

  inviteCandidate(companyId, ownerId, candidateId, invitationMessage) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId && entry.ownerId === ownerId && entry.active !== false);
      const candidate = UserService.listByRole("candidate").find((entry) => entry.id === candidateId && entry.status === "active");
      const preference = state.preferences[candidateId] || {};
      const note = String(invitationMessage ?? "").trim();
      if (!company || !candidate) throw new Error("Conta empresarial ou perfil de candidato indisponível.");
      if (preference.visibleToCompanies !== true) throw new Error("Este candidato não autorizou aparecer no banco de talentos.");
      if (note.length < 10 || note.length > 1200) throw new Error("Escreva um convite entre 10 e 1.200 caracteres.");
      if (state.connections.some((entry) => entry.companyId === companyId && entry.candidateId === candidateId)) throw new Error("Já existe uma conexão ou convite para este perfil.");
      const now = new Date().toISOString();
      const connection = {
        id: id("connection"), companyId, candidateId, initiatedBy: "company", status: "pending",
        invitationMessage: note, createdAt: now, updatedAt: now, isDemo: true,
      };
      state.connections.unshift(connection);
      addNotification(state, candidateId, {
        title: "Convite de empresa demonstrativo",
        message: `${company.name} enviou um convite. Aceite antes de abrir uma conversa; você pode recusar sem compartilhar contato.`,
        targetView: "connections", type: "connection", linkId: connection.id,
      });
      return { ...connection };
    });
  },

  respondToConnection(connectionId, candidateId, accept) {
    return update((state) => {
      const connection = state.connections.find((entry) => entry.id === connectionId && entry.candidateId === candidateId);
      if (!connection || connection.status !== "pending" || connection.initiatedBy !== "company") throw new Error("Este convite não está mais disponível.");
      connection.status = accept ? "connected" : "declined";
      connection.updatedAt = new Date().toISOString();
      if (accept) connection.acceptedAt = connection.updatedAt;
      const company = connectionCompany(state, connection);
      addNotification(state, company?.ownerId, {
        title: accept ? "Convite aceito" : "Convite recusado",
        message: `${UserService.listByRole("candidate").find((candidate) => candidate.id === candidateId)?.nome || "O candidato"} ${accept ? "aceitou" : "recusou"} o convite de conexão.`,
        targetView: "company-connections", type: "connection", linkId: connection.id,
      });
      return { ...connection };
    });
  },

  getConnectionMessages(connectionId, userId) {
    const state = ensureState();
    const connection = state.connections.find((entry) => entry.id === connectionId);
    if (!connection || !isConnectionParticipant(state, connection, userId)) throw new Error("Conversa não encontrada para esta conta.");
    return state.messages
      .filter((message) => message.connectionId === connectionId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map((message) => ({ ...message }));
  },

  sendConnectionMessage(connectionId, senderId, text) {
    return update((state) => {
      const connection = state.connections.find((entry) => entry.id === connectionId);
      const body = String(text ?? "").trim();
      if (!connection || !isConnectionParticipant(state, connection, senderId)) throw new Error("Conversa não encontrada para esta conta.");
      if (connection.status !== "connected") throw new Error("Só é possível conversar após a conexão ser aceita.");
      if (body.length < 1 || body.length > 2000) throw new Error("A mensagem deve ter entre 1 e 2.000 caracteres.");
      const message = appendConnectionMessage(state, connection, senderId, body);
      connection.updatedAt = message.createdAt;
      return message;
    });
  },

  markConnectionMessagesRead(connectionId, userId) {
    return update((state) => {
      const connection = state.connections.find((entry) => entry.id === connectionId);
      if (!connection || !isConnectionParticipant(state, connection, userId)) throw new Error("Conversa não encontrada para esta conta.");
      state.messages.filter((message) => message.connectionId === connectionId && message.recipientId === userId && !message.read)
        .forEach((message) => { message.read = true; message.readAt = new Date().toISOString(); });
    });
  },

  getUnreadMessageCount(userId) {
    return ensureState().messages.filter((message) => message.recipientId === userId && !message.read).length;
  },

  blockConnection(connectionId, userId) {
    return update((state) => {
      const connection = state.connections.find((entry) => entry.id === connectionId);
      if (!connection || !isConnectionParticipant(state, connection, userId)) throw new Error("Conversa não encontrada para esta conta.");
      if (connection.status === "blocked") return { ...connection };
      connection.status = "blocked";
      connection.blockedBy = userId;
      connection.updatedAt = new Date().toISOString();
      const other = userId === connection.candidateId ? connectionCompany(state, connection)?.ownerId : connection.candidateId;
      addNotification(state, other, { title: "Conexão encerrada", message: "A outra parte encerrou esta conexão demonstrativa.", targetView: "connections", type: "connection", linkId: connection.id });
      return { ...connection };
    });
  },

  hasCandidateAppliedToCompany(companyId, candidateId) {
    const state = ensureState();
    const companyJobIds = new Set(state.jobs.filter((job) => job.companyId === companyId).map((job) => job.id));
    return state.applications.some((application) => application.candidateId === candidateId && companyJobIds.has(application.jobId));
  },

  canCompanyViewCandidate(companyId, candidateId) {
    const state = ensureState();
    const preference = state.preferences[candidateId] || {};
    const connection = state.connections.find((entry) => entry.companyId === companyId && entry.candidateId === candidateId);
    if (connection?.status === "blocked") return false;
    return preference.visibleToCompanies === true
      || this.hasCandidateAppliedToCompany(companyId, candidateId)
      || connection?.status === "connected";
  },

  canCompanyViewContact(companyId, candidateId) {
    const state = ensureState();
    if (state.preferences[candidateId]?.visibleToCompanies !== true) return false;
    const connection = state.connections.find((entry) => entry.companyId === companyId && entry.candidateId === candidateId);
    if (connection?.status === "blocked") return false;
    return connection?.status === "connected" || this.hasCandidateAppliedToCompany(companyId, candidateId);
  },

  isTalentSaved(companyId, candidateId) {
    return ensureState().savedTalents.some((entry) => entry.companyId === companyId && entry.candidateId === candidateId);
  },

  getSavedTalentIds(companyId) {
    return ensureState().savedTalents.filter((entry) => entry.companyId === companyId).map((entry) => entry.candidateId);
  },

  toggleSavedTalent(companyId, ownerId, candidateId) {
    return update((state) => {
      const company = state.companies.find((entry) => entry.id === companyId && entry.ownerId === ownerId);
      if (!company) throw new Error("Esta conta não pode gerenciar a lista de talentos.");
      const index = state.savedTalents.findIndex((entry) => entry.companyId === companyId && entry.candidateId === candidateId);
      if (index >= 0) {
        state.savedTalents.splice(index, 1);
        return false;
      }
      const candidate = UserService.listByRole("candidate").find((entry) => entry.id === candidateId && entry.status === "active");
      if (!candidate || state.preferences[candidateId]?.visibleToCompanies !== true) throw new Error("Este perfil não está disponível no banco de talentos sem consentimento explícito.");
      state.savedTalents.push({ companyId, candidateId, createdAt: new Date().toISOString(), isDemo: true });
      return true;
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
    const notifications = ensureState().notifications
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const seenJobs = new Set();
    return notifications.filter((notification) => {
      if (notification.type !== "job" || !notification.linkId) return true;
      if (seenJobs.has(notification.linkId)) return false;
      seenJobs.add(notification.linkId);
      return true;
    }).map((notification) => ({ ...notification }));
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
    return { distanceMaxKm: 50, visibleToCompanies: false, notifyNewJobs: true, radarAddress: "", radarCity: "", radarState: "", radarNeighborhood: "", radarType: "", radarArea: "", radarModality: "", ...(settings || {}) };
  },

  saveCandidateSettings(userId, settings) {
    return update((state) => {
      state.preferences[userId] = {
        ...state.preferences[userId],
        distanceMaxKm: Math.min(500, Math.max(1, Number(settings.distanceMaxKm) || 50)),
        visibleToCompanies: Boolean(settings.visibleToCompanies),
        notifyNewJobs: Boolean(settings.notifyNewJobs),
        radarAddress: String(settings.radarAddress ?? state.preferences[userId]?.radarAddress ?? "").trim().slice(0, 180),
        radarCity: String(settings.radarCity ?? state.preferences[userId]?.radarCity ?? "").trim().slice(0, 120),
        radarState: String(settings.radarState ?? state.preferences[userId]?.radarState ?? "").trim().toUpperCase().slice(0, 2),
        radarNeighborhood: String(settings.radarNeighborhood ?? state.preferences[userId]?.radarNeighborhood ?? "").trim().slice(0, 120),
        radarType: String(settings.radarType ?? state.preferences[userId]?.radarType ?? "").trim().slice(0, 80),
        radarArea: String(settings.radarArea ?? state.preferences[userId]?.radarArea ?? "").trim().slice(0, 100),
        radarModality: String(settings.radarModality ?? state.preferences[userId]?.radarModality ?? "").trim().slice(0, 40),
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
      const preferences = state.preferences[userId] || { distanceMaxKm: 50, visibleToCompanies: false, notifyNewJobs: true };
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
        connectionId: String(fields.connectionId ?? "").trim() || null,
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
      const ownedCompanyIds = new Set(state.companies.filter((company) => company.ownerId === userId).map((company) => company.id));
      const seededJobIds = new Set(DEMO_JOBS.map((job) => job.id));
      const removedJobIds = new Set(state.jobs
        .filter((job) => ownedCompanyIds.has(job.companyId) && !seededJobIds.has(job.id))
        .map((job) => job.id));
      const removedConnections = new Set(state.connections
        .filter((connection) => connection.candidateId === userId || ownedCompanyIds.has(connection.companyId))
        .map((connection) => connection.id));
      state.notifications = state.notifications.filter((notification) => notification.userId !== userId && !removedJobIds.has(notification.linkId));
      state.applications = state.applications.filter((application) => application.candidateId !== userId && !removedJobIds.has(application.jobId));
      state.favorites = state.favorites.filter((favorite) => favorite.candidateId !== userId && !removedJobIds.has(favorite.jobId));
      state.connections = state.connections.filter((connection) => !removedConnections.has(connection.id));
      state.messages = state.messages.filter((message) => !removedConnections.has(message.connectionId) && message.senderId !== userId && message.recipientId !== userId);
      state.savedTalents = state.savedTalents.filter((entry) => entry.candidateId !== userId && !ownedCompanyIds.has(entry.companyId));
      state.interviewHistory = state.interviewHistory.filter((entry) => entry.candidateId !== userId);
      state.reports = state.reports.filter((report) => report.userId !== userId);
      state.jobs = state.jobs.filter((job) => !removedJobIds.has(job.id));
      state.companies = state.companies.filter((company) => !ownedCompanyIds.has(company.id) || company.id === "company-demo");
      delete state.preferences[userId];
    });
  },

  hasLocationCoordinates(place) {
    return coordinatesFor(place) !== null;
  },

  distanceEstimate(origin, destination) {
    const from = coordinatesFor(origin);
    const to = coordinatesFor(destination);
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
