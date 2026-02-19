/**
 * Optimistic Updates Utility Module
 * 
 * Provides reusable patterns for implementing optimistic updates in React Query mutations.
 * Optimistic updates improve perceived performance by updating the UI immediately before
 * server confirmation, with automatic rollback on errors.
 * 
 * Requirements: 4.4 - Optimistic updates for mutations
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Generic optimistic update configuration for mutations
 * 
 * @template TData - The type of data being mutated
 * @template TVariables - The type of mutation variables
 * @template TContext - The type of context returned by onMutate
 */
export interface OptimisticUpdateConfig<TData, TVariables, TContext = unknown> {
  queryClient: QueryClient;
  queryKey: unknown[];
  
  /**
   * Function to update the cached data optimistically
   * @param oldData - Current cached data
   * @param variables - Mutation variables
   * @returns Updated data to cache
   */
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData;
  
  /**
   * Optional function to extract context for rollback
   * @param oldData - Current cached data before mutation
   * @returns Context to use for rollback
   */
  getContext?: (oldData: TData | undefined) => TContext;
}

/**
 * Creates optimistic update handlers for React Query mutations
 * 
 * Usage:
 * ```typescript
 * const mutation = useMutation({
 *   mutationFn: updateStudent,
 *   ...createOptimisticHandlers({
 *     queryClient,
 *     queryKey: ['students', studentId],
 *     updateFn: (oldData, variables) => ({ ...oldData, ...variables })
 *   })
 * });
 * ```
 */
export function createOptimisticHandlers<TData, TVariables, TContext = { previousData: TData | undefined }>(
  config: OptimisticUpdateConfig<TData, TVariables, TContext>
) {
  return {
    /**
     * onMutate: Called before mutation function is fired
     * - Cancels any outgoing refetches to avoid overwriting optimistic update
     * - Snapshots previous value for rollback
     * - Optimistically updates cache with new value
     */
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await config.queryClient.cancelQueries({ queryKey: config.queryKey });
      
      // Snapshot the previous value
      const previousData = config.queryClient.getQueryData<TData>(config.queryKey);
      
      // Optimistically update to the new value
      config.queryClient.setQueryData<TData>(
        config.queryKey,
        (oldData) => config.updateFn(oldData, variables)
      );
      
      // Return context with previous data for rollback
      const context = config.getContext 
        ? config.getContext(previousData)
        : { previousData } as TContext;
      
      return context;
    },
    
    /**
     * onError: Called if mutation fails
     * - Rolls back to previous value using context
     */
    onError: (error: Error, variables: TVariables, context: TContext | undefined) => {
      // Rollback to previous value on error
      if (context && typeof context === 'object' && context !== null && 'previousData' in context) {
        config.queryClient.setQueryData(
          config.queryKey,
          (context as { previousData: TData }).previousData
        );
      }
      
      console.error('Mutation failed, rolled back:', error);
    },
    
    /**
     * onSettled: Called after mutation is either successful or failed
     * - Invalidates query to refetch and sync with server state
     */
    onSettled: () => {
      // Always refetch after error or success to ensure sync with server
      void config.queryClient.invalidateQueries({ queryKey: config.queryKey });
    },
  };
}

/**
 * Creates optimistic update handlers for list mutations (add/remove items)
 * 
 * Usage:
 * ```typescript
 * const addMutation = useMutation({
 *   mutationFn: addStudent,
 *   ...createListOptimisticHandlers({
 *     queryClient,
 *     queryKey: ['students'],
 *     operation: 'add',
 *     getNewItem: (variables) => ({ id: tempId(), ...variables })
 *   })
 * });
 * ```
 */
export function createListOptimisticHandlers<TItem, TVariables>(config: {
  queryClient: QueryClient;
  queryKey: unknown[];
  operation: 'add' | 'remove' | 'update';
  getNewItem?: (variables: TVariables) => TItem;
  getItemId?: (variables: TVariables) => string | number;
  updateItem?: (oldItem: TItem, variables: TVariables) => TItem;
}) {
  return createOptimisticHandlers<TItem[], TVariables>({
    queryClient: config.queryClient,
    queryKey: config.queryKey,
    updateFn: (oldData, variables) => {
      const list = oldData || [];
      
      switch (config.operation) {
        case 'add':
          if (!config.getNewItem) {
            throw new Error('getNewItem is required for add operation');
          }
          return [...list, config.getNewItem(variables)];
          
        case 'remove':
          if (!config.getItemId) {
            throw new Error('getItemId is required for remove operation');
          }
          const removeId = config.getItemId(variables);
          return list.filter((item: any) => item.id !== removeId);
          
        case 'update':
          if (!config.getItemId || !config.updateItem) {
            throw new Error('getItemId and updateItem are required for update operation');
          }
          const updateId = config.getItemId(variables);
          return list.map((item: any) => 
            item.id === updateId ? config.updateItem!(item, variables) : item
          );
          
        default:
          return list;
      }
    },
  });
}

/**
 * Creates optimistic update handlers for nested data mutations
 * 
 * Usage:
 * ```typescript
 * const updateAnswerMutation = useMutation({
 *   mutationFn: saveAnswer,
 *   ...createNestedOptimisticHandlers({
 *     queryClient,
 *     queryKey: ['attempt', attemptId],
 *     path: ['answers', questionId],
 *     updateFn: (oldValue, variables) => variables.answer
 *   })
 * });
 * ```
 */
export function createNestedOptimisticHandlers<TData, TVariables>(config: {
  queryClient: QueryClient;
  queryKey: unknown[];
  path: (string | number)[];
  updateFn: (oldValue: any, variables: TVariables) => any;
}) {
  return createOptimisticHandlers<TData, TVariables>({
    queryClient: config.queryClient,
    queryKey: config.queryKey,
    updateFn: (oldData, variables) => {
      if (!oldData) return oldData as TData;
      
      // Deep clone to avoid mutations
      const newData = JSON.parse(JSON.stringify(oldData));
      
      // Navigate to nested path
      let current = newData;
      for (let i = 0; i < config.path.length - 1; i++) {
        const key = config.path[i];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      
      // Update the final key
      const finalKey = config.path[config.path.length - 1];
      current[finalKey] = config.updateFn(current[finalKey], variables);
      
      return newData;
    },
  });
}


/**
 * Type definitions for optimistic mutation options
 */
export interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: unknown[];
  updateCache: (oldData: TData | undefined, variables: TVariables) => TData;
  onSuccess?: (data: TData, variables: TVariables, context: OptimisticContext<TData> | undefined) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables, context: OptimisticContext<TData> | undefined) => void;
}

export interface OptimisticContext<TData> {
  previousData: TData | undefined;
}

/**
 * Creates an optimistic mutation configuration for React Query
 * This is a wrapper around createOptimisticHandlers for easier integration
 */
export function createOptimisticMutation<TData, TVariables>(
  queryClient: QueryClient,
  options: OptimisticMutationOptions<TData, TVariables>
) {
  return {
    mutationFn: options.mutationFn,
    ...createOptimisticHandlers<TData, TVariables, OptimisticContext<TData>>({
      queryClient,
      queryKey: options.queryKey,
      updateFn: options.updateCache,
    }),
    onSuccess: options.onSuccess,
    onError: (error: Error, variables: TVariables, context: OptimisticContext<TData> | undefined) => {
      // Call the error handler from createOptimisticHandlers first
      const handlers = createOptimisticHandlers<TData, TVariables, OptimisticContext<TData>>({
        queryClient,
        queryKey: options.queryKey,
        updateFn: options.updateCache,
      });
      handlers.onError(error, variables, context);
      
      // Then call custom error handler if provided
      options.onError?.(error, variables, context);
    },
  };
}

/**
 * Creates optimistic mutation for updating a list item
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
) {
  const handlers = createOptimisticHandlers<TItem[], TVariables, OptimisticContext<TItem[]>>({
    queryClient,
    queryKey: options.queryKey,
    updateFn: (oldData, variables) => {
      const list = oldData || [];
      return list.map(item => 
        options.itemMatcher(item, variables) ? { ...item, ...variables } : item
      ) as TItem[];
    },
  });

  return {
    mutationFn: options.mutationFn,
    ...handlers,
    onSuccess: async (data: TItem, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => {
      await handlers.onSettled();
      await options.onSuccess?.(data, variables, context);
    },
  };
}

/**
 * Creates optimistic mutation for adding a list item
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
) {
  const handlers = createOptimisticHandlers<TItem[], TVariables, OptimisticContext<TItem[]>>({
    queryClient,
    queryKey: options.queryKey,
    updateFn: (oldData, variables) => {
      const list = oldData || [];
      const tempItem = { 
        ...variables, 
        id: options.generateTempId?.() || `temp-${Date.now()}` 
      } as TItem;
      return [...list, tempItem];
    },
  });

  return {
    mutationFn: options.mutationFn,
    ...handlers,
    onSuccess: async (data: TItem, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => {
      await handlers.onSettled();
      await options.onSuccess?.(data, variables, context);
    },
  };
}

/**
 * Creates optimistic mutation for removing a list item
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
) {
  const handlers = createOptimisticHandlers<TItem[], TVariables, OptimisticContext<TItem[]>>({
    queryClient,
    queryKey: options.queryKey,
    updateFn: (oldData, variables) => {
      const list = oldData || [];
      return list.filter(item => !options.itemMatcher(item, variables));
    },
  });

  return {
    mutationFn: options.mutationFn,
    ...handlers,
    onSuccess: async (data: void, variables: TVariables, context: OptimisticContext<TItem[]> | undefined) => {
      await handlers.onSettled();
      await options.onSuccess?.(data, variables, context);
    },
  };
}

/**
 * Creates optimistic mutation for reordering list items
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
) {
  const handlers = createOptimisticHandlers<TItem[], string[], OptimisticContext<TItem[]>>({
    queryClient,
    queryKey: options.queryKey,
    updateFn: (oldData, newOrder) => {
      const list = oldData || [];
      const itemMap = new Map(list.map(item => [options.getItemId(item), item]));
      return newOrder.map(id => itemMap.get(id)).filter(Boolean) as TItem[];
    },
  });

  return {
    mutationFn: options.mutationFn,
    ...handlers,
    onSuccess: async (data: void, variables: string[], context: OptimisticContext<TItem[]> | undefined) => {
      await handlers.onSettled();
      await options.onSuccess?.(data, variables, context);
    },
  };
}
