# Requirements Document: Score Calculation Optimization

## Introduction

This specification addresses critical issues in the final score calculation system for the Advanced Exam Application. The system currently combines exam scores with extra scores (attendance, homework, quiz) to produce a weighted final score. However, the implementation suffers from performance bottlenecks, calculation inconsistencies, and maintainability challenges that impact both administrators viewing results and students checking their scores.

## Glossary

- **Score_Calculator**: The centralized module responsible for computing final scores from exam and extra score components
- **Extra_Scores**: Additional scoring fields beyond exams (attendance, homework, quiz scores) stored in the extra_scores table
- **Final_Score**: The weighted combination of exam scores and extra score fields
- **Exam_Component**: The portion of the final score derived from exam attempts
- **Extra_Component**: The portion of the final score derived from extra score fields
- **Pass_Calculation**: The algorithm that determines if a student passes based on final score and thresholds
- **Score_Cache**: A temporary storage mechanism for frequently accessed score calculations
- **Batch_Processor**: A component that handles multiple score calculations efficiently
- **Admin_Summary_View**: The /admin/results page showing aggregated scores across all exams
- **Student_Summary_View**: The public results portal where students view their scores
- **Sync_Operation**: The process of updating auto-calculated extra scores (homework, quiz, attendance)

## Requirements

### Requirement 1: Centralized Score Calculation

**User Story:** As a developer, I want a single source of truth for score calculations, so that all views show consistent results and maintenance is simplified.

#### Acceptance Criteria

1. THE Score_Calculator SHALL provide a single function for computing final scores from exam and extra score data
2. WHEN any code path needs to calculate a final score, THE System SHALL use the Score_Calculator module
3. THE Score_Calculator SHALL accept student data, exam attempts, extra scores, and settings as inputs
4. THE Score_Calculator SHALL return a structured result containing exam component, extra component, overall score, and pass status
5. THE Score_Calculator SHALL be independent of HTTP request/response handling
6. THE Score_Calculator SHALL validate all inputs and handle missing or invalid data gracefully

### Requirement 2: Performance Optimization

**User Story:** As an administrator, I want the "All Exams" view to load quickly, so that I can efficiently review student performance across all assessments.

#### Acceptance Criteria

1. WHEN loading the Admin_Summary_View with more than 100 students, THE System SHALL complete the initial load within 3 seconds
2. THE Batch_Processor SHALL fetch summary data in batches of maximum 200 codes per request
3. THE System SHALL use database-level aggregation queries instead of multiple individual queries
4. WHEN calculating scores for multiple students, THE System SHALL minimize redundant database queries
5. THE System SHALL cache field definitions and settings for the duration of a batch operation
6. WHEN exam or extra score data changes, THE System SHALL invalidate relevant cached calculations

### Requirement 3: Calculation Consistency

**User Story:** As a student, I want my score to be the same whether I view it in the public portal or an administrator views it, so that I can trust the accuracy of my results.

#### Acceptance Criteria

1. THE Score_Calculator SHALL produce identical results for the same input data regardless of the calling context
2. WHEN the Admin_Summary_View calculates a score, THE result SHALL match the Student_Summary_View calculation
3. THE System SHALL use the same rounding rules (2 decimal places) in all score displays
4. WHEN extra scores are synced, THE System SHALL use the same calculation logic as manual score entry
5. THE System SHALL apply the same pass/fail logic across all views
6. IF the result_fail_on_any_exam setting is enabled, THE System SHALL consistently apply per-exam pass requirements

### Requirement 4: Real-time Data Synchronization

**User Story:** As an administrator, I want extra scores to update automatically when exam data changes, so that final scores always reflect the latest information.

#### Acceptance Criteria

1. WHEN a homework or quiz exam is submitted, THE System SHALL update the corresponding extra score field within 5 seconds
2. WHEN attendance is recorded, THE System SHALL update the attendance_percentage field within 5 seconds
3. THE Sync_Operation SHALL run automatically when the Admin_Summary_View is loaded
4. THE System SHALL provide a manual refresh button to trigger immediate synchronization
5. WHEN synchronization fails, THE System SHALL display an error message and log the failure
6. THE System SHALL track the last sync timestamp for each auto-calculated field

### Requirement 5: Detailed Score Breakdown

**User Story:** As an administrator, I want to see how each component contributes to the final score, so that I can understand and explain score calculations to students.

#### Acceptance Criteria

1. WHEN viewing a student's summary, THE System SHALL display the exam component score
2. WHEN viewing a student's summary, THE System SHALL display each extra score field value and its weighted contribution
3. THE System SHALL show the calculation formula used (best vs average mode)
4. THE System SHALL indicate which exams and fields are included in the pass calculation
5. WHEN exporting results, THE System SHALL include the score breakdown in the export file
6. THE System SHALL display per-exam pass/fail status when individual exam thresholds are configured

### Requirement 6: Maintainable Code Architecture

**User Story:** As a developer, I want clean, testable code with proper separation of concerns, so that I can confidently make changes without breaking existing functionality.

#### Acceptance Criteria

1. THE Score_Calculator SHALL be a pure function with no side effects
2. THE Score_Calculator SHALL have comprehensive unit tests covering all calculation modes
3. THE System SHALL separate data fetching logic from calculation logic
4. THE System SHALL use TypeScript interfaces to define all data structures
5. THE System SHALL document all calculation formulas and edge cases
6. THE System SHALL log calculation inputs and outputs for debugging purposes

### Requirement 7: Efficient Database Queries

**User Story:** As a system administrator, I want database queries to be optimized, so that the application scales to handle thousands of students without performance degradation.

#### Acceptance Criteria

1. THE System SHALL use database views or materialized views for frequently accessed aggregations
2. WHEN fetching student summaries, THE System SHALL use a single query with joins instead of N+1 queries
3. THE System SHALL create appropriate database indexes on frequently queried columns
4. THE System SHALL use query result caching for data that changes infrequently
5. WHEN calculating scores for all students, THE System SHALL process data in memory after a single bulk fetch
6. THE System SHALL monitor and log slow queries (>1 second) for optimization
7. THE System SHALL use Supabase MCP for all database schema changes and queries
8. THE System SHALL maintain local SQL migration files in the db/ directory for version control and deployment

### Requirement 8: Flexible Export Capabilities

**User Story:** As an administrator, I want to export detailed score breakdowns in multiple formats, so that I can analyze data in external tools and share results with stakeholders.

#### Acceptance Criteria

1. WHEN exporting to CSV, THE System SHALL include all score components in separate columns
2. WHEN exporting to XLSX, THE System SHALL format numbers consistently and include formulas where appropriate
3. THE System SHALL support exporting filtered and sorted data
4. THE System SHALL include metadata (export date, calculation settings) in exports
5. THE System SHALL handle Arabic text correctly in all export formats
6. THE System SHALL allow exporting individual student detailed breakdowns

### Requirement 9: Error Handling and Validation

**User Story:** As a developer, I want comprehensive error handling, so that calculation failures are caught early and reported clearly.

#### Acceptance Criteria

1. WHEN input data is missing or invalid, THE Score_Calculator SHALL return a structured error result
2. THE System SHALL validate that weights sum to a reasonable total (warn if sum is not close to 1.0)
3. WHEN a field references a non-existent key, THE System SHALL log a warning and skip that field
4. THE System SHALL handle division by zero gracefully (e.g., when no exams are included)
5. THE System SHALL validate that score percentages are within 0-100 range
6. WHEN calculation errors occur, THE System SHALL provide actionable error messages to administrators

### Requirement 10: Configuration Management

**User Story:** As an administrator, I want to easily configure calculation settings on the extra-scores page, so that I can adjust the scoring system to meet institutional requirements.

#### Acceptance Criteria

1. THE Extra_Scores_Page SHALL provide a UI for configuring exam weight, pass threshold, and calculation mode
2. WHEN settings are changed on the Extra_Scores_Page, THE System SHALL immediately reflect changes in new calculations
3. THE Extra_Scores_Page SHALL validate setting values (e.g., weights must be non-negative)
4. THE Extra_Scores_Page SHALL provide default values for all settings
5. THE Extra_Scores_Page SHALL allow configuring per-field weights and max points
6. THE Extra_Scores_Page SHALL support enabling/disabling the "fail on any exam" rule
7. THE Extra_Scores_Page SHALL display the current calculation formula and explain how scores are computed

### Requirement 11: Audit Trail and Debugging

**User Story:** As a system administrator, I want detailed logs of score calculations, so that I can troubleshoot discrepancies and verify calculation correctness.

#### Acceptance Criteria

1. WHEN a final score is calculated, THE System SHALL log the input data and calculation steps
2. THE System SHALL log when scores are recalculated due to data changes
3. THE System SHALL track which version of the calculation algorithm was used
4. THE System SHALL provide a debug mode that shows detailed calculation breakdowns
5. THE System SHALL log performance metrics for batch operations
6. THE System SHALL retain calculation logs for at least 30 days

### Requirement 12: Backward Compatibility

**User Story:** As a system administrator, I want the new calculation system to work with existing data, so that historical scores remain accurate and no data migration is required.

#### Acceptance Criteria

1. THE Score_Calculator SHALL correctly handle legacy data formats
2. WHEN processing old exam attempts, THE System SHALL use final_score_percentage if available, otherwise score_percentage
3. THE System SHALL support both the old and new calculation APIs during a transition period
4. THE System SHALL produce the same results as the old system for existing test cases
5. THE System SHALL handle missing extra score fields gracefully (treat as 0 or exclude from calculation)
6. THE System SHALL maintain compatibility with existing export formats
