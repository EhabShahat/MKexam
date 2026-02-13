/**
 * Error Fallback Component for LazyImage
 * Feature: performance-optimization-and-backend-fixes
 * 
 * Displays a fallback placeholder when images fail to load.
 * Logs errors for monitoring.
 * Validates: Requirements 2.4
 */

import React from 'react';

interface ErrorFallbackProps {
  alt: string;
  customFallback?: React.ReactNode;
}

export function ImageErrorFallback({ alt, customFallback }: ErrorFallbackProps) {
  if (customFallback) {
    return <div className="absolute inset-0">{customFallback}</div>;
  }

  return (
    <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-gray-400">
        <svg
          className="w-10 h-10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-xs text-center px-2" role="alert">
          {alt || 'Image failed to load'}
        </span>
      </div>
    </div>
  );
}

/**
 * Log image loading errors for monitoring
 */
export function logImageError(src: string, alt: string, error: Error) {
  console.error('[LazyImage] Image load error:', {
    src,
    alt,
    error: error.message,
    timestamp: new Date().toISOString(),
  });

  // In production, this could send to a monitoring service
  // Example: sendToMonitoring({ type: 'image_load_error', src, alt, error });
}
