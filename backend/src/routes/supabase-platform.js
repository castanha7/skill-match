import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { createAnonymousClient, httpError } from '../services/supabase.js';
import {
  applicationStatusToDb, applicationStatusToUi, mapApplication, mapCompany, mapConnection,
  mapInterviewInvitation, mapJob, mapNotification, mapProfile,
} from '../services/contracts.js';

const router = Router();
const uuid = z.string().uuid();
const JOB_SELECT_COLUMNS = 'id,company_id,title,area,employment_type,modality,city,state,address,education,description,required_skills,required_courses,required_experience,requirements,benefits,application_url,salary_min,salary_max,status,active_until,created_at,updated_at';
const text = (max = 500) => z.string().trim().max(max);
const arrayText = (max = 60, itemMax = 160) => z.array(z.string().trim().min(1).max(itemMax)).max(max);
const jobSchema = z.object({
  title: z.string().trim().min(2).max(180),
  area: z.string().trim().min(2).max(120),
  type: z.enum(['Jovem Aprendiz','Estágio','Primeiro Emprego','Trainee','CLT','Temporário','Outro']),
  modality: z.enum(['Presencial','Híbrido','Remoto']),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/),
  address: text(300).optional().default(''),
  education: text(160).optional().default(''),
  description: z.string().trim().min(20).max(10000),
  salaryMin: z.number().finite().min(0).max(1000000).nullable().optional(),
  salaryMax: z.number().finite().min(0).max(1000000).nullable().optional(),
  requirements: arrayText(60, 200).default([]),
  benefits: arrayText(40, 200).default([]),
  requiredCourses: arrayText(30, 160).optional().default([]),
  requiredExperience: arrayText(30, 160).optional().default([]),
  applicationUrl: z.string().trim().max(2048).optional().default(''),
  active: z.boolean().optional().default(true),
}).strict().refine((value) => value.salaryMin == null || value.salaryMax == null || value.salaryMax >= value.salaryMin, 'A remuneração máxima deve ser igual ou maior que a mínima.');
const settingsSchema = z.object({
  distanceMaxKm: z.coerce.number().int().min(1).max(250).optional(),
  visibleToCompanies: z.boolean().optional(),
  notifyNewJobs: z.boolean().optional(),
  radarAddress: text(180).optional(),
  radarCity: text(120).optional(),
  radarState: z.string().length(2).optional(),
  radarNeighborhood: text(120).optional(),
  radarType: text(80).optional(),
  radarArea: text(100).optional(),
  radarModality: text(40).optional(),
}).strict();
const practiceSchema = z.object({
  jobType: z.string().trim().min(2).max(80),
  experienceLevel: z.string().trim().min(2).max(80),
  targetRole: text(120).optional().default(''),
  questionId: text(80).optional().default(''),
  question: z.string().trim().min(10).max(1000),
  answer: z.string().trim().min(10).max(4000),
  feedback: z.record(z.string(), z.unknown()).default({}),
}).strict();
const invitationSchema = z.object({
  startsAt: z.string().datetime(),
  mode: z.enum(['Online','Presencial']),
  meetingDetails: text(300).optional().default(''),
  message: z.string().trim().min(10).max(700),
}).strict();
const reportSchema = z.object({
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(10).max(3000),
  connectionId: uuid.nullable().optional(),
}).strict();
const companyUpdateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  sector: text(120).optional(),
  description: text(3000).optional(),
  city: z.string().trim().min(2).max(120).optional(),
  state: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).optional(),
  address: text(300).optional(),
  contactEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  website: text(2048).optional(),
  phone: text(40).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }
function dbError(error, fallback = 'Não foi possível concluir a operação.') {
  if (error?.status) return error;
  if (error?.code === '23505' || error?.code === '409') return httpError('Este registro já existe ou não pode ser duplicado.', 409);
  if (error?.code === '23503') return httpError('Um registro relacionado não está disponível.', 409);
  if (error?.code === '42501' || error?.code === 'PGRST301') return httpError('Você não tem permissão para esta operação.', 403);
  if (error?.code === 'PGRST116') return httpError('Registro não encontrado.', 404);
  console.error('[supabase]', error?.code || '', error?.message || fallback);
  return httpError(fallback, 500);
}
async function data(query, fallback) {
  const { data: value, error } = await query;
  if (error) throw dbError(error, fallback);
  return value;
}
function list(value) { return Array.isArray(value) ? value : []; }
function profileState(current) {
  return current?.status === 'suspended' ? 'blocked' : current?.status || 'active';
}
function mapPreference(row, courseRows = []) {
  const plannedCourses = courseRows.filter((course) => course.status === 'saved' || course.status === 'in_progress').map((course) => course.course_id);
  const completedCourses = courseRows.filter((course) => course.status === 'completed').map((course) => course.course_id);
  return {
    distanceMaxKm: row?.distance_radius_km ?? 50,
    visibleToCompanies: row?.visible_to_companies === true,
    notifyNewJobs: row?.notify_new_jobs !== false,
    radarAddress: row?.radar_address || '',
    radarCity: row?.radar_city || '',
    radarState: row?.radar_state || '',
    radarNeighborhood: row?.radar_neighborhood || '',
    radarType: row?.radar_type || '',
    radarArea: row?.radar_area || '',
    radarModality: row?.radar_modality || '',
    plannedCourses,
    completedCourses,
    updatedAt: row?.updated_at || null,
  };
}
function mapCompanyProfile(row, privateData = null) { return mapCompany(row, privateData); }
function mapJobRows(rows, companies) {
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  return rows.map((row) => mapJob(row, companyMap.get(row.company_id) || null));
}
function normalizeCompanyFields(input) {
  const fields = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.sector !== undefined) fields.sector = input.sector || null;
  if (input.description !== undefined) fields.description = input.description;
  if (input.city !== undefined) fields.city = input.city;
  if (input.state !== undefined) fields.state = input.state.toUpperCase();
  if (input.contactEmail !== undefined) fields.public_contact_email = input.contactEmail || null;
  if (input.website !== undefined) fields.website = input.website || null;
  fields.updated_at = new Date().toISOString();
  return fields;
}
function jobFields(input, companyId, status) {
  const requiredSkills = input.requirements || [];
  return {
    company_id: companyId,
    title: input.title,
    area: input.area,
    employment_type: input.type,
    modality: input.modality,
    city: input.city,
    state: input.state.toUpperCase(),
    address: input.address || null,
    education: input.education || null,
    description: input.description,
    required_skills: requiredSkills,
    required_courses: input.requiredCourses || [],
    required_experience: input.requiredExperience || [],
    requirements: requiredSkills,
    benefits: input.benefits || [],
    application_url: input.applicationUrl || null,
    salary_min: input.salaryMin ?? null,
    salary_max: input.salaryMax ?? null,
    status,
    updated_at: new Date().toISOString(),
  };
}
function validHttpsOrEmpty(value) {
  if (!value) return true;
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol); } catch { return false; }
}

async function companyRowsFor(req, ids = null) {
  let query;
  if (req.user.role === 'admin') query = req.adminSupabase.from('company_profiles').select('*');
  else query = req.supabase.from('company_profiles').select('id,name,sector,description,city,state,website,public_contact_email,verified_at,active,created_at,updated_at');
  if (ids?.length) query = query.in('id', ids);
  else if (req.user.role === 'candidate') query = query.eq('active', true).not('verified_at', 'is', null);
  else if (req.user.role === 'company' && req.user.companyId) query = query.eq('id', req.user.companyId);
  return data(query.order('created_at', { ascending: false }), 'Não foi possível carregar as empresas.');
}
async function privateCompaniesFor(req, companyIds) {
  if (!companyIds?.length) return new Map();
  const source = req.user.role === 'admin' ? req.adminSupabase : req.supabase;
  const rows = await data(source.from('company_private').select('company_id,cnpj,address,phone').in('company_id', companyIds), 'Não foi possível carregar os dados privados da empresa.');
  return new Map(rows.map((row) => [row.company_id, row]));
}
async function profileRowsFor(req, ids = null) {
  const source = req.user.role === 'admin' ? req.adminSupabase : req.supabase;
  let query = source.from('profiles').select(req.user.role === 'admin' ? 'id,role,status,full_name,created_at,updated_at,terms_accepted_at' : 'id,role,full_name,created_at').eq('role', 'candidate');
  if (ids) query = query.in('id', ids);
  return data(query, 'Não foi possível carregar os perfis autorizados.');
}
async function candidateBundles(req, ids = null) {
  if (req.user.role === 'candidate' && !ids) ids = [req.user.id];
  const profiles = await profileRowsFor(req, ids);
  const profileIds = profiles.map((profile) => profile.id);
  if (!profileIds.length) return [];
  const source = req.user.role === 'admin' ? req.adminSupabase : req.supabase;
  const [candidateRows, privateRows, contactRows] = await Promise.all([
    data(source.from('candidate_profiles').select('*').in('user_id', profileIds), 'Não foi possível carregar os perfis profissionais.'),
    req.user.role === 'admin' || req.user.role === 'candidate'
      ? data(source.from('candidate_private').select('user_id,birth_date').in('user_id', profileIds), 'Não foi possível carregar os dados privados.')
      : Promise.resolve([]),
    data(source.from('candidate_contacts').select('user_id,phone,contact_sharing_consent,contact_consented_at').in('user_id', profileIds), 'Não foi possível carregar as preferências de contato.'),
  ]);
  const candidateMap = new Map(candidateRows.map((row) => [row.user_id, row]));
  const privateMap = new Map(privateRows.map((row) => [row.user_id, row]));
  const contactMap = new Map(contactRows.map((row) => [row.user_id, row]));
  // Only rows independently authorized by RLS can be enriched with contact email.
  const contactAllowed = [...contactMap.values()].filter((row) => row.contact_sharing_consent).map((row) => row.user_id);
  let contactEmails = new Map();
  if (contactAllowed.length && req.user.role === 'company') {
    const emailRows = await data(req.adminSupabase.from('candidate_contacts').select('user_id,email').in('user_id', contactAllowed), 'Não foi possível carregar contatos autorizados.');
    contactEmails = new Map(emailRows.map((row) => [row.user_id, row.email]));
  }
  const emails = new Map();
  if (req.user.role === 'admin' && profileIds.length) {
    const users = [];
    let page = 1;
    while (true) {
      const { data: result, error } = await req.adminSupabase.auth.admin.listUsers({ page, perPage: 500 });
      if (error) throw dbError(error, 'Não foi possível carregar as contas.');
      users.push(...(result.users || []));
      if (!result.users?.length || result.users.length < 500) break;
      page += 1;
    }
    for (const user of users) if (profileIds.includes(user.id)) emails.set(user.id, user.email || '');
  }
  return profiles.map((profile) => {
    const cp = candidateMap.get(profile.id) || {};
    const contacts = contactMap.get(profile.id) || {};
    const priv = privateMap.get(profile.id) || {};
    return mapProfile({ ...profile, candidate_profiles: cp }, {
      privateData: { ...priv, phone: contacts.phone },
      contacts: { ...contacts, email: contactEmails.get(profile.id) || '' },
      email: emails.get(profile.id) || '',
    });
  });
}
async function allJobRows(req, allowedIds = null) {
  const source = req.user.role === 'admin' ? req.adminSupabase : req.supabase;
  const columns = req.user.role === 'admin' ? '*' : JOB_SELECT_COLUMNS;
  let query = source.from('jobs').select(columns).order('created_at', { ascending: false }).limit(1000);
  if (allowedIds) query = allowedIds.length ? query.in('id', allowedIds) : query.eq('id', '__no_authorized_job__');
  else if (req.user.role === 'company' && req.user.companyId) query = query.eq('company_id', req.user.companyId);
  else if (req.user.role === 'candidate') query = query.eq('status', 'published');
  return data(query, 'Não foi possível carregar as oportunidades.');
}
async function publicJobs() {
  const client = createAnonymousClient();
  const rows = await data(client.from('jobs')
    .select(`${JOB_SELECT_COLUMNS},company_profiles!jobs_company_id_fkey(id,name,sector,city,state,website,public_contact_email,verified_at,active)`)
    .eq('status', 'published').order('created_at', { ascending: false }).limit(200), 'Não foi possível carregar as vagas públicas.');
  return rows.map((row) => mapJob(row, row.company_profiles));
}
async function enrichApplications(req, rows, jobs, companies, users) {
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const userMap = new Map(users.map((user) => [user.id, user]));
  return rows.map((row) => {
    const job = jobMap.get(row.job_id) || null;
    return mapApplication(row, {
      job,
      company: job ? companyMap.get(job.companyId) || null : null,
      candidate: userMap.get(row.candidate_user_id) || null,
    });
  });
}
async function audit(req, action, targetTable, targetId, details = {}) {
  const { error } = await req.adminSupabase.from('admin_audit').insert({ actor_user_id: req.user.id, action, target_table: targetTable, target_id: targetId || null, details });
  if (error) throw dbError(error, 'Não foi possível registrar a trilha de administração.');
}

router.get('/jobs', asyncRoute(async (_req, res) => {
  const jobs = await publicJobs();
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60').json({ jobs });
}));
router.get('/companies', asyncRoute(async (req, res) => {
  const query = z.object({ search: text(120).optional(), city: text(120).optional(), state: z.string().length(2).optional() }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Filtros empresariais inválidos.' });
  const anon = createAnonymousClient();
  let request = anon.from('company_profiles').select('id,name,sector,description,city,state,website,public_contact_email,verified_at,active,created_at')
    .eq('active', true).not('verified_at', 'is', null).order('name').limit(100);
  if (query.data.search) request = request.or(`name.ilike.%${query.data.search}%,sector.ilike.%${query.data.search}%,description.ilike.%${query.data.search}%`);
  if (query.data.city) request = request.ilike('city', `%${query.data.city}%`);
  if (query.data.state) request = request.eq('state', query.data.state.toUpperCase());
  const rows = await data(request, 'Não foi possível carregar as empresas públicas.');
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60').json({ companies: rows.map((row) => mapCompanyProfile(row)) });
}));

router.get('/platform/snapshot', authenticate, asyncRoute(async (req, res) => {
  const admin = req.user.role === 'admin';
  const companyId = req.user.companyId;
  const db = admin ? req.adminSupabase : req.supabase;
  const [companiesRaw, jobsRaw, appRows, favoritesRaw, connectionRows, invitationRows, notificationRows, settingsRows, courseRows, savedRows, practiceRows, reportRows, adRows] = await Promise.all([
    companyRowsFor(req),
    allJobRows(req),
    data(db.from('applications').select('*,application_events(id,status,note,created_at)').order('applied_at', { ascending: false }).limit(1000), 'Não foi possível carregar as candidaturas.'),
    data(db.from('candidate_favorites').select('*').limit(1000), 'Não foi possível carregar as vagas salvas.'),
    data(db.from('connections').select('*').order('updated_at', { ascending: false }).limit(1000), 'Não foi possível carregar as conexões.'),
    data(db.from('interview_invitations').select('*').order('starts_at', { ascending: true }).limit(1000), 'Não foi possível carregar os convites.'),
    data(db.from('notifications').select('*').order('created_at', { ascending: false }).limit(1000), 'Não foi possível carregar as notificações.'),
    req.user.role === 'candidate' ? data(db.from('candidate_settings').select('*').eq('candidate_user_id', req.user.id).maybeSingle(), 'Não foi possível carregar as preferências.').then((row) => row ? [row] : []) : Promise.resolve([]),
    req.user.role === 'candidate' ? data(db.from('candidate_course_progress').select('*').eq('candidate_user_id', req.user.id), 'Não foi possível carregar o plano de desenvolvimento.') : Promise.resolve([]),
    req.user.role === 'company' ? data(db.from('company_saved_talents').select('*').eq('company_id', companyId), 'Não foi possível carregar os talentos salvos.') : Promise.resolve([]),
    req.user.role === 'candidate' ? data(db.from('candidate_interview_sessions').select('*').order('created_at', { ascending: false }).limit(30), 'Não foi possível carregar o histórico de prática.') : Promise.resolve([]),
    admin ? data(db.from('reports').select('*').order('created_at', { ascending: false }).limit(1000), 'Não foi possível carregar os relatos.') : Promise.resolve([]),
    admin ? data(db.from('announcements').select('*').order('created_at', { ascending: false }).limit(1000), 'Não foi possível carregar os comunicados.') : req.user.role === 'candidate' ? data(db.from('announcements').select('id,title,message,active,created_at,updated_at').eq('active', true).order('created_at', { ascending: false }).limit(100), 'Não foi possível carregar os comunicados.') : Promise.resolve([]),
  ]);

  let applicationRows = appRows;
  let connectionRowsForRole = connectionRows;
  let invitationRowsForRole = invitationRows;
  let jobRows = jobsRaw;
  let jobsForMap = jobRows;
  const relatedJobIds = [...new Set([
    ...appRows.map((item) => item.job_id),
    ...invitationRows.map((item) => item.job_id).filter(Boolean),
    ...favoritesRaw.map((item) => item.job_id),
  ])];
  if (relatedJobIds.length && req.user.role !== 'admin') {
    const existingIds = new Set(jobRows.map((item) => item.id));
    const missing = relatedJobIds.filter((id) => !existingIds.has(id));
    if (missing.length) {
      const archived = await data(req.adminSupabase.from('jobs').select('*').in('id', missing), 'Não foi possível carregar o histórico de oportunidades autorizadas.');
      jobsForMap = [...jobRows, ...archived];
    }
  }
  const companyIds = [...new Set([...companiesRaw.map((item) => item.id), ...jobsForMap.map((item) => item.company_id), ...connectionRows.map((item) => item.company_id), ...invitationRows.map((item) => item.company_id)].filter(Boolean))];
  let missingCompanies = [];
  if (companyIds.length) {
    const seen = new Set(companiesRaw.map((company) => company.id));
    const missing = companyIds.filter((id) => !seen.has(id));
    if (missing.length && req.user.role !== 'admin') missingCompanies = await data(req.adminSupabase.from('company_profiles').select('*').in('id', missing), 'Não foi possível carregar os dados de empresas relacionadas.');
  }
  const companyRows = [...companiesRaw, ...missingCompanies];
  const privateMap = await privateCompaniesFor(req, req.user.role === 'company' ? [companyId].filter(Boolean) : admin ? companyIds : []);
  const companies = companyRows.map((row) => mapCompanyProfile(row, privateMap.get(row.id)));
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const jobs = mapJobRows(jobsForMap, [...companyRows]);
  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  let authorizedCandidateIds = new Set([
    ...appRows.map((item) => item.candidate_user_id),
    ...connectionRows.map((item) => item.candidate_user_id),
    ...invitationRows.map((item) => item.candidate_user_id),
  ]);
  if (admin) {
    const allProfiles = await data(req.adminSupabase.from('profiles').select('id,role,status,full_name,created_at,updated_at,terms_accepted_at').eq('role', 'candidate').limit(2000), 'Não foi possível carregar contas de candidatos.');
    authorizedCandidateIds = new Set(allProfiles.map((profile) => profile.id));
  }
  let users = await candidateBundles(req, authorizedCandidateIds.size ? [...authorizedCandidateIds] : req.user.role === 'company' ? null : []);
  if (req.user.role === 'candidate') {
    const profile = await data(req.adminSupabase.from('profiles').select('id,role,status,full_name,created_at').eq('id', req.user.id).single(), 'Não foi possível carregar sua conta.');
    users = [mapProfile({ ...profile, candidate_profiles: await data(req.adminSupabase.from('candidate_profiles').select('*').eq('user_id', req.user.id).single(), 'Não foi possível carregar seu perfil.') }, {
      privateData: await data(req.adminSupabase.from('candidate_private').select('birth_date').eq('user_id', req.user.id).single(), 'Não foi possível carregar seus dados privados.'),
      contacts: await data(req.adminSupabase.from('candidate_contacts').select('phone,contact_sharing_consent').eq('user_id', req.user.id).single(), 'Não foi possível carregar suas preferências de contato.'),
      email: req.authUser.email,
    })];
  }
  if (admin) {
    let page = 1;
    const authUsers = [];
    while (true) {
      const { data: result, error } = await req.adminSupabase.auth.admin.listUsers({ page, perPage: 500 });
      if (error) throw dbError(error, 'Não foi possível carregar as contas de usuário.');
      authUsers.push(...(result.users || []));
      if (!result.users?.length || result.users.length < 500) break;
      page += 1;
    }
    const profiles = await data(req.adminSupabase.from('profiles').select('id,role,status,full_name,created_at,updated_at,terms_accepted_at').limit(5000), 'Não foi possível carregar as contas.');
    const byId = new Map(authUsers.map((user) => [user.id, user]));
    const candidateIds = profiles.filter((profile) => profile.role === 'candidate').map((profile) => profile.id);
    const candidateMap = new Map(users.map((user) => [user.id, user]));
    users = profiles.map((profile) => {
      const authUser = byId.get(profile.id);
      if (profile.role === 'candidate' && candidateMap.has(profile.id)) return { ...candidateMap.get(profile.id), email: authUser?.email || '', status: profileState(profile) };
      return { id: profile.id, role: profile.role, status: profileState(profile), nome: profile.full_name, email: authUser?.email || '', criadoEm: profile.created_at, companyId: companyRows.find((company) => company.owner_user_id === profile.id)?.id || null };
    });
  }
  const userMap = new Map(users.map((user) => [user.id, user]));
  const applications = await enrichApplications(req, applicationRows, jobs, companies, users);
  const connections = connectionRowsForRole.map((row) => mapConnection(row, { company: companyMap.get(row.company_id) || null, candidate: userMap.get(row.candidate_user_id) || null }));
  const connectionIds = connections.filter((item) => item.status === 'connected').map((item) => item.id);
  let messages = [];
  if (connectionIds.length) {
    const messageRows = await data(db.from('connection_messages').select('*').in('connection_id', connectionIds).order('created_at', { ascending: true }).limit(3000), 'Não foi possível carregar as conversas autorizadas.');
    messages = messageRows.map((row) => ({
      id: row.id, connectionId: row.connection_id, senderId: row.sender_user_id, recipientId: row.recipient_user_id,
      body: row.body, read: Boolean(row.read_at), readAt: row.read_at, createdAt: row.created_at, isDemo: false,
    }));
    for (const connection of connections) connection.messages = messages.filter((message) => message.connectionId === connection.id);
  }
  const invitations = invitationRowsForRole.map((row) => mapInterviewInvitation(row, {
    company: companyMap.get(row.company_id) || null,
    candidate: userMap.get(row.candidate_user_id) || null,
    job: jobMap.get(row.job_id) || null,
  }));
  const favorites = favoritesRaw.map((row) => ({ candidateId: row.candidate_user_id, jobId: row.job_id, createdAt: row.created_at, job: jobMap.get(row.job_id) || null, isDemo: false }));
  const savedTalents = savedRows.map((row) => ({ companyId: row.company_id, candidateId: row.candidate_user_id, createdAt: row.created_at, isDemo: false }));
  const preferences = {};
  for (const user of users) if (user.role === 'candidate') preferences[user.id] = { visibleToCompanies: user.visibleToCompanies === true, contactSharingConsent: user.contactSharingConsent === true };
  if (settingsRows[0]) preferences[req.user.id] = mapPreference(settingsRows[0], courseRows);
  const interviewHistory = practiceRows.map((row) => ({
    id: row.id, candidateId: row.candidate_user_id, jobType: row.job_type, experienceLevel: row.experience_level,
    targetRole: row.target_role || '', questionId: row.question_id || '', question: row.question, answer: row.answer,
    feedback: row.feedback || {}, provider: row.provider, createdAt: row.created_at, isDemo: false,
  }));
  const reports = reportRows.map((row) => ({
    id: row.id, userId: row.reporter_user_id, userName: userMap.get(row.reporter_user_id)?.nome || '',
    role: userMap.get(row.reporter_user_id)?.role || '', category: row.category, description: row.description,
    connectionId: row.connection_id, status: row.status === 'resolved' ? 'Resolvido' : row.status === 'dismissed' ? 'Dispensado' : 'Aberto',
    createdAt: row.created_at, updatedAt: row.reviewed_at, isDemo: false,
  }));
  const ads = adRows.map((row) => ({ id: row.id, title: row.title, message: row.message, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at, isDemo: false }));
  const applicationsWithHistory = applications.map((application) => ({
    ...application,
    history: (applicationRows.find((row) => row.id === application.id)?.application_events || []).map((event) => ({ status: applicationStatusToUi(event.status), at: event.created_at, note: event.note || '' })),
  }));
  return res.json({
    user: req.user.user,
    companies,
    jobs,
    applications: applicationsWithHistory,
    favorites,
    connections,
    messages,
    savedTalents,
    interviewHistory,
    interviewInvitations: invitations,
    notifications: notificationRows.map(mapNotification),
    preferences,
    reports,
    ads,
    users,
  });
}));

router.get('/platform/users/:userId', authenticate, allowRoles('company','admin'), asyncRoute(async (req, res) => {
  const parsedId = uuid.safeParse(req.params.userId);
  if (!parsedId.success) return res.status(400).json({ message: 'Identificador de perfil inválido.' });
  const users = await candidateBundles(req, [parsedId.data]);
  if (!users[0]) return res.status(404).json({ message: 'Perfil não encontrado ou indisponível.' });
  res.json({ user: users[0] });
}));

router.get('/companies/mine', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const row = await data(req.adminSupabase.from('company_profiles').select('*').eq('owner_user_id', req.user.id).maybeSingle(), 'Não foi possível carregar o perfil empresarial.');
  if (!row) return res.status(404).json({ message: 'Perfil empresarial não encontrado.' });
  const privateData = await data(req.adminSupabase.from('company_private').select('cnpj,address,phone').eq('company_id', row.id).maybeSingle(), 'Não foi possível carregar os dados privados da empresa.');
  res.json({ company: mapCompanyProfile(row, privateData) });
}));
router.put('/companies/mine', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const parsed = companyUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira os dados enviados.', errors: parsed.error.flatten().fieldErrors });
  if (!validHttpsOrEmpty(parsed.data.website)) return res.status(400).json({ message: 'Informe um endereço HTTP ou HTTPS válido.' });
  const companyId = req.user.companyId;
  if (!companyId) return res.status(404).json({ message: 'Perfil empresarial não encontrado.' });
  const fields = normalizeCompanyFields(parsed.data);
  const { error } = await req.supabase.from('company_profiles').update(fields).eq('id', companyId);
  if (error) throw dbError(error, 'Não foi possível atualizar a empresa.');
  const privateFields = {};
  if (parsed.data.address !== undefined) privateFields.address = parsed.data.address || null;
  if (parsed.data.phone !== undefined) privateFields.phone = parsed.data.phone || null;
  if (Object.keys(privateFields).length) {
    const { error: privateError } = await req.supabase.from('company_private').update({ ...privateFields, updated_at: new Date().toISOString() }).eq('company_id', companyId);
    if (privateError) throw dbError(privateError, 'Não foi possível atualizar os dados privados da empresa.');
  }
  const row = await data(req.adminSupabase.from('company_profiles').select('*').eq('id', companyId).single(), 'Não foi possível recarregar o perfil empresarial.');
  const priv = await data(req.adminSupabase.from('company_private').select('cnpj,address,phone').eq('company_id', companyId).maybeSingle(), 'Não foi possível carregar os dados privados da empresa.');
  res.json({ company: mapCompanyProfile(row, priv) });
}));

router.get('/jobs/mine', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const rows = await allJobRows(req);
  const companiesRaw = await companyRowsFor(req);
  res.json({ jobs: mapJobRows(rows, companiesRaw) });
}));
router.post('/jobs', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira os campos do anúncio.', errors: parsed.error.flatten().fieldErrors });
  const input = parsed.data;
  if (!validHttpsOrEmpty(input.applicationUrl)) return res.status(400).json({ message: 'Informe um link de candidatura HTTP ou HTTPS válido.' });
  const status = input.active ? 'pending_review' : 'draft';
  const id = randomUUID();
  const row = await data(req.supabase.from('jobs').insert({ id, ...jobFields(input, req.user.companyId, status) }).select(JOB_SELECT_COLUMNS).single(), 'Não foi possível publicar o anúncio.');
  res.status(201).json({ job: mapJob(row) });
}));
router.put('/jobs/:jobId', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const parsedId = z.string().min(1).max(100).safeParse(req.params.jobId);
  const parsed = jobSchema.safeParse(req.body);
  if (!parsedId.success || !parsed.success) return res.status(400).json({ message: 'Confira o identificador e os campos do anúncio.' });
  if (!validHttpsOrEmpty(parsed.data.applicationUrl)) return res.status(400).json({ message: 'Informe um link de candidatura HTTP ou HTTPS válido.' });
  const current = await data(req.supabase.from('jobs').select('id,status').eq('id', parsedId.data).maybeSingle(), 'Não foi possível carregar este anúncio.');
  if (!current) return res.status(404).json({ message: 'Anúncio não encontrado.' });
  const status = parsed.data.active ? (current.status === 'published' ? 'pending_review' : current.status === 'draft' ? 'pending_review' : current.status) : 'paused';
  const update = jobFields(parsed.data, req.user.companyId, status);
  delete update.company_id;
  const row = await data(req.supabase.from('jobs').update(update).eq('id', parsedId.data).select(JOB_SELECT_COLUMNS).single(), 'Não foi possível atualizar o anúncio.');
  res.json({ job: mapJob(row) });
}));
router.patch('/jobs/:jobId/status', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Status de anúncio inválido.' });
  const row = await data(req.supabase.from('jobs').update({ status: parsed.data.active ? 'pending_review' : 'paused', updated_at: new Date().toISOString() }).eq('id', req.params.jobId).select(JOB_SELECT_COLUMNS).maybeSingle(), 'Não foi possível atualizar o anúncio.');
  if (!row) return res.status(404).json({ message: 'Anúncio não encontrado.' });
  res.json({ job: mapJob(row) });
}));
router.delete('/jobs/:jobId', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const row = await data(req.supabase.from('jobs').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', req.params.jobId).select('id').maybeSingle(), 'Não foi possível arquivar o anúncio.');
  if (!row) return res.status(404).json({ message: 'Anúncio não encontrado.' });
  res.status(204).end();
}));

router.get('/applications/mine', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const snapshot = await data(req.supabase.from('applications').select('*,application_events(id,status,note,created_at)').order('applied_at', { ascending: false }), 'Não foi possível carregar suas candidaturas.');
  res.json({ applications: snapshot.map((row) => ({ id: row.id, candidateId: row.candidate_user_id, jobId: row.job_id, status: applicationStatusToUi(row.status), coverMessage: row.cover_message, createdAt: row.applied_at, updatedAt: row.updated_at, history: (row.application_events || []).map((item) => ({ status: applicationStatusToUi(item.status), at: item.created_at, note: item.note })), isDemo: false })) });
}));
router.get('/companies/applications', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const applications = await data(req.supabase.from('applications').select('*,application_events(id,status,note,created_at)').order('applied_at', { ascending: false }), 'Não foi possível carregar as candidaturas.');
  res.json({ applications });
}));
router.post('/jobs/:jobId/applications', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const parsed = z.object({ coverMessage: text(2000).optional().default('') }).safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: 'Mensagem de candidatura inválida.' });
  const row = await data(req.supabase.from('applications').insert({ id: randomUUID(), candidate_user_id: req.user.id, job_id: req.params.jobId, cover_message: parsed.data.coverMessage }).select('*').single(), 'Não foi possível enviar a candidatura.');
  res.status(201).json({ application: { id: row.id, candidateId: row.candidate_user_id, jobId: row.job_id, status: applicationStatusToUi(row.status), createdAt: row.applied_at, updatedAt: row.updated_at, history: [{ status: applicationStatusToUi(row.status), at: row.applied_at, note: 'Candidatura enviada.' }], isDemo: false } });
}));
router.patch('/applications/:applicationId/status', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const parsed = z.object({ status: z.enum(['Recebida','Em análise','Entrevista','Não selecionada','Contratada']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Status de candidatura inválido.' });
  const dbStatus = applicationStatusToDb(parsed.data.status);
  const row = await data(req.supabase.from('applications').update({ status: dbStatus, updated_at: new Date().toISOString() }).eq('id', req.params.applicationId).select('*').maybeSingle(), 'Não foi possível atualizar a candidatura.');
  if (!row) return res.status(404).json({ message: 'Candidatura não encontrada para esta empresa.' });
  res.json({ application: { id: row.id, status: applicationStatusToUi(row.status), updatedAt: row.updated_at } });
}));
router.post('/applications/:applicationId/withdraw', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const row = await data(req.supabase.from('applications').update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('id', req.params.applicationId).eq('candidate_user_id', req.user.id).select('*').maybeSingle(), 'Não foi possível desistir da candidatura.');
  if (!row) return res.status(404).json({ message: 'Candidatura não encontrada ou encerrada.' });
  res.json({ application: { id: row.id, status: applicationStatusToUi(row.status) } });
}));

router.get('/favorites', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const rows = await data(req.supabase.from('candidate_favorites').select('*').eq('candidate_user_id', req.user.id), 'Não foi possível carregar suas vagas salvas.');
  res.json({ favorites: rows });
}));
router.put('/favorites/:jobId', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const row = await data(req.supabase.from('candidate_favorites').upsert({ candidate_user_id: req.user.id, job_id: req.params.jobId }, { onConflict: 'candidate_user_id,job_id' }).select('*').single(), 'Não foi possível salvar esta vaga.');
  res.json({ favorite: row, saved: true });
}));
router.delete('/favorites/:jobId', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const { error } = await req.supabase.from('candidate_favorites').delete().eq('candidate_user_id', req.user.id).eq('job_id', req.params.jobId);
  if (error) throw dbError(error, 'Não foi possível remover esta vaga salva.');
  res.status(204).end();
}));

router.get('/connections', authenticate, allowRoles('candidate','company'), asyncRoute(async (req, res) => {
  const rows = await data(req.supabase.from('connections').select('*').order('updated_at', { ascending: false }).limit(500), 'Não foi possível carregar suas conexões.');
  res.json({ connections: rows });
}));
router.post('/connections', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const parsed = z.object({ companyId: uuid, message: z.string().trim().min(10).max(1200) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Escreva uma apresentação de 10 a 1.200 caracteres e selecione uma empresa disponível.' });
  const row = await data(req.supabase.from('connections').insert({ id: randomUUID(), company_id: parsed.data.companyId, candidate_user_id: req.user.id, initiated_by: 'candidate', status: 'connected', invitation_message: '' }).select('*').single(), 'Não foi possível iniciar a conexão.');
  const { data: company, error: companyError } = await req.adminSupabase.from('company_profiles').select('owner_user_id').eq('id', row.company_id).single();
  if (companyError) throw dbError(companyError, 'Não foi possível encontrar o destinatário autorizado.');
  const { error: messageError } = await req.supabase.from('connection_messages').insert({ id: randomUUID(), connection_id: row.id, sender_user_id: req.user.id, recipient_user_id: company.owner_user_id, body: parsed.data.message });
  if (messageError) throw dbError(messageError, 'A conexão foi iniciada, mas não foi possível enviar a apresentação.');
  res.status(201).json({ connection: row });
}));
router.post('/connections/invite', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const parsed = z.object({ candidateUserId: uuid, message: z.string().trim().min(10).max(1200) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Informe um perfil autorizado e uma mensagem de 10 a 1.200 caracteres.' });
  const row = await data(req.supabase.from('connections').insert({ id: randomUUID(), company_id: req.user.companyId, candidate_user_id: parsed.data.candidateUserId, initiated_by: 'company', status: 'pending', invitation_message: parsed.data.message }).select('*').single(), 'Não foi possível enviar o convite.');
  res.status(201).json({ connection: row });
}));
router.patch('/connections/:connectionId', authenticate, allowRoles('candidate','company'), asyncRoute(async (req, res) => {
  const parsed = z.object({ action: z.enum(['accept','decline','block','end']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Ação de conexão inválida.' });
  const update = parsed.data.action === 'accept' ? { status: 'connected' }
    : parsed.data.action === 'decline' ? { status: 'declined' }
      : parsed.data.action === 'end' ? { status: 'ended' }
        : { status: 'blocked', blocked_by_user_id: req.user.id };
  const row = await data(req.supabase.from('connections').update({ ...update, updated_at: new Date().toISOString() }).eq('id', req.params.connectionId).select('*').maybeSingle(), 'Não foi possível atualizar esta conexão.');
  if (!row) return res.status(404).json({ message: 'Conexão não encontrada ou ação não autorizada.' });
  res.json({ connection: row, status: row.status });
}));
router.get('/connections/:connectionId/messages', authenticate, allowRoles('candidate','company'), asyncRoute(async (req, res) => {
  const connection = await data(req.supabase.from('connections').select('id,status').eq('id', req.params.connectionId).maybeSingle(), 'Não foi possível carregar esta conversa.');
  if (!connection || connection.status !== 'connected') return res.status(404).json({ message: 'Conversa não disponível.' });
  const rows = await data(req.supabase.from('connection_messages').select('*').eq('connection_id', connection.id).order('created_at'), 'Não foi possível carregar esta conversa.');
  const { error } = await req.supabase.from('connection_messages').update({ read_at: new Date().toISOString() }).eq('connection_id', connection.id).eq('recipient_user_id', req.user.id).is('read_at', null);
  if (error) throw dbError(error, 'Não foi possível atualizar a leitura das mensagens.');
  res.json({ messages: rows });
}));
router.post('/connections/:connectionId/messages', authenticate, allowRoles('candidate','company'), asyncRoute(async (req, res) => {
  const parsed = z.object({ body: z.string().trim().min(1).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Escreva uma mensagem de até 2.000 caracteres.' });
  const connection = await data(req.supabase.from('connections').select('*').eq('id', req.params.connectionId).maybeSingle(), 'Não foi possível carregar esta conversa.');
  if (!connection || connection.status !== 'connected') return res.status(404).json({ message: 'Conversa não disponível.' });
  let recipient = connection.candidate_user_id;
  if (req.user.id === connection.candidate_user_id) {
    const company = await data(req.adminSupabase.from('company_profiles').select('owner_user_id').eq('id', connection.company_id).single(), 'Não foi possível localizar o destinatário autorizado.');
    recipient = company.owner_user_id;
  }
  const row = await data(req.supabase.from('connection_messages').insert({ id: randomUUID(), connection_id: connection.id, sender_user_id: req.user.id, recipient_user_id: recipient, body: parsed.data.body }).select('*').single(), 'Não foi possível enviar a mensagem.');
  res.status(201).json({ message: row });
}));

router.get('/notifications', authenticate, asyncRoute(async (req, res) => {
  const rows = await data(req.supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(1000), 'Não foi possível carregar notificações.');
  res.json({ notifications: rows.map(mapNotification) });
}));
router.patch('/notifications/:notificationId/read', authenticate, asyncRoute(async (req, res) => {
  const row = await data(req.supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', req.params.notificationId).select('*').maybeSingle(), 'Não foi possível marcar a notificação.');
  if (!row) return res.status(404).json({ message: 'Notificação não encontrada.' });
  res.json({ notification: mapNotification(row) });
}));
router.post('/notifications/read-all', authenticate, asyncRoute(async (req, res) => {
  const { error } = await req.supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', req.user.id).is('read_at', null);
  if (error) throw dbError(error, 'Não foi possível atualizar as notificações.');
  res.status(204).end();
}));

router.get('/interviews/mine', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const rows = await data(req.supabase.from('candidate_interview_sessions').select('*').order('created_at', { ascending: false }).limit(30), 'Não foi possível carregar o histórico.');
  res.json({ sessions: rows });
}));
router.post('/interviews/practice', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const parsed = practiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira a resposta antes de salvar o treino.' });
  const input = parsed.data;
  const row = await data(req.supabase.from('candidate_interview_sessions').insert({
    id: randomUUID(), candidate_user_id: req.user.id, job_type: input.jobType, experience_level: input.experienceLevel,
    target_role: input.targetRole, question_id: input.questionId, question: input.question, answer: input.answer,
    feedback: input.feedback, provider: 'guided-rules', external_ai_consent_at: null,
  }).select('*').single(), 'Não foi possível salvar o treino.');
  res.status(201).json({ session: { id: row.id, candidateId: row.candidate_user_id, jobType: row.job_type, experienceLevel: row.experience_level, targetRole: row.target_role, questionId: row.question_id, question: row.question, answer: row.answer, feedback: row.feedback, provider: row.provider, createdAt: row.created_at, isDemo: false } });
}));
router.delete('/interviews/:sessionId', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const { error } = await req.supabase.from('candidate_interview_sessions').delete().eq('id', req.params.sessionId).eq('candidate_user_id', req.user.id);
  if (error) throw dbError(error, 'Não foi possível remover o registro.');
  res.status(204).end();
}));
router.get('/interviews/invitations', authenticate, allowRoles('candidate','company'), asyncRoute(async (req, res) => {
  const rows = await data(req.supabase.from('interview_invitations').select('*').order('starts_at'), 'Não foi possível carregar os convites.');
  res.json({ invitations: rows });
}));
router.post('/interviews/invitations', authenticate, allowRoles('company'), asyncRoute(async (req, res) => {
  const parsed = z.object({ applicationId: z.string().min(1).max(100), ...invitationSchema.shape }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira os dados do convite.' });
  const start = new Date(parsed.data.startsAt);
  if (start.getTime() < Date.now() + 10 * 60 * 1000) return res.status(400).json({ message: 'Escolha um horário pelo menos 10 minutos no futuro.' });
  if (parsed.data.mode === 'Presencial' && parsed.data.meetingDetails.length < 4) return res.status(400).json({ message: 'Informe o endereço ou local da entrevista presencial.' });
  if (parsed.data.mode === 'Online' && !validHttpsOrEmpty(parsed.data.meetingDetails)) return res.status(400).json({ message: 'Informe um link HTTP ou HTTPS válido ou deixe o campo em branco.' });
  const application = await data(req.supabase.from('applications').select('id,candidate_user_id,job_id').eq('id', parsed.data.applicationId).maybeSingle(), 'Não foi possível encontrar a candidatura.');
  if (!application) return res.status(404).json({ message: 'Candidatura não encontrada para esta empresa.' });
  const row = await data(req.supabase.from('interview_invitations').insert({
    id: randomUUID(), company_id: req.user.companyId, candidate_user_id: application.candidate_user_id,
    job_id: application.job_id, application_id: application.id, starts_at: start.toISOString(), mode: parsed.data.mode,
    meeting_details: parsed.data.meetingDetails, message: parsed.data.message,
  }).select('*').single(), 'Não foi possível criar o convite.');
  res.status(201).json({ invitation: row });
}));
router.patch('/interviews/invitations/:invitationId', authenticate, allowRoles('candidate','company'), asyncRoute(async (req, res) => {
  const parsed = z.object({ action: z.enum(['accept','decline','cancel']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Ação do convite inválida.' });
  const status = parsed.data.action === 'accept' ? 'accepted' : parsed.data.action === 'decline' ? 'declined' : 'cancelled';
  const row = await data(req.supabase.from('interview_invitations').update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.invitationId).select('*').maybeSingle(), 'Não foi possível atualizar o convite.');
  if (!row) return res.status(404).json({ message: 'Convite não encontrado ou ação não autorizada.' });
  res.json({ invitation: row });
}));

router.put('/settings', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return res.status(400).json({ message: 'Preferências inválidas.' });
  const current = await data(req.supabase.from('candidate_settings').select('*').eq('candidate_user_id', req.user.id).maybeSingle(), 'Não foi possível carregar as preferências.');
  const input = { ...current, ...parsed.data };
  const visible = input.visibleToCompanies === true;
  const row = await data(req.supabase.from('candidate_settings').upsert({
    candidate_user_id: req.user.id,
    notify_new_jobs: input.notifyNewJobs !== false,
    visible_to_companies: visible,
    distance_radius_km: Number(input.distanceMaxKm || 50),
    radar_address: input.radarAddress || null,
    radar_city: input.radarCity || null,
    radar_state: input.radarState?.toUpperCase() || null,
    radar_neighborhood: input.radarNeighborhood || null,
    radar_type: input.radarType || null,
    radar_area: input.radarArea || null,
    radar_modality: input.radarModality || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'candidate_user_id' }).select('*').single(), 'Não foi possível salvar suas preferências.');
  const { error: profileError } = await req.supabase.from('candidate_profiles').update({ visible_to_companies: visible, visibility_consented_at: visible ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('user_id', req.user.id);
  if (profileError) throw dbError(profileError, 'Não foi possível atualizar a preferência de visibilidade.');
  const { error: contactError } = await req.supabase.from('candidate_contacts').update({ contact_sharing_consent: visible, contact_consented_at: visible ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('user_id', req.user.id);
  if (contactError) throw dbError(contactError, 'Não foi possível atualizar o consentimento de contato.');
  res.json({ settings: mapPreference(row) });
}));
router.put('/course-progress/:courseId', authenticate, allowRoles('candidate'), asyncRoute(async (req, res) => {
  const parsed = z.object({ action: z.enum(['plan','complete','reset']) }).safeParse(req.body);
  if (!parsed.success || !/^[a-z0-9_-]{1,100}$/i.test(req.params.courseId)) return res.status(400).json({ message: 'Ação de curso inválida.' });
  if (parsed.data.action === 'reset') {
    const { error } = await req.supabase.from('candidate_course_progress').delete().eq('candidate_user_id', req.user.id).eq('course_id', req.params.courseId);
    if (error) throw dbError(error, 'Não foi possível atualizar o plano.');
  } else {
    const { error } = await req.supabase.from('candidate_course_progress').upsert({ candidate_user_id: req.user.id, course_id: req.params.courseId, status: parsed.data.action === 'complete' ? 'completed' : 'saved', updated_at: new Date().toISOString() }, { onConflict: 'candidate_user_id,course_id' });
    if (error) throw dbError(error, 'Não foi possível atualizar o plano.');
  }
  res.status(204).end();
}));

router.post('/reports', authenticate, asyncRoute(async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira a categoria e a descrição do relato.' });
  const row = await data(req.supabase.from('reports').insert({ id: randomUUID(), reporter_user_id: req.user.id, category: parsed.data.category, description: parsed.data.description, connection_id: parsed.data.connectionId || null }).select('*').single(), 'Não foi possível registrar o relato.');
  res.status(201).json({ report: row });
}));

router.post('/platform/actions', authenticate, asyncRoute(async (req, res) => {
  const actionSchema = z.object({ action: z.string().min(1).max(80), data: z.record(z.string(), z.unknown()).default({}) }).strict();
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Ação inválida.' });
  const { action, data: input } = parsed.data;
  const db = req.supabase;
  let result = null;
  const stringField = (key, max = 500) => z.string().trim().min(1).max(max).parse(input[key]);
  const idField = (key) => z.string().min(1).max(100).parse(input[key]);
  const boolField = (key) => z.boolean().parse(input[key]);
  switch (action) {
    case 'toggleFavorite': {
      if (req.user.role !== 'candidate') throw httpError('Esta ação é exclusiva para candidatos.', 403);
      const jobId = idField('jobId');
      const existing = await data(db.from('candidate_favorites').select('job_id').eq('candidate_user_id', req.user.id).eq('job_id', jobId).maybeSingle(), 'Não foi possível consultar esta vaga salva.');
      if (existing) {
        const { error } = await db.from('candidate_favorites').delete().eq('candidate_user_id', req.user.id).eq('job_id', jobId);
        if (error) throw dbError(error, 'Não foi possível remover a vaga salva.');
        result = false;
      } else {
        await data(db.from('candidate_favorites').insert({ candidate_user_id: req.user.id, job_id: jobId }).select('job_id').single(), 'Não foi possível salvar esta vaga.');
        result = true;
      }
      break;
    }
    case 'applyToJob': {
      if (req.user.role !== 'candidate') throw httpError('Esta ação é exclusiva para candidatos.', 403);
      const jobId = idField('jobId');
      const row = await data(db.from('applications').insert({ id: randomUUID(), candidate_user_id: req.user.id, job_id: jobId, cover_message: text(2000).optional().parse(input.coverMessage) || '' }).select('*').single(), 'Não foi possível enviar a candidatura.');
      result = { id: row.id, jobId: row.job_id, candidateId: row.candidate_user_id, status: applicationStatusToUi(row.status), createdAt: row.applied_at, updatedAt: row.updated_at, history: [{ status: applicationStatusToUi(row.status), at: row.applied_at, note: 'Candidatura enviada.' }], isDemo: false };
      break;
    }
    case 'withdrawApplication': {
      const row = await data(db.from('applications').update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('id', idField('applicationId')).eq('candidate_user_id', req.user.id).select('*').maybeSingle(), 'Não foi possível desistir da candidatura.');
      if (!row) throw httpError('Candidatura não encontrada ou encerrada.', 404);
      result = { ...row, status: applicationStatusToUi(row.status), isDemo: false };
      break;
    }
    case 'updateApplicationStatus': {
      if (req.user.role !== 'company') throw httpError('Apenas a empresa responsável pode alterar este status.', 403);
      const status = z.enum(['Recebida','Em análise','Entrevista','Não selecionada','Contratada']).parse(input.status);
      const row = await data(db.from('applications').update({ status: applicationStatusToDb(status), updated_at: new Date().toISOString() }).eq('id', idField('applicationId')).select('*').maybeSingle(), 'Não foi possível atualizar a candidatura.');
      if (!row) throw httpError('Candidatura não encontrada para esta empresa.', 404);
      result = { ...row, status: applicationStatusToUi(row.status) };
      break;
    }
    case 'respondToConnection': {
      const response = boolField('accept') ? 'accept' : 'decline';
      const status = response === 'accept' ? 'connected' : 'declined';
      const row = await data(db.from('connections').update({ status, updated_at: new Date().toISOString() }).eq('id', idField('connectionId')).eq('candidate_user_id', req.user.id).eq('initiated_by', 'company').eq('status', 'pending').select('*').maybeSingle(), 'Não foi possível responder ao convite.');
      if (!row) throw httpError('Este convite não está mais disponível.', 404);
      result = mapConnection(row);
      break;
    }
    case 'startCandidateConnection': {
      if (req.user.role !== 'candidate') throw httpError('Esta ação é exclusiva para candidatos.', 403);
      const companyId = uuid.parse(input.companyId);
      const message = z.string().trim().min(10).max(1200).parse(input.presentation);
      const row = await data(db.from('connections').insert({ id: randomUUID(), company_id: companyId, candidate_user_id: req.user.id, initiated_by: 'candidate', status: 'connected' }).select('*').single(), 'Não foi possível iniciar a conexão.');
      const company = await data(req.adminSupabase.from('company_profiles').select('owner_user_id').eq('id', companyId).single(), 'Não foi possível localizar a empresa.');
      await data(db.from('connection_messages').insert({ id: randomUUID(), connection_id: row.id, sender_user_id: req.user.id, recipient_user_id: company.owner_user_id, body: message }).select('id').single(), 'Não foi possível enviar sua apresentação.');
      result = mapConnection(row);
      break;
    }
    case 'inviteCandidate': {
      if (req.user.role !== 'company') throw httpError('Apenas empresas podem convidar candidatos.', 403);
      const candidateUserId = uuid.parse(input.candidateId);
      const message = z.string().trim().min(10).max(1200).parse(input.invitationMessage);
      const row = await data(db.from('connections').insert({ id: randomUUID(), company_id: req.user.companyId, candidate_user_id: candidateUserId, initiated_by: 'company', status: 'pending', invitation_message: message }).select('*').single(), 'Não foi possível enviar o convite.');
      result = mapConnection(row);
      break;
    }
    case 'sendConnectionMessage': {
      const connectionId = idField('connectionId');
      const body = z.string().trim().min(1).max(2000).parse(input.text);
      const connection = await data(db.from('connections').select('*').eq('id', connectionId).maybeSingle(), 'Não foi possível carregar esta conversa.');
      if (!connection || connection.status !== 'connected') throw httpError('Conversa não disponível.', 404);
      let recipientId = connection.candidate_user_id;
      if (connection.candidate_user_id === req.user.id) {
        const company = await data(req.adminSupabase.from('company_profiles').select('owner_user_id').eq('id', connection.company_id).single(), 'Não foi possível localizar o destinatário.');
        recipientId = company.owner_user_id;
      }
      result = await data(db.from('connection_messages').insert({ id: randomUUID(), connection_id: connectionId, sender_user_id: req.user.id, recipient_user_id: recipientId, body }).select('*').single(), 'Não foi possível enviar a mensagem.');
      break;
    }
    case 'markConnectionMessagesRead': {
      const { error } = await db.from('connection_messages').update({ read_at: new Date().toISOString() }).eq('connection_id', idField('connectionId')).eq('recipient_user_id', req.user.id).is('read_at', null);
      if (error) throw dbError(error, 'Não foi possível marcar as mensagens como lidas.');
      result = true;
      break;
    }
    case 'blockConnection': {
      const row = await data(db.from('connections').update({ status: 'blocked', blocked_by_user_id: req.user.id, updated_at: new Date().toISOString() }).eq('id', idField('connectionId')).select('*').maybeSingle(), 'Não foi possível bloquear o contato.');
      if (!row) throw httpError('Conexão não encontrada.', 404);
      result = mapConnection(row);
      break;
    }
    case 'toggleSavedTalent': {
      if (req.user.role !== 'company') throw httpError('Apenas empresas podem salvar talentos.', 403);
      const candidateUserId = uuid.parse(input.candidateId);
      const current = await data(db.from('company_saved_talents').select('candidate_user_id').eq('company_id', req.user.companyId).eq('candidate_user_id', candidateUserId).maybeSingle(), 'Não foi possível consultar a lista de talentos.');
      if (current) {
        const { error } = await db.from('company_saved_talents').delete().eq('company_id', req.user.companyId).eq('candidate_user_id', candidateUserId);
        if (error) throw dbError(error, 'Não foi possível remover o perfil salvo.');
        result = false;
      } else {
        await data(db.from('company_saved_talents').insert({ company_id: req.user.companyId, candidate_user_id: candidateUserId }).select('candidate_user_id').single(), 'Não foi possível salvar este perfil.');
        result = true;
      }
      break;
    }
    case 'respondToInterviewInvitation':
    case 'cancelInterviewInvitation': {
      const status = action === 'cancelInterviewInvitation' ? 'cancelled' : input.response === 'accepted' ? 'accepted' : 'declined';
      if (!['accepted','declined','cancelled'].includes(status)) throw httpError('Resposta inválida.', 400);
      let query = db.from('interview_invitations').update({ status, updated_at: new Date().toISOString() }).eq('id', idField('invitationId'));
      if (status === 'cancelled') query = query.eq('company_id', req.user.companyId);
      else query = query.eq('candidate_user_id', req.user.id).eq('status', 'pending');
      result = await data(query.select('*').maybeSingle(), 'Não foi possível atualizar o convite.');
      if (!result) throw httpError('Convite não encontrado ou ação não autorizada.', 404);
      result = mapInterviewInvitation(result);
      break;
    }
    case 'createInterviewInvitation': {
      if (req.user.role !== 'company') throw httpError('Apenas empresas podem convidar candidatos para entrevista.', 403);
      const applicationId = idField('applicationId');
      const parsed = invitationSchema.safeParse(input.fields);
      if (!parsed.success) throw httpError('Confira os dados do convite.', 400);
      const application = await data(db.from('applications').select('id,candidate_user_id,job_id').eq('id', applicationId).maybeSingle(), 'Não foi possível carregar a candidatura.');
      if (!application) throw httpError('Candidatura não encontrada.', 404);
      const fields = parsed.data;
      if (new Date(fields.startsAt).getTime() < Date.now() + 10 * 60_000) throw httpError('Escolha um horário pelo menos 10 minutos no futuro.', 400);
      if (fields.mode === 'Presencial' && fields.meetingDetails.length < 4) throw httpError('Informe o local da entrevista presencial.', 400);
      if (fields.mode === 'Online' && !validHttpsOrEmpty(fields.meetingDetails)) throw httpError('Informe um link HTTP ou HTTPS válido.', 400);
      result = await data(db.from('interview_invitations').insert({ id: randomUUID(), company_id: req.user.companyId, candidate_user_id: application.candidate_user_id, job_id: application.job_id, application_id: application.id, starts_at: fields.startsAt, mode: fields.mode, meeting_details: fields.meetingDetails, message: fields.message }).select('*').single(), 'Não foi possível criar o convite.');
      break;
    }
    case 'withdrawApplication':
      // Routed through its own endpoint; retained for compatibility with the platform adapter.
      result = await data(db.from('applications').update({ status: 'withdrawn', updated_at: new Date().toISOString() }).eq('id', idField('applicationId')).eq('candidate_user_id', req.user.id).select('*').maybeSingle(), 'Não foi possível desistir da candidatura.');
      break;
    case 'deleteInterviewPractice': {
      const { error } = await db.from('candidate_interview_sessions').delete().eq('id', idField('interviewId')).eq('candidate_user_id', req.user.id);
      if (error) throw dbError(error, 'Não foi possível excluir a prática.');
      result = true;
      break;
    }
    case 'saveInterviewPractice': {
      if (req.user.role !== 'candidate') throw httpError('Apenas candidatos podem salvar o histórico.', 403);
      const parsed = practiceSchema.safeParse(input.practice);
      if (!parsed.success) throw httpError('Confira a resposta antes de salvar.', 400);
      const practice = parsed.data;
      const row = await data(db.from('candidate_interview_sessions').insert({ id: randomUUID(), candidate_user_id: req.user.id, job_type: practice.jobType, experience_level: practice.experienceLevel, target_role: practice.targetRole, question_id: practice.questionId, question: practice.question, answer: practice.answer, feedback: practice.feedback, provider: 'guided-rules' }).select('*').single(), 'Não foi possível salvar o histórico.');
      result = { id: row.id, candidateId: row.candidate_user_id, jobType: row.job_type, experienceLevel: row.experience_level, targetRole: row.target_role, questionId: row.question_id, question: row.question, answer: row.answer, feedback: row.feedback, provider: row.provider, createdAt: row.created_at, isDemo: false };
      break;
    }
    case 'markNotificationRead': {
      const { error } = await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', idField('notificationId')).eq('user_id', req.user.id);
      if (error) throw dbError(error, 'Não foi possível marcar o aviso como lido.');
      result = true;
      break;
    }
    case 'markAllNotificationsRead': {
      const { error } = await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', req.user.id).is('read_at', null);
      if (error) throw dbError(error, 'Não foi possível atualizar as notificações.');
      result = true;
      break;
    }
    case 'saveCandidateSettings': {
      if (req.user.role !== 'candidate') throw httpError('Esta preferência é exclusiva para candidatos.', 403);
      const parsed = settingsSchema.safeParse(input.settings);
      if (!parsed.success) throw httpError('Preferências inválidas.', 400);
      const current = await data(db.from('candidate_settings').select('*').eq('candidate_user_id', req.user.id).maybeSingle(), 'Não foi possível carregar as preferências.');
      const value = { ...current, ...parsed.data };
      const visible = value.visibleToCompanies === true;
      const row = await data(db.from('candidate_settings').upsert({
        candidate_user_id: req.user.id, notify_new_jobs: value.notifyNewJobs !== false, visible_to_companies: visible,
        distance_radius_km: Number(value.distanceMaxKm || 50), radar_address: value.radarAddress || null,
        radar_city: value.radarCity || null, radar_state: value.radarState?.toUpperCase() || null,
        radar_neighborhood: value.radarNeighborhood || null, radar_type: value.radarType || null,
        radar_area: value.radarArea || null, radar_modality: value.radarModality || null, updated_at: new Date().toISOString(),
      }, { onConflict: 'candidate_user_id' }).select('*').single(), 'Não foi possível salvar as preferências.');
      const { error: profileError } = await db.from('candidate_profiles').update({ visible_to_companies: visible, visibility_consented_at: visible ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('user_id', req.user.id);
      if (profileError) throw dbError(profileError, 'Não foi possível atualizar a visibilidade do perfil.');
      const { error: contactError } = await db.from('candidate_contacts').update({ contact_sharing_consent: visible, contact_consented_at: visible ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('user_id', req.user.id);
      if (contactError) throw dbError(contactError, 'Não foi possível atualizar o consentimento de contato.');
      result = mapPreference(row);
      break;
    }
    case 'setCourseProgress': {
      if (req.user.role !== 'candidate') throw httpError('Esta ação é exclusiva para candidatos.', 403);
      const courseId = idField('courseId');
      const courseAction = z.enum(['plan','complete','reset']).parse(input.action);
      if (courseAction === 'reset') {
        const { error } = await db.from('candidate_course_progress').delete().eq('candidate_user_id', req.user.id).eq('course_id', courseId);
        if (error) throw dbError(error, 'Não foi possível atualizar o plano.');
      } else {
        const { error } = await db.from('candidate_course_progress').upsert({ candidate_user_id: req.user.id, course_id: courseId, status: courseAction === 'complete' ? 'completed' : 'saved', updated_at: new Date().toISOString() }, { onConflict: 'candidate_user_id,course_id' });
        if (error) throw dbError(error, 'Não foi possível atualizar o plano.');
      }
      result = true;
      break;
    }
    case 'createReport': {
      const parsed = reportSchema.safeParse({ category: input.fields?.category, description: input.fields?.description, connectionId: input.fields?.connectionId || null });
      if (!parsed.success) throw httpError('Confira a categoria e a descrição do relato.', 400);
      result = await data(db.from('reports').insert({ id: randomUUID(), reporter_user_id: req.user.id, category: parsed.data.category, description: parsed.data.description, connection_id: parsed.data.connectionId }).select('*').single(), 'Não foi possível registrar o relato.');
      break;
    }
    case 'saveCompany': {
      if (req.user.role !== 'company' || req.user.companyId !== input.companyId) throw httpError('Esta conta não pode editar este perfil empresarial.', 403);
      const parsed = companyUpdateSchema.safeParse(input.fields);
      if (!parsed.success) throw httpError('Confira os dados da empresa.', 400);
      const { error } = await db.from('company_profiles').update(normalizeCompanyFields(parsed.data)).eq('id', req.user.companyId);
      if (error) throw dbError(error, 'Não foi possível atualizar a empresa.');
      const privateFields = {};
      if (parsed.data.address !== undefined) privateFields.address = parsed.data.address || null;
      if (parsed.data.phone !== undefined) privateFields.phone = parsed.data.phone || null;
      if (Object.keys(privateFields).length) {
        const { error: privateError } = await db.from('company_private').update({ ...privateFields, updated_at: new Date().toISOString() }).eq('company_id', req.user.companyId);
        if (privateError) throw dbError(privateError, 'Não foi possível atualizar os dados privados da empresa.');
      }
      result = true;
      break;
    }
    case 'createJob':
    case 'updateJob': {
      if (req.user.role !== 'company') throw httpError('Apenas empresas podem gerenciar anúncios.', 403);
      const parsed = jobSchema.safeParse(input.fields);
      if (!parsed.success) throw httpError('Confira os campos do anúncio.', 400);
      if (!validHttpsOrEmpty(parsed.data.applicationUrl)) throw httpError('O link de candidatura precisa usar HTTP ou HTTPS.', 400);
      if (action === 'createJob') {
        const row = await data(db.from('jobs').insert({ id: randomUUID(), ...jobFields(parsed.data, req.user.companyId, parsed.data.active ? 'pending_review' : 'draft') }).select(JOB_SELECT_COLUMNS).single(), 'Não foi possível criar o anúncio.');
        result = mapJob(row);
      } else {
        const jobId = idField('jobId');
        const current = await data(db.from('jobs').select('status').eq('id', jobId).maybeSingle(), 'Não foi possível localizar o anúncio.');
        if (!current) throw httpError('Anúncio não encontrado.', 404);
        const status = parsed.data.active ? current.status === 'published' || current.status === 'draft' ? 'pending_review' : current.status : 'paused';
        const update = jobFields(parsed.data, req.user.companyId, status);
        delete update.company_id;
        const row = await data(db.from('jobs').update(update).eq('id', jobId).select(JOB_SELECT_COLUMNS).single(), 'Não foi possível atualizar o anúncio.');
        result = mapJob(row);
      }
      break;
    }
    case 'setJobActive': {
      const active = boolField('active');
      const jobId = idField('jobId');
      if (req.user.role === 'admin') {
        await audit(req, active ? 'publish_job' : 'pause_job', 'jobs', jobId, { active });
        const row = await data(req.adminSupabase.from('jobs').update({ status: active ? 'published' : 'paused', reviewed_at: new Date().toISOString(), reviewed_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', jobId).select('*').maybeSingle(), 'Não foi possível atualizar o anúncio.');
        if (!row) throw httpError('Anúncio não encontrado.', 404);
        result = mapJob(row);
      } else {
        if (req.user.role !== 'company') throw httpError('Apenas a empresa responsável pode alterar o anúncio.', 403);
        const row = await data(db.from('jobs').update({ status: active ? 'pending_review' : 'paused', updated_at: new Date().toISOString() }).eq('id', jobId).select(JOB_SELECT_COLUMNS).maybeSingle(), 'Não foi possível atualizar o anúncio.');
        if (!row) throw httpError('Anúncio não encontrado.', 404);
        result = mapJob(row);
      }
      break;
    }
    case 'archiveCompanyJob': {
      const row = await data(db.from('jobs').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', idField('jobId')).select(JOB_SELECT_COLUMNS).maybeSingle(), 'Não foi possível arquivar o anúncio.');
      if (!row) throw httpError('Anúncio não encontrado.', 404);
      result = mapJob(row);
      break;
    }
    case 'setCompanyVerified':
    case 'setCompanyActive':
    case 'adminUpdateCompany': {
      if (req.user.role !== 'admin') throw httpError('Ação exclusiva da administração.', 403);
      const companyId = uuid.parse(input.companyId);
      const before = await data(req.adminSupabase.from('company_profiles').select('*').eq('id', companyId).maybeSingle(), 'Não foi possível localizar a empresa.');
      if (!before) throw httpError('Empresa não encontrada.', 404);
      let patch = {};
      if (action === 'setCompanyVerified') patch.verified_at = boolField('verified') ? (before.verified_at || new Date().toISOString()) : null;
      else if (action === 'setCompanyActive') patch.active = boolField('active');
      else {
        const parsed = companyUpdateSchema.safeParse(input.fields);
        if (!parsed.success) throw httpError('Confira os dados da empresa.', 400);
        patch = normalizeCompanyFields(parsed.data);
        const privatePatch = {};
        if (parsed.data.address !== undefined) privatePatch.address = parsed.data.address || null;
        if (parsed.data.phone !== undefined) privatePatch.phone = parsed.data.phone || null;
        if (Object.keys(privatePatch).length) {
          const { error } = await req.adminSupabase.from('company_private').update({ ...privatePatch, updated_at: new Date().toISOString() }).eq('company_id', companyId);
          if (error) throw dbError(error, 'Não foi possível atualizar dados empresariais privados.');
        }
      }
      await audit(req, action, 'company_profiles', companyId, patch);
      const row = await data(req.adminSupabase.from('company_profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', companyId).select('*').single(), 'Não foi possível atualizar a empresa.');
      result = mapCompanyProfile(row, await privateCompaniesFor(req, [companyId]).then((items) => items.get(companyId)));
      break;
    }
    case 'updateAccountStatus': {
      if (req.user.role !== 'admin') throw httpError('Ação exclusiva da administração.', 403);
      const status = z.enum(['active','blocked']).parse(input.status);
      const dbStatus = status === 'blocked' ? 'suspended' : 'active';
      const userId = uuid.parse(input.userId);
      await audit(req, 'update_account_status', 'profiles', userId, { status: dbStatus });
      const row = await data(req.adminSupabase.from('profiles').update({ status: dbStatus, updated_at: new Date().toISOString() }).eq('id', userId).select('id,status,role,full_name,created_at').maybeSingle(), 'Não foi possível alterar o estado da conta.');
      if (!row) throw httpError('Conta não encontrada.', 404);
      result = { id: row.id, role: row.role, nome: row.full_name, status: profileState(row), email: '' };
      break;
    }
    case 'setAdActive':
    case 'deleteAd':
    case 'saveAd': {
      if (req.user.role !== 'admin') throw httpError('Ação exclusiva da administração.', 403);
      const adId = input.adId ? idField('adId') : null;
      if (action === 'saveAd') {
        const parsed = z.object({ title: z.string().trim().min(1).max(160), message: z.string().trim().min(10).max(1000), active: z.boolean().optional() }).strict().safeParse(input.fields);
        if (!parsed.success) throw httpError('Confira o título e o conteúdo do comunicado.', 400);
        if (adId) {
          const row = await data(req.adminSupabase.from('announcements').update({ title: parsed.data.title, message: parsed.data.message, active: parsed.data.active !== false, updated_at: new Date().toISOString() }).eq('id', adId).select('*').single(), 'Não foi possível atualizar o comunicado.');
          result = row;
        } else {
          result = await data(req.adminSupabase.from('announcements').insert({ id: randomUUID(), title: parsed.data.title, message: parsed.data.message, active: parsed.data.active !== false, created_by: req.user.id }).select('*').single(), 'Não foi possível criar o comunicado.');
        }
      } else if (action === 'setAdActive') {
        result = await data(req.adminSupabase.from('announcements').update({ active: boolField('active'), updated_at: new Date().toISOString() }).eq('id', adId).select('*').maybeSingle(), 'Não foi possível atualizar o comunicado.');
        if (!result) throw httpError('Comunicado não encontrado.', 404);
      } else {
        const { error } = await req.adminSupabase.from('announcements').delete().eq('id', adId);
        if (error) throw dbError(error, 'Não foi possível remover o comunicado.');
        result = true;
      }
      break;
    }
    case 'setReportStatus': {
      if (req.user.role !== 'admin') throw httpError('Ação exclusiva da administração.', 403);
      const reportId = idField('reportId');
      const status = input.status === 'Resolvido' || input.status === 'resolved' ? 'resolved' : input.status === 'dismissed' ? 'dismissed' : 'reviewing';
      await audit(req, 'update_report_status', 'reports', reportId, { status });
      result = await data(req.adminSupabase.from('reports').update({ status, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() }).eq('id', reportId).select('*').maybeSingle(), 'Não foi possível atualizar o relato.');
      if (!result) throw httpError('Relato não encontrado.', 404);
      break;
    }
    default: throw httpError('Ação não disponível.', 404);
  }
  return res.json({ result });
}));

export default router;
