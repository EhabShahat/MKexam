import '@testing-library/jest-dom';
import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupLocalStorageMock } from './src/__tests__/utils/localStorage';

// Setup localStorage mock before each test
beforeEach(() => {
  setupLocalStorageMock();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client
vi.mock('./src/lib/supabase/client', () => ({
  supabaseClient: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.com/file' } })),
      })),
    },
  },
}));

// Mock security functions for faster tests
vi.mock('./src/lib/security', () => ({
  encryptData: vi.fn().mockImplementation(async (data: string) => {
    // Simple mock that just returns the data (no actual encryption in tests)
    return `encrypted_${data}`;
  }),
  decryptData: vi.fn().mockImplementation(async (encryptedData: string) => {
    // Simple mock that reverses the encryption
    if (encryptedData.startsWith('encrypted_')) {
      return encryptedData.replace('encrypted_', '');
    }
    return encryptedData;
  }),
  secureClear: vi.fn().mockImplementation(() => {
    // No-op in tests
  }),
  hashValue: vi.fn().mockImplementation(async (value: string) => {
    // Simple hash mock that doesn't contain the original value
    const hash = Math.abs(value.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0)).toString(16);
    return `hash_${hash}`;
  }),
  generateSecureToken: vi.fn().mockImplementation((length: number = 32) => {
    return 'mock_token_' + Math.random().toString(36).substring(2, length);
  }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
