import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../services/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const filtersSchema = z.object({
  skill: z.string().trim().max(100).optional(),
  education: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
});
const uuid = z.string().uuid();

async function companyForUser(pool, userId) {
  const [rows] = await pool.execute(`SELECT c.id FROM companies c JOIN users u ON u.id=c.owner_user_id
    WHERE c.owner_user_id=? AND u.role='company' AND u.status='active' AND c.verified_at IS NOT NULL LIMIT 1`, [userId]);
  return rows[0]?.id || null;
}

async function authorizeVisibleCandidate(pool, companyId, candidateId) {
  const [rows] = await pool.execute(`SELECT p.user_id FROM candidate_profiles p JOIN users u ON u.id=p.user_id
    WHERE p.user_id=? AND u.role='candidate' AND u.status='active' AND p.visibility=TRUE
      AND NOT EXISTS (SELECT 1 FROM connections c WHERE c.company_id=? AND c.candidate_user_id=p.user_id AND c.status='blocked')
    LIMIT 1`, [candidateId, companyId]);
  return rows.length > 0;
}

router.use(authenticate);
router.use((req, res, next) => req.user.role === 'company'
  ? next()
  : res.status(403).json({ message: 'O banco de talentos é exclusivo para empresas.' }));

router.get('/', async (req, res, next) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Filtros inválidos.' });
  try {
    const pool = getPool();
    const companyId = await companyForUser(pool, req.user.sub);
    if (!companyId) return res.status(403).json({ message: 'Perfil empresarial não encontrado.' });
    const clauses = ["u.role='candidate'", "u.status='active'", 'p.visibility=TRUE',
      'NOT EXISTS (SELECT 1 FROM connections blocked WHERE blocked.company_id=? AND blocked.candidate_user_id=u.id AND blocked.status=\'blocked\')'];
    const params = [companyId];
    if (parsed.data.skill) { clauses.push('CAST(p.skills AS CHAR) LIKE ?'); params.push(`%${parsed.data.skill}%`); }
    if (parsed.data.education) { clauses.push('p.education LIKE ?'); params.push(`%${parsed.data.education}%`); }
    if (parsed.data.city) { clauses.push('(p.city LIKE ? OR p.state LIKE ?)'); params.push(`%${parsed.data.city}%`, `%${parsed.data.city}%`); }
    const [candidates] = await pool.execute(`SELECT u.id AS candidateId,u.name,p.city,p.state,p.education,p.interests,p.skills,p.courses,p.experience,p.availability
      FROM candidate_profiles p JOIN users u ON u.id=p.user_id
      WHERE ${clauses.join(' AND ')} ORDER BY p.updated_at DESC LIMIT 100`, params);
    res.json({ candidates, count: candidates.length, contactDetailsIncluded: false });
  } catch (error) { next(error); }
});

router.get('/saved', async (req, res, next) => {
  try {
    const pool = getPool();
    const companyId = await companyForUser(pool, req.user.sub);
    if (!companyId) return res.status(403).json({ message: 'Perfil empresarial não encontrado.' });
    const [candidates] = await pool.execute(`SELECT u.id AS candidateId,u.name,p.city,p.state,p.education,p.skills,p.courses
      FROM company_saved_talents s JOIN users u ON u.id=s.candidate_user_id
      JOIN candidate_profiles p ON p.user_id=u.id
      WHERE s.company_id=? AND u.status='active' AND p.visibility=TRUE
        AND NOT EXISTS (SELECT 1 FROM connections blocked WHERE blocked.company_id=s.company_id AND blocked.candidate_user_id=u.id AND blocked.status='blocked')
      ORDER BY s.created_at DESC`, [companyId]);
    res.json({ candidates });
  } catch (error) { next(error); }
});

router.get('/:candidateId', async (req, res, next) => {
  const candidateId = uuid.safeParse(req.params.candidateId);
  if (!candidateId.success) return res.status(400).json({ message: 'Identificador de candidato inválido.' });
  try {
    const pool = getPool();
    const companyId = await companyForUser(pool, req.user.sub);
    if (!companyId) return res.status(403).json({ message: 'Perfil empresarial não encontrado.' });
    const [accessRows] = await pool.execute(`SELECT p.visibility,
        EXISTS(SELECT 1 FROM connections c WHERE c.company_id=? AND c.candidate_user_id=p.user_id AND c.status='connected') AS connected,
        EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_user_id=p.user_id AND j.company_id=?) AS applied,
        EXISTS(SELECT 1 FROM connections b WHERE b.company_id=? AND b.candidate_user_id=p.user_id AND b.status='blocked') AS blocked
      FROM candidate_profiles p JOIN users u ON u.id=p.user_id
      WHERE p.user_id=? AND u.role='candidate' AND u.status='active' LIMIT 1`, [companyId, companyId, companyId, candidateId.data]);
    const access = accessRows[0];
    if (!access || access.blocked || (!access.visibility && !access.connected && !access.applied)) return res.status(404).json({ message: 'Este perfil não está disponível para sua empresa.' });
    const [rows] = await pool.execute(`SELECT u.id AS candidateId,u.name,p.city,p.state,p.education,p.interests,p.skills,p.courses,p.experience,p.availability,u.email
      FROM candidate_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? LIMIT 1`, [candidateId.data]);
    const candidate = rows[0];
    const canShareContact = Boolean(access.visibility && (access.connected || access.applied));
    if (!canShareContact) delete candidate.email;
    res.json({ candidate, contactShared: canShareContact });
  } catch (error) { next(error); }
});

router.post('/:candidateId/saved', async (req, res, next) => {
  const candidateId = uuid.safeParse(req.params.candidateId);
  if (!candidateId.success) return res.status(400).json({ message: 'Identificador de candidato inválido.' });
  try {
    const pool = getPool();
    const companyId = await companyForUser(pool, req.user.sub);
    if (!companyId) return res.status(403).json({ message: 'Perfil empresarial não encontrado.' });
    if (!(await authorizeVisibleCandidate(pool, companyId, candidateId.data))) return res.status(404).json({ message: 'Este perfil não está disponível para a lista de talentos.' });
    await pool.execute('INSERT INTO company_saved_talents (company_id,candidate_user_id) VALUES (?,?)', [companyId, candidateId.data]);
    res.status(201).json({ saved: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este candidato já está salvo.' });
    next(error);
  }
});

router.delete('/:candidateId/saved', async (req, res, next) => {
  const candidateId = uuid.safeParse(req.params.candidateId);
  if (!candidateId.success) return res.status(400).json({ message: 'Identificador de candidato inválido.' });
  try {
    const pool = getPool();
    const companyId = await companyForUser(pool, req.user.sub);
    if (!companyId) return res.status(403).json({ message: 'Perfil empresarial não encontrado.' });
    await pool.execute('DELETE FROM company_saved_talents WHERE company_id=? AND candidate_user_id=?', [companyId, candidateId.data]);
    res.json({ saved: false });
  } catch (error) { next(error); }
});

export default router;
