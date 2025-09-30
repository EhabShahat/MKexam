-- Exam public configuration: control order/visibility and pass inclusion
-- Safe and idempotent

create table if not exists public.exam_public_config (
  exam_id uuid primary key references public.exams(id) on delete cascade,
  order_index integer null,
  hidden boolean not null default false,
  include_in_pass boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current (reuse function if exists, else create minimal)
create or replace function public.tg_set_updated_at_epc()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' then
    new.updated_at := now();
  elsif TG_OP = 'INSERT' then
    if new.updated_at is null then new.updated_at := now(); end if;
  end if;
  return new;
end; $$;

create trigger trg_exam_public_config_updated
before insert or update on public.exam_public_config
for each row execute function public.tg_set_updated_at_epc();

-- Index to help ordering by order_index with fallback
create index if not exists idx_exam_public_config_order on public.exam_public_config (order_index);

-- RLS and policies
alter table if exists public.exam_public_config enable row level security;

-- Admin ALL policy
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_public_config' AND policyname='exam_public_config_admin_all') THEN
    EXECUTE 'DROP POLICY exam_public_config_admin_all ON public.exam_public_config';
  END IF;
  EXECUTE 'CREATE POLICY exam_public_config_admin_all ON public.exam_public_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

-- Optional: allow anon to SELECT configs for published exams (public pages)
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_public_config' AND policyname='exam_public_config_public_read') THEN
    EXECUTE 'DROP POLICY exam_public_config_public_read ON public.exam_public_config';
  END IF;
  EXECUTE $$CREATE POLICY exam_public_config_public_read ON public.exam_public_config
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM public.exams ex WHERE ex.id = exam_id AND ex.status = 'published'))$$;
END $do$;
