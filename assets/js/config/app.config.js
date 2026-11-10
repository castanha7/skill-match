/**
 * SkillMatch — Configuração global da aplicação
 * ------------------------------------------------------------
 * FUTURA INTEGRAÇÃO COM BACKEND (Node.js + Express + MySQL):
 * quando a API estiver pronta, basta:
 *   1. Alterar `useApi` para `true`;
 *   2. Ajustar `apiBaseUrl` para o endereço do servidor.
 * Nenhuma tela precisará ser reescrita, pois todas as páginas
 * consomem apenas os serviços (auth.service / user.service).
 */
export const APP_CONFIG = {
  appName: "SkillMatch",
  slogan: "Suas habilidades. Sua oportunidade.",

  /** true = chama a API REST | false = usa localStorage (etapa atual) */
  useApi: false,

  /** Endereço base da futura API Express (ver docs/INTEGRACAO-BACKEND.md) */
  apiBaseUrl: "http://localhost:3000/api",

  /** Chaves utilizadas no localStorage (prefixadas para não colidir) */
  storageKeys: {
    users: "skillmatch:users",
    session: "skillmatch:session",
    seeded: "skillmatch:seeded",
  },

  /** Tempo de sessão "lembrar-me" (7 dias) em milissegundos */
  sessionMaxAge: 7 * 24 * 60 * 60 * 1000,
};

/** Catálogos usados nos formulários (futuramente virão de tabelas do MySQL) */
export const CATALOGS = {
  estados: [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
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
