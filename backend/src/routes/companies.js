import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../services/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
const searchSchema = z.object({
  search: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).optional(),
}).strict();

router.get('/', async (req, res, next) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Filtros empresariais inválidos.' });
  const where = ['u.role=\'company\'', 'u.status=\'active\'', 'c.verified_at IS NOT NULL'];
  const params = [];
  if (parsed.data.search) {
    where.push('(c.name LIKE ? OR c.sector LIKE ? OR c.description LIKE ?)');
    const term = `%${parsed.data.search}%`;
    params.push(term, term, term);
  }
  if (parsed.data.city) { where.push('c.city LIKE ?'); params.push(`%${parsed.data.city}%`); }
  if (parsed.data.state) { where.push('c.state=?'); params.push(parsed.data.state.toUpperCase()); }
  try {
    const [companies] = await getPool().execute(`SELECT c.id,c.name,c.sector,c.description,c.city,c.state,c.website,
        c.verified_at AS verifiedAt
      FROM companies c JOIN users u ON u.id=c.owner_user_id
      WHERE ${where.join(' AND ')} ORDER BY c.name ASC LIMIT 100`, params);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120').json({ companies });
  } catch (error) { next(error); }
});

router.get('/mine', authenticate, allowRoles('company'), async (req, res, next) => {
  try {
    const [rows] = await getPool().execute(`SELECT c.id,c.name,c.cnpj,c.sector,c.description,c.city,c.state,c.website,
        c.verified_at AS verifiedAt,c.created_at AS createdAt
      FROM companies c JOIN users u ON u.id=c.owner_user_id
      WHERE c.owner_user_id=? AND u.status='active' LIMIT 1`, [req.user.sub]);
    if (!rows.length) return res.status(404).json({ message: 'Perfil empresarial não encontrado.' });
    res.json({ company: rows[0] });
  } catch (error) { next(error); }
});

export default router;
