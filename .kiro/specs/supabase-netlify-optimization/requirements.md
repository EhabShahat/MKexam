# Requirements Document: Supabase & Netlify Cost Optimization

## Introduction

This document outlines requirements for optimizing the Advanced Exam Application to reduce Supabase egress bandwidth and Netlify function execution costs while improving application performance and speed. The optimization targets a 60% reduction in Supabase egress and 50% reduction in Netlify function execution time through strategic caching, data transfer optimization, and query improvements.

## Glossary

- **Supabase_Egress**: Data transferred from Supabase database to the application (measured in GB)
- **Netlify_Function**: Serverless function executed via Next.js API routes on Netlify infrastructure
- **RPC_Function**: Remote Procedure Call function executed in Supabase PostgreSQL database
- **JSONB_Field**: PostgreSQL JSON binary field type used for storing structured data (answers, device_info, auto_save_data)
- **React_Query**: Data fetching and caching library (@tanstack/react-query) used for server state management
- **ISR**: Incremental Static Regeneration - Next.js feature for updating static pages without full rebuild
- **Edge_Function**: Serverless function running at CDN edge locations for reduced latency
- **Compression**: Data encoding technique (gzip/brotli) to reduce transfer size
- **Field_Selection**: Database query optimization to fetch only required columns
- **Materialized_View**: Pre-computed database view stored as a table for faster queries
- **CDN_Cache**: Content Delivery Network cache for static and semi-static content
- **Cold_Start**: Initial startup time for serverless functions after period of inactivity
- **Batch_Processing**: Processing multiple operations together to reduce overhead
- **Virtual_Scrolling**: UI technique to render only visible items in large lists

## Requirements

### Requirement 1: Supabase Egress Reduction

**User Story:** As a system administrator, I want to reduce Supabase egress bandwidth by 60%, so that I can lower infrastructure costs while maintaining application functionality.

#### Acceptance Criteria

1. WHEN RPC functions return data THEN the System SHALL compress responses using gzip or brotli encoding
2. WHEN get_attempt_state is called THEN the System SHALL support optional field selection to return only requested fields
3. WHEN admin_list_attempts is called THEN the System SHALL implement pagination with configurable page size
4. WHEN questions are fetched for an exam THEN the System SHALL exclude correct_answers field for student-facing requests
5. WHEN device_info is stored THEN the System SHALL compress nested IP arrays before storage
6. WHEN auto_save_data is transferred THEN the System SHALL use incremental updates instead of full payload transfers
7. WHEN exam configurations are requested THEN the System SHALL cache frequently accessed exam metadata
8. WHEN real-time subscriptions are active THEN the System SHALL limit payload size to changed fields only

### Requirement 2: Database Query Optimization

**User Story:** As a system administrator, I want optimized database queries, so that data retrieval is faster and uses less bandwidth.

#### Acceptance Criteria

1. WHEN admin_list_attempts executes THEN the System SHALL use a materialized view instead of multiple LEFT JOINs
2. WHEN cleanup_expired_attempts runs THEN the System SHALL process batches of maximum 100 attempts per iteration
3. WHEN calculate_result_for_attempt executes THEN the System SHALL cache intermediate calculations for reuse
4. WHEN questions are queried by exam_id THEN the System SHALL use covering indexes to avoid table scans
5. WHEN student_exam_summary is accessed THEN the System SHALL refresh the view incrementally instead of full recomputation
6. WHEN get_attempt_state validates timestamps THEN the System SHALL perform validation checks in a single query
7. WHEN regrade_exam processes attempts THEN the System SHALL batch calculate operations instead of row-by-row iteration

### Requirement 3: Netlify Function Cost Reduction

**User Story:** As a system administrator, I want to reduce Netlify function execution time by 50%, so that I can lower serverless computing costs.

#### Acceptance Criteria

1. WHEN exam pages are requested THEN the System SHALL use ISR with 60-second revalidation for published exams
2. WHEN API routes execute THEN the System SHALL implement response caching with appropriate cache headers
3. WHEN heavy computations are needed THEN the System SHALL move processing to Supabase RPC functions
4. WHEN multiple database queries are needed THEN the System SHALL batch requests into single RPC calls
5. WHEN function cold starts occur THEN the System SHALL use connection pooling to reduce initialization time
6. WHEN static exam content is requested THEN the System SHALL serve from CDN cache with 1-hour TTL
7. WHEN authentication checks are performed THEN the System SHALL cache JWT validation results for 5 minutes

### Requirement 4: Frontend Data Fetching Optimization

**User Story:** As a developer, I want optimized frontend data fetching, so that the application loads faster and makes fewer network requests.

#### Acceptance Criteria

1. WHEN React Query fetches data THEN the System SHALL deduplicate identical concurrent requests
2. WHEN exam data is cached THEN the System SHALL use stale-while-revalidate strategy with 30-second stale time
3. WHEN large lists are rendered THEN the System SHALL implement virtual scrolling for lists exceeding 50 items
4. WHEN mutations succeed THEN the System SHALL use optimistic updates to improve perceived performance
5. WHEN attempt state is saved THEN the System SHALL debounce auto-save requests to maximum 1 per 3 seconds
6. WHEN monitoring data refreshes THEN the System SHALL use polling intervals of minimum 10 seconds
7. WHEN exam questions are displayed THEN the System SHALL prefetch next question data during current question view

### Requirement 5: JSONB Field Optimization

**User Story:** As a system administrator, I want optimized JSONB field storage and transfer, so that large JSON payloads consume less bandwidth.

#### Acceptance Criteria

1. WHEN answers are stored THEN the System SHALL use compact JSON encoding without whitespace
2. WHEN device_info contains arrays THEN the System SHALL deduplicate repeated IP addresses before storage
3. WHEN auto_save_data is updated THEN the System SHALL store only changed question answers as delta
4. WHEN exam settings are retrieved THEN the System SHALL parse only required settings fields
5. WHEN activity events are logged THEN the System SHALL batch events and compress payload before insertion
6. WHEN progress_data is stored THEN the System SHALL use integer timestamps instead of ISO strings
7. WHEN option_image_urls are stored THEN the System SHALL use relative paths instead of full URLs

### Requirement 6: Caching Strategy Implementation

**User Story:** As a developer, I want a comprehensive caching strategy, so that frequently accessed data is served from cache instead of database.

#### Acceptance Criteria

1. WHEN exam metadata is requested THEN the System SHALL cache exam title, description, and settings for 5 minutes
2. WHEN questions are fetched THEN the System SHALL cache question text and options for published exams indefinitely
3. WHEN student codes are validated THEN the System SHALL cache valid codes for 10 minutes
4. WHEN IP rules are checked THEN the System SHALL cache exam IP restrictions for 15 minutes
5. WHEN app_config is accessed THEN the System SHALL cache configuration values for 30 minutes
6. WHEN audit logs are queried THEN the System SHALL implement cursor-based pagination to avoid offset scans
7. WHEN cache invalidation is needed THEN the System SHALL provide manual cache clear functionality for admins

### Requirement 7: Real-time Monitoring Optimization

**User Story:** As an administrator, I want optimized real-time monitoring, so that I can track exam activity without excessive bandwidth usage.

#### Acceptance Criteria

1. WHEN monitoring active attempts THEN the System SHALL subscribe only to attempt status changes, not full attempt data
2. WHEN new attempts start THEN the System SHALL broadcast only attempt_id, student_name, and started_at
3. WHEN attempts are submitted THEN the System SHALL broadcast only attempt_id and submitted_at
4. WHEN monitoring dashboard loads THEN the System SHALL fetch summary statistics instead of individual attempt records
5. WHEN real-time updates occur THEN the System SHALL throttle broadcasts to maximum 1 per second per exam
6. WHEN multiple admins monitor THEN the System SHALL use shared subscription channels to reduce database load
7. WHEN monitoring is inactive THEN the System SHALL automatically unsubscribe after 5 minutes of inactivity

### Requirement 8: Asset and Bundle Optimization

**User Story:** As a developer, I want optimized application bundles, so that initial page load is faster and uses less bandwidth.

#### Acceptance Criteria

1. WHEN admin routes are accessed THEN the System SHALL code-split admin components from student-facing code
2. WHEN images are displayed THEN the System SHALL use Next.js Image component with automatic optimization
3. WHEN heavy libraries are imported THEN the System SHALL use dynamic imports to defer loading
4. WHEN JavaScript bundles are built THEN the System SHALL enable tree shaking to remove unused code
5. WHEN CSS is generated THEN the System SHALL purge unused Tailwind classes in production builds
6. WHEN fonts are loaded THEN the System SHALL use font-display: swap to prevent render blocking
7. WHEN third-party scripts are needed THEN the System SHALL load them asynchronously with defer attribute

### Requirement 9: Performance Monitoring and Measurement

**User Story:** As a system administrator, I want performance monitoring capabilities, so that I can track optimization effectiveness and identify bottlenecks.

#### Acceptance Criteria

1. WHEN optimization is deployed THEN the System SHALL track Supabase egress metrics daily
2. WHEN functions execute THEN the System SHALL log execution time for all Netlify functions
3. WHEN database queries run THEN the System SHALL log slow queries exceeding 1 second
4. WHEN cache hits occur THEN the System SHALL track cache hit rate per cache type
5. WHEN API requests are made THEN the System SHALL measure and log response time percentiles (p50, p95, p99)
6. WHEN errors occur THEN the System SHALL log error rates and types for monitoring
7. WHEN performance degrades THEN the System SHALL alert administrators when metrics exceed thresholds

### Requirement 10: Backward Compatibility and Migration

**User Story:** As a developer, I want backward-compatible optimizations, so that existing functionality continues to work during and after optimization.

#### Acceptance Criteria

1. WHEN RPC functions are modified THEN the System SHALL maintain existing function signatures
2. WHEN new optimized endpoints are added THEN the System SHALL keep legacy endpoints functional for 30 days
3. WHEN caching is implemented THEN the System SHALL provide cache bypass option for debugging
4. WHEN field selection is added THEN the System SHALL default to returning all fields if no selection specified
5. WHEN compression is enabled THEN the System SHALL detect and handle uncompressed legacy data
6. WHEN materialized views are created THEN the System SHALL maintain original tables for rollback capability
7. WHEN batch processing is implemented THEN the System SHALL handle single-item operations for backward compatibility

### Requirement 11: Security Implications of Caching

**User Story:** As a security administrator, I want secure caching implementation, so that sensitive data is not exposed through cache mechanisms.

#### Acceptance Criteria

1. WHEN student answers are cached THEN the System SHALL encrypt cached answer data at rest
2. WHEN admin data is cached THEN the System SHALL isolate admin cache from student cache
3. WHEN cache keys are generated THEN the System SHALL include user role in cache key to prevent cross-user access
4. WHEN sensitive fields are requested THEN the System SHALL exclude password_hash and JWT secrets from all caches
5. WHEN cache expires THEN the System SHALL securely delete cached data instead of marking as expired
6. WHEN IP addresses are cached THEN the System SHALL hash IP addresses in cache keys for privacy
7. WHEN audit logs are cached THEN the System SHALL limit cache duration to maximum 1 minute for compliance

### Requirement 12: Cost Tracking and Reporting

**User Story:** As a system administrator, I want cost tracking capabilities, so that I can measure ROI of optimization efforts.

#### Acceptance Criteria

1. WHEN optimization is active THEN the System SHALL track daily Supabase egress in GB
2. WHEN functions execute THEN the System SHALL track total Netlify function execution time in seconds
3. WHEN month ends THEN the System SHALL generate cost comparison report vs previous month
4. WHEN bandwidth is consumed THEN the System SHALL categorize egress by operation type (RPC, real-time, storage)
5. WHEN cache is used THEN the System SHALL calculate bandwidth saved through caching
6. WHEN reports are generated THEN the System SHALL show cost per exam and cost per student metrics
7. WHEN thresholds are exceeded THEN the System SHALL alert administrators when costs exceed budget limits

### Requirement 13: Incremental Data Loading

**User Story:** As a student, I want faster exam loading, so that I can start taking exams without waiting for all data to load.

#### Acceptance Criteria

1. WHEN exam starts THEN the System SHALL load first 5 questions immediately and remaining questions progressively
2. WHEN questions are displayed THEN the System SHALL prefetch next 3 questions in background
3. WHEN images are present THEN the System SHALL lazy load question images below the fold
4. WHEN exam has many questions THEN the System SHALL load questions in chunks of 10
5. WHEN network is slow THEN the System SHALL prioritize loading current question over prefetching
6. WHEN exam resumes THEN the System SHALL load last answered question first
7. WHEN all questions are loaded THEN the System SHALL cache complete question set for offline access

### Requirement 14: Compression Implementation

**User Story:** As a developer, I want response compression, so that data transfers use less bandwidth.

#### Acceptance Criteria

1. WHEN RPC functions return data THEN the System SHALL compress responses larger than 1KB
2. WHEN compression is applied THEN the System SHALL use brotli for modern browsers and gzip for legacy browsers
3. WHEN JSON is returned THEN the System SHALL achieve minimum 60% compression ratio
4. WHEN compression fails THEN the System SHALL fallback to uncompressed response
5. WHEN client requests data THEN the System SHALL respect Accept-Encoding header
6. WHEN compressed data is cached THEN the System SHALL store compressed version to save cache space
7. WHEN decompression occurs THEN the System SHALL handle decompression errors gracefully

### Requirement 15: Index Optimization

**User Story:** As a database administrator, I want optimized database indexes, so that queries execute faster with less resource usage.

#### Acceptance Criteria

1. WHEN exam_attempts are queried by exam_id and completion_status THEN the System SHALL use composite index
2. WHEN questions are ordered by order_index THEN the System SHALL use covering index including question_text
3. WHEN audit_logs are filtered by date range THEN the System SHALL use BRIN index on created_at
4. WHEN device_info is queried by fingerprint THEN the System SHALL use expression index on device_info->>'fingerprint'
5. WHEN students are searched by code THEN the System SHALL use unique index with INCLUDE clause for student_name
6. WHEN attempt_activity_events are queried THEN the System SHALL use partial index for recent events only
7. WHEN unused indexes are identified THEN the System SHALL remove indexes with zero usage after 30 days
