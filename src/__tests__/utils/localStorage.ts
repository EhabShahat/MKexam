/**
 * Test utilities for localStorage mocking
 * Used for testing student code persistence and theme storage
 */

import { beforeEach, vi } from 'vitest';

/**
 * Mock localStorage implementation for testing
 */
export class MockLocalStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

/**
 * Setup localStorage mock for tests
 * Call this in beforeEach to ensure clean state
 */
export function setupLocalStorageMock(): MockLocalStorage {
  const mockStorage = new MockLocalStorage();
  
  Object.defineProperty(global, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });

  return mockStorage;
}

/**
 * Simulate localStorage being unavailable (e.g., in private browsing)
 */
export function simulateLocalStorageUnavailable(): void {
  Object.defineProperty(global, 'localStorage', {
    get() {
      throw new Error('localStorage is not available');
    },
    configurable: true,
  });
}

/**
 * Restore localStorage to normal mock
 */
export function restoreLocalStorage(): void {
  setupLocalStorageMock();
}

/**
 * Helper to get all localStorage keys
 */
export function getLocalStorageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

/**
 * Helper to get all localStorage data as object
 */
export function getLocalStorageData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }
  }
  return data;
}

/**
 * Helper to set multiple localStorage items at once
 */
export function setLocalStorageData(data: Record<string, string>): void {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
}

/**
 * Spy on localStorage methods for verification
 */
export function spyOnLocalStorage() {
  return {
    getItem: vi.spyOn(Storage.prototype, 'getItem'),
    setItem: vi.spyOn(Storage.prototype, 'setItem'),
    removeItem: vi.spyOn(Storage.prototype, 'removeItem'),
    clear: vi.spyOn(Storage.prototype, 'clear'),
  };
}
