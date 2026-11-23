import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getPool } from '../services/db.js';
import { authenticate } from '../middleware/auth.js';
import { isValidCnpj, normalizeCnpj } from '../../../shared/cnpj.js';

const router = Router();
const cnpjSchema = z.string().trim().min(1).max(18).refine(isValidCnpj, 'Informe um CNPJ com dígitos verificadores válidos.');
const registerSchema = z.object({
  role: z.enum(['candidate', 'company']).default('candidate'),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
  profile: z.object({ city: z.string().max(120).optional(), state: z.string().length(2).optional(), education: z.string().max(160).optional(), interests: z.array(z.string().max(100)).max(30).optional(), skills: z.array(z.string().max(100)).max(60).optional(), availability: z.string().max(120).optional() }).optional(),
  company: z.object({ name: z.string().trim().min(2).max(180), cnpj: cnpjSchema, sector: z.string().max(120).optional(), city: z.string().max(120).optional(), state: z.string().length(2).optional(), website: z.string().url().max(2048).optional().or(z.literal('')) }).optional(),
});
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128), role: z.enum(['candidate', 'company', 'admin']).optional() });
function publicUser(row) { return { id: row.id, name: row.name, email: row.email, role: row.role, ...(row.company_id || row.companyId ? { companyId: row.company_id || row.companyId } : {}) }; }
function sign(row) { return jwt.sign({ sub: row.id, role: row.role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '2h' }); }

router.post('/register', async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira os campos enviados.', errors: parsed.error.flatten().fieldErrors });
  const input = parsed.data;
  if (input.role === 'company' && !input.company) return res.status(400).json({ message: 'Informe os dados básicos da empresa.' });
  if (input.role === 'candidate' && input.company) return res.status(400).json({ message: 'Dados empresariais não se aplicam a este perfil.' });
  const companyCnpj = input.role === 'company' ? normalizeCnpj(input.company.cnpj) : null;
  const pool = getPool();
  const connection = await pool.getConnection();
  const id = randomUUID();
  const companyId = input.role === 'company' ? randomUUID() : null;
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id FROM users WHERE email=? LIMIT 1', [input.email.toLowerCase()]);
    if (existing.length) { await connection.rollback(); return res.status(409).json({ message: 'Este e-mail já está cadastrado.' }); }
    if (companyCnpj) {
      const [existingCompanies] = await connection.execute('SELECT id FROM companies WHERE cnpj=? LIMIT 1', [companyCnpj]);
      if (existingCompanies.length) { await connection.rollback(); return res.status(409).json({ message: 'Este CNPJ já está cadastrado.' }); }
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    await connection.execute('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)', [id, input.name, input.email.toLowerCase(), passwordHash, input.role]);
    if (input.role === 'candidate') {
      const profile = input.profile || {};
      await connection.execute('INSERT INTO candidate_profiles (user_id,city,state,education,interests,skills,availability) VALUES (?,?,?,?,?,?,?)', [id, profile.city || null, profile.state?.toUpperCase() || null, profile.education || null, JSON.stringify(profile.interests || []), JSON.stringify(profile.skills || []), profile.availability || null]);
    } else {
      const company = input.company;
      await connection.execute('INSERT INTO companies (id,owner_user_id,name,cnpj,sector,city,state,website) VALUES (?,?,?,?,?,?,?,?)', [companyId, id, company.name, companyCnpj, company.sector || null, company.city || null, company.state?.toUpperCase() || null, company.website || null]);
    }
    await connection.commit();
    const row = { id, name: input.name, email: input.email.toLowerCase(), role: input.role, companyId };
    res.status(201).json({ user: publicUser(row), token: sign(row) });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY' && String(error.message).includes('uq_companies_cnpj')) {
      return res.status(409).json({ message: 'Este CNPJ já está cadastrado.' });
    }
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    next(error);
  } finally { connection.release(); }
});

router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Informe e-mail e senha válidos.' });
  try {
    const [rows] = await getPool().execute(`SELECT u.id,u.name,u.email,u.password_hash,u.role,u.status,c.id AS company_id
      FROM users u LEFT JOIN companies c ON c.owner_user_id=u.id WHERE u.email=? LIMIT 1`, [parsed.data.email.toLowerCase()]);
    const user = rows[0];
    if (!user || user.status !== 'active' || (parsed.data.role && parsed.data.role !== user.role) || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }
    res.json({ user: publicUser(user), token: sign(user) });
  } catch (error) { next(error); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await getPool().execute(`SELECT u.id,u.name,u.email,u.role,u.status,c.id AS company_id
      FROM users u LEFT JOIN companies c ON c.owner_user_id=u.id WHERE u.id=? LIMIT 1`, [req.user.sub]);
    if (!rows[0] || rows[0].status !== 'active') return res.status(401).json({ message: 'Conta indisponível.' });
    res.json({ user: publicUser(rows[0]) });
  } catch (error) { next(error); }
});
export default router;
