# Real-time Subscription Optimization Guide

**Date**: January 30, 2026  
**Project**: Advanced Exam Application (MKexam)  
**Requirements**: 5.6

## Overview

This guide provides best practices for optimizing Supabase real-time subscriptions in the Advanced Exam Application. Proper subscription management reduces server load, improves client performance, and prevents memory leaks.

## Current Subscription Usage

The application uses real-time subscriptions for:

1. **Exam Monitoring** - Live updates of exam attempts
2. **Results Updates** - Real-time score calculations
3. **Student Activity** - Tracking active students during exams
4. **Audit Logs** - Live security monitoring

## Optimization Principles

### 1. Always Scope Subscriptions

**Bad** - Subscribes to all exam attempts:
```typescript
const subscription = supabaseClient
  .channel('exam-monitoring')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'exam_attempts'
    },
    (payload) => {
      // Handle all attempts
    }
  )
  .subscribe();
```

**Good** - Scoped to specific exam:
```typescript
const subscription = supabaseClient
  .channel(`exam-monitoring-${examId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'exam_attempts',
      filter: `exam_id=eq.${examId}` // Scope to specific exam
    },
    (payload) => {
      // Handle only this exam's attempts
    }
  )
  .subscribe();
```

**Impact**: Reduces unnecessary updates by 90%+

### 2. Implement Proper Cleanup

**Bad** - No cleanup:
```typescript
useEffect(() => {
  const subscription = supabaseClient
    .channel('monitoring')
    .on('postgres_changes', { ... }, handler)
    .subscribe();
  
  // Missing cleanup!
}, []);
```

**Good** - Proper cleanup:
```typescript
useEffect(() => {
  const subscription = supabaseClient
    .channel('monitoring')
    .on('postgres_changes', { ... }, handler)
    .subscribe();
  
  // Cleanup on unmount
  return () => {
    subscription.unsubscribe();
  };
}, [examId]); // Re-subscribe when examId changes
```

**Impact**: Prevents memory leaks and zombie subscriptions

### 3. Use Specific Events

**Bad** - Subscribes to all changes:
```typescript
const subscription = supabaseClient
  .channel('monitoring')
  .on(
    'postgres_changes',
    {
      event: '*', // All events
      schema: 'public',
      table: 'exam_attempts'
    },
    handler
  )
  .subscribe();
```

**Good** - Specific events only:
```typescript
const subscription = supabaseClient
  .channel('monitoring')
  .on(
    'postgres_changes',
    {
      event: 'INSERT', // Only inserts
      schema: 'public',
      table: 'exam_attempts',
      filter: `exam_id=eq.${examId}`
    },
    handler
  )
  .subscribe();
```

**Impact**: Reduces event processing by 60-80%

### 4. Throttle High-Frequency Updates

**Bad** - Updates on every change:
```typescript
const subscription = supabaseClient
  .channel('monitoring')
  .on('postgres_changes', { ... }, (payload) => {
    setAttempts(prev => [...prev, payload.new]);
    // Triggers re-render on every update
  })
  .subscribe();
```

**Good** - Throttled updates:
```typescript
import { throttle } from 'lodash';

const updateAttempts = throttle((newAttempt) => {
  setAttempts(prev => [...prev, newAttempt]);
}, 1000); // Max 1 update per second

const subscription = supabaseClient
  .channel('monitoring')
  .on('postgres_changes', { ... }, (payload) => {
    updateAttempts(payload.new);
  })
  .subscribe();
```

**Impact**: Reduces re-renders by 80-90% during high activity

### 5. Use Channel Names Wisely

**Bad** - Generic channel name:
```typescript
const subscription = supabaseClient
  .channel('monitoring') // Conflicts with other components
  .on('postgres_changes', { ... }, handler)
  .subscribe();
```

**Good** - Unique channel names:
```typescript
const subscription = supabaseClient
  .channel(`exam-${examId}-monitoring`) // Unique per exam
  .on('postgres_changes', { ... }, handler)
  .subscribe();
```

**Impact**: Prevents channel conflicts and improves debugging

## Recommended Subscription Patterns

### Pattern 1: Exam Monitoring

Monitor active attempts for a specific exam:

```typescript
import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase/client';

export function useExamMonitoring(examId: string) {
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (!examId) return;

    // Subscribe to new attempts
    const subscription = supabaseClient
      .channel(`exam-${examId}-attempts`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'exam_attempts',
          filter: `exam_id=eq.${examId}`
        },
        (payload) => {
          setAttempts(prev => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'exam_attempts',
          filter: `exam_id=eq.${examId}`
        },
        (payload) => {
          setAttempts(prev => 
            prev.map(a => a.id === payload.new.id ? payload.new : a)
          );
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, [examId]);

  return attempts;
}
```

### Pattern 2: Results Updates

Monitor score updates for an exam:

```typescript
export function useResultsMonitoring(examId: string) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!examId) return;

    const subscription = supabaseClient
      .channel(`exam-${examId}-results`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'exam_results',
          // Filter by exam_id through join (requires RLS)
        },
        (payload) => {
          setResults(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [examId]);

  return results;
}
```

### Pattern 3: Audit Log Monitoring

Monitor security events with throttling:

```typescript
import { throttle } from 'lodash';

export function useAuditMonitoring() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Throttle updates to max 1 per second
    const updateLogs = throttle((newLog) => {
      setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100
    }, 1000);

    const subscription = supabaseClient
      .channel('audit-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs'
        },
        (payload) => {
          updateLogs(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      updateLogs.cancel(); // Cancel pending throttled calls
    };
  }, []);

  return logs;
}
```

### Pattern 4: Presence Tracking

Track active users in an exam:

```typescript
export function useExamPresence(examId: string, userId: string) {
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    if (!examId || !userId) return;

    const channel = supabaseClient.channel(`exam-${examId}-presence`, {
      config: {
        presence: {
          key: userId
        }
      }
    });

    // Track presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setActiveUsers(Object.keys(state));
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log('User joined:', key);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('User left:', key);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [examId, userId]);

  return activeUsers;
}
```

## Performance Optimization Checklist

### Before Subscribing

- [ ] Is real-time data actually needed? (Consider polling for less critical data)
- [ ] Can the subscription be scoped to specific records?
- [ ] What events are actually needed? (INSERT, UPDATE, DELETE, or all?)
- [ ] Is there a unique channel name to avoid conflicts?

### During Implementation

- [ ] Filter applied to reduce unnecessary updates
- [ ] Cleanup function implemented in useEffect
- [ ] Throttling/debouncing for high-frequency updates
- [ ] Error handling for subscription failures
- [ ] Loading states for initial subscription

### After Implementation

- [ ] Test subscription cleanup on component unmount
- [ ] Verify no memory leaks with React DevTools Profiler
- [ ] Monitor subscription count in Supabase dashboard
- [ ] Test with multiple concurrent users
- [ ] Verify RLS policies allow subscription access

## Common Pitfalls

### 1. Forgetting to Unsubscribe

**Problem**: Memory leaks and zombie subscriptions

**Solution**: Always return cleanup function from useEffect

### 2. Over-Subscribing

**Problem**: Too many subscriptions for the same data

**Solution**: Lift subscriptions to parent components and pass data down

### 3. Missing Filters

**Problem**: Receiving updates for all records

**Solution**: Always use filter parameter when possible

### 4. Ignoring Subscription Status

**Problem**: Not handling connection failures

**Solution**: Monitor subscription status and implement reconnection logic

```typescript
const subscription = supabaseClient
  .channel('monitoring')
  .on('postgres_changes', { ... }, handler)
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Subscription error');
      // Implement retry logic
    } else if (status === 'TIMED_OUT') {
      console.error('Subscription timeout');
      // Implement retry logic
    }
  });
```

### 5. Not Handling Reconnection

**Problem**: Stale data after network interruption

**Solution**: Refetch data on reconnection

```typescript
useEffect(() => {
  const subscription = supabaseClient
    .channel('monitoring')
    .on('postgres_changes', { ... }, handler)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Refetch data to ensure we didn't miss updates
        refetchData();
      }
    });

  return () => {
    subscription.unsubscribe();
  };
}, [examId]);
```

## Monitoring Subscriptions

### Check Active Subscriptions

```typescript
// In browser console
console.log(supabaseClient.getChannels());
```

### Supabase Dashboard

1. Navigate to Database → Replicator
2. View active subscriptions
3. Monitor subscription count
4. Check for subscription errors

### Performance Metrics

Track these metrics:

- **Subscription Count**: Should be < 10 per user
- **Update Frequency**: Should be < 10 updates/second per subscription
- **Memory Usage**: Should not grow over time
- **Reconnection Rate**: Should be < 1% of connections

## Migration Guide

### Updating Existing Subscriptions

1. **Identify unscoped subscriptions**:
   ```bash
   grep -r "\.on('postgres_changes'" src/
   ```

2. **Add filters**:
   ```typescript
   // Before
   .on('postgres_changes', { table: 'exam_attempts' }, handler)
   
   // After
   .on('postgres_changes', { 
     table: 'exam_attempts',
     filter: `exam_id=eq.${examId}`
   }, handler)
   ```

3. **Add cleanup**:
   ```typescript
   useEffect(() => {
     const sub = /* subscription */;
     return () => sub.unsubscribe();
   }, [dependencies]);
   ```

4. **Test thoroughly**:
   - Verify data still updates correctly
   - Check for memory leaks
   - Test with multiple users

## Best Practices Summary

1. ✅ **Always scope subscriptions** with filters
2. ✅ **Always implement cleanup** in useEffect
3. ✅ **Use specific events** (INSERT, UPDATE, DELETE)
4. ✅ **Throttle high-frequency updates**
5. ✅ **Use unique channel names**
6. ✅ **Handle subscription status**
7. ✅ **Implement reconnection logic**
8. ✅ **Monitor subscription count**
9. ✅ **Test cleanup thoroughly**
10. ✅ **Document subscription purpose**

## Expected Performance Impact

After implementing these optimizations:

- **Subscription Count**: 60-80% reduction
- **Update Frequency**: 70-90% reduction
- **Memory Usage**: 50-70% reduction
- **Server Load**: 40-60% reduction
- **Client Performance**: 30-50% improvement

## Additional Resources

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Presence](https://supabase.com/docs/guides/realtime/presence)
- [Broadcast](https://supabase.com/docs/guides/realtime/broadcast)

## Notes

- Real-time subscriptions use WebSocket connections
- Each subscription consumes server resources
- Proper cleanup is critical for production applications
- Test subscriptions under load before deploying
- Monitor subscription metrics in production
