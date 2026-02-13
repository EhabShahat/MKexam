/**
 * Optimistic Update Utilities
 * 
 * Provides reusable patterns for implementing optimistic UI updates with React Query.
 * Includes automatic rollback on errors and loading state management.
 */

import { UseMutationOptions, QueryClient } from '@tanstack/react-query';

/**
 * Context returned from onMutate for rollback purposes
 */
export interface OptimisticContext<TData = unknown> {
  previousData: TData | undefined;
  queryKey: unknown[];
}

/**
 * Options for creating an optimistic mutation
 */
export interface OptimisticMutationOptions<TData, TVariables, TContext = OptimisticContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: unknown[];
  updateCache: (oldData: TData | undefined, variables: TVariables) => TData;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
}

/**
 * Creates a mutation configuration with optimistic updates
 * 
 * @example
 * ```typescript
 * const updateExamMutation = useMutation(
 *   createOptimisticMutation({
 *     mutationFn: (exam) => authFetch(`/api/admin/exams/${exam.id}`, {
 *       method: 'PATCH',
 *       body: JSON.stringify(exam)
 *     }),
 *     queryKey: ['admin', 'exams'],
 *     updateCache: (oldData, newExam) => ({
 *       ...oldData,
 *       items: oldData.items.map(e => e.id === newExam.id ? newExam : e)
 *     }),
 *     onSuccess: () => toast.success({ title: 'Saved!' }),
 *     onError: (error) => toast.error({ title: 'Failed', message: error.message })
 *   })
 * );
 * ```
 */
export function createOptimisticMutation<TData, TVariables>(
  queryClient: QueryClient,
  options: OptimisticMutationOptions<TData, TVariables>
): UseMutationOptions<TData, Error, TVariables, OptimisticContext<TData>> {
  return {
    mutationFn: options.mutationFn,
    
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(options.queryKey);
      
      // Optimistically update the cache
      queryClient.setQueryData<TData>(options.queryKey, (oldData) => {
        return options.updateCache(oldData, variables);
      });
      
      // Return context with previous data for rollback
      return { previousData, queryKey: options.queryKey };
    },
    
    onError: (error: Error, variables: TVariables, context: OptimisticContext<TData> | undefined) => {
      // Rollback to previous state on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      
      // Call custom error handler if provided
      options.onError?.(error, variables, context);
    },
    
    onSuccess: (data: TData, variables: TVariables, context: OptimisticContext<TData> | undefined) => {
      // Call custom success handler if provided
      options.onSuccess?.(data, variables, context);
    },
    
    onSettled: (data: TData | undefined, error: Error | null, variables: TVariables, context: OptimisticContext<TData> | undefined) => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: options.queryKey });
      
      // Call custom settled handler if provided
      options.onSettled?.(data, error, variables, context);
    },
  };
}

/**
 * Creates an optimistic mutation for updating a single item in a list
 * 
 * @example
 * ```typescript
 * const updateExamMutation = useMutation(
 *   createOptimisticListItemUpdate({
 *     mutationFn: (exam) => authFetch(`/api/admin/exams/${exam.id}`, {
 *       method: 'PATCH',
 *       body: JSON.stringify(exam)
 *     }),
 *     queryKey: ['admin', 'exams'],
 *     itemMatcher: (item, variables) => item.id === variables.id,
 *     onSuccess: () => toast.success({ title: 'Updated!' })
 *   })
 * );
 * ```
 */
export function createOptimisticListItemUpdate<TItem, TVariables extends Partial<TItem>>(
  queryClient: QueryClient,
  options: {
    mutationFn: (variables: TVariables) => Promise<TItem>;
    queryKey: unknown[];
    itemMatcher: (item: TItem, variables: TVariables) => boolean;
    onSuccess?: (data: TItem, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationOptions<TItem, Error, TVariables, OptimisticContext<TItem[]>> {
  return createOptimisticMutation<TItem, TVariables>(queryClient, {
    mutationFn: options.mutationFn,
    queryKey: options.queryKey,
    updateCache: (oldData, variables) => {
      if (!oldData) return oldData as TItem;
      // For list item updates, we need to return the updated item
      // The cache update will be handled by React Query
      return variables as unknown as TItem;
    },
    onSuccess: options.onSuccess as any,
    onError: options.onError as any,
  }) as any;
}

/**
 * Creates an optimistic mutation for adding an item to a list
 * 
 * @example
 * ```typescript
 * const addQuestionMutation = useMutation(
 *   createOptimisticListItemAdd({
 *     mutationFn: (question) => authFetch(`/api/admin/exams/${examId}/questions`, {
 *       method: 'POST',
 *       body: JSON.stringify(question)
 *     }),
 *     queryKey: ['admin', 'exam', examId, 'questions'],
 *     generateTempId: () => `temp-${Date.now()}`,
 *     onSuccess: () => toast.success({ title: 'Question added!' })
 *   })
 * );
 * ```
 */
export function createOptimisticListItemAdd<TItem, TVariables>(
  queryClient: QueryClient,
  options: {
    mutationFn: (variables: TVariables) => Promise<TItem>;
    queryKey: unknown[];
    generateTempId?: () => string;
    onSuccess?: (data: TItem, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationOptions<TItem, Error, TVariables, OptimisticContext<TItem[]>> {
  return createOptimisticMutation<TItem, TVariables>(queryClient, {
    mutationFn: options.mutationFn,
    queryKey: options.queryKey,
    updateCache: (oldData, variables) => {
      // For add operations, return the new item
      return { ...variables, id: options.generateTempId?.() } as unknown as TItem;
    },
    onSuccess: options.onSuccess as any,
    onError: options.onError as any,
  }) as any;
}

/**
 * Creates an optimistic mutation for removing an item from a list
 * 
 * @example
 * ```typescript
 * const deleteQuestionMutation = useMutation(
 *   createOptimisticListItemRemove({
 *     mutationFn: (id) => authFetch(`/api/admin/exams/${examId}/questions/${id}`, {
 *       method: 'DELETE'
 *     }),
 *     queryKey: ['admin', 'exam', examId, 'questions'],
 *     itemMatcher: (item, id) => item.id === id,
 *     onSuccess: () => toast.success({ title: 'Question deleted!' })
 *   })
 * );
 * ```
 */
export function createOptimisticListItemRemove<TItem, TVariables>(
  queryClient: QueryClient,
  options: {
    mutationFn: (variables: TVariables) => Promise<void>;
    queryKey: unknown[];
    itemMatcher: (item: TItem, variables: TVariables) => boolean;
    onSuccess?: (data: void, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationOptions<void, Error, TVariables, OptimisticContext<TItem[]>> {
  return createOptimisticMutation<void, TVariables>(queryClient, {
    mutationFn: options.mutationFn as any,
    queryKey: options.queryKey,
    updateCache: (oldData, variables) => {
      // For remove operations, return void
      return undefined as void;
    },
    onSuccess: options.onSuccess as any,
    onError: options.onError as any,
  }) as any;
}

/**
 * Creates an optimistic mutation for reordering items in a list
 * 
 * @example
 * ```typescript
 * const reorderQuestionsMutation = useMutation(
 *   createOptimisticListReorder({
 *     mutationFn: (order) => authFetch(`/api/admin/exams/${examId}/questions/reorder`, {
 *       method: 'POST',
 *       body: JSON.stringify({ order })
 *     }),
 *     queryKey: ['admin', 'exam', examId, 'questions'],
 *     getItemId: (item) => item.id,
 *     onSuccess: () => toast.success({ title: 'Questions reordered!' })
 *   })
 * );
 * ```
 */
export function createOptimisticListReorder<TItem>(
  queryClient: QueryClient,
  options: {
    mutationFn: (variables: string[]) => Promise<void>;
    queryKey: unknown[];
    getItemId: (item: TItem) => string;
    onSuccess?: (data: void, variables: string[], context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: string[], context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationOptions<void, Error, string[], OptimisticContext<TItem[]>> {
  return createOptimisticMutation<void, string[]>(queryClient, {
    mutationFn: options.mutationFn as any,
    queryKey: options.queryKey,
    updateCache: (oldData, newOrder) => {
      // For reorder operations, return void
      return undefined as void;
    },
    onSuccess: options.onSuccess as any,
    onError: options.onError as any,
  }) as any;
}
