const document = globalThis.document;
const explicitApiBase = String(
  globalThis.SKILLMATCH_CONFIG?.apiBaseUrl
  || document?.querySelector('meta[name="skillmatch-api-base"]')?.content
  || '',
).trim().replace(/\/$/, '');

function isSafeApiBase(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (url.protocol === "http:" && localHost))
      && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}

const explicitApiIsValid = isSafeApiBase(explicitApiBase);
const pageOrigin = String(document?.location?.origin || '').replace(/\/$/, '');
const configuredApiBase = explicitApiBase
  ? (explicitApiIsValid ? explicitApiBase : '')
  : (isSafeApiBase(pageOrigin) ? pageOrigin : '');
let selectedDemo = false;
try { selectedDemo = globalThis.sessionStorage?.getItem('skillmatch:demo-mode') === 'true'; } catch { /* Storage pode estar indisponível. */ }
const demoMode = globalThis.SKILLMATCH_CONFIG?.mode === 'demo' || selectedDemo;

/**
 * A API é o modo padrão. O frontend não persiste dados de produto no navegador:
 * somente uma configuração explícita de teste (SKILLMATCH_CONFIG.mode = "demo")
 * ativa os fixtures locais. Segredos Supabase ficam exclusivamente no backend.
 */
export const APP_CONFIG = {
  appName: "SkillMatch",
  slogan: "Suas habilidades. Sua oportunidade.",
  demoMode,
  useApi: !demoMode,
  apiBaseUrl: configuredApiBase,
  storageKeys: {
    users: "skillmatch:users",
    session: demoMode ? "skillmatch:demo-session" : "skillmatch:session",
    seeded: "skillmatch:seeded",
    platform: "skillmatch:platform",
    passwordReset: "skillmatch:demo-password-reset",
  },
  sessionMaxAge: 7 * 24 * 60 * 60 * 1000,
};

/** Catálogos usados pelos formulários demonstrativos e pelos formulários autenticados. */
export const CATALOGS = {
  estados: [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ],
  escolaridades: [
    "Ensino Fundamental (cursando)",
    "Ensino Fundamental (concluído)",
    "Ensino Médio (cursando)",
    "Ensino Médio (concluído)",
    "Ensino Técnico (cursando)",
    "Ensino Técnico (concluído)",
    "Ensino Superior (cursando)",
    "Ensino Superior (concluído)",
  ],
  areasInteresse: [
    "Tecnologia da Informação",
    "Administração",
    "Comércio e Vendas",
    "Atendimento ao Cliente",
    "Logística",
    "Saúde",
    "Educação",
    "Indústria e Produção",
    "Marketing e Comunicação",
    "Finanças",
    "Recursos Humanos",
    "Design",
    "Outra",
  ],
  tiposVaga: ["Jovem Aprendiz", "Estágio", "Primeiro Emprego", "Trainee"],
  modalidades: ["Presencial", "Híbrido", "Remoto"],
  disponibilidades: [
    "Meio período — manhã",
    "Meio período — tarde",
    "Meio período — noite",
    "Período integral",
    "Finais de semana",
    "Horário flexível",
  ],
  habilidadesSugeridas: [
    "Pacote Office", "Excel", "Informática básica", "Digitação",
    "Atendimento ao cliente", "Comunicação", "Trabalho em equipe",
    "Organização", "Pontualidade", "Inglês básico", "Redes sociais",
    "Canva", "HTML e CSS", "JavaScript", "Python", "Lógica de programação",
    "Banco de dados", "Vendas", "Caixa e pagamentos", "Estoque e logística",
  ],
};

export const DEMO_CREDENTIALS = [
  { role: "candidate", label: "Candidato", email: "demo@skillmatch.com", password: "Skill@123" },
  { role: "company", label: "Empresa", email: "empresa@skillmatch.com", password: "Skill@123" },
  { role: "admin", label: "Administração", email: "admin@skillmatch.com", password: "Admin@123" },
];

export const USER_ROLES = {
  candidate: "Candidato",
  company: "Empresa",
  admin: "Administração",
};
