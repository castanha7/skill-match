import { z } from 'zod';

const listSchema = z.array(z.string().trim().min(1).max(500)).max(6);
const feedbackSchema = z.object({
  strengths: listSchema,
  improvements: listSchema,
  clarity: z.string().trim().min(1).max(800),
  communication: z.string().trim().min(1).max(800),
  objectivity: z.string().trim().min(1).max(800),
  skillPresentation: z.string().trim().min(1).max(800),
  suggestedStructure: z.string().trim().min(1).max(1000),
  nextPractice: z.string().trim().min(1).max(800),
}).strict();

function configuration() {
  const endpoint = String(process.env.AI_PROVIDER_URL || '').trim();
  const token = String(process.env.AI_PROVIDER_TOKEN || '').trim();
  const model = String(process.env.AI_PROVIDER_MODEL || '').trim();
  if (!endpoint || !token || !model) {
    const error = new Error('Análise por IA não configurada no servidor.');
    error.status = 503;
    throw error;
  }
  let parsed;
  try { parsed = new URL(endpoint); }
  catch {
    const error = new Error('Endpoint de IA inválido na configuração do servidor.');
    error.status = 503;
    throw error;
  }
  const localDevelopment = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localDevelopment) {
    const error = new Error('O provedor de IA deve usar HTTPS fora do desenvolvimento local.');
    error.status = 503;
    throw error;
  }
  return { endpoint: parsed.href, token, model };
}

export async function reviewInterviewAnswer(input) {
  const { endpoint, token, model } = configuration();
  const prompt = `Você é um orientador acolhedor de prática de entrevistas para jovens. Analise somente a resposta fornecida. Não avalie aptidão, não decida contratação, não infira características sensíveis e não invente realizações. Não atribua nota ou percentual. Use linguagem respeitosa, concreta e encorajadora. Diferencie observações do que o candidato pode tentar; a recomendação é educativa, não um veredito. Retorne exclusivamente um objeto JSON com as chaves strengths (array de strings), improvements (array), clarity (string), communication (string), objectivity (string), skillPresentation (string), suggestedStructure (string) e nextPractice (string). Limite cada array a seis itens e cada texto a poucas frases.`;
  const userContent = {
    opportunityType: input.jobType,
    experienceLevel: input.experienceLevel,
    targetRole: input.targetRole || '',
    question: input.question,
    answer: input.answer,
    candidateSkills: input.skills || [],
  };
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(userContent) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    const error = new Error('O serviço de IA não respondeu. Tente novamente mais tarde.');
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('O serviço de IA recusou ou não concluiu a análise.');
    error.status = 502;
    throw error;
  }
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    const error = new Error('O serviço de IA retornou uma resposta em formato inesperado.');
    error.status = 502;
    throw error;
  }
  let decoded;
  try { decoded = JSON.parse(content); }
  catch {
    const error = new Error('A resposta do serviço de IA não pôde ser validada.');
    error.status = 502;
    throw error;
  }
  const parsed = feedbackSchema.safeParse(decoded);
  if (!parsed.success) {
    const error = new Error('A resposta do serviço de IA não passou pela validação de segurança.');
    error.status = 502;
    throw error;
  }
  return { ...parsed.data, provider: model, reviewedAt: new Date().toISOString() };
}
