# JSONB Optimizer Module

This module provides utilities to optimize JSONB field storage and transfer, reducing Supabase egress bandwidth and storage costs.

## Features

### 1. Compact JSON Encoding
Removes unnecessary whitespace from JSON data before storage.

```typescript
import { compactAnswers, toCompactJSON } from '@/lib/jsonb-optimizer';

const answers = { q1: 'answer', q2: ['a', 'b'] };
const compact = compactAnswers(answers);
const json = toCompactJSON(compact); // No whitespace
```

**Savings:** ~30-40% reduction in size for formatted JSON

### 2. IP Deduplication
Removes duplicate IP addresses from device_info structures.

```typescript
import { deduplicateDeviceInfo } from '@/lib/jsonb-optimizer';

const deviceInfo = {
  fingerprint: 'abc123',
  allIPs: {
    local: ['192.168.1.1', '192.168.1.1', '10.0.0.1'],
    public: ['1.2.3.4', '1.2.3.4']
  }
};

const deduplicated = deduplicateDeviceInfo(deviceInfo);
// Result: local: ['192.168.1.1', '10.0.0.1'], public: ['1.2.3.4']
```

**Savings:** Varies based on duplication, typically 20-50% for IP arrays

### 3. Answer Deltas
Creates incremental updates containing only changed answers.

```typescript
import { createAnswerDelta, applyAnswerDelta } from '@/lib/jsonb-optimizer';

const oldAnswers = { q1: 'a', q2: 'b', q3: 'c' };
const newAnswers = { q1: 'a', q2: 'x', q4: 'd' }; // q2 changed, q3 removed, q4 added

const delta = createAnswerDelta(oldAnswers, newAnswers, 2);
// Result: { changed: { q2: 'x', q4: 'd' }, removed: ['q3'], version: 2, timestamp: ... }

// Later, reconstruct full answers
const reconstructed = applyAnswerDelta(oldAnswers, delta);
// Result: { q1: 'a', q2: 'x', q4: 'd' }
```

**Savings:** 60-90% reduction for auto-save operations (only changed answers transferred)

### 4. Integer Timestamps
Converts ISO 8601 timestamps to Unix timestamps (integers).

```typescript
import { convertToIntegerTimestamp, convertFromIntegerTimestamp } from '@/lib/jsonb-optimizer';

const iso = '2024-01-15T10:30:00.000Z';
const unix = convertToIntegerTimestamp(iso); // 1705314600

const backToISO = convertFromIntegerTimestamp(unix); // '2024-01-15T10:30:00.000Z'
```

**Savings:** ~60% reduction (24 bytes → 10 bytes)

### 5. Progress Data Optimization
Optimizes progress_data by converting timestamps to integers.

```typescript
import { optimizeProgressData } from '@/lib/jsonb-optimizer';

const progress = {
  started_at: '2024-01-15T10:30:00.000Z',
  completed_at: '2024-01-15T11:30:00.000Z',
  watch_percentage: 95
};

const optimized = optimizeProgressData(progress);
// Result: { started_at: 1705314600, completed_at: 1705318200, watch_percentage: 95 }
```

**Savings:** ~25% reduction for progress data objects

## Database Functions

### save_attempt_v2
Enhanced version of save_attempt with answer delta support.

```sql
-- Full update (backward compatible)
SELECT * FROM save_attempt_v2(
  p_attempt_id := '...',
  p_answers := '{"q1": "answer"}',
  p_auto_save_data := '{}',
  p_expected_version := 1,
  p_is_delta := false
);

-- Delta update (optimized)
SELECT * FROM save_attempt_v2(
  p_attempt_id := '...',
  p_answers := '{"changed": {"q2": "new"}, "removed": ["q3"]}',
  p_auto_save_data := '{}',
  p_expected_version := 1,
  p_is_delta := true
);
```

### start_attempt_v3
Enhanced version of start_attempt with device_info optimization.

```sql
SELECT * FROM start_attempt_v3(
  p_exam_id := '...',
  p_code := 'ABC123',
  p_student_name := 'John Doe',
  p_ip := '192.168.1.1',
  p_device_info := '{"fingerprint": "...", "allIPs": {"local": [...], "public": [...]}}'
);
```

The function automatically deduplicates IP arrays before storage.

## Usage in Frontend

### Auto-save with Deltas

```typescript
import { createAnswerDelta } from '@/lib/jsonb-optimizer';

// In your auto-save logic
const currentAnswers = getCurrentAnswers();
const previousAnswers = getPreviousAnswers();

const delta = createAnswerDelta(previousAnswers, currentAnswers, version);

// Call save_attempt_v2 with delta
const { data } = await supabase.rpc('save_attempt_v2', {
  p_attempt_id: attemptId,
  p_answers: delta,
  p_auto_save_data: autoSaveData,
  p_expected_version: version,
  p_is_delta: true
});
```

### Start Attempt with Optimized Device Info

```typescript
import { deduplicateDeviceInfo } from '@/lib/jsonb-optimizer';
import { collectDetailedDeviceInfo } from '@/lib/collectDeviceInfo';

// Collect device info
const deviceInfo = await collectDetailedDeviceInfo();

// Optimize before sending
const optimized = deduplicateDeviceInfo(deviceInfo);

// Start attempt
const { data } = await supabase.rpc('start_attempt_v3', {
  p_exam_id: examId,
  p_code: code,
  p_student_name: name,
  p_ip: ipAddress,
  p_device_info: optimized
});
```

## Testing

Run the test script to verify functionality:

```bash
node scripts/test-jsonb-optimizer.js
```

## Deployment

Apply the database functions:

```bash
node scripts/apply-jsonb-optimization.js
```

## Performance Impact

Based on typical exam data:

| Optimization | Typical Savings | Use Case |
|--------------|----------------|----------|
| Compact JSON | 30-40% | All JSONB fields |
| IP Deduplication | 20-50% | device_info with multiple IPs |
| Answer Deltas | 60-90% | Auto-save operations |
| Integer Timestamps | 60% | All timestamp fields |
| Progress Data | 25% | Stage progress tracking |

**Overall Impact:**
- **Supabase Egress:** 40-60% reduction for auto-save operations
- **Storage:** 20-30% reduction for JSONB fields
- **Network Transfer:** Faster auto-save with smaller payloads

## Requirements Satisfied

- **Requirement 5.1:** Compact JSON encoding without whitespace
- **Requirement 5.2:** IP deduplication in device_info
- **Requirement 5.3:** Incremental answer updates via deltas
- **Requirement 5.6:** Integer timestamps instead of ISO strings
- **Requirement 1.5:** Device_info compression before storage
- **Requirement 1.6:** Auto-save using incremental updates
- **Requirement 10.5:** Backward compatibility with full answers

## Backward Compatibility

All optimizations maintain backward compatibility:

- `save_attempt_v2` accepts both full answers and deltas (controlled by `p_is_delta` flag)
- `start_attempt_v3` works with or without device_info
- Original `save_attempt` and `start_attempt` functions remain unchanged
- Existing code continues to work without modifications

## Migration Strategy

1. Deploy database functions (save_attempt_v2, start_attempt_v3)
2. Update frontend to use new functions with optimization
3. Monitor performance metrics
4. Gradually migrate all auto-save operations to delta mode
5. After 30 days, deprecate old functions (optional)
