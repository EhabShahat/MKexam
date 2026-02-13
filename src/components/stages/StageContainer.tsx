'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Stage, StageProgress, ExamInfo, Question } from '@/lib/types';
import QuestionsStage from './QuestionsStage';
import VideoStage from './VideoStage';
import ContentStage from './ContentStage';
import type { AnswerValue } from '@/components/ExamQuestion';
import { stageProgressQueue, setupQueueProcessing } from '@/lib/stageProgressQueue';
import { useStudentLocale } from '@/components/public/PublicLocaleProvider';
import { t } from '@/i18n/student';
import { debounce } from '@/lib/debounce';
import { sanitizeProgressData, validateJSONSerializable } from '@/lib/dataValidation';
import { getCurrentTimestamp } from '@/lib/timestamp';

interface StageContainerProps {
  attemptId: string;
  stages: Stage[];
  stageProgress: StageProgress[];
  exam: ExamInfo;
  questions: Question[];
  answers: Record<string, unknown>;
  onAnswerChange: (questionId: string, value: unknown) => void;
  onSubmit: () => Promise<void>;
  serverOffsetMs?: number;
  logActivity?: (activity: string, details?: any) => void;
  onStageChange?: (stageIndex: number) => void;
}

interface StageProgressData {
  completed: boolean;
  progress_data: unknown;
  started_at?: number; // Timestamp when stage was entered
  last_saved_at?: number; // Timestamp of last successful save
}

export default function StageContainer({
  attemptId,
  stages,
  stageProgress: initialStageProgress,
  exam,
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  serverOffsetMs,
  logActivity,
  onStageChange
}: StageContainerProps) {
  const { locale } = useStudentLocale();
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageProgressMap, setStageProgressMap] = useState<Map<string, StageProgressData>>(new Map());
  const [canProgress, setCanProgress] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [enforcementMessage, setEnforcementMessage] = useState<string>('');
  const [stageLoadError, setStageLoadError] = useState<string | null>(null);
  const [fallbackToNonStaged, setFallbackToNonStaged] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'failed' | 'offline'>('synced');
  const [queuedSavesCount, setQueuedSavesCount] = useState(0);
  const stageContentRef = useRef<HTMLDivElement>(null);
  const transitionLockRef = useRef(false);
  const autoSaveLockRef = useRef(false);
  const onStageChangeRef = useRef(onStageChange);

  // Keep the ref up-to-date
  useEffect(() => {
    onStageChangeRef.current = onStageChange;
  }, [onStageChange]);

  // Initialize stage progress map from initial data
  useEffect(() => {
    try {
      // Validate stages configuration
      if (!stages || stages.length === 0) {
        setStageLoadError('No stages configured for this exam');
        setFallbackToNonStaged(true);
        console.error('Stage loading error: No stages found');
        if (logActivity) {
          logActivity('stage_load_error', {
            error: 'No stages configured',
            timestamp: getCurrentTimestamp()
          });
        }
        return;
      }

      // Validate each stage has required fields
      for (const stage of stages) {
        if (!stage.id || !stage.stage_type || !stage.configuration) {
          setStageLoadError(`Invalid stage configuration: Missing required fields`);
          setFallbackToNonStaged(true);
          console.error('Stage loading error: Invalid stage configuration', stage);
          if (logActivity) {
            logActivity('stage_load_error', {
              error: 'Invalid stage configuration',
              stage_id: stage.id,
              stage_type: stage.stage_type,
              timestamp: getCurrentTimestamp()
            });
          }
          return;
        }

        // Validate stage type
        if (!['video', 'content', 'questions'].includes(stage.stage_type)) {
          setStageLoadError(`Invalid stage type: ${stage.stage_type}`);
          setFallbackToNonStaged(true);
          console.error('Stage loading error: Invalid stage type', stage);
          if (logActivity) {
            logActivity('stage_load_error', {
              error: 'Invalid stage type',
              stage_id: stage.id,
              stage_type: stage.stage_type,
              timestamp: getCurrentTimestamp()
            });
          }
          return;
        }

        // Validate stage-specific configuration
        if (stage.stage_type === 'video') {
          const config = stage.configuration as any;
          if (!config.video_url) {
            setStageLoadError(`Video stage missing video URL`);
            setFallbackToNonStaged(true);
            console.error('Stage loading error: Video stage missing URL', stage);
            if (logActivity) {
              logActivity('stage_load_error', {
                error: 'Video stage missing video URL',
                stage_id: stage.id,
                timestamp: getCurrentTimestamp()
              });
            }
            return;
          }
        } else if (stage.stage_type === 'content') {
          const config = stage.configuration as any;
          if (!config.slides || config.slides.length === 0) {
            setStageLoadError(`Content stage has no slides`);
            setFallbackToNonStaged(true);
            console.error('Stage loading error: Content stage has no slides', stage);
            if (logActivity) {
              logActivity('stage_load_error', {
                error: 'Content stage has no slides',
                stage_id: stage.id,
                timestamp: getCurrentTimestamp()
              });
            }
            return;
          }
        } else if (stage.stage_type === 'questions') {
          const config = stage.configuration as any;
          if (!config.question_ids || config.question_ids.length === 0) {
            setStageLoadError(`Questions stage has no questions`);
            setFallbackToNonStaged(true);
            console.error('Stage loading error: Questions stage has no questions', stage);
            if (logActivity) {
              logActivity('stage_load_error', {
                error: 'Questions stage has no questions',
                stage_id: stage.id,
                timestamp: getCurrentTimestamp()
              });
            }
            return;
          }
        }
      }

      // All validation passed, initialize progress map
      const progressMap = new Map<string, StageProgressData>();
      
      initialStageProgress.forEach(progress => {
        progressMap.set(progress.stage_id, {
          completed: !!progress.completed_at,
          progress_data: progress.progress_data
        });
      });
      
      setStageProgressMap(progressMap);
      
      // Find the first incomplete stage
      const firstIncompleteIndex = stages.findIndex(stage => {
        const progress = progressMap.get(stage.id);
        return !progress?.completed;
      });
      
      if (firstIncompleteIndex !== -1) {
        setCurrentStageIndex(firstIncompleteIndex);
      }

      // Clear any previous errors
      setStageLoadError(null);
      setFallbackToNonStaged(false);
    } catch (error) {
      console.error('Unexpected error loading stages:', error);
      setStageLoadError('Failed to load exam stages');
      setFallbackToNonStaged(true);
      if (logActivity) {
        logActivity('stage_load_error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: getCurrentTimestamp()
        });
      }
    }
  }, [initialStageProgress, stages, logActivity]);

  // Notify parent when stage changes
  useEffect(() => {
    if (onStageChangeRef.current) {
      console.log('[StageContainer] Notifying parent of stage change', {
        stageIndex: currentStageIndex,
        stageId: stages[currentStageIndex]?.id,
        stageType: stages[currentStageIndex]?.stage_type,
        timestamp: getCurrentTimestamp()
      });
      onStageChangeRef.current(currentStageIndex);
    }
  }, [currentStageIndex, stages]);

  // Setup queue processing on mount
  useEffect(() => {
    setupQueueProcessing();
    
    // Update queued saves count
    const updateQueueCount = () => {
      setQueuedSavesCount(stageProgressQueue.getQueueSize());
    };
    
    updateQueueCount();
    const interval = setInterval(updateQueueCount, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('synced');
      // Process any queued saves
      stageProgressQueue.processQueue();
    };
    
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial status
    if (!navigator.onLine) {
      setSyncStatus('offline');
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const currentStage = useMemo(() => {
    const stage = stages[currentStageIndex];
    console.log('[StageContainer] currentStage updated', {
      currentStageIndex,
      stageId: stage?.id,
      stageType: stage?.stage_type
    });
    return stage;
  }, [stages, currentStageIndex]);

  // Manage focus on stage transitions
  useEffect(() => {
    if (stageContentRef.current) {
      // Focus the first interactive element in the new stage
      const firstInteractive = stageContentRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (firstInteractive) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          firstInteractive.focus();
        }, 100);
      }
    }
  }, [currentStageIndex]);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not in an input field
      const target = event.target as HTMLElement;
      const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      
      if (isInputField) {
        return;
      }

      // Handle Enter or Space on focused buttons (browser default handles this, but we ensure it)
      if ((event.key === 'Enter' || event.key === ' ') && target.tagName === 'BUTTON') {
        event.preventDefault();
        target.click();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Log stage entry when current stage changes
  useEffect(() => {
    if (currentStage && logActivity) {
      logActivity('stage_entered', {
        stage_id: currentStage.id,
        stage_type: currentStage.stage_type,
        stage_order: currentStage.stage_order
      });

      // Record the start time for this stage
      setStageProgressMap(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(currentStage.id) || { completed: false, progress_data: {} };
        if (!existing.started_at) {
          newMap.set(currentStage.id, {
            ...existing,
            started_at: getCurrentTimestamp()
          });
        }
        return newMap;
      });
    }
  }, [currentStage, logActivity]);

  // Auto-save stage progress every 30 seconds with error handling
  useEffect(() => {
    const saveStageProgress = async () => {
      if (!currentStage) return;
      
      // Check if auto-save is already in progress using ref (synchronous check)
      if (autoSaveLockRef.current) {
        console.log('[StageContainer] Auto-save already in progress, skipping');
        return;
      }
      
      const progress = stageProgressMap.get(currentStage.id);
      if (!progress?.progress_data) return;

      // Set lock using ref (synchronous) and update sync status
      autoSaveLockRef.current = true;
      setSyncStatus('syncing');
      
      try {
        const response = await fetch(`/api/attempts/${attemptId}/stage-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage_id: currentStage.id,
            progress_data: progress.progress_data,
            completed: progress.completed
          })
        });

        if (!response.ok) {
          throw new Error('Save failed');
        }

        // Update last_saved_at timestamp and sync status atomically
        setStageProgressMap(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(currentStage.id);
          if (existing) {
            newMap.set(currentStage.id, {
              ...existing,
              last_saved_at: getCurrentTimestamp()
            });
          }
          return newMap;
        });
        setSyncStatus('synced');
      } catch (error) {
        // Log network errors with request details
        console.error('[StageContainer] Auto-save failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          stageId: currentStage.id,
          stageType: currentStage.stage_type,
          attemptId,
          timestamp: getCurrentTimestamp(),
          requestUrl: `/api/attempts/${attemptId}/stage-progress`,
          progressDataSize: JSON.stringify(progress.progress_data).length
        });
        setSyncStatus('failed');
        
        // Queue for retry
        stageProgressQueue.enqueue(
          attemptId,
          currentStage.id,
          progress.progress_data,
          progress.completed
        );
        
        // Also persist to localStorage as backup
        try {
          const backupKey = `stage_backup_${attemptId}_${currentStage.id}`;
          localStorage.setItem(backupKey, JSON.stringify({
            progress_data: progress.progress_data,
            completed: progress.completed,
            timestamp: getCurrentTimestamp()
          }));
        } catch (storageError) {
          console.error('Failed to backup to localStorage:', storageError);
        }
        
        // Log the failure
        if (logActivity) {
          logActivity('stage_save_failed', {
            stage_id: currentStage.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: getCurrentTimestamp()
          });
        }
      } finally {
        // Release lock using ref
        autoSaveLockRef.current = false;
      }
    };

    // Set up auto-save interval (30 seconds)
    const interval = setInterval(saveStageProgress, 30000);

    return () => clearInterval(interval);
  }, [attemptId, currentStage, stageProgressMap, logActivity]);

  const validateEnforcement = useCallback((stageId: string, progressData?: unknown): { canProceed: boolean; message: string } => {
      const stage = stages.find(s => s.id === stageId);
      if (!stage) {
        return { canProceed: true, message: '' };
      }

      // Use provided progressData or fetch from stageProgressMap
      const progress = progressData || stageProgressMap.get(stageId)?.progress_data;

      let canProceed = true;
      let message = '';

      if (stage.stage_type === 'video') {
        const config = stage.configuration as any;
        const videoProgress = progress as any;

        // Only enforce if threshold is explicitly set
        if (config.enforcement_threshold !== undefined && config.enforcement_threshold > 0 && videoProgress?.watch_percentage !== undefined) {
          const threshold = config.enforcement_threshold;
          const watched = videoProgress.watch_percentage;

          // Log enforcement check with current values
          console.log('[StageContainer] Video enforcement check', {
            stageId,
            stageType: stage.stage_type,
            threshold,
            watched,
            timestamp: getCurrentTimestamp()
          });

          if (watched < threshold) {
            canProceed = false;
            message = `Watch ${threshold}% of the video to continue (currently ${Math.round(watched)}%)`;

            // Log enforcement violation
            console.warn('[StageContainer] Video enforcement violation', {
              stageId,
              stageType: stage.stage_type,
              required: threshold,
              actual: watched,
              deficit: threshold - watched,
              timestamp: getCurrentTimestamp()
            });

            if (logActivity) {
              logActivity('enforcement_check_failed', {
                stage_id: stageId,
                stage_type: stage.stage_type,
                enforcement_type: 'video_watch_percentage',
                required_value: threshold,
                actual_value: watched,
                reason: message,
                timestamp: getCurrentTimestamp()
              });
            }
          } else {
            // Log enforcement pass
            console.log('[StageContainer] Video enforcement passed', {
              stageId,
              threshold,
              watched,
              timestamp: getCurrentTimestamp()
            });

            if (logActivity) {
              logActivity('enforcement_check_passed', {
                stage_id: stageId,
                stage_type: stage.stage_type,
                enforcement_type: 'video_watch_percentage',
                required_value: threshold,
                actual_value: watched,
                timestamp: getCurrentTimestamp()
              });
            }
          }
        }
        // If no enforcement threshold or no progress data, allow progression
      } else if (stage.stage_type === 'content') {
        const config = stage.configuration as any;
        const contentProgress = progress as any;

        // Only enforce if minimum time is explicitly set
        if (config.minimum_read_time !== undefined && config.minimum_read_time > 0 && contentProgress?.time_spent !== undefined) {
          const minTime = config.minimum_read_time;
          const timeSpent = contentProgress.time_spent || 0;

          // Log enforcement check with current values
          console.log('[StageContainer] Content enforcement check', {
            stageId,
            stageType: stage.stage_type,
            minTime,
            timeSpent,
            timestamp: getCurrentTimestamp()
          });

          if (timeSpent < minTime) {
            canProceed = false;
            message = `Read for ${minTime - timeSpent} more seconds`;

            // Log enforcement violation
            console.warn('[StageContainer] Content enforcement violation', {
              stageId,
              stageType: stage.stage_type,
              required: minTime,
              actual: timeSpent,
              deficit: minTime - timeSpent,
              timestamp: getCurrentTimestamp()
            });

            if (logActivity) {
              logActivity('enforcement_check_failed', {
                stage_id: stageId,
                stage_type: stage.stage_type,
                enforcement_type: 'content_read_time',
                required_value: minTime,
                actual_value: timeSpent,
                reason: message,
                timestamp: getCurrentTimestamp()
              });
            }
          } else {
            // Log enforcement pass
            console.log('[StageContainer] Content enforcement passed', {
              stageId,
              minTime,
              timeSpent,
              timestamp: getCurrentTimestamp()
            });

            if (logActivity) {
              logActivity('enforcement_check_passed', {
                stage_id: stageId,
                stage_type: stage.stage_type,
                enforcement_type: 'content_read_time',
                required_value: minTime,
                actual_value: timeSpent,
                timestamp: getCurrentTimestamp()
              });
            }
          }
        }
        // If no minimum time or no progress data, allow progression
      }

      console.log('[StageContainer] validateEnforcement result', {
        stageId,
        stageType: stage.stage_type,
        canProceed,
        message
      });

      return { canProceed, message };
    }, [stages, stageProgressMap, logActivity]);

  const handleProgressUpdate = useCallback((stageId: string, progressData: unknown) => {
      setStageProgressMap(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(stageId) || { completed: false, progress_data: {} };
        newMap.set(stageId, {
          ...existing,
          progress_data: progressData
        });
        return newMap;
      });

      // Validate enforcement requirements when progress updates
      const validation = validateEnforcement(stageId, progressData);
      setCanProgress(validation.canProceed);
      setEnforcementMessage(validation.message);
    }, [validateEnforcement]);

  // Create debounced version of handleProgressUpdate (500ms delay)
  const debouncedHandleProgressUpdate = useMemo(
    () => debounce(handleProgressUpdate, 500),
    [handleProgressUpdate]
  );
  const saveStageProgress = useCallback(async (
    stageId: string,
    progressData: unknown,
    completed: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate progress data is JSON-serializable before save
      const validation = validateJSONSerializable(progressData);
      
      if (!validation.valid) {
        console.error('[StageContainer] Progress data validation failed', {
          stageId,
          error: validation.error,
          timestamp: getCurrentTimestamp()
        });
        
        // Attempt to sanitize the data
        const { sanitized, warnings } = sanitizeProgressData(progressData);
        
        if (warnings.length > 0) {
          console.warn('[StageContainer] Progress data sanitized', {
            stageId,
            warnings,
            timestamp: getCurrentTimestamp()
          });
        }
        
        // Use sanitized data for save
        progressData = sanitized;
      }
      
      const response = await fetch(`/api/attempts/${attemptId}/stage-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_id: stageId,
          progress_data: progressData,
          completed
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let userFriendlyMessage = '';
        
        // Provide user-friendly error messages based on status code
        if (response.status === 404) {
          userFriendlyMessage = 'Stage not found. Please refresh the page and try again.';
        } else if (response.status === 500) {
          userFriendlyMessage = 'Server error occurred. Please try again in a moment.';
        } else if (response.status === 403) {
          userFriendlyMessage = 'You do not have permission to save progress for this stage.';
        } else if (response.status >= 400 && response.status < 500) {
          userFriendlyMessage = errorData?.error || 'Invalid request. Please refresh the page and try again.';
        } else {
          userFriendlyMessage = errorData?.error || `Server error: ${response.status}`;
        }

        // Log network errors with request details
        console.error('[StageContainer] Save failed', {
          stageId,
          status: response.status,
          error: errorData,
          attemptId,
          timestamp: getCurrentTimestamp(),
          requestUrl: `/api/attempts/${attemptId}/stage-progress`,
          requestMethod: 'POST'
        });

        // On save failure, preserve progress in memory (already in state)
        // Add progress to localStorage backup
        try {
          const backupKey = `stage_backup_${attemptId}_${stageId}`;
          localStorage.setItem(backupKey, JSON.stringify({
            progress_data: progressData,
            completed,
            timestamp: getCurrentTimestamp()
          }));
        } catch (storageError) {
          console.error('[StageContainer] Failed to backup to localStorage:', storageError);
        }

        // Add to retry queue
        stageProgressQueue.enqueue(attemptId, stageId, progressData, completed);

        // Update sync status to 'failed'
        setSyncStatus('failed');

        return { success: false, error: userFriendlyMessage };
      }

      // Update last_saved_at timestamp on success
      setStageProgressMap(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(stageId);
        if (existing) {
          newMap.set(stageId, {
            ...existing,
            last_saved_at: getCurrentTimestamp()
          });
        }
        return newMap;
      });

      return { success: true };
    } catch (error) {
      let userFriendlyMessage = '';
      
      // Provide user-friendly error messages for network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        userFriendlyMessage = 'Network connection lost. Your progress has been saved locally and will sync when connection is restored.';
      } else if (error instanceof Error && error.name === 'AbortError') {
        userFriendlyMessage = 'Request timed out. Please check your connection and try again.';
      } else {
        userFriendlyMessage = 'Network error occurred. Your progress has been saved locally and will sync automatically.';
      }

      // Log network errors with request details
      console.error('[StageContainer] Save exception', {
        stageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        attemptId,
        timestamp: getCurrentTimestamp(),
        requestUrl: `/api/attempts/${attemptId}/stage-progress`,
        requestMethod: 'POST',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });

      // On save failure, preserve progress in memory (already in state)
      // Add progress to localStorage backup
      try {
        const backupKey = `stage_backup_${attemptId}_${stageId}`;
        localStorage.setItem(backupKey, JSON.stringify({
          progress_data: progressData,
          completed,
          timestamp: getCurrentTimestamp()
        }));
      } catch (storageError) {
        console.error('[StageContainer] Failed to backup to localStorage:', storageError);
      }

      // Add to retry queue
      stageProgressQueue.enqueue(attemptId, stageId, progressData, completed);

      // Update sync status to 'failed'
      setSyncStatus('failed');

      return { success: false, error: userFriendlyMessage };
    }
  }, [attemptId]);

  // Debug: Log when canProgress changes
  useEffect(() => {
    console.log('[StageContainer] canProgress changed:', canProgress);
  }, [canProgress]);

  // Debug: Log when currentStageIndex changes
  useEffect(() => {
    console.log('[StageContainer] currentStageIndex changed:', currentStageIndex);
  }, [currentStageIndex]);

  // Save all stage progress to ensure data is persisted before submission
  const saveAllStageProgress = useCallback(async () => {
    const savePromises = Array.from(stageProgressMap.entries()).map(async ([stageId, progress]) => {
      if (!progress?.progress_data) return;
      
      try {
        const response = await fetch(`/api/attempts/${attemptId}/stage-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage_id: stageId,
            progress_data: progress.progress_data,
            completed: progress.completed
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save progress for stage ${stageId}`);
        }
      } catch (error) {
        console.error(`Failed to save stage progress for ${stageId}:`, error);
        throw error;
      }
    });
    
    await Promise.all(savePromises);
  }, [attemptId, stageProgressMap]);

  // Validate all stages are complete before submission
  // Validate all stages are complete before submission
    const validateAllStagesComplete = useCallback((): { valid: boolean; incompleteStages: Array<{ index: number; type: string; reason: string }> } => {
      const incompleteStages: Array<{ index: number; type: string; reason: string }> = [];

      stages.forEach((stage, index) => {
        const progress = stageProgressMap.get(stage.id);

        // Check if stage is completed
        if (!progress?.completed) {
          incompleteStages.push({
            index: index + 1,
            type: stage.stage_type,
            reason: 'Not completed'
          });
          return;
        }

        // Check enforcement requirements are met for video stages
        if (stage.stage_type === 'video') {
          const config = stage.configuration as any;
          const progressData = progress.progress_data as any;

          // Only validate if enforcement threshold is explicitly set and greater than 0
          if (config.enforcement_threshold !== undefined && config.enforcement_threshold > 0) {
            if (progressData?.watch_percentage === undefined) {
              incompleteStages.push({
                index: index + 1,
                type: stage.stage_type,
                reason: 'Video watch progress not recorded'
              });
            } else if (progressData.watch_percentage < config.enforcement_threshold) {
              incompleteStages.push({
                index: index + 1,
                type: stage.stage_type,
                reason: `Video watch requirement not met (${Math.round(progressData.watch_percentage)}% of ${config.enforcement_threshold}% required)`
              });
            }
          }
        } 
        // Check enforcement requirements are met for content stages
        else if (stage.stage_type === 'content') {
          const config = stage.configuration as any;
          const progressData = progress.progress_data as any;

          // Only validate if minimum read time is explicitly set and greater than 0
          if (config.minimum_read_time !== undefined && config.minimum_read_time > 0) {
            const timeSpent = progressData?.time_spent || 0;

            if (timeSpent < config.minimum_read_time) {
              incompleteStages.push({
                index: index + 1,
                type: stage.stage_type,
                reason: `Minimum read time not met (${timeSpent}s of ${config.minimum_read_time}s required)`
              });
            }
          }
        }
        // Questions stage - no additional enforcement beyond completion
      });

      return {
        valid: incompleteStages.length === 0,
        incompleteStages
      };
    }, [stages, stageProgressMap]);

  const handleStageComplete = useCallback(async () => {
      // Check if transition is already in progress using ref (synchronous check)
      // This is the FIRST and ONLY check - if lock is held, return immediately
      if (transitionLockRef.current) {
        console.log('[StageContainer] Transition lock active, ignoring click');
        return;
      }

      // Set transition lock IMMEDIATELY before any async operations
      transitionLockRef.current = true;

      try {
        if (isTransitioning) {
          console.log('[StageContainer] Already transitioning, ignoring click');
          return;
        }

        console.log('[StageContainer] handleStageComplete called', {
          currentStageIndex,
          totalStages: stages.length,
          currentStageId: currentStage.id
        });

        // Validate next stage exists before transition
        if (currentStageIndex < stages.length - 1) {
          const nextStage = stages[currentStageIndex + 1];
          if (!nextStage) {
            setTransitionError('Next stage not found. Please contact support.');
            console.error('Stage transition error: Next stage not found', {
              currentIndex: currentStageIndex,
              totalStages: stages.length
            });
            if (logActivity) {
              logActivity('stage_transition_error', {
                error: 'Next stage not found',
                current_stage_index: currentStageIndex,
                timestamp: getCurrentTimestamp()
              });
            }
            return;
          }
        }

        // Validate enforcement requirements directly from fresh progress data
        const currentProgress = stageProgressMap.get(currentStage.id);
        const validation = validateEnforcement(currentStage.id, currentProgress?.progress_data);

        console.log('[StageContainer] Enforcement validation', {
          stageId: currentStage.id,
          canProceed: validation.canProceed,
          message: validation.message
        });

        if (!validation.canProceed) {
          setTransitionError(validation.message);
          console.log('[StageContainer] Enforcement failed, blocking transition');

          if (logActivity) {
            logActivity('enforcement_violation', {
              stage_id: currentStage.id,
              stage_type: currentStage.stage_type,
              message: validation.message,
              timestamp: getCurrentTimestamp()
            });
          }

          return;
        }

        console.log('[StageContainer] Enforcement passed, proceeding with transition');

        setIsTransitioning(true);
        setTransitionError(null);

        // Mark current stage as completed
        const currentProgressData = stageProgressMap.get(currentStage.id);
        const startedAt = currentProgressData?.started_at || getCurrentTimestamp();
        const timeSpent = Math.round((getCurrentTimestamp() - startedAt) / 1000); // Time in seconds

        console.log('[StageContainer] Marking stage as completed', {
          stageId: currentStage.id,
          timeSpent
        });

        // Prepare the updated progress data with completed flag
        const updatedProgressData = {
          ...(currentProgressData || { progress_data: {} }),
          completed: true
        };

        setStageProgressMap(prev => {
          const newMap = new Map(prev);
          newMap.set(currentStage.id, updatedProgressData);
          return newMap;
        });

        // Log stage completion
        if (logActivity) {
          logActivity('stage_completed', {
            stage_id: currentStage.id,
            time_spent: timeSpent,
            completion_data: currentProgressData?.progress_data || {}
          });
        }

        // CRITICAL: Save progress to server BEFORE updating stage index
        // Use the updatedProgressData we just created to ensure we save the latest state
        console.log('[StageContainer] Saving progress to server before transition');
        const saveResult = await saveStageProgress(
          currentStage.id,
          updatedProgressData.progress_data || {},
          true
        );

        // Only proceed if save succeeds
        if (!saveResult.success) {
          console.error('[StageContainer] Failed to save progress', {
            error: saveResult.error
          });
          setTransitionError(saveResult.error || 'Failed to save stage progress. Please try again.');

          // Log the failure
          if (logActivity) {
            logActivity('stage_save_failed', {
              stage_id: currentStage.id,
              error: saveResult.error,
              timestamp: Date.now()
            });
          }

          return;
        }

        console.log('[StageContainer] Progress saved successfully');

        // Move to next stage or validate and submit
        if (currentStageIndex < stages.length - 1) {
          console.log('[StageContainer] Moving to next stage', {
            from: currentStageIndex,
            to: currentStageIndex + 1
          });

          // CRITICAL: Update stage index AFTER successful save
          // Parent notification will happen via useEffect after state update
          const nextIndex = currentStageIndex + 1;
          const nextStage = stages[nextIndex];

          // Update local state first
          setCurrentStageIndex(nextIndex);
          setCanProgress(false);
          setEnforcementMessage('');

          console.log('[StageContainer] Stage index updated to', nextIndex);
          console.log('[StageContainer] Parent will be notified via useEffect');

          // Log successful transition
          if (logActivity) {
            logActivity('stage_transition_success', {
              from_stage_id: currentStage.id,
              from_stage_type: currentStage.stage_type,
              from_stage_index: currentStageIndex,
              to_stage_id: nextStage.id,
              to_stage_type: nextStage.stage_type,
              to_stage_index: nextIndex,
              time_spent: timeSpent,
              timestamp: getCurrentTimestamp()
            });
          }
        } else {
          console.log('[StageContainer] Last stage reached, validating for submission');

          // This is the last stage - validate all stages before submission
          const validation = validateAllStagesComplete();

          if (!validation.valid) {
            // Display list of incomplete stages
            const incompleteList = validation.incompleteStages
              .map(s => `Stage ${s.index} (${s.type}): ${s.reason}`)
              .join('\n');

          // Log validation errors with stage configuration
          console.error('[StageContainer] Validation failed', {
            incompleteStages: validation.incompleteStages,
            totalStages: stages.length,
            currentStageIndex,
            attemptId,
            timestamp: getCurrentTimestamp(),
            stageConfigurations: validation.incompleteStages.map(s => ({
              index: s.index,
              type: s.type,
              reason: s.reason
            }))
          });
            setTransitionError(
              `Cannot submit exam. The following stages are incomplete:\n\n${incompleteList}`
            );

            return;
          }

          // Save all stage progress before submission
          try {
            console.log('[StageContainer] Saving all stage progress before submission');
            await saveAllStageProgress();
          } catch (error) {
            console.error('Failed to save all stage progress:', error);
            setTransitionError('Failed to save stage progress. Please try again.');

            return;
          }

          // All stages complete and progress saved, trigger submission
          console.log('[StageContainer] Triggering exam submission');
          await onSubmit();
        }
      } catch (error) {
        // Log state errors with current state snapshot
        console.error('[StageContainer] Stage completion error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          currentStageIndex,
          currentStageId: currentStage.id,
          stageType: currentStage.stage_type,
          attemptId,
          timestamp: getCurrentTimestamp(),
          stageProgressMapSize: stageProgressMap.size,
          isTransitioning
        });
        setTransitionError(error instanceof Error ? error.message : 'Failed to complete stage');

        // Log transition failure
        if (logActivity) {
          logActivity('stage_transition_failed', {
            stage_id: currentStage.id,
            stage_type: currentStage.stage_type,
            stage_index: currentStageIndex,
            error: error instanceof Error ? error.message : 'Unknown error',
            error_type: error instanceof Error ? error.constructor.name : 'Unknown',
            timestamp: getCurrentTimestamp()
          });
        }
      } finally {
        // Release locks using refs
        transitionLockRef.current = false;
        setIsTransitioning(false);
        console.log('[StageContainer] Transition complete');
      }
    }, [attemptId, currentStage, currentStageIndex, isTransitioning, onSubmit, stageProgressMap, stages, validateEnforcement, validateAllStagesComplete, saveAllStageProgress, saveStageProgress, logActivity, onStageChange]);

  const handleRetryTransition = useCallback(() => {
    setTransitionError(null);
    handleStageComplete();
  }, [handleStageComplete]);

  if (!currentStage) {
    return (
      <div className="card">
        <p>Loading stage...</p>
      </div>
    );
  }

  // Display stage loading error with fallback option
  if (stageLoadError) {
    return (
      <div className="card" role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#dc2626" 
              strokeWidth="2"
              className="flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="flex-1">
              <h3 className="text-red-700 font-medium mb-2">Stage Configuration Error</h3>
              <p className="text-red-600 text-sm mb-4">{stageLoadError}</p>
              {fallbackToNonStaged && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-yellow-800 text-sm mb-3">
                    The exam will continue in standard mode without stages. Please contact your instructor if this issue persists.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn btn-primary"
                  >
                    Reload Exam
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-container" role="main" aria-label="Exam stages">
      {/* Stage announcement for screen readers */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        Stage {currentStageIndex + 1} of {stages.length}: {currentStage.stage_type} stage
      </div>

      {/* Sync Status Indicator */}
      {(syncStatus === 'failed' || syncStatus === 'offline' || queuedSavesCount > 0) && (
        <div 
          className="sync-status-banner"
          role="alert"
          aria-live="polite"
        >
          {syncStatus === 'offline' && (
            <div className="sync-status-content offline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
              <span>Offline - Progress will sync when connection is restored</span>
            </div>
          )}
          {syncStatus === 'failed' && queuedSavesCount > 0 && (
            <div className="sync-status-content failed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Sync Failed - {queuedSavesCount} save{queuedSavesCount !== 1 ? 's' : ''} queued for retry</span>
              <button
                onClick={() => stageProgressQueue.processQueue()}
                className="retry-button"
                aria-label="Retry syncing now"
              >
                Retry Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Current Stage Content */}
      <div 
        key={`stage-${currentStage.id}-${currentStageIndex}`}
        ref={stageContentRef}
        className="stage-content" 
        role="region" 
        aria-label={`${currentStage.stage_type} stage content`}
        tabIndex={-1}
      >
        {currentStage.stage_type === 'video' && (
          <VideoStage
            key={`video-${currentStage.id}`}
            stage={{
              id: currentStage.id,
              configuration: currentStage.configuration as any,
            }}
            progress={(stageProgressMap.get(currentStage.id)?.progress_data as any) || {
              watch_percentage: 0,
              total_watch_time: 0,
              last_position: 0,
              watched_segments: []
            }}
            onProgressUpdate={(progress) => debouncedHandleProgressUpdate(currentStage.id, progress)}
            onComplete={() => setCanProgress(true)}
            disabled={false}
            logActivity={logActivity}
          />
        )}

        {currentStage.stage_type === 'content' && (
          <ContentStage
            key={`content-${currentStage.id}`}
            stage={{
              id: currentStage.id,
              configuration: currentStage.configuration as any,
            }}
            progress={(stageProgressMap.get(currentStage.id)?.progress_data as any) || {
              current_slide_index: 0,
              slide_times: {}
            }}
            onProgressUpdate={(progress) => debouncedHandleProgressUpdate(currentStage.id, progress)}
            onComplete={() => setCanProgress(true)}
            disabled={false}
            logActivity={logActivity}
          />
        )}

        {currentStage.stage_type === 'questions' && (
          <QuestionsStage
            key={`questions-${currentStage.id}`}
            stage={{
              id: currentStage.id,
              configuration: currentStage.configuration as any,
            }}
            questions={questions}
            answers={answers as Record<string, AnswerValue>}
            onAnswerChange={(questionId, value) => onAnswerChange(questionId, value)}
            onProgressUpdate={(progress) => debouncedHandleProgressUpdate(currentStage.id, progress)}
            onComplete={() => setCanProgress(true)}
            disabled={false}
            displayMode={(exam.settings?.display_mode as 'full' | 'per_question') || 'full'}
            attemptId={attemptId}
          />
        )}
      </div>

      {/* Navigation Controls */}
      <div className="stage-navigation" role="navigation" aria-label="Stage navigation">
        {/* Enforcement message */}
        {enforcementMessage && (
          <div className="enforcement-message" role="status" aria-live="polite" aria-atomic="true">
            <span className="enforcement-icon" aria-hidden="true">⚠️</span>
            <span>{enforcementMessage}</span>
          </div>
        )}

        {/* Transition error */}
        {transitionError && (
          <div className="error-message" role="alert" aria-live="assertive">
            <span className="error-icon" aria-hidden="true">❌</span>
            <div style={{ flex: 1 }}>
              {transitionError.includes('\n') ? (
                // Multi-line error (e.g., incomplete stages list)
                transitionError.split('\n').map((line, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: idx === 0 ? '0.5rem' : '0.25rem',
                    fontWeight: idx === 0 ? '600' : '400'
                  }}>
                    {line}
                  </div>
                ))
              ) : (
                // Single-line error
                <div style={{ fontWeight: '500' }}>{transitionError}</div>
              )}
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleRetryTransition}
              style={{ marginLeft: '1rem' }}
              aria-label="Retry stage transition"
            >
              {t(locale, 'retry') || 'Retry'}
            </button>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="navigation-buttons">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              console.log('[StageContainer] Button clicked!', {
                canProgress,
                isTransitioning,
                transitionLock: transitionLockRef.current
              });
              handleStageComplete();
            }}
            disabled={!canProgress || isTransitioning || transitionLockRef.current}
            aria-label={
              !canProgress && enforcementMessage
                ? `Cannot proceed: ${enforcementMessage}`
                : isTransitioning || transitionLockRef.current
                ? 'Transition in progress, please wait'
                : currentStageIndex < stages.length - 1
                ? t(locale, 'continue_stage')
                : t(locale, 'submit_exam')
            }
            aria-disabled={!canProgress || isTransitioning || transitionLockRef.current}
          >
            {isTransitioning || transitionLockRef.current ? t(locale, 'processing') : 
             currentStageIndex < stages.length - 1 ? t(locale, 'continue_stage') : t(locale, 'submit_exam')}
          </button>
        </div>
      </div>

      <style jsx>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        .sync-status-banner {
          margin-bottom: 1rem;
          border-radius: 6px;
          overflow: hidden;
        }

        .sync-status-content {
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .sync-status-content.offline {
          background: #fef3c7;
          border: 1px solid #fbbf24;
          color: #92400e;
        }

        .sync-status-content.failed {
          background: #fee2e2;
          border: 1px solid #ef4444;
          color: #991b1b;
        }

        .retry-button {
          margin-left: auto;
          padding: 0.25rem 0.75rem;
          background: white;
          border: 1px solid currentColor;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .retry-button:hover {
          background: currentColor;
          color: white;
        }

        .stage-navigation {
          margin-top: 2rem;
          padding: 1.5rem;
          background: var(--bg-secondary, #f8f9fa);
          border-radius: 8px;
        }

        .enforcement-message {
          padding: 1rem;
          background: var(--warning-bg, #fff3cd);
          border: 1px solid var(--warning-border, #ffc107);
          border-radius: 6px;
          color: var(--warning-text, #856404);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .enforcement-icon {
          font-size: 1.25rem;
        }

        .error-message {
          padding: 1rem;
          background: var(--danger-bg, #f8d7da);
          border: 1px solid var(--danger-border, #dc3545);
          border-radius: 6px;
          color: var(--danger-text, #721c24);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .error-icon {
          font-size: 1.25rem;
        }

        .navigation-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* RTL Support */
        [dir="rtl"] .stage-container {
          direction: rtl;
        }

        [dir="rtl"] .navigation-buttons {
          justify-content: flex-start;
        }

        [dir="rtl"] .enforcement-message,
        [dir="rtl"] .error-message {
          flex-direction: row-reverse;
        }

        [dir="rtl"] .sync-status-content {
          flex-direction: row-reverse;
        }

        [dir="rtl"] .retry-button {
          margin-left: 0;
          margin-right: auto;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .stage-navigation {
            padding: 1rem;
          }

          .navigation-buttons {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }

          .sync-status-content {
            flex-wrap: wrap;
          }

          .retry-button {
            margin-left: 0;
            width: 100%;
            margin-top: 0.5rem;
          }

          [dir="rtl"] .retry-button {
            margin-right: 0;
          }
        }
      `}</style>
    </div>
  );
}
