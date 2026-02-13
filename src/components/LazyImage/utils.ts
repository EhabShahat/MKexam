/**
 * Utility functions for LazyImage
 * Feature: performance-optimization-and-backend-fixes
 * 
 * Handles aspect ratio calculation and progressive image loading.
 * Validates: Requirements 2.6, 2.7
 */

/**
 * Calculate aspect ratio percentage for padding-bottom technique
 * This prevents layout shift by reserving space before image loads
 */
export function calculateAspectRatioPadding(
  aspectRatio?: string,
  width?: number,
  height?: number
): number | undefined {
  // Priority 1: Use explicit aspect ratio string (e.g., "16/9")
  if (aspectRatio) {
    const [w, h] = aspectRatio.split('/').map(Number);
    if (w && h && !isNaN(w) && !isNaN(h)) {
      return (h / w) * 100;
    }
  }

  // Priority 2: Calculate from width and height
  if (width && height && width > 0 && height > 0) {
    return (height / width) * 100;
  }

  return undefined;
}

/**
 * Generate a low-quality placeholder image URL for progressive loading
 * This creates a blur-up effect for large images
 */
export function generatePlaceholderUrl(src: string, quality: number = 10): string {
  // If it's a data URL or external URL, return as is
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  // For Supabase storage URLs, we can add transformation parameters
  if (src.includes('supabase')) {
    const url = new URL(src);
    url.searchParams.set('width', '20');
    url.searchParams.set('quality', quality.toString());
    return url.toString();
  }

  // For other URLs, return as is (could be enhanced with image CDN support)
  return src;
}

/**
 * Determine if an image should use progressive loading
 * Large images benefit from blur-up technique
 */
export function shouldUseProgressiveLoading(
  width?: number,
  height?: number,
  threshold: number = 800
): boolean {
  if (!width && !height) return false;
  
  const maxDimension = Math.max(width || 0, height || 0);
  return maxDimension >= threshold;
}

/**
 * Calculate container styles for layout shift prevention
 */
export function getContainerStyles(
  width?: number,
  height?: number,
  paddingBottom?: number
): React.CSSProperties {
  return {
    position: 'relative',
    width: width ? `${width}px` : '100%',
    height: height && !paddingBottom ? `${height}px` : undefined,
    paddingBottom: paddingBottom ? `${paddingBottom}%` : undefined,
  };
}

/**
 * Calculate image styles based on aspect ratio usage
 */
export function getImageStyles(usesAspectRatio: boolean): React.CSSProperties {
  if (usesAspectRatio) {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    };
  }

  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };
}
