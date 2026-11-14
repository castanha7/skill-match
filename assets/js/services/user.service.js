import { APP_CONFIG } from "../config/app.config.js";
import { StorageService } from "./storage.service.js";
import ApiService from "./api.service.js";
import { Validators } from "../utils/validators.js";

const { users: USERS_KEY } = APP_CONFIG.storageKeys;
const PROFILE_FIELDS = [
  "nome", "telefone", "dataNascimento", "cidade", "estado", "escolaridade", "curso",
  "instituicao", "areaInteresse", "tiposVaga", "disponibilidade", "resumo", "habilidades",
  "linkedin", "github", "portfolio", "fotoDataUrl", "cursos", "experiencias",
];

const COMPLETENESS_FIELDS = [
  { key: "nome", label: "Nome completo" },
  { key: "email", label: "E-mail" },
  { key: "telefone", label: "Telefone / WhatsApp" },
  { key: "dataNascimento", label: "Data de nascimento" },
  { key: "cidade", label: "Cidade e estado" },
  { key: "escolaridade", label: "Escolaridade" },
  { key: "curso", label: "Curso atual" },
  { key: "areaInteresse", label: "Área de interesse" },
  { key: "tiposVaga", label: "Tipos de vaga de interesse" },
  { key: "disponibilidade", label: "Disponibilidade" },
  { key: "resumo", label: "Resumo sobre você" },
  { key: "habilidades", label: "Habilidades (mín. 3)", minItems: 3 },
  { key: "cursos", label: "Cursos complementares", optional: true },
  { key: "experiencias", label: "Experiências ou projetos", optional: true },
];

function getUsers() {
  const users = StorageService.get(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  if (!StorageService.set(USERS_KEY, users)) {
    throw new Error("Não foi possível salvar os dados neste navegador.");
  }
}

/** Perfil demonstrativo do usuário; jamais retorna o hash da senha para telas. */
export const UserService = {
  normalizeUser(user = {}) {
    return {
      id: "",
      role: "candidate",
      status: "active",
      nome: "",
      email: "",
      telefone: "",
      dataNascimento: "",
      cidade: "",
      estado: "",
      escolaridade: "",
      curso: "",
      instituicao: "",
      areaInteresse: "",
      tiposVaga: [],
      disponibilidade: "",
      resumo: "",
      habilidades: [],
      cursos: [],
      experiencias: [],
      fotoDataUrl: "",
      linkedin: "",
      github: "",
      portfolio: "",
      criadoEm: "",
      atualizadoEm: "",
      ...user,
      tiposVaga: Array.isArray(user.tiposVaga) ? user.tiposVaga : [],
      habilidades: Array.isArray(user.habilidades) ? user.habilidades : [],
      cursos: Array.isArray(user.cursos) ? user.cursos : [],
      experiencias: Array.isArray(user.experiencias) ? user.experiencias : [],
    };
  },

  toPublicUser(user) {
    if (!user) return null;
    const { senhaHash, senha, confirmarSenha, ...publico } = user;
    return this.normalizeUser(publico);
  },

  async getById(userId, token = null) {
    if (APP_CONFIG.useApi) return ApiService.get("/candidatos/me", token);
    const user = getUsers().find((entry) => entry.id === userId);
    return user ? this.toPublicUser(user) : null;
  },

  async updateEmail(userId, email, token = null) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (APP_CONFIG.useApi) return ApiService.put("/auth/email", { email: normalizedEmail }, token);
    if (!Validators.email(normalizedEmail)) throw new Error("Informe um e-mail válido.");
    const users = getUsers();
    const index = users.findIndex((entry) => entry.id === userId);
    if (index === -1) throw new Error("Conta não encontrada.");
    if (users.some((entry) => entry.id !== userId && entry.email?.toLowerCase() === normalizedEmail)) {
      throw new Error("Este e-mail já está em uso por outra conta.");
    }
    users[index] = { ...users[index], email: normalizedEmail, atualizadoEm: new Date().toISOString() };
    saveUsers(users);
    return this.toPublicUser(users[index]);
  },

  async updateProfile(userId, dados, token = null) {
    if (APP_CONFIG.useApi) return ApiService.put("/candidatos/me", dados, token);
    const users = getUsers();
    const index = users.findIndex((entry) => entry.id === userId);
    if (index === -1) throw new Error("Usuário não encontrado.");

    const permitted = Object.fromEntries(Object.entries(dados).filter(([key]) => PROFILE_FIELDS.includes(key)));
    const current = users[index];
    const updated = this.normalizeUser({
      ...current,
      ...permitted,
      id: current.id,
      email: current.email,
      role: current.role,
      status: current.status,
      senhaHash: current.senhaHash,
      atualizadoEm: new Date().toISOString(),
    });
    users[index] = updated;
    saveUsers(users);
    return this.toPublicUser(updated);
  },

  async deleteAccount(userId, token = null) {
    if (APP_CONFIG.useApi) return ApiService.delete("/candidatos/me", token);
    saveUsers(getUsers().filter((entry) => entry.id !== userId));
  },

  listByRole(role) {
    return getUsers()
      .filter((user) => !role || user.role === role)
      .map((user) => this.toPublicUser(user));
  },

  listAll() {
    return this.listByRole(null);
  },

  updateAccountStatus(userId, status) {
    if (!new Set(["active", "blocked"]).has(status)) throw new Error("Status de conta inválido.");
    const users = getUsers();
    const index = users.findIndex((entry) => entry.id === userId);
    if (index === -1) throw new Error("Conta não encontrada.");
    users[index] = { ...users[index], status, atualizadoEm: new Date().toISOString() };
    saveUsers(users);
    return this.toPublicUser(users[index]);
  },

  calculateCompleteness(user) {
    const checklist = COMPLETENESS_FIELDS.map(({ key, label, minItems, optional }) => {
      const value = user[key];
      let done;
      if (key === "cidade") done = Boolean(value && user.estado);
      else if (Array.isArray(value)) done = value.length >= (minItems ?? 1);
      else done = Boolean(value && String(value).trim().length >= 3);
      return { key, label, done: optional ? true : done, optional: Boolean(optional) };
    });
    const required = checklist.filter((item) => !item.optional);
    const doneCount = required.filter((item) => item.done).length;
    return {
      checklist,
      percentage: required.length ? Math.round((doneCount / required.length) * 100) : 0,
    };
  },
};
