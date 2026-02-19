# Implementation Plan: Supabase & Netlify Cost Optimization

## Overview

This implementation plan breaks down the optimization work into discrete, incremental tasks that build upon each other. The approach follows a phased rollout strategy: Foundation → Database Optimization → Frontend Optimization → Monitoring & Tuning. Each task includes specific requirements references and testing sub-tasks to ensure correctness.

## Tasks

- [x] 1. Set up performance monitoring infrastructure
  - Create performance_metrics table in database
  - Create cache_statistics table in database
  - Add TypeScript types for performance metrics
  - Set up logging utilities for metrics collection
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ]* 1.1 Write property test for metrics logging
  - **Property 29: Function execution time logging**
  - **Validates: Requirements 9.2**

- [ ]* 1.2 Write property test for slow query logging
  - **Property 30: Slow query logging**
  - **Validates: Requirements 9.3**

- [x] 2. Implement compression module
  - [x] 2.1 Create compression utility module
    - Implement compress() function using Node.js zlib
    - Implement decompress() function
    - Implement shouldCompress() function (threshold: 1KB)
    - Implement getCompressionRatio() function
    - Add support for both gzip and brotli
    - _Requirements: 1.1, 14.1, 14.2, 14.3_

  - [ ]* 2.2 Write property test for compression threshold
    - **Property 1: Compression threshold and application**
    - **Validates: Requirements 1.1, 14.1**

  - [ ]* 2.3 Write property test for compression ratio
    - **Property 2: Compression ratio effectiveness**
    - **Validates: Requirements 14.3**

  - [ ]* 2.4 Write property test for algorithm selection
    - **Property 3: Compression algorithm selection**
    - **Validates: Requirements 14.2, 14.4, 14.5**

  - [ ]* 2.5 Write unit tests for compression edge cases
    - Test empty data compression
    - Test already compressed data
    - Test compression failure scenarios
    - _Requirements: 14.4_

- [x] 3. Implement caching layer infrastructure
  - [x] 3.1 Create cache layer module
    - Implement in-memory cache using Map with LRU eviction
    - Implement get(), set(), delete(), clear() methods
    - Implement getStats() for cache metrics
    - Add TTL support with automatic expiration
    - Add cache key generation utilities
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 3.2 Write property test for cache hit behavior
    - **Property 11: Cache hit behavior**
    - **Validates: Requirements 1.7, 2.3, 3.7, 6.1, 6.2, 6.3, 6.4, 6.5**

  - [ ]* 3.3 Write property test for cache TTL
    - Test that cached items expire after TTL
    - Test that expired items are not returned
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.4 Write property test for secure cache deletion
    - **Property 41: Secure cache deletion**
    - **Validates: Requirements 11.5**

  - [ ]* 3.5 Write unit tests for cache edge cases
    - Test cache full scenario with LRU eviction
    - Test cache corruption handling
    - Test cache timeout handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4. Checkpoint - Ensure foundation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add field selection to RPC functions
  - [x] 5.1 Create field selection utility module
    - Implement parseFieldSelection() function
    - Implement applyFieldSelection() function
    - Implement validateFields() function
    - Add TypeScript types for FieldSelection
    - _Requirements: 1.2, 5.4, 10.4_

  - [x] 5.2 Modify get_attempt_state RPC function
    - Create get_attempt_state_v2 with p_fields parameter
    - Implement field filtering logic in SQL
    - Maintain backward compatibility with original function
    - Add compression support to response
    - _Requirements: 1.2, 10.1_

  - [x] 5.3 Modify admin_list_attempts RPC function
    - Create admin_list_attempts_v2 with pagination and field selection
    - Add p_limit, p_offset, p_fields parameters
    - Implement field filtering logic
    - Maintain backward compatibility
    - _Requirements: 1.3, 1.2, 10.1_

  - [ ]* 5.4 Write property test for field selection
    - **Property 6: Field selection filtering**
    - **Validates: Requirements 1.2, 5.4, 10.4**

  - [ ]* 5.5 Write property test for pagination correctness
    - **Property 7: Pagination correctness**
    - **Validates: Requirements 1.3**

  - [ ]* 5.6 Write property test for backward compatibility
    - **Property 35: Function signature compatibility**
    - **Validates: Requirements 10.1**

- [x] 6. Create materialized view for admin attempts
  - [x] 6.1 Create admin_attempts_summary materialized view
    - Write SQL to create materialized view
    - Add indexes on exam_id and completion_status
    - Create refresh_admin_attempts_summary_incremental function
    - Add trigger to refresh on attempt submission
    - _Requirements: 2.1_

  - [x] 6.2 Update admin_list_attempts_v2 to use materialized view
    - Modify query to use admin_attempts_summary
    - Add fallback to original tables if view is stale
    - _Requirements: 2.1_

  - [ ]* 6.3 Write unit test for materialized view usage
    - Verify query uses materialized view
    - Verify incremental refresh works correctly
    - _Requirements: 2.1_

- [x] 7. Implement optimized database indexes
  - [x] 7.1 Create composite and covering indexes
    - Create idx_attempts_exam_status_started composite index
    - Create idx_questions_exam_order_covering covering index
    - Create idx_audit_logs_created_brin BRIN index
    - Create idx_attempts_device_fingerprint expression index
    - Create idx_activity_events_recent partial index
    - Create idx_students_code_with_name unique index with INCLUDE
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [ ]* 7.2 Write unit tests to verify index usage
    - Test query plans use correct indexes
    - Test index performance improvements
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 8. Implement batch processing for RPC functions
  - [x] 8.1 Create batch_calculate_results RPC function
    - Accept array of attempt_ids
    - Process in batches of 100
    - Return results for all attempts
    - _Requirements: 2.7, 3.4_

  - [x] 8.2 Optimize cleanup_expired_attempts for batch processing
    - Modify to process maximum 100 attempts per iteration
    - Add batch update logic
    - Add safety limits to prevent infinite loops
    - _Requirements: 2.2_

  - [x] 8.3 Optimize regrade_exam for batch processing
    - Modify to batch calculate operations
    - Process attempts in groups instead of one-by-one
    - _Requirements: 2.7_

  - [ ]* 8.4 Write property test for batch size limits
    - **Property 13: Batch size limits**
    - **Validates: Requirements 2.2**

  - [ ]* 8.5 Write property test for batch operations
    - **Property 15: Batch calculation operations**
    - **Validates: Requirements 2.7, 3.4, 5.5**

  - [ ]* 8.6 Write property test for single-item compatibility
    - **Property 38: Single-item batch compatibility**
    - **Validates: Requirements 10.7**

- [x] 9. Checkpoint - Ensure database optimization tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement JSONB field optimization
  - [x] 10.1 Create JSONB optimizer module
    - Implement compactAnswers() to remove whitespace
    - Implement deduplicateDeviceInfo() for IP arrays
    - Implement createAnswerDelta() for incremental updates
    - Implement applyAnswerDelta() to reconstruct full answers
    - Implement timestamp conversion utilities
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 10.2 Modify save_attempt to use answer deltas
    - Update save_attempt RPC to accept delta format
    - Implement delta application logic
    - Maintain backward compatibility with full answers
    - _Requirements: 1.6, 5.3, 10.5_

  - [x] 10.3 Add device_info optimization to start_attempt
    - Deduplicate IP arrays before storage
    - Compress device_info structure
    - _Requirements: 1.5, 5.2_

  - [ ]* 10.4 Write property test for IP deduplication
    - **Property 9: IP deduplication in device_info**
    - **Validates: Requirements 1.5, 5.2**

  - [ ]* 10.5 Write property test for incremental updates
    - **Property 10: Incremental answer updates**
    - **Validates: Requirements 1.6, 5.3**

  - [ ]* 10.6 Write property test for compact JSON
    - **Property 22: Compact JSON encoding**
    - **Validates: Requirements 5.1**

  - [ ]* 10.7 Write property test for integer timestamps
    - **Property 23: Integer timestamp usage**
    - **Validates: Requirements 5.6**

- [x] 11. Integrate compression with RPC functions
  - [x] 11.1 Add compression to get_attempt_state_v2
    - Compress response if size > 1KB
    - Add Content-Encoding header
    - Detect client Accept-Encoding support
    - _Requirements: 1.1, 14.1, 14.5_

  - [x] 11.2 Add compression to admin_list_attempts_v2
    - Compress response if size > 1KB
    - Handle pagination with compression
    - _Requirements: 1.1, 14.1_

  - [x] 11.3 Add compression to get_exam_questions_paginated
    - Create new RPC for paginated questions
    - Compress response
    - Exclude correct_answers for students
    - _Requirements: 1.1, 1.4, 14.1_

  - [ ]* 11.4 Write property test for student answer security
    - **Property 8: Student answer security**
    - **Validates: Requirements 1.4**

  - [ ]* 11.5 Write property test for compressed cache storage
    - **Property 4: Compressed cache storage**
    - **Validates: Requirements 14.6**

- [x] 12. Implement caching for RPC functions
  - [x] 12.1 Add caching to exam metadata queries
    - Cache exam title, description, settings for 5 minutes
    - Implement cache key generation
    - Add cache invalidation on exam update
    - _Requirements: 1.7, 6.1_

  - [x] 12.2 Add caching to question queries
    - Cache questions for published exams indefinitely
    - Invalidate cache on question update
    - _Requirements: 6.2_

  - [x] 12.3 Add caching to student code validation
    - Cache valid codes for 10 minutes
    - Implement secure cache key with hashing
    - _Requirements: 6.3_

  - [x] 12.4 Add caching to IP rules
    - Cache exam IP restrictions for 15 minutes
    - Invalidate on IP rule changes
    - _Requirements: 6.4_

  - [x] 12.5 Add caching to app_config
    - Cache configuration values for 30 minutes
    - Provide admin endpoint to clear cache
    - _Requirements: 6.5, 6.7_

  - [ ]* 12.6 Write property test for cache key role isolation
    - **Property 39: Cache key role isolation**
    - **Validates: Requirements 11.3**

  - [ ]* 12.7 Write property test for sensitive field exclusion
    - **Property 40: Sensitive field exclusion from cache**
    - **Validates: Requirements 11.4**

  - [ ]* 12.8 Write property test for IP hashing
    - **Property 42: IP address hashing in cache keys**
    - **Validates: Requirements 11.6**

- [x] 13. Checkpoint - Ensure caching tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Configure React Query for optimization
  - [x] 14.1 Update React Query configuration
    - Set staleTime to 30 seconds
    - Set cacheTime to 5 minutes
    - Enable request deduplication
    - Configure retry logic with exponential backoff
    - _Requirements: 4.1, 4.2_

  - [x] 14.2 Implement optimistic updates for mutations
    - Add onMutate handlers for immediate UI updates
    - Add onError handlers for rollback
    - Add onSettled handlers for cache invalidation
    - _Requirements: 4.4_

  - [x] 14.3 Add auto-save debouncing
    - Implement debounce utility (3 second delay)
    - Apply to save_attempt mutations
    - _Requirements: 4.5_

  - [ ]* 14.4 Write property test for request deduplication
    - **Property 17: Request deduplication**
    - **Validates: Requirements 4.1**

  - [ ]* 14.5 Write property test for optimistic updates
    - **Property 19: Optimistic update behavior**
    - **Validates: Requirements 4.4**

  - [ ]* 14.6 Write property test for auto-save debouncing
    - **Property 20: Auto-save debouncing**
    - **Validates: Requirements 4.5**

- [x] 15. Implement incremental question loading
  - [x] 15.1 Create incremental loader module
    - Implement loadInitialQuestions() (first 5 questions)
    - Implement loadQuestionChunk() (chunks of 10)
    - Implement prefetchNextQuestions() (next 3 questions)
    - Add React Query integration
    - _Requirements: 13.1, 13.2, 13.4_

  - [x] 15.2 Update exam attempt page to use incremental loading
    - Load first 5 questions on exam start
    - Prefetch next 3 questions in background
    - Load remaining questions in chunks of 10
    - Prioritize current question on slow network
    - _Requirements: 13.1, 13.2, 13.4, 13.5_

  - [x] 15.3 Implement resume optimization
    - Load last answered question first on resume
    - Then load surrounding questions
    - _Requirements: 13.6_

  - [x] 15.4 Add offline caching for loaded questions
    - Cache all loaded questions in React Query
    - Enable offline access to cached questions
    - _Requirements: 13.7_

  - [ ]* 15.5 Write property test for question prefetching
    - **Property 21: Question prefetching**
    - **Validates: Requirements 4.7, 13.2**

  - [ ]* 15.6 Write property test for chunk loading
    - **Property 47: Question chunk loading**
    - **Validates: Requirements 13.4**

  - [ ]* 15.7 Write property test for current question priority
    - **Property 48: Current question priority**
    - **Validates: Requirements 13.5**

  - [ ]* 15.8 Write property test for resume behavior
    - **Property 49: Resume last answered question**
    - **Validates: Requirements 13.6**
  
- [x] 16. Implement virtual scrolling for large lists
  - [x] 16.1 Add virtual scrolling to admin attempts list
    - Install and configure react-window or react-virtual
    - Apply to attempts list when > 50 items
    - Maintain scroll position on updates
    - _Requirements: 4.3_

  - [x] 16.2 Add virtual scrolling to student list
    - Apply to student list when > 50 items
    - _Requirements: 4.3_

  - [x] 16.3 Add virtual scrolling to audit logs
    - Apply to audit log list when > 50 items
    - _Requirements: 4.3_

  - [ ]* 16.4 Write property test for virtual scrolling activation
    - **Property 18: Virtual scrolling activation**
    - **Validates: Requirements 4.3**

- [x] 17. Implement lazy image loading
  - [x] 17.1 Add lazy loading to question images
    - Use Next.js Image component with loading="lazy"
    - Apply to question_image_url
    - Apply to option_image_urls
    - _Requirements: 13.3_

  - [x] 17.2 Add lazy loading to student photos
    - Apply to photo_url in student profiles
    - Apply to national_id_photo_url
    - _Requirements: 13.3_

  - [ ]* 17.3 Write property test for lazy image loading
    - **Property 51: Lazy image loading**
    - **Validates: Requirements 13.3**

- [x] 18. Checkpoint - Ensure frontend optimization tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Implement ISR for exam pages
  - [x] 19.1 Configure ISR for exam entry pages
    - Add revalidate: 60 to exam/[examId]/page.tsx
    - Implement generateStaticParams for published exams
    - Add cache headers for CDN
    - _Requirements: 3.1, 3.6_

  - [x] 19.2 Keep attempt pages dynamic
    - Set dynamic: 'force-dynamic' for attempt/[attemptId]/page.tsx
    - Ensure no static generation for active attempts
    - _Requirements: 3.1_

  - [ ]* 19.3 Write unit test for ISR configuration
    - Verify revalidate is set correctly
    - Verify cache headers are present
    - _Requirements: 3.1_

- [x] 20. Implement API route caching
  - [x] 20.1 Add cache headers to API routes
    - Implement cache header utility
    - Add Cache-Control headers with appropriate TTL
    - Add ETag support for conditional requests
    - _Requirements: 3.2_

  - [x] 20.2 Add response caching middleware
    - Create middleware to cache API responses
    - Implement cache key generation
    - Add cache invalidation logic
    - _Requirements: 3.2_

  - [ ]* 20.3 Write property test for cache headers
    - **Property 16: Response cache headers**
    - **Validates: Requirements 3.2**

- [x] 21. Optimize real-time monitoring
  - [x] 21.1 Implement minimal payload subscriptions
    - Modify subscription to send only changed fields
    - Broadcast only attempt_id, student_name, started_at on start
    - Broadcast only attempt_id, submitted_at on submit
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 21.2 Add subscription throttling
    - Throttle broadcasts to max 1 per second per exam
    - Batch multiple updates within throttle window
    - _Requirements: 7.5_

  - [x] 21.3 Implement shared subscription channels
    - Use single channel per exam for multiple admins
    - Reduce database load from multiple subscriptions
    - _Requirements: 7.6_

  - [x] 21.4 Add automatic unsubscribe on inactivity
    - Detect 5 minutes of inactivity
    - Automatically unsubscribe inactive monitoring
    - _Requirements: 7.7_

  - [x] 21.5 Implement summary statistics for monitoring
    - Fetch aggregated statistics instead of individual attempts
    - Reduce data transfer for monitoring dashboard
    - _Requirements: 7.4_

  - [ ]* 21.6 Write property test for payload minimization
    - **Property 12: Real-time payload minimization**
    - **Validates: Requirements 1.8, 7.1, 7.2, 7.3**

  - [ ]* 21.7 Write property test for subscription throttling
    - **Property 26: Monitoring subscription throttling**
    - **Validates: Requirements 7.5**

  - [ ]* 21.8 Write property test for shared channels
    - **Property 27: Shared subscription channels**
    - **Validates: Requirements 7.6**

  - [ ]* 21.9 Write property test for auto-unsubscribe
    - **Property 28: Automatic unsubscribe on inactivity**
    - **Validates: Requirements 7.7**

- [x] 22. Implement performance monitoring dashboard
  - [x] 22.1 Create performance metrics collection service
    - Implement trackEgress() function
    - Implement trackFunctionExecution() function
    - Implement trackCacheHit() function
    - Implement trackQueryTime() function
    - Store metrics in performance_metrics table
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 22.2 Create admin performance dashboard page
    - Display Supabase egress metrics
    - Display Netlify function execution time
    - Display cache hit rates
    - Display slow queries
    - Display cost estimates
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 22.3 Implement performance alerting
    - Check metrics against thresholds
    - Send alerts when thresholds exceeded
    - Alert on egress > 80% of budget
    - Alert on function time > 80% of budget
    - Alert on cache hit rate < 70%
    - _Requirements: 9.7, 12.7_

  - [ ]* 22.4 Write property test for cache hit rate tracking
    - **Property 31: Cache hit rate tracking**
    - **Validates: Requirements 9.4**

  - [ ]* 22.5 Write property test for response time percentiles
    - **Property 32: Response time percentile calculation**
    - **Validates: Requirements 9.5**

  - [ ]* 22.6 Write property test for error tracking
    - **Property 33: Error rate tracking**
    - **Validates: Requirements 9.6**

  - [ ]* 22.7 Write property test for threshold alerting
    - **Property 34: Performance threshold alerting**
    - **Validates: Requirements 9.7**

- [x] 23. Implement cost tracking and reporting
  - [x] 23.1 Create cost tracking service
    - Track daily Supabase egress in GB
    - Track Netlify function execution time
    - Categorize egress by operation type
    - Calculate bandwidth saved through caching
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

  - [x] 23.2 Create cost reporting dashboard
    - Display daily/weekly/monthly cost trends
    - Show cost comparison vs previous period
    - Display cost per exam and cost per student
    - Show bandwidth savings from optimization
    - _Requirements: 12.3, 12.6_

  - [x] 23.3 Implement cost alerting
    - Alert when costs exceed budget limits
    - Send daily cost summary to admins
    - _Requirements: 12.7_

  - [ ]* 23.4 Write property test for egress categorization
    - **Property 44: Egress categorization**
    - **Validates: Requirements 12.4**

  - [ ]* 23.5 Write property test for bandwidth savings
    - **Property 45: Cache bandwidth savings calculation**
    - **Validates: Requirements 12.5**

  - [ ]* 23.6 Write property test for cost alerting
    - **Property 46: Cost threshold alerting**
    - **Validates: Requirements 12.7**

- [~] 24. Checkpoint - Ensure monitoring tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 25. Implement bundle optimization
  - [x] 25.1 Configure code splitting
    - Split admin routes from student routes
    - Use dynamic imports for heavy components
    - Configure Next.js bundle analyzer
    - _Requirements: 8.1, 8.3_

  - [x] 25.2 Optimize CSS bundle
    - Configure Tailwind CSS purging for production
    - Remove unused CSS classes
    - _Requirements: 8.5_

  - [x] 25.3 Optimize font loading
    - Add font-display: swap to font declarations
    - Preload critical fonts
    - _Requirements: 8.6_

  - [x] 25.4 Optimize third-party scripts
    - Load scripts with defer attribute
    - Use async loading where appropriate
    - _Requirements: 8.7_

  - [ ]* 25.5 Write unit tests for bundle optimization
    - Verify code splitting configuration
    - Verify CSS purging in production
    - Verify font loading strategy
    - _Requirements: 8.1, 8.3, 8.5, 8.6, 8.7_

- [x] 26. Implement backward compatibility layer
  - [x] 26.1 Create legacy endpoint wrappers
    - Wrap new optimized endpoints
    - Maintain old function signatures
    - Add deprecation warnings
    - Plan 30-day deprecation timeline
    - _Requirements: 10.1, 10.2_

  - [x] 26.2 Add cache bypass option
    - Implement ?nocache query parameter
    - Add admin-only cache bypass capability
    - _Requirements: 10.3_

  - [x] 26.3 Add compression detection for legacy data
    - Detect uncompressed legacy data
    - Handle both compressed and uncompressed data
    - _Requirements: 10.5_

  - [ ]* 26.4 Write property test for legacy endpoint functionality
    - **Property 36: Legacy endpoint functionality**
    - **Validates: Requirements 10.2**

  - [ ]* 26.5 Write property test for uncompressed data handling
    - **Property 37: Uncompressed data handling**
    - **Validates: Requirements 10.5**

- [x] 27. Implement security measures for caching
  - [x] 27.1 Add cache encryption for sensitive data
    - Encrypt student answers in cache
    - Use AES-256 encryption
    - _Requirements: 11.1_

  - [x] 27.2 Implement cache isolation
    - Separate admin cache from student cache
    - Use different cache namespaces
    - _Requirements: 11.2_

  - [x] 27.3 Add audit log cache TTL limits
    - Limit audit log cache to 1 minute max
    - Implement strict TTL enforcement
    - _Requirements: 11.7_

  - [ ]* 27.4 Write property test for audit log cache TTL
    - **Property 43: Audit log cache TTL limit**
    - **Validates: Requirements 11.7**

- [x] 28. Final integration and testing
  - [x] 28.1 Run full integration test suite
    - Test end-to-end optimization flow
    - Test cache invalidation scenarios
    - Test compression with real data
    - Test performance under load
    - _Requirements: All_

  - [x] 28.2 Measure baseline vs optimized metrics
    - Measure Supabase egress reduction
    - Measure Netlify function time reduction
    - Measure page load time improvement
    - Measure cache hit rates
    - Verify 60% egress reduction target
    - Verify 50% function time reduction target
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 28.3 Create rollback plan documentation
    - Document rollback procedures
    - Create feature flag configuration
    - Document monitoring thresholds
    - _Requirements: All_

- [x] 29. Final checkpoint - Verify all optimization goals met
  - Ensure all tests pass, ask the user if questions arise.
  - Verify 60% Supabase egress reduction achieved
  - Verify 50% Netlify function execution time reduction achieved
  - Verify cache hit rate > 80%
  - Verify compression ratio > 60%

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- The phased approach allows for rollback at any stage if issues arise
- Performance metrics should be monitored continuously throughout implementation
- Security measures are integrated throughout, not added as an afterthought
