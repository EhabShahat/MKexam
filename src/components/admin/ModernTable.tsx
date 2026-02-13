"use client";

import { ReactNode, useState } from "react";

interface Column {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sticky?: boolean;
}

interface ModernTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, column: Column) => ReactNode;
  onRowClick?: (item: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  variant?: "default" | "compact" | "card" | "striped";
  selectable?: boolean;
  onSelectionChange?: (selectedItems: any[]) => void;
  sortable?: boolean;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  className?: string;
}

export default function ModernTable({
  columns,
  data,
  renderCell,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  variant = "default",
  selectable = false,
  onSelectionChange,
  sortable = false,
  onSort,
  className = ""
}: ModernTableProps) {
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (!sortable) return;
    
    const newDirection = sortKey === key && sortDirection === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDirection(newDirection);
    onSort?.(key, newDirection);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection = checked ? [...data] : [];
    setSelectedItems(newSelection);
    onSelectionChange?.(newSelection);
  };

  const handleSelectItem = (item: any, checked: boolean) => {
    const newSelection = checked 
      ? [...selectedItems, item]
      : selectedItems.filter(selected => selected !== item);
    setSelectedItems(newSelection);
    onSelectionChange?.(newSelection);
  };

  const isSelected = (item: any) => selectedItems.includes(item);
  const isAllSelected = data.length > 0 && selectedItems.length === data.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < data.length;

  // Variant-specific styling
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
              {selectable && <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>}
              {columns.map((col, j) => (
                <div key={j} className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: col.width || "auto", flex: col.width ? "none" : "1" }}></div>
              ))}
            </div>
            {/* Row skeletons */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4 py-2">
                {selectable && <div className="w-4 h-4 bg-gray-100 rounded animate-pulse"></div>}
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

  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden ${getVariantClasses()} ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <tr>
              {selectable && (
                <th className="px-4 py-4 w-12">
                  <label className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                  </label>
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-4 text-sm font-semibold text-gray-700 select-none
                    ${column.align === "center" ? "text-center" : ""}
                    ${column.align === "right" ? "text-right" : "text-left"}
                    ${column.sortable || sortable ? "cursor-pointer hover:bg-gray-200 hover:text-gray-900 transition-colors" : ""}
                    ${column.sticky ? "sticky left-0 bg-gray-50 z-10" : ""}
                  `}
                  style={{ width: column.width, minWidth: column.width }}
                  onClick={() => (column.sortable || sortable) && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {(column.sortable || sortable) && (
                      <div className="flex flex-col">
                        <svg 
                          className={`w-3 h-3 ${sortKey === column.key && sortDirection === "asc" ? "text-blue-600" : "text-gray-400"}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        <svg 
                          className={`w-3 h-3 -mt-1 ${sortKey === column.key && sortDirection === "desc" ? "text-blue-600" : "text-gray-400"}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
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
                {selectable && (
                  <td className="px-4 py-4 w-12">
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected(item)}
                        onChange={(e) => handleSelectItem(item, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </label>
                  </td>
                )}
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
      
      {/* Selection summary */}
      {selectable && selectedItems.length > 0 && (
        <div className="bg-blue-50 border-t border-blue-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => handleSelectAll(false)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}