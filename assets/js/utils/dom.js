/** Atalhos de DOM + sistema de notificações (toast) */
export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const TOAST_ICONS = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg>',
};

export function showToast(message, type = "success", duration = 3400) {
  let container = $(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `${TOAST_ICONS[type] ?? TOAST_ICONS.info}<span></span>`;
  toast.querySelector("span").textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

/** Marca um campo como inválido e exibe a mensagem de erro associada */
export function setFieldError(input, message) {
  const field = input.closest(".field");
  if (!field) return;
  field.classList.add("invalid");
  const errorEl = $(".error-msg", field);
  if (errorEl && message) errorEl.textContent = message;
  input.setAttribute("aria-invalid", "true");
}

export function clearFieldError(input) {
  const field = input.closest(".field");
  if (!field) return;
  field.classList.remove("invalid");
  input.removeAttribute("aria-invalid");
}

/** Liga a limpeza automática do erro enquanto o usuário digita */
export function bindAutoClear(input) {
  input.addEventListener("input", () => clearFieldError(input));
  input.addEventListener("change", () => clearFieldError(input));
}
