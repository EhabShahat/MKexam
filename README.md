# Advanced Exam Application

Light-only, minimal UI exam platform with Supabase backend, Admin UI, WhatsApp integration, and student attempt flow. This is a refactored version with unnecessary documentation and debug components removed.

## Quickstart

1) Install dependencies (peer deps):

```bash
npm ci --legacy-peer-deps
```

2) Configure environment variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional in local dev, server-only in production
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# WhatsApp (optional for sending codes)
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_whatsapp_phone_id
```

3) Start dev server:

```bash
npm run dev
# default: http://localhost:3000
```

4) Bootstrap admin: sign in via `/admin/login`. The first authenticated user is promoted to admin (see `admin_users`).

## Key Routes

- Public
  - `/(public)/exam/[examId]` — exam entry
  - `/(public)/attempt/[attemptId]` — take exam (auto-save, offline recovery, timers)

- Admin
  - `/admin` — dashboard shell
  - `/admin/exams` — exams list/create/edit/duplicate/publish/archive
  - `/admin/exams/[examId]/questions` — manage questions + reorder + CSV/XLSX import
  - `/admin/exams/[examId]/codes` — generate/import codes and WhatsApp send
  - `/admin/exams/[examId]/students` — manage students (add/edit/delete/import)
  - `/admin/results` — results overview and exports (CSV/XLSX/PDF)
  - `/admin/monitoring` — live activity (active attempts, recent submissions)
  - `/admin/audit` — audit logs
  - `/admin/settings` — global settings (branding, language, templates)

## Development

- Light-only UI primitives in `src/app/globals.css`: `.btn`, `.card`, `.input`, `.select`, `.textarea`, `.table`, `.label`, `.link`.
- React Query v5 for data fetching/mutations.
- Supabase client in `src/lib/supabase/*`.
- Auth: `src/components/AdminGuard.tsx`, `src/hooks/useAdmin.ts`.

Scripts:

```bash
npm run dev        # start dev (Turbopack)
npm run build      # production build
npm run start      # start production server
npm run lint       # lint
npm run type-check # type check (CI)
```

## Deployment (Netlify)

- A basic CI workflow is provided in `.github/workflows/ci.yml`.
- Add a `netlify.toml` (included) using Node 20 and legacy peer deps install.
- Set environment variables in your Netlify site settings: the same keys from `.env.local`.

## Database Notes (Supabase)

- Core tables: `exams`, `questions`, `exam_codes`, `exam_attempts`, `exam_results`, `exam_ips`, `audit_logs`, `admin_users`.
- RPCs: `start_attempt`, `get_attempt_state`, `save_attempt`, `submit_attempt`.
- Global settings: create a single-row `app_settings` table with text fields `brand_name`, `brand_logo_url`, `default_language`, `whatsapp_default_template` (UI/API will report `not_configured` until present).
- Logo storage: run `npm run setup:storage` to create Supabase storage bucket for logo uploads.
- Recommended indexes: see `ROADMAP.md` Phase 1.

## CSV/XLSX Import Columns

- Questions: type-specific columns with validation (see UI preview page).
- Students/Codes: `student_name`, `mobile_number`, optional `code`.

## Next Steps

Start with `ROADMAP.md` — it tracks phases, current status, and prioritized next steps. Common next tasks:

- Create `app_settings` table, configure brand/template, then revisit `/admin/settings`.
- Accessibility pass on UI (Phase 2).
- Documentation (Admin/Student guides) (Phase 12). See `docs/AdminGuide.md` and `docs/StudentGuide.md`.
- Configure Netlify environment and enable CI (Phase 10).

Optional security hardening in Supabase Auth: enable leaked password protection and MFA.
