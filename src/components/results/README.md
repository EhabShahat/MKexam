# Results Page Components

This directory contains the modular components for the rebuilt Results Page implementation.

## Overview

The Results Page has been rebuilt from a monolithic 2000+ line component into a modular, maintainable architecture. This directory contains all the specialized components that make up the new implementation.

## Components

### Core Components

#### 1. ExamSelector (`ExamSelector.tsx`)
Dropdown component for selecting exams with search, filtering, and status badges.

**Features:**
- Exam list with search functionality
- Status filter (All/Published/Completed)
- Exam type badges (exam/quiz/homework)
- "All Exams" and "Matrix View" options
- URL parameter synchronization

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.10

---

#### 2. IndividualExamView (`IndividualExamView.tsx`)
Displays attempts for a single exam with filtering, sorting, and actions.

**Features:**
- Virtual scrolling for large datasets (50+ rows)
- Student name/code search with debouncing
- Date range filtering
- Score sorting (ascending/descending)
- Device info display with usage counts
- Manual grading indicators
- Export to CSV/XLSX
- Regrade all functionality
- Delete attempt with confirmation

**Requirements:** 3.1-3.10, 6.1-6.8, 7.1-7.5, 10.1, 11.1-11.2, 13.3, 13.5

---

#### 3. AllExamsView (`AllExamsView.tsx`)
Displays aggregated scores across all exams with pass/fail calculation.

**Features:**
- Aggregated student scores (best per exam)
- Exam component and extra component scores
- Final score calculation with pass/fail indicators
- Expandable score breakdown overlay
- Summary statistics (pass count, total, pass rate)
- Student search with debouncing
- Sort by final score (ascending/descending)
- Export with detailed calculation data
- Virtual scrolling for performance

**Requirements:** 4.1-4.10, 6.3-6.8, 7.2-7.5, 13.1, 13.3, 18.1-18.10, 19.1-19.5

---

### Supporting Components

#### 4. ScoreBreakdownOverlay (`ScoreBreakdownOverlay.tsx`)
Displays detailed score calculation breakdown in an overlay.

**Features:**
- Exam component breakdown (mode, included exams, scores)
- Extra component breakdown (fields, normalized scores, weights)
- Final score calculation formula
- Pass/fail status and failure reasons
- Smart positioning to avoid viewport overflow
- Click-outside and close button handling

**Requirements:** 18.1-18.10

---

#### 5. DeviceInfoCell (`DeviceInfoCell.tsx`)
Parses and displays device information with usage indicators.

**Features:**
- Device type icon (mobile/tablet/desktop)
- Device model (friendly name or brand/model)
- Local and server IP addresses
- Automation risk indicator
- Usage count badge

**Requirements:** 12.1-12.9

---

#### 6. ManualGradingIndicator (`ManualGradingIndicator.tsx`)
Shows manual grading status for attempts.

**Display Logic:**
- Pending count with warning icon (when pending > 0)
- Checkmark when completed (pending = 0, total > 0)
- Hidden when no manual grading

**Requirements:** 9.1-9.5

---

#### 7. ResultsErrorBoundary (`ResultsErrorBoundary.tsx`)
Error boundary component for graceful error handling.

**Features:**
- Catches React errors in child components
- Displays fallback UI with error message
- Retry functionality
- Logs errors to console for debugging
- Preserves other parts of the page

**Requirements:** 16.4, 20.5

---

## Architecture

The new Results Page follows a clean separation of concerns:

```
ResultsPage (Container)
├── ExamSelector (Exam selection and filtering)
├── IndividualExamView (Single exam attempts)
│   ├── DeviceInfoCell
│   ├── ManualGradingIndicator
│   └── Export utilities
└── AllExamsView (Aggregated scores)
    ├── ScoreBreakdownOverlay
    └── Summary statistics
```

## Data Flow

1. **Container** (`page.tsx`): Manages global state and routing
2. **Custom Hooks** (`src/hooks/results/`): Handle data fetching with React Query
3. **Business Logic** (`src/lib/results/`): Pure functions for calculations
4. **UI Components** (this directory): Presentation and user interaction

## Testing

Each component has corresponding test files in the `__tests__/` directory:

```bash
# Run all component tests
npm test -- src/components/results/__tests__/ --run

# Run specific component test
npm test -- src/components/results/__tests__/ExamSelector.test.tsx --run
```

## Performance Optimizations

- **Virtual Scrolling**: Activated automatically for tables with 50+ rows
- **Debouncing**: Search inputs debounced at 300ms
- **Memoization**: Expensive calculations cached with useMemo
- **React Query**: 2-minute stale time, 5-minute cache time
- **Lazy Loading**: Export libraries loaded on demand

## Requirements Coverage

This component library satisfies all 20 requirements from the Results Page Rebuild specification:

- **Authentication & Authorization** (1.1-1.4)
- **Exam Selection** (2.1-2.10)
- **Individual View** (3.1-3.10)
- **All Exams View** (4.1-4.10)
- **Score Calculation** (5.1-5.10)
- **Filtering & Search** (6.1-6.8)
- **Sorting** (7.1-7.5)
- **Export** (8.1-8.11)
- **Manual Grading** (9.1-9.7)
- **Regrade** (10.1-10.7)
- **Delete** (11.1-11.10)
- **Device Tracking** (12.1-12.10)
- **Performance** (13.1-13.10)
- **Internationalization** (14.1-14.7)
- **Accessibility** (15.1-15.8)
- **Error Handling** (16.1-16.10)
- **Data Refresh** (17.1-17.7)
- **Score Breakdown** (18.1-18.10)
- **Pass/Fail Statistics** (19.1-19.5)
- **Modular Architecture** (20.1-20.10)

## Migration Notes

The old monolithic implementation has been archived as `page.old.tsx` and can be removed after verifying stability in production.

For detailed migration information, see `.kiro/specs/results-page-rebuild/MIGRATION_GUIDE.md`.
