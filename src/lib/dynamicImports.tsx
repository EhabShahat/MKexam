/**
 * Dynamic Import Utilities
 * 
 * Provides utilities for lazy loading heavy components to improve initial bundle size.
 * This implements code splitting for admin-specific and heavy third-party libraries.
 * 
 * Requirements: 8.1, 8.3 - Code splitting and dynamic imports
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Loading component shown while dynamic imports are loading
 */
const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="spinner" />
      <span className="sr-only">Loading...</span>
    </div>
  );
};

/**
 * Error boundary component for dynamic import failures
 */
const LoadingError = () => {
  return (
    <div className="card p-4 text-center text-destructive">
      <p>Failed to load component. Please refresh the page.</p>
    </div>
  );
};

/**
 * Chart.js components - Heavy library, only needed in admin dashboard
 * Lazy load to reduce initial bundle size
 */
export const DynamicLineChart = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Line),
  {
    loading: LoadingSpinner,
    ssr: false, // Charts don't need SSR
  }
);

export const DynamicBarChart = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Bar),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

export const DynamicDoughnutChart = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Doughnut),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

/**
 * Excel/CSV processing - Heavy libraries, only needed for import/export
 */
export const DynamicExcelProcessor = dynamic(
  () => import('@/components/admin/ExcelProcessor'),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

/**
 * PDF generation - Heavy library, only needed for report generation
 */
export const DynamicPDFGenerator = dynamic(
  () => import('@/components/admin/PDFGenerator'),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

/**
 * Drag and drop components - Only needed in question management
 */
export const DynamicDndContext = dynamic(
  () => import('@dnd-kit/core').then((mod) => mod.DndContext),
  {
    loading: LoadingSpinner,
    ssr: true, // DnD needs SSR for proper hydration
  }
);

/**
 * Virtual scrolling - Only needed for large lists
 */
export const DynamicVirtualizer = dynamic(
  () => import('@tanstack/react-virtual').then((mod) => mod.useVirtualizer),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

/**
 * QR Code generator - Only needed in specific admin pages
 */
export const DynamicQRCode = dynamic(
  () => import('qrcode').then((mod) => mod),
  {
    loading: LoadingSpinner,
    ssr: false,
  }
);

/**
 * Generic dynamic import wrapper with error handling
 * 
 * @param importFn - Function that returns a dynamic import promise
 * @param options - Dynamic import options
 * @returns Dynamically imported component
 */
export function createDynamicImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  options: {
    loading?: ComponentType;
    error?: ComponentType;
    ssr?: boolean;
  } = {}
): ComponentType<React.ComponentProps<T>> {
  return dynamic(
    async () => {
      try {
        const mod = await importFn();
        return 'default' in mod ? mod.default : mod;
      } catch (error) {
        console.error('Dynamic import failed:', error);
        return options.error || LoadingError;
      }
    },
    {
      loading: options.loading || LoadingSpinner,
      ssr: options.ssr ?? true,
    }
  ) as ComponentType<React.ComponentProps<T>>;
}

/**
 * Preload a dynamic import
 * Useful for prefetching components that will be needed soon
 * 
 * @param importFn - Function that returns a dynamic import promise
 */
export async function preloadDynamicImport<T>(
  importFn: () => Promise<T>
): Promise<void> {
  try {
    await importFn();
  } catch (error) {
    console.error('Preload failed:', error);
  }
}

/**
 * Admin-only components wrapper
 * Ensures admin components are code-split from student-facing code
 * 
 * @param componentPath - Path to the admin component
 * @returns Dynamically imported admin component
 */
export function createAdminComponent<T extends ComponentType<any>>(
  componentPath: string
): ComponentType<React.ComponentProps<T>> {
  return dynamic(() => import(`@/components/admin/${componentPath}`), {
    loading: LoadingSpinner,
    ssr: true,
  }) as ComponentType<React.ComponentProps<T>>;
}
