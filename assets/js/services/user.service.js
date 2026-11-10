import { APP_CONFIG } from "../config/app.config.js";
import { StorageService } from "./storage.service.js";
import ApiService from "./api.service.js";

const { users: USERS_KEY } = APP_CONFIG.storageKeys;

/** Campos que compõem o cálculo de completude do perfil */
const COMPLETENESS_FIELDS = [
  { key: "nome", label: "Nome completo" },
  { key: "email", label: "E-mail" },
  { key: "telefone", label: "Telefone / WhatsApp" },
  { key: "dataNascimento", label: "Data de nascimento" },
  { key: "cidade", label: "Cidade e estado" },
  { key: "escolaridade", label: "Escolaridade" },
  { key: "curso", label: "Curso" },
  { key: "areaInteresse", label: "Área de interesse" },
  { key: "tiposVaga", label: "Tipos de vaga de interesse" },
  { key: "disponibilidade", label: "Disponibilidade" },
  { key: "resumo", label: "Resumo sobre você" },
  { key: "habilidades", label: "Habilidades (mín. 3)", minItems: 3 },
  { key: "linkedin", label: "LinkedIn" },
];

/**
 * UserService — Perfil do candidato
 * ------------------------------------------------------------
 * Etapa atual: lê/grava no localStorage.
 * Futuro [API]:
 *   GET    /api/candidatos/me
 *   PUT    /api/candidatos/me
 *   DELETE /api/candidatos/me
 */
export const UserService = {
  /** Garante que todo usuário tenha a estrutura completa do perfil */
  normalizeUser(user) {
    return {
      id: "",
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
      linkedin: "",
      github: "",
      portfolio: "",
      criadoEm: "",
      atualizadoEm: "",
      ...user,
    };
  },

  /** Remove dados sensíveis antes de expor o usuário para as telas */
  toPublicUser(user) {
    const { senhaHash, senha, confirmarSenha, ...publico } = user;
    return this.normalizeUser(publico);
  },

  _getUsers() {
    return StorageService.get(USERS_KEY, []);
  },

  /**
   * Busca o perfil do usuário logado.
   * [API] GET /api/candidatos/me
   */
  async getById(userId, token = null) {
    if (APP_CONFIG.useApi) {
      return ApiService.get("/candidatos/me", token);
    }
    const user = this._getUsers().find((u) => u.id === userId);
    return user ? this.toPublicUser(user) : null;
  },

  /**
   * Atualiza o perfil do candidato.
   * [API] PUT /api/candidatos/me
   */
  async updateProfile(userId, dados, token = null) {
    if (APP_CONFIG.useApi) {
      return ApiService.put("/candidatos/me", dados, token);
    }
    const users = this._getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error("Usuário não encontrado.");

    const { senhaHash, ...atual } = users[index];
    const atualizado = this.normalizeUser({
      ...atual,
      ...dados,
      id: atual.id,       // id e e-mail não mudam pela edição de perfil
      email: atual.email,
      senhaHash,
      atualizadoEm: new Date().toISOString(),
    });
    users[index] = atualizado;
    StorageService.set(USERS_KEY, users);
    return this.toPublicUser(atualizado);
  },

  /**
   * Exclui definitivamente a conta.
   * [API] DELETE /api/candidatos/me
   */
  async deleteAccount(userId, token = null) {
    if (APP_CONFIG.useApi) {
      return ApiService.delete("/candidatos/me", token);
    }
    const users = this._getUsers().filter((u) => u.id !== userId);
    StorageService.set(USERS_KEY, users);
  },

  /** Calcula o percentual de completude e o checklist do perfil */
  calculateCompleteness(user) {
    const checklist = COMPLETENESS_FIELDS.map(({ key, label, minItems }) => {
      const value = user[key];
      let done;
      if (key === "cidade") done = Boolean(value && user.estado);
      else if (Array.isArray(value)) done = value.length >= (minItems ?? 1);
      else done = Boolean(value && String(value).trim().length >= 3);
      return { key, label, done };
    });
    const doneCount = checklist.filter((item) => item.done).length;
    return {
      checklist,
      percentage: Math.round((doneCount / checklist.length) * 100),
    };
  },
};
