/**
 * React Hook for Real-time Monitoring
 * 
 * Provides optimized real-time subscriptions with:
 * - Automatic activity tracking
 * - Cleanup on unmount
 * - Type-safe event handling
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSupabase } from '@/lib/supabase/client';
import {
  subscribeToExamMonitoring,
  updateMonitoringActivity,
  MonitoringEventType,
  AttemptStartPayload,
  AttemptSubmitPayload,
  MonitoringSummary,
} from '@/lib/realtimeMonitoring';

/**
 * Event handlers for monitoring events
 */
export interface MonitoringEventHandlers {
  onAttemptStarted?: (payload: AttemptStartPayload) => void;
  onAttemptSubmitted?: (payload: AttemptSubmitPayload) => void;
  onSummaryUpdated?: (payload: MonitoringSummary) => void;
}

/**
 * Hook options
 */
export interface UseRealtimeMonitoringOptions {
  examId: string;
  enabled?: boolean;
  handlers: MonitoringEventHandlers;
}

/**
 * Hook for real-time monitoring with automatic activity tracking
 * Requirements: 7.6, 7.7
 */
export function useRealtimeMonitoring({
  examId,
  enabled = true,
  handlers,
}: UseRealtimeMonitoringOptions) {
  const supabase = useSupabase();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize the callback to avoid re-subscribing
  const handleEvent = useCallback(
    (eventType: MonitoringEventType, payload: any) => {
      switch (eventType) {
        case 'attempt_started':
          handlers.onAttemptStarted?.(payload as AttemptStartPayload);
          break;
        case 'attempt_submitted':
          handlers.onAttemptSubmitted?.(payload as AttemptSubmitPayload);
          break;
        case 'summary_updated':
          handlers.onSummaryUpdated?.(payload as MonitoringSummary);
          break;
      }
    },
    [handlers]
  );

  useEffect(() => {
    if (!enabled || !examId) return;

    // Subscribe to monitoring events
    unsubscribeRef.current = subscribeToExamMonitoring(
      supabase,
      examId,
      handleEvent
    );

    // Setup activity tracking to prevent auto-unsubscribe
    // Update activity every 2 minutes (well before the 5-minute timeout)
    activityIntervalRef.current = setInterval(() => {
      updateMonitoringActivity(examId);
    }, 2 * 60 * 1000);

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };
  }, [enabled, examId, supabase, handleEvent]);

  // Manual activity update (e.g., on user interaction)
  const trackActivity = useCallback(() => {
    if (examId) {
      updateMonitoringActivity(examId);
    }
  }, [examId]);

  return {
    trackActivity,
  };
}
