/**
 * Persistência do protótipo. LocalStorage é visível e editável pelo usuário;
 * nunca deve ser tratado como armazenamento seguro ou fonte de autorização.
 */
export const StorageService = {
  get(key, fallback = null) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw === null || raw === undefined ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      if (!globalThis.localStorage) return false;
      globalThis.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // O navegador pode negar acesso ao storage (ex.: modo restrito).
    }
  },

  getSessionValue(key, fallback = null) {
    try {
      const raw = globalThis.sessionStorage?.getItem(key);
      return raw === null || raw === undefined ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  setSessionValue(key, value) {
    try {
      if (!globalThis.sessionStorage) return false;
      globalThis.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  removeSessionValue(key) {
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch {
      // O navegador pode negar acesso ao storage.
    }
  },
};
