"use client";

import { ModernTableProps } from "./types";
import TableLoading from "./TableLoading";
import EmptyTable from "./EmptyTable";
import DataTable from "./DataTable";
import VirtualizedDataTable from "./VirtualizedDataTable";

const VIRTUALIZATION_THRESHOLD = 50;

export default function ModernTable({
  columns,
  data,
  renderCell,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  virtualized = true,
  itemHeight = 80,
  storageKey,
}: ModernTableProps) {
  if (loading) {
    return <TableLoading columns={columns} />;
  }

  if (data.length === 0) {
    return <EmptyTable emptyMessage={emptyMessage} />;
  }

  // Use virtualization for large datasets (>50 items) if enabled
  const shouldVirtualize = virtualized && data.length > VIRTUALIZATION_THRESHOLD;

  if (shouldVirtualize) {
    return (
      <VirtualizedDataTable
        columns={columns}
        data={data}
        renderCell={renderCell}
        onRowClick={onRowClick}
        itemHeight={itemHeight}
        storageKey={storageKey}
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      renderCell={renderCell}
      onRowClick={onRowClick}
    />
  );
}

// Export types for external use
export * from "./types";