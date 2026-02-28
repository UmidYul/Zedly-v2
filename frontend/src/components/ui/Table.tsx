import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../../lib/cn";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

type SortDirection = "asc" | "desc";

export interface TableColumn<T> {
  id: string;
  header: string;
  sortable?: boolean;
  accessor?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  enableSelection?: boolean;
  selectedRowKeys?: string[];
  onSelectedRowKeysChange?: (keys: string[]) => void;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  pageSize = 10,
  emptyTitle = "Нет данных",
  emptyDescription,
  enableSelection = false,
  selectedRowKeys,
  onSelectedRowKeysChange
}: TableProps<T>) {
  const [sortColumnId, setSortColumnId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    if (!sortColumnId) {
      return rows;
    }
    const column = columns.find((item) => item.id === sortColumnId);
    const accessor = column?.accessor;
    if (!accessor) {
      return rows;
    }
    return [...rows].sort((left, right) => {
      const leftValue = accessor(left);
      const rightValue = accessor(right);
      if (leftValue === rightValue) {
        return 0;
      }
      if (sortDirection === "asc") {
        return leftValue > rightValue ? 1 : -1;
      }
      return leftValue < rightValue ? 1 : -1;
    });
  }, [columns, rows, sortColumnId, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedRows = sortedRows.slice(start, start + pageSize);

  const selectedSet = useMemo(() => new Set(selectedRowKeys || []), [selectedRowKeys]);
  const currentPageKeys = pagedRows.map((row) => rowKey(row));
  const allCurrentSelected = currentPageKeys.length > 0 && currentPageKeys.every((key) => selectedSet.has(key));

  function toggleSort(columnId: string) {
    if (sortColumnId === columnId) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumnId(columnId);
    setSortDirection("asc");
  }

  function onToggleSelectAll(checked: boolean) {
    if (!onSelectedRowKeysChange) {
      return;
    }
    if (checked) {
      const merged = Array.from(new Set([...(selectedRowKeys || []), ...currentPageKeys]));
      onSelectedRowKeysChange(merged);
      return;
    }
    const next = (selectedRowKeys || []).filter((key) => !currentPageKeys.includes(key));
    onSelectedRowKeysChange(next);
  }

  function onToggleRow(key: string, checked: boolean) {
    if (!onSelectedRowKeysChange) {
      return;
    }
    if (checked) {
      onSelectedRowKeysChange([...(selectedRowKeys || []), key]);
      return;
    }
    onSelectedRowKeysChange((selectedRowKeys || []).filter((id) => id !== key));
  }

  if (!loading && rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {enableSelection ? (
              <th className="ui-table-checkbox">
                <input
                  type="checkbox"
                  checked={allCurrentSelected}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.id} className={column.className}>
                {column.sortable ? (
                  <button type="button" className="ui-table-sort" onClick={() => toggleSort(column.id)}>
                    <span>{column.header}</span>
                    {sortColumnId === column.id ? (
                      sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <span className="ui-table-sort-placeholder">↑↓</span>
                    )}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: Math.min(5, pageSize) }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  {enableSelection ? (
                    <td>
                      <Skeleton variant="text" />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={`${column.id}-${index}`}>
                      <Skeleton variant="text" />
                    </td>
                  ))}
                </tr>
              ))
            : pagedRows.map((row) => {
                const key = rowKey(row);
                return (
                  <tr key={key}>
                    {enableSelection ? (
                      <td className="ui-table-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(key)}
                          onChange={(event) => onToggleRow(key, event.target.checked)}
                          aria-label={`Select row ${key}`}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={`${key}-${column.id}`} className={cn(column.className)}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>

      <footer className="ui-table-pagination">
        <span>
          {rows.length === 0 ? 0 : start + 1}-{Math.min(start + pageSize, rows.length)} из {rows.length}
        </span>
        <div className="ui-table-pagination-actions">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1}>
            Назад
          </button>
          <span>
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
          >
            Вперёд
          </button>
        </div>
      </footer>
    </div>
  );
}
