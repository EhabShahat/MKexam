'use client';

import { useState, useEffect } from 'react';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MobileDetectionResult {
  isMobile: boolean;           // Screen width < 768px
  isTablet: boolean;           // Screen width 768-1024px
  isTouchDevice: boolean;      // Touch capability detected
  isLandscape: boolean;        // Orientation state
  hasNotch: boolean;           // Device has notch/safe areas
  supportsHaptics: boolean;    // Vibration API available
  viewportHeight: number;      // Current viewport height
  safeAreaInsets: SafeAreaInsets;
}

/**
 * Parses CSS env() safe area inset values
 */
function getSafeAreaInsets(): SafeAreaInsets {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  try {
    // Create a temporary element to read CSS env() values
    const testElement = document.createElement('div');
    testElement.style.position = 'fixed';
    testElement.style.top = 'env(safe-area-inset-top, 0px)';
    testElement.style.right = 'env(safe-area-inset-right, 0px)';
    testElement.style.bottom = 'env(safe-area-inset-bottom, 0px)';
    testElement.style.left = 'env(safe-area-inset-left, 0px)';
    document.body.appendChild(testElement);

    const computed = getComputedStyle(testElement);
    const insets = {
      top: parseFloat(computed.top) || 0,
      right: parseFloat(computed.right) || 0,
      bottom: parseFloat(computed.bottom) || 0,
      left: parseFloat(computed.left) || 0,
    };

    document.body.removeChild(testElement);
    return insets;
  } catch (error) {
    console.warn('Failed to read safe area insets:', error);
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

/**
 * Detects if device has touch capability
 */
function detectTouchCapability(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Detects if device supports haptic feedback (Vibration API)
 */
function detectHapticsSupport(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'vibrate' in navigator;
}

/**
 * Detects current orientation
 */
function detectOrientation(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Use screen.orientation API if available
  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.includes('landscape');
  }
  
  // Fallback to window dimensions
  return window.innerWidth > window.innerHeight;
}

/**
 * Custom hook for detecting mobile device capabilities and context
 * 
 * Implements viewport size detection, touch capability detection,
 * orientation detection, safe area insets detection, and haptics support detection.
 * 
 * Requirements: 4.1, 8.1, 11.1
 */
export function useMobileDetection(): MobileDetectionResult {
  const [detection, setDetection] = useState<MobileDetectionResult>(() => {
    // Initial state (SSR-safe)
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isTouchDevice: false,
        isLandscape: false,
        hasNotch: false,
        supportsHaptics: false,
        viewportHeight: 0,
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      };
    }

    const width = window.innerWidth;
    const safeAreaInsets = getSafeAreaInsets();
    const hasNotch = Object.values(safeAreaInsets).some(value => value > 0);

    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width <= 1024,
      isTouchDevice: detectTouchCapability(),
      isLandscape: detectOrientation(),
      hasNotch,
      supportsHaptics: detectHapticsSupport(),
      viewportHeight: window.innerHeight,
      safeAreaInsets,
    };
  });

  useEffect(() => {
    // Update detection on mount and when window resizes or orientation changes
    const updateDetection = () => {
      const width = window.innerWidth;
      const safeAreaInsets = getSafeAreaInsets();
      const hasNotch = Object.values(safeAreaInsets).some(value => value > 0);

      setDetection({
        isMobile: width < 768,
        isTablet: width >= 768 && width <= 1024,
        isTouchDevice: detectTouchCapability(),
        isLandscape: detectOrientation(),
        hasNotch,
        supportsHaptics: detectHapticsSupport(),
        viewportHeight: window.innerHeight,
        safeAreaInsets,
      });
    };

    // Add resize listener
    window.addEventListener('resize', updateDetection);
    
    // Add orientation change listener
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', updateDetection);
    } else {
      // Fallback for older browsers
      window.addEventListener('orientationchange', updateDetection);
    }

    // Initial update
    updateDetection();

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateDetection);
      
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', updateDetection);
      } else {
        window.removeEventListener('orientationchange', updateDetection);
      }
    };
  }, []);

  return detection;
}
