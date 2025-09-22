-- Attendance tracking for students
-- Safe to run multiple times (idempotent via IF NOT EXISTS / DO blocks)

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attended_at timestamptz not null default now(),
  session_date date not null default current_date,
  source text not null default 'scan',
  created_by uuid null,
  note text null
);

-- Helpful indexes
create index if not exists idx_attendance_attended_at on public.attendance_records (attended_at desc);
create index if not exists idx_attendance_student_date on public.attendance_records (student_id, session_date desc);

-- Ensure a uniqueness guard so a student can only be marked once per day
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'attendance_records_unique_student_date'
  ) THEN
    CREATE UNIQUE INDEX attendance_records_unique_student_date ON public.attendance_records (student_id, session_date);
  END IF;
END $$;

-- RLS and admin policy
alter table public.attendance_records enable row level security;
DO $do$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='attendance_records' AND policyname='attendance_records_admin_all'
  ) THEN
    EXECUTE 'DROP POLICY attendance_records_admin_all ON public.attendance_records';
  END IF;
  EXECUTE 'CREATE POLICY attendance_records_admin_all ON public.attendance_records FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;
