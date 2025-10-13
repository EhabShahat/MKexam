import { useEffect, useMemo, useRef, useState } from "react";
import { UseTimerProps, UseTimerResult } from "../types";

export function useTimer({
  startedAt,
  durationMinutes,
  examEndsAt,
  onExpire,
  disabled,
  serverOffsetMs,
  onWarning,
}: UseTimerProps): UseTimerResult {
  const getNow = () => Date.now() + (serverOffsetMs || 0);
  const [now, setNow] = useState<number>(getNow());
  const firedRef = useRef(false);
  const warningsFiredRef = useRef<Set<number>>(new Set());

  const deadline = useMemo(() => {
    const deadlines: number[] = [];
    try {
      const startTime = new Date(startedAt).getTime();
      if (!isNaN(startTime) && startTime > 0) {
        if (durationMinutes && durationMinutes > 0) {
          const d = startTime + durationMinutes * 60_000;
          deadlines.push(d);
        }
      }
      if (examEndsAt) {
        const e = new Date(examEndsAt).getTime();
        if (!isNaN(e) && e > 0) deadlines.push(e);
      }
    } catch {}
    if (deadlines.length === 0) return null;
    return Math.min(...deadlines);
  }, [startedAt, durationMinutes, examEndsAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 1000);
    return () => clearInterval(id);
  }, [serverOffsetMs]);

  const remainingMs = deadline ? Math.max(0, deadline - now) : null;

  useEffect(() => {
    if (!deadline || disabled) return;
    if (remainingMs === null) return;

    try {
      const startTime = new Date(startedAt).getTime();
      const currentTime = getNow();
      if (isNaN(startTime) || startTime < 0) return;

      const timeElapsed = currentTime - startTime;

      // Require at least 50% of duration before auto-expire (or 60s if no duration)
      if (durationMinutes && durationMinutes > 0) {
        const half = (durationMinutes * 60_000) / 2;
        if (timeElapsed < half) return;
      } else {
        if (timeElapsed < 60_000) return;
      }

      // 5s grace period after deadline
      const GRACE_MS = 5000;
      const isPastDeadline = currentTime >= (deadline + GRACE_MS);
      const isFullyExpired = remainingMs === 0;

      if (isFullyExpired && isPastDeadline && !firedRef.current) {
        firedRef.current = true;
        setTimeout(() => onExpire(), 1000);
      }
    } catch {}
  }, [remainingMs, deadline, disabled, startedAt, durationMinutes, onExpire, serverOffsetMs]);

  useEffect(() => {
    if (!onWarning) return;
    if (remainingMs === null || remainingMs <= 0) return;
    const minutesLeft = Math.floor(remainingMs / 60000);
    const thresholds = [60, 30, 15, 5, 1];
    for (const t of thresholds) {
      if (minutesLeft === t && !warningsFiredRef.current.has(t)) {
        warningsFiredRef.current.add(t);
        onWarning(t);
        break;
      }
    }
  }, [remainingMs, onWarning]);

  return { remainingMs, deadline };
}