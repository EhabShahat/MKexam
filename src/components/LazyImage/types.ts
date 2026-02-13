/**
 * LazyImage Component Types
 * Feature: performance-optimization-and-backend-fixes
 */

export interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g., "16/9" to prevent layout shift
  className?: string;
  fallback?: React.ReactNode;
  skeleton?: boolean; // Show skeleton during load (default: true)
  threshold?: number; // Intersection threshold in pixels (default: 200)
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export interface ImageLoadState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: Error;
}
