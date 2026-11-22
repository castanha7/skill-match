import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import { getPool, closePool } from './services/db.js';
import { searchAuthorizedProvider, upsertDiscoveredJobs } from './services/opportunity-search.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
const app = express();
app.disable('x-powered-by');
app.use(helmet());
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map((item) => item.trim());
app.use(cors({ origin(origin, callback) { if (!origin || origins.includes(origin)) return callback(null, true); return callback(new Error('Origem não autorizada pelo CORS.')); }, methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization'], maxAge: 600 }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }), authRoutes);
app.use('/api/jobs', jobRoutes);
app.get('/api/health', async (_req, res) => {
  try { await getPool().query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'degraded', database: 'unavailable' }); }
});
app.use((_req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
app.use((error, _req, res, _next) => {
  console.error('[api]', error.message);
  const status = Number(error.status) || 500;
  res.status(status).json({ message: status >= 500 ? 'Não foi possível concluir a solicitação.' : error.message });
});

const schedule = process.env.DISCOVERY_CRON || '0 7 * * *';
const cities = (process.env.DISCOVERY_CITIES || '').split(',').map((value) => {
  const [city, state] = value.trim().split(':');
  return city && state ? { city, state } : null;
}).filter(Boolean);
if (cities.length && process.env.SEARCH_PROVIDER_URL && process.env.SEARCH_PROVIDER_TOKEN && cron.validate(schedule)) {
  cron.schedule(schedule, async () => {
    for (const city of cities) {
      try {
        const found = await searchAuthorizedProvider({ ...city, radiusKm: 25, interests: ['primeiro emprego','jovem aprendiz','estágio','sem experiência'] });
        await upsertDiscoveredJobs(found);
        console.info(`[discovery] ${city.city}/${city.state}: ${found.length} registro(s) atualizados.`);
      } catch (error) { console.error(`[discovery] ${city.city}/${city.state}: ${error.message}`); }
    }
  }, { timezone: 'America/Sao_Paulo' });
} else {
  console.info('[discovery] Agendamento desativado; configure provedor autorizado e DISCOVERY_CITIES para ativar.');
}

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => console.info(`SkillMatch API ouvindo na porta ${port}.`));
async function shutdown() { server.close(async () => { await closePool(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
