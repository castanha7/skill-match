import { APP_CONFIG } from "../config/app.config.js";

/** Cliente HTTP reservado para a integração futura com a API Node/Express. */
const ApiService = {
  async request(endpoint, { method = "GET", body, token } = {}) {
    if (!APP_CONFIG.apiBaseUrl) {
      throw new Error("A API do SkillMatch ainda não foi configurada. Este projeto está em modo demonstrativo local.");
    }
    const url = new URL(endpoint.replace(/^\//, ""), `${APP_CONFIG.apiBaseUrl.replace(/\/$/, "")}/`);
    const response = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Erro ${response.status} ao comunicar com o servidor.`);
    return data;
  },

  get: (endpoint, token) => ApiService.request(endpoint, { token }),
  post: (endpoint, body, token) => ApiService.request(endpoint, { method: "POST", body, token }),
  put: (endpoint, body, token) => ApiService.request(endpoint, { method: "PUT", body, token }),
  delete: (endpoint, token) => ApiService.request(endpoint, { method: "DELETE", token }),
};

export default ApiService;
