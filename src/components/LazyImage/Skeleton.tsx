/**
 * Skeleton Component for LazyImage
 * Feature: performance-optimization-and-backend-fixes
 * 
 * Displays a skeleton screen placeholder while images are loading.
 * Validates: Requirements 2.3
 */

import React from 'react';

export function ImageSkeleton() {
  return (
    <div className="absolute inset-0 bg-gray-200 animate-pulse">
      <div className="w-full h-full flex items-center justify-center">
        <svg
          className="w-10 h-10 text-gray-400"
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
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    </div>
  );
}
