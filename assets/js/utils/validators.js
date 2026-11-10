/**
 * Validators — Regras de validação reutilizáveis dos formulários
 * (as mesmas regras serão replicadas no backend com express-validator)
 */
export const Validators = {
  required: (value) => String(value ?? "").trim().length > 0,

  fullName: (value) => {
    const parts = String(value ?? "").trim().split(/\s+/);
    return parts.length >= 2 && parts.every((p) => p.length >= 2);
  },

  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? "").trim()),

  /** Senha: mínimo 8 caracteres, com letras e números */
  password: (value) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(String(value ?? "")),

  phone: (value) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.length === 10 || digits.length === 11;
  },

  url: (value) => {
    if (!value) return true; // campos de link são opcionais
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      return Boolean(url.hostname.includes("."));
    } catch {
      return false;
    }
  },

  birthDate: (value) => {
    if (!value) return false;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const age = Validators.age(value);
    return age >= 14 && age <= 100;
  },

  age: (value) => {
    const birth = new Date(`${value}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  },

  /** Retorna 0–4 (fraca → muito forte) para o medidor visual */
  passwordStrength(value) {
    let score = 0;
    if (!value) return 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(score, 4);
  },
};

export const PASSWORD_STRENGTH_LABELS = [
  { label: "Senha muito fraca", color: "#dc2626" },
  { label: "Senha fraca", color: "#ea580c" },
  { label: "Senha média", color: "#d97706" },
  { label: "Senha forte", color: "#65a30d" },
  { label: "Senha muito forte", color: "#0e9f6e" },
];
