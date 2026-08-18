import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef as TanStackColumnDef,
  type RowData,
  type SortingState,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3 } from "@gojet/icons";
import { Checkbox, EmptyState, ErrorState, Skeleton } from "./index";
import { Popover } from "./overlays";

export type { ColumnDef } from "@tanstack/react-table";
export type DataTableDensity = "compact" | "default" | "relaxed";

export interface DataTableProps<TData extends RowData> {
  data: TData[];
  columns: TanStackColumnDef<TData, unknown>[];
  label: string;
  density?: DataTableDensity;
  loading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  getRowId?: (row: TData, index: number, parent?: import("@tanstack/react-table").Row<TData>) => string;
  toolbar?: (table: TanStackTable<TData>) => ReactNode;
}

export function ColumnManager<TData extends RowData>({ table }: { table: TanStackTable<TData> }) {
  const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  if (!columns.length) return null;
  return (
    <Popover trigger={<><Columns3 size={16} strokeWidth={1.75} />列</>} title="显示列" description="选择当前表格要显示的字段。">
      <div className="gj-column-manager">
        {columns.map((column) => (
          <Checkbox key={column.id} checked={column.getIsVisible()} onCheckedChange={(checked) => column.toggleVisibility(checked)} label={typeof column.columnDef.header === "string" ? column.columnDef.header : column.id} />
        ))}
      </div>
    </Popover>
  );
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ChevronUp size={14} strokeWidth={1.75} aria-hidden="true" />;
  if (direction === "desc") return <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />;
  return <ChevronsUpDown size={14} strokeWidth={1.75} aria-hidden="true" />;
}

export function DataTable<TData extends RowData>({ data, columns, label, density = "default", loading = false, error, emptyTitle = "暂无数据", emptyDescription = "当前条件下没有可显示的记录。", selectable = false, getRowId, toolbar }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), onSortingChange: setSorting, state: { sorting }, enableRowSelection: selectable, ...(getRowId ? { getRowId } : {}) });
  const visibleColumns = table.getVisibleLeafColumns().length + (selectable ? 1 : 0);

  return (
    <section className="gj-data-table-region" aria-label={label}>
      <div className="gj-data-table-toolbar"><div>{toolbar?.(table)}</div><ColumnManager table={table} /></div>
      <div className="gj-data-table-wrap" data-density={density}>
        <table className="gj-data-table">
          <caption className="sr-only">{label}</caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {selectable ? <th className="gj-data-table-select" scope="col"><Checkbox checked={table.getIsAllRowsSelected()} onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)} label={<span className="sr-only">选择全部行</span>} /></th> : null}
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return <th key={header.id} scope="col" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}>{header.isPlaceholder ? null : header.column.getCanSort() ? <button type="button" className="gj-data-table-sort" onClick={header.column.getToggleSortingHandler()}><span>{flexRender(header.column.columnDef.header, header.getContext())}</span><SortIndicator direction={sorted} /></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>;
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? Array.from({ length: 4 }, (_, rowIndex) => <tr key={`loading-${rowIndex}`} aria-hidden="true">{Array.from({ length: visibleColumns }, (_, cellIndex) => <td key={cellIndex}><Skeleton className="gj-data-table-skeleton" /></td>)}</tr>) : error ? <tr><td colSpan={visibleColumns}><ErrorState title="表格加载失败" description={error} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={visibleColumns}><EmptyState title={emptyTitle} description={emptyDescription} /></td></tr> : table.getRowModel().rows.map((row) => <tr key={row.id} data-selected={row.getIsSelected() || undefined}>{selectable ? <td className="gj-data-table-select"><Checkbox checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(checked)} label={<span className="sr-only">选择此行</span>} /></td> : null}{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
