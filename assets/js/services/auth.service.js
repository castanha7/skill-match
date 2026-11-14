import { APP_CONFIG, DEMO_CREDENTIALS } from "../config/app.config.js";
import { StorageService } from "./storage.service.js";
import ApiService from "./api.service.js";
import { UserService } from "./user.service.js";

const { users: USERS_KEY, session: SESSION_KEY, seeded: SEEDED_KEY, passwordReset: RESET_KEY } = APP_CONFIG.storageKeys;
const PBKDF2_ITERATIONS = 180_000;
const DEMO_COMPANY_ID = "company-demo";

/**
 * Demo records are intentionally fictional. Their credentials are public so
 * visitors can explore the prototype; this is not a production auth system.
 */
const DEMO_USERS = [
  {
    role: "candidate",
    email: DEMO_CREDENTIALS[0].email,
    password: DEMO_CREDENTIALS[0].password,
    data: {
      id: "usr-demo-candidate",
      nome: "Mariana Costa",
      telefone: "(41) 98765-4321",
      dataNascimento: "2007-05-14",
      cidade: "Curitiba",
      estado: "PR",
      escolaridade: "Ensino Técnico (cursando)",
      curso: "Técnico em Desenvolvimento de Sistemas",
      instituicao: "Escola Técnica Estadual — dado demonstrativo",
      areaInteresse: "Tecnologia da Informação",
      tiposVaga: ["Estágio", "Jovem Aprendiz"],
      disponibilidade: "Meio período — tarde",
      linkedin: "",
      github: "",
      portfolio: "",
      resumo: "Estudante de Desenvolvimento de Sistemas em busca da primeira oportunidade na área de tecnologia. Tenho facilidade para aprender, gosto de trabalhar em equipe e desenvolvi projetos escolares com HTML, CSS, JavaScript e banco de dados.",
      habilidades: ["HTML e CSS", "JavaScript", "Lógica de programação", "Trabalho em equipe", "Pacote Office", "Comunicação"],
      cursos: ["Trilha demonstrativa de fundamentos web (não representa certificado)"],
      experiencias: ["Projetos acadêmicos: páginas web e exercícios de lógica de programação"],
    },
  },
  {
    role: "company",
    email: DEMO_CREDENTIALS[1].email,
    password: DEMO_CREDENTIALS[1].password,
    data: {
      id: "usr-demo-company",
      nome: "Equipe demonstrativa",
      companyId: DEMO_COMPANY_ID,
    },
  },
  {
    role: "admin",
    email: DEMO_CREDENTIALS[2].email,
    password: DEMO_CREDENTIALS[2].password,
    data: {
      id: "usr-demo-admin",
      nome: "Administração demonstrativa",
    },
  },
];

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return globalThis.btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(globalThis.atob(value), (character) => character.charCodeAt(0));
}

function cryptoApi() {
  const api = globalThis.crypto;
  if (!api?.subtle || !api?.getRandomValues) {
    throw new Error("A demonstração de autenticação exige um navegador moderno em HTTPS ou localhost.");
  }
  return api;
}

/** Hash local de demonstração com PBKDF2 e salt aleatório; não substitui bcrypt no servidor. */
async function hashPassword(password) {
  const api = cryptoApi();
  const salt = api.getRandomValues(new Uint8Array(16));
  const key = await api.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await api.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

function legacyHash(password) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < password.length; i++) {
    const ch = password.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `sm$${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return { valid: false, upgradedHash: null };
  if (storedHash.startsWith("sm$")) {
    const valid = legacyHash(password) === storedHash;
    return { valid, upgradedHash: valid ? await hashPassword(password) : null };
  }
  const [, iterationsText, saltText, expectedText] = storedHash.split("$");
  const iterations = Number(iterationsText);
  if (!iterations || !saltText || !expectedText) return { valid: false, upgradedHash: null };
  const api = cryptoApi();
  const key = await api.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await api.subtle.deriveBits(
    { name: "PBKDF2", salt: base64ToBytes(saltText), iterations, hash: "SHA-256" },
    key,
    256,
  );
  const actual = new Uint8Array(bits);
  const expected = base64ToBytes(expectedText);
  if (actual.length !== expected.length) return { valid: false, upgradedHash: null };
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index];
  return { valid: difference === 0, upgradedHash: null };
}

function makeId(prefix = "usr") {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomPart}`;
}

function allUsers() {
  const users = StorageService.get(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  if (!StorageService.set(USERS_KEY, users)) {
    throw new Error("Não foi possível salvar os dados neste navegador. Verifique o armazenamento local e tente novamente.");
  }
}

function getStoredSession() {
  return StorageService.get(SESSION_KEY) || StorageService.getSessionValue(SESSION_KEY);
}

export const AuthService = {
  /** Garante que as três contas públicas de demonstração existam localmente. */
  async seedDemoUser() {
    const users = allUsers();
    const shouldSeedMissingAccounts = Number(StorageService.get(SEEDED_KEY, 0)) < 2;
    let changed = false;
    for (const demo of DEMO_USERS) {
      const email = demo.email.toLowerCase();
      let user = users.find((entry) => entry.email?.toLowerCase() === email);
      if (!user) {
        if (!shouldSeedMissingAccounts) continue;
        user = UserService.normalizeUser({
          ...demo.data,
          email,
          role: demo.role,
          status: "active",
          senhaHash: await hashPassword(demo.password),
          criadoEm: new Date().toISOString(),
          isDemoAccount: true,
        });
        users.push(user);
        changed = true;
      } else {
        const role = user.role || demo.role;
        const normalized = UserService.normalizeUser({ ...user, role, status: user.status || "active" });
        if (!user.senhaHash) normalized.senhaHash = await hashPassword(demo.password);
        if (role !== user.role || !user.senhaHash || !user.status || !user.isDemoAccount) changed = true;
        Object.assign(user, normalized, { isDemoAccount: true });
      }
    }
    if (changed) saveUsers(users);
    StorageService.set(SEEDED_KEY, 2);
  },

  _getUsers() {
    return allUsers();
  },

  _saveUsers(users) {
    saveUsers(users);
  },

  emailJaCadastrado(email) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    return allUsers().some((user) => user.email?.toLowerCase() === normalizedEmail);
  },

  async register(dados) {
    if (APP_CONFIG.useApi) {
      const { usuario, token } = await ApiService.post("/auth/register", dados);
      this._createSession(usuario, true, token);
      return UserService.toPublicUser(usuario);
    }

    const email = String(dados.email ?? "").trim().toLowerCase();
    if (this.emailJaCadastrado(email)) throw new Error("Este e-mail já está cadastrado. Tente fazer login.");

    const { senha, confirmarSenha, ...profileData } = dados;
    const novoUsuario = UserService.normalizeUser({
      ...profileData,
      id: makeId(),
      email,
      role: "candidate",
      status: "active",
      senhaHash: await hashPassword(senha),
      criadoEm: new Date().toISOString(),
      termosAceitosEm: new Date().toISOString(),
    });
    const users = allUsers();
    users.push(novoUsuario);
    saveUsers(users);
    this._createSession(novoUsuario, true);
    return UserService.toPublicUser(novoUsuario);
  },

  async login(email, senha, lembrarMe = false, expectedRole = "candidate") {
    if (APP_CONFIG.useApi) {
      const { usuario, token } = await ApiService.post("/auth/login", { email, senha, role: expectedRole });
      this._createSession(usuario, lembrarMe, token);
      return usuario;
    }

    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const users = allUsers();
    const index = users.findIndex((user) => user.email?.toLowerCase() === normalizedEmail);
    const user = users[index];
    if (!user) throw new Error("E-mail ou senha incorretos. Verifique os dados e tente novamente.");

    const { valid, upgradedHash } = await verifyPassword(String(senha ?? ""), user.senhaHash);
    if (!valid) throw new Error("E-mail ou senha incorretos. Verifique os dados e tente novamente.");
    if (user.status === "blocked") throw new Error("Esta conta está temporariamente bloqueada. Entre em contato com a administração.");
    if (expectedRole && user.role !== expectedRole) {
      const roleLabel = { candidate: "candidato", company: "empresa", admin: "administração" }[user.role] || "outro tipo de acesso";
      throw new Error(`Esta conta pertence à área de ${roleLabel}. Selecione o tipo de acesso correto.`);
    }
    if (upgradedHash) {
      users[index] = { ...user, senhaHash: upgradedHash };
      saveUsers(users);
    }

    this._createSession(user, lembrarMe);
    return UserService.toPublicUser(user);
  },

  _createSession(user, lembrarMe, token = null) {
    const session = {
      userId: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role || "candidate",
      companyId: user.companyId || null,
      token,
      lembrarMe: Boolean(lembrarMe),
      expiraEm: lembrarMe ? Date.now() + APP_CONFIG.sessionMaxAge : null,
    };
    if (lembrarMe) {
      if (!StorageService.set(SESSION_KEY, session)) throw new Error("Não foi possível manter a sessão neste navegador.");
      StorageService.removeSessionValue(SESSION_KEY);
    } else {
      if (!StorageService.setSessionValue(SESSION_KEY, session)) throw new Error("Não foi possível iniciar a sessão neste navegador.");
      StorageService.remove(SESSION_KEY);
    }
  },

  getSession() {
    const session = getStoredSession();
    if (!session) return null;
    if (session.expiraEm && Date.now() > session.expiraEm) {
      this.logout();
      return null;
    }
    if (!session.role) {
      const user = allUsers().find((entry) => entry.id === session.userId);
      session.role = user?.role || "candidate";
      session.companyId = user?.companyId || null;
      this._persistSession(session);
    }
    return session;
  },

  _persistSession(session) {
    if (session.lembrarMe) StorageService.set(SESSION_KEY, session);
    else StorageService.setSessionValue(SESSION_KEY, session);
  },

  updateSessionProfile(user) {
    const session = this.getSession();
    if (!session || session.userId !== user.id) return;
    session.nome = user.nome;
    session.email = user.email;
    session.role = user.role || session.role;
    this._persistSession(session);
  },

  isAuthenticated() {
    return this.getSession() !== null;
  },

  logout() {
    StorageService.remove(SESSION_KEY);
    StorageService.removeSessionValue(SESSION_KEY);
  },

  requireAuth(allowedRoles = null) {
    const session = this.getSession();
    if (!session) {
      const path = window.location.pathname.split("/").pop() || "painel";
      window.location.replace(`index.html?redirect=${encodeURIComponent(path.replace(/\.html$/, ""))}`);
      return null;
    }
    if (allowedRoles) {
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      if (!roles.includes(session.role)) {
        window.location.replace("painel.html");
        return null;
      }
    }
    return session;
  },

  async changePassword(userId, currentPassword, newPassword, token = null) {
    if (APP_CONFIG.useApi) return ApiService.put("/auth/password", { currentPassword, newPassword }, token);
    const users = allUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index === -1) throw new Error("Conta não encontrada.");
    const { valid } = await verifyPassword(currentPassword, users[index].senhaHash);
    if (!valid) throw new Error("A senha atual não confere.");
    users[index] = { ...users[index], senhaHash: await hashPassword(newPassword), atualizadoEm: new Date().toISOString() };
    saveUsers(users);
  },

  requestPasswordResetDemo(email) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!allUsers().some((user) => user.email?.toLowerCase() === normalizedEmail)) return null;
    const code = String(cryptoApi().getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const reset = { email: normalizedEmail, code, expiresAt: Date.now() + 15 * 60 * 1000 };
    if (!StorageService.setSessionValue(RESET_KEY, reset)) throw new Error("Não foi possível iniciar a recuperação demonstrativa.");
    return code;
  },

  async completePasswordResetDemo(email, code, newPassword) {
    const reset = StorageService.getSessionValue(RESET_KEY);
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!reset || reset.email !== normalizedEmail || reset.code !== String(code).trim() || Date.now() > reset.expiresAt) {
      throw new Error("Código inválido ou expirado. Gere um novo código demonstrativo.");
    }
    const users = allUsers();
    const index = users.findIndex((user) => user.email?.toLowerCase() === normalizedEmail);
    if (index === -1) throw new Error("A conta não foi encontrada.");
    users[index] = { ...users[index], senhaHash: await hashPassword(newPassword), atualizadoEm: new Date().toISOString() };
    saveUsers(users);
    StorageService.removeSessionValue(RESET_KEY);
  },
};
