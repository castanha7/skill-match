import jwt from 'jsonwebtoken';
import { getPool } from '../services/db.js';

export async function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Autenticação necessária.' });
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }
  try {
    const [rows] = await getPool().execute('SELECT role,status FROM users WHERE id=? LIMIT 1', [claims.sub]);
    const user = rows[0];
    if (!user || user.status !== 'active' || user.role !== claims.role) {
      return res.status(401).json({ message: 'Conta indisponível. Entre novamente para continuar.' });
    }
    req.user = { ...claims, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'Você não tem permissão para esta ação.' });
}
