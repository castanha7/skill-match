import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(String(key)) ?? null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
}

test('migra a preferência antiga de visibilidade para privada sem descartar outros dados', async () => {
  globalThis.localStorage = new MemoryStorage();
  const [{ APP_CONFIG }, { PlatformService }] = await Promise.all([
    import('../assets/js/config/app.config.js'),
    import('../assets/js/services/platform.service.js'),
  ]);
  const oldState = {
    version: 1,
    preferences: {
      'legacy-candidate': { visibleToCompanies: true, distanceMaxKm: 25, radarCity: 'Araucária' },
    },
  };
  localStorage.setItem(APP_CONFIG.storageKeys.platform, JSON.stringify(oldState));

  PlatformService.init();
  const migrated = JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.platform));
  assert.equal(migrated.version, 2);
  assert.equal(PlatformService.getCandidateSettings('legacy-candidate').visibleToCompanies, false);
  assert.equal(PlatformService.getCandidateSettings('legacy-candidate').distanceMaxKm, 25);
  assert.equal(PlatformService.getCandidateSettings('legacy-candidate').radarCity, 'Araucária');

  localStorage.setItem(APP_CONFIG.storageKeys.platform, JSON.stringify({
    version: 2, companies: [], jobs: [{ id: 'job-demo-ti' }], applications: [], favorites: [],
    connections: [], messages: [], savedTalents: [], interviewHistory: [], notifications: [],
    preferences: {}, reports: [], ads: [],
  }));
  PlatformService.init();
  const migratedJob = PlatformService.getAllJobs().find((job) => job.id === 'job-demo-ti');
  assert.equal(migratedJob.salaryMin, 1200);
  assert.equal(migratedJob.salaryMax, 1800);
});
