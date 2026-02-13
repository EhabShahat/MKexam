"use client";

import dynamic from "next/dynamic";
import { ComponentType } from "react";

/**
 * Lazy-loaded Chart.js components with loading states
 * These components are code-split to reduce initial bundle size
 */

// Loading skeleton for charts
export function ChartSkeleton() {
  return (
    <div className="w-full h-64 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading chart...</div>
    </div>
  );
}

// Loading skeleton for export operations
export function ExportSkeleton() {
  return (
    <span className="inline-flex items-center">
      <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Preparing...
    </span>
  );
}

/**
 * Lazy-loaded Bar chart component from react-chartjs-2
 * Only loads when needed, reducing initial bundle size
 */
export const LazyBarChart = dynamic(
  async () => {
    // Register Chart.js components when the module loads
    const chartjs = await import("chart.js");
    const { Chart: ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } = chartjs;
    ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
    
    const reactChartjs = await import("react-chartjs-2");
    return reactChartjs.Bar;
  },
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Charts are client-only
  }
);

/**
 * Lazy-loaded XLSX library for Excel export
 * Only loads when user clicks export button
 */
export async function loadXLSX() {
  const XLSX = await import("xlsx");
  return XLSX;
}

/**
 * Lazy-loaded jsPDF library for PDF export
 * Only loads when user clicks export button
 */
export async function loadJsPDF() {
  const mod: any = await import("jspdf");
  return mod.default ?? mod.jsPDF;
}

/**
 * Lazy-loaded XLSX utilities for parsing files
 * Used in import functionality
 */
export async function loadXLSXUtils() {
  const { read, utils } = await import("xlsx");
  return { read, utils };
}
