# Score Calculation API Changes Documentation

## Overview

This document details the API changes introduced by the new centralized score calculation system. All changes maintain backward compatibility while providing enhanced functionality and detailed calculation breakdowns.

## Admin Summaries API

### Endpoint: `GET /api/admin/summaries`

#### Request Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `codes` | string | Comma-separated student codes | `STU001,STU002,STU003` |
| `codes[]` | string[] | Array of student codes (repeated) | `codes[]=STU001&codes[]=STU002` |
| `code` | string[] | Individual student codes (repeated) | `code=STU001&code=STU002` |

#### Response Format

```typescript
interface AdminSummaryResponse {
  items: AdminSummaryItem[];
  cached: boolean;
  calculation_time_ms: number;
}

interface AdminSummaryItem {
  code: string;
  student_name: string | null;
  
  // NEW: Detailed calculation result
  calculation: CalculationResult;
  
  // LEGACY: Maintained for backward compatibility
  extras: LegacyExtra[];
  pass_summary: LegacyPassSummary;
}
```

#### New Fields

##### `calculation` Object

```typescript
interface CalculationResult {
  success: boolean;
  error?: string;
  
  examComponent: {
    score: number | null;           // Exam component score (0-100)
    mode: 'best' | 'avg';          // Calculation mode used
    examsIncluded: number;         // Number of exams included
    examsTotal: number;            // Total number of exams
    examsPassed: number;           // Number of exams passed
    details: ExamComponentDetail[]; // Per-exam breakdown
  };
  
  extraComponent: {
    score: number | null;           // Extra component score (0-100)
    totalWeight: number;           // Sum of all field weights
    details: ExtraComponentDetail[]; // Per-field breakdown
  };
  
  finalScore: number | null;       // Combined final score (0-100)
  passed: boolean | null;          // Overall pass status
  passThreshold: number;           // Pass threshold used
  failedDueToExam: boolean;        // Failed due to individual exam
}
```

##### Exam Component Details

```typescript
interface ExamComponentDetail {
  examId: string;                  // Unique exam identifier
  examTitle: string;               // Exam display name
  score: number;                   // Score for this exam (0-100)
  included: boolean;               // Whether included in calculation
  passed: boolean | null;          // Pass status (null if no threshold)
  passThreshold: number | null;    // Individual exam threshold
}
```

##### Extra Component Details

```typescript
interface ExtraComponentDetail {
  fieldKey: string;                // Field identifier
  fieldLabel: string;              // Field display name
  rawValue: any;                   // Original value from database
  normalizedScore: number;         // Normalized score (0-100)
  weight: number;                  // Field weight in calculation
  weightedContribution: number;    // Contribution to final score
}
```

#### Response Metadata

```typescript
interface ResponseMetadata {
  cached: boolean;                 // Whether results came from cache
  calculation_time_ms: number;     // Time taken for calculations
}
```

#### Example Response

```json
{
  "items": [
    {
      "code": "STU001",
      "student_name": "Ahmed Ali",
      "calculation": {
        "success": true,
        "examComponent": {
          "score": 87.5,
          "mode": "best",
          "examsIncluded": 3,
          "examsTotal": 4,
          "examsPassed": 2,
          "details": [
            {
              "examId": "exam-midterm",
              "examTitle": "Midterm Exam",
              "score": 87.5,
              "included": true,
              "passed": true,
              "passThreshold": 60.0
            },
            {
              "examId": "exam-final",
              "examTitle": "Final Exam", 
              "score": 72.0,
              "included": true,
              "passed": true,
              "passThreshold": 60.0
            },
            {
              "examId": "exam-quiz",
              "examTitle": "Quiz 1",
              "score": 45.0,
              "included": true,
              "passed": false,
              "passThreshold": 50.0
            },
            {
              "examId": "exam-optional",
              "examTitle": "Optional Assignment",
              "score": 0.0,
              "included": false,
              "passed": null,
              "passThreshold": null
            }
          ]
        },
        "extraComponent": {
          "score": 82.5,
          "totalWeight": 0.3,
          "details": [
            {
              "fieldKey": "attendance",
              "fieldLabel": "Attendance",
              "rawValue": 0.85,
              "normalizedScore": 85.0,
              "weight": 0.15,
              "weightedContribution": 12.75
            },
            {
              "fieldKey": "homework",
              "fieldLabel": "Homework Average",
              "rawValue": 80.0,
              "normalizedScore": 80.0,
              "weight": 0.15,
              "weightedContribution": 12.0
            }
          ]
        },
        "finalScore": 85.75,
        "passed": true,
        "passThreshold": 60.0,
        "failedDueToExam": false
      },
      "extras": [
        {
          "key": "attendance",
          "value": 0.85
        },
        {
          "key": "homework", 
          "value": 80.0
        }
      ],
      "pass_summary": {
        "overall_score": 85.75,
        "passed": true
      }
    }
  ],
  "cached": false,
  "calculation_time_ms": 156
}
```

## Public Summary API

### Endpoint: `GET /api/public/summary`

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Student code |

#### Response Format

```typescript
interface PublicSummaryResponse {
  student: {
    id: string;
    code: string;
    student_name: string;
  };
  
  // NEW: Detailed calculation result
  calculation: CalculationResult;
  
  // LEGACY: Maintained for backward compatibility
  extras: LegacyExtraWithMetadata[];
  pass_summary: LegacyPassSummaryWithMessage;
}
```

#### New vs Legacy Fields

##### Legacy Extra Format (Enhanced)

```typescript
interface LegacyExtraWithMetadata {
  key: string;                     // Field identifier
  label: string;                   // Field display name
  value: any;                      // Raw value
  max_points: number | null;       // Maximum points for normalization
  type: 'number' | 'text' | 'boolean'; // Field type
}
```

##### Legacy Pass Summary (Enhanced)

```typescript
interface LegacyPassSummaryWithMessage {
  overall_score: number | null;    // Final score
  passed: boolean | null;          // Pass status
  threshold: number;               // Pass threshold
  message: string | null;          // Pass/fail message
  hidden: boolean;                 // Whether message is hidden
  exam_passed: number;             // Number of exams passed
  exam_total: number;              // Total number of exams
}
```

#### Example Response

```json
{
  "student": {
    "id": "uuid-student-id",
    "code": "STU001",
    "student_name": "Ahmed Ali"
  },
  "calculation": {
    // ... same structure as admin API
  },
  "extras": [
    {
      "key": "attendance",
      "label": "Attendance",
      "value": 0.85,
      "max_points": null,
      "type": "number"
    },
    {
      "key": "homework",
      "label": "Homework Average", 
      "value": 80.0,
      "max_points": 100.0,
      "type": "number"
    }
  ],
  "pass_summary": {
    "overall_score": 85.75,
    "passed": true,
    "threshold": 60.0,
    "message": "Congratulations, you passed!",
    "hidden": false,
    "exam_passed": 2,
    "exam_total": 4
  }
}
```

## Export APIs

### CSV Export: `GET /api/admin/summaries/export`

#### New Columns Added

The CSV export now includes additional columns for detailed breakdown:

| Column Group | New Columns | Description |
|--------------|-------------|-------------|
| **Exam Details** | `Exam: {Title}` | Individual exam scores |
| | `Exam: {Title} (Passed)` | Pass status for each exam |
| **Extra Details** | `Extra: {Label} (Raw)` | Raw field values |
| | `Extra: {Label} (Normalized)` | Normalized scores |
| | `Extra: {Label} (Weight)` | Field weights |
| | `Extra: {Label} (Contribution)` | Weighted contributions |

#### Column Order

1. **Student Info**: Code, Name
2. **Summary**: Final Score, Status
3. **Exam Component**: Score, Mode, Included, Passed
4. **Extra Component**: Score, Total Weight
5. **Individual Exams**: Score and Pass status for each exam
6. **Individual Extras**: Raw, Normalized, Weight, Contribution for each field

#### Example CSV Structure

```csv
Student Code,Student Name,Final Score,Status,Exam Component Score,Exam Calculation Mode,Exams Included,Exams Passed,Extra Component Score,Extra Total Weight,Exam: Midterm,Exam: Midterm (Passed),Exam: Final,Exam: Final (Passed),Extra: Attendance (Raw),Extra: Attendance (Normalized),Extra: Attendance (Weight),Extra: Attendance (Contribution)
STU001,Ahmed Ali,85.75,Passed,87.5,Best,3,2,82.5,0.3,87.5,Yes,72.0,Yes,0.85,85.0,0.15,12.75
```

### XLSX Export: `GET /api/admin/summaries/export-xlsx`

#### Enhanced Features

1. **Metadata Sheet**: Calculation settings and export information
2. **Proper Formatting**: Number formats and conditional formatting
3. **Arabic Support**: Enhanced RTL text handling
4. **Formula Support**: Excel formulas for verification

#### Metadata Sheet Content

```
Title: Student Score Summaries
Description: Detailed score breakdown for N students
Export Date: 2024-02-03T16:44:08Z

Calculation Settings:
- Pass Calculation Mode: best
- Overall Pass Threshold: 60%
- Exam Weight: 0.7
- Exam Score Source: final
- Fail on Any Exam: false
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;                   // Error message
  details?: {                      // Optional error details
    code?: string;                 // Error code
    field?: string;                // Field that caused error
    value?: any;                   // Invalid value
  };
}
```

### Common Error Codes

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `missing_code` | Student code not provided | 400 |
| `code_not_found` | Student code not found | 404 |
| `calculation_error` | Error during score calculation | 500 |
| `database_error` | Database query failed | 500 |
| `invalid_input` | Invalid input data | 400 |

### Example Error Response

```json
{
  "error": "Student with code STU999 not found",
  "details": {
    "code": "code_not_found",
    "field": "code",
    "value": "STU999"
  }
}
```

## Backward Compatibility

### Guaranteed Compatibility

1. **Response Structure**: All legacy fields remain in same positions
2. **Data Types**: No changes to existing field types
3. **Column Order**: CSV/XLSX exports maintain existing column order
4. **API Endpoints**: No changes to endpoint URLs or parameters

### Enhanced Fields

1. **More Detailed**: Existing fields may contain more detailed information
2. **Additional Data**: New optional fields provide extra functionality
3. **Better Performance**: Same data delivered faster with caching

### Migration Path

1. **Immediate**: Use existing fields as before - no changes required
2. **Enhanced**: Gradually adopt new fields for additional functionality
3. **Full Migration**: Eventually use new calculation object for complete details

## Performance Considerations

### Caching

- **Automatic**: Results cached for 5 minutes by default
- **Invalidation**: Cache cleared when underlying data changes
- **Hit Rate**: Typically 85%+ for repeated requests

### Batch Processing

- **Optimal Size**: 200 students per batch for best performance
- **Concurrency**: Up to 3 concurrent batches processed
- **Memory**: Constant memory usage regardless of batch size

### Database Optimization

- **Materialized Views**: Pre-aggregated data for fast access
- **Indexes**: Optimized indexes on frequently queried columns
- **Single Query**: Bulk operations use single database query

## Rate Limiting

### Current Limits

- **Admin API**: 100 requests per minute per IP
- **Public API**: 60 requests per minute per IP
- **Export API**: 10 requests per minute per IP

### Recommendations

- **Batch Requests**: Use comma-separated codes instead of multiple requests
- **Cache Results**: Store results client-side for repeated access
- **Pagination**: For large datasets, process in smaller batches

## Testing

### Validation

All API responses can be validated against the TypeScript interfaces provided. The system includes comprehensive property-based tests ensuring:

- **Deterministic Results**: Same input always produces same output
- **Valid Ranges**: All scores within 0-100 range
- **Backward Compatibility**: Legacy formats work correctly
- **Performance**: Response times within acceptable limits

### Test Data

Sample test data and expected responses are available in the test suite for validation and integration testing.

## Support

For questions about API changes or migration assistance:

1. **Documentation**: Refer to this guide and the migration guide
2. **Test Suite**: Check property-based tests for expected behavior
3. **Examples**: Use provided code examples for implementation guidance
4. **Troubleshooting**: Follow troubleshooting guide for common issues