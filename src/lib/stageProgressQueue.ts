/**
 * Stage Progress Queue Manager
 * Handles queuing and retry logic for failed stage progress saves
 */

interface QueuedProgressSave {
  attemptId: string;
  stageId: string;
  progressData: unknown;
  completed: boolean;
  timestamp: number;
  retryCount: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const STORAGE_KEY_PREFIX = 'stage_progress_queue_';

class StageProgressQueue {
  private queue: Map<string, QueuedProgressSave> = new Map();
  private processing = false;

  constructor() {
    // Load queued items from localStorage on initialization
    this.loadFromStorage();
  }

  /**
   * Add a failed save to the queue
   */
  enqueue(
    attemptId: string,
    stageId: string,
    progressData: unknown,
    completed: boolean
  ): void {
    const key = `${attemptId}:${stageId}`;
    const existing = this.queue.get(key);

    this.queue.set(key, {
      attemptId,
      stageId,
      progressData,
      completed,
      timestamp: Date.now(),
      retryCount: existing ? existing.retryCount : 0
    });

    this.saveToStorage();
  }

  /**
   * Process queued saves with retry logic
   * Maintains insertion order and processes current batch completely before accepting new entries
   */
  async processQueue(): Promise<void> {
    if (this.processing || this.queue.size === 0) {
      return;
    }

    this.processing = true;

    try {
      // Capture current queue entries at the start of processing
      // This ensures we process entries in insertion order (Map preserves insertion order)
      // and don't process new entries added during this batch
      const entries = Array.from(this.queue.entries());

      for (const [key, item] of entries) {
        if (item.retryCount >= MAX_RETRIES) {
          console.warn('Max retries reached for stage progress save:', item);
          this.queue.delete(key);
          continue;
        }

        try {
          const response = await fetch(`/api/attempts/${item.attemptId}/stage-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage_id: item.stageId,
              progress_data: item.progressData,
              completed: item.completed
            })
          });

          if (response.ok) {
            // Success - remove from queue
            this.queue.delete(key);
          } else {
            // Failed - increment retry count
            item.retryCount++;
            this.queue.set(key, item);
          }
        } catch (error) {
          // Network error - increment retry count
          item.retryCount++;
          this.queue.set(key, item);
        }

        // Small delay between retries (skip in test environment)
        if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      this.saveToStorage();
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Check if there are pending saves
   */
  hasPendingSaves(): boolean {
    return this.queue.size > 0;
  }

  /**
   * Clear all queued items
   */
  clear(): void {
    this.queue.clear();
    this.processing = false; // Reset processing flag
    this.clearStorage();
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.queue.entries());
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}data`,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}data`);
      if (raw) {
        const data = JSON.parse(raw) as Array<[string, QueuedProgressSave]>;
        this.queue = new Map(data);
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
    }
  }

  /**
   * Clear storage
   */
  private clearStorage(): void {
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}data`);
    } catch (error) {
      console.error('Failed to clear queue storage:', error);
    }
  }
}

// Singleton instance
export const stageProgressQueue = new StageProgressQueue();

/**
 * Setup automatic queue processing on reconnection
 */
export function setupQueueProcessing(): void {
  // Process queue when coming back online
  window.addEventListener('online', () => {
    console.log('Connection restored, processing queued stage progress saves');
    stageProgressQueue.processQueue();
  });

  // Process queue periodically
  setInterval(() => {
    if (navigator.onLine && stageProgressQueue.hasPendingSaves()) {
      stageProgressQueue.processQueue();
    }
  }, RETRY_DELAY_MS);
}

/**
 * Setup only the online event listener (for testing)
 */
export function setupOnlineListener(): void {
  window.addEventListener('online', () => {
    stageProgressQueue.processQueue();
  });
}
