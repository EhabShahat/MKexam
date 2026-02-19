/**
 * Real-time Monitoring Optimization Module
 * 
 * Provides optimized real-time subscriptions for exam monitoring with:
 * - Minimal payload broadcasts (only changed fields)
 * - Subscription throttling (max 1 per second per exam)
 * - Shared channels (single channel per exam for multiple admins)
 * - Automatic unsubscribe on inactivity (5 minutes)
 * - Summary statistics for monitoring dashboard
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Minimal payload for attempt start events
 * Requirements: 7.1, 7.2
 */
export interface AttemptStartPayload {
  attempt_id: string;
  student_name: string | null;
  started_at: string;
}

/**
 * Minimal payload for attempt submit events
 * Requirements: 7.1, 7.3
 */
export interface AttemptSubmitPayload {
  attempt_id: string;
  submitted_at: string;
}

/**
 * Summary statistics for monitoring dashboard
 * Requirements: 7.4
 */
export interface MonitoringSummary {
  exam_id: string;
  active_count: number;
  submitted_count: number;
  last_updated: string;
}

/**
 * Subscription event types
 */
export type MonitoringEventType = 'attempt_started' | 'attempt_submitted' | 'summary_updated';

/**
 * Subscription callback function
 */
export type MonitoringCallback = (
  eventType: MonitoringEventType,
  payload: AttemptStartPayload | AttemptSubmitPayload | MonitoringSummary
) => void;

/**
 * Throttle configuration
 * Requirements: 7.5
 */
interface ThrottleConfig {
  maxPerSecond: number;
  batchWindow: number; // milliseconds
}

/**
 * Inactivity detection configuration
 * Requirements: 7.7
 */
interface InactivityConfig {
  timeoutMs: number; // 5 minutes = 300000ms
  checkIntervalMs: number;
}

/**
 * Shared channel manager for exam monitoring
 * Requirements: 7.6
 */
class SharedChannelManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscribers: Map<string, Set<MonitoringCallback>> = new Map();
  private throttleQueues: Map<string, any[]> = new Map();
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastActivity: Map<string, number> = new Map();
  private inactivityTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private throttleConfig: ThrottleConfig = {
    maxPerSecond: 1,
    batchWindow: 1000, // 1 second
  };
  
  private inactivityConfig: InactivityConfig = {
    timeoutMs: 5 * 60 * 1000, // 5 minutes
    checkIntervalMs: 60 * 1000, // Check every minute
  };

  /**
   * Get or create a shared channel for an exam
   * Requirements: 7.6
   */
  getChannel(supabase: SupabaseClient, examId: string): RealtimeChannel {
    const channelKey = `exam:${examId}:monitoring`;
    
    if (!this.channels.has(channelKey)) {
      const channel = supabase.channel(channelKey);
      this.channels.set(channelKey, channel);
      this.subscribers.set(channelKey, new Set());
      this.throttleQueues.set(channelKey, []);
      this.setupChannelListeners(channel, channelKey);
    }
    
    return this.channels.get(channelKey)!;
  }

  /**
   * Setup listeners for a channel with throttling
   * Requirements: 7.5
   */
  private setupChannelListeners(channel: RealtimeChannel, channelKey: string): void {
    // Listen for attempt start events
    channel.on('broadcast', { event: 'attempt_started' }, (payload) => {
      this.handleThrottledEvent(channelKey, 'attempt_started', payload.payload);
    });

    // Listen for attempt submit events
    channel.on('broadcast', { event: 'attempt_submitted' }, (payload) => {
      this.handleThrottledEvent(channelKey, 'attempt_submitted', payload.payload);
    });

    // Listen for summary updates
    channel.on('broadcast', { event: 'summary_updated' }, (payload) => {
      this.handleThrottledEvent(channelKey, 'summary_updated', payload.payload);
    });
  }

  /**
   * Handle events with throttling
   * Requirements: 7.5
   */
  private handleThrottledEvent(
    channelKey: string,
    eventType: MonitoringEventType,
    payload: any
  ): void {
    const queue = this.throttleQueues.get(channelKey) || [];
    queue.push({ eventType, payload, timestamp: Date.now() });
    this.throttleQueues.set(channelKey, queue);

    // Clear existing timer
    const existingTimer = this.throttleTimers.get(channelKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to process batch
    const timer = setTimeout(() => {
      this.processBatch(channelKey);
    }, this.throttleConfig.batchWindow);
    
    this.throttleTimers.set(channelKey, timer);
  }

  /**
   * Process batched events (max 1 per second per exam)
   * Requirements: 7.5
   */
  private processBatch(channelKey: string): void {
    const queue = this.throttleQueues.get(channelKey) || [];
    if (queue.length === 0) return;

    // Get the most recent event of each type
    const latestEvents = new Map<MonitoringEventType, any>();
    for (const event of queue) {
      latestEvents.set(event.eventType, event);
    }

    // Notify all subscribers with the latest events
    const subscribers = this.subscribers.get(channelKey) || new Set();
    for (const [eventType, event] of latestEvents) {
      for (const callback of subscribers) {
        try {
          callback(eventType, event.payload);
        } catch (error) {
          console.error('Error in monitoring callback:', error);
        }
      }
    }

    // Clear the queue
    this.throttleQueues.set(channelKey, []);
    this.throttleTimers.delete(channelKey);
  }

  /**
   * Subscribe to monitoring events for an exam
   * Requirements: 7.6
   */
  subscribe(
    supabase: SupabaseClient,
    examId: string,
    callback: MonitoringCallback
  ): () => void {
    const channelKey = `exam:${examId}:monitoring`;
    const channel = this.getChannel(supabase, examId);
    
    // Add subscriber
    const subscribers = this.subscribers.get(channelKey) || new Set();
    subscribers.add(callback);
    this.subscribers.set(channelKey, subscribers);

    // Subscribe to channel if this is the first subscriber
    if (subscribers.size === 1) {
      channel.subscribe();
    }

    // Update last activity
    this.updateActivity(channelKey);

    // Setup inactivity detection
    this.setupInactivityDetection(channelKey);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channelKey, callback);
    };
  }

  /**
   * Unsubscribe from monitoring events
   */
  private unsubscribe(channelKey: string, callback: MonitoringCallback): void {
    const subscribers = this.subscribers.get(channelKey);
    if (subscribers) {
      subscribers.delete(callback);
      
      // If no more subscribers, unsubscribe from channel
      if (subscribers.size === 0) {
        this.cleanupChannel(channelKey);
      }
    }
  }

  /**
   * Update last activity timestamp
   * Requirements: 7.7
   */
  updateActivity(channelKey: string): void {
    this.lastActivity.set(channelKey, Date.now());
  }

  /**
   * Setup inactivity detection for automatic unsubscribe
   * Requirements: 7.7
   */
  private setupInactivityDetection(channelKey: string): void {
    // Clear existing timer
    const existingTimer = this.inactivityTimers.get(channelKey);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Setup new timer
    const timer = setInterval(() => {
      this.checkInactivity(channelKey);
    }, this.inactivityConfig.checkIntervalMs);
    
    this.inactivityTimers.set(channelKey, timer);
  }

  /**
   * Check for inactivity and auto-unsubscribe
   * Requirements: 7.7
   */
  private checkInactivity(channelKey: string): void {
    const lastActivity = this.lastActivity.get(channelKey);
    if (!lastActivity) return;

    const now = Date.now();
    const inactiveDuration = now - lastActivity;

    if (inactiveDuration >= this.inactivityConfig.timeoutMs) {
      console.log(`Auto-unsubscribing from ${channelKey} due to inactivity`);
      this.cleanupChannel(channelKey);
    }
  }

  /**
   * Cleanup channel and all associated resources
   */
  private cleanupChannel(channelKey: string): void {
    // Unsubscribe from channel
    const channel = this.channels.get(channelKey);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelKey);
    }

    // Clear subscribers
    this.subscribers.delete(channelKey);

    // Clear throttle queue and timer
    this.throttleQueues.delete(channelKey);
    const throttleTimer = this.throttleTimers.get(channelKey);
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      this.throttleTimers.delete(channelKey);
    }

    // Clear inactivity timer
    const inactivityTimer = this.inactivityTimers.get(channelKey);
    if (inactivityTimer) {
      clearInterval(inactivityTimer);
      this.inactivityTimers.delete(channelKey);
    }

    // Clear last activity
    this.lastActivity.delete(channelKey);
  }

  /**
   * Broadcast minimal payload for attempt start
   * Requirements: 7.1, 7.2
   */
  async broadcastAttemptStart(
    supabase: SupabaseClient,
    examId: string,
    payload: AttemptStartPayload
  ): Promise<void> {
    const channel = this.getChannel(supabase, examId);
    await channel.send({
      type: 'broadcast',
      event: 'attempt_started',
      payload,
    });
  }

  /**
   * Broadcast minimal payload for attempt submit
   * Requirements: 7.1, 7.3
   */
  async broadcastAttemptSubmit(
    supabase: SupabaseClient,
    examId: string,
    payload: AttemptSubmitPayload
  ): Promise<void> {
    const channel = this.getChannel(supabase, examId);
    await channel.send({
      type: 'broadcast',
      event: 'attempt_submitted',
      payload,
    });
  }

  /**
   * Broadcast summary statistics
   * Requirements: 7.4
   */
  async broadcastSummary(
    supabase: SupabaseClient,
    examId: string,
    summary: MonitoringSummary
  ): Promise<void> {
    const channel = this.getChannel(supabase, examId);
    await channel.send({
      type: 'broadcast',
      event: 'summary_updated',
      payload: summary,
    });
  }

  /**
   * Get active channel count for monitoring
   */
  getActiveChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Get subscriber count for a channel
   */
  getSubscriberCount(examId: string): number {
    const channelKey = `exam:${examId}:monitoring`;
    const subscribers = this.subscribers.get(channelKey);
    return subscribers ? subscribers.size : 0;
  }
}

// Singleton instance
const channelManager = new SharedChannelManager();

/**
 * Subscribe to real-time monitoring for an exam
 * Requirements: 7.6
 */
export function subscribeToExamMonitoring(
  supabase: SupabaseClient,
  examId: string,
  callback: MonitoringCallback
): () => void {
  return channelManager.subscribe(supabase, examId, callback);
}

/**
 * Broadcast attempt start event
 * Requirements: 7.1, 7.2
 */
export async function broadcastAttemptStart(
  supabase: SupabaseClient,
  examId: string,
  attemptId: string,
  studentName: string | null,
  startedAt: string
): Promise<void> {
  await channelManager.broadcastAttemptStart(supabase, examId, {
    attempt_id: attemptId,
    student_name: studentName,
    started_at: startedAt,
  });
}

/**
 * Broadcast attempt submit event
 * Requirements: 7.1, 7.3
 */
export async function broadcastAttemptSubmit(
  supabase: SupabaseClient,
  examId: string,
  attemptId: string,
  submittedAt: string
): Promise<void> {
  await channelManager.broadcastAttemptSubmit(supabase, examId, {
    attempt_id: attemptId,
    submitted_at: submittedAt,
  });
}

/**
 * Broadcast summary statistics
 * Requirements: 7.4
 */
export async function broadcastMonitoringSummary(
  supabase: SupabaseClient,
  examId: string,
  activeCount: number,
  submittedCount: number
): Promise<void> {
  await channelManager.broadcastSummary(supabase, examId, {
    exam_id: examId,
    active_count: activeCount,
    submitted_count: submittedCount,
    last_updated: new Date().toISOString(),
  });
}

/**
 * Update activity timestamp to prevent auto-unsubscribe
 * Requirements: 7.7
 */
export function updateMonitoringActivity(examId: string): void {
  const channelKey = `exam:${examId}:monitoring`;
  channelManager.updateActivity(channelKey);
}

/**
 * Get monitoring statistics
 */
export function getMonitoringStats() {
  return {
    activeChannels: channelManager.getActiveChannelCount(),
  };
}
