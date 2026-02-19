/**
 * Unit tests for the Sync Engine
 * Tests individual sync functions, error handling, and timestamp tracking
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  syncHomeworkScores, 
  syncQuizScores, 
  syncAttendance, 
  syncAllExtraScores,
  getSyncTimestamps,
  isSyncNeeded,
  syncStudentExtraScores
} from '../syncEngine';

// Mock Supabase client
const createMockSupabaseClient = (mockData: any = {}) => {
  return {
    rpc: vi.fn().mockImplementation((functionName: string, params?: any) => {
      if (mockData.rpcError) {
        return Promise.resolve({ data: null, error: mockData.rpcError });
      }
      
      switch (functionName) {
        case 'sync_homework_and_quiz_scores':
          return Promise.resolve({ 
            data: mockData.homeworkQuizData || [
              { student_id: '123', student_code: 'S001', homework_score: 85, quiz_score: 90 },
              { student_id: '456', student_code: 'S002', homework_score: 78, quiz_score: 82 }
            ], 
            error: null 
          });
        case 'sync_all_extra_scores':
          return Promise.resolve({ 
            data: mockData.allScoresData || [
              { updated_count: 2, message: 'Successfully synced all scores' }
            ], 
            error: null 
          });
        case 'sync_student_extra_scores':
          return Promise.resolve({ data: null, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    }),
    from: vi.fn().mockImplementation((table: string) => {
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        distinct: vi.fn().mockImplementation(() => {
          // Return a Promise directly for distinct()
          if (table === 'attendance_records' && mockData.attendanceData) {
            return Promise.resolve({ data: mockData.attendanceData, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        in: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockImplementation(() => {
          if (mockData.upsertError) {
            return Promise.resolve({ data: null, error: mockData.upsertError });
          }
          return Promise.resolve({ data: [{}], error: null });
        }),
      };

      // Make the query builder thenable for other operations
      (queryBuilder as any).then = vi.fn().mockImplementation((callback) => {
        if (table === 'students' && mockData.studentsData) {
          return callback({ data: mockData.studentsData, error: null });
        }
        if (table === 'app_config' && mockData.configData) {
          return callback({ data: mockData.configData, error: null });
        }
        return callback({ data: [], error: null });
      });

      return queryBuilder;
    })
  } as any;
};

describe('syncHomeworkScores', () => {
  it('should successfully sync homework scores', async () => {
    const mockSupabase = createMockSupabaseClient({
      homeworkQuizData: [
        { student_id: '123', student_code: 'S001', homework_score: 85, quiz_score: 90 }
      ]
    });

    const result = await syncHomeworkScores(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.message).toContain('Successfully synced homework scores');
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('sync_homework_and_quiz_scores');
  });

  it('should handle database errors gracefully', async () => {
    const mockSupabase = createMockSupabaseClient({
      rpcError: { message: 'Database connection failed' }
    });

    const result = await syncHomeworkScores(mockSupabase);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.error).toBe('Database connection failed');
    expect(result.message).toContain('Homework sync failed');
  });

  it('should handle empty data gracefully', async () => {
    const mockSupabase = createMockSupabaseClient({
      homeworkQuizData: []
    });

    const result = await syncHomeworkScores(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(result.message).toBe('No homework scores to sync');
  });

  it('should handle upsert errors', async () => {
    const mockSupabase = createMockSupabaseClient({
      homeworkQuizData: [
        { student_id: '123', student_code: 'S001', homework_score: 85, quiz_score: 90 }
      ],
      upsertError: { message: 'Constraint violation' }
    });

    const result = await syncHomeworkScores(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0); // No successful updates due to upsert error
  });
});

describe('syncQuizScores', () => {
  it('should successfully sync quiz scores', async () => {
    const mockSupabase = createMockSupabaseClient({
      homeworkQuizData: [
        { student_id: '123', student_code: 'S001', homework_score: 85, quiz_score: 90 }
      ]
    });

    const result = await syncQuizScores(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.message).toContain('Successfully synced quiz scores');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('sync_homework_and_quiz_scores');
  });

  it('should handle database errors', async () => {
    const mockSupabase = createMockSupabaseClient({
      rpcError: { message: 'Permission denied' }
    });

    const result = await syncQuizScores(mockSupabase);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
    expect(result.message).toContain('Quiz sync failed');
  });
});

describe('syncAttendance', () => {
  it('should successfully sync attendance data', async () => {
    const mockSupabase = createMockSupabaseClient({
      attendanceData: [
        { session_date: '2024-01-01' },
        { session_date: '2024-01-02' },
        { session_date: '2024-01-03' }
      ],
      studentsData: [
        { id: '123', code: 'S001' },
        { id: '456', code: 'S002' }
      ]
    });

    const result = await syncAttendance(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(result.message).toContain('Successfully synced attendance');
  });

  it('should handle no attendance sessions', async () => {
    const mockSupabase = createMockSupabaseClient({
      attendanceData: []
    });

    const result = await syncAttendance(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(result.message).toBe('No attendance sessions found');
  });

  it('should handle database errors when fetching sessions', async () => {
    const mockSupabase = createMockSupabaseClient();

    // Override the from method to return an error for attendance_records
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'attendance_records') {
        return {
          select: vi.fn().mockReturnThis(),
          distinct: vi.fn().mockImplementation(() => {
            return Promise.resolve({ data: null, error: { message: 'Table not found' } });
          })
        };
      }
      return { select: vi.fn().mockReturnThis(), distinct: vi.fn().mockReturnThis() };
    });

    const result = await syncAttendance(mockSupabase);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Table not found');
    expect(result.message).toContain('Attendance sync failed');
  });
});

describe('syncAllExtraScores', () => {
  it('should successfully sync all extra scores', async () => {
    const mockSupabase = createMockSupabaseClient({
      allScoresData: [
        { updated_count: 5, message: 'All scores synced successfully' }
      ]
    });

    const result = await syncAllExtraScores(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(5);
    expect(result.message).toBe('All scores synced successfully');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('sync_all_extra_scores');
  });

  it('should handle database function errors', async () => {
    const mockSupabase = createMockSupabaseClient({
      rpcError: { message: 'Function execution failed' }
    });

    const result = await syncAllExtraScores(mockSupabase);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Function execution failed');
    expect(result.message).toContain('Full sync failed');
  });

  it('should handle empty result from database function', async () => {
    const mockSupabase = createMockSupabaseClient({
      allScoresData: []
    });

    const result = await syncAllExtraScores(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(result.message).toBe('Sync completed');
  });
});

describe('getSyncTimestamps', () => {
  it('should retrieve sync timestamps from app_config', async () => {
    const mockSupabase = createMockSupabaseClient({
      configData: [
        { key: 'sync_homework_timestamp', value: '2024-01-01T10:00:00Z' },
        { key: 'sync_quiz_timestamp', value: '2024-01-01T11:00:00Z' },
        { key: 'sync_attendance_timestamp', value: '2024-01-01T12:00:00Z' },
        { key: 'sync_full_timestamp', value: '2024-01-01T13:00:00Z' }
      ]
    });

    const timestamps = await getSyncTimestamps(mockSupabase);

    expect(timestamps.homework).toEqual(new Date('2024-01-01T10:00:00Z'));
    expect(timestamps.quiz).toEqual(new Date('2024-01-01T11:00:00Z'));
    expect(timestamps.attendance).toEqual(new Date('2024-01-01T12:00:00Z'));
    expect(timestamps.lastFullSync).toEqual(new Date('2024-01-01T13:00:00Z'));
  });

  it('should handle missing timestamps', async () => {
    const mockSupabase = createMockSupabaseClient({
      configData: [
        { key: 'sync_homework_timestamp', value: '2024-01-01T10:00:00Z' }
        // Missing other timestamps
      ]
    });

    const timestamps = await getSyncTimestamps(mockSupabase);

    expect(timestamps.homework).toEqual(new Date('2024-01-01T10:00:00Z'));
    expect(timestamps.quiz).toBeNull();
    expect(timestamps.attendance).toBeNull();
    expect(timestamps.lastFullSync).toBeNull();
  });

  it('should handle database errors gracefully', async () => {
    const mockSupabase = createMockSupabaseClient();

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'app_config') {
        return Promise.resolve({ data: null, error: { message: 'Access denied' } });
      }
      return { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis() };
    });

    const timestamps = await getSyncTimestamps(mockSupabase);

    expect(timestamps.homework).toBeNull();
    expect(timestamps.quiz).toBeNull();
    expect(timestamps.attendance).toBeNull();
    expect(timestamps.lastFullSync).toBeNull();
  });
});

describe('isSyncNeeded', () => {
  it('should return true if never synced before', () => {
    const result = isSyncNeeded(null, 30);
    expect(result).toBe(true);
  });

  it('should return true if sync is older than max age', () => {
    const oldTimestamp = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes ago
    const result = isSyncNeeded(oldTimestamp, 30);
    expect(result).toBe(true);
  });

  it('should return false if sync is within max age', () => {
    const recentTimestamp = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
    const result = isSyncNeeded(recentTimestamp, 30);
    expect(result).toBe(false);
  });

  it('should use default max age of 30 minutes', () => {
    const oldTimestamp = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes ago
    const result = isSyncNeeded(oldTimestamp);
    expect(result).toBe(true);

    const recentTimestamp = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
    const result2 = isSyncNeeded(recentTimestamp);
    expect(result2).toBe(false);
  });
});

describe('syncStudentExtraScores', () => {
  it('should successfully sync single student scores', async () => {
    const mockSupabase = createMockSupabaseClient();

    const result = await syncStudentExtraScores(mockSupabase, '123');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.message).toContain('Successfully synced extra scores for student 123');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('sync_student_extra_scores', {
      p_student_id: '123'
    });
  });

  it('should handle database function errors', async () => {
    const mockSupabase = createMockSupabaseClient({
      rpcError: { message: 'Student not found' }
    });

    const result = await syncStudentExtraScores(mockSupabase, '999');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Student not found');
    expect(result.message).toContain('Student sync failed');
  });
});

describe('Error handling and edge cases', () => {
  it('should handle network errors gracefully', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Network timeout'))
    } as any;

    const result = await syncHomeworkScores(mockSupabase);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
    expect(result.message).toContain('Homework sync failed');
  });

  it('should handle unexpected data formats', async () => {
    const mockSupabase = createMockSupabaseClient({
      homeworkQuizData: [
        { student_id: null, student_code: null, homework_score: null, quiz_score: null }
      ]
    });

    const result = await syncHomeworkScores(mockSupabase);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1); // Should still attempt to process
  });

  it('should track timestamps correctly', async () => {
    const beforeSync = new Date();
    const mockSupabase = createMockSupabaseClient();

    const result = await syncAllExtraScores(mockSupabase);
    const afterSync = new Date();

    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterSync.getTime());
  });
});