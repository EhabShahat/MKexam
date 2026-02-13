/**
 * Integration Tests: All Features
 * 
 * Tests the integration of all three features:
 * - Code persistence with existing auth
 * - Device display with existing results queries
 * - Theme with existing components
 * 
 * Validates: Requirements 4.1, 4.3, 4.8
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { storeCode, clearCode, getStoredCode } from '@/hooks/useStudentCode';
import { parseUserAgent, formatDeviceInfo } from '@/lib/userAgent';
import { ThemeToggle } from '@/components/ThemeToggle';
import ClearCodeButton from '@/components/ClearCodeButton';
import DeviceInfoCell from '@/components/admin/DeviceInfoCell';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({
    locale: 'en' as const,
  }),
}));

describe('Integration Tests: All Features', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    vi.clearAllMocks();
  });

  describe('Code Persistence with Existing Auth', () => {
    it('should not interfere with existing authentication flow', () => {
      const testCode = 'AUTH123';
      const studentId = 'student-456';

      // Store code (simulating successful authentication)
      storeCode(testCode, studentId);

      // Verify code is stored
      const stored = getStoredCode();
      expect(stored).not.toBeNull();
      expect(stored?.code).toBe(testCode);
      expect(stored?.studentId).toBe(studentId);

      // Authentication data should be separate from code persistence
      // Code persistence only stores code, timestamp, and optional studentId
      expect(Object.keys(stored!)).toEqual(
        expect.arrayContaining(['code', 'timestamp'])
      );
    });

    it('should work alongside session storage', () => {
      const testCode = 'SESSION123';

      // Store code in localStorage
      storeCode(testCode);

      // Simulate session storage usage (common in auth)
      sessionStorage.setItem('auth_token', 'fake-token');

      // Both should coexist
      expect(getStoredCode()?.code).toBe(testCode);
      expect(sessionStorage.getItem('auth_token')).toBe('fake-token');

      // Clearing code should not affect session storage
      clearCode();
      expect(getStoredCode()).toBeNull();
      expect(sessionStorage.getItem('auth_token')).toBe('fake-token');

      // Cleanup
      sessionStorage.clear();
    });

    it('should handle authentication errors without breaking code persistence', () => {
      const testCode = 'ERROR123';

      // Store code
      storeCode(testCode);

      // Simulate authentication error (code remains stored)
      const stored = getStoredCode();
      expect(stored?.code).toBe(testCode);

      // Code can be cleared independently
      clearCode();
      expect(getStoredCode()).toBeNull();
    });
  });

  describe('Device Display with Existing Results Queries', () => {
    it('should parse and display device information correctly', () => {
      const userAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ];

      userAgents.forEach((ua) => {
        const deviceInfo = parseUserAgent(ua);

        expect(deviceInfo).toBeTruthy();
        expect(deviceInfo.type).toBeTruthy();
        expect(deviceInfo.manufacturer).toBeTruthy();
        expect(deviceInfo.model).toBeTruthy();
        expect(deviceInfo.raw).toBe(ua);
      });
    });

    it('should format device info with usage count', () => {
      const deviceInfo = {
        type: 'mobile' as const,
        manufacturer: 'Apple',
        model: 'iPhone 14 Pro',
        raw: 'test',
      };

      const formatted1 = formatDeviceInfo(deviceInfo);
      expect(formatted1).toContain('iPhone 14 Pro');

      const formatted2 = formatDeviceInfo(deviceInfo, 3);
      expect(formatted2).toContain('iPhone 14 Pro');
      expect(formatted2).toContain('(3)');
    });

    it('should render device info cell with all data', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        manufacturer: 'Samsung',
        model: 'Galaxy S21',
        raw: 'test',
      });

      const { container } = render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="192.168.1.100"
          usageCount={2}
        />
      );

      const text = container.textContent;
      expect(text).toContain('Galaxy S21');
      expect(text).toContain('192.168.1.100');
    });

    it('should handle missing device info gracefully', () => {
      const { container } = render(
        <DeviceInfoCell
          deviceInfo={null}
          ipAddress="192.168.1.100"
          usageCount={1}
        />
      );

      const text = container.textContent;
      expect(text).toContain('Unknown Device');
      expect(text).toContain('192.168.1.100');
    });

    it('should handle malformed device info JSON', () => {
      const { container } = render(
        <DeviceInfoCell
          deviceInfo="invalid json"
          ipAddress="192.168.1.100"
          usageCount={1}
        />
      );

      const text = container.textContent;
      expect(text).toContain('Unknown Device');
    });
  });

  describe('Theme with Existing Components', () => {
    it('should render ThemeToggle without breaking existing components', () => {
      vi.doMock('@/hooks/useTheme', () => ({
        useTheme: () => ({
          theme: 'light',
          toggleTheme: vi.fn(),
        }),
      }));

      const { container } = render(<ThemeToggle />);
      const button = container.querySelector('button');

      expect(button).toBeTruthy();
      expect(button?.className).toContain('btn');
    });

    it('should render ClearCodeButton without breaking existing components', () => {
      // Store code first so button renders
      storeCode('1234');

      const { container } = render(<ClearCodeButton />);
      const button = container.querySelector('button');

      expect(button).toBeTruthy();
      expect(button?.textContent).toBeTruthy();

      // Cleanup
      clearCode();
    });

    it('should apply theme class to document without breaking layout', () => {
      // Apply dark theme
      document.documentElement.classList.add('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Store code so ClearCodeButton renders
      storeCode('1234');

      // Render components
      vi.doMock('@/hooks/useTheme', () => ({
        useTheme: () => ({
          theme: 'dark',
          toggleTheme: vi.fn(),
        }),
      }));

      const { container: themeContainer } = render(<ThemeToggle />);
      const { container: clearContainer } = render(<ClearCodeButton />);

      // Components should render correctly
      expect(themeContainer.querySelector('button')).toBeTruthy();
      expect(clearContainer.querySelector('button')).toBeTruthy();

      // Cleanup
      clearCode();
      document.documentElement.classList.remove('dark');
    });

    it('should switch themes without breaking existing functionality', () => {
      // Start with light theme
      document.documentElement.classList.remove('dark');

      vi.doMock('@/hooks/useTheme', () => ({
        useTheme: () => ({
          theme: 'light',
          toggleTheme: vi.fn(),
        }),
      }));

      const { container: lightContainer } = render(<ThemeToggle />);
      expect(lightContainer.querySelector('button')).toBeTruthy();

      // Switch to dark theme
      document.documentElement.classList.add('dark');

      vi.doMock('@/hooks/useTheme', () => ({
        useTheme: () => ({
          theme: 'dark',
          toggleTheme: vi.fn(),
        }),
      }));

      const { container: darkContainer } = render(<ThemeToggle />);
      expect(darkContainer.querySelector('button')).toBeTruthy();
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should handle all features together without conflicts', () => {
      // Code persistence
      const testCode = 'MULTI123';
      storeCode(testCode);
      expect(getStoredCode()?.code).toBe(testCode);

      // Device info
      const deviceInfo = parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      );
      expect(deviceInfo.type).toBe('mobile');

      // Theme
      document.documentElement.classList.add('dark');

      vi.doMock('@/hooks/useTheme', () => ({
        useTheme: () => ({
          theme: 'dark',
          toggleTheme: vi.fn(),
        }),
      }));

      // Render all components
      const { container: themeContainer } = render(<ThemeToggle />);
      const { container: clearContainer } = render(<ClearCodeButton />);
      const { container: deviceContainer } = render(
        <DeviceInfoCell
          deviceInfo={JSON.stringify(deviceInfo)}
          ipAddress="192.168.1.1"
          usageCount={1}
        />
      );

      // All should work together
      expect(themeContainer.querySelector('button')).toBeTruthy();
      expect(clearContainer.querySelector('button')).toBeTruthy();
      expect(deviceContainer.querySelector('div')).toBeTruthy();

      // Cleanup
      clearCode();
      document.documentElement.classList.remove('dark');
    });

    it('should maintain data integrity across feature interactions', () => {
      // Store code
      const code1 = 'CODE1';
      storeCode(code1);

      // Apply theme
      document.documentElement.classList.add('dark');

      // Code should still be there
      expect(getStoredCode()?.code).toBe(code1);

      // Update code
      const code2 = 'CODE2';
      storeCode(code2);

      // Theme should still be applied
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Code should be updated
      expect(getStoredCode()?.code).toBe(code2);

      // Clear code
      clearCode();

      // Theme should still be applied
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Code should be cleared
      expect(getStoredCode()).toBeNull();

      // Cleanup
      document.documentElement.classList.remove('dark');
    });

    it('should handle localStorage operations without affecting theme', () => {
      // Store code
      storeCode('TEST');

      // Store theme preference
      localStorage.setItem('theme_preference', 'dark');

      // Both should coexist
      expect(getStoredCode()?.code).toBe('TEST');
      expect(localStorage.getItem('theme_preference')).toBe('dark');

      // Clear code
      clearCode();

      // Theme preference should remain
      expect(localStorage.getItem('theme_preference')).toBe('dark');

      // Cleanup
      localStorage.clear();
    });

    it('should handle all features in RTL mode', () => {
      // Set RTL direction
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ar');

      // Code persistence
      storeCode('RTL123');
      expect(getStoredCode()?.code).toBe('RTL123');

      // Device info
      const deviceInfo = parseUserAgent('Mozilla/5.0 (iPhone)');
      expect(deviceInfo).toBeTruthy();

      // Theme
      document.documentElement.classList.add('dark');

      vi.doMock('@/hooks/useTheme', () => ({
        useTheme: () => ({
          theme: 'dark',
          toggleTheme: vi.fn(),
        }),
      }));

      // Render components
      const { container: themeContainer } = render(<ThemeToggle locale="ar" />);
      const { container: deviceContainer } = render(
        <DeviceInfoCell
          deviceInfo={JSON.stringify(deviceInfo)}
          ipAddress="192.168.1.1"
        />
      );

      // All should work in RTL
      expect(themeContainer.querySelector('button')).toBeTruthy();
      expect(deviceContainer.querySelector('div')).toBeTruthy();

      // Cleanup
      clearCode();
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('dir');
      document.documentElement.removeAttribute('lang');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle localStorage quota exceeded', () => {
      // Mock localStorage.setItem to throw quota exceeded error
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError');
      });

      // Should not throw
      expect(() => storeCode('TEST')).not.toThrow();

      // Restore
      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle corrupted localStorage data', () => {
      // Store corrupted data
      localStorage.setItem('student_code', '{invalid json}');

      // Should handle gracefully
      expect(() => getStoredCode()).not.toThrow();
      expect(getStoredCode()).toBeNull();
    });

    it('should handle missing theme class gracefully', () => {
      // Remove all classes
      document.documentElement.className = '';

      vi.doMock('@/hooks/useTheme', () => ({
        useTheme: () => ({
          theme: 'light',
          toggleTheme: vi.fn(),
        }),
      }));

      // Should render without errors
      const { container } = render(<ThemeToggle />);
      expect(container.querySelector('button')).toBeTruthy();
    });

    it('should handle null device info gracefully', () => {
      const { container } = render(
        <DeviceInfoCell deviceInfo={null} ipAddress={null} />
      );

      // Should render fallback
      expect(container.textContent).toContain('Unknown Device');
    });
  });
});
