import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewInterviewAnswer } from '../src/services/interview-ai.js';
import { reviewSchema } from '../src/routes/interviews.js';

const input = {
  jobType: 'Primeiro Emprego',
  experienceLevel: 'Primeira oportunidade',
  targetRole: 'Atendimento',
  question: 'Conte sobre uma situação em que trabalhou em equipe.',
  answer: 'Na escola organizei as tarefas do grupo e combinei os próximos passos com meus colegas.',
  skills: ['Comunicação', 'Organização'],
};
const validFeedback = {
  strengths: ['Você apresentou um exemplo concreto.'],
  improvements: ['Explique qual foi o resultado.'],
  clarity: 'A sequência é compreensível.',
  communication: 'A resposta mantém um tom respeitoso.',
  objectivity: 'O exemplo está relacionado à pergunta.',
  skillPresentation: 'Você citou organização em contexto.',
  suggestedStructure: 'Contexto, ação e resultado podem ajudar a organizar a resposta.',
  nextPractice: 'Pratique acrescentando o que aprendeu.',
};

test('a solicitação de análise exige consentimento explícito para processamento externo', () => {
  assert.equal(reviewSchema.safeParse({ ...input, consentToExternalProcessing: false }).success, false);
  assert.equal(reviewSchema.safeParse({ ...input, consentToExternalProcessing: true }).success, true);
});

function setProviderConfiguration() {
  process.env.AI_PROVIDER_URL = 'https://ai.example.test/v1/chat/completions';
  process.env.AI_PROVIDER_TOKEN = 'test-secret-not-a-real-credential';
  process.env.AI_PROVIDER_MODEL = 'test-model';
}

test('sem provedor configurado, a análise fica indisponível e não tenta uma chamada externa', async (t) => {
  const original = {
    url: process.env.AI_PROVIDER_URL,
    token: process.env.AI_PROVIDER_TOKEN,
    model: process.env.AI_PROVIDER_MODEL,
  };
  delete process.env.AI_PROVIDER_URL;
  delete process.env.AI_PROVIDER_TOKEN;
  delete process.env.AI_PROVIDER_MODEL;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('fetch não deveria ser chamado');
  t.after(() => {
    for (const [key, value] of Object.entries({ AI_PROVIDER_URL: original.url, AI_PROVIDER_TOKEN: original.token, AI_PROVIDER_MODEL: original.model })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
  });
  await assert.rejects(reviewInterviewAnswer(input), (error) => error.status === 503 && /não configurada/i.test(error.message));
});

test('envia somente conteúdo necessário ao provedor configurado e valida o JSON educativo', async (t) => {
  setProviderConfiguration();
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validFeedback) } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await reviewInterviewAnswer(input);
  assert.equal(request.url, process.env.AI_PROVIDER_URL);
  assert.equal(request.options.headers.Authorization, `Bearer ${process.env.AI_PROVIDER_TOKEN}`);
  assert.equal(request.body.model, process.env.AI_PROVIDER_MODEL);
  assert.deepEqual(JSON.parse(request.body.messages[1].content), {
    opportunityType: input.jobType,
    experienceLevel: input.experienceLevel,
    targetRole: input.targetRole,
    question: input.question,
    answer: input.answer,
    candidateSkills: input.skills,
  });
  assert.equal(request.body.messages[1].content.includes('candidate@example.com'), false);
  assert.equal(result.provider, 'test-model');
  assert.deepEqual(result.strengths, validFeedback.strengths);
});

test('recusa conteúdo malformado ou feedback fora do contrato', async (t) => {
  setProviderConfiguration();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{not json' } }] }), { status: 200 });
  t.after(() => { globalThis.fetch = originalFetch; });
  await assert.rejects(reviewInterviewAnswer(input), (error) => error.status === 502 && /validada/i.test(error.message));
});

test('exige HTTPS para provedor remoto', async (t) => {
  const originalUrl = process.env.AI_PROVIDER_URL;
  const originalToken = process.env.AI_PROVIDER_TOKEN;
  const originalModel = process.env.AI_PROVIDER_MODEL;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.AI_PROVIDER_URL = 'http://ai.example.test/v1/chat/completions';
  process.env.AI_PROVIDER_TOKEN = 'configured';
  process.env.AI_PROVIDER_MODEL = 'test-model';
  process.env.NODE_ENV = 'production';
  t.after(() => {
    for (const [key, value] of Object.entries({ AI_PROVIDER_URL: originalUrl, AI_PROVIDER_TOKEN: originalToken, AI_PROVIDER_MODEL: originalModel, NODE_ENV: originalNodeEnv })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  await assert.rejects(reviewInterviewAnswer(input), (error) => error.status === 503 && /HTTPS/i.test(error.message));
});
