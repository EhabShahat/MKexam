/**
 * Mobile-specific React hooks
 * 
 * This directory contains custom hooks for:
 * - useMobileDetection: Device and viewport detection
 * - useGestures: Touch gesture recognition
 * - useVirtualKeyboard: Virtual keyboard handling
 * - useHaptics: Haptic feedback control
 */

export { useMobileDetection } from './useMobileDetection';
export { useGestures, type GestureConfig } from './useGestures';
export { 
  useVirtualKeyboard, 
  type VirtualKeyboardState, 
  type VirtualKeyboardConfig 
} from './useVirtualKeyboard';
