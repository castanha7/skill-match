import { Router } from 'express';
import { z } from 'zod';
import { isValidCnpj, normalizeCnpj } from '../../../shared/cnpj.js';
import { authenticate } from '../middleware/auth.js';
import { createAdminClient, createAnonymousClient, authSession, getUserProfile, httpError, publicApiUser } from '../services/supabase.js';
import { mapProfile } from '../services/contracts.js';

const router = Router();
const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/);
const companyPasswordSchema = z.string().min(10).max(128).regex(/[A-Za-z]/).regex(/[0-9]/);
const candidateProfileSchema = z.object({
  nome: z.string().trim().min(2).max(160).optional(),
  telefone: z.string().trim().max(40).optional(),
  dataNascimento: z.union([z.string().date(), z.literal('')]).optional(),
  cidade: z.string().trim().max(120).optional(),
  estado: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).optional(),
  escolaridade: z.string().trim().max(160).optional(),
  curso: z.string().trim().max(160).optional(),
  instituicao: z.string().trim().max(180).optional(),
  areaInteresse: z.string().trim().max(120).optional(),
  tiposVaga: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  disponibilidade: z.string().trim().max(120).optional(),
  resumo: z.string().trim().max(3000).optional(),
  habilidades: z.array(z.string().trim().min(1).max(100)).max(60).optional(),
  cursos: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
  experiencias: z.array(z.string().trim().min(1).max(1200)).max(50).optional(),
  linkedin: z.string().trim().max(2048).optional(),
  github: z.string().trim().max(2048).optional(),
  portfolio: z.string().trim().max(2048).optional(),
  visibleToCompanies: z.boolean().optional(),
  contactSharingConsent: z.boolean().optional(),
}).strict();
const companyProfileSchema = z.object({
  name: z.string().trim().min(2).max(180),
  cnpj: z.string().trim().min(1).max(18).refine(isValidCnpj, 'Informe um CNPJ válido.'),
  sector: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().min(20).max(3000),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/),
  website: z.string().trim().max(2048).optional().default(''),
  contactName: z.string().trim().min(2).max(160),
  email: emailSchema,
  password: companyPasswordSchema,
}).strict();
const registrationSchema = z.object({
  role: z.enum(['candidate','company']).default('candidate'),
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  password: passwordSchema,
  termsAccepted: z.literal(true),
  profile: candidateProfileSchema.optional(),
  company: companyProfileSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.role === 'company' && input.company && input.company.password !== input.password) {
    context.addIssue({ code: 'custom', path: ['company', 'password'], message: 'A senha empresarial não corresponde à senha da conta.' });
  }
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128), role: z.enum(['candidate','company','admin']).optional() });
const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema }).strict();
const passwordRecoverySchema = z.object({ newPassword: passwordSchema }).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(20).max(4000) }).strict();
const emailUpdateSchema = z.object({ email: emailSchema }).strict();

function normalizedEmail(value) { return String(value || '').trim().toLowerCase(); }
function redirectUrl() {
  const configured = String(process.env.AUTH_EMAIL_REDIRECT_URL || '').trim();
  if (configured) return configured;
  const origin = String(process.env.FRONTEND_ORIGIN || '').split(',')[0].trim().replace(/\/$/, '');
  return origin ? `${origin}/auth-callback.html` : undefined;
}
function authError(error, fallback = 'Não foi possível concluir a operação de autenticação.') {
  const text = String(error?.message || '');
  if (/already registered|already exists|duplicate/i.test(text)) return httpError('Este e-mail já está cadastrado. Entre ou use a recuperação de senha.', 409);
  if (/invalid login credentials|invalid email or password/i.test(text)) return httpError('E-mail ou senha incorretos.', 401);
  if (/email not confirmed/i.test(text)) return httpError('Confirme seu e-mail pelo link enviado antes de entrar.', 403);
  if (/otp.*(expired|invalid)|token.*(expired|invalid)|expired.*token/i.test(text)) return httpError('Este link expirou ou já foi utilizado. Solicite um novo link.', 400);
  if (error?.status) return error;
  return httpError(fallback, 502);
}
function sessionPayload(data) {
  const session = authSession(data?.session);
  return session ? { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at, token_type: session.token_type } : null;
}
function apiUser(profile, authUser, companyId = null) {
  return publicApiUser({ ...profile, company_id: companyId }, authUser);
}
function fieldMap(profile) {
  const result = {};
  const entries = {
    nome: ['full_name', profile.nome],
    cidade: ['city', profile.cidade],
    estado: ['state', profile.estado?.toUpperCase()],
    escolaridade: ['education_level', profile.escolaridade],
    curso: ['course', profile.curso],
    instituicao: ['institution', profile.instituicao],
    areaInteresse: ['area_interest', profile.areaInteresse],
    tiposVaga: ['opportunity_types', profile.tiposVaga],
    disponibilidade: ['availability', profile.disponibilidade],
    resumo: ['summary', profile.resumo],
    habilidades: ['skills', profile.habilidades],
    cursos: ['courses', profile.cursos],
    experiencias: ['experiences', profile.experiencias],
    linkedin: ['linkedin', profile.linkedin],
    github: ['github', profile.github],
    portfolio: ['portfolio', profile.portfolio],
    visibleToCompanies: ['visible_to_companies', profile.visibleToCompanies],
  };
  for (const [source, [target, value]] of Object.entries(entries)) if (value !== undefined) result[target] = value;
  if (profile.visibleToCompanies !== undefined) result.visibility_consented_at = profile.visibleToCompanies ? new Date().toISOString() : null;
  return result;
}
async function writeCandidateProfile(admin, userId, input) {
  const profile = input || {};
  const row = { user_id: userId, ...fieldMap(profile), updated_at: new Date().toISOString() };
  if (Object.keys(row).length > 2) {
    const { error } = await admin.from('candidate_profiles').upsert(row, { onConflict: 'user_id' });
    if (error) throw authError(error, 'Não foi possível salvar o perfil do candidato.');
  }
  const privatePatch = {};
  if (profile.dataNascimento !== undefined) privatePatch.birth_date = profile.dataNascimento || null;
  if (Object.keys(privatePatch).length) {
    const { error } = await admin.from('candidate_private').update({ ...privatePatch, updated_at: new Date().toISOString() }).eq('user_id', userId);
    if (error) throw authError(error, 'Não foi possível salvar os dados privados do perfil.');
  }
  const contacts = {};
  if (profile.telefone !== undefined) contacts.phone = profile.telefone || null;
  if (profile.contactSharingConsent !== undefined) {
    contacts.contact_sharing_consent = profile.contactSharingConsent;
    contacts.contact_consented_at = profile.contactSharingConsent ? new Date().toISOString() : null;
  }
  if (profile.visibleToCompanies !== undefined && profile.contactSharingConsent === undefined) {
    // The visibility checkbox is the explicit opt-in used by the existing UI;
    // actual contact is still withheld until an application or accepted connection.
    contacts.contact_sharing_consent = profile.visibleToCompanies;
    contacts.contact_consented_at = profile.visibleToCompanies ? new Date().toISOString() : null;
  }
  if (Object.keys(contacts).length) {
    const { error } = await admin.from('candidate_contacts').update({ ...contacts, updated_at: new Date().toISOString() }).eq('user_id', userId);
    if (error) throw authError(error, 'Não foi possível salvar as preferências de contato.');
  }
}
async function fullCandidateForUser(req) {
  const { data: profile, error: profileError } = await req.adminSupabase.from('profiles')
    .select('id,role,status,full_name,terms_accepted_at,created_at,updated_at').eq('id', req.user.id).maybeSingle();
  if (profileError) throw authError(profileError);
  const [{ data: candidate, error: candidateError }, { data: privateData, error: privateError }, { data: contacts, error: contactsError }] = await Promise.all([
    req.adminSupabase.from('candidate_profiles').select('*').eq('user_id', req.user.id).maybeSingle(),
    req.adminSupabase.from('candidate_private').select('birth_date').eq('user_id', req.user.id).maybeSingle(),
    req.adminSupabase.from('candidate_contacts').select('phone,contact_sharing_consent').eq('user_id', req.user.id).maybeSingle(),
  ]);
  for (const error of [candidateError, privateError, contactsError]) if (error) throw authError(error);
  return mapProfile({ ...profile, candidate_profiles: candidate }, { privateData, contacts, email: req.authUser.email });
}
async function fullCompanyForUser(req) {
  const { data: company, error } = await req.adminSupabase.from('company_profiles').select('*').eq('owner_user_id', req.user.id).maybeSingle();
  if (error) throw authError(error);
  if (!company) return null;
  const { data: privateData, error: privateError } = await req.adminSupabase.from('company_private').select('cnpj,address,phone').eq('company_id', company.id).maybeSingle();
  if (privateError) throw authError(privateError);
  return {
    id: req.user.id,
    role: 'company',
    status: req.user.status,
    nome: req.user.name,
    email: req.authUser.email,
    companyId: company.id,
    company: {
      id: company.id, name: company.name, cnpj: privateData?.cnpj || '', sector: company.sector || '',
      description: company.description || '', city: company.city, state: company.state,
      address: privateData?.address || '', website: company.website || '', contactEmail: company.public_contact_email || '',
      phone: privateData?.phone || '', verified: Boolean(company.verified_at), verifiedAt: company.verified_at,
      active: company.active, ownerId: req.user.id, isDemo: false, createdAt: company.created_at,
    },
    criadoEm: req.authUser.created_at,
  };
}

router.post('/register', async (req, res, next) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira os campos enviados e aceite os termos para continuar.', errors: parsed.error.flatten().fieldErrors });
  const input = parsed.data;
  if (input.role === 'company' && !input.company) return res.status(400).json({ message: 'Informe os dados básicos da empresa.' });
  if (input.role === 'candidate' && input.company) return res.status(400).json({ message: 'Dados empresariais não se aplicam a este cadastro.' });
  try {
    const auth = createAnonymousClient();
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const metadata = { full_name: input.role === 'company' ? input.company.contactName : input.name, terms_accepted_at: now };
    const { data, error } = await auth.auth.signUp({
      email: normalizedEmail(input.email),
      password: input.password,
      options: { data: metadata, ...(redirectUrl() ? { emailRedirectTo: redirectUrl() } : {}) },
    });
    if (error || !data?.user) throw authError(error || new Error('Não foi possível criar a conta.'));
    const userId = data.user.id;
    let companyId = null;
    try {
      if (input.role === 'company') {
        const company = input.company;
        const { error: roleError } = await admin.from('profiles').update({ role: 'company', full_name: company.contactName, terms_accepted_at: now }).eq('id', userId);
        if (roleError) throw authError(roleError, 'Não foi possível preparar a conta empresarial.');
        const { data: companyRow, error: companyError } = await admin.from('company_profiles').insert({
          owner_user_id: userId,
          name: company.name,
          sector: company.sector || null,
          description: company.description,
          city: company.city,
          state: company.state.toUpperCase(),
          website: company.website || null,
          public_contact_email: normalizedEmail(company.email),
        }).select('id').single();
        if (companyError) throw authError(companyError, 'Não foi possível salvar o cadastro empresarial.');
        companyId = companyRow.id;
        const { error: privateError } = await admin.from('company_private').insert({ company_id: companyId, cnpj: normalizeCnpj(company.cnpj) });
        if (privateError) throw authError(privateError, 'Este CNPJ já está cadastrado ou não pôde ser validado.');
      } else {
        await writeCandidateProfile(admin, userId, { ...input.profile, nome: input.name, telefone: input.profile?.telefone });
      }
    } catch (error) {
      try { await admin.auth.admin.deleteUser(userId); } catch {}
      throw error;
    }
    const profile = await getUserProfile(userId, admin);
    const resultUser = apiUser(profile, data.user, companyId);
    return res.status(201).json({
      user: resultUser,
      session: sessionPayload(data),
      requiresEmailConfirmation: !data.session,
      message: data.session ? 'Conta criada.' : 'Enviamos um link de confirmação para seu e-mail.',
    });
  } catch (error) { return next(error); }
});

router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Informe e-mail e senha válidos.' });
  try {
    const auth = createAnonymousClient();
    const { data, error } = await auth.auth.signInWithPassword({ email: normalizedEmail(parsed.data.email), password: parsed.data.password });
    if (error || !data?.user || !data?.session) throw authError(error || new Error('Credenciais inválidas.'));
    const admin = createAdminClient();
    const profile = await getUserProfile(data.user.id, admin);
    if (!profile || profile.status !== 'active' || (profile.role !== 'admin' && !profile.terms_accepted_at)) {
      await auth.auth.signOut({ scope: 'local' }).catch(() => {});
      throw httpError('Esta conta está suspensa ou ainda não possui os dados de aceite exigidos.', 403);
    }
    if (parsed.data.role && parsed.data.role !== profile.role) {
      const roleLabel = { candidate: 'candidato', company: 'empresa', admin: 'administração' }[profile.role] || 'outro tipo de acesso';
      throw httpError(`Esta conta pertence à área de ${roleLabel}. Selecione o tipo de acesso correto.`, 403);
    }
    let companyId = null;
    if (profile.role === 'company') {
      const { data: company, error: companyError } = await admin.from('company_profiles').select('id').eq('owner_user_id', profile.id).maybeSingle();
      if (companyError) throw authError(companyError);
      companyId = company?.id || null;
    }
    return res.json({ user: apiUser(profile, data.user, companyId), session: sessionPayload(data), requiresEmailConfirmation: false });
  } catch (error) { return next(error); }
});

router.post('/refresh', async (req, res, next) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Sessão inválida; entre novamente.' });
  try {
    const auth = createAnonymousClient();
    const { data, error } = await auth.auth.refreshSession({ refresh_token: parsed.data.refreshToken });
    if (error || !data?.session || !data?.user) throw httpError('A sessão expirou. Entre novamente.', 401);
    const admin = createAdminClient();
    const profile = await getUserProfile(data.user.id, admin);
    if (!profile || profile.status !== 'active' || (profile.role !== 'admin' && !profile.terms_accepted_at)) throw httpError('Esta conta está indisponível.', 403);
    let companyId = null;
    if (profile.role === 'company') {
      const { data: company } = await admin.from('company_profiles').select('id').eq('owner_user_id', profile.id).maybeSingle();
      companyId = company?.id || null;
    }
    return res.json({ user: apiUser(profile, data.user, companyId), session: sessionPayload(data) });
  } catch (error) { return next(error); }
});

router.get('/me', authenticate, async (req, res) => res.json({ user: req.user.user }));
router.post('/logout', authenticate, async (req, res) => {
  await req.supabase.auth.signOut({ scope: 'global' }).catch(() => {});
  return res.status(204).end();
});

router.post('/password-reset', async (req, res, next) => {
  const parsed = z.object({ email: emailSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Informe um e-mail válido.' });
  try {
    const auth = createAnonymousClient();
    const { error } = await auth.auth.resetPasswordForEmail(normalizedEmail(parsed.data.email), { ...(redirectUrl() ? { redirectTo: redirectUrl() } : {}) });
    if (error) throw authError(error, 'Não foi possível enviar as instruções de recuperação.');
    // Supabase does not reveal whether the address exists; this response avoids account enumeration.
    return res.json({ message: 'Se houver uma conta para este endereço, enviaremos as instruções de recuperação.' });
  } catch (error) { return next(error); }
});

router.post('/verify-email', async (req, res, next) => {
  const parsed = z.object({
    tokenHash: z.string().trim().min(10).max(4000),
    type: z.enum(['signup','email','email_change','recovery','invite','magiclink']),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'O link de confirmação está incompleto ou inválido.' });
  try {
    const auth = createAnonymousClient();
    const { data, error } = await auth.auth.verifyOtp({ token_hash: parsed.data.tokenHash, type: parsed.data.type });
    if (error || !data?.user) throw authError(error || new Error('Não foi possível confirmar o link.'));
    const admin = createAdminClient();
    const profile = await getUserProfile(data.user.id, admin);
    if (!profile || profile.status !== 'active' || (profile.role !== 'admin' && !profile.terms_accepted_at)) {
      throw httpError('Esta conta está suspensa ou ainda não possui o aceite exigido.', 403);
    }
    let companyId = null;
    if (profile.role === 'company') {
      const { data: company, error: companyError } = await admin.from('company_profiles').select('id').eq('owner_user_id', profile.id).maybeSingle();
      if (companyError) throw authError(companyError);
      companyId = company?.id || null;
    }
    return res.json({
      user: apiUser(profile, data.user, companyId),
      session: sessionPayload(data),
      type: parsed.data.type,
    });
  } catch (error) { return next(error); }
});

router.put('/password', authenticate, async (req, res, next) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'A nova senha não atende aos critérios definidos.' });
  try {
    const auth = createAnonymousClient();
    const { data, error } = await auth.auth.signInWithPassword({ email: req.user.email, password: parsed.data.currentPassword });
    if (error || data?.user?.id !== req.user.id) throw httpError('A senha atual não confere.', 400);
    const { error: updateError } = await req.supabase.auth.updateUser({ password: parsed.data.newPassword });
    if (updateError) throw authError(updateError, 'Não foi possível atualizar a senha.');
    return res.json({ message: 'Senha atualizada.' });
  } catch (error) { return next(error); }
});

router.put('/password/reset', authenticate, async (req, res, next) => {
  const parsed = passwordRecoverySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'A nova senha não atende aos critérios definidos.' });
  try {
    const { error } = await req.supabase.auth.updateUser({ password: parsed.data.newPassword });
    if (error) throw authError(error, 'Não foi possível concluir a recuperação. Solicite um novo link.');
    return res.json({ message: 'Senha redefinida. Entre novamente.' });
  } catch (error) { return next(error); }
});

router.put('/email', authenticate, async (req, res, next) => {
  const parsed = emailUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Informe um e-mail válido.' });
  if (normalizedEmail(parsed.data.email) === req.user.email) return res.json({ requiresEmailConfirmation: false, user: req.user.user });
  try {
    const { error } = await req.supabase.auth.updateUser({ email: normalizedEmail(parsed.data.email) }, { ...(redirectUrl() ? { emailRedirectTo: redirectUrl() } : {}) });
    if (error) throw authError(error, 'Não foi possível solicitar a alteração do e-mail.');
    return res.json({ requiresEmailConfirmation: true, user: req.user.user, message: 'Enviamos uma confirmação para o novo endereço. O e-mail de acesso só muda após a confirmação.' });
  } catch (error) { return next(error); }
});

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'candidate') return res.json({ user: await fullCandidateForUser(req) });
    if (req.user.role === 'company') return res.json({ user: await fullCompanyForUser(req) });
    return res.json({ user: { ...req.user.user, nome: req.user.name } });
  } catch (error) { return next(error); }
});

router.put('/profile', authenticate, async (req, res, next) => {
  if (req.user.role !== 'candidate') return res.status(403).json({ message: 'Somente candidatos podem atualizar o perfil profissional.' });
  const parsed = candidateProfileSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return res.status(400).json({ message: 'Confira os campos enviados.', errors: parsed.error?.flatten().fieldErrors });
  try {
    const admin = req.adminSupabase;
    const input = parsed.data;
    if (input.nome !== undefined) {
      const { error } = await req.supabase.from('profiles').update({ full_name: input.nome }).eq('id', req.user.id);
      if (error) throw authError(error, 'Não foi possível atualizar o nome do perfil.');
    }
    await writeCandidateProfile(admin, req.user.id, input);
    return res.json({ user: await fullCandidateForUser(req) });
  } catch (error) { return next(error); }
});

router.delete('/me', authenticate, async (req, res, next) => {
  try {
    const admin = req.adminSupabase;
    const bucket = admin.storage.from('candidate-files');
    const { data: files } = await bucket.list(req.user.id, { limit: 1000 });
    const paths = (files || []).map((file) => `${req.user.id}/${file.name}`);
    if (paths.length) {
      const { error: storageError } = await bucket.remove(paths);
      if (storageError) throw authError(storageError, 'Não foi possível remover os arquivos privados; a conta não foi excluída.');
    }
    const { error } = await admin.auth.admin.deleteUser(req.user.id);
    if (error) throw authError(error, 'Não foi possível excluir a conta.');
    return res.status(204).end();
  } catch (error) { return next(error); }
});

export default router;
