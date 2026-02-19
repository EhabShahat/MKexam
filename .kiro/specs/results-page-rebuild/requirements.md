# Requirements Document

## Introduction

The Results Page Rebuild project aims to refactor the existing Results page from a monolithic 2000+ line component into a modular, maintainable, and performant architecture. The current implementation handles three distinct view modes (Individual Exam, All Exams Aggregated, and Matrix View) with complex data fetching, filtering, sorting, export, and score calculation logic all tightly coupled within a single component. This rebuild will separate concerns, improve performance, enhance testability, and maintain all existing functionality while providing a foundation for future enhancements.

## Glossary

- **Results_Page**: The admin interface for viewing and managing exam attempt results
- **Individual_View**: Display mode showing attempts for a single selected exam
- **All_Exams_View**: Aggregated display mode showing best scores per student across all exams
- **Matrix_View**: Grid display showing all students and their scores across all exams
- **Attempt**: A single student's submission of an exam
- **Extra_Scores**: Additional score fields beyond exam scores (e.g., attendance, participation)
- **Pass_Calculation**: Logic determining if a student passes based on exam scores, extra scores, and thresholds
- **Manual_Grading**: Admin process of scoring paragraph and short answer questions
- **Device_Tracking**: System for recording and displaying device information from attempts
- **Regrade**: Process of recalculating scores after question or grading changes
- **Export_Function**: Feature to download results data in CSV or XLSX format
- **Score_Component**: Calculated portion of final score (Exam Component or Extra Component)
- **Materialized_View**: Pre-aggregated database view for performance optimization
- **Bulk_API**: Endpoint returning all attempts across exams in a single request
- **Admin_User**: Authenticated user with access to the Results page

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As an Admin_User, I want secure access to the Results_Page, so that only authorized personnel can view student results.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to access the Results_Page, THE System SHALL redirect to the login page
2. WHEN an authenticated non-admin user attempts to access the Results_Page, THE System SHALL return a 403 Forbidden error
3. THE System SHALL verify admin authentication on all API endpoints used by the Results_Page
4. WHEN an admin session expires, THE System SHALL prompt for re-authentication without data loss

### Requirement 2: Exam Selection Interface

**User Story:** As an Admin_User, I want to select which exam results to view, so that I can focus on specific assessments or see aggregated data.

#### Acceptance Criteria

1. THE Results_Page SHALL display a list of all non-archived exams
2. THE Results_Page SHALL provide an "All Exams" option for aggregated viewing
3. THE Results_Page SHALL provide a "Matrix View" option for grid-based viewing
4. WHEN an exam is selected, THE Results_Page SHALL load and display attempts for that exam
5. THE Results_Page SHALL display exam metadata including title, type (exam/quiz/homework), and status (published/completed/draft)
6. THE Results_Page SHALL support filtering exams by status (All, Published, Completed)
7. THE Results_Page SHALL support searching exams by title
8. WHEN an exam has scheduling_mode set to "Auto", THE System SHALL determine status based on start_time and end_time
9. WHEN an exam has scheduling_mode set to "Manual", THE System SHALL use is_manually_published flag for status
10. THE Results_Page SHALL persist the selected exam across page refreshes

### Requirement 3: Individual View Data Display

**User Story:** As an Admin_User, I want to view all attempts for a specific exam, so that I can analyze individual student performance.

#### Acceptance Criteria

1. WHEN Individual_View is active, THE Results_Page SHALL display all attempts for the selected exam
2. THE Results_Page SHALL display student name, code, submission time, score percentage, and device information for each attempt
3. WHEN an attempt has manual grading pending, THE Results_Page SHALL display pending count and use score_percentage
4. WHEN an attempt has manual grading completed, THE Results_Page SHALL display checkmark and use final_score_percentage
5. THE Results_Page SHALL calculate and display attempt duration in minutes
6. THE Results_Page SHALL display completion status (completed/in_progress/abandoned)
7. THE Results_Page SHALL support clicking an attempt to view detailed results
8. THE Results_Page SHALL display IP address with usage count when multiple attempts share the same IP
9. THE Results_Page SHALL parse and display device information including type, model, local IP, and automation risk
10. THE Results_Page SHALL display device usage count when the same device is used multiple times

### Requirement 4: All Exams View Data Display

**User Story:** As an Admin_User, I want to see aggregated scores across all exams for each student, so that I can evaluate overall performance.

#### Acceptance Criteria

1. WHEN All_Exams_View is active, THE Results_Page SHALL display one row per student
2. THE Results_Page SHALL display student name and code in the first column
3. THE Results_Page SHALL display one column per non-archived exam showing the best score
4. THE Results_Page SHALL display visible extra score fields as additional columns
5. THE Results_Page SHALL display calculated Exam Component score
6. THE Results_Page SHALL display calculated Extra Component score
7. THE Results_Page SHALL display Final Score with pass/fail indicator
8. WHEN a student has no attempts for an exam, THE Results_Page SHALL display "-" for that exam column
9. THE Results_Page SHALL use Materialized_View for performance optimization
10. THE Results_Page SHALL display exam type badges (exam/quiz/homework) in column headers

### Requirement 5: Score Calculation Logic

**User Story:** As an Admin_User, I want accurate final score calculations based on configurable rules, so that pass/fail determinations are consistent and transparent.

#### Acceptance Criteria

1. THE System SHALL calculate Exam Component score using either "best" or "avg" mode from app_settings
2. WHEN result_pass_calc_mode is "best", THE System SHALL use the highest score from included exams
3. WHEN result_pass_calc_mode is "avg", THE System SHALL use the average score from included exams
4. THE System SHALL only include exams with include_in_pass flag set to true in Exam Component calculation
5. THE System SHALL calculate Extra Component score as weighted sum of extra score fields
6. THE System SHALL normalize extra score fields to percentages based on max_points
7. THE System SHALL calculate Final Score using result_exam_weight to combine Exam and Extra components
8. WHEN result_fail_on_any_exam is true and any included exam score is below its pass_threshold, THE System SHALL mark the student as failed regardless of Final Score
9. THE System SHALL compare Final Score against result_overall_pass_threshold to determine pass/fail
10. THE System SHALL provide detailed calculation breakdown showing all component scores and weights

### Requirement 6: Filtering and Search

**User Story:** As an Admin_User, I want to filter and search results, so that I can quickly find specific students or attempts.

#### Acceptance Criteria

1. WHEN Individual_View is active, THE Results_Page SHALL support filtering by student name or code
2. WHEN Individual_View is active, THE Results_Page SHALL support filtering by date range (start_date and end_date)
3. WHEN All_Exams_View is active, THE Results_Page SHALL support searching by student name or code
4. THE Results_Page SHALL perform case-insensitive search matching
5. THE Results_Page SHALL update displayed results in real-time as filters change
6. THE Results_Page SHALL provide a "Clear Filters" action to reset all filters
7. THE Results_Page SHALL display count of filtered results
8. WHEN no results match filters, THE Results_Page SHALL display an appropriate empty state message

### Requirement 7: Sorting Capabilities

**User Story:** As an Admin_User, I want to sort results by score, so that I can identify top performers or students needing help.

#### Acceptance Criteria

1. WHEN Individual_View is active, THE Results_Page SHALL support sorting by score (none/ascending/descending)
2. WHEN All_Exams_View is active, THE Results_Page SHALL support sorting by Final Score (none/ascending/descending)
3. THE Results_Page SHALL maintain sort order when filters change
4. THE Results_Page SHALL handle null scores by placing them last in ascending sort and last in descending sort
5. THE Results_Page SHALL provide visual indication of current sort order

### Requirement 8: Export Functionality

**User Story:** As an Admin_User, I want to export results to CSV and XLSX formats, so that I can perform external analysis and reporting.

#### Acceptance Criteria

1. WHEN Individual_View is active, THE Results_Page SHALL support exporting filtered attempts to CSV
2. WHEN Individual_View is active, THE Results_Page SHALL support exporting filtered attempts to XLSX
3. WHEN All_Exams_View is active, THE Results_Page SHALL support exporting aggregated data to CSV
4. WHEN All_Exams_View is active, THE Results_Page SHALL support exporting aggregated data to XLSX
5. THE Export_Function SHALL include bilingual headers (English and Arabic) for international compatibility
6. THE Export_Function SHALL include all visible columns in the current view
7. THE Export_Function SHALL include device information (type, model, local IP, server IP, automation risk, usage count)
8. WHEN an exam has stages, THE Export_Function SHALL include stage progress data (type, completion, time spent, watch percentage, answered count)
9. THE Export_Function SHALL generate filename based on exam title or "all_exams" for aggregated view
10. THE Export_Function SHALL sanitize filenames to remove invalid characters
11. THE Export_Function SHALL handle Arabic text encoding correctly in both CSV and XLSX formats

### Requirement 9: Manual Grading Integration

**User Story:** As an Admin_User, I want to see which attempts require manual grading, so that I can prioritize grading tasks.

#### Acceptance Criteria

1. THE Results_Page SHALL display manual_total_count for attempts with manually graded questions
2. THE Results_Page SHALL display manual_pending_count for attempts with ungraded questions
3. THE Results_Page SHALL display manual_graded_count for attempts with completed grading
4. WHEN manual_pending_count is greater than 0, THE Results_Page SHALL display pending count with score_percentage
5. WHEN manual_pending_count is 0 and manual_total_count is greater than 0, THE Results_Page SHALL display checkmark with final_score_percentage
6. THE Results_Page SHALL provide navigation to detailed attempt view for manual grading
7. THE Results_Page SHALL update displayed scores after manual grading is completed

### Requirement 10: Regrade Functionality

**User Story:** As an Admin_User, I want to regrade exam attempts, so that score changes from question edits are reflected in results.

#### Acceptance Criteria

1. WHEN Individual_View is active, THE Results_Page SHALL provide a "Regrade All" action
2. WHEN "Regrade All" is triggered, THE System SHALL recalculate scores for all attempts of the selected exam
3. THE System SHALL update exam_results table with new scores after regrading
4. THE System SHALL display success message with count of regraded attempts
5. THE System SHALL refresh displayed results after successful regrade
6. THE System SHALL display error message if regrade fails
7. THE System SHALL prevent concurrent regrade operations on the same exam

### Requirement 11: Delete Attempt Functionality

**User Story:** As an Admin_User, I want to delete invalid attempts, so that I can maintain data quality.

#### Acceptance Criteria

1. THE Results_Page SHALL provide a delete action for each attempt in Individual_View
2. WHEN delete is triggered, THE Results_Page SHALL display confirmation dialog with warning
3. THE System SHALL delete the attempt record from exam_attempts table
4. THE System SHALL delete associated records from student_exam_attempts table
5. THE System SHALL delete associated records from exam_results table
6. THE System SHALL delete associated answer data
7. THE System SHALL refresh displayed results after successful deletion
8. THE System SHALL display success message after deletion
9. THE System SHALL display error message if deletion fails
10. THE System SHALL log deletion action in audit_logs table

### Requirement 12: Device Information Tracking

**User Story:** As an Admin_User, I want to see device information for each attempt, so that I can detect suspicious activity or technical issues.

#### Acceptance Criteria

1. THE Results_Page SHALL parse device_info JSON field from attempts
2. THE Results_Page SHALL display device type (mobile/tablet/desktop)
3. THE Results_Page SHALL display device model using friendlyName or oem brand/model
4. THE Results_Page SHALL display local IP address from allIPs.local array
5. THE Results_Page SHALL display server IP address from ip_address field
6. THE Results_Page SHALL display automation risk indicator when security.automationRisk or security.webdriver is true
7. THE Results_Page SHALL calculate device usage count by matching device fingerprints
8. THE Results_Page SHALL handle legacy device_info formats gracefully
9. THE Results_Page SHALL display "Unknown" for missing device information
10. THE Results_Page SHALL include device information in exports

### Requirement 13: Performance Optimization

**User Story:** As an Admin_User, I want fast page load times even with large datasets, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN All_Exams_View is active, THE System SHALL use results_summary_mv materialized view for data fetching
2. WHEN Individual_View is active, THE System SHALL use Bulk_API to fetch all attempts in a single request
3. THE Results_Page SHALL implement virtual scrolling for tables with more than 50 rows
4. THE Results_Page SHALL use React Query caching with 5-minute stale time
5. THE Results_Page SHALL debounce search input to reduce unnecessary re-renders
6. THE Results_Page SHALL lazy load export libraries (Papa Parse, XLSX) only when needed
7. THE Results_Page SHALL batch API requests when fetching summaries for multiple students
8. THE Results_Page SHALL display loading indicators during data fetching
9. THE Results_Page SHALL handle API errors gracefully without blocking the UI
10. WHEN Materialized_View data is stale, THE System SHALL provide manual refresh option

### Requirement 14: Internationalization Support

**User Story:** As an Admin_User, I want the interface to support both English and Arabic, so that I can work in my preferred language.

#### Acceptance Criteria

1. THE Results_Page SHALL display all UI text in the selected language (English or Arabic)
2. THE Results_Page SHALL use RTL layout when Arabic is selected
3. THE Results_Page SHALL format dates and times according to Cairo timezone
4. THE Results_Page SHALL use Tajawal font for Arabic text
5. THE Results_Page SHALL include bilingual column headers in exports
6. THE Results_Page SHALL handle Arabic text in student names and exam titles correctly
7. THE Results_Page SHALL persist language preference across sessions

### Requirement 15: Accessibility Compliance

**User Story:** As an Admin_User with disabilities, I want the Results_Page to be accessible, so that I can perform my job effectively.

#### Acceptance Criteria

1. THE Results_Page SHALL provide ARIA labels for all interactive elements
2. THE Results_Page SHALL support full keyboard navigation
3. THE Results_Page SHALL maintain focus management when opening modals or dialogs
4. THE Results_Page SHALL provide sufficient color contrast for text and interactive elements
5. THE Results_Page SHALL announce dynamic content changes to screen readers
6. THE Results_Page SHALL provide alternative text for icons and visual indicators
7. THE Results_Page SHALL support browser zoom up to 200% without layout breaking
8. THE Results_Page SHALL use semantic HTML elements for proper structure

### Requirement 16: Error Handling and User Feedback

**User Story:** As an Admin_User, I want clear feedback on actions and errors, so that I understand what's happening and can take corrective action.

#### Acceptance Criteria

1. THE Results_Page SHALL display loading indicators during asynchronous operations
2. THE Results_Page SHALL display success toast notifications after successful actions
3. THE Results_Page SHALL display error toast notifications with descriptive messages when operations fail
4. THE Results_Page SHALL log errors to console for debugging
5. THE Results_Page SHALL provide retry mechanisms for failed API requests
6. THE Results_Page SHALL display empty state messages when no data is available
7. THE Results_Page SHALL validate user input before submitting to API
8. THE Results_Page SHALL prevent duplicate submissions during processing
9. THE Results_Page SHALL display progress indicators for long-running operations
10. THE Results_Page SHALL maintain UI responsiveness during background operations

### Requirement 17: Data Refresh and Synchronization

**User Story:** As an Admin_User, I want to refresh results data, so that I can see the latest submissions and scores.

#### Acceptance Criteria

1. THE Results_Page SHALL provide a manual refresh action for all views
2. WHEN refresh is triggered, THE System SHALL invalidate React Query cache and refetch data
3. THE Results_Page SHALL automatically refetch data after actions that modify results (delete, regrade)
4. THE Results_Page SHALL display refresh status indicator
5. WHEN All_Exams_View is active, THE System SHALL provide option to refresh Materialized_View
6. THE System SHALL use concurrent refresh for Materialized_View to avoid blocking reads
7. THE Results_Page SHALL handle refresh failures gracefully without losing current data

### Requirement 18: Score Breakdown Visualization

**User Story:** As an Admin_User, I want to see detailed score breakdowns, so that I can understand how final scores are calculated.

#### Acceptance Criteria

1. WHEN All_Exams_View is active, THE Results_Page SHALL provide expandable breakdown for each student's Final Score
2. THE Score_Breakdown SHALL display Exam Component score with calculation mode (best/avg)
3. THE Score_Breakdown SHALL display list of included exams with individual scores and pass/fail status
4. THE Score_Breakdown SHALL display Extra Component score with total weight
5. THE Score_Breakdown SHALL display list of extra fields with normalized scores and weighted contributions
6. THE Score_Breakdown SHALL display Final Score calculation
7. THE Score_Breakdown SHALL indicate if student failed due to exam requirement
8. THE Score_Breakdown SHALL display pass threshold used for determination
9. THE Results_Page SHALL allow expanding only one breakdown at a time
10. THE Results_Page SHALL position breakdown overlay to avoid viewport overflow

### Requirement 19: Pass/Fail Summary Statistics

**User Story:** As an Admin_User, I want to see summary statistics, so that I can quickly assess overall class performance.

#### Acceptance Criteria

1. WHEN All_Exams_View is active, THE Results_Page SHALL display count of students who passed
2. WHEN All_Exams_View is active, THE Results_Page SHALL display total count of students
3. THE Results_Page SHALL calculate pass count based on filtered results
4. THE Results_Page SHALL update statistics in real-time as filters change
5. THE Results_Page SHALL display pass rate as a percentage

### Requirement 20: Modular Architecture

**User Story:** As a Developer, I want a modular codebase, so that I can maintain and extend the Results_Page efficiently.

#### Acceptance Criteria

1. THE System SHALL separate data fetching logic into custom React hooks
2. THE System SHALL separate business logic (calculations, transformations) into utility functions
3. THE System SHALL separate UI components into reusable, single-responsibility components
4. THE System SHALL use TypeScript interfaces for all data structures
5. THE System SHALL implement proper error boundaries for component isolation
6. THE System SHALL use dependency injection for testability
7. THE System SHALL document all public APIs and complex logic
8. THE System SHALL follow consistent naming conventions across the codebase
9. THE System SHALL limit component size to maximum 300 lines
10. THE System SHALL achieve minimum 80% test coverage for business logic
