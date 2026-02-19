/**
 * HapticsController - Manages haptic feedback for mobile devices
 * Provides vibration patterns with feature detection and graceful degradation
 */

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

export interface HapticsConfig {
  enabled: boolean;
  intensity: number; // 0-1 scale for pattern intensity
}

// Vibration patterns in milliseconds [vibrate, pause, vibrate, ...]
const VIBRATION_PATTERNS: Record<HapticPattern, number[]> = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [10, 50, 10],
  error: [20, 100, 20, 100, 20],
  warning: [15, 80, 15],
};

export class HapticsController {
  private config: HapticsConfig;
  private isSupported: boolean;

  constructor(config: Partial<HapticsConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      intensity: config.intensity !== undefined 
        ? Math.round(Math.max(0, Math.min(1, config.intensity)) * 1e10) / 1e10
        : 1.0,
    };
    this.isSupported = this.detectHapticSupport();
  }

  /**
   * Detect if haptic feedback is supported on this device
   */
  private detectHapticSupport(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check for Vibration API support
    return 'vibrate' in navigator || 'mozVibrate' in navigator || 'webkitVibrate' in navigator;
  }

  /**
   * Check if haptics are currently supported
   */
  public isHapticsSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Enable haptic feedback
   */
  public enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable haptic feedback
   */
  public disable(): void {
    this.config.enabled = false;
  }

  /**
   * Check if haptics are currently enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set the intensity of haptic feedback (0-1)
   */
  public setIntensity(intensity: number): void {
    // Clamp to [0, 1] and round to avoid floating point precision issues
    const clamped = Math.max(0, Math.min(1, intensity));
    this.config.intensity = Math.round(clamped * 1e10) / 1e10;
  }

  /**
   * Get the current intensity setting
   */
  public getIntensity(): number {
    return this.config.intensity;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): HapticsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<HapticsConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
    if (config.intensity !== undefined) {
      const clamped = Math.max(0, Math.min(1, config.intensity));
      this.config.intensity = Math.round(clamped * 1e10) / 1e10;
    }
  }

  /**
   * Trigger a haptic feedback pattern
   * Gracefully degrades if haptics are not supported
   */
  public trigger(pattern: HapticPattern): boolean {
    // Graceful degradation: return false if not supported or disabled
    if (!this.isSupported || !this.config.enabled) {
      return false;
    }

    try {
      const basePattern = VIBRATION_PATTERNS[pattern];
      
      // Apply intensity scaling to the pattern
      const scaledPattern = basePattern.map(duration => 
        Math.round(duration * this.config.intensity)
      );

      // Use the Vibration API
      if ('vibrate' in navigator) {
        navigator.vibrate(scaledPattern);
        return true;
      } else if ('mozVibrate' in (navigator as any)) {
        (navigator as any).mozVibrate(scaledPattern);
        return true;
      } else if ('webkitVibrate' in (navigator as any)) {
        (navigator as any).webkitVibrate(scaledPattern);
        return true;
      }

      return false;
    } catch (error) {
      // Graceful degradation: silently fail and return false
      console.warn('Haptic feedback failed:', error);
      return false;
    }
  }

  /**
   * Cancel any ongoing vibration
   */
  public cancel(): void {
    if (!this.isSupported) return;

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      } else if ('mozVibrate' in (navigator as any)) {
        (navigator as any).mozVibrate(0);
      } else if ('webkitVibrate' in (navigator as any)) {
        (navigator as any).webkitVibrate(0);
      }
    } catch (error) {
      console.warn('Failed to cancel haptic feedback:', error);
    }
  }

  /**
   * Test haptic feedback with a light pattern
   */
  public test(): boolean {
    return this.trigger('light');
  }
}

// Singleton instance for global use
let globalHapticsController: HapticsController | null = null;

/**
 * Get or create the global HapticsController instance
 */
export function getHapticsController(): HapticsController {
  if (!globalHapticsController) {
    globalHapticsController = new HapticsController();
  }
  return globalHapticsController;
}

/**
 * Reset the global HapticsController instance (useful for testing)
 */
export function resetHapticsController(): void {
  globalHapticsController = null;
}
