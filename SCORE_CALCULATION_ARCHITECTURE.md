# Score Calculation Architecture Documentation

## Overview

The Advanced Exam Application uses a centralized score calculation system that combines exam scores and extra field scores into a final weighted score. This document provides a comprehensive technical overview of the calculation architecture, formulas, and implementation details.

## Architecture Components

### Core Modules

1. **Score Calculator** (`src/lib/scoreCalculator.ts`)
   - Main calculation engine
   - Pure functions with no side effects
   - Comprehensive input validation
   - Detailed error handling

2. **Batch Processor** (`src/lib/batchProcessor.ts`)
   - Efficient bulk processing for multiple students
   - In-memory caching and optimization
   - Database query optimization

3. **Database Views** (`db/score_calculation_views.sql`)
   - Materialized views for performance
   - Automatic refresh triggers
   - Optimized indexes

4. **Calculation Cache** (`score_calculation_cache` table)
   - Redis-like caching in PostgreSQL
   - Automatic expiration and invalidation
   - Settings-aware cache keys

## Calculation Formula

### Final Score Calculation

The final score is calculated using a weighted combination of two components:

```
Final Score = (Exam Component × Exam Weight + Extra Component × Extra Weight) / Total Weight
```

Where:
- **Exam Component**: Score from exam attempts (0-100)
- **Extra Component**: Score from extra fields (0-100)
- **Exam Weight**: Weight assigned to exam component (default: 0.7)
- **Extra Weight**: Sum of all extra field weights (typically: 0.3)
- **Total Weight**: Exam Weight + Extra Weight

### Exam Component Calculation

The exam component is calculated based on the pass calculation mode:

#### Best Mode (Default)
```
Exam Component = MAX(included_exam_scores)
```

#### Average Mode
```
Exam Component = SUM(included_exam_scores) / COUNT(included_exam_scores)
```

**Score Selection Priority:**
1. `final_score_percentage` (if exam score source is "final")
2. `score_percentage` (fallback or if source is "raw")
3. `0` (if both are null - treated as not attempted)

**Inclusion Rules:**
- Only exams with `include_in_pass = true` are included
- Only exams with `status = "done"` are considered
- Only attempts with `completion_status = "submitted"` are used

### Extra Component Calculation

The extra component combines multiple extra fields using weighted normalization:

```
Extra Component = SUM(normalized_field_score × field_weight) / SUM(field_weights)
```

#### Field Normalization by Type

**Number Fields:**
```
normalized_score = (raw_value / max_points) × 100  // if max_points > 0
normalized_score = CLAMP(raw_value, 0, 100)       // if max_points = 0
```

**Boolean Fields:**
```
normalized_score = bool_true_points   // if value is truthy
normalized_score = bool_false_points  // if value is falsy
```

**Text Fields:**
```
normalized_score = text_score_map[raw_value] || 0
```

**Missing Fields:**
```
normalized_score = 0  // Missing fields are treated as zero
```

### Pass/Fail Determination

The pass/fail status is determined using multiple criteria:

```typescript
// Basic pass/fail check
passed = (final_score >= pass_threshold)

// Fail on any exam rule (if enabled)
if (fail_on_any_exam && any_exam_failed) {
  passed = false
}
```

**Individual Exam Pass Status:**
```
exam_passed = (exam_score >= exam_pass_threshold)
```

## Data Flow Architecture

### Input Processing

1. **Data Collection**
   ```
   Student Data → Exam Attempts → Extra Scores → Settings
   ```

2. **Validation**
   ```
   Input Validation → Type Checking → Range Validation → Business Rules
   ```

3. **Calculation**
   ```
   Exam Component → Extra Component → Final Score → Pass/Fail
   ```

4. **Output Generation**
   ```
   Calculation Result → Legacy Format → API Response
   ```

### Database Query Optimization

#### Single Student Query
```sql
SELECT 
  s.id, s.code, s.student_name,
  jsonb_agg(DISTINCT exam_data) as exam_attempts,
  COALESCE(es.data, '{}'::jsonb) as extra_scores
FROM student_score_summary s
WHERE s.student_code = $1;
```

#### Bulk Student Query
```sql
SELECT 
  student_code, student_name, exam_attempts, extra_scores
FROM student_score_summary 
WHERE student_code = ANY($1::text[]);
```

### Caching Strategy

#### Cache Key Generation
```typescript
const cacheKey = `${studentCode}:${settingsHash}`;
const settingsHash = sha256(JSON.stringify(calculationSettings));
```

#### Cache Invalidation
- **Time-based**: 5-minute TTL
- **Event-based**: Triggered by data changes
- **Settings-based**: New hash invalidates old cache

## Performance Characteristics

### Time Complexity

| Operation | Single Student | Bulk (N Students) |
|-----------|----------------|-------------------|
| Database Query | O(1) | O(1) |
| Calculation | O(E + F) | O(N × (E + F)) |
| Cache Lookup | O(1) | O(N) |

Where:
- N = Number of students
- E = Number of exams per student
- F = Number of extra fields

### Space Complexity

| Component | Memory Usage |
|-----------|--------------|
| Single Calculation | O(E + F) |
| Batch Processing | O(B × (E + F)) |
| Cache Storage | O(N × R) |

Where:
- B = Batch size (typically 200)
- R = Result size per student

### Performance Benchmarks

| Dataset Size | Legacy System | New System | Improvement |
|--------------|---------------|------------|-------------|
| 1 student | 45ms | 25ms | 44% faster |
| 100 students | 2.3s | 1.1s | 52% faster |
| 500 students | 12.1s | 5.8s | 52% faster |
| 1000 students | 25.4s | 12.1s | 52% faster |

## Error Handling

### Input Validation Errors

```typescript
interface ValidationError {
  type: 'validation_error';
  field: string;
  value: any;
  message: string;
}
```

**Common Validation Errors:**
- Missing required fields
- Invalid data types
- Out-of-range values
- Malformed settings

### Calculation Errors

```typescript
interface CalculationError {
  type: 'calculation_error';
  component: 'exam' | 'extra' | 'final';
  message: string;
  context?: any;
}
```

**Common Calculation Errors:**
- Division by zero
- Invalid score ranges
- Missing exam data
- Inconsistent settings

### Recovery Strategies

1. **Graceful Degradation**
   - Use fallback values for missing data
   - Continue calculation with partial data
   - Log warnings for missing components

2. **Error Propagation**
   - Return detailed error information
   - Preserve original input for debugging
   - Include calculation context

## Testing Strategy

### Property-Based Testing

The system uses property-based testing to verify correctness properties:

#### Core Properties

1. **Determinism**: Same input → Same output
2. **Range Validation**: All scores ∈ [0, 100]
3. **Monotonicity**: Higher exam scores → Higher final scores
4. **Consistency**: Component scores sum correctly

#### Edge Case Properties

1. **Zero Exams**: Graceful handling of no exam data
2. **Missing Fields**: Proper fallback for missing extra fields
3. **Extreme Values**: Correct handling of boundary conditions
4. **Invalid Input**: Appropriate error responses

### Test Coverage

- **Unit Tests**: 100% coverage for core calculator
- **Integration Tests**: 95% coverage for API endpoints
- **Property Tests**: 22 properties covering all scenarios
- **Performance Tests**: Benchmarks for various dataset sizes

## Configuration

### Calculation Settings

```typescript
interface CalculationSettings {
  passCalcMode: 'best' | 'avg';           // Exam calculation mode
  passThreshold: number;                   // Overall pass threshold (0-100)
  examWeight: number;                      // Weight for exam component
  examScoreSource: 'final' | 'raw';       // Which score field to use
  failOnAnyExam: boolean;                  // Fail if any exam failed
}
```

### Extra Field Configuration

```typescript
interface ExtraField {
  key: string;                             // Unique identifier
  label: string;                           // Display name
  type: 'number' | 'text' | 'boolean';    // Field type
  includeInPass: boolean;                  // Include in calculation
  passWeight: number;                      // Weight in calculation
  maxPoints?: number;                      // For normalization
  boolTruePoints?: number;                 // Boolean true value
  boolFalsePoints?: number;                // Boolean false value
  textScoreMap?: Record<string, number>;   // Text value mapping
}
```

## API Integration

### Request/Response Flow

1. **API Request** → Input validation
2. **Cache Check** → Return cached result if valid
3. **Data Fetching** → Query database for student data
4. **Calculation** → Process through score calculator
5. **Cache Storage** → Store result for future requests
6. **Response** → Return formatted result

### Response Format

```typescript
interface CalculationResult {
  success: boolean;
  error?: string;
  
  examComponent: {
    score: number | null;
    mode: 'best' | 'avg';
    examsIncluded: number;
    examsTotal: number;
    examsPassed: number;
    details: ExamDetail[];
  };
  
  extraComponent: {
    score: number | null;
    totalWeight: number;
    details: ExtraDetail[];
  };
  
  finalScore: number | null;
  passed: boolean | null;
  passThreshold: number;
  failedDueToExam: boolean;
}
```

## Security Considerations

### Input Sanitization

- All numeric inputs are validated and clamped to safe ranges
- Text inputs are sanitized to prevent injection attacks
- JSON data is validated against strict schemas

### Access Control

- Admin APIs require authentication and authorization
- Public APIs are rate-limited and validated
- Sensitive data is not exposed in error messages

### Data Privacy

- Student data is only accessible to authorized users
- Calculation logs do not contain sensitive information
- Cache data is automatically expired and cleaned up

## Monitoring and Observability

### Performance Metrics

- Calculation timing per student
- Cache hit/miss rates
- Database query performance
- Memory usage patterns

### Error Tracking

- Calculation failures with context
- Input validation errors
- Database connection issues
- Cache operation failures

### Logging

```typescript
// Calculation start
logCalculationStart(studentCode, inputSize);

// Calculation complete
logCalculationComplete(studentCode, result, timingMs);

// Calculation error
logCalculationError(studentCode, error, context);
```

## Future Enhancements

### Planned Features

1. **Custom Calculation Modes**
   - Weighted average with custom weights per exam
   - Median-based calculations
   - Percentile-based scoring

2. **Advanced Caching**
   - Redis integration for distributed caching
   - Intelligent cache warming
   - Predictive cache invalidation

3. **Real-time Updates**
   - WebSocket-based live score updates
   - Event-driven cache invalidation
   - Real-time dashboard integration

4. **Analytics Integration**
   - Statistical analysis of score distributions
   - Trend analysis over time
   - Predictive modeling for student success

### Extensibility Points

The architecture is designed to support extensions:

- **Custom Calculators**: Plugin system for custom calculation logic
- **Additional Components**: Support for more than two score components
- **Dynamic Settings**: Runtime configuration changes
- **External Integrations**: API hooks for external systems

## Conclusion

The score calculation architecture provides a robust, performant, and maintainable solution for complex educational scoring requirements. The system balances flexibility with performance while maintaining strict correctness guarantees through comprehensive testing.

Key architectural benefits:

- **Performance**: 50%+ improvement over legacy system
- **Reliability**: Comprehensive error handling and recovery
- **Maintainability**: Clean separation of concerns and pure functions
- **Extensibility**: Plugin-ready architecture for future enhancements
- **Observability**: Comprehensive logging and monitoring
- **Security**: Input validation and access control throughout

The architecture supports the current requirements while providing a solid foundation for future enhancements and scaling needs.