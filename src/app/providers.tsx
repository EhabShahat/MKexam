"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import ToastProvider from "@/components/ToastProvider";

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Optimized cache configuration for score calculation system
        staleTime: 5 * 60 * 1000, // 5 minutes - score data doesn't change frequently
        gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer for better performance
        refetchOnWindowFocus: false, // Avoid unnecessary refetches on focus
        refetchOnReconnect: true, // Refetch on network reconnection
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      },
      mutations: {
        // Optimistic updates configuration
        retry: 1,
        retryDelay: 1000,
        onError: (error, variables, context) => {
          console.error('Mutation error:', error);
        },
      },
    },
    // Query-specific cache configurations
    queryCache: undefined, // Use default
    mutationCache: undefined, // Use default
  }));

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
