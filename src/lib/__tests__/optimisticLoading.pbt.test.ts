/**
 * Feature: performance-optimization-and-backend-fixes
 * Property 10: Loading indicator during mutations
 * Validates: Requirements 3.5
 * 
 * Property-based tests for loading indicators during optimistic mutations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, useMutation, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { createOptimisticMutation } from '../optimisticUpdates';
import { createElement, ReactNode } from 'react';

describe('Optimistic Updates - Property 10: Loading Indicators', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  /**
   * Property 10.1: isPending is true during mutation execution
   * 
   * The mutation's isPending flag should be true from when the mutation
   * is triggered until it completes (success or error).
   */
  it('should show isPending=true during mutation execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          value: fc.integer({ min: 10, max: 100 }),
        }),
        fc.integer({ min: 100, max: 200 }), // Moderate delays for reliability
        async (data, delay) => {
          const queryKey = ['test', 'loading'];
          queryClient.setQueryData(queryKey, data);
          
          const mutationConfig = createOptimisticMutation(queryClient, {
            mutationFn: async (variables: typeof data) => {
              await new Promise(resolve => setTimeout(resolve, delay));
              return variables;
            },
            queryKey,
            updateCache: (_oldData, variables) => variables,
          });
          
          const { result } = renderHook(
            () => useMutation(mutationConfig),
            { wrapper }
          );
          
          // Initially not pending
          expect(result.current.isPending).toBe(false);
          
          // Trigger mutation
          result.current.mutate({ ...data, value: data.value + 10 });
          
          // Should be pending immediately after trigger
          await waitFor(() => {
            expect(result.current.isPending).toBe(true);
          }, { timeout: 200 });
          
          // Should still be pending during execution
          expect(result.current.isPending).toBe(true);
          
          // Wait for completion
          await waitFor(() => {
            expect(result.current.isPending).toBe(false);
          }, { timeout: delay + 500 });
          
          // Should not be pending after completion
          expect(result.current.isPending).toBe(false);
          expect(result.current.isSuccess).toBe(true);
        }
      ),
      { numRuns: 20 } // Reduced runs to prevent timeout
    );
  }, 15000); // Increased test timeout to 15 seconds

  /**
   * Property 10.2: isPending transitions correctly on success
   * 
   * The isPending flag should transition from false -> true -> false
   * when a mutation succeeds.
   */
  it('should transition isPending correctly on success', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (value) => {
          const queryKey = ['test', 'success-loading'];
          const initialData = { value };
          queryClient.setQueryData(queryKey, initialData);
          
          const pendingStates: boolean[] = [];
          let wasPendingInCallback = false;
          
          const mutationConfig = createOptimisticMutation(queryClient, {
            mutationFn: async (variables: typeof initialData) => {
              // Use a longer delay to make state observable
              await new Promise(resolve => setTimeout(resolve, 100));
              return variables;
            },
            queryKey,
            updateCache: (_oldData, variables) => variables,
            onSuccess: () => {
              // Track that we reached success
            },
          });
          
          const { result } = renderHook(
            () => {
              const mutation = useMutation(mutationConfig);
              // Track isPending state whenever it changes
              if (mutation.isPending && !wasPendingInCallback) {
                wasPendingInCallback = true;
              }
              return mutation;
            },
            { wrapper }
          );
          
          // Record initial state
          pendingStates.push(result.current.isPending);
          expect(result.current.isPending).toBe(false);
          
          // Trigger mutation
          result.current.mutate({ value: value + '_updated' });
          
          // Wait for pending state to become true
          await waitFor(() => {
            if (result.current.isPending) {
              pendingStates.push(true);
            }
            expect(result.current.isPending).toBe(true);
          }, { timeout: 200 });
          
          // Wait for completion
          await waitFor(() => {
            expect(result.current.isPending).toBe(false);
          }, { timeout: 500 });
          
          // Record final state
          pendingStates.push(result.current.isPending);
          
          // Should have transitioned: false -> true -> false
          expect(pendingStates[0]).toBe(false); // Initial
          expect(pendingStates.some(state => state === true)).toBe(true); // Was pending
          expect(pendingStates[pendingStates.length - 1]).toBe(false); // Final
          expect(result.current.isSuccess).toBe(true);
        }
      ),
      { numRuns: 20 } // Reduced runs to prevent timeout
    );
  }, 10000); // Increased test timeout to 10 seconds

  /**
   * Property 10.3: isPending transitions correctly on error
   * 
   * The isPending flag should transition from false -> true -> false
   * even when a mutation fails.
   */
  it('should transition isPending correctly on error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (value) => {
          const queryKey = ['test', 'error-loading'];
          const initialData = { value };
          queryClient.setQueryData(queryKey, initialData);
          
          const pendingStates: boolean[] = [];
          
          const mutationConfig = createOptimisticMutation(queryClient, {
            mutationFn: async () => {
              // Use a longer delay to make state observable
              await new Promise(resolve => setTimeout(resolve, 100));
              throw new Error('Mutation failed');
            },
            queryKey,
            updateCache: (_oldData, variables) => variables,
          });
          
          const { result } = renderHook(
            () => useMutation(mutationConfig),
            { wrapper }
          );
          
          // Record initial state
          pendingStates.push(result.current.isPending);
          expect(result.current.isPending).toBe(false);
          
          // Trigger mutation
          result.current.mutate({ value: value + 100 });
          
          // Wait for pending state to become true
          await waitFor(() => {
            if (result.current.isPending) {
              pendingStates.push(true);
            }
            expect(result.current.isPending).toBe(true);
          }, { timeout: 200 });
          
          // Wait for error
          await waitFor(() => {
            expect(result.current.isPending).toBe(false);
          }, { timeout: 500 });
          
          // Record final state
          pendingStates.push(result.current.isPending);
          
          // Should have transitioned: false -> true -> false (even on error)
          expect(pendingStates[0]).toBe(false); // Initial
          expect(pendingStates.some(state => state === true)).toBe(true); // Was pending
          expect(pendingStates[pendingStates.length - 1]).toBe(false); // Final
          
          // Should have error
          expect(result.current.isError).toBe(true);
        }
      ),
      { numRuns: 20 } // Reduced runs to prevent timeout
    );
  }, 10000); // Increased test timeout to 10 seconds
});
