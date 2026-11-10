/** Formatters — Máscaras e formatações de exibição */
export const Formatters = {
  /** (00) 00000-0000 / (00) 0000-0000 conforme o tamanho */
  phone(value) {
    const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  },

  /** Iniciais para o avatar (ex.: "Mariana Costa" → "MC") */
  initials(name) {
    const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  /** "2007-05-14" → "14/05/2007" */
  dateBR(value) {
    if (!value) return "";
    const [y, m, d] = value.split("-");
    return d && m && y ? `${d}/${m}/${y}` : value;
  },

  /** Primeira letra maiúscula */
  capitalize(value) {
    const v = String(value ?? "");
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  },
};
