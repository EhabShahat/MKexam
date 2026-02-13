# Design Document

## Overview

This design implements three complementary enhancements to the Advanced Exam Application: student code persistence using browser localStorage, mobile device model display with usage tracking in the admin results interface, and a comprehensive dark theme system. The design leverages existing infrastructure (Supabase database, Next.js App Router, Tailwind CSS) while introducing minimal new dependencies and maintaining backward compatibility.

The student code persistence feature reduces friction by automatically validating and redirecting returning students. The device model display enhances administrative visibility into exam-taking environments. The dark theme implementation provides a modern, accessible alternative color scheme across the entire application.

## Architecture

### Student Code Persistence Architecture

```
┌─────────────────┐
│  Exam Entry     │
│  Page           │
└────────┬────────┘
         │
         ├─ Check localStorage for stored code
         │
         ├─ If code exists:
         │  ├─ Validate against Supabase
         │  ├─ If valid → Redirect to exams page
         │  └─ If invalid → Clear storage, show entry form
         │
         └─ On successful entry:
            └─ Store code in localStorage

┌─────────────────┐
│  Exams Page     │
│                 │
├─────────────────┤
│ [Clear Code]    │ ← Button to clear stored code
└─────────────────┘
```

**Key Components:**
- `useStudentCode` hook: Manages localStorage operations and validation
- `validateStoredCode` API endpoint: Server-side validation of stored codes
- Entry page modifications: Auto-redirect logic
- Exams page modifications: Clear code button

### Device Model Display Architecture

```
┌──────────────────┐
│ Student Attempt  │
│ Start            │
└────────┬─────────┘
         │
         ├─ Capture User Agent
         │
         ├─ Parse Device Info
         │  ├─ Device Type (mobile/tablet/desktop)
         │  ├─ Manufacturer
         │  └─ Model Name
         │
         └─ Store in device_info field

┌──────────────────┐
│ Admin Results    │
│ Page             │
└────────┬─────────┘
         │
         ├─ Query attempts with device_info
         │
         ├─ Aggregate device usage per exam
         │  └─ Count unique students per device
         │
         └─ Display: "iPhone 14 Pro (3)"
```

**Key Components:**
- `parseUserAgent` utility: Extract device information from user agent strings
- `getDeviceUsageCount` utility: Calculate students per device
- Results page modifications: Display device info column
- Database query modifications: Include device_info in results queries

### Dark Theme Architecture

```
┌─────────────────────────────────────┐
│  Theme System                       │
├─────────────────────────────────────┤
│                                     │
│  CSS Custom Properties              │
│  ├─ --color-background              │
│  ├─ --color-text                    │
│  ├─ --color-primary                 │
│  ├─ --color-border                  │
│  └─ ... (all theme colors)          │
│                                     │
│  Theme Classes                      │
│  ├─ .light (default)                │
│  └─ .dark                           │
│                                     │
└─────────────────────────────────────┘
         │
         ├─ Applied to <html> element
         │
         ├─ Persisted in localStorage
         │
         └─ Controlled by ThemeToggle component
```

**Key Components:**
- `useTheme` hook: Manages theme state and localStorage
- `ThemeToggle` component: UI control for theme switching
- CSS custom properties: Centralized color management
- Tailwind configuration: Dark mode variant support

## Components and Interfaces

### Student Code Persistence Components

#### useStudentCode Hook

```typescript
interface UseStudentCodeReturn {
  storedCode: string | null;
  isValidating: boolean;
  storeCode: (code: string) => void;
  clearCode: () => void;
  validateAndRedirect: () => Promise<boolean>;
}

function useStudentCode(): UseStudentCodeReturn
```

**Responsibilities:**
- Read/write student code from/to localStorage
- Validate stored codes against the database
- Handle automatic redirection logic
- Provide code clearing functionality

#### API Endpoint: /api/student/validate-code

```typescript
// POST /api/student/validate-code
interface ValidateCodeRequest {
  code: string;
}

interface ValidateCodeResponse {
  valid: boolean;
  studentId?: string;
  studentName?: string;
}
```

**Responsibilities:**
- Validate student code against database
- Return student information if valid
- Handle expired or invalid codes

### Device Model Display Components

#### parseUserAgent Utility

```typescript
interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  manufacturer: string;
  model: string;
  raw: string;
}

function parseUserAgent(userAgent: string): DeviceInfo
```

**Responsibilities:**
- Parse user agent strings
- Extract device type, manufacturer, and model
- Handle various user agent formats
- Provide fallback for unknown devices

#### getDeviceUsageCount Utility

```typescript
interface DeviceUsage {
  deviceInfo: DeviceInfo;
  studentCount: number;
  studentIds: string[];
}

function getDeviceUsageCount(
  attempts: ExamAttempt[],
  examId: string
): Map<string, DeviceUsage>
```

**Responsibilities:**
- Aggregate device usage across attempts
- Count unique students per device
- Group by device identifier (manufacturer + model)
- Return usage statistics

#### DeviceInfoCell Component

```typescript
interface DeviceInfoCellProps {
  deviceInfo: string; // JSON string from database
  ipAddress: string;
  usageCount: number;
}

function DeviceInfoCell(props: DeviceInfoCellProps): JSX.Element
```

**Responsibilities:**
- Display device model and IP address
- Show usage count in parentheses
- Handle missing or invalid device info
- Provide tooltip with full device details

### Dark Theme Components

#### useTheme Hook

```typescript
type Theme = 'light' | 'dark';

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function useTheme(): UseThemeReturn
```

**Responsibilities:**
- Manage current theme state
- Persist theme preference to localStorage
- Apply theme class to document root
- Provide theme toggle functionality

#### ThemeToggle Component

```typescript
interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

function ThemeToggle(props: ThemeToggleProps): JSX.Element
```

**Responsibilities:**
- Render theme toggle button
- Display current theme state (sun/moon icon)
- Trigger theme changes
- Provide accessible labels

## Data Models

### LocalStorage Schema

#### Student Code Storage

```typescript
// Key: 'student_code'
interface StoredStudentCode {
  code: string;
  timestamp: number; // When code was stored
  studentId?: string; // Optional cached student ID
}
```

#### Theme Preference Storage

```typescript
// Key: 'theme_preference'
type StoredTheme = 'light' | 'dark';
```

### Database Schema Modifications

No new tables or columns are required. The existing schema already supports these features:

**Existing Fields Used:**
- `student_exam_attempts.device_info` (TEXT): Stores device information JSON
- `students.code` (TEXT): Student identification code
- `students.id` (UUID): Student unique identifier

### Device Info JSON Structure

```typescript
interface StoredDeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  manufacturer: string;
  model: string;
  userAgent: string;
  capturedAt: string; // ISO timestamp
}
```

This JSON structure is stored in the `device_info` field of `student_exam_attempts`.

### CSS Custom Properties Schema

```css
:root {
  /* Light theme (default) */
  --color-background: #ffffff;
  --color-foreground: #000000;
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --color-border: #e2e8f0;
  --color-input-bg: #ffffff;
  --color-card-bg: #f8fafc;
  /* ... additional properties */
}

:root.dark {
  /* Dark theme overrides */
  --color-background: #0f172a;
  --color-foreground: #f1f5f9;
  --color-primary: #60a5fa;
  --color-secondary: #94a3b8;
  --color-border: #334155;
  --color-input-bg: #1e293b;
  --color-card-bg: #1e293b;
  /* ... additional properties */
}
```

All existing Tailwind utilities and custom CSS classes reference these variables, enabling automatic theme switching.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Student Code Persistence Properties

**Property 1: Code Storage Round-Trip**
*For any* valid student code, when successfully entered and stored in localStorage, retrieving the stored value should return the exact same code.
**Validates: Requirements 1.1**

**Property 2: Valid Code Auto-Redirect**
*For any* valid student code stored in localStorage, loading the exam entry page should trigger validation and redirect to the exams page without requiring manual entry.
**Validates: Requirements 1.2, 1.3, 1.7**

**Property 3: Invalid Code Cleanup**
*For any* invalid or expired student code stored in localStorage, loading the exam entry page should clear the stored code and display the normal entry form.
**Validates: Requirements 1.4**

**Property 4: Code Clearing Completeness**
*For any* stored student code, triggering the clear action should remove the code from localStorage, and subsequent localStorage reads should return null.
**Validates: Requirements 1.6**

**Property 5: Authentication Preservation**
*For any* existing authentication flow, implementing code persistence should not alter the authentication behavior or security checks.
**Validates: Requirements 4.1**

### Device Model Display Properties

**Property 6: Device Info Capture Round-Trip**
*For any* user agent string, when an exam attempt is started, the captured device information should be stored in the database and retrievable in the same format.
**Validates: Requirements 2.1, 2.2**

**Property 7: User Agent Parsing Completeness**
*For any* valid user agent string, parsing should extract device type, manufacturer, and model, with all fields being non-empty strings or appropriate fallback values.
**Validates: Requirements 2.6**

**Property 8: Device Info Display Completeness**
*For any* exam attempt with device information, the results page should display device type, model name, and IP address in a single formatted string.
**Validates: Requirements 2.3, 2.4**

**Property 9: Device Usage Counting Accuracy**
*For any* set of exam attempts within the same exam, the device usage count for a specific device should equal the number of unique student IDs associated with that device's identifier.
**Validates: Requirements 2.7, 2.8**

**Property 10: Export Data Completeness**
*For any* results export, all device information and usage counts present in the UI should also be present in the exported data.
**Validates: Requirements 2.9**

**Property 11: Device Capture Performance**
*For any* exam attempt, the time to capture and store device information should not increase the total attempt start time by more than 50ms.
**Validates: Requirements 4.2**

### Dark Theme Properties

**Property 12: Theme Storage Round-Trip**
*For any* theme selection (light or dark), storing the preference in localStorage and then loading it should return the same theme value.
**Validates: Requirements 3.4, 3.5**

**Property 13: Theme Application Completeness**
*For any* page in the application (public or admin), applying the dark theme should result in all UI components using dark theme CSS custom properties.
**Validates: Requirements 3.1, 3.2, 3.10**

**Property 14: Theme Toggle Immediacy**
*For any* theme toggle action, all visible UI components should reflect the new theme within one render cycle (no stale theme colors visible).
**Validates: Requirements 3.3**

**Property 15: CSS Variable Coverage**
*For any* UI component in the application, all color values should reference CSS custom properties (no hardcoded colors in component styles).
**Validates: Requirements 3.12**

**Property 16: Dark Theme Contrast Compliance**
*For any* text or interactive element in dark theme, the contrast ratio between foreground and background should meet or exceed WCAG AA standards (4.5:1 for normal text, 3:1 for large text and UI components).
**Validates: Requirements 3.7, 3.13**

**Property 17: Dark Theme Chart Rendering**
*For any* chart or data visualization, applying dark theme should result in all chart elements using colors with sufficient contrast against the dark background.
**Validates: Requirements 3.8**

**Property 18: Dark Theme RTL Support**
*For any* page with Arabic content in dark theme, the text direction should remain RTL and all layout elements should maintain proper right-to-left orientation.
**Validates: Requirements 3.9**

**Property 19: Theme Compatibility**
*For any* existing UI component, applying dark theme should not break the component's layout, functionality, or visual hierarchy.
**Validates: Requirements 4.3**

### Integration and Compatibility Properties

**Property 20: Bilingual Feature Support**
*For any* new feature (code persistence, device display, theme toggle), all UI text and labels should be available in both English and Arabic with proper translations.
**Validates: Requirements 4.5**

**Property 21: Responsive Feature Support**
*For any* new feature component, rendering at mobile (320px), tablet (768px), and desktop (1024px) viewport widths should maintain usability and visual integrity.
**Validates: Requirements 4.6**

**Property 22: Accessibility Compliance**
*For any* new interactive element (clear code button, theme toggle, device info display), accessibility audits should report no WCAG AA violations.
**Validates: Requirements 4.4**

## Error Handling

### Student Code Persistence Error Handling

**LocalStorage Unavailable:**
- Gracefully degrade to session-only behavior
- Display no error to user (transparent fallback)
- Log warning to console for debugging
- All exam functionality remains operational

**Code Validation Failure:**
- Clear invalid code from localStorage
- Display standard entry form
- Log validation failure for monitoring
- Provide clear error message if network error

**Redirect Failure:**
- Fall back to manual navigation
- Log error for debugging
- Ensure user can still access exams manually

### Device Model Display Error Handling

**User Agent Parsing Failure:**
- Store raw user agent string
- Display "Unknown Device" in UI
- Log parsing error for improvement
- Continue with exam attempt normally

**Device Info Storage Failure:**
- Log error but don't block attempt
- Attempt continues without device info
- Admin sees "No device info" in results
- System remains operational

**Usage Count Calculation Error:**
- Display device info without count
- Log calculation error
- Don't block results page rendering
- Provide fallback display format

### Dark Theme Error Handling

**LocalStorage Theme Read Failure:**
- Default to light theme
- Log error for debugging
- Theme toggle remains functional
- User can still switch themes

**CSS Variable Application Failure:**
- Fall back to light theme
- Log error with browser info
- Provide user notification
- Ensure content remains readable

**Theme Toggle Failure:**
- Maintain current theme
- Display error toast
- Log error for debugging
- Retry mechanism available

## Testing Strategy

This feature will employ a dual testing approach combining unit tests for specific scenarios and property-based tests for universal correctness guarantees.

### Property-Based Testing

We will use **fast-check** (for TypeScript/JavaScript) to implement property-based tests. Each correctness property defined above will be implemented as a property-based test with a minimum of 100 iterations.

**Test Configuration:**
```typescript
import fc from 'fast-check';

// Example property test configuration
fc.assert(
  fc.property(
    fc.string(), // Arbitrary student code
    (code) => {
      // Test implementation
    }
  ),
  { numRuns: 100 } // Minimum 100 iterations
);
```

**Property Test Tagging:**
Each property test will include a comment tag referencing the design document:
```typescript
// Feature: student-experience-and-admin-enhancements, Property 1: Code Storage Round-Trip
```

**Property Test Coverage:**
- Properties 1-5: Student code persistence (localStorage operations, validation, redirection)
- Properties 6-11: Device model display (parsing, storage, display, counting)
- Properties 12-19: Dark theme (storage, application, contrast, compatibility)
- Properties 20-22: Integration (i18n, responsive, accessibility)

### Unit Testing

Unit tests will focus on specific examples, edge cases, and integration points:

**Student Code Persistence:**
- Empty code handling
- Special characters in codes
- Very long codes (boundary testing)
- Concurrent storage operations
- Browser back/forward navigation

**Device Model Display:**
- Common mobile devices (iPhone, Samsung, Pixel)
- Tablet devices (iPad, Android tablets)
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Unknown or malformed user agents
- Missing user agent headers

**Dark Theme:**
- Theme toggle interaction
- System preference detection
- Theme persistence across sessions
- Component-specific theme application
- Chart color scheme switching

**Integration:**
- Code persistence with existing auth
- Device display with existing results queries
- Theme with existing RTL support
- All features with Arabic language
- All features on mobile devices

### Test Organization

```
src/
├── hooks/
│   └── __tests__/
│       ├── useStudentCode.test.ts
│       └── useStudentCode.pbt.test.ts
├── lib/
│   └── __tests__/
│       ├── parseUserAgent.test.ts
│       ├── parseUserAgent.pbt.test.ts
│       ├── deviceUsage.test.ts
│       └── deviceUsage.pbt.test.ts
├── components/
│   └── __tests__/
│       ├── ThemeToggle.test.tsx
│       ├── ThemeToggle.pbt.test.tsx
│       ├── DeviceInfoCell.test.tsx
│       └── DeviceInfoCell.pbt.test.tsx
└── __tests__/
    └── integration/
        ├── codePersistence.integration.test.tsx
        ├── deviceDisplay.integration.test.tsx
        ├── darkTheme.integration.test.tsx
        └── accessibility.integration.test.tsx
```

### Testing Priorities

1. **Critical Path:** Code validation, device capture, theme application
2. **User Experience:** Auto-redirect, device display, theme toggle
3. **Edge Cases:** LocalStorage failures, unknown devices, contrast compliance
4. **Integration:** Cross-feature compatibility, i18n, accessibility
5. **Performance:** Device capture timing, theme switching speed

### Acceptance Criteria

All tests must pass before considering the feature complete:
- 100% of property-based tests pass (minimum 100 iterations each)
- 100% of unit tests pass
- All integration tests pass
- Accessibility audits show no WCAG AA violations
- Manual testing confirms expected behavior in both languages
- Performance benchmarks meet requirements (device capture < 50ms)
