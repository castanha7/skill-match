import assert from "node:assert/strict";
import test from "node:test";
import { safeReturnPath } from "../assets/js/utils/navigation.js";

test("retorno do login permite apenas páginas locais aprovadas", () => {
  const base = "https://skillmatch.test/login.html?redirect=perfil";
  assert.equal(safeReturnPath(null, base), "painel.html");
  assert.equal(safeReturnPath("perfil", base), "/perfil.html");
  assert.equal(safeReturnPath("/perfil.html?tab=habilidades#editar", base), "/perfil.html?tab=habilidades#editar");
  assert.equal(safeReturnPath("painel", base), "/painel.html");
  assert.equal(safeReturnPath("https://evil.example/phishing", base), "painel.html");
  assert.equal(safeReturnPath("//evil.example/phishing", base), "painel.html");
  assert.equal(safeReturnPath("admin.html", base), "painel.html");
  assert.equal(safeReturnPath("../perfil.html", base), "/perfil.html");
});
