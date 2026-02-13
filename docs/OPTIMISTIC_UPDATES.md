# Optimistic Updates Pattern

Guide to implementing optimistic UI updates for instant user feedback with automatic rollback on errors.

## Overview

Optimistic updates immediately reflect changes in the UI before server confirmation, providing instant feedback and a responsive user experience. The system automatically rolls back changes if the server operation fails.

**Benefits:**
- Instant UI feedback (no waiting for server)
- Improved perceived performance
- Automatic error handling and rollback
- Consistent loading states

## Core Concepts

### Optimistic Update Flow

```
1. User Action → 2. Update UI Immediately → 3. Send to Server
                                              ↓
                                         4a. Success: Keep UI
                                         4b. Error: Rollback UI
```

### Key Components

1. **React Query** - Manages server state and cache
2. **Optimistic Mutation Hook** - Wraps mutations with optimistic logic
3. **Cache Snapshots** - Stores previous state for rollback
4. **Error Handling** - Automatic rollback and user notification

## Basic Usage

### Using useOptimisticMutation Hook

```tsx
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

function ExamEditor() {
  const mutation = useOptimisticMutation({
    mutationFn: async (exam: Exam) => {
      const response = await authFetch(`/api/admin/exams/${exam.id}`, {
        method: 'PATCH',
        body: JSON.stringify(exam),
      });
      return response.json();
    },
    queryKey: ['admin', 'exams'],
    onMutate: (newExam) => {
      // Update cache optimistically
      return (old: any) => ({
        ...old,
        items: old.items.map((e: Exam) =>
          e.id === newExam.id ? newExam : e
        ),
      });
    },
    successMessage: 'Exam saved successfully',
    errorMessage: 'Failed to save exam',
  });

  const handleSave = () => {
    mutation.mutate(updatedExam);
  };

  return (
    <button
      onClick={handleSave}
      disabled={mutation.isPending}
      aria-busy={mutation.isPending}
    >
      {mutation.isPending ? 'Saving...' : 'Save'}
    </button>
  );
}
```

## Implementation Patterns

### Pattern 1: Simple Update

Update a single item in a list:

```tsx
const updateExamMutation = useOptimisticMutation({
  mutationFn: (exam: Exam) =>
    authFetch(`/api/admin/exams/${exam.id}`, {
      method: 'PATCH',
      body: JSON.stringify(exam),
    }),
  queryKey: ['admin', 'exams'],
  onMutate: (newExam) => (old: any) => ({
    ...old,
    items: old.items.map((e: Exam) =>
      e.id === newExam.id ? newExam : e
    ),
  }),
  successMessage: 'Exam updated',
});
```

### Pattern 2: Create New Item

Add a new item to a list:

```tsx
const createQuestionMutation = useOptimisticMutation({
  mutationFn: (question: Question) =>
    authFetch(`/api/admin/questions`, {
      method: 'POST',
      body: JSON.stringify(question),
    }),
  queryKey: ['admin', 'questions', examId],
  onMutate: (newQuestion) => (old: any) => ({
    ...old,
    items: [...old.items, { ...newQuestion, id: `temp-${Date.now()}` }],
  }),
  successMessage: 'Question added',
});
```

### Pattern 3: Delete Item

Remove an item from a list:

```tsx
const deleteStudentMutation = useOptimisticMutation({
  mutationFn: (studentId: string) =>
    authFetch(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
    }),
  queryKey: ['admin', 'students'],
  onMutate: (studentId) => (old: any) => ({
    ...old,
    items: old.items.filter((s: Student) => s.id !== studentId),
  }),
  successMessage: 'Student deleted',
});
```

### Pattern 4: Reorder Items

Update item order in a list:

```tsx
const reorderQuestionsMutation = useOptimisticMutation({
  mutationFn: (newOrder: Question[]) =>
    authFetch(`/api/admin/questions/reorder`, {
      method: 'POST',
      body: JSON.stringify({ order: newOrder.map(q => q.id) }),
    }),
  queryKey: ['admin', 'questions', examId],
  onMutate: (newOrder) => (old: any) => ({
    ...old,
    items: newOrder,
  }),
  successMessage: 'Questions reordered',
});
```

### Pattern 5: Bulk Update

Update multiple items at once:

```tsx
const bulkUpdateMutation = useOptimisticMutation({
  mutationFn: (updates: Array<{ id: string; status: string }>) =>
    authFetch(`/api/admin/exams/bulk-update`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),
  queryKey: ['admin', 'exams'],
  onMutate: (updates) => (old: any) => ({
    ...old,
    items: old.items.map((exam: Exam) => {
      const update = updates.find(u => u.id === exam.id);
      return update ? { ...exam, ...update } : exam;
    }),
  }),
  successMessage: `Updated ${updates.length} exams`,
});
```

## Advanced Usage

### Custom Error Handling

```tsx
const mutation = useOptimisticMutation({
  mutationFn: saveExam,
  queryKey: ['admin', 'exams'],
  onMutate: updateCache,
  onError: (error, variables, context) => {
    // Custom error handling
    if (error.message.includes('conflict')) {
      toast.error({
        title: 'Conflict Detected',
        message: 'Another user modified this exam. Please refresh.',
      });
    } else {
      toast.error({
        title: 'Save Failed',
        message: error.message,
      });
    }
  },
  successMessage: 'Saved',
});
```

### Multiple Query Invalidation

```tsx
const mutation = useOptimisticMutation({
  mutationFn: updateStudent,
  queryKey: ['admin', 'students'],
  onMutate: updateCache,
  onSuccess: () => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'attempts'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'results'] });
  },
});
```

### Conditional Optimistic Updates

```tsx
const mutation = useOptimisticMutation({
  mutationFn: saveExam,
  queryKey: ['admin', 'exams'],
  onMutate: (newExam) => {
    // Only apply optimistic update for certain conditions
    if (newExam.status === 'draft') {
      return (old: any) => ({
        ...old,
        items: old.items.map((e: Exam) =>
          e.id === newExam.id ? newExam : e
        ),
      });
    }
    // Return undefined to skip optimistic update
    return undefined;
  },
});
```

## Loading States

### Button with Loading Indicator

```tsx
<button
  onClick={() => mutation.mutate(data)}
  disabled={mutation.isPending}
  aria-busy={mutation.isPending}
  className="btn"
>
  {mutation.isPending && (
    <span className="spinner" aria-hidden="true" />
  )}
  <span>{mutation.isPending ? 'Saving...' : 'Save'}</span>
</button>
```

### Form with Loading Overlay

```tsx
<form onSubmit={handleSubmit}>
  {mutation.isPending && (
    <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
      <div className="spinner" />
    </div>
  )}
  
  <input type="text" disabled={mutation.isPending} />
  <button type="submit" disabled={mutation.isPending}>
    Submit
  </button>
</form>
```

### Status Messages

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {mutation.isPending && 'Saving changes...'}
  {mutation.isSuccess && 'Changes saved successfully'}
  {mutation.isError && `Error: ${mutation.error.message}`}
</div>
```

## Error Handling

### Automatic Rollback

The system automatically rolls back optimistic updates on error:

```tsx
// User clicks save
mutation.mutate(newData);

// UI updates immediately (optimistic)
// ✓ UI shows new data

// Server returns error
// ✗ Request failed

// UI automatically rolls back
// ✓ UI shows original data
// ✓ Error toast displayed
```

### Manual Rollback

For complex scenarios, manually control rollback:

```tsx
const mutation = useMutation({
  mutationFn: saveData,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['data'] });
    const previousData = queryClient.getQueryData(['data']);
    
    queryClient.setQueryData(['data'], newData);
    
    return { previousData };
  },
  onError: (err, newData, context) => {
    // Manual rollback
    if (context?.previousData) {
      queryClient.setQueryData(['data'], context.previousData);
    }
  },
});
```

## Testing

### Unit Tests

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

test('applies optimistic update immediately', async () => {
  const { result } = renderHook(() =>
    useOptimisticMutation({
      mutationFn: mockSave,
      queryKey: ['data'],
      onMutate: (newData) => (old) => newData,
    })
  );

  const initialData = queryClient.getQueryData(['data']);
  
  result.current.mutate(newData);
  
  // UI should update immediately
  const optimisticData = queryClient.getQueryData(['data']);
  expect(optimisticData).toEqual(newData);
  expect(optimisticData).not.toEqual(initialData);
});
```

### Property-Based Tests

```tsx
import fc from 'fast-check';

test('optimistic updates always rollback on error', () => {
  fc.assert(
    fc.property(
      fc.record({ id: fc.string(), value: fc.string() }),
      async (data) => {
        const mutation = useOptimisticMutation({
          mutationFn: () => Promise.reject(new Error('Failed')),
          queryKey: ['data'],
          onMutate: (newData) => (old) => newData,
        });

        const initialData = queryClient.getQueryData(['data']);
        
        mutation.mutate(data);
        await waitFor(() => expect(mutation.isError).toBe(true));
        
        const rolledBackData = queryClient.getQueryData(['data']);
        expect(rolledBackData).toEqual(initialData);
      }
    )
  );
});
```

## Performance Considerations

### Debouncing Mutations

For rapid updates (e.g., typing), debounce mutations:

```tsx
import { useDebouncedCallback } from 'use-debounce';

const mutation = useOptimisticMutation({
  mutationFn: saveExam,
  queryKey: ['admin', 'exams'],
  onMutate: updateCache,
});

const debouncedSave = useDebouncedCallback(
  (exam) => mutation.mutate(exam),
  500  // Wait 500ms after last change
);

<input
  onChange={(e) => {
    setExam({ ...exam, title: e.target.value });
    debouncedSave({ ...exam, title: e.target.value });
  }}
/>
```

### Batching Updates

Batch multiple updates into a single request:

```tsx
const [pendingUpdates, setPendingUpdates] = useState<Update[]>([]);

const batchMutation = useOptimisticMutation({
  mutationFn: (updates: Update[]) =>
    authFetch('/api/batch-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),
  queryKey: ['data'],
  onMutate: (updates) => (old: any) => applyUpdates(old, updates),
});

// Collect updates
const queueUpdate = (update: Update) => {
  setPendingUpdates(prev => [...prev, update]);
};

// Flush batch every 2 seconds
useEffect(() => {
  const timer = setInterval(() => {
    if (pendingUpdates.length > 0) {
      batchMutation.mutate(pendingUpdates);
      setPendingUpdates([]);
    }
  }, 2000);
  return () => clearInterval(timer);
}, [pendingUpdates]);
```

## Accessibility

### ARIA Attributes

```tsx
<button
  onClick={() => mutation.mutate(data)}
  disabled={mutation.isPending}
  aria-busy={mutation.isPending}
  aria-label="Save changes"
>
  Save
</button>

<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {mutation.isPending && 'Saving...'}
  {mutation.isSuccess && 'Saved successfully'}
</div>

<div
  role="alert"
  aria-live="assertive"
>
  {mutation.isError && `Error: ${mutation.error.message}`}
</div>
```

### Focus Management

```tsx
const mutation = useOptimisticMutation({
  mutationFn: saveData,
  queryKey: ['data'],
  onMutate: updateCache,
  onSuccess: () => {
    // Return focus to trigger element
    triggerRef.current?.focus();
  },
  onError: () => {
    // Focus error message for screen readers
    errorRef.current?.focus();
  },
});
```

## Best Practices

1. **Always provide rollback logic** - Ensure UI can revert on error
2. **Show loading indicators** - Use `isPending` state for feedback
3. **Handle errors gracefully** - Display meaningful error messages
4. **Test rollback scenarios** - Verify UI reverts correctly
5. **Use appropriate ARIA attributes** - Maintain accessibility
6. **Debounce rapid updates** - Prevent excessive server requests
7. **Invalidate related queries** - Keep all data in sync
8. **Provide success feedback** - Confirm actions completed

## Common Pitfalls

### ❌ Not Canceling Outgoing Requests

```tsx
// Bad: Old requests can overwrite new data
onMutate: (newData) => {
  queryClient.setQueryData(['data'], newData);
}
```

```tsx
// Good: Cancel pending requests first
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: ['data'] });
  queryClient.setQueryData(['data'], newData);
}
```

### ❌ Not Storing Previous State

```tsx
// Bad: Can't rollback without previous state
onMutate: (newData) => {
  queryClient.setQueryData(['data'], newData);
}
```

```tsx
// Good: Store previous state for rollback
onMutate: (newData) => {
  const previousData = queryClient.getQueryData(['data']);
  queryClient.setQueryData(['data'], newData);
  return { previousData };
}
```

### ❌ Forgetting to Invalidate

```tsx
// Bad: Cache becomes stale
onSuccess: () => {
  // Nothing happens
}
```

```tsx
// Good: Invalidate to refetch fresh data
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['data'] });
}
```

## Related Documentation

- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
- [Design Document](../.kiro/specs/performance-optimization-and-backend-fixes/design.md)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Optimistic Updates Tests](../src/lib/__tests__/optimisticUpdates.pbt.test.ts)
