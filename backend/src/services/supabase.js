import { createClient } from '@supabase/supabase-js';

const authOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
    flowType: 'implicit',
  },
};

export function supabaseEnvironment() {
  return {
    url: String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, ''),
    anonKey: String(process.env.SUPABASE_ANON_KEY || '').trim(),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  };
}

export function isSupabaseConfigured() {
  const { url, anonKey, serviceRoleKey } = supabaseEnvironment();
  return Boolean(url && anonKey && serviceRoleKey);
}

export function requireSupabaseConfig() {
  const config = supabaseEnvironment();
  if (!config.url || !config.anonKey || !config.serviceRoleKey) {
    const error = new Error('Supabase ainda não está configurado no servidor. Preencha SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no backend/.env.');
    error.status = 503;
    throw error;
  }
  return config;
}

export function createAnonymousClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createClient(url, anonKey, authOptions);
}

export function createAdminClient() {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  return createClient(url, serviceRoleKey, authOptions);
}

export function createUserClient(accessToken) {
  if (!accessToken) {
    const error = new Error('Sessão necessária.');
    error.status = 401;
    throw error;
  }
  const { url, anonKey } = requireSupabaseConfig();
  return createClient(url, anonKey, {
    ...authOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function getUserProfile(userId, client = createAdminClient()) {
  const { data, error } = await client
    .from('profiles')
    .select('id,role,status,full_name,terms_accepted_at,created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function publicApiUser(profile, authUser = {}) {
  return {
    id: profile.id,
    nome: profile.full_name,
    email: String(authUser.email || '').toLowerCase(),
    role: profile.role,
    status: profile.status === 'suspended' ? 'blocked' : profile.status,
    criadoEm: profile.created_at,
    ...(profile.company_id ? { companyId: profile.company_id } : {}),
  };
}

export function authSession(session) {
  if (!session?.access_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || (session.expires_in ? Math.floor(Date.now() / 1000) + session.expires_in : null),
    token_type: session.token_type || 'bearer',
  };
}

export function httpError(message, status = 400, details = undefined) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}
