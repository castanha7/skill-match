import { APP_CONFIG } from "../config/app.config.js";
import { StorageService } from "./storage.service.js";

const SESSION_KEY = APP_CONFIG.storageKeys.session;
let refreshInFlight = null;

function storedSession() {
  return StorageService.get(SESSION_KEY) || StorageService.getSessionValue(SESSION_KEY);
}
function sessionAccessToken(session) {
  return session?.token || session?.accessToken || session?.access_token || null;
}
function sessionExpiryMs(session) {
  if (Number.isFinite(Number(session?.expiresAtMs))) return Number(session.expiresAtMs);
  if (Number.isFinite(Number(session?.expires_at))) return Number(session.expires_at) * 1000;
  return null;
}
function saveRefreshedSession(data) {
  const current = storedSession();
  if (!current || !data?.session?.access_token) return null;
  const renewed = {
    ...current,
    ...(data.user ? {
      userId: data.user.id,
      email: data.user.email,
      nome: data.user.nome || data.user.name,
      role: data.user.role,
      companyId: data.user.companyId || null,
    } : {}),
    token: data.session.access_token,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAtMs: Number(data.session.expires_at || 0) * 1000 || Date.now() + 3600_000,
    expiraEm: current.lembrarMe ? Date.now() + APP_CONFIG.sessionMaxAge : null,
  };
  if (renewed.lembrarMe) {
    StorageService.set(SESSION_KEY, renewed);
    StorageService.removeSessionValue(SESSION_KEY);
  } else {
    StorageService.setSessionValue(SESSION_KEY, renewed);
    StorageService.remove(SESSION_KEY);
  }
  return renewed;
}

const ApiService = {
  async _refreshSession() {
    if (refreshInFlight) return refreshInFlight;
    const current = storedSession();
    if (!current?.refreshToken) return null;
    refreshInFlight = (async () => {
      const result = await ApiService.request("/api/auth/refresh", {
        method: "POST",
        body: { refreshToken: current.refreshToken },
        skipAuth: true,
        retryAuth: false,
      });
      return saveRefreshedSession(result);
    })().catch(() => {
      StorageService.remove(SESSION_KEY);
      StorageService.removeSessionValue(SESSION_KEY);
      return null;
    }).finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  },

  async request(endpoint, { method = "GET", body, token, skipAuth = false, retryAuth = true } = {}) {
    if (!APP_CONFIG.apiBaseUrl) {
      throw new Error("A API do SkillMatch ainda não foi configurada. Este projeto está em modo demonstrativo local.");
    }
    const cleanEndpoint = String(endpoint).replace(/^\/+/, "");
    const url = new URL(cleanEndpoint, `${APP_CONFIG.apiBaseUrl.replace(/\/$/, "")}/`);
    let session = storedSession();
    const storedAccessToken = sessionAccessToken(session);
    const hasExplicitToken = typeof token === "string" && token.length > 0;
    const usesStoredSession = !hasExplicitToken || token === storedAccessToken;
    let bearer = hasExplicitToken ? token : storedAccessToken;
    const expiry = sessionExpiryMs(session);
    const authEndpoint = /(?:^|\/)auth\/(?:register|login|refresh|password-reset|verify-email)(?:$|\?|\/)/.test(cleanEndpoint);
    if (!skipAuth && !authEndpoint && usesStoredSession && session?.refreshToken && expiry && expiry < Date.now() + 45_000) {
      const refreshed = await ApiService._refreshSession();
      session = refreshed || session;
      bearer = sessionAccessToken(refreshed) || bearer;
    }
    const send = async (authToken) => {
      const response = await fetch(url, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(!skipAuth && authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = response.status === 204 ? null : await response.json().catch(() => ({}));
      return { response, data };
    };
    let result = await send(bearer);
    if (result.response.status === 401 && !skipAuth && retryAuth && usesStoredSession && session?.refreshToken && !authEndpoint) {
      const refreshed = await ApiService._refreshSession();
      if (refreshed && sessionAccessToken(refreshed)) {
        session = refreshed;
        bearer = sessionAccessToken(refreshed);
        result = await send(bearer);
      }
    }
    if (!result.response.ok) {
      const error = new Error(result.data?.message || `Erro ${result.response.status} ao comunicar com o servidor.`);
      error.status = result.response.status;
      error.code = result.data?.code;
      error.details = result.data?.details;
      throw error;
    }
    return result.data;
  },

  get: (endpoint, token) => ApiService.request(endpoint, { token }),
  post: (endpoint, body, token) => ApiService.request(endpoint, { method: "POST", body, token }),
  put: (endpoint, body, token) => ApiService.request(endpoint, { method: "PUT", body, token }),
  patch: (endpoint, body, token) => ApiService.request(endpoint, { method: "PATCH", body, token }),
  delete: (endpoint, token) => ApiService.request(endpoint, { method: "DELETE", token }),
};

export default ApiService;
