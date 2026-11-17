import { createHash, randomUUID } from 'node:crypto';
import { getPool } from './db.js';

const safeSource = (raw) => {
  try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
};
const sqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19).replace('T', ' ');
};
const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const dedupeKeyFor = (job) => createHash('sha256').update([
  normalize(job.companyName), normalize(job.title), normalize(job.city), normalize(job.state), normalize(job.employmentType),
].join('|')).digest('hex');
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Provider contract: authorized vendor returns { results: [{ companyName, title,
 * description, city, state, requirements, education, employmentType, modality,
 * sourceName, sourceUrl, publishedAt, availability, verifiedAt, externalId }] }.
 * We do not scrape search-engine result pages. Missing verification remains unverified.
 */
export async function searchAuthorizedProvider({ city, state, radiusKm, interests = [] }) {
  const endpoint = process.env.SEARCH_PROVIDER_URL;
  const token = process.env.SEARCH_PROVIDER_TOKEN;
  if (!endpoint || !token) {
    const error = new Error('Busca externa não configurada. Configure um provedor autorizado no backend.');
    error.status = 503;
    throw error;
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ location: { city, state, radiusKm }, query: interests, categories: ['primeiro emprego', 'jovem aprendiz', 'estágio', 'sem experiência'] }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const error = new Error(`O serviço de busca respondeu com HTTP ${response.status}.`);
    error.status = 502;
    throw error;
  }
  const payload = await response.json();
  const results = Array.isArray(payload) ? payload : payload.results;
  if (!Array.isArray(results)) throw Object.assign(new Error('Formato inválido retornado pelo serviço de busca.'), { status: 502 });
  return results.slice(0, 100).map((raw) => {
    const sourceUrl = safeSource(raw.sourceUrl);
    const verifiedAt = sqlDate(raw.verifiedAt);
    const sourcePublishedAt = sqlDate(raw.publishedAt);
    const activeUntil = sqlDate(raw.expiresAt);
    const isExpired = activeUntil && new Date(`${activeUntil}Z`).getTime() <= Date.now();
    const verified = raw.availability === 'active' && verifiedAt && sourceUrl && !isExpired;
    const status = raw.availability === 'closed' || isExpired ? 'possibly_closed' : (verified ? 'confirmed' : 'unverified');
    return {
      companyName: clean(raw.companyName), title: clean(raw.title), description: clean(raw.description, 8000),
      city: clean(raw.city, 120), state: clean(raw.state, 2).toUpperCase(), education: clean(raw.education, 180),
      employmentType: clean(raw.employmentType, 80), modality: clean(raw.modality, 40),
      requirements: Array.isArray(raw.requirements) ? raw.requirements.map((item) => clean(item, 120)).filter(Boolean).slice(0, 30) : [],
      sourceName: clean(raw.sourceName, 180) || 'Fonte não informada', sourceUrl,
      sourcePublishedAt, lastVerifiedAt: verified ? verifiedAt : null, activeUntil,
      status, externalId: clean(raw.externalId, 255) || null,
    };
  }).filter((job) => job.companyName && job.title && job.description && job.sourceUrl);
}

export async function upsertDiscoveredJobs(jobs) {
  if (!jobs.length) return [];
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ids = [];
    for (const job of jobs) {
      const id = randomUUID();
      const dedupeKey = dedupeKeyFor(job);
      await connection.execute(
        `INSERT INTO jobs (id, company_name, title, description, city, state, education, employment_type, modality,
          requirements, source_name, source_url, source_published_at, last_verified_at, status, dedupe_key, external_id, active_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY)))
         ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), title=VALUES(title), description=VALUES(description), city=VALUES(city), state=VALUES(state), requirements=VALUES(requirements),
           source_name=VALUES(source_name), source_url=VALUES(source_url), source_published_at=COALESCE(VALUES(source_published_at), source_published_at),
           last_verified_at=COALESCE(VALUES(last_verified_at), last_verified_at), status=VALUES(status), active_until=VALUES(active_until), updated_at=CURRENT_TIMESTAMP`,
        [id, job.companyName, job.title, job.description, job.city, job.state, job.education || null, job.employmentType || null,
          job.modality || null, JSON.stringify(job.requirements), job.sourceName, job.sourceUrl, job.sourcePublishedAt || null,
          job.lastVerifiedAt || null, job.status, dedupeKey, job.externalId, job.activeUntil],
      );
      const [rows] = await connection.execute('SELECT id FROM jobs WHERE dedupe_key=?', [dedupeKey]);
      ids.push(rows[0].id);
    }
    await connection.commit();
    return ids;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
