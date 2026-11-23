-- SkillMatch / Supabase (PostgreSQL)
-- Bootstrap schema for a new Supabase project. Safe to re-run: it preserves data and
-- replaces SkillMatch triggers/policies. It never creates fake users or sample records.
-- Public signup creates candidates; the trusted API provisions company accounts.

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'candidate' check (role in ('candidate','company','admin')),
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  full_name text not null default '' check (char_length(full_name) between 1 and 160),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email, birth date and contact details are deliberately separated from the
-- discoverable candidate profile; the API only returns them with explicit consent.
create table if not exists public.candidate_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  phone text,
  contact_sharing_consent boolean not null default false,
  contact_consented_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  city text,
  state char(2),
  education_level text,
  course text,
  institution text,
  area_interest text,
  opportunity_types text[] not null default '{}',
  availability text,
  summary text not null default '',
  skills text[] not null default '{}',
  linkedin text,
  github text,
  portfolio text,
  courses text[] not null default '{}',
  experiences text[] not null default '{}',
  visible_to_companies boolean not null default false,
  visibility_consented_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 180),
  sector text,
  description text not null default '',
  city text not null,
  state char(2) not null,
  website text,
  public_contact_email text,
  verified_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CNPJ and street address are never exposed through the public company listing.
create table if not exists public.company_private (
  company_id uuid primary key references public.company_profiles(id) on delete cascade,
  cnpj text not null unique check (cnpj ~ '^[0-9A-Z]{14}$'),
  address text,
  phone text,
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id text primary key default gen_random_uuid()::text,
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  area text not null,
  employment_type text not null check (employment_type in ('Jovem Aprendiz','Estágio','Primeiro Emprego','Trainee','CLT','Temporário','Outro')),
  modality text not null check (modality in ('Presencial','Híbrido','Remoto')),
  city text not null,
  state char(2) not null,
  address text,
  education text,
  description text not null check (char_length(description) between 20 and 10000),
  required_skills text[] not null default '{}',
  required_courses text[] not null default '{}',
  required_experience text[] not null default '{}',
  requirements text[] not null default '{}',
  benefits text[] not null default '{}',
  application_url text,
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  status text not null default 'pending_review' check (status in ('draft','pending_review','published','paused','closed','rejected')),
  active_until timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_min >= 0),
  check (salary_max is null or salary_max >= 0),
  check (salary_min is null or salary_max is null or salary_max >= salary_min)
);

create table if not exists public.applications (
  id text primary key default gen_random_uuid()::text,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','in_review','interview','offered','rejected','withdrawn','hired')),
  cover_message text not null default '',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_user_id, job_id)
);

create table if not exists public.application_events (
  id bigint generated always as identity primary key,
  application_id text not null references public.applications(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_favorites (
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_user_id, job_id)
);

create table if not exists public.company_saved_talents (
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, candidate_user_id)
);

create table if not exists public.connections (
  id text primary key default gen_random_uuid()::text,
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  initiated_by text not null check (initiated_by in ('candidate','company')),
  status text not null default 'pending' check (status in ('pending','connected','declined','blocked','ended')),
  invitation_message text not null default '',
  blocked_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, candidate_user_id)
);

create table if not exists public.connection_messages (
  id text primary key default gen_random_uuid()::text,
  connection_id text not null references public.connections(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_invitations (
  id text primary key default gen_random_uuid()::text,
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  job_id text references public.jobs(id) on delete set null,
  application_id text references public.applications(id) on delete set null,
  starts_at timestamptz not null,
  mode text not null check (mode in ('Online','Presencial')),
  meeting_details text not null default '',
  message text not null check (char_length(message) between 10 and 700),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 500),
  target_view text,
  target_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_interview_sessions (
  id text primary key default gen_random_uuid()::text,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  job_type text not null,
  experience_level text not null,
  target_role text not null default '',
  question_id text not null default '',
  question text not null check (char_length(question) between 1 and 1000),
  answer text not null check (char_length(answer) between 10 and 4000),
  feedback jsonb not null default '{}'::jsonb,
  provider text not null default 'rules',
  external_ai_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_course_progress (
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null,
  status text not null default 'saved' check (status in ('saved','in_progress','completed')),
  updated_at timestamptz not null default now(),
  primary key (candidate_user_id, course_id)
);

create table if not exists public.candidate_settings (
  candidate_user_id uuid primary key references public.profiles(id) on delete cascade,
  notify_new_jobs boolean not null default true,
  visible_to_companies boolean not null default false,
  distance_radius_km integer not null default 50 check (distance_radius_km between 1 and 250),
  radar_address text,
  radar_city text,
  radar_state char(2),
  radar_neighborhood text,
  radar_type text,
  radar_area text,
  radar_modality text,
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id text primary key default gen_random_uuid()::text,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  description text not null check (char_length(description) between 10 and 3000),
  connection_id text references public.connections(id) on delete set null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id text primary key default gen_random_uuid()::text,
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 10 and 1000),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_status_idx on public.profiles (role,status);
create index if not exists companies_public_idx on public.company_profiles (state,city,name) where active=true and verified_at is not null;
create index if not exists jobs_public_listing_idx on public.jobs (status, state, city, created_at desc);
create index if not exists jobs_company_status_idx on public.jobs (company_id, status, created_at desc);
create index if not exists applications_job_status_idx on public.applications (job_id, status, applied_at desc);
create index if not exists applications_candidate_idx on public.applications (candidate_user_id, applied_at desc);
create index if not exists connections_candidate_status_idx on public.connections (candidate_user_id,status,updated_at desc);
create index if not exists connections_company_status_idx on public.connections (company_id,status,updated_at desc);
create index if not exists saved_talents_candidate_idx on public.company_saved_talents (candidate_user_id,created_at desc);
create index if not exists invitations_application_idx on public.interview_invitations (application_id);
create index if not exists invitations_candidate_idx on public.interview_invitations (candidate_user_id, starts_at desc);
create index if not exists invitations_company_idx on public.interview_invitations (company_id, starts_at desc);
create index if not exists reports_open_idx on public.reports (status,created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);
create index if not exists messages_thread_idx on public.connection_messages (connection_id, created_at);
create index if not exists messages_recipient_idx on public.connection_messages (recipient_user_id, read_at, created_at desc);
create index if not exists candidate_skills_gin_idx on public.candidate_profiles using gin (skills);
create index if not exists job_skills_gin_idx on public.jobs using gin (required_skills);

do $$ declare t text; begin
  foreach t in array array[
    'profiles','candidate_private','candidate_contacts','candidate_profiles',
    'company_profiles','company_private','jobs','applications','connections',
    'interview_invitations','candidate_course_progress','candidate_settings','announcements'
  ] loop
    execute format('drop trigger if exists skillmatch_set_updated_at on public.%I', t);
    execute format('create trigger skillmatch_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create or replace function public.current_account_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.status = 'active' and p.terms_accepted_at is not null
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_account_role() = 'admin', false)
$$;

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.company_profiles c join public.profiles p on p.id=c.owner_user_id
  where c.owner_user_id=auth.uid() and c.active=true and p.role='company' and p.status='active' and p.terms_accepted_at is not null limit 1
$$;

create or replace function public.company_is_public(target_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_profiles cp join public.profiles p on p.id=cp.owner_user_id
    where cp.id=target_company_id and cp.active=true and cp.verified_at is not null
      and p.role='company' and p.status='active' and p.terms_accepted_at is not null
  )
$$;

create or replace function public.candidate_is_discoverable(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.candidate_profiles cp join public.profiles p on p.id=cp.user_id
    where cp.user_id=target_user_id and cp.visible_to_companies=true and p.status='active' and p.terms_accepted_at is not null
  )
$$;

create or replace function public.company_has_candidate_relationship(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_profiles cp where cp.id=public.current_company_id() and cp.verified_at is not null)
    and not exists (
      select 1 from public.connections blocked where blocked.candidate_user_id=target_user_id
        and blocked.company_id=public.current_company_id() and blocked.status='blocked'
    ) and (exists (
      select 1 from public.applications a join public.jobs j on j.id=a.job_id
      where a.candidate_user_id=target_user_id and j.company_id=public.current_company_id()
    ) or exists (
      select 1 from public.connections c where c.candidate_user_id=target_user_id
        and c.company_id=public.current_company_id() and c.status='connected'
    ))
$$;

create or replace function public.can_view_candidate(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid()=target_user_id or public.is_platform_admin()
    or (public.current_account_role()='company'
      and exists(select 1 from public.company_profiles cp where cp.id=public.current_company_id() and cp.verified_at is not null)
      and not exists(select 1 from public.connections c where c.candidate_user_id=target_user_id and c.company_id=public.current_company_id() and c.status='blocked')
      and (public.candidate_is_discoverable(target_user_id) or public.company_has_candidate_relationship(target_user_id)))
$$;

create or replace function public.can_view_candidate_contact(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid()=target_user_id or public.is_platform_admin()
    or (public.current_account_role()='company'
      and exists (select 1 from public.candidate_contacts cc where cc.user_id=target_user_id and cc.contact_sharing_consent=true)
      and public.company_has_candidate_relationship(target_user_id))
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, role, full_name, terms_accepted_at)
  values (new.id, 'candidate', coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'terms_accepted_at','')::timestamptz)
  on conflict (id) do nothing;
  insert into public.candidate_private(user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.candidate_contacts(user_id, email)
  values (new.id, lower(new.email))
  on conflict (user_id) do update set email=excluded.email;
  insert into public.candidate_profiles(user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.candidate_settings(candidate_user_id) values (new.id) on conflict (candidate_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_skillmatch on auth.users;
create trigger on_auth_user_created_skillmatch after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.sync_auth_email_to_private_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.candidate_contacts set email=lower(new.email), updated_at=now() where user_id=new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed_skillmatch on auth.users;
create trigger on_auth_user_email_changed_skillmatch after update of email on auth.users
for each row execute function public.sync_auth_email_to_private_profiles();

create or replace function public.prevent_company_job_publish_without_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.current_account_role()='company' then
    if tg_op='INSERT' then
      new.status := case when new.status='draft' then 'draft' else 'pending_review' end;
      new.reviewed_at := null;
      new.reviewed_by := null;
    elsif old.status='published' and new.status='published' then
      new.status := 'pending_review';
      new.reviewed_at := null;
      new.reviewed_by := null;
    elsif new.status='published' then
      new.status := 'pending_review';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists company_job_requires_review on public.jobs;
create trigger company_job_requires_review before insert or update on public.jobs
for each row execute function public.prevent_company_job_publish_without_review();

create or replace function public.log_application_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.application_events(application_id, actor_user_id, status, note)
    values (new.id, new.candidate_user_id, new.status, 'Candidatura enviada.');
  elsif new.status is distinct from old.status then
    insert into public.application_events(application_id, actor_user_id, status, note)
    values (new.id, auth.uid(), new.status, 'Status atualizado pela empresa.');
  end if;
  return new;
end;
$$;

drop trigger if exists applications_log_events on public.applications;
create trigger applications_log_events after insert or update of status on public.applications
for each row execute function public.log_application_event();

create or replace function public.notify_application_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  company_owner uuid;
  job_title text;
begin
  select cp.owner_user_id, j.title into company_owner, job_title
  from public.jobs j join public.company_profiles cp on cp.id=j.company_id where j.id=new.job_id;
  if tg_op='INSERT' then
    insert into public.notifications(user_id,type,title,body,target_view,target_id)
    values (company_owner,'application','Nova candidatura', 'Uma pessoa se candidatou a '||job_title||'.','company-applicants',new.id);
  elsif new.status is distinct from old.status then
    insert into public.notifications(user_id,type,title,body,target_view,target_id)
    values (new.candidate_user_id,'application','Atualização da candidatura','O status da sua candidatura para '||job_title||' foi atualizado.','applications',new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists applications_notify on public.applications;
create trigger applications_notify after insert or update of status on public.applications
for each row execute function public.notify_application_change();

create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id,type,title,body,target_view,target_id)
  values (new.recipient_user_id,'message','Nova mensagem','Você recebeu uma nova mensagem autorizada.','connections',new.connection_id);
  return new;
end;
$$;

drop trigger if exists connection_messages_notify on public.connection_messages;
create trigger connection_messages_notify after insert on public.connection_messages
for each row execute function public.notify_message();

create or replace function public.notify_interview_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(user_id,type,title,body,target_view,target_id)
    values (new.candidate_user_id,'interview','Convite para entrevista','Uma empresa enviou um convite para entrevista.','connections',new.id);
  elsif new.status is distinct from old.status then
    insert into public.notifications(user_id,type,title,body,target_view,target_id)
    select case when auth.uid()=new.candidate_user_id then cp.owner_user_id else new.candidate_user_id end,
      'interview','Resposta ao convite','O status de um convite de entrevista foi atualizado.','company-connections',new.id
    from public.company_profiles cp where cp.id=new.company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists interview_invitations_notify on public.interview_invitations;
create trigger interview_invitations_notify after insert or update of status on public.interview_invitations
for each row execute function public.notify_interview_invitation();

-- Row-Level Security: all application tables are private by default; only published
-- listings and explicitly discoverable business/profile data are available to other users.
do $$ declare t text; begin
  foreach t in array array[
    'profiles','candidate_private','candidate_contacts','candidate_profiles',
    'company_profiles','company_private','jobs','applications','application_events','candidate_favorites','company_saved_talents',
    'admin_audit',
    'connections','connection_messages','interview_invitations','notifications','candidate_interview_sessions',
    'candidate_course_progress','candidate_settings','reports','announcements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
  using (id=auth.uid() or public.is_platform_admin());
drop policy if exists profiles_read_authorized_candidate on public.profiles;
create policy profiles_read_authorized_candidate on public.profiles for select to authenticated
  using (role='candidate' and public.current_account_role()='company' and public.can_view_candidate(id));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id=auth.uid() and status='active') with check (id=auth.uid() and status='active');
drop policy if exists candidate_private_self_read on public.candidate_private;
create policy candidate_private_self_read on public.candidate_private for select to authenticated
  using (user_id=auth.uid() or public.is_platform_admin());
drop policy if exists candidate_private_self_update on public.candidate_private;
create policy candidate_private_self_update on public.candidate_private for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists candidate_contacts_authorized_read on public.candidate_contacts;
create policy candidate_contacts_authorized_read on public.candidate_contacts for select to authenticated
  using (user_id=auth.uid() or public.is_platform_admin() or (public.current_account_role()='company' and public.can_view_candidate_contact(user_id)));
drop policy if exists candidate_contacts_self_update on public.candidate_contacts;
create policy candidate_contacts_self_update on public.candidate_contacts for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists candidate_profiles_read_authorized on public.candidate_profiles;
create policy candidate_profiles_read_authorized on public.candidate_profiles for select to authenticated
  using (public.can_view_candidate(user_id));
drop policy if exists candidate_profiles_insert_self on public.candidate_profiles;
create policy candidate_profiles_insert_self on public.candidate_profiles for insert to authenticated
  with check (user_id=auth.uid() and public.current_account_role()='candidate');
drop policy if exists candidate_profiles_update_self on public.candidate_profiles;
create policy candidate_profiles_update_self on public.candidate_profiles for update to authenticated
  using (user_id=auth.uid() and public.current_account_role()='candidate')
  with check (user_id=auth.uid() and public.current_account_role()='candidate');

drop policy if exists company_profiles_read_active_or_owner on public.company_profiles;
create policy company_profiles_read_active_or_owner on public.company_profiles for select to anon, authenticated
  using (public.company_is_public(id) or owner_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists company_profiles_owner_insert on public.company_profiles;
create policy company_profiles_owner_insert on public.company_profiles for insert to authenticated
  with check (owner_user_id=auth.uid() and public.current_account_role()='company');
drop policy if exists company_profiles_owner_update on public.company_profiles;
create policy company_profiles_owner_update on public.company_profiles for update to authenticated
  using (owner_user_id=auth.uid() and public.current_account_role()='company')
  with check (owner_user_id=auth.uid() and public.current_account_role()='company');
drop policy if exists company_private_owner_read on public.company_private;
create policy company_private_owner_read on public.company_private for select to authenticated
  using (public.is_platform_admin() or exists(select 1 from public.company_profiles cp where cp.id=company_id and cp.owner_user_id=auth.uid()));
drop policy if exists company_private_owner_update on public.company_private;
create policy company_private_owner_update on public.company_private for update to authenticated
  using (exists(select 1 from public.company_profiles cp where cp.id=company_id and cp.owner_user_id=auth.uid() and public.current_account_role()='company'))
  with check (exists(select 1 from public.company_profiles cp where cp.id=company_id and cp.owner_user_id=auth.uid() and public.current_account_role()='company'));

drop policy if exists jobs_read_public_owner_admin on public.jobs;
create policy jobs_read_public_owner_admin on public.jobs for select to anon, authenticated
  using ((status='published' and (active_until is null or active_until>now()) and public.company_is_public(company_id))
    or company_id=public.current_company_id() or public.is_platform_admin());
drop policy if exists jobs_company_insert on public.jobs;
create policy jobs_company_insert on public.jobs for insert to authenticated
  with check (company_id=public.current_company_id() and public.current_account_role()='company' and status in ('draft','pending_review'));
drop policy if exists jobs_company_update on public.jobs;
create policy jobs_company_update on public.jobs for update to authenticated
  using (company_id=public.current_company_id() and public.current_account_role()='company')
  with check (company_id=public.current_company_id() and public.current_account_role()='company' and status<>'published');
drop policy if exists jobs_company_delete on public.jobs;
create policy jobs_company_delete on public.jobs for delete to authenticated
  using (company_id=public.current_company_id() and public.current_account_role()='company' and status<>'published');

drop policy if exists applications_read_participants on public.applications;
create policy applications_read_participants on public.applications for select to authenticated
  using (candidate_user_id=auth.uid() or exists(select 1 from public.jobs j where j.id=job_id and j.company_id=public.current_company_id()) or public.is_platform_admin());
drop policy if exists applications_candidate_insert on public.applications;
create policy applications_candidate_insert on public.applications for insert to authenticated
  with check (candidate_user_id=auth.uid() and public.current_account_role()='candidate'
    and exists(select 1 from public.jobs j where j.id=job_id and j.status='published' and (j.active_until is null or j.active_until>now())));
drop policy if exists applications_company_update on public.applications;
create policy applications_company_update on public.applications for update to authenticated
  using (exists(select 1 from public.jobs j where j.id=job_id and j.company_id=public.current_company_id()) and public.current_account_role()='company')
  with check (exists(select 1 from public.jobs j where j.id=job_id and j.company_id=public.current_company_id()) and public.current_account_role()='company');
drop policy if exists applications_candidate_withdraw on public.applications;
create policy applications_candidate_withdraw on public.applications for update to authenticated
  using (candidate_user_id=auth.uid() and status in ('submitted','in_review','interview'))
  with check (candidate_user_id=auth.uid() and status='withdrawn');
drop policy if exists application_events_read_participants on public.application_events;
create policy application_events_read_participants on public.application_events for select to authenticated
  using (exists(select 1 from public.applications a where a.id=application_id and (a.candidate_user_id=auth.uid() or exists(select 1 from public.jobs j where j.id=a.job_id and j.company_id=public.current_company_id()))) or public.is_platform_admin());

drop policy if exists favorites_owner_all on public.candidate_favorites;
create policy favorites_owner_all on public.candidate_favorites for all to authenticated
  using (candidate_user_id=auth.uid() and public.current_account_role()='candidate')
  with check (candidate_user_id=auth.uid() and public.current_account_role()='candidate');
drop policy if exists company_saved_talents_owner_all on public.company_saved_talents;
create policy company_saved_talents_owner_all on public.company_saved_talents for all to authenticated
  using (company_id=public.current_company_id() and public.current_account_role()='company'
    and exists(select 1 from public.company_profiles cp where cp.id=public.current_company_id() and cp.verified_at is not null))
  with check (company_id=public.current_company_id() and public.current_account_role()='company'
    and exists(select 1 from public.company_profiles cp where cp.id=public.current_company_id() and cp.verified_at is not null)
    and public.candidate_is_discoverable(candidate_user_id));

drop policy if exists connections_read_participant on public.connections;
create policy connections_read_participant on public.connections for select to authenticated
  using (candidate_user_id=auth.uid() or company_id=public.current_company_id() or public.is_platform_admin());
drop policy if exists connections_insert_candidate on public.connections;
create policy connections_insert_candidate on public.connections for insert to authenticated
  with check (candidate_user_id=auth.uid() and initiated_by='candidate' and status='connected'
    and public.current_account_role()='candidate'
    and exists(select 1 from public.company_profiles cp where cp.id=company_id and cp.active=true and cp.verified_at is not null));
drop policy if exists connections_insert_company on public.connections;
create policy connections_insert_company on public.connections for insert to authenticated
  with check (company_id=public.current_company_id() and initiated_by='company' and status='pending'
    and public.current_account_role()='company' and public.candidate_is_discoverable(candidate_user_id)
    and exists(select 1 from public.company_profiles cp where cp.id=company_id and cp.verified_at is not null));
drop policy if exists connections_update_candidate_response on public.connections;
create policy connections_update_candidate_response on public.connections for update to authenticated
  using (candidate_user_id=auth.uid() and status='pending' and initiated_by='company')
  with check (candidate_user_id=auth.uid() and initiated_by='company' and status in ('connected','declined'));
drop policy if exists connections_update_participant_block on public.connections;
create policy connections_update_participant_block on public.connections for update to authenticated
  using ((candidate_user_id=auth.uid() or company_id=public.current_company_id()) and status not in ('blocked','ended'))
  with check ((candidate_user_id=auth.uid() or company_id=public.current_company_id()) and status='blocked' and blocked_by_user_id=auth.uid());
drop policy if exists connections_update_company_end on public.connections;
create policy connections_update_company_end on public.connections for update to authenticated
  using (company_id=public.current_company_id() and status='connected')
  with check (company_id=public.current_company_id() and status='ended');

drop policy if exists connection_messages_read_connected_participant on public.connection_messages;
create policy connection_messages_read_connected_participant on public.connection_messages for select to authenticated
  using (exists(select 1 from public.connections c join public.company_profiles cp on cp.id=c.company_id
    where c.id=connection_id and c.status='connected' and cp.active=true and cp.verified_at is not null
      and (c.candidate_user_id=auth.uid() or c.company_id=public.current_company_id())) or public.is_platform_admin());
drop policy if exists connection_messages_insert_connected_participant on public.connection_messages;
create policy connection_messages_insert_connected_participant on public.connection_messages for insert to authenticated
  with check (sender_user_id=auth.uid() and exists(select 1 from public.connections c join public.company_profiles cp on cp.id=c.company_id
    where c.id=connection_id and c.status='connected' and cp.active=true and cp.verified_at is not null
    and (c.candidate_user_id=auth.uid() or c.company_id=public.current_company_id())
    and ((c.candidate_user_id=auth.uid() and recipient_user_id=cp.owner_user_id)
      or (c.company_id=public.current_company_id() and recipient_user_id=c.candidate_user_id))));
drop policy if exists connection_messages_recipient_read on public.connection_messages;
create policy connection_messages_recipient_read on public.connection_messages for update to authenticated
  using (recipient_user_id=auth.uid()) with check (recipient_user_id=auth.uid());

drop policy if exists invitations_read_participant on public.interview_invitations;
create policy invitations_read_participant on public.interview_invitations for select to authenticated
  using (candidate_user_id=auth.uid() or company_id=public.current_company_id() or public.is_platform_admin());
drop policy if exists invitations_company_insert on public.interview_invitations;
create policy invitations_company_insert on public.interview_invitations for insert to authenticated
  with check (company_id=public.current_company_id() and public.current_account_role()='company'
    and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id
      where a.id=interview_invitations.application_id
        and a.candidate_user_id=interview_invitations.candidate_user_id
        and j.company_id=interview_invitations.company_id));
drop policy if exists invitations_candidate_update on public.interview_invitations;
create policy invitations_candidate_update on public.interview_invitations for update to authenticated
  using (candidate_user_id=auth.uid() and status='pending')
  with check (candidate_user_id=auth.uid() and status in ('accepted','declined'));
drop policy if exists invitations_company_cancel on public.interview_invitations;
create policy invitations_company_cancel on public.interview_invitations for update to authenticated
  using (company_id=public.current_company_id())
  with check (company_id=public.current_company_id() and status='cancelled');

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id=auth.uid() or public.is_platform_admin());
drop policy if exists notifications_owner_mark_read on public.notifications;
create policy notifications_owner_mark_read on public.notifications for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists interview_sessions_owner_all on public.candidate_interview_sessions;
create policy interview_sessions_owner_all on public.candidate_interview_sessions for all to authenticated
  using (candidate_user_id=auth.uid() and public.current_account_role()='candidate')
  with check (candidate_user_id=auth.uid() and public.current_account_role()='candidate');
drop policy if exists course_progress_owner_all on public.candidate_course_progress;
create policy course_progress_owner_all on public.candidate_course_progress for all to authenticated
  using (candidate_user_id=auth.uid() and public.current_account_role()='candidate')
  with check (candidate_user_id=auth.uid() and public.current_account_role()='candidate');
drop policy if exists settings_owner_all on public.candidate_settings;
create policy settings_owner_all on public.candidate_settings for all to authenticated
  using (candidate_user_id=auth.uid() and public.current_account_role()='candidate')
  with check (candidate_user_id=auth.uid() and public.current_account_role()='candidate');
drop policy if exists reports_owner_insert on public.reports;
create policy reports_owner_insert on public.reports for insert to authenticated
  with check (reporter_user_id=auth.uid());
drop policy if exists reports_owner_read_admin on public.reports;
create policy reports_owner_read_admin on public.reports for select to authenticated
  using (reporter_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists announcements_active_read on public.announcements;
create policy announcements_active_read on public.announcements for select to authenticated
  using (active=true or public.is_platform_admin());

-- Restrict both table and column privileges. RLS filters rows; column grants keep
-- hidden company identifiers, screening metadata, and contact details private.
revoke all on public.profiles, public.candidate_private, public.candidate_contacts, public.candidate_profiles,
  public.company_profiles, public.company_private, public.jobs, public.applications, public.application_events,
  public.candidate_favorites, public.company_saved_talents, public.connections, public.connection_messages,
  public.interview_invitations, public.notifications, public.candidate_interview_sessions,
  public.candidate_course_progress, public.candidate_settings, public.reports, public.announcements,
  public.admin_audit from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on public.profiles, public.candidate_private, public.candidate_contacts, public.candidate_profiles,
  public.company_profiles, public.company_private, public.jobs, public.applications, public.application_events,
  public.candidate_favorites, public.company_saved_talents, public.connections, public.connection_messages,
  public.interview_invitations, public.notifications, public.candidate_interview_sessions,
  public.candidate_course_progress, public.candidate_settings, public.reports, public.announcements,
  public.admin_audit to service_role;

grant select (id,role,full_name,created_at) on public.profiles to authenticated;
-- Acceptance timestamps are written by the trusted registration/admin paths, not by clients.
grant update (full_name) on public.profiles to authenticated;
grant select on public.candidate_profiles to authenticated;
grant insert (user_id,city,state,education_level,course,institution,area_interest,opportunity_types,availability,summary,skills,linkedin,github,portfolio,courses,experiences,visible_to_companies,visibility_consented_at) on public.candidate_profiles to authenticated;
grant update (city,state,education_level,course,institution,area_interest,opportunity_types,availability,summary,skills,linkedin,github,portfolio,courses,experiences,visible_to_companies,visibility_consented_at,updated_at) on public.candidate_profiles to authenticated;
grant select on public.candidate_private to authenticated;
grant update (birth_date,updated_at) on public.candidate_private to authenticated;
grant select (user_id,phone,contact_sharing_consent,contact_consented_at,updated_at) on public.candidate_contacts to authenticated;
grant update (phone,contact_sharing_consent,contact_consented_at,updated_at) on public.candidate_contacts to authenticated;
grant select (id,name,sector,description,city,state,website,public_contact_email,verified_at,active,created_at,updated_at) on public.company_profiles to anon, authenticated;
grant insert (owner_user_id,name,sector,description,city,state,website,public_contact_email) on public.company_profiles to authenticated;
grant update (name,sector,description,city,state,website,public_contact_email,updated_at) on public.company_profiles to authenticated;
grant select on public.company_private to authenticated;
grant update (address,phone,updated_at) on public.company_private to authenticated;
grant select (id,company_id,title,area,employment_type,modality,city,state,address,education,description,required_skills,required_courses,required_experience,requirements,benefits,application_url,salary_min,salary_max,status,active_until,created_at,updated_at) on public.jobs to anon, authenticated;
grant insert (id,company_id,title,area,employment_type,modality,city,state,address,education,description,required_skills,required_courses,required_experience,requirements,benefits,application_url,salary_min,salary_max,status,active_until) on public.jobs to authenticated;
grant update (title,area,employment_type,modality,city,state,address,education,description,required_skills,required_courses,required_experience,requirements,benefits,application_url,salary_min,salary_max,status,active_until,updated_at) on public.jobs to authenticated;
grant delete on public.jobs to authenticated;
grant select (id,candidate_user_id,job_id,status,cover_message,applied_at,updated_at) on public.applications to authenticated;
grant insert (id,candidate_user_id,job_id,cover_message) on public.applications to authenticated;
grant update (status,updated_at) on public.applications to authenticated;
grant select (id,application_id,actor_user_id,status,note,created_at) on public.application_events to authenticated;
grant select, insert, delete on public.candidate_favorites to authenticated;
grant select, insert, delete on public.company_saved_talents to authenticated;
grant select (id,company_id,candidate_user_id,initiated_by,status,invitation_message,blocked_by_user_id,created_at,updated_at) on public.connections to authenticated;
grant insert (id,company_id,candidate_user_id,initiated_by,status,invitation_message) on public.connections to authenticated;
grant update (status,blocked_by_user_id,updated_at) on public.connections to authenticated;
grant select (id,connection_id,sender_user_id,recipient_user_id,body,read_at,created_at) on public.connection_messages to authenticated;
grant insert (id,connection_id,sender_user_id,recipient_user_id,body) on public.connection_messages to authenticated;
grant update (read_at) on public.connection_messages to authenticated;
grant select (id,company_id,candidate_user_id,job_id,application_id,starts_at,mode,meeting_details,message,status,created_at,updated_at) on public.interview_invitations to authenticated;
grant insert (id,company_id,candidate_user_id,job_id,application_id,starts_at,mode,meeting_details,message) on public.interview_invitations to authenticated;
grant update (status,updated_at) on public.interview_invitations to authenticated;
grant select on public.notifications, public.candidate_interview_sessions, public.candidate_course_progress, public.candidate_settings, public.reports to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert (id,candidate_user_id,job_type,experience_level,target_role,question_id,question,answer,feedback,provider,external_ai_consent_at) on public.candidate_interview_sessions to authenticated;
grant insert, update, delete on public.candidate_course_progress to authenticated;
grant insert, update on public.candidate_settings to authenticated;
grant insert (id,reporter_user_id,category,description,connection_id) on public.reports to authenticated;
grant select (id,title,message,active,created_at,updated_at) on public.announcements to authenticated;

-- Remove PostgreSQL's default PUBLIC execute on helper functions. Anonymous access
-- needs only the account/company predicates used by public-listing RLS policies.
revoke execute on function public.current_account_role() from public;
revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.current_company_id() from public;
revoke execute on function public.company_is_public(uuid) from public;
revoke execute on function public.candidate_is_discoverable(uuid) from public;
revoke execute on function public.company_has_candidate_relationship(uuid) from public;
revoke execute on function public.can_view_candidate(uuid) from public;
revoke execute on function public.can_view_candidate_contact(uuid) from public;
grant execute on function public.current_account_role() to anon, authenticated;
grant execute on function public.is_platform_admin() to anon, authenticated;
grant execute on function public.current_company_id() to anon, authenticated;
grant execute on function public.company_is_public(uuid) to anon, authenticated;
grant execute on function public.candidate_is_discoverable(uuid) to authenticated;
grant execute on function public.company_has_candidate_relationship(uuid) to authenticated;
grant execute on function public.can_view_candidate(uuid) to authenticated;
grant execute on function public.can_view_candidate_contact(uuid) to authenticated;
