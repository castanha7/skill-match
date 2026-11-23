import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const configUrl = pathToFileURL(resolve(process.cwd(), 'assets/js/config/app.config.js')).href;
let importSequence = 0;

test('o frontend usa API por padrão e só ativa fixtures locais em modo explícito', async () => {
  const priorConfig = globalThis.SKILLMATCH_CONFIG;
  const priorDocument = globalThis.document;
  try {
    globalThis.document = {
      location: { origin: 'https://skillmatch.example' },
      querySelector: () => null,
    };
    globalThis.SKILLMATCH_CONFIG = {};
    const { APP_CONFIG: apiConfig } = await import(`${configUrl}?test=${++importSequence}`);
    assert.equal(apiConfig.useApi, true);
    assert.equal(apiConfig.demoMode, false);
    assert.equal(apiConfig.apiBaseUrl, 'https://skillmatch.example');

    globalThis.SKILLMATCH_CONFIG = { mode: 'demo' };
    const { APP_CONFIG: demoConfig } = await import(`${configUrl}?test=${++importSequence}`);
    assert.equal(demoConfig.useApi, false);
    assert.equal(demoConfig.demoMode, true);
  } finally {
    if (priorConfig === undefined) delete globalThis.SKILLMATCH_CONFIG;
    else globalThis.SKILLMATCH_CONFIG = priorConfig;
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  }
});

test('demonstração escolhida na aba usa sessão separada da API', async () => {
  const priorStorage = globalThis.sessionStorage;
  const priorConfig = globalThis.SKILLMATCH_CONFIG;
  try {
    globalThis.SKILLMATCH_CONFIG = {};
    globalThis.sessionStorage = { getItem: (key) => key === 'skillmatch:demo-mode' ? 'true' : null };
    const { APP_CONFIG: demo } = await import(`${configUrl}?test=${++importSequence}`);
    assert.equal(demo.demoMode, true);
    assert.equal(demo.storageKeys.session, 'skillmatch:demo-session');
    globalThis.sessionStorage = { getItem: () => null };
    const { APP_CONFIG: api } = await import(`${configUrl}?test=${++importSequence}`);
    assert.equal(api.useApi, true);
    assert.equal(api.storageKeys.session, 'skillmatch:session');
  } finally {
    if (priorStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = priorStorage;
    if (priorConfig === undefined) delete globalThis.SKILLMATCH_CONFIG;
    else globalThis.SKILLMATCH_CONFIG = priorConfig;
  }
});
