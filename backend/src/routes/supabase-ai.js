import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { reviewInterviewAnswer } from '../services/interview-ai.js';

const router = Router();
const reviewSchema = z.object({
  jobType: z.enum(['Jovem Aprendiz','Estágio','Primeiro Emprego','Trainee']),
  experienceLevel: z.enum(['Primeira oportunidade','Tenho projetos ou atividades','Já tive experiência formal']),
  targetRole: z.string().trim().max(120).optional().default(''),
  questionId: z.string().trim().max(80).optional().default(''),
  question: z.string().trim().min(10).max(1000),
  answer: z.string().trim().min(10).max(4000),
  skills: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  consentToExternalProcessing: z.literal(true),
}).strict();
const aiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

router.post('/feedback', aiRateLimit, authenticate, allowRoles('candidate'), async (req, res, next) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'A autorização é necessária e a pergunta/resposta precisa ser válida.' });
  try {
    const input = parsed.data;
    const feedback = await reviewInterviewAnswer(input);
    const id = randomUUID();
    const row = await req.supabase.from('candidate_interview_sessions').insert({
      id,
      candidate_user_id: req.user.id,
      job_type: input.jobType,
      experience_level: input.experienceLevel,
      target_role: input.targetRole,
      question_id: input.questionId,
      question: input.question,
      answer: input.answer,
      feedback,
      provider: 'configured-ai',
      external_ai_consent_at: new Date().toISOString(),
    }).select('*').single();
    if (row.error) return next(row.error);
    return res.status(201).json({ session: {
      id: row.data.id,
      candidateId: row.data.candidate_user_id,
      jobType: row.data.job_type,
      experienceLevel: row.data.experience_level,
      targetRole: row.data.target_role,
      questionId: row.data.question_id,
      question: row.data.question,
      answer: row.data.answer,
      feedback: row.data.feedback,
      provider: row.data.provider,
      consentedAt: row.data.external_ai_consent_at,
      createdAt: row.data.created_at,
      isDemo: false,
    } });
  } catch (error) { return next(error); }
});

export default router;
