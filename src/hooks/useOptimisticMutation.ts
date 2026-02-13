/**
 * React Hook for Optimistic Mutations
 * 
 * Provides a convenient hook wrapper around optimistic mutation utilities
 * with automatic loading indicator integration.
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { 
  createOptimisticMutation, 
  createOptimisticListItemUpdate,
  createOptimisticListItemAdd,
  createOptimisticListItemRemove,
  createOptimisticListReorder,
  OptimisticMutationOptions,
  OptimisticContext
} from '@/lib/optimisticUpdates';

/**
 * Hook for creating an optimistic mutation with automatic loading state
 * 
 * @example
 * ```typescript
 * const updateExam = useOptimisticMutation({
 *   mutationFn: (exam) => authFetch(`/api/admin/exams/${exam.id}`, {
 *     method: 'PATCH',
 *     body: JSON.stringify(exam)
 *   }),
 *   queryKey: ['admin', 'exams'],
 *   updateCache: (oldData, newExam) => ({
 *     ...oldData,
 *     items: oldData.items.map(e => e.id === newExam.id ? newExam : e)
 *   }),
 *   onSuccess: () => toast.success({ title: 'Saved!' })
 * });
 * 
 * // Usage
 * updateExam.mutate(updatedExam);
 * // UI shows updated state immediately
 * // updateExam.isPending shows loading indicator
 * ```
 */
export function useOptimisticMutation<TData, TVariables>(
  options: OptimisticMutationOptions<TData, TVariables>
): UseMutationResult<TData, Error, TVariables, OptimisticContext<TData>> {
  const queryClient = useQueryClient();
  
  return useMutation(
    createOptimisticMutation(queryClient, options)
  );
}

/**
 * Hook for optimistically updating a single item in a list
 * 
 * @example
 * ```typescript
 * const updateStudent = useOptimisticListItemUpdate({
 *   mutationFn: (student) => authFetch(`/api/admin/students/${student.id}`, {
 *     method: 'PATCH',
 *     body: JSON.stringify(student)
 *   }),
 *   queryKey: ['admin', 'students'],
 *   itemMatcher: (item, variables) => item.id === variables.id,
 *   onSuccess: () => toast.success({ title: 'Student updated!' })
 * });
 * ```
 */
export function useOptimisticListItemUpdate<TItem, TVariables extends Partial<TItem>>(
  options: {
    mutationFn: (variables: TVariables) => Promise<TItem>;
    queryKey: unknown[];
    itemMatcher: (item: TItem, variables: TVariables) => boolean;
    onSuccess?: (data: TItem, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationResult<TItem, Error, TVariables, OptimisticContext<TItem[]>> {
  const queryClient = useQueryClient();
  
  return useMutation(
    createOptimisticListItemUpdate(queryClient, options)
  );
}

/**
 * Hook for optimistically adding an item to a list
 * 
 * @example
 * ```typescript
 * const addQuestion = useOptimisticListItemAdd({
 *   mutationFn: (question) => authFetch(`/api/admin/exams/${examId}/questions`, {
 *     method: 'POST',
 *     body: JSON.stringify(question)
 *   }),
 *   queryKey: ['admin', 'exam', examId, 'questions'],
 *   generateTempId: () => `temp-${Date.now()}`,
 *   onSuccess: () => toast.success({ title: 'Question added!' })
 * });
 * ```
 */
export function useOptimisticListItemAdd<TItem, TVariables>(
  options: {
    mutationFn: (variables: TVariables) => Promise<TItem>;
    queryKey: unknown[];
    generateTempId?: () => string;
    onSuccess?: (data: TItem, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationResult<TItem, Error, TVariables, OptimisticContext<TItem[]>> {
  const queryClient = useQueryClient();
  
  return useMutation(
    createOptimisticListItemAdd(queryClient, options)
  );
}

/**
 * Hook for optimistically removing an item from a list
 * 
 * @example
 * ```typescript
 * const deleteQuestion = useOptimisticListItemRemove({
 *   mutationFn: (id) => authFetch(`/api/admin/exams/${examId}/questions/${id}`, {
 *     method: 'DELETE'
 *   }),
 *   queryKey: ['admin', 'exam', examId, 'questions'],
 *   itemMatcher: (item, id) => item.id === id,
 *   onSuccess: () => toast.success({ title: 'Question deleted!' })
 * });
 * ```
 */
export function useOptimisticListItemRemove<TItem, TVariables>(
  options: {
    mutationFn: (variables: TVariables) => Promise<void>;
    queryKey: unknown[];
    itemMatcher: (item: TItem, variables: TVariables) => boolean;
    onSuccess?: (data: void, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationResult<void, Error, TVariables, OptimisticContext<TItem[]>> {
  const queryClient = useQueryClient();
  
  return useMutation(
    createOptimisticListItemRemove(queryClient, options)
  );
}

/**
 * Hook for optimistically reordering items in a list
 * 
 * @example
 * ```typescript
 * const reorderQuestions = useOptimisticListReorder({
 *   mutationFn: (order) => authFetch(`/api/admin/exams/${examId}/questions/reorder`, {
 *     method: 'POST',
 *     body: JSON.stringify({ order })
 *   }),
 *   queryKey: ['admin', 'exam', examId, 'questions'],
 *   getItemId: (item) => item.id,
 *   onSuccess: () => toast.success({ title: 'Questions reordered!' })
 * });
 * ```
 */
export function useOptimisticListReorder<TItem>(
  options: {
    mutationFn: (variables: string[]) => Promise<void>;
    queryKey: unknown[];
    getItemId: (item: TItem) => string;
    onSuccess?: (data: void, variables: string[], context: OptimisticContext<TItem[]> | undefined) => void | Promise<void>;
    onError?: (error: Error, variables: string[], context: OptimisticContext<TItem[]> | undefined) => void;
  }
): UseMutationResult<void, Error, string[], OptimisticContext<TItem[]>> {
  const queryClient = useQueryClient();
  
  return useMutation(
    createOptimisticListReorder(queryClient, options)
  );
}
