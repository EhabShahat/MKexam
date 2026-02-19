/**
 * Optimized Script Component
 * 
 * Wrapper around Next.js Script component with optimal loading strategies.
 * Provides a convenient way to load third-party scripts with defer/async.
 * 
 * Requirements: 8.7 - Load third-party scripts with defer/async attributes
 */

'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

export interface OptimizedScriptProps {
  /** Script source URL */
  src: string;
  /** Script ID for tracking */
  id?: string;
  /** Loading strategy */
  strategy?: 'afterInteractive' | 'lazyOnload' | 'beforeInteractive' | 'worker';
  /** Callback when script loads */
  onLoad?: () => void;
  /** Callback when script errors */
  onError?: () => void;
  /** Callback when script is ready */
  onReady?: () => void;
  /** Additional attributes */
  [key: string]: any;
}

/**
 * Optimized script component with defer/async loading
 * 
 * @example
 * ```tsx
 * // Load analytics with defer (default)
 * <OptimizedScript
 *   src="https://analytics.example.com/script.js"
 *   id="analytics"
 *   strategy="afterInteractive"
 *   onLoad={() => console.log('Analytics loaded')}
 * />
 * 
 * // Load chat widget lazily
 * <OptimizedScript
 *   src="https://chat.example.com/widget.js"
 *   id="chat"
 *   strategy="lazyOnload"
 * />
 * ```
 */
export function OptimizedScript({
  src,
  id,
  strategy = 'afterInteractive',
  onLoad,
  onError,
  onReady,
  ...props
}: OptimizedScriptProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isLoaded && onReady) {
      onReady();
    }
  }, [isLoaded, onReady]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    console.error(`Failed to load script: ${src}`);
    onError?.();
  };

  return (
    <Script
      src={src}
      id={id}
      strategy={strategy}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
}

/**
 * Analytics script component
 * Loads analytics scripts with optimal performance
 */
export function AnalyticsScript({
  src,
  id = 'analytics',
  onLoad,
}: {
  src: string;
  id?: string;
  onLoad?: () => void;
}) {
  return (
    <OptimizedScript
      src={src}
      id={id}
      strategy="afterInteractive"
      onLoad={onLoad}
    />
  );
}

/**
 * Chat widget script component
 * Loads chat widgets lazily to not block initial page load
 */
export function ChatWidgetScript({
  src,
  id = 'chat-widget',
  onLoad,
}: {
  src: string;
  id?: string;
  onLoad?: () => void;
}) {
  return (
    <OptimizedScript
      src={src}
      id={id}
      strategy="lazyOnload"
      onLoad={onLoad}
    />
  );
}

/**
 * Video player script component
 * Loads video player scripts only when needed
 */
export function VideoPlayerScript({
  src,
  id = 'video-player',
  onLoad,
}: {
  src: string;
  id?: string;
  onLoad?: () => void;
}) {
  return (
    <OptimizedScript
      src={src}
      id={id}
      strategy="lazyOnload"
      onLoad={onLoad}
    />
  );
}

/**
 * Payment gateway script component
 * Loads payment scripts with high priority but after interactive
 */
export function PaymentScript({
  src,
  id = 'payment',
  onLoad,
}: {
  src: string;
  id?: string;
  onLoad?: () => void;
}) {
  return (
    <OptimizedScript
      src={src}
      id={id}
      strategy="afterInteractive"
      onLoad={onLoad}
    />
  );
}
