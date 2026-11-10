import { $, $$ } from "../utils/dom.js";
import { CATALOGS } from "../config/app.config.js";
import { Formatters } from "../utils/formatters.js";

const MAX_SKILLS = 15;

/**
 * Componente: editor de habilidades (tags)
 * Estrutura esperada no HTML:
 *   <div class="skills-editor">
 *     <input class="skill-input"> <button class="skill-add">
 *     <div class="tags-container"></div> <div class="skill-suggestions"></div>
 *     <p class="hint skill-count"></p>
 *   </div>
 */
export function createSkillsEditor(root, initialSkills = []) {
  const input = $(".skill-input", root);
  const addButton = $(".skill-add", root);
  const tagsBox = $(".tags-container", root);
  const suggestionsBox = $(".skill-suggestions", root);
  const countEl = $(".skill-count", root);

  let skills = [...new Set(initialSkills.map((s) => s.trim()).filter(Boolean))];

  function render() {
    tagsBox.innerHTML = "";
    skills.forEach((skill) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.innerHTML = `<span></span><button type="button" aria-label="Remover habilidade">&times;</button>`;
      tag.querySelector("span").textContent = skill;
      tag.querySelector("button").addEventListener("click", () => {
        skills = skills.filter((s) => s !== skill);
        render();
      });
      tagsBox.appendChild(tag);
    });

    if (countEl) {
      countEl.textContent = skills.length
        ? `${skills.length} de ${MAX_SKILLS} habilidades adicionadas${skills.length < 3 ? " — adicione pelo menos 3" : ""}`
        : `Adicione até ${MAX_SKILLS} habilidades.`;
    }

    $$(".skill-chip", suggestionsBox).forEach((chip) => {
      chip.classList.toggle("added", skills.some((s) => s.toLowerCase() === chip.dataset.skill.toLowerCase()));
    });
  }

  function addSkill(raw) {
    const skill = Formatters.capitalize(String(raw ?? "").trim().replace(/\s+/g, " "));
    if (!skill) return false;
    if (skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return false;
    if (skills.length >= MAX_SKILLS) return false;
    skills.push(skill);
    render();
    return true;
  }

  function buildSuggestions() {
    suggestionsBox.innerHTML = "";
    CATALOGS.habilidadesSugeridas.forEach((skill) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "skill-chip";
      chip.dataset.skill = skill;
      chip.textContent = `+ ${skill}`;
      chip.addEventListener("click", () => addSkill(skill));
      suggestionsBox.appendChild(chip);
    });
  }

  addButton.addEventListener("click", () => {
    if (addSkill(input.value)) input.value = "";
    input.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (addSkill(input.value)) input.value = "";
    }
  });

  buildSuggestions();
  render();

  return {
    getSkills: () => [...skills],
    setSkills: (list) => { skills = [...new Set(list)]; render(); },
  };
}
