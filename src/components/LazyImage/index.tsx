"use client";

/**
 * LazyImage Component
 * Feature: performance-optimization-and-backend-fixes
 * 
 * A drop-in replacement for Next.js Image component with enhanced lazy loading.
 * Uses Intersection Observer API for viewport detection with 200px threshold.
 * Implements skeleton placeholders and proper error handling.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LazyImageProps, ImageLoadState } from './types';
import { ImageSkeleton } from './Skeleton';
import { ImageErrorFallback, logImageError } from './ErrorFallback';
import {
  calculateAspectRatioPadding,
  generatePlaceholderUrl,
  shouldUseProgressiveLoading,
  getContainerStyles,
  getImageStyles,
} from './utils';

export default function LazyImage({
  src,
  alt,
  width,
  height,
  aspectRatio,
  className = '',
  fallback,
  skeleton = true,
  threshold = 200,
  onLoad,
  onError,
}: LazyImageProps) {
  const [loadState, setLoadState] = useState<ImageLoadState>({
    status: 'idle',
  });
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Calculate aspect ratio for layout shift prevention
  const paddingBottom = calculateAspectRatioPadding(aspectRatio, width, height);
  const usesAspectRatio = paddingBottom !== undefined;

  // Determine if progressive loading should be used
  const useProgressiveLoading = shouldUseProgressiveLoading(width, height);
  const placeholderUrl = useProgressiveLoading ? generatePlaceholderUrl(src) : undefined;

  // Handle image load success
  const handleLoad = useCallback(() => {
    setLoadState({ status: 'loaded' });
    onLoad?.();
  }, [onLoad]);

  // Handle image load error
  const handleError = useCallback(() => {
    const error = new Error(`Failed to load image: ${src}`);
    setLoadState({ status: 'error', error });
    
    // Log error for monitoring
    logImageError(src, alt, error);
    
    onError?.(error);
  }, [src, alt, onError]);

  // Start loading the image
  const startLoading = useCallback(() => {
    if (loadState.status !== 'idle') return;
    setLoadState({ status: 'loading' });

    // Load placeholder first for progressive loading
    if (useProgressiveLoading && placeholderUrl) {
      setShowPlaceholder(true);
    }
  }, [loadState.status, useProgressiveLoading, placeholderUrl]);

  // Setup Intersection Observer with 200px threshold
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startLoading();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: `${threshold}px`, // Load when within threshold pixels of viewport
      }
    );

    observer.observe(imgRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, startLoading]);

  // Render skeleton placeholder
  const renderSkeleton = () => {
    if (!skeleton) return null;
    return <ImageSkeleton />;
  };

  // Render error fallback
  const renderError = () => {
    return <ImageErrorFallback alt={alt} customFallback={fallback} />;
  };

  // Container style for aspect ratio preservation
  const containerStyle = getContainerStyles(width, height, paddingBottom);

  // Image style
  const imageStyle = getImageStyles(usesAspectRatio);

  return (
    <div className={`overflow-hidden ${className}`} style={containerStyle}>
      {/* Show skeleton while loading */}
      {loadState.status === 'loading' && renderSkeleton()}

      {/* Show error fallback */}
      {loadState.status === 'error' && renderError()}

      {/* Progressive loading: Show blurred placeholder */}
      {showPlaceholder && placeholderUrl && loadState.status === 'loading' && (
        <img
          src={placeholderUrl}
          alt=""
          style={imageStyle}
          className="absolute inset-0 blur-sm"
          aria-hidden="true"
        />
      )}

      {/* Actual image */}
      <img
        ref={imgRef}
        src={loadState.status === 'loading' || loadState.status === 'loaded' ? src : undefined}
        alt={alt}
        style={imageStyle}
        className={`transition-opacity duration-300 ${
          loadState.status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
