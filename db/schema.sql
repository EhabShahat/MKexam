-- Core schema for Exam App - Updated from Supabase 2025-01-29
-- Safe to run repeatedly due to IF NOT EXISTS

-- Extensions
create extension if not exists pgcrypto;

-- Tables
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  start_time timestamptz null,
  end_time timestamptz null,
  duration_minutes integer null,
  status text not null default 'draft' check (status in ('draft','published','archived','done')),
  access_type text not null default 'open' check (access_type in ('open','code_based','ip_restricted')),
  exam_type text not null default 'exam' check (exam_type in ('exam','homework','quiz')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduling_mode text not null default 'Auto' check (scheduling_mode in ('Auto','Manual')),
  is_manually_published boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz null,
  status_note text null
);

-- Ensure existing databases allow the new 'done' status (idempotent)
do $$
declare
  r record;
begin
  -- Drop any existing status check constraints that don't include 'done'
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'exams'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%status%in%('
      and pg_get_constraintdef(c.oid) not like '%''done''%'
  loop
    execute format('alter table public.exams drop constraint %I', r.conname);
  end loop;

  -- Recreate the canonical constraint (no-op if already present)
  begin
    alter table public.exams
      add constraint exams_status_check
      check (status in ('draft','published','archived','done'));
  exception when duplicate_object then
    -- Already created
    null;
  end;
end $$;

-- Add exam_type column to existing exams table (idempotent)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exams' and column_name = 'exam_type'
  ) then
    alter table public.exams add column exam_type text not null default 'exam' check (exam_type in ('exam','homework','quiz'));
  end if;
end $$;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_text text not null,
  question_type text not null,
  options jsonb null,
  points integer null,
  required boolean not null default false,
  order_index integer null,
  correct_answers jsonb null,
  created_at timestamptz not null default now(),
  question_image_url text null,
  option_image_urls jsonb default '[]'::jsonb,
  auto_grade_on_answer boolean not null default false
);

-- legacy exam_codes table removed after migration to global students

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  ip_address inet null,
  student_name text null,
  answers jsonb not null default '{}'::jsonb,
  auto_save_data jsonb not null default '{}'::jsonb,
  completion_status text not null default 'in_progress',
  version integer not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_results (
  attempt_id uuid primary key references public.exam_attempts(id) on delete cascade,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  score_percentage numeric not null default 0,
  calculated_at timestamptz not null default now()
);

-- Extended scoring columns (idempotent)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_results' and column_name = 'auto_points'
  ) then
    alter table public.exam_results add column auto_points numeric not null default 0;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_results' and column_name = 'manual_points'
  ) then
    alter table public.exam_results add column manual_points numeric not null default 0;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_results' and column_name = 'max_points'
  ) then
    alter table public.exam_results add column max_points numeric not null default 0;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_results' and column_name = 'final_score_percentage'
  ) then
    alter table public.exam_results add column final_score_percentage numeric not null default 0;
  end if;
end $$;

-- Manual grades: per-attempt, per-question awarded points (idempotent)
create table if not exists public.manual_grades (
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  awarded_points numeric not null default 0,
  notes text null,
  graded_by text null,
  graded_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- Results history for audit (idempotent)
create table if not exists public.exam_results_history (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  old_score_percentage numeric null,
  new_score_percentage numeric null,
  old_final_score_percentage numeric null,
  new_final_score_percentage numeric null,
  meta jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now()
);

create table if not exists public.exam_ips (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  rule_type text not null check (rule_type in ('whitelist','blacklist')),
  ip_range cidr not null,
  note text null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Lightweight users table to decouple admin management from auth.users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  username text unique,
  password_hash text,
  display_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key,
  email text null,
  created_at timestamptz not null default now()
);

-- Global students table
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_name text null,
  mobile_number text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add extended student profile columns (idempotent)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'mobile_number2'
  ) then
    alter table public.students add column mobile_number2 text null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'address'
  ) then
    alter table public.students add column address text null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'national_id'
  ) then
    alter table public.students add column national_id text null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'photo_url'
  ) then
    alter table public.students add column photo_url text null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'national_id_photo_url'
  ) then
    alter table public.students add column national_id_photo_url text null;
  end if;
end $$;

-- Create trigger to auto-update updated_at for students
create or replace function public.tg_set_students_updated_at()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then
    new.updated_at := now();
  elsif TG_OP = 'INSERT' then
    if new.updated_at is null then new.updated_at := now(); end if;
  end if;
  return new;
end; $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_students_updated_at'
  ) then
    create trigger trg_students_updated_at
    before insert or update on public.students
    for each row execute function public.tg_set_students_updated_at();
  end if;
end $$;

-- Per-exam attempt tracking for students
create table if not exists public.student_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid null references public.exam_attempts(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null default 'in_progress'
);

-- Ensure exam_attempts has student_id and device_info (legacy code_id retained for compat but unused)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_attempts' and column_name = 'student_id'
  ) then
    alter table public.exam_attempts add column student_id uuid null;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_attempts' and column_name = 'device_info'
  ) then
    alter table public.exam_attempts add column device_info jsonb null;
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'exam_attempts' and c.conname = 'exam_attempts_student_id_fkey'
  ) then
    alter table public.exam_attempts
      add constraint exam_attempts_student_id_fkey foreign key (student_id)
      references public.students(id) on delete set null;
  end if;
end $$;

-- Attempt activity events table for tracking student activities
create table if not exists public.attempt_activity_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_type text not null,
  event_time timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Global summary view
create or replace view public.student_exam_summary with (security_invoker = true) as
  select
    s.id as student_id,
    s.code,
    s.student_name,
    s.mobile_number,
    s.mobile_number2,
    s.address,
    s.national_id,
    s.photo_url,
    s.national_id_photo_url,
    count(sea.id) as total_exams_attempted,
    count(case when sea.status = 'completed' then 1 end) as completed_exams,
    count(case when sea.status = 'in_progress' then 1 end) as in_progress_exams,
    s.created_at as student_created_at,
    s.updated_at as student_updated_at
  from public.students s
  left join public.student_exam_attempts sea on sea.student_id = s.id
  group by s.id, s.code, s.student_name, s.mobile_number, s.mobile_number2, s.address, s.national_id, s.photo_url, s.national_id_photo_url, s.created_at, s.updated_at;

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed a default admin user if not present (username: ehab, password: 436762)
do $$
begin
  if not exists (select 1 from public.users where lower(username) = 'ehab') then
    insert into public.users (email, username, password_hash)
    values (null, 'ehab', crypt('436762', gen_salt('bf')));
  end if;

  insert into public.admin_users (user_id, email)
  select u.id, u.email from public.users u where lower(u.username) = 'ehab'
  on conflict (user_id) do nothing;
end $$;

-- Indexes (some duplicated in indexes.sql; IF NOT EXISTS prevents errors)
-- legacy index for exam_codes removed
create index if not exists idx_questions_exam_order on public.questions (exam_id, order_index);
create index if not exists idx_attempts_exam_started on public.exam_attempts (exam_id, started_at desc);
create index if not exists idx_attempts_exam_student_lower on public.exam_attempts (exam_id, lower(student_name));
create index if not exists idx_attempts_submitted_at on public.exam_attempts (submitted_at desc);
create index if not exists idx_results_attempt_id on public.exam_results (attempt_id);
create index if not exists idx_ips_exam_rule on public.exam_ips (exam_id, rule_type);
create index if not exists idx_ips_ip_range on public.exam_ips (ip_range);
create index if not exists idx_activity_events_attempt on public.attempt_activity_events (attempt_id, created_at desc);
-- Exam bypass codes table
create table if not exists public.exam_bypass_codes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  code text not null,
  active boolean not null default true,
  note text null,
  created_by text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  unique (exam_id, code)
);

-- Blocked entries table
create table if not exists public.blocked_entries (
  id uuid primary key default gen_random_uuid(),
  type varchar(10) not null check (type in ('mobile','national')),
  value text not null,
  reason text null,
  created_at timestamptz default now(),
  created_by text not null,
  unique (type, value)
);

-- Student requests table
create table if not exists public.student_requests (
  request_id uuid primary key default gen_random_uuid(),
  student_name varchar(255) not null,
  mobile_number varchar(20) not null,
  mobile_number2 varchar(20) null,
  address text null,
  national_id varchar(50) null,
  status varchar(20) not null default 'pending' check (status in ('pending','approved','denied')),
  notes text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_photo_url text null,
  national_id_photo_url text null
);

-- App settings table (new structure)
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  brand_name text null,
  brand_logo_url text null,
  default_language text null,
  whatsapp_default_template text null,
  welcome_instructions text null,
  updated_at timestamptz default now(),
  enable_name_search boolean not null default true,
  enable_code_search boolean not null default false,
  result_message_hidden boolean default false,
  result_pass_calc_mode text default 'best',
  result_overall_pass_threshold numeric default 60,
  result_exam_weight numeric default 1,
  result_exam_score_source text default 'final',
  result_fail_on_any_exam boolean default false,
  result_message_pass text null,
  result_message_fail text null,
  result_message_text text null,
  welcome_instructions_ar text null,
  thank_you_title_ar text null,
  thank_you_message_ar text null,
  enable_multi_exam boolean default true,
  code_length integer default 4,
  code_format text default 'numeric',
  code_pattern text null,
  results_show_view_attempt boolean default true
);

-- Extra score fields table
create table if not exists public.extra_score_fields (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  type text not null default 'number' check (type in ('number','text','boolean')),
  order_index integer null,
  hidden boolean not null default false,
  include_in_pass boolean not null default false,
  pass_weight numeric not null default 0,
  max_points numeric null,
  bool_true_points numeric default 100,
  bool_false_points numeric default 0,
  text_score_map jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extra scores table
create table if not exists public.extra_scores (
  student_id uuid primary key references public.students(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Exam public config table
create table if not exists public.exam_public_config (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  order_index integer null,
  hidden boolean not null default false,
  include_in_pass boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Attendance records table
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attended_at timestamptz not null default now(),
  session_date date not null default current_date,
  source text not null default 'scan',
  created_by uuid null,
  note text null,
  unique (student_id, session_date)
);

-- Keep alive table for project wake-up
create table if not exists public.keep_alive (
  id bigint primary key,
  last_updated_at timestamptz null
);

-- Insert default system configuration
insert into public.app_config (key, value, description) values
  ('system_disabled', 'false', 'Whether the system is disabled for students'),
  ('system_disabled_message', 'No exams are currently available. Please check back later.', 'Message to show when system is disabled')
on conflict (key) do nothing;