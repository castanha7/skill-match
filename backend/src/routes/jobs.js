import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getPool } from '../services/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { searchAuthorizedProvider, upsertDiscoveredJobs } from '../services/opportunity-search.js';

const router = Router();
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().execute(`SELECT id,company_name AS companyName,title,description,city,state,education,
      employment_type AS type,modality,requirements,source_name AS sourceName,source_url AS sourceUrl,
      source_published_at AS createdAt,last_verified_at AS lastVerifiedAt,status,status AS statusLabel
      FROM jobs WHERE status IN ('confirmed','unverified') AND (active_until IS NULL OR active_until > UTC_TIMESTAMP())
      ORDER BY COALESCE(source_published_at,created_at) DESC LIMIT 200`);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120').json({ jobs: rows });
  } catch (error) { next(error); }
});

const discoverySchema = z.object({ city: z.string().trim().min(2).max(120), state: z.string().trim().length(2), radiusKm: z.number().int().min(1).max(250).default(25), interests: z.array(z.string().max(100)).max(20).default([]) });
router.post('/discovery/search', authenticate, allowRoles('candidate'), async (req, res, next) => {
  const parsed = discoverySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Informe cidade, UF, raio e interesses válidos.' });
  try {
    const results = await searchAuthorizedProvider({ ...parsed.data, state: parsed.data.state.toUpperCase() });
    await upsertDiscoveredJobs(results);
    res.json({ items: results, count: results.length, source: 'authorized-provider', searchedAt: new Date().toISOString(), disclaimer: 'A compatibilidade e disponibilidade dependem das fontes e devem ser confirmadas na publicação original.' });
  } catch (error) { next(error); }
});

router.post('/:jobId/applications', authenticate, allowRoles('candidate'), async (req, res, next) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.jobId)) return res.status(400).json({ message: 'Identificador de vaga inválido.' });
  try {
    const pool = getPool();
    const [jobs] = await pool.execute("SELECT id FROM jobs WHERE id=? AND status IN ('confirmed','unverified') AND (active_until IS NULL OR active_until>UTC_TIMESTAMP())", [req.params.jobId]);
    if (!jobs.length) return res.status(404).json({ message: 'Esta oportunidade não está disponível.' });
    const id = randomUUID();
    await pool.execute('INSERT INTO applications (id,candidate_user_id,job_id) VALUES (?,?,?)', [id, req.user.sub, req.params.jobId]);
    res.status(201).json({ application: { id, jobId: req.params.jobId, status: 'submitted', appliedAt: new Date().toISOString() } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Você já registrou interesse nesta oportunidade.' });
    next(error);
  }
});
router.get('/applications/mine', authenticate, allowRoles('candidate'), async (req, res, next) => {
  try {
    const [rows] = await getPool().execute(`SELECT a.id,a.job_id AS jobId,j.company_name AS company,j.title,a.status,a.applied_at AS appliedAt
      FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_user_id=? ORDER BY a.applied_at DESC`, [req.user.sub]);
    res.json({ applications: rows });
  } catch (error) { next(error); }
});
export default router;
