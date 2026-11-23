import assert from "node:assert/strict";
import test from "node:test";
import { formatCnpj, isValidCnpj, normalizeCnpj } from "../shared/cnpj.js";
import { Validators } from "../assets/js/utils/validators.js";

test("CNPJ verifica dígitos numéricos e alfanuméricos sem alegar existência cadastral", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(Validators.cnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11.222.333/0001-80"), false, "deve rejeitar dígito verificador alterado");
  assert.equal(isValidCnpj("00.000.000/0000-00"), false, "deve rejeitar sequência repetida");
  assert.equal(isValidCnpj("11.222.333/0001-8"), false, "deve exigir 14 caracteres");

  // Vetor alfanumérico calculado pelo mesmo algoritmo oficial dos dígitos verificadores.
  assert.equal(isValidCnpj("12.ABC.345/01DE-35"), true);
  assert.equal(isValidCnpj("12.ABC.345/01DE-36"), false);
  assert.equal(normalizeCnpj("12.abc.345/01de-35"), "12ABC34501DE35");
  assert.equal(formatCnpj("12ABC34501DE35"), "12.ABC.345/01DE-35");
});
