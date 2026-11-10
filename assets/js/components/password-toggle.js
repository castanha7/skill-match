import { $$ } from "../utils/dom.js";

/**
 * Componente: botão mostrar/ocultar senha
 * Uso: <button class="toggle-password" data-target="idDoInput">
 */
export function initPasswordToggles(scope = document) {
  $$(".toggle-password", scope).forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.classList.toggle("is-visible", !showing);
      button.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
      input.focus();
    });
  });
}
