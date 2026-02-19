# Cache Security Implementation

This document describes the security measures implemented for the caching layer as part of the Supabase & Netlify Cost Optimization project.

## Overview

Three key security features have been implemented to ensure cached data is protected:

1. **Cache Encryption** - Sensitive data (student answers) encrypted at rest using AES-256-GCM
2. **Cache Isolation** - Admin and student caches separated using namespaces
3. **Audit Log TTL Limits** - Strict 1-minute maximum TTL for audit log cache entries

## 1. Cache Encryption (Requirement 11.1)

### Implementation

**Module**: `src/lib/cacheEncryption.ts`

Uses Node.js crypto module with AES-256-GCM authenticated encryption:
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: scrypt with random salt
- **IV**: Random 128-bit initialization vector per encryption
- **Authentication**: 128-bit authentication tag for integrity verification

### Encrypted Data Structure

```typescript
interface EncryptedData {
  encrypted: string;  // Base64 encoded ciphertext
  iv: string;         // Base64 encoded IV
  authTag: string;    // Base64 encoded auth tag
  salt: string;       // Base64 encoded salt
}
```

### Automatic Encryption

Data is automatically encrypted based on cache key patterns:
- `attempt:state:*` - Exam attempt state with student answers
- `student:answers:*` - Student answer data
- `attempt:answers:*` - Attempt-specific answers

### Usage

```typescript
import { caches } from '@/lib/cache';

// Automatically encrypted when stored
caches.student.set('attempt:state:123', {
  studentId: '123',
  answers: { q1: 'answer1', q2: 'answer2' }
});

// Automatically decrypted when retrieved
const state = caches.student.get('attempt:state:123');
```

### Configuration

Set the encryption key via environment variable:
```bash
CACHE_ENCRYPTION_KEY=your-secure-key-here
```

**Important**: In production, use a secure key management system (e.g., AWS KMS, Azure Key Vault).

## 2. Cache Isolation (Requirement 11.2)

### Implementation

**Module**: `src/lib/cache.ts` (CacheLayer class)

Each cache instance has a namespace that prefixes all keys:
- Admin cache: `admin:*`
- Student cache: `student:*`
- Exam cache: `exam:*`
- Questions cache: `questions:*`
- Config cache: `config:*`
- Audit log cache: `audit:*`

### Namespace Isolation

```typescript
// Create isolated cache instances
const adminCache = new CacheLayer({ 
  namespace: 'admin',
  defaultTTL: 300000 
});

const studentCache = new CacheLayer({ 
  namespace: 'student',
  defaultTTL: 600000 
});

// Same key, different namespaces - completely isolated
adminCache.set('data:123', 'admin-value');
studentCache.set('data:123', 'student-value');

adminCache.get('data:123');   // Returns 'admin-value'
studentCache.get('data:123'); // Returns 'student-value'
```

### Global Cache Instances

Pre-configured isolated cache instances:

```typescript
import { caches } from '@/lib/cache';

// Admin-specific cache (isolated)
caches.admin.set('key', 'value');

// Student-specific cache (isolated)
caches.student.set('key', 'value');

// Audit log cache (isolated, 1-minute TTL)
caches.auditLog.set('key', 'value');
```

### Benefits

- **Security**: Admin data cannot be accessed from student cache
- **Separation of Concerns**: Different cache policies per namespace
- **Independent Statistics**: Each namespace tracks its own hit/miss rates
- **Selective Clearing**: Clear cache by namespace without affecting others

## 3. Audit Log TTL Limits (Requirement 11.7)

### Implementation

**Module**: `src/lib/cache.ts` (CacheLayer.set method)

Strict TTL enforcement for audit log cache entries:
- **Maximum TTL**: 60,000ms (1 minute)
- **Enforcement**: Automatic - any longer TTL is reduced to 1 minute
- **Compliance**: Ensures audit logs are not cached beyond compliance requirements

### Audit Log Key Patterns

The following patterns trigger TTL enforcement:
- `audit:*`
- `audit-log:*`
- `auditlog:*`
- `*:audit`
- `*audit-logs*`

### Usage

```typescript
import { caches } from '@/lib/cache';

// Attempt to cache for 10 minutes - automatically limited to 1 minute
caches.auditLog.set('audit:login:123', {
  action: 'login',
  user: 'admin',
  timestamp: Date.now()
}, 600000); // Requested 10 minutes

// Actual TTL will be 60,000ms (1 minute)
```

### Warning Logs

When TTL is enforced, a warning is logged:
```
Audit log cache TTL limited to 60000ms for compliance. Requested: 600000ms
```

## Security Best Practices

### 1. Encryption Key Management

**Development**:
```bash
# .env.local
CACHE_ENCRYPTION_KEY=dev-key-not-for-production
```

**Production**:
- Use environment variables from secure vault
- Rotate keys periodically
- Never commit keys to version control

### 2. Cache Key Naming

Follow consistent patterns for automatic security:
```typescript
// Sensitive data - will be encrypted
'attempt:state:${attemptId}'
'student:answers:${studentId}'

// Public data - not encrypted
'exam:meta:${examId}'
'config:${key}'

// Audit logs - 1-minute TTL enforced
'audit:${action}:${id}'
```

### 3. Namespace Usage

Use appropriate cache instances:
```typescript
// Admin operations
caches.admin.set('admin-data', value);

// Student operations
caches.student.set('student-data', value);

// Audit logging
caches.auditLog.set('audit:action', value);
```

## Testing

### Unit Tests

**Encryption Tests**: `src/lib/__tests__/cacheEncryption.test.ts`
- Encryption/decryption round-trip
- Data integrity verification
- Error handling for corrupted data
- Pattern-based encryption detection

**Security Tests**: `src/lib/__tests__/cacheSecurity.test.ts`
- Namespace isolation verification
- TTL enforcement for audit logs
- Encryption integration
- Cross-namespace security

### Running Tests

```bash
# Run all cache security tests
npm run test:run -- src/lib/__tests__/cacheSecurity.test.ts

# Run encryption tests
npm run test:run -- src/lib/__tests__/cacheEncryption.test.ts

# Run all cache tests
npm run test:run -- src/lib/__tests__/cache.test.ts
```

## Performance Impact

### Encryption Overhead

- **Encryption**: ~0.5-2ms per operation (depends on data size)
- **Decryption**: ~0.5-2ms per operation
- **Impact**: Minimal for typical cache operations
- **Mitigation**: Only sensitive data is encrypted

### Namespace Overhead

- **Key Prefixing**: Negligible (<0.1ms)
- **Memory**: ~10-20 bytes per key for namespace prefix
- **Impact**: Minimal

### TTL Enforcement

- **Pattern Matching**: ~0.1ms per set operation
- **Impact**: Negligible

## Monitoring

### Cache Statistics

```typescript
import { caches } from '@/lib/cache';

// Get statistics per namespace
const adminStats = caches.admin.getStats();
console.log('Admin cache hit rate:', adminStats.hitRate);

const studentStats = caches.student.getStats();
console.log('Student cache hit rate:', studentStats.hitRate);
```

### Encryption Monitoring

Monitor console logs for:
- Encryption failures: `Cache encryption failed for key ${key}`
- Decryption failures: `Cache decryption failed for key ${key}`
- TTL enforcement: `Audit log cache TTL limited to 60000ms`

## Compliance

### Data Protection

- **Encryption at Rest**: Student answers encrypted in cache (Requirement 11.1)
- **Access Control**: Namespace isolation prevents unauthorized access (Requirement 11.2)
- **Data Retention**: Audit logs limited to 1-minute cache (Requirement 11.7)

### Audit Trail

All cache security events are logged:
- Encryption failures
- Decryption failures
- TTL enforcement actions
- Corrupted data removal

## Troubleshooting

### Encryption Errors

**Problem**: `Cache encryption failed`
**Solution**: Check CACHE_ENCRYPTION_KEY environment variable

**Problem**: `Cache decryption failed`
**Solution**: Corrupted cache entry - automatically removed and refetched

### Namespace Issues

**Problem**: Data not found in cache
**Solution**: Verify correct cache instance is being used (admin vs student)

**Problem**: Cache not clearing
**Solution**: Use correct namespace when clearing: `caches.admin.clear()`

### TTL Issues

**Problem**: Audit logs cached too long
**Solution**: Automatic - TTL is enforced to 1 minute maximum

## Migration Guide

### Existing Code

No changes required for existing code. The security features are:
- **Backward Compatible**: Existing cache usage continues to work
- **Automatic**: Encryption and TTL enforcement happen automatically
- **Transparent**: Decryption is automatic on retrieval

### New Code

Use the appropriate cache instance:

```typescript
import { caches } from '@/lib/cache';

// For admin operations
caches.admin.set('key', value);

// For student operations
caches.student.set('key', value);

// For audit logs
caches.auditLog.set('audit:action', value);
```

## References

- **Requirements**: `.kiro/specs/supabase-netlify-optimization/requirements.md`
  - Requirement 11.1: Cache encryption for student answers
  - Requirement 11.2: Admin/student cache isolation
  - Requirement 11.7: Audit log cache TTL limits

- **Design**: `.kiro/specs/supabase-netlify-optimization/design.md`
  - Section: Caching Layer
  - Section: Security Considerations

- **Implementation**: 
  - `src/lib/cacheEncryption.ts` - Encryption module
  - `src/lib/cache.ts` - Cache layer with security features
