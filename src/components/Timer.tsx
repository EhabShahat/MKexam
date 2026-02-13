"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function Timer({
  startedAt,
  durationMinutes,
  examEndsAt,
  onExpire,
  onWarning,
  disabled,
  serverOffsetMs,
}: {
  startedAt: string;
  durationMinutes: number | null;
  examEndsAt: string | null;
  onExpire: () => void;
  onWarning?: (minutesLeft: number) => void;
  disabled?: boolean;
  serverOffsetMs?: number; // difference = server_now - Date.now()
}) {
  // Helper to get a clock aligned with server time (if provided)
  const getNow = () => Date.now() + (serverOffsetMs || 0);
  const [now, setNow] = useState<number>(getNow());
  const firedRef = useRef(false);
  const warningsFiredRef = useRef<Set<number>>(new Set());

  const deadline = useMemo(() => {
    const deadlines: number[] = [];
    
    try {
      // Enhanced Validation 1: Validate startedAt is a valid date string
      if (!startedAt || typeof startedAt !== 'string') {
        console.error("Timer: Invalid startedAt value (not a string)", { 
          startedAt, 
          type: typeof startedAt 
        });
        return null;
      }
      
      // Enhanced Validation 2: Check string is not empty after trim
      if (startedAt.trim().length === 0) {
        console.error("Timer: startedAt is empty string");
        return null;
      }
      
      // Enhanced Validation 3: Attempt to parse the date
      let startTime: number;
      try {
        startTime = new Date(startedAt).getTime();
      } catch (parseError) {
        console.error("Timer: Failed to parse startedAt", { startedAt, error: parseError });
        return null;
      }
      
      // Enhanced Validation 4: Check if date is valid and not in the far future/past
      if (isNaN(startTime) || startTime < 0) {
        console.error("Timer: Invalid startedAt date (NaN or negative)", { 
          startedAt, 
          startTime,
          isNaN: isNaN(startTime)
        });
        return null;
      }
      
      // Enhanced Validation 5: Check for unreasonably old dates (more than 1 year ago)
      const ONE_YEAR_AGO = Date.now() - (365 * 24 * 60 * 60 * 1000);
      if (startTime < ONE_YEAR_AGO) {
        console.error("Timer: startedAt is more than 1 year old", {
          startedAt: new Date(startTime).toISOString(),
          oneYearAgo: new Date(ONE_YEAR_AGO).toISOString()
        });
        return null;
      }
      
      // Enhanced Validation 6: start time shouldn't be in the future by more than 1 minute
      const now = Date.now();
      if (startTime > now + 60000) {
        console.error("Timer: startedAt is in the future", { 
          startedAt: new Date(startTime).toISOString(),
          now: new Date(now).toISOString(),
          difference: Math.floor((startTime - now) / 1000) + "s"
        });
        return null;
      }
      
      // Enhanced Validation 7: Validate durationMinutes is reasonable
      if (durationMinutes !== null && durationMinutes !== undefined) {
        if (typeof durationMinutes !== 'number' || isNaN(durationMinutes)) {
          console.error("Timer: Invalid durationMinutes (not a number)", { 
            durationMinutes, 
            type: typeof durationMinutes 
          });
          return null;
        }
        
        if (durationMinutes < 0) {
          console.error("Timer: durationMinutes is negative", { durationMinutes });
          return null;
        }
        
        // Max 24 hours (1440 minutes) to catch unreasonable values
        if (durationMinutes > 1440) {
          console.error("Timer: durationMinutes exceeds maximum (24 hours)", { durationMinutes });
          return null;
        }
      }
      
      // Calculate deadline from duration
      if (durationMinutes && durationMinutes > 0) {
        const durationDeadline = startTime + durationMinutes * 60_000;
        
        // Enhanced Validation 8: Check deadline is not too far in future (max 25 hours from now)
        const MAX_FUTURE = (Date.now() + (serverOffsetMs || 0)) + (25 * 60 * 60 * 1000);
        if (durationDeadline > MAX_FUTURE) {
          console.error("Timer: Duration deadline is too far in the future", {
            deadline: new Date(durationDeadline).toISOString(),
            maxAllowed: new Date(MAX_FUTURE).toISOString()
          });
          return null;
        }
        
        // Sanity check: deadline should be in the future
        if (durationDeadline > (Date.now() + (serverOffsetMs || 0))) {
          deadlines.push(durationDeadline);
          console.log("Timer: Duration deadline set to", new Date(durationDeadline).toISOString(), 
            `(${durationMinutes} minutes)`);
        } else {
          console.warn("Timer: Duration deadline is in the past, might be expired", {
            deadline: new Date(durationDeadline).toISOString(),
            now: new Date(Date.now() + (serverOffsetMs || 0)).toISOString()
          });
          // Still add it but log the warning
          deadlines.push(durationDeadline);
        }
      }
      
      // Calculate deadline from exam end time
      if (examEndsAt) {
        // Enhanced Validation 9: Validate examEndsAt format
        if (typeof examEndsAt !== 'string' || examEndsAt.trim().length === 0) {
          console.warn("Timer: Invalid examEndsAt format", { 
            examEndsAt, 
            type: typeof examEndsAt 
          });
        } else {
          let endTime: number;
          try {
            endTime = new Date(examEndsAt).getTime();
          } catch (parseError) {
            console.error("Timer: Failed to parse examEndsAt", { examEndsAt, error: parseError });
            endTime = NaN;
          }
          
          if (!isNaN(endTime) && endTime > 0) {
            // Enhanced Validation 10: examEndsAt shouldn't be before startedAt
            if (endTime < startTime) {
              console.error("Timer: examEndsAt is before startedAt", {
                examEndsAt: new Date(endTime).toISOString(),
                startedAt: new Date(startTime).toISOString()
              });
            } else {
              deadlines.push(endTime);
              console.log("Timer: Exam end deadline set to", new Date(endTime).toISOString());
            }
          } else {
            console.warn("Timer: Invalid examEndsAt timestamp", { examEndsAt, endTime });
          }
        }
      }
    } catch (error) {
      console.error("Timer: Critical error parsing dates", error, {
        startedAt,
        durationMinutes,
        examEndsAt,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
    
    if (deadlines.length === 0) {
      console.warn("Timer: No valid deadlines calculated", {
        startedAt,
        durationMinutes,
        examEndsAt
      });
      return null;
    }
    
    const finalDeadline = Math.min(...deadlines);
    console.log("Timer: Final deadline calculated", new Date(finalDeadline).toISOString());
    return finalDeadline;
  }, [startedAt, durationMinutes, examEndsAt, serverOffsetMs]);

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 1000);
    return () => clearInterval(id);
  }, [serverOffsetMs]);

  const remainingMs = deadline ? Math.max(0, deadline - now) : null;

  useEffect(() => {
    // Early exits to prevent false triggers
    if (!deadline || disabled || firedRef.current) return;
    if (remainingMs === null) return; // No valid time remaining
    
    // CRITICAL SAFETY CHECKS to prevent premature auto-submission
    try {
      const startTime = new Date(startedAt).getTime();
      const currentTime = getNow();
      
      // Safety check 1: Validate start time is sane
      if (isNaN(startTime) || startTime < 0) {
        console.error("Timer: Invalid start time, refusing to expire", startedAt);
        return;
      }
      
      const timeElapsed = currentTime - startTime;
      
      // Safety check 2: For AUTO-SUBMISSION, exam must run for at least 50% of duration
      // This prevents premature auto-submit due to bugs or data issues
      if (durationMinutes && durationMinutes > 0) {
        const halfDurationMs = (durationMinutes * 60_000) / 2; // 50% of exam duration
        if (timeElapsed < halfDurationMs) {
          console.warn("Timer: Auto-submission blocked - less than 50% of exam time elapsed", {
            elapsed: Math.floor(timeElapsed / 1000) + "s",
            required: Math.floor(halfDurationMs / 1000) + "s",
            percentComplete: Math.round((timeElapsed / (durationMinutes * 60_000)) * 100) + "%",
            durationMinutes
          });
          return;
        }
        console.log("Timer: 50% duration check passed", {
          elapsed: Math.floor(timeElapsed / 1000) + "s",
          halfDuration: Math.floor(halfDurationMs / 1000) + "s",
          percentComplete: Math.round((timeElapsed / (durationMinutes * 60_000)) * 100) + "%"
        });
      } else {
        // Fallback: if no duration set, require at least 60 seconds
        const MIN_RUNTIME_MS = 60000; // 60 seconds minimum
        if (timeElapsed < MIN_RUNTIME_MS) {
          console.log("Timer: Exam hasn't run long enough (no duration set)", {
            elapsed: Math.floor(timeElapsed / 1000),
            required: Math.floor(MIN_RUNTIME_MS / 1000)
          });
          return;
        }
      }
      
      // Safety check 3: Current time must genuinely be past deadline
      // Use strict comparison with 5-second grace period to avoid edge cases
      const GRACE_PERIOD_MS = 5000;
      const isPastDeadline = currentTime >= (deadline + GRACE_PERIOD_MS);
      
      // Safety check 4: remainingMs must be exactly 0 (fully expired)
      const isFullyExpired = remainingMs === 0;
      
      // Only fire expiration if ALL conditions are met
      if (isFullyExpired && isPastDeadline) {
        console.log("Timer: All auto-submission conditions met", {
          remainingMs,
          currentTime: new Date(currentTime).toISOString(),
          deadline: new Date(deadline).toISOString(),
          timeElapsed: Math.floor(timeElapsed / 1000) + "s",
          durationMinutes
        });
        
        firedRef.current = true;
        
        // Add delay to prevent race conditions
        setTimeout(() => {
          console.log("Timer: Triggering auto-submission (onExpire callback)");
          onExpire();
        }, 1000);
      } else if (remainingMs === 0) {
        // Log why we didn't expire even though time is 0
        console.warn("Timer: Time is 0 but safety checks prevented auto-submission", {
          isPastDeadline,
          timeElapsed: Math.floor(timeElapsed / 1000),
          gracePeriod: GRACE_PERIOD_MS / 1000,
          durationMinutes
        });
      }
    } catch (error) {
      console.error("Timer: Error in expiration check", error);
      return;
    }
    
    // Fire warnings at specific intervals
    if (onWarning && remainingMs !== null && remainingMs > 0) {
      const minutesLeft = Math.floor(remainingMs / 60000);
      const warningThresholds = [60, 30, 15, 5, 1]; // 1 hour, 30 min, 15 min, 5 min, 1 min
      
      for (const threshold of warningThresholds) {
        if (minutesLeft === threshold && !warningsFiredRef.current.has(threshold)) {
          warningsFiredRef.current.add(threshold);
          onWarning(threshold);
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, deadline, disabled, startedAt, durationMinutes, onWarning]);

  if (!deadline) return null;

  const text = formatDuration(remainingMs ?? 0);
  const minutesLeft = Math.floor((remainingMs ?? 0) / 60000);
  const low = (remainingMs ?? 0) <= 60_000; // Last minute
  const warning = minutesLeft <= 60 && minutesLeft > 1; // Less than 1 hour but more than 1 minute

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-medium ${
        low 
          ? "bg-red-100 text-red-700 border border-red-200" 
          : warning
          ? "bg-orange-100 text-orange-700 border border-orange-200"
          : "bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]"
      }`}
      role="timer"
      aria-live="polite"
      aria-label="Time remaining"
      aria-atomic="true"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
      {text}
    </div>
  );
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
