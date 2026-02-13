# Testing Infrastructure

This directory contains the test infrastructure for the Advanced Exam Application.

## Test Framework

We use **Vitest** as our test framework, which provides:
- Fast test execution with native ESM support
- Compatible with Jest API
- Built-in TypeScript support
- UI mode for interactive testing
- Coverage reporting

## Test Structure

Tests are co-located with the code they test:

```
src/
├── lib/
│   ├── performance.ts
│   └── __tests__/
│       └── performance.test.ts
├── hooks/
│   ├── useWebVitals.ts
│   └── __tests__/
│       └── useWebVitals.test.ts
└── components/
    ├── PerformanceMonitor.tsx
    └── __tests__/
        └── PerformanceMonitor.test.tsx
```

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Types

### Unit Tests

Unit tests verify specific functionality with concrete examples:

```typescript
import { describe, it, expect } from 'vitest';
import { formatBytes } from '../performance';

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
  });
});
```

### Property-Based Tests

Property-based tests verify universal properties across randomized inputs using `fast-check`:

```typescript
import fc from 'fast-check';

test('property: all positive numbers format correctly', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1000000000 }),
      (bytes) => {
        const formatted = formatBytes(bytes);
        expect(formatted).toMatch(/^\d+(\.\d+)? (Bytes|KB|MB|GB)$/);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

## Writing Tests

### Best Practices

1. **Descriptive test names**: Use clear, descriptive names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Test one thing**: Each test should verify a single behavior
4. **Use meaningful assertions**: Choose assertions that clearly express intent
5. **Mock external dependencies**: Mock API calls, timers, and browser APIs

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  describe('feature group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## Mocking

### Mocking Modules

```typescript
vi.mock('@/lib/supabase/client', () => ({
  supabaseClient: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
}));
```

### Mocking Browser APIs

Common browser API mocks are set up in `vitest.setup.ts`:
- `window.matchMedia`
- `IntersectionObserver`
- `ResizeObserver`
- Next.js router

## Coverage

Coverage reports are generated in the `coverage/` directory:

```bash
npm run test:coverage
```

Coverage thresholds can be configured in `vitest.config.ts`.

## Debugging Tests

### Using Vitest UI

```bash
npm run test:ui
```

This opens an interactive UI where you can:
- See test results in real-time
- Filter and search tests
- View test execution time
- Debug failing tests

### Using VS Code

Add breakpoints in your test files and use the VS Code debugger with the Vitest extension.

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment checks

See `.github/workflows/ci.yml` for CI configuration.

## Property-Based Testing Guidelines

When writing property-based tests:

1. **Define clear properties**: Properties should be universal truths about your code
2. **Use appropriate generators**: Choose generators that match your input domain
3. **Run enough iterations**: Default is 100, increase for critical code
4. **Handle edge cases**: Ensure generators include boundary values
5. **Document properties**: Link properties to requirements in comments

Example:

```typescript
/**
 * Feature: performance-optimization-and-backend-fixes
 * Property 1: All byte values format to valid strings
 * Validates: Requirements 6.1, 6.2
 */
test('property: byte formatting', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
      (bytes) => {
        const result = formatBytes(bytes);
        expect(result).toMatch(/^\d+(\.\d+)? (Bytes|KB|MB|GB)$/);
      }
    ),
    { numRuns: 100 }
  );
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [fast-check Documentation](https://fast-check.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
