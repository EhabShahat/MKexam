/**
 * Sync Engine for Score Calculation Optimization
 * 
 * This module provides functions to synchronize extra scores (homework, quiz, attendance)
 * from their source data (exam results, attendance records) to the extra_scores table.
 * 
 * The sync engine tracks timestamps and provides both individual and bulk sync operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logSyncError, logDatabaseError } from './errorLogger';
import { trackSyncOperation } from './performanceMonitor';

export interface SyncResult {
  success: boolean;
  updatedCount: number;
  message: string;
  timestamp: Date;
  error?: string;
}

export interface SyncTimestamps {
  homework: Date | null;
  quiz: Date | null;
  attendance: Date | null;
  lastFullSync: Date | null;
}

/**
 * Sync homework scores for all students
 * Calculates average scores from homework-type exams and updates extra_scores table
 */
export async function syncHomeworkScores(supabase: SupabaseClient): Promise<SyncResult> {
  const startTime = new Date();
  const syncId = `homework_sync_${Date.now()}`;
  
  try {
    // Call the database function to sync homework scores
    const { data, error } = await supabase.rpc('sync_homework_and_quiz_scores');
    
    if (error) {
      const duration = Date.now() - startTime.getTime();
      logSyncError(
        'sync_homework_scores',
        error,
        {
          syncType: 'homework',
          duration,
          recordsProcessed: 0,
          recordsFailed: 1,
        }
      );
      
      return {
        success: false,
        updatedCount: 0,
        message: `Homework sync failed: ${error.message}`,
        timestamp: startTime,
        error: error.message
      };
    }

    // Extract homework scores and update extra_scores table
    const homeworkUpdates = data?.map((row: any) => ({
      student_id: row.student_id,
      homework_score: row.homework_score
    })) || [];

    if (homeworkUpdates.length === 0) {
      const duration = Date.now() - startTime.getTime();
      trackSyncOperation(syncId, 'homework', duration, 0, true, 0);
      
      return {
        success: true,
        updatedCount: 0,
        message: 'No homework scores to sync',
        timestamp: startTime
      };
    }

    // Update extra_scores table with homework scores
    let updatedCount = 0;
    let errors = 0;
    
    for (const update of homeworkUpdates) {
      const { error: updateError } = await supabase
        .from('extra_scores')
        .upsert({
          student_id: update.student_id,
          data: { exam_type_homework: update.homework_score },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'student_id',
          ignoreDuplicates: false
        });

      if (updateError) {
        errors++;
        logDatabaseError(
          'upsert_homework_score',
          updateError,
          {
            table: 'extra_scores',
            query: 'upsert',
          }
        );
      } else {
        updatedCount++;
      }
    }

    // Store sync timestamp
    await storeSyncTimestamp(supabase, 'homework', startTime);

    const duration = Date.now() - startTime.getTime();
    trackSyncOperation(syncId, 'homework', duration, updatedCount, true, errors);

    return {
      success: true,
      updatedCount,
      message: `Successfully synced homework scores for ${updatedCount} students`,
      timestamp: startTime
    };

  } catch (error: any) {
    const duration = Date.now() - startTime.getTime();
    logSyncError(
      'sync_homework_scores',
      error,
      {
        syncType: 'homework',
        duration,
        recordsProcessed: 0,
        recordsFailed: 1,
      }
    );
    
    return {
      success: false,
      updatedCount: 0,
      message: `Homework sync failed: ${error.message}`,
      timestamp: startTime,
      error: error.message
    };
  }
}

/**
 * Sync quiz scores for all students
 * Calculates average scores from quiz-type exams and updates extra_scores table
 */
export async function syncQuizScores(supabase: SupabaseClient): Promise<SyncResult> {
  const startTime = new Date();
  
  try {
    // Call the database function to sync quiz scores
    const { data, error } = await supabase.rpc('sync_homework_and_quiz_scores');
    
    if (error) {
      return {
        success: false,
        updatedCount: 0,
        message: `Quiz sync failed: ${error.message}`,
        timestamp: startTime,
        error: error.message
      };
    }

    // Extract quiz scores and update extra_scores table
    const quizUpdates = data?.map((row: any) => ({
      student_id: row.student_id,
      quiz_score: row.quiz_score
    })) || [];

    if (quizUpdates.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: 'No quiz scores to sync',
        timestamp: startTime
      };
    }

    // Update extra_scores table with quiz scores
    let updatedCount = 0;
    for (const update of quizUpdates) {
      const { error: updateError } = await supabase
        .from('extra_scores')
        .upsert({
          student_id: update.student_id,
          data: { exam_type_quiz: update.quiz_score },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'student_id',
          ignoreDuplicates: false
        });

      if (!updateError) {
        updatedCount++;
      }
    }

    // Store sync timestamp
    await storeSyncTimestamp(supabase, 'quiz', startTime);

    return {
      success: true,
      updatedCount,
      message: `Successfully synced quiz scores for ${updatedCount} students`,
      timestamp: startTime
    };

  } catch (error: any) {
    return {
      success: false,
      updatedCount: 0,
      message: `Quiz sync failed: ${error.message}`,
      timestamp: startTime,
      error: error.message
    };
  }
}

/**
 * Sync attendance percentages for all students
 * Calculates attendance percentages from attendance_records and updates extra_scores table
 */
export async function syncAttendance(supabase: SupabaseClient): Promise<SyncResult> {
  const startTime = new Date();
  
  try {
    // Get all attendance records to calculate distinct sessions
    const { data: allRecords, error: sessionError } = await supabase
      .from('attendance_records')
      .select('session_date');

    if (sessionError) {
      return {
        success: false,
        updatedCount: 0,
        message: `Attendance sync failed: ${sessionError.message}`,
        timestamp: startTime,
        error: sessionError.message
      };
    }

    // Calculate distinct session dates
    const distinctSessions = new Set(allRecords?.map(record => record.session_date) || []);
    const totalSessions = distinctSessions.size;
    
    if (totalSessions === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: 'No attendance sessions found',
        timestamp: startTime
      };
    }

    // Get all students and their attendance records
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, code');

    if (studentsError) {
      return {
        success: false,
        updatedCount: 0,
        message: `Failed to fetch students: ${studentsError.message}`,
        timestamp: startTime,
        error: studentsError.message
      };
    }

    let updatedCount = 0;

    // Calculate attendance for each student
    for (const student of students || []) {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('session_date')
        .eq('student_id', student.id);

      if (attendanceError) {
        console.error(`Failed to fetch attendance for student ${student.code}:`, attendanceError);
        continue;
      }

      // Calculate distinct sessions attended by this student
      const distinctAttendedSessions = new Set(attendanceData?.map(record => record.session_date) || []);
      const attendedSessions = distinctAttendedSessions.size;
      const attendancePercentage = Math.round((attendedSessions / totalSessions) * 100);

      // Update extra_scores table
      const { error: updateError } = await supabase
        .from('extra_scores')
        .upsert({
          student_id: student.id,
          data: { attendance_percentage: attendancePercentage },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'student_id',
          ignoreDuplicates: false
        });

      if (!updateError) {
        updatedCount++;
      }
    }

    // Store sync timestamp
    await storeSyncTimestamp(supabase, 'attendance', startTime);

    return {
      success: true,
      updatedCount,
      message: `Successfully synced attendance for ${updatedCount} students`,
      timestamp: startTime
    };

  } catch (error: any) {
    return {
      success: false,
      updatedCount: 0,
      message: `Attendance sync failed: ${error.message}`,
      timestamp: startTime,
      error: error.message
    };
  }
}

/**
 * Sync all extra scores (homework, quiz, attendance) using the comprehensive database function
 * This is the most efficient way to sync all scores at once
 */
export async function syncAllExtraScores(supabase: SupabaseClient): Promise<SyncResult> {
  const startTime = new Date();
  
  try {
    // Call the comprehensive sync function
    const { data, error } = await supabase.rpc('sync_all_extra_scores');
    
    if (error) {
      return {
        success: false,
        updatedCount: 0,
        message: `Full sync failed: ${error.message}`,
        timestamp: startTime,
        error: error.message
      };
    }

    const result = data?.[0];
    const updatedCount = result?.updated_count || 0;
    const message = result?.message || 'Sync completed';

    // Store sync timestamps for all types
    await Promise.all([
      storeSyncTimestamp(supabase, 'homework', startTime),
      storeSyncTimestamp(supabase, 'quiz', startTime),
      storeSyncTimestamp(supabase, 'attendance', startTime),
      storeSyncTimestamp(supabase, 'lastFullSync', startTime)
    ]);

    return {
      success: true,
      updatedCount,
      message,
      timestamp: startTime
    };

  } catch (error: any) {
    return {
      success: false,
      updatedCount: 0,
      message: `Full sync failed: ${error.message}`,
      timestamp: startTime,
      error: error.message
    };
  }
}

/**
 * Get the last sync timestamps for all sync types
 */
export async function getSyncTimestamps(supabase: SupabaseClient): Promise<SyncTimestamps> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['sync_homework_timestamp', 'sync_quiz_timestamp', 'sync_attendance_timestamp', 'sync_full_timestamp']);

    if (error) {
      console.error('Failed to fetch sync timestamps:', error);
      return {
        homework: null,
        quiz: null,
        attendance: null,
        lastFullSync: null
      };
    }

    const timestamps: SyncTimestamps = {
      homework: null,
      quiz: null,
      attendance: null,
      lastFullSync: null
    };

    data?.forEach(row => {
      const timestamp = row.value ? new Date(row.value) : null;
      switch (row.key) {
        case 'sync_homework_timestamp':
          timestamps.homework = timestamp;
          break;
        case 'sync_quiz_timestamp':
          timestamps.quiz = timestamp;
          break;
        case 'sync_attendance_timestamp':
          timestamps.attendance = timestamp;
          break;
        case 'sync_full_timestamp':
          timestamps.lastFullSync = timestamp;
          break;
      }
    });

    return timestamps;

  } catch (error) {
    console.error('Error fetching sync timestamps:', error);
    return {
      homework: null,
      quiz: null,
      attendance: null,
      lastFullSync: null
    };
  }
}

/**
 * Store a sync timestamp in the app_config table
 */
async function storeSyncTimestamp(
  supabase: SupabaseClient, 
  syncType: 'homework' | 'quiz' | 'attendance' | 'lastFullSync', 
  timestamp: Date
): Promise<void> {
  const keyMap = {
    homework: 'sync_homework_timestamp',
    quiz: 'sync_quiz_timestamp',
    attendance: 'sync_attendance_timestamp',
    lastFullSync: 'sync_full_timestamp'
  };

  try {
    await supabase
      .from('app_config')
      .upsert({
        key: keyMap[syncType],
        value: timestamp.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key',
        ignoreDuplicates: false
      });
  } catch (error) {
    console.error(`Failed to store ${syncType} sync timestamp:`, error);
  }
}

/**
 * Check if a sync is needed based on data freshness
 * Returns true if the last sync was more than the specified minutes ago
 */
export function isSyncNeeded(lastSyncTime: Date | null, maxAgeMinutes: number = 30): boolean {
  if (!lastSyncTime) {
    return true; // Never synced before
  }

  const now = new Date();
  const ageMinutes = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60);
  return ageMinutes > maxAgeMinutes;
}

/**
 * Sync a single student's extra scores
 * Useful for real-time updates when a student submits an exam
 */
export async function syncStudentExtraScores(
  supabase: SupabaseClient, 
  studentId: string
): Promise<SyncResult> {
  const startTime = new Date();
  
  try {
    // Call the single student sync function
    const { error } = await supabase.rpc('sync_student_extra_scores', {
      p_student_id: studentId
    });
    
    if (error) {
      return {
        success: false,
        updatedCount: 0,
        message: `Student sync failed: ${error.message}`,
        timestamp: startTime,
        error: error.message
      };
    }

    return {
      success: true,
      updatedCount: 1,
      message: `Successfully synced extra scores for student ${studentId}`,
      timestamp: startTime
    };

  } catch (error: any) {
    return {
      success: false,
      updatedCount: 0,
      message: `Student sync failed: ${error.message}`,
      timestamp: startTime,
      error: error.message
    };
  }
}