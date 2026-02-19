"use client";

import { ReactNode, useRef, useMemo } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';

interface Column {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sticky?: boolean;
}

interface VirtualModernTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, column: Column) => ReactNode;
  onRowClick?: (item: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  variant?: "default" | "compact" | "card" | "striped";
  sortable?: boolean;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  className?: string;
  threshold?: number; // Minimum items to enable virtualization (default: 50)
  estimateSize?: number; // Estimated row height in pixels
}

export default function VirtualModernTable({
  columns,
  data,
  renderCell,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  variant = "default",
  sortable = false,
  onSort,
  className = "",
  threshold = 50,
  estimateSize = 73, // Default row height
}: VirtualModernTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Only use virtualization if items exceed threshold
  const shouldVirtualize = data.length > threshold;

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const getVariantClasses = () => {
    switch (variant) {
      case "compact":
        return "text-xs";
      case "card":
        return "shadow-lg rounded-2xl border-0";
      case "striped":
        return "";
      default:
        return "";
    }
  };

  const getRowClasses = (index: number) => {
    const baseClasses = "transition-all duration-200 hover:bg-gray-50";
    const clickableClasses = onRowClick ? "cursor-pointer hover:shadow-sm" : "";
    
    switch (variant) {
      case "compact":
        return `${baseClasses} ${clickableClasses}`;
      case "card":
        return `${baseClasses} ${clickableClasses} hover:bg-blue-50/30`;
      case "striped":
        return `${baseClasses} ${clickableClasses} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`;
      default:
        return `${baseClasses} ${clickableClasses}`;
    }
  };

  if (loading) {
    return (
      <div className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden ${className}`}>
        <div className="p-6">
          <div className="space-y-3">
            {/* Header skeleton */}
            <div className="flex space-x-4 pb-4 border-b border-gray-100">
              {columns.map((col, j) => (
                <div key={j} className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: col.width || "auto", flex: col.width ? "none" : "1" }}></div>
              ))}
            </div>
            {/* Row skeletons */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4 py-2">
                {columns.map((col, j) => (
                  <div key={j} className="h-6 bg-gray-100 rounded animate-pulse" style={{ width: col.width || "auto", flex: col.width ? "none" : "1" }}></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-12 text-center ${className}`}>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Data Available</h3>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  // If below threshold, render normally without virtualization
  if (!shouldVirtualize) {
    return (
      <div className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden ${getVariantClasses()} ${className}`}>
        <div className="overflow-x-auto touch-pan-x overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full min-w-max">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`
                      px-6 py-4 text-sm font-semibold text-gray-700 select-none whitespace-nowrap
                      ${column.align === "center" ? "text-center" : ""}
                      ${column.align === "right" ? "text-right" : "text-left"}
                      ${column.sortable || sortable ? "cursor-pointer hover:bg-gray-200 hover:text-gray-900 transition-colors" : ""}
                      ${column.sticky ? "sticky left-0 bg-gray-50 z-10" : ""}
                    `}
                    style={{ width: column.width, minWidth: column.width }}
                  >
                    <span>{column.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y divide-gray-100 ${variant === "striped" ? "" : "bg-white"}`}>
              {data.map((item, index) => (
                <tr
                  key={index}
                  className={getRowClasses(index)}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        px-6 py-4 text-sm text-gray-900
                        ${column.align === "center" ? "text-center" : ""}
                        ${column.align === "right" ? "text-right" : "text-left"}
                        ${column.sticky ? "sticky left-0 bg-inherit z-10" : ""}
                        ${variant === "compact" ? "py-2" : "py-4"}
                      `}
                      style={{ width: column.width, minWidth: column.width }}
                    >
                      {renderCell(item, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Use virtualization for large lists
  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden ${getVariantClasses()} ${className}`}>
      <div 
        ref={parentRef}
        className="overflow-auto touch-pan-x overscroll-x-contain" 
        style={{ 
          height: '600px',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <table className="w-full min-w-max">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 sticky top-0 z-20">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-4 text-sm font-semibold text-gray-700 select-none whitespace-nowrap
                    ${column.align === "center" ? "text-center" : ""}
                    ${column.align === "right" ? "text-right" : "text-left"}
                    ${column.sortable || sortable ? "cursor-pointer hover:bg-gray-200 hover:text-gray-900 transition-colors" : ""}
                    ${column.sticky ? "sticky left-0 bg-gray-50 z-10" : ""}
                  `}
                  style={{ width: column.width, minWidth: column.width }}
                >
                  <span>{column.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`${variant === "striped" ? "" : "bg-white"}`}>
            <tr style={{ height: `${virtualizer.getTotalSize()}px` }}>
              <td colSpan={columns.length} style={{ padding: 0, border: 'none' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = data[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <table className="w-full min-w-max">
                          <tbody className="divide-y divide-gray-100">
                            <tr
                              className={getRowClasses(virtualRow.index)}
                              onClick={() => onRowClick?.(item)}
                            >
                              {columns.map((column) => (
                                <td
                                  key={column.key}
                                  className={`
                                    px-6 py-4 text-sm text-gray-900
                                    ${column.align === "center" ? "text-center" : ""}
                                    ${column.align === "right" ? "text-right" : "text-left"}
                                    ${column.sticky ? "sticky left-0 bg-inherit z-10" : ""}
                                    ${variant === "compact" ? "py-2" : "py-4"}
                                  `}
                                  style={{ width: column.width, minWidth: column.width }}
                                >
                                  {renderCell(item, column)}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Info footer showing virtualization status */}
      {shouldVirtualize && (
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Showing {data.length} items (virtual scrolling enabled)</span>
            <span>Scroll position maintained on updates</span>
          </div>
        </div>
      )}
    </div>
  );
}
