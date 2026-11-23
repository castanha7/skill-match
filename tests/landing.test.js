import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const root = process.cwd();
const pause = (ms = 20) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

function click(selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `Elemento ausente: ${selector}`);
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return element;
}

test('página pública mostra oportunidades demonstrativas e busca, filtro e acesso funcionam', async () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};

  const script = pathToFileURL(resolve(root, 'assets/js/pages/landing.js')).href;
  await import(`${script}?test=public-catalog`);
  for (let attempt = 0; attempt < 80 && document.querySelector('#publicCatalogGrid').getAttribute('aria-busy') === 'true'; attempt++) await pause();

  assert.equal(document.querySelectorAll('.public-job-card').length, 4);
  const landingCss = readFileSync(resolve(root, 'assets/css/landing.css'), 'utf8');
  assert.doesNotMatch(landingCss, /\.floating-note\s*\{[^}]*\banimation(?:-name)?\s*:/s);
  assert.match(document.querySelector('.public-job-card').textContent, /R\$\s?1\.200/);
  assert.match(document.querySelector('#catalogNotice').textContent, /Nenhuma vaga real foi pesquisada ou confirmada/);
  assert.match(document.querySelector('#publicResultCount').textContent, /4 oportunidades demonstrativas/);

  const keyword = document.querySelector('#publicKeyword');
  keyword.value = 'logística';
  keyword.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.querySelectorAll('.public-job-card').length, 1);
  assert.match(document.querySelector('.public-job-card').textContent, /Araucária/);

  keyword.value = '';
  document.querySelector('#publicLocation').value = 'Curitiba';
  document.querySelector('#publicLocation').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.querySelectorAll('.public-job-card').length, 2);

  document.querySelector('#publicLocation').value = '';
  document.querySelector('#publicLocation').dispatchEvent(new window.Event('input', { bubbles: true }));
  click('.filter-chip[data-filter="Jovem Aprendiz"]');
  assert.equal(document.querySelectorAll('.public-job-card').length, 2);

  click('.public-job-card [data-action="details"]');
  assert.match(document.querySelector('#publicModal').textContent, /vaga não confirmada/i);
  assert.match(document.querySelector('#publicModal').textContent, /Remuneração:/);
  click('#publicModal [data-action="apply"]');
  assert.match(document.querySelector('#publicModal').textContent, /Crie sua conta para seguir/);
  assert.ok(document.querySelector('#publicModal a[href="cadastro.html"]'));
  click('#publicModalClose');
  assert.equal(document.querySelector('#publicModal').hidden, true);

  click('#landingMenuToggle');
  assert.equal(document.querySelector('#landingMenuToggle').getAttribute('aria-expanded'), 'true');
  assert.ok(document.querySelector('#landingNav').classList.contains('open'));
  dom.window.close();
});
