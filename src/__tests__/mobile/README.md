# Mobile Optimization Tests

This directory contains tests for mobile-specific features and optimizations.

## Test Structure

- `setup.ts` - Test utilities and mock functions for mobile testing
- Unit tests for individual hooks and components
- Property-based tests for correctness properties

## Running Tests

```bash
# Run all mobile tests
npm test -- mobile

# Run specific test file
npm test -- deviceDetection.test.ts

# Run with coverage
npm test -- --coverage mobile
```

## Test Utilities

The `setup.ts` file provides utilities for mocking mobile environments:

- `mockWindowDimensions(width, height)` - Mock viewport size
- `mockTouchCapability(hasTouch)` - Mock touch support
- `mockSafeAreaInsets(top, right, bottom, left)` - Mock safe area insets
- `mockVisualViewport(height, offsetTop)` - Mock Visual Viewport API
- `mockVibrationAPI(supported)` - Mock vibration API
- `triggerResize(width, height)` - Simulate window resize
- `triggerOrientationChange()` - Simulate orientation change
- `createTouchEvent(type, touches)` - Create mock touch events
- `resetMobileMocks()` - Reset all mocks to defaults

## Writing Tests

When writing mobile tests:

1. Import test utilities from `./setup`
2. Reset mocks in `beforeEach` or `afterEach`
3. Use appropriate mocks for the feature being tested
4. Test both mobile and desktop scenarios
5. Test edge cases (small screens, notched devices, etc.)
