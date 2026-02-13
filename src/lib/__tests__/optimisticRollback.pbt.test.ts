/**
 * Feature: performance-optimization-and-backend-fixes
 * Property 9: Optimistic update rollback
 * Validates: Requirements 3.4
 * 
 * Property-based tests for optimistic update rollback on errors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import fc from 'fast-check';
import { createOptimisticMutation, createOptimisticListItemUpdate } from '../optimisticUpdates';

describe('Optimistic Updates - Property 9: Rollback Behavior', () => {
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
   * Property 9.1: Cache is restored to previous state on mutation error
   * 
   * When a mutation fails, the cache should be rolled back to the exact
   * state it was in before the optimistic update was applied.
   */
  it('should rollback cache to previous state on error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          value: fc.integer({ min: 0, max: 1000 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async (initialData) => {
          const queryKey = ['test', 'rollback'];
          
          // Set initial cache data
          queryClient.setQueryData(queryKey, initialData);
          const snapshotBefore = queryClient.getQueryData(queryKey);
          
          // Create a mutation that always fails (no artificial delay)
          const mutation = createOptimisticMutation(queryClient, {
            mutationFn: async () => {
              throw new Error('Mutation failed');
            },
            queryKey,
            updateCache: (_oldData, _variables) => ({
              ...initialData,
              value: initialData.value + 999,
              name: 'UPDATED',
            }),
          });
          
          // Trigger mutation and handle error
          try {
            await mutation.onMutate?.(initialData);
            
            // Cache should be optimistically updated
            const optimisticCache = queryClient.getQueryData(queryKey);
            expect(optimisticCache).not.toEqual(snapshotBefore);
            
            // Trigger the mutation function (which will fail)
            await mutation.mutationFn(initialData);
          } catch (error) {
            // Call onError to trigger rollback
            await mutation.onError?.(error as Error, initialData, {
              previousData: snapshotBefore,
              queryKey,
            });
          }
          
          // Cache should be rolled back to original state
          const cacheAfterRollback = queryClient.getQueryData(queryKey);
          expect(cacheAfterRollback).toEqual(snapshotBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: Rollback works for list item updates
   * 
   * When updating an item in a list fails, only that item should be
   * rolled back while other items remain in their current state.
   */
  it('should rollback only the updated item in a list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            status: fc.constantFrom('active', 'inactive', 'pending'),
            count: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.integer({ min: 0, max: 9 }),
        async (items, targetIndex) => {
          if (targetIndex >= items.length) return;
          
          const queryKey = ['test', 'list-rollback'];
          queryClient.setQueryData(queryKey, items);
          
          const targetItem = items[targetIndex];
          const snapshotBefore = [...items];
          
          const mutation = createOptimisticListItemUpdate(queryClient, {
            mutationFn: async () => {
              throw new Error('Update failed');
            },
            queryKey,
            itemMatcher: (item, variables) => item.id === variables.id,
          });
          
          try {
            await mutation.onMutate?.({ id: targetItem.id, status: 'updated' as any });
            
            // Trigger the mutation (which will fail)
            await mutation.mutationFn({ id: targetItem.id, status: 'updated' as any });
          } catch (error) {
            // Call onError to trigger rollback
            await mutation.onError?.(error as Error, { id: targetItem.id, status: 'updated' as any }, {
              previousData: snapshotBefore,
              queryKey,
            });
          }
          
          // Cache should be rolled back
          const cacheAfterRollback = queryClient.getQueryData<typeof items>(queryKey);
          expect(cacheAfterRollback).toEqual(snapshotBefore);
          
          // Verify the target item is back to original state
          const rolledBackItem = cacheAfterRollback?.find(i => i.id === targetItem.id);
          expect(rolledBackItem?.status).toBe(targetItem.status);
          expect(rolledBackItem?.count).toBe(targetItem.count);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.3: Multiple failed mutations rollback independently
   * 
   * When multiple mutations fail, each should rollback to its own
   * previous state without affecting other mutations.
   */
  it('should handle multiple independent rollbacks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 2, maxLength: 3 }
        ),
        async (dataPoints) => {
          // Set up separate query keys for each data point
          const queryKeys = dataPoints.map((_, i) => ['test', 'multi-rollback', i]);
          
          // Initialize cache for each query
          dataPoints.forEach((data, i) => {
            queryClient.setQueryData(queryKeys[i], data);
          });
          
          // Create mutations that will fail
          const mutations = dataPoints.map((data, i) => {
            return createOptimisticMutation(queryClient, {
              mutationFn: async () => {
                throw new Error(`Mutation ${i} failed`);
              },
              queryKey: queryKeys[i],
              updateCache: (_oldData, _variables) => ({
                ...data,
                value: data.value + 1000,
              }),
            });
          });
          
          // Trigger all mutations and collect snapshots
          const snapshots = dataPoints.map((data, i) => 
            queryClient.getQueryData(queryKeys[i])
          );
          
          // Execute mutations in parallel and handle errors
          await Promise.all(
            mutations.map(async (mutation, i) => {
              try {
                await mutation.onMutate?.(dataPoints[i]);
                await mutation.mutationFn(dataPoints[i]);
              } catch (error) {
                await mutation.onError?.(error as Error, dataPoints[i], {
                  previousData: snapshots[i],
                  queryKey: queryKeys[i],
                });
              }
            })
          );
          
          // Verify each cache was rolled back independently
          dataPoints.forEach((data, i) => {
            const cacheData = queryClient.getQueryData(queryKeys[i]);
            expect(cacheData).toEqual(snapshots[i]);
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});
