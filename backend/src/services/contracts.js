const APPLICATION_TO_UI = Object.freeze({
  submitted: 'Recebida',
  in_review: 'Em análise',
  interview: 'Entrevista',
  offered: 'Oferta',
  rejected: 'Não selecionada',
  withdrawn: 'Desistiu',
  hired: 'Contratada',
});
const APPLICATION_TO_DB = Object.freeze(Object.fromEntries(Object.entries(APPLICATION_TO_UI).map(([key, value]) => [value, key])));
const JOB_TO_UI = Object.freeze({ draft: 'draft', pending_review: 'pending_review', published: 'confirmed', paused: 'paused', closed: 'closed', rejected: 'rejected' });
const CONNECTION_TO_UI = Object.freeze({ connected: 'connected', pending: 'pending', declined: 'declined', blocked: 'blocked', ended: 'ended' });

export function applicationStatusToUi(status) {
  return APPLICATION_TO_UI[status] || 'Recebida';
}

export function applicationStatusToDb(status) {
  return APPLICATION_TO_DB[status] || null;
}

export function mapCompany(row, privateDetails = null) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_user_id || '',
    name: row.name || '',
    cnpj: privateDetails?.cnpj || '',
    sector: row.sector || '',
    description: row.description || '',
    city: row.city || '',
    state: row.state || '',
    address: privateDetails?.address || '',
    website: row.website || '',
    contactEmail: row.public_contact_email || '',
    phone: privateDetails?.phone || '',
    verified: Boolean(row.verified_at),
    verifiedAt: row.verified_at || null,
    active: row.active !== false,
    isDemo: false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function mapJob(row, company = null) {
  if (!row) return null;
  const type = row.employment_type || row.type || '';
  const status = JOB_TO_UI[row.status] || row.status || 'pending_review';
  const published = row.status === 'published';
  const requirements = Array.isArray(row.requirements) ? row.requirements : [];
  const requiredSkills = Array.isArray(row.required_skills) ? row.required_skills : [];
  return {
    id: row.id,
    companyId: row.company_id || row.companyId,
    companyName: company?.name || row.company_name || row.companyName || '',
    title: row.title || '',
    area: row.area || '',
    type,
    modality: row.modality || '',
    city: row.city || '',
    state: row.state || '',
    address: row.address || '',
    education: row.education || '',
    description: row.description || '',
    salaryMin: row.salary_min === null || row.salary_min === undefined ? null : Number(row.salary_min),
    salaryMax: row.salary_max === null || row.salary_max === undefined ? null : Number(row.salary_max),
    requirements: [...new Set([...requirements, ...requiredSkills])],
    requiredSkills,
    requiredCourses: Array.isArray(row.required_courses) ? row.required_courses : [],
    requiredExperience: Array.isArray(row.required_experience) ? row.required_experience : [],
    benefits: Array.isArray(row.benefits) ? row.benefits : [],
    applicationUrl: row.application_url || '',
    active: published || row.status === 'pending_review' || row.status === 'draft',
    approved: published,
    confirmed: published,
    isDemo: false,
    status,
    statusLabel: published ? 'Anúncio publicado pela empresa e revisado pela plataforma' : 'Anúncio não publicado',
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    activeUntil: row.active_until || null,
  };
}

export function mapApplication(row, { job, company, candidate } = {}) {
  if (!row) return null;
  const history = (row.application_events || []).map((entry) => ({
    status: applicationStatusToUi(entry.status),
    at: entry.created_at,
    note: entry.note || '',
  }));
  if (!history.length && row.applied_at) history.push({ status: applicationStatusToUi(row.status), at: row.applied_at, note: 'Candidatura enviada.' });
  return {
    id: row.id,
    candidateId: row.candidate_user_id,
    jobId: row.job_id,
    status: applicationStatusToUi(row.status),
    coverMessage: row.cover_message || '',
    createdAt: row.applied_at || row.created_at || null,
    updatedAt: row.updated_at || null,
    history,
    isDemo: false,
    job: job || null,
    company: company || null,
    candidate: candidate || null,
  };
}

export function mapNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.body,
    targetView: row.target_view || 'notifications',
    linkId: row.target_id || null,
    type: row.type || 'info',
    read: Boolean(row.read_at),
    readAt: row.read_at || null,
    createdAt: row.created_at,
    isDemo: false,
  };
}

export function mapConnection(row, { company = null, candidate = null } = {}) {
  return {
    id: row.id,
    companyId: row.company_id,
    candidateId: row.candidate_user_id,
    initiatedBy: row.initiated_by,
    status: CONNECTION_TO_UI[row.status] || row.status,
    invitationMessage: row.invitation_message || '',
    blockedBy: row.blocked_by_user_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acceptedAt: row.status === 'connected' ? row.updated_at : null,
    company,
    candidate,
    messages: [],
    isDemo: false,
  };
}

export function mapInterviewInvitation(row, { company = null, candidate = null, job = null } = {}) {
  return {
    id: row.id,
    companyId: row.company_id,
    candidateId: row.candidate_user_id,
    jobId: row.job_id,
    applicationId: row.application_id,
    startsAt: row.starts_at,
    mode: row.mode,
    meetingDetails: row.meeting_details || '',
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    company,
    candidate,
    job,
    isDemo: false,
  };
}

export function mapProfile(profile, { privateData = null, contacts = null, email = '', candidate = true } = {}) {
  if (!profile) return null;
  const source = candidate || profile.role === 'candidate' ? profile : {};
  const candidateProfile = source.candidate_profiles || source.candidate_profile || source;
  return {
    id: profile.id,
    role: profile.role || 'candidate',
    status: profile.status === 'suspended' ? 'blocked' : profile.status || 'active',
    nome: profile.full_name || profile.name || '',
    email: email || privateData?.email || contacts?.email || '',
    telefone: privateData?.phone || contacts?.phone || '',
    dataNascimento: privateData?.birth_date || '',
    cidade: candidateProfile.city || '',
    estado: candidateProfile.state || '',
    escolaridade: candidateProfile.education_level || '',
    curso: candidateProfile.course || '',
    instituicao: candidateProfile.institution || '',
    areaInteresse: candidateProfile.area_interest || '',
    tiposVaga: Array.isArray(candidateProfile.opportunity_types) ? candidateProfile.opportunity_types : [],
    disponibilidade: candidateProfile.availability || '',
    resumo: candidateProfile.summary || '',
    habilidades: Array.isArray(candidateProfile.skills) ? candidateProfile.skills : [],
    cursos: Array.isArray(candidateProfile.courses) ? candidateProfile.courses : [],
    experiencias: Array.isArray(candidateProfile.experiences) ? candidateProfile.experiences : [],
    linkedin: candidateProfile.linkedin || '',
    github: candidateProfile.github || '',
    portfolio: candidateProfile.portfolio || '',
    visibleToCompanies: Boolean(candidateProfile.visible_to_companies),
    contactSharingConsent: Boolean(contacts?.contact_sharing_consent),
    criadoEm: profile.created_at || '',
    atualizadoEm: candidateProfile.updated_at || profile.updated_at || '',
    termosAceitosEm: profile.terms_accepted_at || null,
    companyId: profile.companyId || profile.company_id || null,
  };
}
