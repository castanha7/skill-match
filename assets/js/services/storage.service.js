/**
 * StorageService — Abstração de persistência local
 * ------------------------------------------------------------
 * Encapsula o localStorage para que o restante da aplicação
 * nunca acesse `localStorage` diretamente. Na integração com
 * o backend, esta camada deixa de ser usada pelos serviços
 * de domínio (substituída pelas chamadas HTTP em api.service).
 */
export const StorageService = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false; // ex.: modo privado / cota excedida
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },
};
