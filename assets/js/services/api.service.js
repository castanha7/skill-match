import { APP_CONFIG } from "../config/app.config.js";

/**
 * ApiService — Cliente HTTP da futura API REST (Node.js + Express)
 * ------------------------------------------------------------
 * Já está pronto para uso: quando `APP_CONFIG.useApi` for `true`,
 * os serviços passam a chamar estes métodos, que fazem `fetch`
 * para os endpoints definidos em docs/INTEGRACAO-BACKEND.md.
 * Nesta etapa (somente frontend) ele não é utilizado.
 */
const ApiService = {
  async request(endpoint, { method = "GET", body, token } = {}) {
    const response = await fetch(`${APP_CONFIG.apiBaseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `Erro ${response.status} ao comunicar com o servidor.`);
    }
    return data;
  },

  get: (endpoint, token) => ApiService.request(endpoint, { token }),
  post: (endpoint, body, token) => ApiService.request(endpoint, { method: "POST", body, token }),
  put: (endpoint, body, token) => ApiService.request(endpoint, { method: "PUT", body, token }),
  delete: (endpoint, token) => ApiService.request(endpoint, { method: "DELETE", token }),
};

export default ApiService;
