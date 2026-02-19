/**
 * Exam Status Utilities
 * Computes effective exam status based on scheduling mode and time
 */

export type ExamStatus = 'Draft' | 'Published' | 'Done' | 'Archived';
export type SchedulingMode = 'Auto' | 'Manual';

export interface ExamWithScheduling {
  scheduling_mode?: SchedulingMode;
  start_time: string | null;
  end_time: string | null;
  is_manually_published?: boolean;
  is_archived?: boolean;
  status: string; // Stored status (legacy)
}

export interface ExamStatusResult {
  status: ExamStatus;
  mode: SchedulingMode;
  canAccess: boolean; // Can students access this exam right now?
  isLive: boolean; // Is exam currently accepting submissions?
  isUpcoming: boolean; // Is exam scheduled for future?
  isEnded: boolean; // Has exam ended?
  statusLabel: string; // Human-readable label
  statusColor: string; // UI color class
  timeInfo?: string; // Human-readable time info
}

/**
 * Compute effective exam status
 */
export function getExamStatus(exam: ExamWithScheduling): ExamStatusResult {
  const now = new Date();
  const startTime = exam.start_time ? new Date(exam.start_time) : null;
  const endTime = exam.end_time ? new Date(exam.end_time) : null;
  const mode = exam.scheduling_mode || 'Auto';
  const isManuallyPublished = exam.is_manually_published || false;
  const isArchived = exam.is_archived || false;

  // ❌ Archived always wins
  if (isArchived) {
    return {
      status: 'Archived',
      mode,
      canAccess: false,
      isLive: false,
      isUpcoming: false,
      isEnded: false,
      statusLabel: 'Archived',
      statusColor: 'gray',
      timeInfo: 'Hidden from students',
    };
  }

  // 🔧 Manual Mode: Admin controls everything
  if (mode === 'Manual') {
    const status = isManuallyPublished ? 'Published' : 'Draft';
    return {
      status,
      mode: 'Manual',
      canAccess: isManuallyPublished,
      isLive: isManuallyPublished,
      isUpcoming: false,
      isEnded: false,
      statusLabel: isManuallyPublished ? 'Published (Manual)' : 'Draft (Manual)',
      statusColor: isManuallyPublished ? 'green' : 'gray',
      timeInfo: isManuallyPublished ? 'Manually published' : 'Not published',
    };
  }

  // ⚙️ Auto Mode: Time-based with early publish option
  if (!startTime || !endTime) {
    // No schedule set - treat as draft
    return {
      status: 'Draft',
      mode: 'Auto',
      canAccess: false,
      isLive: false,
      isUpcoming: false,
      isEnded: false,
      statusLabel: 'Draft (No Schedule)',
      statusColor: 'gray',
      timeInfo: 'Schedule not set',
    };
  }

  // Early publish override
  if (isManuallyPublished && now < startTime) {
    return {
      status: 'Published',
      mode: 'Auto',
      canAccess: true,
      isLive: true,
      isUpcoming: false,
      isEnded: false,
      statusLabel: 'Published Early',
      statusColor: 'blue',
      timeInfo: `Scheduled for ${formatDateTime(startTime)}`,
    };
  }

  // Standard time-based
  if (now < startTime) {
    return {
      status: 'Draft',
      mode: 'Auto',
      canAccess: false,
      isLive: false,
      isUpcoming: true,
      isEnded: false,
      statusLabel: 'Scheduled',
      statusColor: 'blue',
      timeInfo: `Starts ${formatDateTime(startTime)}`,
    };
  } else if (now < endTime) {
    return {
      status: 'Published',
      mode: 'Auto',
      canAccess: true,
      isLive: true,
      isUpcoming: false,
      isEnded: false,
      statusLabel: 'Live',
      statusColor: 'green',
      timeInfo: `Ends ${formatDateTime(endTime)}`,
    };
  } else {
    return {
      status: 'Done',
      mode: 'Auto',
      canAccess: false,
      isLive: false,
      isUpcoming: false,
      isEnded: true,
      statusLabel: 'Ended',
      statusColor: 'gray',
      timeInfo: `Ended ${formatDateTime(endTime)}`,
    };
  }
}

/**
 * Check if student can access exam
 */
export function canStudentAccessExam(exam: ExamWithScheduling): boolean {
  return getExamStatus(exam).canAccess;
}

/**
 * Get status icon (removed emojis)
 */
export function getStatusIcon(status: ExamStatus): string {
  return '';
}

/**
 * Format date time for display
 */
function formatDateTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  // Relative time for near future/past
  if (Math.abs(diffMs) < 1000 * 60 * 60 * 24) {
    // Within 24 hours
    if (diffMs > 0) {
      if (diffHours > 0) {
        return `in ${diffHours}h ${diffMins}m`;
      }
      return `in ${diffMins}m`;
    } else {
      if (Math.abs(diffHours) > 0) {
        return `${Math.abs(diffHours)}h ago`;
      }
      return `${Math.abs(diffMins)}m ago`;
    }
  }

  // Relative days
  if (Math.abs(diffDays) < 7) {
    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
    }
  }

  // Absolute date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get time remaining string
 */
export function getTimeRemaining(endTime: string): string {
  const now = new Date();
  const end = new Date(endTime);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return 'Ended';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 24) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMins}m left`;
  }
  return `${diffMins}m left`;
}

/**
 * Filter exams by status category
 */
export function filterExamsByCategory(
  exams: ExamWithScheduling[],
  category: 'all' | 'live' | 'upcoming' | 'ended' | 'archived'
): ExamWithScheduling[] {
  return exams.filter(exam => {
    const { isLive, isUpcoming, isEnded, status } = getExamStatus(exam);
    
    switch (category) {
      case 'all':
        return true;
      case 'live':
        return isLive;
      case 'upcoming':
        return isUpcoming;
      case 'ended':
        return isEnded;
      case 'archived':
        return status === 'Archived';
      default:
        return true;
    }
  });
}
