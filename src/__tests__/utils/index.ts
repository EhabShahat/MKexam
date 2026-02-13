/**
 * Test utilities for student-experience-and-admin-enhancements spec
 * 
 * This module exports utilities for:
 * - localStorage mocking and testing
 * - User agent generation and device testing
 * - Accessibility compliance testing
 */

// localStorage utilities
export {
  MockLocalStorage,
  setupLocalStorageMock,
  simulateLocalStorageUnavailable,
  restoreLocalStorage,
  getLocalStorageKeys,
  getLocalStorageData,
  setLocalStorageData,
  spyOnLocalStorage,
} from './localStorage';

// User agent utilities
export {
  USER_AGENTS,
  EXPECTED_DEVICE_INFO,
  mockUserAgent,
  restoreUserAgent,
  generateRandomUserAgent,
  generateUserAgentByType,
  createMockRequest,
  getMobileUserAgents,
  getTabletUserAgents,
  getDesktopUserAgents,
  getEdgeCaseUserAgents,
} from './userAgent';

export type { DeviceType } from './userAgent';

// Accessibility utilities
export {
  CONTRAST_RATIOS,
  getRelativeLuminance,
  getContrastRatio,
  hexToRgb,
  meetsContrastRequirement,
  hasAccessibleName,
  hasAccessibleDescription,
  isKeyboardAccessible,
  hasProperRole,
  hasFocusIndicator,
  hasAltText,
  hasAssociatedLabel,
  isProperlyHidden,
  a11yHelpers,
  runBasicA11yChecks,
  testKeyboardNavigation,
} from './accessibility';
