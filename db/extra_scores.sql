-- Extra scores and public results settings
-- Safe and idempotent

create extension if not exists pgcrypto;

-- Fields catalogue to control order/visibility/labels
create table if not exists public.extra_score_fields (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
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

-- Extend fields with scoring configuration (safe if columns already exist)
alter table if exists public.extra_score_fields
  add column if not exists bool_true_points numeric default 100,
  add column if not exists bool_false_points numeric default 0,
  add column if not exists text_score_map jsonb default '{}'::jsonb;

-- Per-student extra scores stored as a JSON object keyed by field key
create table if not exists public.extra_scores (
  student_id uuid primary key references public.students(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_extra_scores_student on public.extra_scores (student_id);

-- Keep updated_at current
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then
    new.updated_at := now();
  elsif TG_OP = 'INSERT' then
    if new.updated_at is null then new.updated_at := now(); end if;
  end if;
  return new;
end; $$;

create trigger trg_extra_fields_updated
before insert or update on public.extra_score_fields
for each row execute function public.tg_set_updated_at();

create trigger trg_extra_scores_updated
before insert or update on public.extra_scores
for each row execute function public.tg_set_updated_at();

-- Extend app_settings with public results message and calc configuration
alter table if exists public.app_settings
  add column if not exists result_message_hidden boolean default false,
  add column if not exists result_pass_calc_mode text default 'best',
  add column if not exists result_overall_pass_threshold numeric default 60,
  add column if not exists result_exam_weight numeric default 1,
  add column if not exists result_exam_score_source text default 'final',
  add column if not exists result_fail_on_any_exam boolean default false,
  add column if not exists result_message_pass text,
  add column if not exists result_message_fail text,
  add column if not exists result_message_text text;

-- Ensure valid enum-like values
do $$ begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='app_settings' and column_name='result_pass_calc_mode'
  ) then
    -- no-op; check done in application
    null;
  end if;
end $$;

-- RLS and policies
alter table if exists public.extra_score_fields enable row level security;
alter table if exists public.extra_scores enable row level security;

-- Admin ALL policies
do $do$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='extra_score_fields' and policyname='extra_score_fields_admin_all') then
    execute 'drop policy extra_score_fields_admin_all on public.extra_score_fields';
  end if;
  execute 'create policy extra_score_fields_admin_all on public.extra_score_fields for all using (public.is_admin()) with check (public.is_admin())';
end $do$;

do $do$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='extra_scores' and policyname='extra_scores_admin_all') then
    execute 'drop policy extra_scores_admin_all on public.extra_scores';
  end if;
  execute 'create policy extra_scores_admin_all on public.extra_scores for all using (public.is_admin()) with check (public.is_admin())';
end $do$;
