/**
 * Property-Based Test: Bilingual Feature Support
 * Feature: student-experience-and-admin-enhancements, Property 20: Bilingual Feature Support
 * 
 * Validates: Requirements 4.5
 * 
 * Property: For any new feature (code persistence, device display, theme toggle),
 * all UI text and labels should be available in both English and Arabic with proper translations.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { t, type StudentLocale } from '@/i18n/student';

describe('Property 20: Bilingual Feature Support', () => {
  it('should have translations for all theme toggle labels in both languages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StudentLocale>('en', 'ar'),
        (locale) => {
          // Theme toggle labels
          const switchToLight = t(locale, 'switch_to_light_theme');
          const switchToDark = t(locale, 'switch_to_dark_theme');
          const lightTheme = t(locale, 'light_theme');
          const darkTheme = t(locale, 'dark_theme');

          // All translations should be non-empty strings
          expect(switchToLight).toBeTruthy();
          expect(switchToDark).toBeTruthy();
          expect(lightTheme).toBeTruthy();
          expect(darkTheme).toBeTruthy();

          // Translations should be different from keys (not fallback)
          expect(switchToLight).not.toBe('switch_to_light_theme');
          expect(switchToDark).not.toBe('switch_to_dark_theme');
          expect(lightTheme).not.toBe('light_theme');
          expect(darkTheme).not.toBe('dark_theme');

          // English and Arabic translations should be different
          if (locale === 'en') {
            expect(switchToLight).toMatch(/light/i);
            expect(switchToDark).toMatch(/dark/i);
          } else {
            // Arabic translations should contain Arabic characters
            expect(switchToLight).toMatch(/[\u0600-\u06FF]/);
            expect(switchToDark).toMatch(/[\u0600-\u06FF]/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have translations for code persistence labels in both languages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StudentLocale>('en', 'ar'),
        (locale) => {
          // Code persistence labels
          const clearCode = t(locale, 'clear_code');
          const clearStoredCode = t(locale, 'clear_stored_code');

          // All translations should be non-empty strings
          expect(clearCode).toBeTruthy();
          expect(clearStoredCode).toBeTruthy();

          // Translations should be different from keys (not fallback)
          expect(clearCode).not.toBe('clear_code');
          expect(clearStoredCode).not.toBe('clear_stored_code');

          // English and Arabic translations should be different
          if (locale === 'en') {
            expect(clearCode).toMatch(/clear/i);
          } else {
            // Arabic translations should contain Arabic characters
            expect(clearCode).toMatch(/[\u0600-\u06FF]/);
            expect(clearStoredCode).toMatch(/[\u0600-\u06FF]/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide consistent translations across multiple calls', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StudentLocale>('en', 'ar'),
        fc.constantFrom(
          'switch_to_light_theme',
          'switch_to_dark_theme',
          'light_theme',
          'dark_theme',
          'clear_code',
          'clear_stored_code'
        ),
        (locale, key) => {
          // Same key and locale should always return same translation
          const translation1 = t(locale, key);
          const translation2 = t(locale, key);

          expect(translation1).toBe(translation2);
          expect(translation1).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have different translations for English and Arabic', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'switch_to_light_theme',
          'switch_to_dark_theme',
          'light_theme',
          'dark_theme',
          'clear_code',
          'clear_stored_code'
        ),
        (key) => {
          const enTranslation = t('en', key);
          const arTranslation = t('ar', key);

          // English and Arabic translations should be different
          expect(enTranslation).not.toBe(arTranslation);

          // English should not contain Arabic characters
          expect(enTranslation).not.toMatch(/[\u0600-\u06FF]/);

          // Arabic should contain Arabic characters
          expect(arTranslation).toMatch(/[\u0600-\u06FF]/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle missing translations gracefully with fallback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StudentLocale>('en', 'ar'),
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          key => !['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__'].includes(key)
        ),
        (locale, randomKey) => {
          // For non-existent keys, should return the key itself or English fallback
          const translation = t(locale, randomKey);

          // Should always return a string
          expect(typeof translation).toBe('string');
          expect(translation).toBeTruthy();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should support variable interpolation in both languages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StudentLocale>('en', 'ar'),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('$') && !s.includes('{')),
        fc.integer({ min: 1, max: 100 }),
        (locale, name, count) => {
          // Test interpolation with variables
          const welcomeTitle = t(locale, 'welcome_title', { name });
          const xAnswered = t(locale, 'x_answered', { count: count.toString() });

          // Should contain the interpolated values
          expect(welcomeTitle).toContain(name);
          expect(xAnswered).toContain(count.toString());

          // Should not contain the placeholder syntax
          expect(welcomeTitle).not.toContain('{name}');
          expect(xAnswered).not.toContain('{count}');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain semantic meaning across translations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'switch_to_light_theme',
          'switch_to_dark_theme',
          'clear_code'
        ),
        (key) => {
          const enTranslation = t('en', key);
          const arTranslation = t('ar', key);

          // Both translations should have similar length (within reasonable bounds)
          // This is a heuristic to check if translations are meaningful
          const lengthRatio = enTranslation.length / arTranslation.length;
          
          // Ratio should be between 0.3 and 3.0 (allowing for language differences)
          expect(lengthRatio).toBeGreaterThan(0.3);
          expect(lengthRatio).toBeLessThan(3.0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
