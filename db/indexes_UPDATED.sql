-- Recommended indexes and constraints - Updated from Supabase 2025-01-29
-- This file contains all indexes from the live database

-- Questions indexes
create index if not exists idx_questions_exam_order on public.questions (exam_id, order_index);

-- Exam attempts indexes
create index if not exists idx_attempts_exam_started on public.exam_attempts (exam_id, started_at desc);
create index if not exists idx_attempts_exam_student_lower on public.exam_attempts (exam_id, lower(student_name));
create index if not exists idx_attempts_submitted_at on public.exam_attempts (submitted_at desc);
create index if not exists idx_attempts_exam_ip on public.exam_attempts (exam_id, ip_address);
create index if not exists idx_attempts_student_id on public.exam_attempts (student_id);
create index if not exists idx_exam_attempts_student_id on public.exam_attempts (student_id);

-- Exam results indexes
create index if not exists idx_results_attempt_id on public.exam_results (attempt_id);

-- Student exam attempts indexes
create unique index if not exists uniq_sea_exam_student on public.student_exam_attempts (exam_id, student_id);
create index if not exists idx_sea_exam on public.student_exam_attempts (exam_id, started_at desc);
create index if not exists idx_sea_student on public.student_exam_attempts (student_id);
create index if not exists idx_sea_attempt_id on public.student_exam_attempts (attempt_id);
create index if not exists idx_student_exam_attempts_exam on public.student_exam_attempts (exam_id);
create index if not exists idx_student_exam_attempts_student_exam on public.student_exam_attempts (student_id, exam_id);

-- Exam IPs indexes
create index if not exists idx_ips_exam_rule on public.exam_ips (exam_id, rule_type);
create index if not exists idx_ips_ip_range on public.exam_ips (ip_range);

-- Attempt activity events indexes
create index if not exists idx_activity_events_attempt on public.attempt_activity_events (attempt_id, created_at desc);
create index if not exists idx_activity_attempt_time on public.attempt_activity_events (attempt_id, event_time desc);
create index if not exists idx_activity_event_type on public.attempt_activity_events (event_type);

-- Exam indexes
create index if not exists idx_exams_start_time on public.exams (start_time);
create index if not exists idx_exams_end_time on public.exams (end_time);
create index if not exists idx_exams_scheduling_mode on public.exams (scheduling_mode);
create index if not exists idx_exams_is_manually_published on public.exams (is_manually_published);
create index if not exists idx_exams_is_archived on public.exams (is_archived);

-- Students indexes
create index if not exists idx_students_code on public.students (code);
create index if not exists idx_students_mobile on public.students (mobile_number);

-- Student requests indexes
create index if not exists idx_student_requests_status on public.student_requests (status);
create index if not exists idx_student_requests_mobile on public.student_requests (mobile_number);
create index if not exists idx_student_requests_national_id on public.student_requests (national_id) where national_id is not null;
create index if not exists idx_student_requests_created_at on public.student_requests (created_at desc);

-- Blocked entries indexes
create index if not exists idx_blocked_entries_type_value on public.blocked_entries (type, value);
create index if not exists idx_blocked_entries_created_at on public.blocked_entries (created_at desc);

-- Exam bypass codes indexes
create index if not exists idx_exam_bypass_codes_exam on public.exam_bypass_codes (exam_id);
create index if not exists idx_exam_bypass_codes_expires_at on public.exam_bypass_codes (expires_at);

-- Extra scores indexes
create index if not exists idx_extra_scores_student on public.extra_scores (student_id);

-- Exam public config indexes
create index if not exists idx_exam_public_config_order on public.exam_public_config (order_index);

-- Attendance records indexes
create index if not exists idx_attendance_student_date on public.attendance_records (student_id, session_date desc);
create index if not exists idx_attendance_attended_at on public.attendance_records (attended_at desc);

-- Drop legacy unique index that enforced a single published exam
drop index if exists one_published_exam;
