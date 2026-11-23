import assert from "node:assert/strict";
import test from "node:test";
import { MatchService } from "../assets/js/services/match.service.js";
import { PlatformService } from "../assets/js/services/platform.service.js";

const candidate = {
  id: "candidate-match-test",
  areaInteresse: "Tecnologia da Informação",
  tiposVaga: ["Estágio"],
  habilidades: ["HTML e CSS", "JavaScript avançado", "Comunicação", "Estoque e logística"],
  escolaridade: "Ensino Técnico (cursando)",
  cidade: "Curitiba",
  estado: "PR",
};

test("match de habilidades normaliza acentos, variações de nível e mantém os itens faltantes corretos", () => {
  const result = MatchService.score(candidate, {
    area: "Tecnologia da Informação",
    type: "Estágio",
    requirements: ["HTML e CSS", "JavaScript", "comunicacao", "Logística", "Excel"],
    education: "Ensino Técnico ou Superior em curso",
    city: "Curitiba",
    state: "PR",
  });

  assert.deepEqual(result.matchedSkills, ["HTML e CSS", "JavaScript", "comunicacao", "Logística"]);
  assert.deepEqual(result.missingSkills, ["Excel"]);
  assert.equal(result.educationMatch, true);
  assert.equal(result.areaMatch, true);
  assert.equal(result.typeMatch, true);
  assert.ok(result.percentage > 50 && result.percentage <= 99);
  assert.match(result.disclaimer, /não representa chance de contratação/i);

  const noFalsePositive = MatchService.score({ habilidades: ["R"] }, { requirements: ["React"] });
  assert.deepEqual(noFalsePositive.matchedSkills, []);
  assert.deepEqual(noFalsePositive.missingSkills, ["React"]);
  assert.deepEqual(MatchService.score({ habilidades: ["Excel"] }, { skills: ["Excel"] }).matchedSkills, ["Excel"]);
});

test("escolaridade compara nível e estado do curso sem aceitar coincidência de palavras", () => {
  const fit = (education, requirement) => MatchService.score(
    { escolaridade: education },
    { education: requirement },
  ).educationMatch;

  assert.equal(fit("Ensino Médio (cursando)", "Ensino Médio em curso ou concluído"), true);
  assert.equal(fit("Ensino Médio (concluído)", "Ensino Médio em curso ou concluído"), true);
  assert.equal(fit("Ensino Médio (concluído)", "Ensino Médio em curso"), false);
  assert.equal(fit("Ensino Médio (cursando)", "Ensino Médio concluído"), false);
  assert.equal(fit("Ensino Superior incompleto", "Ensino Superior concluído"), false);
  assert.equal(fit("Ensino Técnico (concluído)", "Ensino Técnico ou Superior em curso"), true);
  assert.equal(fit("Ensino Superior (cursando)", "Ensino Médio concluído"), true);
  assert.equal(fit("Ensino Técnico", "Ensino Técnico em curso"), null);
  assert.equal(fit("", "Ensino Superior concluído"), null);
  assert.equal(fit("Ensino Médio (concluído)", "Escolaridade não informada"), null);
  assert.equal(fit("Ensino Médio (concluído)", "Não exige escolaridade mínima"), null);

  const candidateWithMismatch = { ...candidate, escolaridade: "Ensino Médio (concluído)" };
  const compatible = MatchService.score(candidate, { education: "Ensino Técnico em curso" });
  const incompatible = MatchService.score(candidateWithMismatch, { education: "Ensino Técnico em curso" });
  assert.equal(incompatible.educationMatch, false);
  assert.ok(compatible.percentage > incompatible.percentage);
});

test("recomendações mantêm o melhor match e variam as alternativas diariamente", () => {
  const jobs = [
    { id: "best", title: "Mais compatível", area: "Tecnologia da Informação", type: "Estágio", requirements: ["HTML e CSS"], education: "Ensino Técnico em curso", city: "Curitiba", state: "PR" },
    ...["a", "b", "c"].map((id) => ({
      id,
      title: `Oportunidade ${id}`,
      area: "Serviços",
      type: "Jovem Aprendiz",
      city: "Curitiba",
      state: "PR",
    })),
  ];
  const firstDay = MatchService.recommend(candidate, jobs, { limit: 2, date: "2026-11-14T12:00:00.000Z" });
  const nextDay = MatchService.recommend(candidate, jobs, { limit: 2, date: "2026-11-15T12:00:00.000Z" });

  assert.equal(firstDay.length, 2);
  assert.equal(nextDay.length, 2);
  assert.equal(firstDay[0].job.id, "best");
  assert.equal(nextDay[0].job.id, "best");
  assert.equal(new Set(firstDay.map(({ job }) => job.id)).size, 2);
  assert.notEqual(firstDay[1].job.id, nextDay[1].job.id);
});

test("distância do Radar reconhece endereço local e não finge precisão de rua", () => {
  const address = { address: "Rua das Flores, Centro, Araucária - PR" };
  const curitiba = { city: "Curitiba", state: "PR" };
  const distance = PlatformService.distanceEstimate(address, curitiba);

  assert.equal(PlatformService.hasLocationCoordinates(address), true);
  assert.ok(distance >= 20 && distance <= 25, `Distância inesperada: ${distance} km`);
  assert.equal(PlatformService.distanceEstimate({ cidade: "Araucária", estado: "PR" }, curitiba), distance);
  assert.equal(PlatformService.distanceEstimate({ city: "Araucária", state: "PR" }, { city: "Araucária", state: "PR" }), 0);
  assert.equal(PlatformService.distanceEstimate({ address: "Rua Araucária, Curitiba - PR" }, curitiba), 0);
  assert.equal(PlatformService.distanceEstimate({ address: "Av. Central, São José dos Pinhais - PR" }, { city: "São José dos Pinhais", state: "PR" }), 0);
  assert.equal(PlatformService.distanceEstimate({ address: "Rua sem cidade reconhecida, 10" }, curitiba), null);
  assert.equal(PlatformService.hasLocationCoordinates({ city: "Curitiba", state: "SP" }), false);
});
