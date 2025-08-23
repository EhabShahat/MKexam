# Product Overview

Advanced Exam Application is a light-only, minimal UI exam platform designed for educational institutions and organizations conducting online assessments. This refactored version maintains all core functionality while removing unnecessary documentation and debug components.

## Core Features

- **Student Exam Flow**: Secure exam entry with codes, auto-save functionality, offline recovery, and built-in timers
- **Admin Management**: Complete exam lifecycle management including creation, question management, global student administration (unique codes), and results analysis
- **WhatsApp Integration**: Server capability to send codes via WhatsApp Cloud API, plus an optional deep-link button to open conversations with prefilled codes
- **Real-time Monitoring**: Live activity tracking, attempt monitoring, and audit logging
- **Multi-format Support**: CSV/XLSX import/export for questions, students, and results
- **Security Features**: IP tracking, attempt validation, and comprehensive audit trails
- **Attempt Rules**: One attempt per exam per student enforced via `student_exam_attempts`; the same student code can be reused across different exams

## Key User Flows

### Public Routes
- Exam entry via unique codes (`/exam/[examId]`)
- Exam taking interface with auto-save (`/attempt/[attemptId]`)

### Admin Routes
- Dashboard and exam management (`/admin`)
- Question management with drag-and-drop reordering
- Student management (global codes) with bulk operations and WhatsApp sending
- Results analysis and export capabilities
- Live monitoring and audit logging
- Global settings and branding configuration

## Design Philosophy

- **Light-only UI**: Deliberately minimal, clean interface focused on functionality
- **Accessibility-first**: Built with screen readers and keyboard navigation in mind
- **Mobile-responsive**: Works seamlessly across devices
- **Performance-oriented**: Optimized for fast loading and smooth interactions