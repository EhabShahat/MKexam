/**
 * VirtualizedDataTable Component
 * 
 * A virtualized version of DataTable that renders only visible rows
 * for optimal performance with large datasets (100+ items).
 */

import React from "react";
import { VirtualizedList } from "@/components/VirtualizedList/index";
import { Column } from "./types";

interface VirtualizedDataTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, column: Column) => React.ReactNode;
  onRowClick?: (item: any) => void;
  itemHeight?: number;
  storageKey?: string;
}

export default function VirtualizedDataTable({
  columns,
  data,
  renderCell,
  onRowClick,
  itemHeight = 80,
  storageKey,
}: VirtualizedDataTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-4 text-sm font-semibold text-gray-900
                    ${column.align === "center" ? "text-center" : ""}
                    ${column.align === "right" ? "text-right" : "text-left"}
                  `}
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>

        {/* Virtualized tbody */}
        <div style={{ height: '600px', overflow: 'auto' }}>
          <VirtualizedList
            items={data}
            itemHeight={itemHeight}
            renderItem={(item, index) => (
              <table className="w-full">
                <tbody>
                  <tr
                    className={`
                      hover:bg-gray-50 transition-colors duration-150 border-b border-gray-200
                      ${onRowClick ? "cursor-pointer" : ""}
                    `}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`
                          px-6 py-4 text-sm text-gray-900
                          ${column.align === "center" ? "text-center" : ""}
                          ${column.align === "right" ? "text-right" : "text-left"}
                        `}
                        style={{ width: column.width }}
                      >
                        {renderCell(item, column)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
            overscan={5}
            scrollRestoration={!!storageKey}
            storageKey={storageKey}
          />
        </div>
      </div>
    </div>
  );
}
