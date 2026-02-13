/**
 * Feature: performance-optimization-and-backend-fixes
 * Property 8: Optimistic update immediate feedback
 * Validates: Requirements 3.1, 3.2, 3.3
 * 
 * Property-based tests for optimistic UI updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { createOptimisticMutation, createOptimisticListItemUpdate } from '../optimisticUpdates';

describe('Optimistic Updates - Property 8: Immediate Feedback', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  /**
   * Property 8.1: UI reflects optimistic update immediately before server response
   * 
   * For any mutation with optimistic updates, the cache should be updated
   * immediately when the mutation is triggered, before the server responds.
   */
  it('should update cache immediately before server response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          status: fc.constantFrom('draft', 'published', 'archived'),
        }),
        async (item) => {
          const queryKey = ['test', 'items'];
          const initialData = [item];
          
          // Set initial cache data
          queryClient.setQueryData(queryKey, initialData);
          
          // Create a mutation that takes 50ms to complete
          let serverResponseReceived = false;
          const mutationFn = vi.fn(async (updatedItem: typeof item) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            serverResponseReceived = true;
            return updatedItem;
          });
          
          const mutation = createOptimisticMutation(queryClient, {
            mutationFn,
            queryKey,
            updateCache: (oldData, variables) => {
              if (!oldData) return oldData;
              return oldData.map((i: typeof item) => 
                i.id === variables.id ? { ...i, ...variables } : i
              );
            },
          });
          
          // Trigger mutation
          const updatedItem = { ...item, title: 'Updated Title' };
          
          // Manually trigger onMutate to perform optimistic update
          await mutation.onMutate?.(updatedItem);
          
          // Immediately check cache (before server response)
          const cacheData = queryClient.getQueryData<typeof initialData>(queryKey);
          
          // Cache should be updated immediately
          expect(cacheData).toBeDefined();
          expect(cacheData?.[0].title).toBe('Updated Title');
          
          // Server response should not have been received yet
          expect(serverResponseReceived).toBe(false);
          
          // Now start the actual mutation and wait for it
          if (mutation.mutationFn) {
            await mutation.mutationFn(updatedItem);
          }
          expect(serverResponseReceived).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  }, 15000); // Increase timeout to 15 seconds

  /**
   * Property 8.2: Multiple optimistic updates are applied in order
   * 
   * When multiple mutations are triggered in sequence, each optimistic
   * update should be applied immediately in the order they were triggered.
   */
  it('should apply multiple optimistic updates in order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            value: fc.integer({ min: 0, max: 1000 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (updates) => {
          const queryKey = ['test', 'counter'];
          const initialValue = 0;
          
          queryClient.setQueryData(queryKey, initialValue);
          
          // Apply updates sequentially
          for (const update of updates) {
            const mutation = createOptimisticMutation(queryClient, {
              mutationFn: async (value: number) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return value;
              },
              queryKey,
              updateCache: (_oldData, variables) => variables,
            });
            
            await mutation.onMutate?.(update.value);
            
            // Check that cache reflects the latest update
            const cacheData = queryClient.getQueryData<number>(queryKey);
            expect(cacheData).toBe(update.value);
          }
          
          // Final cache value should be the last update
          const finalCache = queryClient.getQueryData<number>(queryKey);
          expect(finalCache).toBe(updates[updates.length - 1].value);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.3: Optimistic updates work for list item modifications
   * 
   * When updating a single item in a list, only that item should be
   * updated optimistically while other items remain unchanged.
   */
  it('should update only the target item in a list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.integer({ min: 0, max: 9 }),
        async (items, targetIndex) => {
          if (targetIndex >= items.length) return; // Skip if index out of bounds
          
          const queryKey = ['test', 'list'];
          queryClient.setQueryData(queryKey, items);
          
          const targetItem = items[targetIndex];
          const updatedValue = targetItem.value + 100;
          
          const mutation = createOptimisticListItemUpdate(queryClient, {
            mutationFn: async (variables: { id: string; value: number }) => {
              await new Promise(resolve => setTimeout(resolve, 10));
              return { ...targetItem, value: variables.value };
            },
            queryKey,
            itemMatcher: (item, variables) => item.id === variables.id,
          });
          
          await mutation.onMutate?.({ id: targetItem.id, value: updatedValue });
          
          const cacheData = queryClient.getQueryData<typeof items>(queryKey);
          expect(cacheData).toBeDefined();
          
          // Target item should be updated
          const updatedItem = cacheData?.find(i => i.id === targetItem.id);
          expect(updatedItem?.value).toBe(updatedValue);
          
          // Other items should remain unchanged
          cacheData?.forEach((item, index) => {
            if (index !== targetIndex) {
              expect(item.value).toBe(items[index].value);
              expect(item.name).toBe(items[index].name);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
