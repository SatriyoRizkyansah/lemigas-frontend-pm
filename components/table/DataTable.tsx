"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ListFilter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  className?: string;
  filterable?: boolean;
};

type FilterOption = { label: string; value: string };
type TableFilter<T> = { field: keyof T | string; label: string; options: FilterOption[] };
type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  pageSize?: number;
  rowsPerPageOptions?: number[];
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  hideSearch?: boolean;
  hidePagination?: boolean;
  filterField?: keyof T | string;
  filterOptions?: FilterOption[];
  defaultFilterValue?: string;
  filterLabel?: string;
  filters?: TableFilter<T>[];
  toolbarActions?: ReactNode;
};

const ALL_FILTER_VALUE = "__all";

/** Reusable client-side table with legacy FE search, filter and pagination layout. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize: initialPageSize = 10,
  rowsPerPageOptions = [5, 10, 25],
  emptyMessage = "Belum ada data.",
  searchPlaceholder = "Cari data…",
  searchValue,
  onSearchChange,
  hideSearch = false,
  hidePagination = false,
  filterField,
  filterOptions = [],
  defaultFilterValue = ALL_FILTER_VALUE,
  filterLabel = "Status",
  filters = [],
  toolbarActions,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialPageSize);
  const [localSearch, setLocalSearch] = useState("");
  const legacyFilter: TableFilter<T>[] = filterField && filterOptions.length ? [{ field: filterField, label: filterLabel, options: filterOptions }] : [];
  const activeFilters = filters.length ? filters : legacyFilter;
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => Object.fromEntries(activeFilters.map((filter) => [String(filter.field), filter.field === filterField ? defaultFilterValue : ALL_FILTER_VALUE])));
  const activeSearch = searchValue ?? localSearch;
  const showFilter = activeFilters.length > 0;
  const normalizedOptions = (options: FilterOption[]) => (options.some((option) => option.value === ALL_FILTER_VALUE) ? options : [{ label: "Semua", value: ALL_FILTER_VALUE }, ...options]);
  const hasActiveFilters = activeFilters.some((filter) => (filterValues[String(filter.field)] ?? ALL_FILTER_VALUE) !== ALL_FILTER_VALUE);

  useEffect(() => setPage(0), [activeSearch, filterValues, rowsPerPage]);

  const filteredRows = useMemo(() => {
    const query = activeSearch.trim().toLocaleLowerCase("id-ID");
    return rows.filter((row) => {
      if (
        activeFilters.some((filter) => {
          const selected = filterValues[String(filter.field)] ?? ALL_FILTER_VALUE;
          return selected !== ALL_FILTER_VALUE && String(row[filter.field as keyof T] ?? "") !== selected;
        })
      )
        return false;
      if (!query) return true;
      return columns
        .filter((column) => column.filterable !== false)
        .some((column) =>
          String(row[column.key as keyof T] ?? "")
            .toLocaleLowerCase("id-ID")
            .includes(query),
        );
    });
  }, [activeSearch, activeFilters, columns, filterValues, rows]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(() => filteredRows.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage), [filteredRows, safePage, rowsPerPage]);
  const startItem = filteredRows.length ? safePage * rowsPerPage + 1 : 0;
  const endItem = Math.min((safePage + 1) * rowsPerPage, filteredRows.length);

  function updateSearch(value: string) {
    setLocalSearch(value);
    onSearchChange?.(value);
    setPage(0);
  }
  function resetFilters() {
    setFilterValues(Object.fromEntries(activeFilters.map((filter) => [String(filter.field), ALL_FILTER_VALUE])));
    updateSearch("");
  }

  return (
    <section className="data-table-shell" aria-label="Data">
      {!hideSearch && (
        <div className="data-table-toolbar">
          <label className="data-table-search">
            <Search size={18} aria-hidden="true" />
            <Input type="search" placeholder={searchPlaceholder} value={activeSearch} onChange={(event) => updateSearch(event.target.value)} aria-label="Cari dalam tabel" />
          </label>
          {toolbarActions}
        </div>
      )}
      <div className="data-table-wrap">
        {showFilter && (
          <div className="data-table-filterbar">
            <div className="data-table-filter-title">
              <ListFilter size={17} aria-hidden="true" />
              <span>Filter</span>
              {hasActiveFilters && <span className="filter-count">{activeFilters.filter((filter) => (filterValues[String(filter.field)] ?? ALL_FILTER_VALUE) !== ALL_FILTER_VALUE).length}</span>}
            </div>
            <div className="data-table-filter-controls">
              {activeFilters.map((filter) => {
                const filterKey = String(filter.field);
                return (
                  <Select
                    key={filterKey}
                    value={filterValues[filterKey] ?? ALL_FILTER_VALUE}
                    onValueChange={(value) => {
                      setFilterValues((current) => ({ ...current, [filterKey]: value ?? ALL_FILTER_VALUE }));
                      setPage(0);
                    }}
                  >
                    <SelectTrigger size="sm" aria-label={`Filter ${filter.label.toLocaleLowerCase("id-ID")}`} className="min-w-35 bg-background">
                      <SelectValue placeholder={filter.label} />
                    </SelectTrigger>
                    <SelectContent>
                      {normalizedOptions(filter.options).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" type="button" onClick={resetFilters}>
                  <RotateCcw size={14} aria-hidden="true" /> Reset
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="data-table-scroll">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead className={column.className} key={column.key} scope="col">
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? (
                pageRows.map((row, index) => (
                  <TableRow key={rowKey(row, safePage * rowsPerPage + index)}>
                    {columns.map((column) => (
                      <TableCell className={column.className} key={column.key} data-label={column.header}>
                        {column.render(row, safePage * rowsPerPage + index)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="data-table-empty">
                    {activeSearch || activeFilters ? "Tidak ada hasil yang cocok." : emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {!hidePagination && (
          <div className="data-table-footer">
            <div className="data-table-page-size">
              <span>Baris per halaman</span>
              <Select value={String(rowsPerPage)} onValueChange={(value) => value && setRowsPerPage(Number(value))}>
                <SelectTrigger size="sm" aria-label="Jumlah baris per halaman" className="min-w-16 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...rowsPerPageOptions, rowsPerPage])]
                    .sort((a, b) => a - b)
                    .map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <span className="data-table-count">
              {startItem}–{endItem} dari {filteredRows.length}
            </span>
            <div className="data-table-pagination">
              <Button variant="outline" size="icon-sm" type="button" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Halaman sebelumnya" title="Halaman sebelumnya">
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <span aria-live="polite">
                {safePage + 1} / {pageCount}
              </span>
              <Button variant="outline" size="icon-sm" type="button" disabled={safePage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label="Halaman berikutnya" title="Halaman berikutnya">
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
