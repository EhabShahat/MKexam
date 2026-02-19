# Compression Middleware

This module provides response compression for API routes to reduce bandwidth usage and improve performance.

## Features

- **Automatic compression** for responses > 1KB
- **Client detection** via Accept-Encoding header
- **Multiple encodings** (brotli preferred, gzip fallback)
- **Compression metadata** in response headers
- **Graceful fallback** if compression fails

## Requirements

Implements requirements:
- 1.1: Compress RPC function responses using gzip or brotli
- 14.1: Compress responses larger than 1KB
- 14.5: Detect client Accept-Encoding support

## Usage

### Basic Usage

```typescript
import { compressResponse } from '@/lib/compression-middleware';

export async function GET(req: NextRequest) {
  const data = { /* your response data */ };
  const acceptEncoding = req.headers.get('accept-encoding');
  
  // Automatically compress if size > 1KB and client supports it
  return await compressResponse(data, acceptEncoding);
}
```

### With Custom Threshold

```typescript
import { compressResponse } from '@/lib/compression-middleware';

export async function GET(req: NextRequest) {
  const data = { /* your response data */ };
  const acceptEncoding = req.headers.get('accept-encoding');
  
  // Use custom threshold (2KB instead of default 1KB)
  return await compressResponse(data, acceptEncoding, { threshold: 2048 });
}
```

### With Custom Compression Level

```typescript
import { compressResponse } from '@/lib/compression-middleware';

export async function GET(req: NextRequest) {
  const data = { /* your response data */ };
  const acceptEncoding = req.headers.get('accept-encoding');
  
  // Use maximum compression (level 9 for gzip, 11 for brotli)
  return await compressResponse(data, acceptEncoding, { level: 9 });
}
```

## API Routes with Compression

### 1. Attempt State (get_attempt_state_v2)

**Endpoint:** `GET /api/attempts/[attemptId]/state`

**Query Parameters:**
- `v2=true` - Use v2 RPC with field selection
- `fields` - Comma-separated list or JSON object for field selection

**Example:**
```bash
# Get full state with compression
curl -H "Accept-Encoding: gzip, br" \
  https://your-app.com/api/attempts/123/state

# Get only exam and questions with compression
curl -H "Accept-Encoding: gzip, br" \
  "https://your-app.com/api/attempts/123/state?v2=true&fields=exam,questions"
```

### 2. Admin Attempts List (admin_list_attempts_v2)

**Endpoint:** `GET /api/admin/exams/[examId]/attempts`

**Query Parameters:**
- `v2=true` - Use v2 RPC with pagination
- `limit` - Number of results per page (default: 50, max: 1000)
- `offset` - Offset for pagination (default: 0)
- `fields` - Field selection (optional)

**Example:**
```bash
# Get first 50 attempts with compression
curl -H "Accept-Encoding: gzip, br" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.com/api/admin/exams/123/attempts

# Get paginated results with compression
curl -H "Accept-Encoding: gzip, br" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-app.com/api/admin/exams/123/attempts?limit=100&offset=0"
```

### 3. Paginated Questions (get_exam_questions_paginated)

**Endpoint:** `GET /api/exams/[examId]/questions`

**Query Parameters:**
- `offset` - Offset for pagination (default: 0)
- `limit` - Number of questions per page (default: 5, max: 100)
- `include_answers` - Include correct_answers (admin only, default: false)

**Example:**
```bash
# Get first 5 questions with compression (student view)
curl -H "Accept-Encoding: gzip, br" \
  https://your-app.com/api/exams/123/questions

# Get next 10 questions with compression
curl -H "Accept-Encoding: gzip, br" \
  "https://your-app.com/api/exams/123/questions?offset=5&limit=10"

# Get questions with answers (admin only)
curl -H "Accept-Encoding: gzip, br" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-app.com/api/exams/123/questions?include_answers=true"
```

## Response Headers

When compression is applied, the following headers are added:

- `Content-Encoding`: `gzip` or `br` (brotli)
- `Content-Length`: Size of compressed data
- `X-Original-Size`: Original uncompressed size in bytes
- `X-Compressed-Size`: Compressed size in bytes
- `X-Compression-Ratio`: Compression ratio as percentage

**Example Response Headers:**
```
Content-Type: application/json
Content-Encoding: br
Content-Length: 1234
X-Original-Size: 5678
X-Compressed-Size: 1234
X-Compression-Ratio: 78%
```

## Client Support Detection

The middleware automatically detects client compression support:

1. **Brotli (br)** - Preferred for better compression
2. **Gzip** - Fallback for older clients
3. **None** - Returns uncompressed if client doesn't support compression

**Accept-Encoding Examples:**
```
Accept-Encoding: gzip, deflate, br          → Uses brotli
Accept-Encoding: gzip, deflate              → Uses gzip
Accept-Encoding: identity                   → No compression
(no header)                                 → No compression
```

## Compression Thresholds

- **Minimum size:** 1KB (1024 bytes)
- **Reason:** Small responses have negligible compression benefit and add overhead
- **Customizable:** Can be adjusted per route if needed

## Performance Impact

### Bandwidth Savings
- **JSON data:** 60-80% compression ratio typical
- **Large responses:** Greater savings with more data
- **Small responses:** Minimal benefit, skipped automatically

### CPU Impact
- **Compression:** Minimal CPU overhead (< 10ms for typical responses)
- **Decompression:** Handled by client browser automatically
- **Net benefit:** Reduced bandwidth >> CPU cost

## Error Handling

The middleware handles errors gracefully:

1. **Compression fails** → Returns uncompressed response
2. **Invalid encoding** → Returns uncompressed response
3. **Client doesn't support** → Returns uncompressed response

No errors are thrown to the client; compression is always optional.

## Testing

### Manual Testing

```bash
# Test with compression
curl -v -H "Accept-Encoding: gzip, br" \
  https://your-app.com/api/attempts/123/state

# Test without compression
curl -v https://your-app.com/api/attempts/123/state

# Compare sizes
curl -H "Accept-Encoding: gzip" \
  https://your-app.com/api/attempts/123/state \
  --output compressed.json.gz

curl https://your-app.com/api/attempts/123/state \
  --output uncompressed.json

ls -lh compressed.json.gz uncompressed.json
```

### Automated Testing

See `src/lib/__tests__/compression.test.ts` for unit tests.

## Migration Guide

### Updating Existing Routes

**Before:**
```typescript
export async function GET(req: NextRequest) {
  const data = await fetchData();
  return NextResponse.json(data);
}
```

**After:**
```typescript
import { compressResponse } from '@/lib/compression-middleware';

export async function GET(req: NextRequest) {
  const data = await fetchData();
  const acceptEncoding = req.headers.get('accept-encoding');
  return await compressResponse(data, acceptEncoding);
}
```

### Backward Compatibility

All routes maintain backward compatibility:
- Clients without Accept-Encoding header receive uncompressed responses
- Existing API contracts unchanged
- No breaking changes to response format

## Best Practices

1. **Always check Accept-Encoding** - Don't force compression on clients that don't support it
2. **Use default threshold** - 1KB is optimal for most cases
3. **Monitor compression ratios** - Check X-Compression-Ratio header in production
4. **Test with real data** - Compression effectiveness varies by data type
5. **Consider caching** - Compress once, cache compressed version

## Related Modules

- `src/lib/compression.ts` - Core compression utilities
- `src/lib/__tests__/compression.test.ts` - Compression tests
- `db/get_exam_questions_paginated.sql` - Paginated questions RPC
- `db/rpc_functions.sql` - Enhanced RPC functions with field selection

## Troubleshooting

### Response not compressed

**Check:**
1. Response size > 1KB?
2. Client sends Accept-Encoding header?
3. Compression encoding supported (gzip/br)?

### Compression ratio low

**Possible causes:**
1. Data already compressed (images, etc.)
2. Small response size
3. Data not compressible (random/encrypted)

### Client can't decompress

**Check:**
1. Content-Encoding header matches actual encoding
2. Client supports the encoding used
3. Response not corrupted in transit
