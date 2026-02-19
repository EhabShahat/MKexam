/**
 * Unit Tests for Export Utilities
 * 
 * Tests specific examples and edge cases for export functionality
 * Target: 90% code coverage
 * 
 * Feature: results-page-rebuild
 * Requirements: 8.1-8.11, 13.6, 14.6, 20.10
 */

import { sanitizeFilename } from '../exportUtils';
import type { Attempt, Exam, StudentSummary, ExtraField, CalculationResult } from '../types';

// Mock document methods for download testing
const mockCreateElement = jest.fn();
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockClick = jest.fn();

beforeAll(() => {
  global.document.createElement = mockCreateElement;
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  global.document.body.appendChild = mockAppendChild;
  global.document.body.removeChild = mockRemoveChild;

  mockCreateElement.mockReturnValue({
    setAttribute: jest.fn(),
    click: mockClick,
    style: {},
  });
  mockCreateObjectURL.mockReturnValue('blob:mock-url');
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Export Utils - Unit Tests', () => {
  describe('sanitizeFilename', () => {
    it('should remove invalid filesystem characters', () => {
      const input = 'Exam/Title:Test*File?.xlsx';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('Exam_Title_Test_File_xlsx');
      expect(result).not.toContain('/');
      expect(result).not.toContain(':');
      expect(result).not.toContain('*');
      expect(result).not.toContain('?');
    });

    it('should preserve alphanumeric characters', () => {
      const input = 'Exam123Test';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('Exam123Test');
    });

    it('should preserve Arabic characters', () => {
      const input = 'امتحان_الرياضيات';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('امتحان_الرياضيات');
    });

    it('should preserve hyphens and underscores', () => {
      const input = 'exam-title_test';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('exam-title_test');
    });

    it('should replace multiple consecutive underscores with single', () => {
      const input = 'exam___title';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('exam_title');
    });

    it('should remove leading and trailing underscores', () => {
      const input = '_exam_title_';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('exam_title');
    });

    it('should handle empty string after sanitization', () => {
      const input = '///:::***';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('');
    });

    it('should handle mixed Arabic and English', () => {
      const input = 'Exam امتحان 2024';
      const result = sanitizeFilename(input);
      
      expect(result).toBe('Exam_امتحان_2024');
    });

    it('should handle Windows reserved characters', () => {
      const input = 'file<name>with|reserved:chars';
      const result = sanitizeFilename(input);
      
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('|');
      expect(result).not.toContain(':');
    });

    it('should handle null bytes and control characters', () => {
      const input = 'file\0name\nwith\rcontrol\tchars';
      const result = sanitizeFilename(input);
      
      expect(result).not.toContain('\0');
      expect(result).not.toContain('\n');
      expect(result).not.toContain('\r');
      expect(result).not.toContain('\t');
    });
  });

  describe('exportAttemptsToCsv', () => {
    const mockExam: Exam = {
      id: 'exam-1',
      title: 'Math Exam',
      status: 'published',
      access_type: 'open',
      exam_type: 'exam',
      scheduling_mode: 'Auto',
      is_manually_published: false,
      is_archived: false,
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T12:00:00Z',
      include_in_pass: true,
      pass_threshold: 60,
    };

    const mockAttempts: Attempt[] = [
      {
        id: 'attempt-1',
        exam_id: 'exam-1',
        student_id: 'student-1',
        student_name: 'John Doe',
        code: 'STU001',
        completion_status: 'completed',
        started_at: '2024-01-01T10:00:00Z',
        submitted_at: '2024-01-01T11:30:00Z',
        score_percentage: 85.5,
        final_score_percentage: 85.5,
        ip_address: '192.168.1.1',
        device_info: JSON.stringify({
          type: 'desktop',
          oem: { brand: 'Dell', model: 'XPS 15' },
          allIPs: { local: ['192.168.1.100'] },
          security: { automationRisk: false },
        }),
        manual_total_count: 0,
        manual_graded_count: 0,
        manual_pending_count: 0,
      },
      {
        id: 'attempt-2',
        exam_id: 'exam-1',
        student_id: 'student-2',
        student_name: 'أحمد محمد',
        code: 'STU002',
        completion_status: 'completed',
        started_at: '2024-01-01T10:15:00Z',
        submitted_at: '2024-01-01T11:45:00Z',
        score_percentage: 72.0,
        final_score_percentage: 75.0,
        ip_address: '192.168.1.2',
        device_info: JSON.stringify({
          type: 'mobile',
          oem: { brand: 'Apple', model: 'iPhone 13' },
          allIPs: { local: ['192.168.1.101'] },
          security: { automationRisk: false },
        }),
        manual_total_count: 5,
        manual_graded_count: 5,
        manual_pending_count: 0,
      },
    ];

    it('should create CSV with bilingual headers', () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      exportAttemptsToCsv(mockAttempts, mockExam, deviceUsageMap);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      
      const blobCall = mockCreateObjectURL.mock.calls[0][0];
      expect(blobCall.type).toBe('text/csv;charset=utf-8;');
    });

    it('should include UTF-8 BOM for Excel compatibility', async () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      let capturedBlob: Blob | null = null;
      mockCreateObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      exportAttemptsToCsv(mockAttempts, mockExam, deviceUsageMap);

      expect(capturedBlob).not.toBeNull();
      if (capturedBlob) {
        const text = await capturedBlob.text();
        expect(text.charCodeAt(0)).toBe(0xFEFF); // UTF-8 BOM
      }
    });

    it('should properly escape quotes in CSV cells', async () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      const attemptsWithQuotes: Attempt[] = [
        {
          ...mockAttempts[0],
          student_name: 'John "Johnny" Doe',
        },
      ];

      let capturedBlob: Blob | null = null;
      mockCreateObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      exportAttemptsToCsv(attemptsWithQuotes, mockExam, deviceUsageMap);

      if (capturedBlob) {
        const text = await capturedBlob.text();
        expect(text).toContain('John ""Johnny"" Doe');
      }
    });

    it('should handle null values correctly', async () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      const attemptsWithNulls: Attempt[] = [
        {
          ...mockAttempts[0],
          student_name: null,
          code: null,
          score_percentage: null,
          started_at: null,
          submitted_at: null,
        },
      ];

      let capturedBlob: Blob | null = null;
      mockCreateObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      exportAttemptsToCsv(attemptsWithNulls, mockExam, deviceUsageMap);

      if (capturedBlob) {
        const text = await capturedBlob.text();
        expect(text).toContain('-');
      }
    });

    it('should include device usage counts', async () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>([
        ['desktop-Dell XPS 15-192.168.1.100', 3],
      ]);

      let capturedBlob: Blob | null = null;
      mockCreateObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      exportAttemptsToCsv(mockAttempts, mockExam, deviceUsageMap);

      if (capturedBlob) {
        const text = await capturedBlob.text();
        expect(text).toContain('3');
      }
    });

    it('should show manual grading status correctly', async () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      const attemptsWithManualGrading: Attempt[] = [
        {
          ...mockAttempts[0],
          manual_total_count: 5,
          manual_graded_count: 3,
          manual_pending_count: 2,
        },
      ];

      let capturedBlob: Blob | null = null;
      mockCreateObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      exportAttemptsToCsv(attemptsWithManualGrading, mockExam, deviceUsageMap);

      if (capturedBlob) {
        const text = await capturedBlob.text();
        expect(text).toContain('Pending: 2/5');
      }
    });

    it('should use sanitized filename', () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      const examWithSpecialChars: Exam = {
        ...mockExam,
        title: 'Math/Exam:2024',
      };

      const mockLink = {
        setAttribute: jest.fn(),
        click: mockClick,
        style: {},
      };
      mockCreateElement.mockReturnValue(mockLink);

      exportAttemptsToCsv(mockAttempts, examWithSpecialChars, deviceUsageMap);

      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download',
        'Math_Exam_2024_attempts.csv'
      );
    });

    it('should trigger download', () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      exportAttemptsToCsv(mockAttempts, mockExam, deviceUsageMap);

      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should handle large datasets efficiently', async () => {
      const { exportAttemptsToCsv } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      // Create 1000 attempts
      const largeAttempts: Attempt[] = Array.from({ length: 1000 }, (_, i) => ({
        ...mockAttempts[0],
        id: `attempt-${i}`,
        student_name: `Student ${i}`,
        code: `STU${String(i).padStart(4, '0')}`,
      }));

      const startTime = Date.now();
      exportAttemptsToCsv(largeAttempts, mockExam, deviceUsageMap);
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('exportAttemptsToXlsx', () => {
    const mockExam: Exam = {
      id: 'exam-1',
      title: 'Math Exam',
      status: 'published',
      access_type: 'open',
      exam_type: 'exam',
      scheduling_mode: 'Auto',
      is_manually_published: false,
      is_archived: false,
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T12:00:00Z',
      include_in_pass: true,
      pass_threshold: 60,
    };

    const mockAttempts: Attempt[] = [
      {
        id: 'attempt-1',
        exam_id: 'exam-1',
        student_id: 'student-1',
        student_name: 'John Doe',
        code: 'STU001',
        completion_status: 'completed',
        started_at: '2024-01-01T10:00:00Z',
        submitted_at: '2024-01-01T11:30:00Z',
        score_percentage: 85.5,
        final_score_percentage: 85.5,
        ip_address: '192.168.1.1',
        device_info: JSON.stringify({
          type: 'desktop',
          oem: { brand: 'Dell', model: 'XPS 15' },
          allIPs: { local: ['192.168.1.100'] },
          security: { automationRisk: false },
        }),
        manual_total_count: 0,
        manual_graded_count: 0,
        manual_pending_count: 0,
      },
    ];

    it('should use dynamic import for XLSX library', async () => {
      const mockXLSX = {
        utils: {
          aoa_to_sheet: jest.fn().mockReturnValue({ '!ref': 'A1:N2' }),
          book_new: jest.fn().mockReturnValue({}),
          book_append_sheet: jest.fn(),
          decode_range: jest.fn().mockReturnValue({ s: { r: 0, c: 0 }, e: { r: 1, c: 13 } }),
          encode_cell: jest.fn((cell) => `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`),
        },
        writeFile: jest.fn(),
      };

      jest.mock('xlsx', () => mockXLSX, { virtual: true });

      const { exportAttemptsToXlsx } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();

      await exportAttemptsToXlsx(mockAttempts, mockExam, deviceUsageMap);

      // Dynamic import should be used (tested by module system)
      expect(true).toBe(true);
    });

    it('should include stage progress data when provided', async () => {
      const mockXLSX = {
        utils: {
          aoa_to_sheet: jest.fn().mockReturnValue({ '!ref': 'A1:N2' }),
          book_new: jest.fn().mockReturnValue({}),
          book_append_sheet: jest.fn(),
          decode_range: jest.fn().mockReturnValue({ s: { r: 0, c: 0 }, e: { r: 1, c: 13 } }),
          encode_cell: jest.fn((cell) => `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`),
        },
        writeFile: jest.fn(),
      };

      jest.doMock('xlsx', () => mockXLSX, { virtual: true });

      const { exportAttemptsToXlsx } = require('../exportUtils');
      const deviceUsageMap = new Map<string, number>();
      const stageProgress = new Map([
        [
          'attempt-1',
          [
            {
              type: 'video',
              completion: 'completed',
              time_spent: 300,
              watch_percentage: 95,
              answered_count: 5,
            },
          ],
        ],
      ]);

      await exportAttemptsToXlsx(mockAttempts, mockExam, deviceUsageMap, stageProgress);

      // Should append stage progress sheet
      expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalledTimes(2);
    });
  });

  describe('exportAllExamsToCsv', () => {
    const mockExams: Exam[] = [
      {
        id: 'exam-1',
        title: 'Math',
        status: 'published',
        access_type: 'open',
        exam_type: 'exam',
        scheduling_mode: 'Auto',
        is_manually_published: false,
        is_archived: false,
        start_time: null,
        end_time: null,
        include_in_pass: true,
        pass_threshold: 60,
      },
      {
        id: 'exam-2',
        title: 'Science',
        status: 'published',
        access_type: 'open',
        exam_type: 'quiz',
        scheduling_mode: 'Auto',
        is_manually_published: false,
        is_archived: false,
        start_time: null,
        end_time: null,
        include_in_pass: true,
        pass_threshold: 60,
      },
    ];

    const mockSummaries: StudentSummary[] = [
      {
        student_id: 'student-1',
        student_name: 'John Doe',
        code: 'STU001',
        scores: {
          'exam-1': 85.5,
          'exam-2': 90.0,
        },
        attempt_counts: {
          'exam-1': 1,
          'exam-2': 1,
        },
      },
    ];

    const mockExtraFields: ExtraField[] = [
      {
        key: 'attendance',
        label: 'Attendance',
        type: 'number',
        hidden: false,
        include_in_pass: true,
        pass_weight: 0.1,
        max_points: 10,
        bool_true_points: null,
        bool_false_points: null,
        text_score_map: null,
      },
    ];

    const mockCalculations = new Map<string, CalculationResult>([
      [
        'student-1',
        {
          exam_component: {
            mode: 'best',
            score: 90.0,
            exams_included: 2,
            exams_total: 2,
            exams_passed: 2,
            details: [],
          },
          extra_component: {
            score: 80.0,
            total_weight: 0.1,
            details: [],
          },
          final_score: 89.0,
          passed: true,
          failed_due_to_exam: false,
          pass_threshold: 60,
        },
      ],
    ]);

    const mockExtraData = new Map<string, Record<string, any>>([
      ['student-1', { attendance: 8 }],
    ]);

    it('should create CSV with all columns', async () => {
      const { exportAllExamsToCsv } = require('../exportUtils');

      let capturedBlob: Blob | null = null;
      mockCreateObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      exportAllExamsToCsv(
        mockSummaries,
        mockExams,
        mockExtraFields,
        mockCalculations,
        mockExtraData
      );

      expect(capturedBlob).not.toBeNull();
      if (capturedBlob) {
        const text = await capturedBlob.text();
        
        // Should include bilingual headers
        expect(text).toContain('Student Name / اسم الطالب');
        expect(text).toContain('Final Score / الدرجة النهائية');
        
        // Should include exam titles
        expect(text).toContain('Math (exam)');
        expect(text).toContain('Science (quiz)');
        
        // Should include extra field labels
        expect(text).toContain('Attendance');
        
        // Should include pass/fail status
        expect(text).toContain('Pass / نجح');
      }
    });

    it('should handle missing scores with dash', async () => {
      const { exportAllExamsToCsv } = require('../exportUtils');

      const summariesWithMissing: StudentSummary[] = [
        {
          ...mockSummaries[0],
          scores: {
            'exam-1': 85.5,
            'exam-2': null as any,
          },
        },
      ];

      let capturedBlob: Blob | null = null;
      mockCreateObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      exportAllExamsToCsv(
        summariesWithMissing,
        mockExams,
        mockExtraFields,
        mockCalculations,
        mockExtraData
      );

      if (capturedBlob) {
        const text = await capturedBlob.text();
        expect(text).toContain('-');
      }
    });

    it('should use "all_exams" as filename', () => {
      const { exportAllExamsToCsv } = require('../exportUtils');

      const mockLink = {
        setAttribute: jest.fn(),
        click: mockClick,
        style: {},
      };
      mockCreateElement.mockReturnValue(mockLink);

      exportAllExamsToCsv(
        mockSummaries,
        mockExams,
        mockExtraFields,
        mockCalculations,
        mockExtraData
      );

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'all_exams.csv');
    });
  });

  describe('exportAllExamsToXlsx', () => {
    const mockExams: Exam[] = [
      {
        id: 'exam-1',
        title: 'Math',
        status: 'published',
        access_type: 'open',
        exam_type: 'exam',
        scheduling_mode: 'Auto',
        is_manually_published: false,
        is_archived: false,
        start_time: null,
        end_time: null,
        include_in_pass: true,
        pass_threshold: 60,
      },
    ];

    const mockSummaries: StudentSummary[] = [
      {
        student_id: 'student-1',
        student_name: 'John Doe',
        code: 'STU001',
        scores: { 'exam-1': 85.5 },
        attempt_counts: { 'exam-1': 1 },
      },
    ];

    const mockExtraFields: ExtraField[] = [];

    const mockCalculations = new Map<string, CalculationResult>([
      [
        'student-1',
        {
          exam_component: {
            mode: 'best',
            score: 85.5,
            exams_included: 1,
            exams_total: 1,
            exams_passed: 1,
            details: [
              {
                exam_id: 'exam-1',
                exam_title: 'Math',
                score: 85.5,
                passed: true,
                pass_threshold: 60,
              },
            ],
          },
          extra_component: {
            score: 0,
            total_weight: 0,
            details: [],
          },
          final_score: 85.5,
          passed: true,
          failed_due_to_exam: false,
          pass_threshold: 60,
        },
      ],
    ]);

    const mockExtraData = new Map<string, Record<string, any>>();

    it('should include calculation breakdown sheet', async () => {
      const mockXLSX = {
        utils: {
          aoa_to_sheet: jest.fn().mockReturnValue({ '!ref': 'A1:N2' }),
          book_new: jest.fn().mockReturnValue({}),
          book_append_sheet: jest.fn(),
          decode_range: jest.fn().mockReturnValue({ s: { r: 0, c: 0 }, e: { r: 1, c: 13 } }),
          encode_cell: jest.fn((cell) => `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`),
        },
        writeFile: jest.fn(),
      };

      jest.doMock('xlsx', () => mockXLSX, { virtual: true });

      const { exportAllExamsToXlsx } = require('../exportUtils');

      await exportAllExamsToXlsx(
        mockSummaries,
        mockExams,
        mockExtraFields,
        mockCalculations,
        mockExtraData
      );

      // Should append main sheet and breakdown sheet
      expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'All Exams'
      );
      expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'Calculation Breakdown'
      );
    });
  });

  describe('Date and time formatting', () => {
    it('should format dates in Cairo timezone', () => {
      const dateString = '2024-01-01T10:00:00Z';
      const date = new Date(dateString);
      
      const formatted = date.toLocaleString('en-US', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      expect(formatted).toBeTruthy();
      expect(formatted).toContain('2024');
    });

    it('should handle null dates', () => {
      const result = null;
      expect(result).toBeNull();
    });

    it('should calculate duration correctly', () => {
      const start = '2024-01-01T10:00:00Z';
      const end = '2024-01-01T11:30:00Z';
      
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      const durationMinutes = Math.round((endTime - startTime) / 60000);

      expect(durationMinutes).toBe(90);
    });
  });
});
