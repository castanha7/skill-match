import { createAdminClient, createUserClient, httpError, publicApiUser } from '../services/supabase.js';

export async function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ message: 'Faça login para continuar.' });
  try {
    const userClient = createUserClient(token);
    const [{ data: authResult, error: authError }, admin] = await Promise.all([
      userClient.auth.getUser(token),
      Promise.resolve(createAdminClient()),
    ]);
    if (authError || !authResult?.user) return res.status(401).json({ message: 'Sua sessão expirou. Entre novamente.' });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id,role,status,full_name,created_at,terms_accepted_at')
      .eq('id', authResult.user.id)
      .maybeSingle();
    if (profileError) return next(profileError);
    if (!profile || profile.status !== 'active') {
      return res.status(403).json({ message: 'Esta conta está suspensa ou indisponível.' });
    }
    if (profile.role !== 'admin' && !profile.terms_accepted_at) {
      return res.status(403).json({ message: 'A conta precisa aceitar os termos antes de continuar.' });
    }

    let companyId = null;
    if (profile.role === 'company') {
      const { data: company, error: companyError } = await admin
        .from('company_profiles')
        .select('id')
        .eq('owner_user_id', profile.id)
        .maybeSingle();
      if (companyError) return next(companyError);
      companyId = company?.id || null;
    }

    req.accessToken = token;
    req.supabase = userClient;
    req.adminSupabase = admin;
    req.authUser = authResult.user;
    req.user = {
      sub: profile.id,
      id: profile.id,
      email: String(authResult.user.email || '').toLowerCase(),
      role: profile.role,
      status: profile.status,
      name: profile.full_name,
      companyId,
      user: publicApiUser({ ...profile, company_id: companyId }, authResult.user),
    };
    return next();
  } catch (error) {
    if (Number(error.status) === 503) return res.status(503).json({ message: error.message });
    return next(error);
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'Você não tem permissão para esta operação.' });
}

export function requireRecord(result, message = 'Registro não encontrado.') {
  if (!result?.data) throw httpError(message, 404);
  return result.data;
}
