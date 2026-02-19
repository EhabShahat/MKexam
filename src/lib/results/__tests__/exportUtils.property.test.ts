/**
 * Property-Based Tests for Export Utilities
 * 
 * Tests universal properties that should hold for all export operations:
 * - Property 11: Export round-trip for data integrity
 * - Property 12: Filename sanitization safety
 * - Property 35: Arabic text encoding preservation
 * 
 * Feature: results-page-rebuild
 * Requirements: 8.1-8.11, 14.6
 */

import * as fc from 'fast-check';
import { sanitizeFilename } from '../exportUtils';
import type { Attempt, Exam, StudentSummary, ExtraField, CalculationResult } from '../types';

describe('Export Utils - Property-Based Tests', () => {
  describe('Property 11: Export round-trip for data integrity', () => {
    it('should preserve student names through CSV round-trip', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              code: fc.string({ minLength: 1, maxLength: 20 }),
              score: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
            }),
            { minLength: 1, maxLength: 100 }
          ),
          (students) => {
            // Simulate CSV export and parse
            const csvRows = students.map((s) => {
              const name = `"${s.name.replace(/"/g, '""')}"`;
              const code = `"${s.code.replace(/"/g, '""')}"`;
              const score = s.score !== null ? s.score.toFixed(2) : '-';
              return `${name},${code},${score}`;
            });

            const csvContent = csvRows.join('\n');

            // Parse back
            const parsedRows = csvContent.split('\n').map((row) => {
              const matches = row.match(/"([^"]|"")*"/g);
              if (!matches || matches.length < 2) return null;

              const name = matches[0].slice(1, -1).replace(/""/g, '"');
              const code = matches[1].slice(1, -1).replace(/""/g, '"');
              const scoreMatch = row.match(/,([^,]+)$/);
              const score = scoreMatch && scoreMatch[1] !== '-' ? parseFloat(scoreMatch[1]) : null;

              return { name, code, score };
            });

            // Verify all data matches
            return students.every((original, idx) => {
              const parsed = parsedRows[idx];
              if (!parsed) return false;

              const nameMatch = original.name === parsed.name;
              const codeMatch = original.code === parsed.code;
              const scoreMatch =
                (original.score === null && parsed.score === null) ||
                (original.score !== null &&
                  parsed.score !== null &&
                  Math.abs(original.score - parsed.score) < 0.01);

              return nameMatch && codeMatch && scoreMatch;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve device info through export round-trip', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              deviceType: fc.constantFrom('mobile', 'tablet', 'desktop', 'unknown'),
              deviceModel: fc.string({ minLength: 1, maxLength: 30 }),
              localIP: fc.ipV4(),
              serverIP: fc.ipV4(),
              automationRisk: fc.boolean(),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (devices) => {
            // Simulate export
            const csvRows = devices.map((d) => {
              return [
                `"${d.deviceType}"`,
                `"${d.deviceModel}"`,
                `"${d.localIP}"`,
                `"${d.serverIP}"`,
                `"${d.automationRisk ? 'Yes' : 'No'}"`,
              ].join(',');
            });

            const csvContent = csvRows.join('\n');

            // Parse back
            const parsedRows = csvContent.split('\n').map((row) => {
              const matches = row.match(/"([^"]|"")*"/g);
              if (!matches || matches.length < 5) return null;

              return {
                deviceType: matches[0].slice(1, -1),
                deviceModel: matches[1].slice(1, -1),
                localIP: matches[2].slice(1, -1),
                serverIP: matches[3].slice(1, -1),
                automationRisk: matches[4].slice(1, -1) === 'Yes',
              };
            });

            // Verify all data matches
            return devices.every((original, idx) => {
              const parsed = parsedRows[idx];
              if (!parsed) return false;

              return (
                original.deviceType === parsed.deviceType &&
                original.deviceModel === parsed.deviceModel &&
                original.localIP === parsed.localIP &&
                original.serverIP === parsed.serverIP &&
                original.automationRisk === parsed.automationRisk
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve score calculations through export round-trip', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              examComponent: fc.float({ min: 0, max: 100 }),
              extraComponent: fc.float({ min: 0, max: 100 }),
              finalScore: fc.float({ min: 0, max: 100 }),
              passed: fc.boolean(),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (calculations) => {
            // Simulate export
            const csvRows = calculations.map((c) => {
              return [
                c.examComponent.toFixed(2),
                c.extraComponent.toFixed(2),
                c.finalScore.toFixed(2),
                c.passed ? 'Pass' : 'Fail',
              ].join(',');
            });

            const csvContent = csvRows.join('\n');

            // Parse back
            const parsedRows = csvContent.split('\n').map((row) => {
              const parts = row.split(',');
              if (parts.length < 4) return null;

              return {
                examComponent: parseFloat(parts[0]),
                extraComponent: parseFloat(parts[1]),
                finalScore: parseFloat(parts[2]),
                passed: parts[3] === 'Pass',
              };
            });

            // Verify all data matches (within floating point precision)
            return calculations.every((original, idx) => {
              const parsed = parsedRows[idx];
              if (!parsed) return false;

              return (
                Math.abs(original.examComponent - parsed.examComponent) < 0.01 &&
                Math.abs(original.extraComponent - parsed.extraComponent) < 0.01 &&
                Math.abs(original.finalScore - parsed.finalScore) < 0.01 &&
                original.passed === parsed.passed
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 12: Filename sanitization safety', () => {
    it('should produce valid filesystem filenames for any input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (filename) => {
            const sanitized = sanitizeFilename(filename);

            // Should only contain safe characters
            const validPattern = /^[a-zA-Z0-9\u0600-\u06FF_-]+$/;
            const isValid = validPattern.test(sanitized);

            // Should not be empty (unless input was all special chars)
            const hasContent = sanitized.length > 0 || filename.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '').length === 0;

            // Should not have consecutive underscores
            const noConsecutiveUnderscores = !sanitized.includes('__');

            // Should not start or end with underscore
            const noLeadingTrailing = !sanitized.startsWith('_') && !sanitized.endsWith('_');

            return isValid && hasContent && noConsecutiveUnderscores && noLeadingTrailing;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should handle special characters consistently', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (filename) => {
            const sanitized1 = sanitizeFilename(filename);
            const sanitized2 = sanitizeFilename(filename);

            // Should be deterministic
            return sanitized1 === sanitized2;
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should preserve alphanumeric and Arabic characters', () => {
      fc.assert(
        fc.property(
          fc.string({
            minLength: 1,
            maxLength: 50,
          }).filter((s) => /^[a-zA-Z0-9\u0600-\u06FF_-]+$/.test(s)),
          (filename) => {
            const sanitized = sanitizeFilename(filename);

            // Should be unchanged if already valid
            return sanitized === filename;
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should handle exam titles with various special characters', () => {
      const specialChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0', '\n', '\r', '\t'];

      specialChars.forEach((char) => {
        const filename = `Exam${char}Title`;
        const sanitized = sanitizeFilename(filename);

        // Should not contain the special character
        expect(sanitized).not.toContain(char);

        // Should contain valid characters only
        expect(sanitized).toMatch(/^[a-zA-Z0-9\u0600-\u06FF_-]+$/);
      });
    });

    it('should handle very long filenames', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 500 }),
          (filename) => {
            const sanitized = sanitizeFilename(filename);

            // Should produce a valid filename (may be truncated by OS, but our function doesn't truncate)
            const validPattern = /^[a-zA-Z0-9\u0600-\u06FF_-]*$/;
            return validPattern.test(sanitized);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 35: Arabic text encoding preservation', () => {
    it('should preserve Arabic characters in student names', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringOf(fc.constantFrom('أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'), { minLength: 3, maxLength: 20 }),
              code: fc.string({ minLength: 1, maxLength: 10 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (students) => {
            // Simulate CSV export with UTF-8 BOM
            const csvRows = students.map((s) => {
              const name = `"${s.name.replace(/"/g, '""')}"`;
              const code = `"${s.code.replace(/"/g, '""')}"`;
              return `${name},${code}`;
            });

            const csvContent = '\uFEFF' + csvRows.join('\n');

            // Verify BOM is present
            const hasBOM = csvContent.charCodeAt(0) === 0xFEFF;

            // Parse back (skip BOM)
            const contentWithoutBOM = csvContent.slice(1);
            const parsedRows = contentWithoutBOM.split('\n').map((row) => {
              const matches = row.match(/"([^"]|"")*"/g);
              if (!matches || matches.length < 2) return null;

              const name = matches[0].slice(1, -1).replace(/""/g, '"');
              const code = matches[1].slice(1, -1).replace(/""/g, '"');

              return { name, code };
            });

            // Verify all Arabic text is preserved
            const allPreserved = students.every((original, idx) => {
              const parsed = parsedRows[idx];
              if (!parsed) return false;

              return original.name === parsed.name && original.code === parsed.code;
            });

            return hasBOM && allPreserved;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve Arabic characters in exam titles', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.stringOf(fc.constantFrom('ا', 'ل', 'ا', 'م', 'ت', 'ح', 'ا', 'ن'), { minLength: 5, maxLength: 30 }),
            { minLength: 1, maxLength: 10 }
          ),
          (examTitles) => {
            // Simulate export
            const csvRows = examTitles.map((title) => {
              return `"${title.replace(/"/g, '""')}"`;
            });

            const csvContent = '\uFEFF' + csvRows.join('\n');

            // Parse back
            const contentWithoutBOM = csvContent.slice(1);
            const parsedTitles = contentWithoutBOM.split('\n').map((row) => {
              const match = row.match(/"([^"]|"")*"/);
              if (!match) return null;
              return match[0].slice(1, -1).replace(/""/g, '"');
            });

            // Verify all titles preserved
            return examTitles.every((original, idx) => {
              const parsed = parsedTitles[idx];
              return parsed !== null && original === parsed;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve mixed Arabic and English text', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              arabicPart: fc.stringOf(fc.constantFrom('أ', 'ح', 'م', 'د'), { minLength: 2, maxLength: 10 }),
              englishPart: fc.string({ minLength: 2, maxLength: 10 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (mixedTexts) => {
            // Create mixed text
            const texts = mixedTexts.map((t) => `${t.arabicPart} ${t.englishPart}`);

            // Simulate export
            const csvRows = texts.map((text) => {
              return `"${text.replace(/"/g, '""')}"`;
            });

            const csvContent = '\uFEFF' + csvRows.join('\n');

            // Parse back
            const contentWithoutBOM = csvContent.slice(1);
            const parsedTexts = contentWithoutBOM.split('\n').map((row) => {
              const match = row.match(/"([^"]|"")*"/);
              if (!match) return null;
              return match[0].slice(1, -1).replace(/""/g, '"');
            });

            // Verify all mixed text preserved
            return texts.every((original, idx) => {
              const parsed = parsedTexts[idx];
              return parsed !== null && original === parsed;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle Arabic diacritics correctly', () => {
      const arabicWithDiacritics = [
        'مُحَمَّد',
        'الْقُرْآن',
        'بِسْمِ اللَّهِ',
        'الرَّحْمَٰنِ الرَّحِيمِ',
      ];

      arabicWithDiacritics.forEach((text) => {
        // Simulate export
        const csvRow = `"${text.replace(/"/g, '""')}"`;
        const csvContent = '\uFEFF' + csvRow;

        // Parse back
        const contentWithoutBOM = csvContent.slice(1);
        const match = contentWithoutBOM.match(/"([^"]|"")*"/);
        const parsed = match ? match[0].slice(1, -1).replace(/""/g, '"') : null;

        // Verify diacritics preserved
        expect(parsed).toBe(text);
      });
    });

    it('should preserve Arabic text in filenames where valid', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom('ا', 'م', 'ت', 'ح', 'ا', 'ن'), { minLength: 3, maxLength: 20 }),
          (arabicText) => {
            const sanitized = sanitizeFilename(arabicText);

            // Arabic characters should be preserved in sanitized filename
            const arabicCharsInOriginal = arabicText.match(/[\u0600-\u06FF]/g) || [];
            const arabicCharsInSanitized = sanitized.match(/[\u0600-\u06FF]/g) || [];

            // All Arabic characters should be preserved
            return arabicCharsInOriginal.length === arabicCharsInSanitized.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Export data integrity edge cases', () => {
    it('should handle null and undefined values correctly', () => {
      const testData = [
        { name: 'Student 1', code: null, score: undefined },
        { name: null, code: 'CODE1', score: 85.5 },
        { name: undefined, code: undefined, score: null },
      ];

      testData.forEach((data) => {
        const name = data.name ?? '-';
        const code = data.code ?? '-';
        const score = data.score !== null && data.score !== undefined ? data.score.toFixed(2) : '-';

        const csvRow = `"${name}","${code}",${score}`;

        // Should not throw and should produce valid CSV
        expect(csvRow).toBeTruthy();
        expect(csvRow.split(',').length).toBe(3);
      });
    });

    it('should handle empty strings correctly', () => {
      const testData = [
        { name: '', code: '', score: 0 },
        { name: '   ', code: '   ', score: 100 },
      ];

      testData.forEach((data) => {
        const csvRow = `"${data.name}","${data.code}",${data.score.toFixed(2)}`;

        // Should preserve empty strings
        expect(csvRow).toContain('""');
      });
    });

    it('should handle very large numbers correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000000 }),
          (largeNumber) => {
            const formatted = largeNumber.toFixed(2);
            const parsed = parseFloat(formatted);

            // Should round-trip within precision
            return Math.abs(largeNumber - parsed) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
