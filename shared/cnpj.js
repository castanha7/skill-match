/**
 * Validação sintática de CNPJ (numérico legado e alfanumérico).
 * Não consulta a Receita Federal nem confirma existência, situação ou titularidade.
 */
export function normalizeCnpj(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function checkDigit(values, weights) {
  const remainder = values.reduce((sum, value, index) => sum + value * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Valida 12 caracteres alfanuméricos mais os dois dígitos verificadores. */
export function isValidCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^([A-Z0-9])\1{13}$/.test(cnpj)) return false;

  // O cálculo oficial converte cada caractere pela posição ASCII menos 48.
  const values = Array.from(cnpj, (character) => character.charCodeAt(0) - 48);
  const first = checkDigit(values.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== values[12]) return false;
  const second = checkDigit([...values.slice(0, 12), first], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === values[13];
}

/** Formata a representação compacta no padrão visual XX.XXX.XXX/XXXX-XX. */
export function formatCnpj(value) {
  const cnpj = normalizeCnpj(value).slice(0, 14);
  if (!cnpj) return "";
  let formatted = cnpj.slice(0, 2);
  if (cnpj.length > 2) formatted += `.${cnpj.slice(2, 5)}`;
  if (cnpj.length > 5) formatted += `.${cnpj.slice(5, 8)}`;
  if (cnpj.length > 8) formatted += `/${cnpj.slice(8, 12)}`;
  if (cnpj.length > 12) formatted += `-${cnpj.slice(12, 14)}`;
  return formatted;
}
