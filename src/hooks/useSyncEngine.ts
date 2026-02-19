/**
 * React hook for managing sync engine operations
 * Provides sync status, automatic sync on page load, and manual sync triggers
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabase/client';
import { 
  syncAllExtraScores, 
  syncHomeworkScores, 
  syncQuizScores, 
  syncAttendance,
  getSyncTimestamps,
  isSyncNeeded,
  SyncResult,
  SyncTimestamps
} from '@/lib/syncEngine';

export interface SyncStatus {
  isLoading: boolean;
  lastResult: SyncResult | null;
  error: string | null;
}

export interface UseSyncEngineReturn {
  // Sync status
  syncStatus: SyncStatus;
  timestamps: SyncTimestamps | null;
  
  // Manual sync functions
  syncAll: () => Promise<SyncResult>;
  syncHomework: () => Promise<SyncResult>;
  syncQuiz: () => Promise<SyncResult>;
  syncAttendanceData: () => Promise<SyncResult>;
  
  // Utility functions
  isAutoSyncNeeded: (maxAgeMinutes?: number) => boolean;
  refreshTimestamps: () => void;
}

export function useSyncEngine(options?: {
  autoSyncOnMount?: boolean;
  autoSyncMaxAge?: number; // minutes
}): UseSyncEngineReturn {
  const { autoSyncOnMount = true, autoSyncMaxAge = 30 } = options || {};
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isLoading: false,
    lastResult: null,
    error: null
  });

  const queryClient = useQueryClient();

  // Query for sync timestamps
  const timestampsQuery = useQuery({
    queryKey: ['sync', 'timestamps'],
    queryFn: () => getSyncTimestamps(supabaseClient),
    staleTime: 1 * 60 * 1000, // Consider fresh for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Generic sync function wrapper
  const performSync = useCallback(async (
    syncFunction: () => Promise<SyncResult>,
    syncType: string
  ): Promise<SyncResult> => {
    setSyncStatus(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await syncFunction();
      
      setSyncStatus({
        isLoading: false,
        lastResult: result,
        error: result.success ? null : result.error || 'Sync failed'
      });

      // Refresh timestamps after successful sync
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['sync', 'timestamps'] });
        // Also invalidate related data queries
        queryClient.invalidateQueries({ queryKey: ['admin', 'extra-fields'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'summaries'] });
      }

      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown sync error';
      setSyncStatus({
        isLoading: false,
        lastResult: null,
        error: errorMessage
      });
      
      return {
        success: false,
        updatedCount: 0,
        message: errorMessage,
        timestamp: new Date(),
        error: errorMessage
      };
    }
  }, [queryClient]);

  // Individual sync functions
  const syncAll = useCallback(() => 
    performSync(() => syncAllExtraScores(supabaseClient), 'all'), 
    [performSync]
  );

  const syncHomework = useCallback(() => 
    performSync(() => syncHomeworkScores(supabaseClient), 'homework'), 
    [performSync]
  );

  const syncQuiz = useCallback(() => 
    performSync(() => syncQuizScores(supabaseClient), 'quiz'), 
    [performSync]
  );

  const syncAttendanceData = useCallback(() => 
    performSync(() => syncAttendance(supabaseClient), 'attendance'), 
    [performSync]
  );

  // Check if auto-sync is needed
  const isAutoSyncNeeded = useCallback((maxAgeMinutes: number = autoSyncMaxAge) => {
    if (!timestampsQuery.data) return true;
    return isSyncNeeded(timestampsQuery.data.lastFullSync, maxAgeMinutes);
  }, [timestampsQuery.data, autoSyncMaxAge]);

  // Refresh timestamps query
  const refreshTimestamps = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sync', 'timestamps'] });
  }, [queryClient]);

  // Auto-sync on mount if enabled and needed
  useEffect(() => {
    if (!autoSyncOnMount || syncStatus.isLoading) return;
    if (!timestampsQuery.data) return; // Wait for timestamps to load

    const shouldAutoSync = isAutoSyncNeeded();
    
    if (shouldAutoSync) {
      console.log('Auto-sync triggered: data is stale');
      syncAll().then(result => {
        if (result.success) {
          console.log('Auto-sync completed successfully:', result.message);
        } else {
          console.error('Auto-sync failed:', result.error);
        }
      });
    } else {
      console.log('Auto-sync skipped: data is fresh');
    }
  }, [autoSyncOnMount, timestampsQuery.data, isAutoSyncNeeded, syncAll, syncStatus.isLoading]);

  return {
    syncStatus,
    timestamps: timestampsQuery.data || null,
    syncAll,
    syncHomework,
    syncQuiz,
    syncAttendanceData,
    isAutoSyncNeeded,
    refreshTimestamps
  };
}