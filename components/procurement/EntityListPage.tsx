"use client";

import { useMemo, useState, type ReactNode } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/PageHeader";

type Row = { id: string; [key: string]: any };
type Column = { key: string; header: string; render: (row: Row) => ReactNode };
type Filter = { field: string; label: string; options: { label: string; value: string }[] };
type Props = {
  title: string;
  description: string;
  tag: string;
  method: string;
  queryApi: (params: { query?: string; page: number; limit: number }) => Promise<unknown>;
  columns: Column[];
  filters?: Filter[];
  actions?: ReactNode;
  detailHref?: (row: Row) => string;
};
function unwrap(value: unknown): Row[] {
  let item = value as any;
  for (let i = 0; i < 3 && item && typeof item === "object" && "data" in item; i += 1) item = item.data;
  const rows = Array.isArray(item) ? item : (item?.items ?? item?.data ?? []);
  return Array.isArray(rows) ? rows : [];
}
export { unwrap as unwrapEntityList };

export default function EntityListPage({ title, description, tag, method, queryApi, columns, filters, actions }: Props) {
  const [search, setSearch] = useState("");
  const params = useMemo(() => ({ query: search || undefined, page: 1, limit: 100 }), [search]);
  const query = use_query<Row[], Error, typeof params>({
    tag,
    method,
    params,
    queryFn: async (request) => {
      setBrowserToken();
      return unwrap(await queryApi(request));
    },
  });
  return (
    <section className="space-y-5 py-1">
      <PageHeader title={title} description={description} actions={actions} />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {getApiErrorMessage(query.error)}{" "}
            <Button type="button" variant="link" size="sm" onClick={() => void query.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          rows={query.data ?? []}
          rowKey={(row) => row.id}
          filters={filters}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={`Cari ${title.toLowerCase()}…`}
          emptyMessage={`Belum ada ${title.toLowerCase()}.`}
        />
      )}
    </section>
  );
}
export function entityText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return String((value as any).nama ?? (value as any).judul ?? (value as any).email ?? "—");
  return String(value).replaceAll("_", " ");
}
export function dateText(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}
export function apiRequest(group: any, method: string, params: any) {
  return apiData(group[method](params, { format: "json" }) as Promise<{ data: unknown }>);
}
