"use client";

import { useMemo, useState, type ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  pageSize?: number;
  emptyMessage?: string;
};

/** Reusable client-side table; markup uses existing global Lemigas tokens/classes. */
export function DataTable<T>({ columns, rows, rowKey, pageSize = 10, emptyMessage = "Belum ada data." }: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => rows.slice(page * pageSize, (page + 1) * pageSize), [page, pageSize, rows]);

  return (
    <section className="data-table-wrap" aria-label="Data">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.className} key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.length ? (
            pageRows.map((row, index) => (
              <tr key={rowKey(row, page * pageSize + index)}>
                {columns.map((column) => (
                  <td className={column.className} key={column.key}>
                    {column.render(row, page * pageSize + index)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="data-table-empty">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="data-table-footer">
        <span>{rows.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} dari ${rows.length}` : "0 data"}</span>
        <div className="data-table-pagination">
          <button className="btn btn-dark" type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)} aria-label="Halaman sebelumnya">
            Sebelumnya
          </button>
          <span>
            Halaman {page + 1} dari {pageCount}
          </span>
          <button className="btn btn-dark" type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Halaman berikutnya">
            Berikutnya
          </button>
        </div>
      </div>
    </section>
  );
}
