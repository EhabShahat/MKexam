# Requirements Document

## Introduction

This specification defines three enhancements to the Advanced Exam Application: student code persistence for improved user experience, mobile device model display in admin results for better monitoring, and dark theme implementation for modern UI/UX standards. These features aim to reduce friction in the student experience, provide administrators with better device visibility, and offer users a comfortable viewing experience through theme customization.

## Glossary

- **Student_Code**: A unique identifier assigned to each student for exam access
- **LocalStorage**: Browser-based persistent storage mechanism
- **Device_Model**: The manufacturer and model name of the device used to access the exam
- **Dark_Theme**: A color scheme using dark backgrounds and light text for reduced eye strain
- **Theme_Toggle**: A UI control allowing users to switch between light and dark themes
- **Results_Page**: The administrative interface displaying exam attempt data and analytics
- **Exam_Entry**: The process of a student accessing an exam through code or name entry
- **Device_Info**: Technical information about the device used for exam access
- **WCAG**: Web Content Accessibility Guidelines for ensuring accessible design
- **RTL**: Right-to-Left text direction support for Arabic language

## Requirements

### Requirement 1: Student Code Persistence

**User Story:** As a student, I want the application to remember my code in localStorage, so that I can access exams quickly without re-entering my credentials on subsequent visits.

#### Acceptance Criteria

1. WHEN a student successfully enters a valid code, THE System SHALL store the code in localStorage
2. WHEN a student visits the exam platform with a stored code, THE System SHALL automatically validate the stored code against the database
3. WHEN a stored code is valid, THE System SHALL redirect the student directly to the exams page
4. WHEN a stored code is invalid or expired, THE System SHALL clear the stored code and display the normal entry page
5. WHEN a student is on the exams page, THE System SHALL provide a visible control to clear the stored code
6. WHEN a student clears their stored code, THE System SHALL remove it from localStorage and redirect to the entry page
7. THE System SHALL validate stored codes on page load before automatic redirection
8. WHEN localStorage is unavailable or disabled, THE System SHALL function normally without code persistence

### Requirement 2: Mobile Device Model Display

**User Story:** As a system administrator, I want to see the mobile device model name in the results page, so that I can identify which devices students are using for security and support purposes.

#### Acceptance Criteria

1. WHEN a student starts an exam attempt, THE System SHALL capture the device model information from the user agent
2. WHEN device information is captured, THE System SHALL store it in the existing device_info field in the database
3. WHEN an administrator views the results page, THE System SHALL display the device model alongside the IP address
4. WHEN displaying device information, THE System SHALL show device type (mobile, tablet, desktop) and model name
5. WHEN device information is unavailable, THE System SHALL display a fallback indicator (e.g., "Unknown Device")
6. THE System SHALL parse user agent strings to extract manufacturer and model information
7. WHEN multiple students use the same device for exam attempts, THE System SHALL display the count of students in parentheses (e.g., "(3)")
8. WHEN calculating device usage count, THE System SHALL count unique students per device within the same exam
9. WHEN the results table is exported, THE System SHALL include device model information and usage count in the export

### Requirement 3: Dark Theme Implementation

**User Story:** As a user, I want to use a dark theme across the application, so that I can reduce eye strain and have a comfortable viewing experience in low-light conditions.

#### Acceptance Criteria

1. THE System SHALL provide a complete dark theme for all public pages (exam entry, exam taking, results portal)
2. THE System SHALL provide a complete dark theme for all admin pages (dashboard, exams, results, monitoring, audit, settings)
3. WHEN a user toggles the theme, THE System SHALL apply the selected theme immediately across all UI components
4. WHEN a theme is selected, THE System SHALL store the preference in localStorage
5. WHEN a user visits the application, THE System SHALL load and apply their stored theme preference
6. THE System SHALL provide a theme toggle control accessible from the main navigation or header
7. THE Dark_Theme SHALL maintain WCAG AA contrast ratios for all text and interactive elements
8. THE Dark_Theme SHALL properly render all charts and data visualizations with appropriate color schemes
9. THE Dark_Theme SHALL maintain proper RTL layout support for Arabic language content
10. THE Dark_Theme SHALL apply to all form inputs, buttons, tables, cards, and custom CSS primitives
11. WHEN no theme preference is stored, THE System SHALL default to the light theme
12. THE System SHALL use CSS custom properties (variables) for theme color management
13. THE Dark_Theme SHALL ensure proper contrast for focus indicators and interactive states

### Requirement 4: Integration and Compatibility

**User Story:** As a developer, I want these features to integrate seamlessly with existing functionality, so that the application remains stable and maintainable.

#### Acceptance Criteria

1. THE System SHALL maintain all existing authentication and security features when implementing code persistence
2. THE System SHALL ensure device model capture does not impact exam attempt performance
3. THE Dark_Theme SHALL not break any existing UI components or layouts
4. THE System SHALL maintain accessibility compliance (WCAG AA) across all new features
5. THE System SHALL ensure all features work correctly in both English and Arabic languages
6. THE System SHALL maintain responsive design across desktop, tablet, and mobile devices for all features
7. WHEN implementing these features, THE System SHALL not introduce breaking changes to the database schema
8. THE System SHALL ensure all features are compatible with the existing Supabase backend and Next.js frontend architecture
