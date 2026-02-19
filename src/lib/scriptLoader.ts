/**
 * Third-Party Script Loader Utility
 * 
 * Provides utilities for loading external scripts with optimal performance.
 * Implements defer and async loading strategies to prevent render blocking.
 * 
 * Requirements: 8.7 - Load third-party scripts with defer/async attributes
 */

/**
 * Script loading strategy
 * - defer: Script executes after HTML parsing (maintains execution order)
 * - async: Script executes as soon as it's downloaded (no execution order guarantee)
 * - blocking: Script blocks HTML parsing (avoid unless necessary)
 */
export type ScriptStrategy = 'defer' | 'async' | 'blocking';

/**
 * Script loading options
 */
export interface ScriptLoadOptions {
  /** Loading strategy (default: 'defer') */
  strategy?: ScriptStrategy;
  /** Script ID for tracking and preventing duplicates */
  id?: string;
  /** Callback when script loads successfully */
  onLoad?: () => void;
  /** Callback when script fails to load */
  onError?: (error: Error) => void;
  /** Additional attributes to add to script tag */
  attributes?: Record<string, string>;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Loaded scripts cache to prevent duplicate loading
 */
const loadedScripts = new Set<string>();
const loadingScripts = new Map<string, Promise<void>>();

/**
 * Load an external script with optimal performance settings
 * 
 * @param src - Script URL
 * @param options - Loading options
 * @returns Promise that resolves when script is loaded
 * 
 * @example
 * ```typescript
 * // Load analytics script with defer
 * await loadScript('https://analytics.example.com/script.js', {
 *   strategy: 'defer',
 *   id: 'analytics',
 *   onLoad: () => console.log('Analytics loaded'),
 * });
 * 
 * // Load widget script with async
 * await loadScript('https://widget.example.com/widget.js', {
 *   strategy: 'async',
 *   id: 'widget',
 * });
 * ```
 */
export async function loadScript(
  src: string,
  options: ScriptLoadOptions = {}
): Promise<void> {
  const {
    strategy = 'defer',
    id = src,
    onLoad,
    onError,
    attributes = {},
    timeout = 10000,
  } = options;

  // Check if script is already loaded
  if (loadedScripts.has(id)) {
    onLoad?.();
    return Promise.resolve();
  }

  // Check if script is currently loading
  if (loadingScripts.has(id)) {
    return loadingScripts.get(id)!;
  }

  // Create loading promise
  const loadingPromise = new Promise<void>((resolve, reject) => {
    // Create script element
    const script = document.createElement('script');
    script.src = src;
    script.id = id;

    // Apply loading strategy
    if (strategy === 'defer') {
      script.defer = true;
    } else if (strategy === 'async') {
      script.async = true;
    }
    // blocking strategy: no defer or async

    // Add custom attributes
    Object.entries(attributes).forEach(([key, value]) => {
      script.setAttribute(key, value);
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      const error = new Error(`Script loading timeout: ${src}`);
      onError?.(error);
      reject(error);
      cleanup();
    }, timeout);

    // Success handler
    const handleLoad = () => {
      clearTimeout(timeoutId);
      loadedScripts.add(id);
      loadingScripts.delete(id);
      onLoad?.();
      resolve();
      cleanup();
    };

    // Error handler
    const handleError = () => {
      clearTimeout(timeoutId);
      loadingScripts.delete(id);
      const error = new Error(`Failed to load script: ${src}`);
      onError?.(error);
      reject(error);
      cleanup();
    };

    // Cleanup function
    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    // Attach event listeners
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    // Append to document
    document.head.appendChild(script);
  });

  // Cache loading promise
  loadingScripts.set(id, loadingPromise);

  return loadingPromise;
}

/**
 * Load multiple scripts in parallel
 * 
 * @param scripts - Array of script configurations
 * @returns Promise that resolves when all scripts are loaded
 * 
 * @example
 * ```typescript
 * await loadScripts([
 *   { src: 'https://cdn.example.com/lib1.js', strategy: 'defer' },
 *   { src: 'https://cdn.example.com/lib2.js', strategy: 'async' },
 * ]);
 * ```
 */
export async function loadScripts(
  scripts: Array<{ src: string } & ScriptLoadOptions>
): Promise<void> {
  await Promise.all(
    scripts.map(({ src, ...options }) => loadScript(src, options))
  );
}

/**
 * Load scripts in sequence (one after another)
 * Useful when scripts have dependencies
 * 
 * @param scripts - Array of script configurations
 * @returns Promise that resolves when all scripts are loaded
 * 
 * @example
 * ```typescript
 * // Load jQuery first, then plugins
 * await loadScriptsSequentially([
 *   { src: 'https://cdn.example.com/jquery.js' },
 *   { src: 'https://cdn.example.com/jquery-plugin.js' },
 * ]);
 * ```
 */
export async function loadScriptsSequentially(
  scripts: Array<{ src: string } & ScriptLoadOptions>
): Promise<void> {
  for (const { src, ...options } of scripts) {
    await loadScript(src, options);
  }
}

/**
 * Check if a script is loaded
 * 
 * @param id - Script ID
 * @returns True if script is loaded
 */
export function isScriptLoaded(id: string): boolean {
  return loadedScripts.has(id);
}

/**
 * Remove a loaded script from the DOM and cache
 * 
 * @param id - Script ID
 */
export function removeScript(id: string): void {
  const script = document.getElementById(id);
  if (script) {
    script.remove();
  }
  loadedScripts.delete(id);
  loadingScripts.delete(id);
}

/**
 * Preload a script without executing it
 * Useful for prefetching scripts that will be needed later
 * 
 * @param src - Script URL
 * @param id - Script ID
 * 
 * @example
 * ```typescript
 * // Preload analytics script
 * preloadScript('https://analytics.example.com/script.js', 'analytics');
 * 
 * // Later, load and execute it
 * await loadScript('https://analytics.example.com/script.js', { id: 'analytics' });
 * ```
 */
export function preloadScript(src: string, id?: string): void {
  // Check if already preloaded
  const existingPreload = document.querySelector(
    `link[rel="preload"][href="${src}"]`
  );
  if (existingPreload) return;

  // Create preload link
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = src;
  if (id) {
    link.id = `preload-${id}`;
  }

  document.head.appendChild(link);
}

/**
 * Load a script only when the user interacts with the page
 * Useful for non-critical scripts like analytics or chat widgets
 * 
 * @param src - Script URL
 * @param options - Loading options
 * @returns Promise that resolves when script is loaded
 * 
 * @example
 * ```typescript
 * // Load chat widget on first user interaction
 * loadScriptOnInteraction('https://chat.example.com/widget.js', {
 *   id: 'chat-widget',
 *   strategy: 'async',
 * });
 * ```
 */
export function loadScriptOnInteraction(
  src: string,
  options: ScriptLoadOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'];
    
    const loadOnInteraction = () => {
      // Remove event listeners
      events.forEach((event) => {
        document.removeEventListener(event, loadOnInteraction);
      });

      // Load script
      loadScript(src, options)
        .then(resolve)
        .catch(reject);
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, loadOnInteraction, { once: true });
    });

    // Fallback: load after 5 seconds if no interaction
    setTimeout(loadOnInteraction, 5000);
  });
}

/**
 * Load a script when it becomes visible in the viewport
 * Useful for scripts that are only needed for specific sections
 * 
 * @param src - Script URL
 * @param targetElement - Element to observe
 * @param options - Loading options
 * @returns Promise that resolves when script is loaded
 * 
 * @example
 * ```typescript
 * const videoSection = document.getElementById('video-section');
 * loadScriptOnVisible('https://player.example.com/player.js', videoSection, {
 *   id: 'video-player',
 * });
 * ```
 */
export function loadScriptOnVisible(
  src: string,
  targetElement: Element,
  options: ScriptLoadOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.disconnect();
            loadScript(src, options)
              .then(resolve)
              .catch(reject);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(targetElement);
  });
}
