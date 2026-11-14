import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";

const pages = ["index.html", "cadastro.html", "painel.html", "perfil.html", "termos.html", "privacidade.html"];
const root = process.cwd();
const isExternalOrSpecial = (value) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);

for (const page of pages) {
  test(`${page}: navegação local e acessibilidade básica`, () => {
    const dom = new JSDOM(readFileSync(resolve(root, page), "utf8"));
    const document = dom.window.document;
    assert.ok(document.querySelector('meta[name="viewport"]'), "A página deve declarar viewport responsivo.");

    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    assert.equal(new Set(ids).size, ids.length, "IDs repetidos podem quebrar rótulos e interações.");

    for (const element of document.querySelectorAll("[src], link[rel=stylesheet][href]")) {
      const value = element.getAttribute("src") || element.getAttribute("href");
      if (!value || isExternalOrSpecial(value)) continue;
      assert.ok(existsSync(resolve(root, value)), `Recurso local não encontrado: ${value}`);
    }

    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      assert.notEqual(href, "#", "Links sem destino não devem parecer interativos.");
      if (!href || isExternalOrSpecial(href)) continue;
      if (href.startsWith("#")) {
        const id = decodeURIComponent(href.slice(1));
        assert.ok(document.getElementById(id), `Âncora sem destino: ${href}`);
      } else {
        const target = href.split(/[?#]/, 1)[0];
        assert.ok(existsSync(resolve(root, target)), `Destino local não encontrado: ${href}`);
      }
    }

    for (const control of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
      const associatedLabel = control.labels?.length || control.closest("label");
      assert.ok(associatedLabel || control.getAttribute("aria-label"), `Controle sem rótulo acessível: ${control.outerHTML}`);
    }

    for (const button of document.querySelectorAll("button")) {
      if (button.textContent.trim()) continue;
      assert.ok(button.getAttribute("aria-label") || button.title, `Botão sem nome acessível: ${button.outerHTML}`);
    }
    dom.window.close();
  });
}
