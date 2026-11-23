import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/supabase-auth.js';
import platformRoutes from './routes/supabase-platform.js';
import aiRoutes from './routes/supabase-ai.js';
import { createAnonymousClient, isSupabaseConfigured } from './services/supabase.js';

const app = express();
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicPages = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/login.html', 'login.html'],
  ['/cadastro.html', 'cadastro.html'],
  ['/cadastro-empresa.html', 'cadastro-empresa.html'],
  ['/painel.html', 'painel.html'],
  ['/perfil.html', 'perfil.html'],
  ['/privacidade.html', 'privacidade.html'],
  ['/termos.html', 'termos.html'],
  ['/auth-callback.html', 'auth-callback.html'],
]);
app.disable('x-powered-by');
const proxyHops = Number(process.env.TRUST_PROXY || 0);
app.set('trust proxy', Number.isInteger(proxyHops) && proxyHops >= 0 ? proxyHops : false);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',').map((item) => item.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não autorizada pelo CORS.'));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  maxAge: 600,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }), authRoutes);
app.use('/api', platformRoutes);
app.use('/api/interviews', aiRoutes);
app.get('/api/health', async (_req, res) => {
  if (!isSupabaseConfigured()) return res.status(503).json({ status: 'degraded', database: 'not_configured' });
  try {
    const { error } = await createAnonymousClient().from('jobs').select('id').limit(1);
    if (error) return res.status(503).json({ status: 'degraded', database: 'schema_unavailable' });
    return res.json({ status: 'ok', database: 'connected', provider: 'supabase' });
  } catch {
    return res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

for (const [route, page] of publicPages) {
  app.get(route, (_req, res, next) => res.sendFile(path.join(projectRoot, page), (error) => error && next(error)));
}
app.use('/assets', express.static(path.join(projectRoot, 'assets'), { dotfiles: 'deny', index: false, fallthrough: true }));
app.use('/shared', express.static(path.join(projectRoot, 'shared'), { dotfiles: 'deny', index: false, fallthrough: true }));
app.use((_req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
app.use((error, _req, res, _next) => {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error('[api]', error.code || '', error.message || 'Erro interno');
  return res.status(status).json({
    message: status >= 500 ? (status === 503 ? error.message : 'Não foi possível concluir a solicitação.') : error.message,
    ...(error.details ? { details: error.details } : {}),
  });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => {
  console.info(`SkillMatch API ouvindo na porta ${port}.`);
  if (!isSupabaseConfigured()) console.warn('[config] Supabase não configurado; API autenticada responderá 503.');
});
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
