function normal(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function listOf(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return String(value ?? "").split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
}

function educationLevel(value) {
  const text = normal(value);
  const levels = [
    [/\b(fundamental|elementary)\b/, 1],
    [/\b(medio|high school)\b/, 2],
    [/\b(tecnico|technical)\b/, 3],
    [/\b(superior|graduacao|universitario|faculdade|bachelor|college|pos graduacao|mestrado|doutorado)\b/, 4],
  ].filter(([pattern]) => pattern.test(text)).map(([, level]) => level);
  return levels.length ? Math.max(...levels) : 0;
}

function studyStatus(value) {
  const text = normal(value);
  return {
    inProgress: /\b(cursando|em curso|em andamento|em formacao|em progresso)\b/.test(text),
    completed: /\b(concluido|completo|formad[oa]|graduad[oa])\b/.test(text),
    incomplete: /\b(incomplet[oa]|trancad[oa]|interrompid[oa])\b/.test(text),
  };
}

function educationAlternatives(value) {
  const alternatives = [];
  let previousLevel = 0;
  for (const part of normal(value).split(/\s+ou\s+|\s*[,;/]\s*/)) {
    const detectedLevel = educationLevel(part);
    if (detectedLevel) previousLevel = detectedLevel;
    const level = detectedLevel || previousLevel;
    if (!level) continue;
    alternatives.push({ level, ...studyStatus(part) });
  }
  return alternatives;
}

function hasEducationRequirement(value) {
  const text = normal(value);
  return Boolean(text && !/\b(nao informad[oa]|nao exigid[oa]|nao exige|sem escolaridade minima|qualquer escolaridade|indiferente)\b/.test(text));
}

function educationFit(candidateValue, requirementValue) {
  if (!hasEducationRequirement(requirementValue)) return null;
  const candidateLevel = educationLevel(candidateValue);
  if (!candidateLevel) return null;
  const candidateStatus = studyStatus(candidateValue);
  const alternatives = educationAlternatives(requirementValue);
  if (!alternatives.length) return null;

  let statusUnknown = false;
  for (const requirement of alternatives) {
    if (candidateLevel < requirement.level) continue;
    // Escolaridade acima do mínimo atende ao nível. Restrições de situação
    // (cursando/concluído) são comparadas quando o nível é o mesmo.
    if (candidateLevel > requirement.level) return true;
    if (!requirement.inProgress && !requirement.completed) return true;
    if (requirement.inProgress && candidateStatus.inProgress) return true;
    if (requirement.completed && candidateStatus.completed) return true;
    if (!candidateStatus.inProgress && !candidateStatus.completed && !candidateStatus.incomplete) statusUnknown = true;
  }
  if (statusUnknown) return null;
  return false;
}

function skillFits(profileSkill, requirement) {
  const normalizeSkill = (value) => normal(value).replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const skill = normalizeSkill(profileSkill);
  const term = normalizeSkill(requirement);
  return Boolean(skill && term && (` ${skill} `.includes(` ${term} `) || ` ${term} `.includes(` ${skill} `)));
}

function uniqueRequirements(value) {
  const seen = new Set();
  return listOf(value).filter((item) => {
    const key = normal(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function utcDay(value) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : 0;
}

function diversityKey(job) {
  return [job.type, job.area, job.city].map(normal).join("|");
}

/** Compatibility estimate and recommendations are local, deterministic, explainable, and not outcome predictions. */
export const MatchService = {
  score(candidate = {}, job = {}) {
    const candidateSkills = listOf(candidate.habilidades);
    const candidateTypes = listOf(candidate.tiposVaga);
    const requirementSource = listOf(job.requirements).length ? job.requirements : job.skills;
    const requirements = uniqueRequirements(requirementSource);
    const matchedSkills = requirements.filter((item) => candidateSkills.some((skill) => skillFits(skill, item)));
    const missingSkills = requirements.filter((item) => !matchedSkills.includes(item));
    const profileArea = normal(candidate.areaInteresse);
    const jobArea = normal(job.area);
    const areaMatch = Boolean(profileArea && jobArea && (profileArea === jobArea || profileArea.includes(jobArea) || jobArea.includes(profileArea)));
    const relatedArea = Boolean(!areaMatch && profileArea && jobArea && (profileArea.includes(jobArea.slice(0, 7)) || jobArea.includes(profileArea.slice(0, 7))));
    const typeMatch = candidateTypes.some((type) => normal(type) === normal(job.type));
    const educationRequirementKnown = hasEducationRequirement(job.education);
    const educationMatch = educationRequirementKnown ? educationFit(candidate.escolaridade, job.education) : null;

    const candidateCity = normal(candidate.cidade);
    const jobCity = normal(job.city);
    const candidateState = normal(candidate.estado);
    const jobState = normal(job.state);
    const sameCity = Boolean(candidateCity && jobCity && candidateCity === jobCity && candidateState === jobState);
    const sameState = Boolean(candidateState && jobState && candidateState === jobState);
    const locationMatch = sameCity ? "city" : sameState ? "state" : candidateState && jobState ? "other-state" : "unknown";

    let score = 15;
    if (areaMatch) score += 24;
    else if (relatedArea) score += 10;
    if (typeMatch) score += 17;
    if (requirements.length) score += Math.round((matchedSkills.length / requirements.length) * 32);
    if (educationMatch === true) score += 8;
    else if (educationMatch === false) score -= 8;
    if (locationMatch === "city") score += 10;
    else if (locationMatch === "state") score += 4;
    score = Math.max(10, Math.min(99, score));

    const reasons = [];
    if (matchedSkills.length) reasons.push(`Habilidades já cadastradas que aparecem nos requisitos: ${matchedSkills.slice(0, 3).join(", ")}.`);
    if (areaMatch) reasons.push(`A área de interesse (${candidate.areaInteresse}) combina com a área do anúncio.`);
    else if (relatedArea) reasons.push("A área do anúncio tem relação parcial com seu interesse cadastrado.");
    if (typeMatch) reasons.push("O tipo de oportunidade está entre suas preferências.");
    if (educationMatch === true) reasons.push("A escolaridade registrada atende ao nível informado no anúncio.");
    if (educationMatch === false) reasons.push("A escolaridade registrada pode não atender ao requisito; confirme os critérios na fonte.");
    if (educationMatch === null && educationRequirementKnown) reasons.push("Não foi possível comparar a escolaridade com os dados disponíveis; confirme o requisito na fonte.");
    if (locationMatch === "city") reasons.push("A cidade do anúncio coincide com a cidade do perfil.");
    else if (locationMatch === "state") reasons.push("A oportunidade e o perfil estão no mesmo estado.");
    else if (locationMatch === "other-state") reasons.push("A oportunidade está em outro estado; confira a modalidade e a possibilidade de deslocamento.");
    if (!reasons.length) reasons.push("A oportunidade está disponível para você explorar; complete seu perfil para obter uma estimativa mais contextualizada.");

    const tips = [];
    if (missingSkills.length) tips.push(`Considere desenvolver: ${missingSkills.slice(0, 3).join(", ")}.`);
    if (!candidateSkills.length) tips.push("Adicione habilidades ao perfil para tornar esta estimativa mais útil.");
    if (educationMatch === false) tips.push("Confira a escolaridade solicitada antes de considerar uma oportunidade real.");
    if (!tips.length) tips.push("Revise seu currículo e mantenha as informações atualizadas.");

    return {
      percentage: score,
      matchedSkills,
      missingSkills,
      reasons,
      tips,
      areaMatch,
      relatedArea,
      typeMatch,
      educationMatch,
      locationMatch,
      method: "regras locais explicáveis",
      disclaimer: "Estimativa demonstrativa baseada apenas nos campos disponíveis; não usa IA e não representa chance de contratação.",
    };
  },

  /** Keeps the strongest match first, then rotates diverse alternatives daily. */
  recommend(candidate = {}, jobs = [], { limit = 3, date = new Date() } = {}) {
    const maximum = Math.max(0, Math.floor(Number(limit) || 0));
    if (!maximum) return [];
    const ranked = (Array.isArray(jobs) ? jobs : [])
      .filter((job) => job && typeof job === "object")
      .map((job) => ({ job, ...this.score(candidate, job) }))
      .sort((a, b) => b.percentage - a.percentage
        || String(a.job.title ?? "").localeCompare(String(b.job.title ?? ""), "pt-BR")
        || String(a.job.id ?? "").localeCompare(String(b.job.id ?? "")));
    if (ranked.length <= maximum) return ranked;

    const alternatives = ranked.slice(1);
    const seed = hashText(candidate.id || candidate.email || "skillmatch-candidate");
    const offset = alternatives.length ? (utcDay(date) + seed) % alternatives.length : 0;
    const rotatedAlternatives = [...alternatives.slice(offset), ...alternatives.slice(0, offset)];
    const ordered = [ranked[0], ...rotatedAlternatives];
    const selected = [ranked[0]];
    if (selected.length === maximum) return selected;
    const selectedJobs = new Set(selected.map((item) => item.job));
    const seenCategories = new Set([diversityKey(ranked[0].job)]);
    for (const item of ordered) {
      if (selectedJobs.has(item.job) || seenCategories.has(diversityKey(item.job))) continue;
      selected.push(item);
      selectedJobs.add(item.job);
      seenCategories.add(diversityKey(item.job));
      if (selected.length === maximum) break;
    }
    if (selected.length < maximum) {
      for (const item of ordered) {
        if (selectedJobs.has(item.job)) continue;
        selected.push(item);
        selectedJobs.add(item.job);
        if (selected.length === maximum) break;
      }
    }
    return selected.sort((a, b) => b.percentage - a.percentage
      || String(a.job.title ?? "").localeCompare(String(b.job.title ?? ""), "pt-BR")
      || String(a.job.id ?? "").localeCompare(String(b.job.id ?? "")));
  },
};
