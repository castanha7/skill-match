import { APP_CONFIG } from "../config/app.config.js";
import { StorageService } from "./storage.service.js";
import ApiService from "./api.service.js";
import { UserService } from "./user.service.js";

const { users: USERS_KEY, session: SESSION_KEY, seeded: SEEDED_KEY } = APP_CONFIG.storageKeys;

/**
 * AuthService — Autenticação e sessão
 * ------------------------------------------------------------
 * Etapa atual: valida as credenciais contra os usuários salvos
 * no localStorage (simulando o backend).
 * Futuro: os trechos marcados com [API] passarão a chamar:
 *   POST /api/auth/login   |   POST /api/auth/register
 * e a sessão passará a guardar o token JWT retornado.
 */

/**
 * ATENÇÃO — apenas para demonstração no frontend!
 * Este hash simples NÃO é seguro. Na integração, a senha será
 * criptografada no servidor com bcrypt e nunca trafegará em texto puro.
 */
function hashSenha(senha) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < senha.length; i++) {
    const ch = senha.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `sm$${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
}

function gerarId() {
  return `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Usuário de demonstração criado na primeira execução */
const DEMO_USER = {
  nome: "Mariana Costa",
  email: "demo@skillmatch.com",
  senha: "Skill@123",
  telefone: "(41) 98765-4321",
  dataNascimento: "2007-05-14",
  cidade: "Curitiba",
  estado: "PR",
  escolaridade: "Ensino Técnico (cursando)",
  curso: "Técnico em Desenvolvimento de Sistemas",
  instituicao: "Escola Técnica Estadual",
  areaInteresse: "Tecnologia da Informação",
  tiposVaga: ["Estágio", "Jovem Aprendiz"],
  disponibilidade: "Meio período — tarde",
  linkedin: "https://www.linkedin.com/in/exemplo",
  github: "https://github.com/exemplo",
  portfolio: "",
  resumo:
    "Estudante de Desenvolvimento de Sistemas em busca da primeira oportunidade na área de tecnologia. Tenho facilidade para aprender, gosto de trabalhar em equipe e já desenvolvi projetos escolares com HTML, CSS, JavaScript e banco de dados.",
  habilidades: ["HTML e CSS", "JavaScript", "Lógica de programação", "Trabalho em equipe", "Pacote Office", "Comunicação"],
};

export const AuthService = {
  /** Cria a conta demo na primeira vez que o sistema é aberto */
  seedDemoUser() {
    if (StorageService.get(SEEDED_KEY)) return;
    const users = StorageService.get(USERS_KEY, []);
    if (!users.some((u) => u.email === DEMO_USER.email)) {
      users.push(UserService.normalizeUser({ ...DEMO_USER, id: gerarId(), senhaHash: hashSenha(DEMO_USER.senha), criadoEm: new Date().toISOString() }));
      StorageService.set(USERS_KEY, users);
    }
    StorageService.set(SEEDED_KEY, true);
  },

  _getUsers() {
    return StorageService.get(USERS_KEY, []);
  },

  _saveUsers(users) {
    StorageService.set(USERS_KEY, users);
  },

  /** Verifica se já existe conta com o e-mail informado */
  emailJaCadastrado(email) {
    return this._getUsers().some((u) => u.email === email.trim().toLowerCase());
  },

  /**
   * Cadastra um novo candidato.
   * [API] POST /api/auth/register  →  { usuario, token }
   */
  async register(dados) {
    if (APP_CONFIG.useApi) {
      return ApiService.post("/auth/register", dados);
    }

    const email = dados.email.trim().toLowerCase();
    if (this.emailJaCadastrado(email)) {
      throw new Error("Este e-mail já está cadastrado. Tente fazer login.");
    }

    const novoUsuario = UserService.normalizeUser({
      ...dados,
      id: gerarId(),
      email,
      nome: dados.nome.trim(),
      senhaHash: hashSenha(dados.senha),
      criadoEm: new Date().toISOString(),
    });
    delete novoUsuario.senha;
    delete novoUsuario.confirmarSenha;

    const users = this._getUsers();
    users.push(novoUsuario);
    this._saveUsers(users);

    this._createSession(novoUsuario, true);
    return UserService.toPublicUser(novoUsuario);
  },

  /**
   * Autentica o candidato.
   * [API] POST /api/auth/login  →  { usuario, token }
   */
  async login(email, senha, lembrarMe = false) {
    if (APP_CONFIG.useApi) {
      const { usuario, token } = await ApiService.post("/auth/login", { email, senha });
      this._createSession(usuario, lembrarMe, token);
      return usuario;
    }

    const user = this._getUsers().find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.senhaHash !== hashSenha(senha)) {
      throw new Error("E-mail ou senha incorretos. Verifique os dados e tente novamente.");
    }

    this._createSession(user, lembrarMe);
    return UserService.toPublicUser(user);
  },

  _createSession(user, lembrarMe, token = null) {
    const session = {
      userId: user.id,
      email: user.email,
      nome: user.nome,
      token, // null no modo localStorage; receberá o JWT na integração
      lembrarMe,
      expiraEm: lembrarMe ? Date.now() + APP_CONFIG.sessionMaxAge : null,
    };
    // Sessão "lembrar-me" persiste ao fechar o navegador; a comum, só na aba/sessão
    if (lembrarMe) {
      StorageService.set(SESSION_KEY, session);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      StorageService.remove(SESSION_KEY);
    }
  },

  /** Retorna a sessão atual (ou null se inexistente/expirada) */
  getSession() {
    const session =
      StorageService.get(SESSION_KEY) || JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!session) return null;
    if (session.expiraEm && Date.now() > session.expiraEm) {
      this.logout();
      return null;
    }
    return session;
  },

  isAuthenticated() {
    return this.getSession() !== null;
  },

  logout() {
    StorageService.remove(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },

  /** Redireciona para o login se não houver sessão (proteção de rota) */
  requireAuth() {
    const session = this.getSession();
    if (!session) {
      window.location.replace("index.html?redirect=perfil");
      return null;
    }
    return session;
  },
};
