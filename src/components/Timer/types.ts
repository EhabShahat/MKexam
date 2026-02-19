export interface TimerProps {
  startedAt: string;
  durationMinutes: number | null;
  examEndsAt: string | null;
  onExpire: () => void;
  disabled?: boolean;
  serverOffsetMs?: number;
  onWarning?: (minutesLeft: number) => void;
}

export interface UseTimerProps {
  startedAt: string;
  durationMinutes: number | null;
  examEndsAt: string | null;
  onExpire: () => void;
  disabled?: boolean;
  serverOffsetMs?: number;
  onWarning?: (minutesLeft: number) => void;
}

export interface UseTimerResult {
  remainingMs: number | null;
  deadline: number | null;
}