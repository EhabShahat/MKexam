import { ReactNode } from "react";

export interface Column {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface ModernTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, column: Column) => ReactNode;
  onRowClick?: (item: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  /** Enable virtualization for large datasets (default: true) */
  virtualized?: boolean;
  /** Height of each row in pixels for virtualization (default: 80) */
  itemHeight?: number;
  /** Storage key for scroll position restoration */
  storageKey?: string;
}