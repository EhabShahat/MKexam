/**
 * Tests for localStorage test utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setupLocalStorageMock,
  simulateLocalStorageUnavailable,
  restoreLocalStorage,
  getLocalStorageKeys,
  getLocalStorageData,
  setLocalStorageData,
} from './localStorage';

describe('localStorage test utilities', () => {
  beforeEach(() => {
    setupLocalStorageMock();
  });

  describe('setupLocalStorageMock', () => {
    it('should create a working localStorage mock', () => {
      localStorage.setItem('test', 'value');
      expect(localStorage.getItem('test')).toBe('value');
    });

    it('should support all localStorage methods', () => {
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');
      
      expect(localStorage.length).toBe(2);
      expect(localStorage.key(0)).toBeTruthy();
      
      localStorage.removeItem('key1');
      expect(localStorage.getItem('key1')).toBeNull();
      expect(localStorage.length).toBe(1);
      
      localStorage.clear();
      expect(localStorage.length).toBe(0);
    });
  });

  describe('simulateLocalStorageUnavailable', () => {
    it('should throw error when accessing localStorage', () => {
      simulateLocalStorageUnavailable();
      
      expect(() => {
        localStorage.setItem('test', 'value');
      }).toThrow('localStorage is not available');
    });
  });

  describe('restoreLocalStorage', () => {
    it('should restore localStorage after simulating unavailable', () => {
      simulateLocalStorageUnavailable();
      restoreLocalStorage();
      
      expect(() => {
        localStorage.setItem('test', 'value');
      }).not.toThrow();
      
      expect(localStorage.getItem('test')).toBe('value');
    });
  });

  describe('getLocalStorageKeys', () => {
    it('should return all keys', () => {
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');
      localStorage.setItem('key3', 'value3');
      
      const keys = getLocalStorageKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return empty array when localStorage is empty', () => {
      const keys = getLocalStorageKeys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('getLocalStorageData', () => {
    it('should return all data as object', () => {
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');
      
      const data = getLocalStorageData();
      expect(data).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should return empty object when localStorage is empty', () => {
      const data = getLocalStorageData();
      expect(data).toEqual({});
    });
  });

  describe('setLocalStorageData', () => {
    it('should set multiple items at once', () => {
      setLocalStorageData({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
      
      expect(localStorage.getItem('key1')).toBe('value1');
      expect(localStorage.getItem('key2')).toBe('value2');
      expect(localStorage.getItem('key3')).toBe('value3');
    });
  });
});
