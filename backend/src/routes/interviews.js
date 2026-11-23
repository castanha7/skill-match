import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getPool } from '../services/db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { reviewInterviewAnswer } from '../services/interview-ai.js';

const router = Router();
export const reviewSchema = z.object({
  jobType: z.enum(['Jovem Aprendiz', 'Estágio', 'Primeiro Emprego', 'Trainee']),
  experienceLevel: z.enum(['Primeira oportunidade', 'Tenho projetos ou atividades', 'Já tive experiência formal']),
  targetRole: z.string().trim().max(120).optional().default(''),
  question: z.string().trim().min(10).max(500),
  answer: z.string().trim().min(10).max(4000),
  skills: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  consentToExternalProcessing: z.literal(true),
});
const reviewRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

router.get('/mine', authenticate, allowRoles('candidate'), async (req, res, next) => {
  try {
    const [sessions] = await getPool().execute(`SELECT id,job_type AS jobType,experience_level AS experienceLevel,
        target_role AS targetRole,question,answer,feedback,provider,ai_consent_at AS consentedAt,created_at AS createdAt
      FROM interview_sessions WHERE candidate_user_id=? ORDER BY created_at DESC LIMIT 30`, [req.user.sub]);
    res.json({ sessions });
  } catch (error) { next(error); }
});

router.post('/feedback', reviewRateLimit, authenticate, allowRoles('candidate'), async (req, res, next) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Revise a pergunta e a resposta antes de pedir a análise.', errors: parsed.error.flatten().fieldErrors });
  try {
    const input = parsed.data;
    const feedback = await reviewInterviewAnswer(input);
    const id = randomUUID();
    await getPool().execute(`INSERT INTO interview_sessions
        (id,candidate_user_id,job_type,experience_level,target_role,question,answer,feedback,provider,ai_consent_at)
      VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`, [
      id, req.user.sub, input.jobType, input.experienceLevel, input.targetRole || null,
      input.question, input.answer, JSON.stringify(feedback), 'configured-ai',
    ]);
    res.status(201).json({ session: { id, ...input, feedback, provider: 'configured-ai', createdAt: new Date().toISOString() } });
  } catch (error) { next(error); }
});

export default router;
