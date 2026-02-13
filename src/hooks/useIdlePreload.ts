"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to preload routes during browser idle time
 * This improves navigation performance by prefetching likely next pages
 */
export function useIdlePreload(routes: string[]) {
  const router = useRouter();

  useEffect(() => {
    // Check if requestIdleCallback is supported
    if (typeof window === "undefined" || !("requestIdleCallback" in window)) {
      return;
    }

    const idleCallback = (window as any).requestIdleCallback(
      () => {
        // Prefetch routes during idle time
        routes.forEach((route) => {
          try {
            router.prefetch(route);
          } catch (error) {
            console.warn(`Failed to prefetch route: ${route}`, error);
          }
        });
      },
      { timeout: 2000 } // Fallback timeout if browser never becomes idle
    );

    return () => {
      if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleCallback);
      }
    };
  }, [routes, router]);
}

/**
 * Hook to preload critical resources during idle time
 * Useful for preloading images, scripts, or other assets
 */
export function useIdleResourcePreload(resources: Array<{ href: string; as: string; type?: string }>) {
  useEffect(() => {
    if (typeof window === "undefined" || !("requestIdleCallback" in window)) {
      return;
    }

    const idleCallback = (window as any).requestIdleCallback(
      () => {
        resources.forEach((resource) => {
          try {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = resource.href;
            link.as = resource.as;
            if (resource.type) {
              link.type = resource.type;
            }
            document.head.appendChild(link);
          } catch (error) {
            console.warn(`Failed to preload resource: ${resource.href}`, error);
          }
        });
      },
      { timeout: 2000 }
    );

    return () => {
      if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleCallback);
      }
    };
  }, [resources]);
}
