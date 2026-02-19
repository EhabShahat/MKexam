# Compression Integration Quick Reference

## Overview

Response compression is now integrated with RPC functions to reduce bandwidth usage by 60-80%.

## Quick Start

### For API Route Developers

```typescript
import { compressResponse } from '@/lib/compression-middleware';

export async function GET(req: NextRequest) {
  const data = await fetchYourData();
  const acceptEncoding = req.headers.get('accept-encoding');
  return await compressResponse(data, acceptEncoding);
}
```

### For Frontend Developers

```typescript
// Compression is automatic - just add the header
const response = await fetch('/api/attempts/123/state', {
  headers: {
    'Accept-Encoding': 'gzip, br'
  }
});
```

## Available Endpoints

### 1. Attempt State (with compression)

```bash
# Basic usage
GET /api/attempts/[attemptId]/state

# With field selection (v2)
GET /api/attempts/[attemptId]/state?v2=true&fields=exam,questions

# Available fields: exam, questions, answers, auto_save_data, stages, stage_progress
```

### 2. Admin Attempts List (with compression + pagination)

```bash
# Basic usage
GET /api/admin/exams/[examId]/attempts

# With pagination
GET /api/admin/exams/[examId]/attempts?limit=100&offset=0

# With field selection
GET /api/admin/exams/[examId]/attempts?fields=id,student_name,score_percentage
```

### 3. Paginated Questions (with compression)

```bash
# Student view (no correct answers)
GET /api/exams/[examId]/questions?offset=0&limit=5

# Admin view (with correct answers)
GET /api/exams/[examId]/questions?include_answers=true
```

## RPC Functions

### get_attempt_state_v2

```sql
SELECT * FROM get_attempt_state_v2(
  p_attempt_id := '123e4567-e89b-12d3-a456-426614174000',
  p_fields := '{"include": ["exam", "questions"]}'::jsonb
);
```

### admin_list_attempts_v2

```sql
SELECT * FROM admin_list_attempts_v2(
  p_exam_id := '123e4567-e89b-12d3-a456-426614174000',
  p_limit := 50,
  p_offset := 0,
  p_fields := NULL
);
```

### get_exam_questions_paginated

```sql
SELECT * FROM get_exam_questions_paginated(
  p_exam_id := '123e4567-e89b-12d3-a456-426614174000',
  p_offset := 0,
  p_limit := 5,
  p_exclude_correct_answers := true
);
```

## Response Headers

When compression is applied:

```
Content-Encoding: br                    # or 'gzip'
Content-Length: 1234                    # compressed size
X-Original-Size: 5678                   # original size
X-Compressed-Size: 1234                 # compressed size
X-Compression-Ratio: 78%                # compression ratio
```

## Compression Behavior

| Response Size | Client Support | Result |
|--------------|----------------|--------|
| < 1KB | Any | Uncompressed |
| > 1KB | Supports br | Brotli compressed |
| > 1KB | Supports gzip | Gzip compressed |
| > 1KB | No support | Uncompressed |

## Field Selection

### Include specific fields:
```
?fields=exam,questions
?fields={"include":["exam","questions"]}
```

### Exclude specific fields:
```
?fields={"exclude":["answers"]}
```

### Default behavior:
- No `fields` parameter = all fields included
- Empty `fields` = all fields included

## Pagination

### Query Parameters:
- `limit` - Results per page (default varies by endpoint)
- `offset` - Starting position (default: 0)

### Response Format:
```json
{
  "questions": [...],
  "pagination": {
    "total": 50,
    "offset": 0,
    "limit": 10,
    "has_more": true
  }
}
```

## Deployment

### Apply new RPC function:
```bash
node scripts/apply-questions-pagination.js
```

### Verify deployment:
```bash
# Check if RPC exists
psql -c "SELECT proname FROM pg_proc WHERE proname = 'get_exam_questions_paginated';"

# Test the function
curl -H "Accept-Encoding: gzip, br" \
  https://your-app.com/api/exams/123/questions
```

## Troubleshooting

### Response not compressed?

**Check:**
1. Response size > 1KB?
2. Client sends `Accept-Encoding` header?
3. Header includes `gzip` or `br`?

### Compression ratio low?

**Possible causes:**
1. Data already compressed (images, etc.)
2. Small response size
3. Data not compressible (random/encrypted)

### Field selection not working?

**Check:**
1. Using v2 endpoint or `?v2=true` parameter?
2. Field names spelled correctly?
3. Fields exist in the response?

## Performance Tips

1. **Always send Accept-Encoding header** for compression
2. **Use field selection** to reduce response size further
3. **Use pagination** for large datasets
4. **Combine all three** for maximum bandwidth savings

## Security Notes

- `correct_answers` automatically excluded for students
- Admin endpoints require valid JWT token
- Field selection cannot bypass security rules
- Pagination limits enforced server-side

## Related Documentation

- Full guide: `src/lib/compression-middleware.README.md`
- Compression module: `src/lib/compression.ts`
- RPC functions: `db/rpc_functions.sql`
- Paginated questions: `db/get_exam_questions_paginated.sql`
