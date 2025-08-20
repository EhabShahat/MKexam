# Technology Stack

## Framework & Runtime
- **Next.js 15.4.6** with App Router and React 19
- **TypeScript 5** for type safety
- **Node.js 20** (production environment)
- **Refactored** to remove debug components and unnecessary files

## Backend & Database
- **Supabase** for backend-as-a-service
  - PostgreSQL database with RLS (Row Level Security)
  - Real-time subscriptions
  - Authentication and authorization
  - Storage for file uploads

## Frontend Libraries
- **React Query v5** (`@tanstack/react-query`) for data fetching and caching
- **React Hook Form** for form management with validation
- **Zod** for schema validation
- **@dnd-kit** for drag-and-drop functionality (question reordering)

## UI & Styling
- **Tailwind CSS v4** with PostCSS
- **Custom CSS primitives** in `globals.css` (`.btn`, `.card`, `.input`, etc.)
- **Light-only theme** - no dark mode support
- **Accessibility-focused** with ARIA labels and keyboard navigation

## Data Processing
- **Papa Parse** for CSV parsing
- **XLSX** for Excel file handling
- **jsPDF** for PDF generation
- **Chart.js + react-chartjs-2** for data visualization

## Authentication & Security
- **Jose** for JWT handling
- **Supabase Auth** for user management
- **IP tracking** and audit logging
- **Seedrandom** for deterministic randomization

## Development Tools
- **ESLint** with Next.js and TypeScript configs
- **Turbopack** for fast development builds
- **Legacy peer deps** required for compatibility

## Common Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking

# Installation (required for peer dependency issues)
npm ci --legacy-peer-deps
```

## Deployment
- **Netlify** with Node.js 20
- **Environment variables** in `.env.local` for development
- **CI/CD** via GitHub Actions (`.github/workflows/ci.yml`)

## Database Schema
Core tables: `exams`, `questions`, `exam_codes`, `exam_attempts`, `exam_results`, `exam_ips`, `audit_logs`, `admin_users`, `app_settings`

Key RPCs: `start_attempt`, `get_attempt_state`, `save_attempt`, `submit_attempt`