"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { DataTable } from "@/components/table/DataTable";
import { Modal } from "@/components/modal/Modal";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { LoadingState } from "@/components/loading/LoadingState";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Entity = { id: string; nama: string; [key: string]: any };
type Field = { name: string; label: string; type?: string; required?: boolean; options?: Array<{ label: string; value: string }> };
type ListPayload = { items: Entity[]; total: number; totalPages: number };
type Config = { title: string; description: string; tag: string; method: string; createMethod: string; updateMethod: string; deleteMethod: string; fields: Field[] };

const config: Record<string, Config> = {
  vendor: {
    title: "Vendor",
    description: "Kelola data penyedia pengadaan.",
    tag: "vendor",
    method: "vendorGetControllerFindAll",
    createMethod: "vendorPostControllerCreate",
    updateMethod: "vendorPutControllerUpdate",
    deleteMethod: "vendorDeleteControllerRemove",
    fields: [
      { name: "nama", label: "Nama vendor", required: true },
      { name: "alamat", label: "Alamat" },
      { name: "telepon", label: "Telepon" },
      { name: "email", label: "Email", type: "email" },
      { name: "npwp", label: "NPWP" },
      { name: "contactPerson", label: "Contact person" },
      {
        name: "status",
        label: "Status",
        options: [
          { label: "Aktif", value: "aktif" },
          { label: "Nonaktif", value: "nonaktif" },
        ],
      },
    ],
  },
  kategori: {
    title: "Kategori",
    description: "Kelola kategori pengadaan.",
    tag: "kategori",
    method: "kategoriGetControllerFindAll",
    createMethod: "kategoriPostControllerCreate",
    updateMethod: "kategoriPutControllerUpdate",
    deleteMethod: "kategoriDeleteControllerRemove",
    fields: [
      { name: "kode", label: "Kode", required: true },
      { name: "nama", label: "Nama kategori", required: true },
    ],
  },
  barang: {
    title: "Barang",
    description: "Kelola barang dan spesifikasinya.",
    tag: "barang",
    method: "barangGetControllerFindAll",
    createMethod: "barangPostControllerCreate",
    updateMethod: "barangPutControllerUpdate",
    deleteMethod: "barangDeleteControllerRemove",
    fields: [
      { name: "nama", label: "Nama barang", required: true },
      { name: "spesifikasi", label: "Spesifikasi" },
      { name: "satuan", label: "Satuan", required: true },
      { name: "kategoriId", label: "ID kategori", required: true },
      { name: "hargaEstimasi", label: "Harga estimasi", type: "number" },
    ],
  },
};

function unwrapList(value: unknown): ListPayload {
  let payload: any = value;
  let pagination: any;
  for (let i = 0; i < 3 && payload && typeof payload === "object"; i += 1) {
    pagination ??= payload.pagination;
    if (!("data" in payload)) break;
    payload = payload.data;
  }
  const list = Array.isArray(payload) ? payload : (payload?.items ?? payload?.data ?? []);
  const items = Array.isArray(list) ? (list as Entity[]) : [];
  return {
    items,
    total: Number(pagination?.total_datas ?? items.length),
    totalPages: Number(pagination?.total_pages ?? (items.length ? 1 : 0)),
  };
}

export default function MasterDataPage({ kind, formColumns = 1, modalSize = "md" }: { kind: keyof typeof config; formColumns?: 1 | 2; modalSize?: "sm" | "md" }) {
  const cfg = config[kind];
  const currentUser = useCurrentUser();
  const role = currentUser.data?.role.toLowerCase();
  const canEdit = kind === "kategori" ? role === "admin" : role === "admin" || role === "operator";
  const canDelete = role === "admin";
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [removing, setRemoving] = useState<Entity | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [createVendorAccount, setCreateVendorAccount] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<Record<string, string>>({ status: "__all", kategoriId: "__all" });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch, filters, limit]);

  const params = useMemo(
    () => ({
      query: debouncedSearch || undefined,
      limit,
      page,
      ...(kind === "vendor" && filters.status !== "__all" ? { status: filters.status } : {}),
      ...(kind === "barang" && filters.kategoriId !== "__all" ? { kategoriId: filters.kategoriId } : {}),
    }),
    [kind, debouncedSearch, limit, page, filters],
  );
  const query = use_query<ListPayload, Error, typeof params>({
    tag: cfg.tag,
    method: cfg.method,
    params,
    queryFn: async (request) => {
      setBrowserToken();
      const group = cfg.tag === "kategori" ? browserApi.kategoriPengadaan : browserApi[cfg.tag as "vendor" | "barang"];
      const fn = (group as any)[cfg.method];
      return unwrapList(await apiData(fn(request, { format: "json" }) as Promise<{ data: unknown }>));
    },
  });
  const categoryQuery = use_query<ListPayload, Error, { limit: number; page: number }>({
    tag: "kategori",
    method: "kategoriGetControllerFindAll",
    params: { limit: 100, page: 1 },
    enabled: kind === "barang",
    queryFn: async (request) => {
      setBrowserToken();
      const firstPage = unwrapList(await apiData(browserApi.kategoriPengadaan.kategoriGetControllerFindAll(request, { format: "json" }) as Promise<{ data: unknown }>));
      if (firstPage.totalPages <= 1) return firstPage;
      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) => apiData(browserApi.kategoriPengadaan.kategoriGetControllerFindAll({ ...request, page: index + 2 }, { format: "json" }) as Promise<{ data: unknown }>)),
      );
      return { ...firstPage, items: [...firstPage.items, ...remainingPages.flatMap((pageData) => unwrapList(pageData).items)] };
    },
  });
  const invalidate = [apiQueryKeys.resource(cfg.tag)];
  const create = use_mutation<unknown, Error, Record<string, unknown>>({
    tag: cfg.tag,
    method: cfg.createMethod,
    invalidateKeys: invalidate,
    mutationFn: async (body) => {
      setBrowserToken();
      const group = cfg.tag === "kategori" ? browserApi.kategoriPengadaan : browserApi[cfg.tag as "vendor" | "barang"];
      return apiData((group as any)[cfg.createMethod](body, { format: "json" }) as Promise<{ data: unknown }>);
    },
    onSuccess: () => setOpen(false),
  });
  const update = use_mutation<unknown, Error, { id: string; body: Record<string, unknown> }>({
    tag: cfg.tag,
    method: cfg.updateMethod,
    invalidateKeys: invalidate,
    mutationFn: async ({ id, body }) => {
      setBrowserToken();
      const group = cfg.tag === "kategori" ? browserApi.kategoriPengadaan : browserApi[cfg.tag as "vendor" | "barang"];
      return apiData((group as any)[cfg.updateMethod](id, body, { format: "json" }) as Promise<{ data: unknown }>);
    },
    onSuccess: () => setOpen(false),
  });
  const remove = use_mutation<unknown, Error, string>({
    tag: cfg.tag,
    method: cfg.deleteMethod,
    invalidateKeys: invalidate,
    mutationFn: async (id) => {
      setBrowserToken();
      const group = cfg.tag === "kategori" ? browserApi.kategoriPengadaan : browserApi[cfg.tag as "vendor" | "barang"];
      return apiData((group as any)[cfg.deleteMethod](id, { format: "json" }) as Promise<{ data: unknown }>);
    },
    onSuccess: () => setRemoving(null),
  });
  const rows = query.data?.items ?? [];
  const categories = categoryQuery.data?.items ?? [];
  const columns = [
    ...cfg.fields.slice(0, kind === "vendor" ? cfg.fields.length : 4).map((field) => ({
      key: field.name,
      header: field.label,
      render: (row: Entity) => (field.name === "kategoriId" ? String(row.kategori?.nama ?? "—") : field.name === "status" ? (row.status === "aktif" ? "Aktif" : "Nonaktif") : String(row[field.name] ?? "—")),
    })),
    ...(kind === "kategori" ? [{ key: "jumlahBarang", header: "Jumlah barang", render: (row: Entity) => String(row._count?.barang ?? 0) }] : []),
    {
      key: "actions",
      header: "Aksi",
      className: "w-24 whitespace-nowrap",
      render: (row: Entity) => (
        <TooltipProvider>
          <div className="flex w-max flex-nowrap items-center gap-2">
            {canEdit && (
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-label={`Ubah ${row.nama}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => {
                    setSelected(row);
                    setCreateVendorAccount(false);
                    setForm(Object.fromEntries(cfg.fields.map((field) => [field.name, String(row[field.name] ?? "")])));
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Ubah</TooltipContent>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-label={`Hapus ${row.nama}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                  onClick={() => setRemoving(row)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Hapus</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      ),
    },
  ];
  function beginCreate() {
    if (!canEdit) return;
    setSelected(null);
    setCreateVendorAccount(false);
    setForm({});
    setOpen(true);
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || cfg.fields.some((field) => field.required && !form[field.name]?.trim())) return;
    if (kind === "vendor" && createVendorAccount && (!form.akunNama?.trim() || !form.akunEmail?.trim() || (form.akunPassword?.length ?? 0) < 6)) return;
    const body = Object.fromEntries(cfg.fields.filter((field) => form[field.name] !== "").map((field) => [field.name, field.type === "number" ? Number(form[field.name]) : form[field.name]]));
    if (!selected && kind === "vendor" && createVendorAccount) {
      body.akunNama = form.akunNama.trim();
      body.akunEmail = form.akunEmail.trim();
      body.akunPassword = form.akunPassword;
    }
    if (selected) update.mutate({ id: selected.id, body });
    else create.mutate(body);
  }
  const busy = create.isPending || update.isPending;
  return (
    <section className="space-y-5 py-1">
      <PageHeader
        title={cfg.title}
        description={cfg.description}
        actions={
          canEdit ? (
            <Button type="button" onClick={beginCreate} className="bg-foreground text-background hover:bg-foreground/90">
              <Plus size={18} /> Tambah
            </Button>
          ) : null
        }
      />

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
          rows={rows}
          rowKey={(row) => row.id}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={`Cari ${cfg.title.toLowerCase()}…`}
          emptyMessage={`Belum ada data ${cfg.title.toLowerCase()}.`}
          remoteSearch
          filters={
            kind === "vendor"
              ? [
                  {
                    field: "status",
                    label: "Status vendor",
                    options: [
                      { label: "Aktif", value: "aktif" },
                      { label: "Nonaktif", value: "nonaktif" },
                    ],
                  },
                ]
              : kind === "barang"
                ? [{ field: "kategoriId", label: "Kategori", options: categories.map((category) => ({ label: `${category.kode} — ${category.nama}`, value: category.id })) }]
                : []
          }
          filterValues={kind === "vendor" || kind === "barang" ? filters : undefined}
          onFilterChange={kind === "vendor" || kind === "barang" ? (field, value) => setFilters((current) => ({ ...current, [field]: value })) : undefined}
          pagination={{
            page,
            pageSize: limit,
            total: query.data?.total ?? 0,
            totalPages: query.data?.totalPages ?? 0,
            onPageChange: setPage,
            onPageSizeChange: setLimit,
          }}
        />
      )}
      {create.isError || update.isError || remove.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(create.error ?? update.error ?? remove.error)}</AlertDescription>
        </Alert>
      ) : null}
      <Modal
        open={open && canEdit}
        onClose={() => setOpen(false)}
        title={selected ? `Ubah ${cfg.title}` : `Tambah ${cfg.title}`}
        size={modalSize}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              form="master-form"
              disabled={busy || (kind === "vendor" && createVendorAccount && (!form.akunNama?.trim() || !form.akunEmail?.trim() || (form.akunPassword?.length ?? 0) < 6))}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form id="master-form" className={`grid gap-4 ${formColumns === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`} onSubmit={save}>
          {cfg.fields.map((field, index) => (
            <div className={`grid gap-2 ${formColumns === 2 && cfg.fields.length % 2 === 1 && index === cfg.fields.length - 1 ? "sm:col-span-2" : ""}`} key={field.name}>
              <Label htmlFor={`master-${field.name}`}>{field.label}</Label>
              {field.name === "kategoriId" ? (
                <Select value={form.kategoriId ?? ""} onValueChange={(value) => value && setForm((current) => ({ ...current, kategoriId: value }))}>
                  <SelectTrigger id="master-kategoriId" aria-label="Kategori barang">
                    <SelectValue placeholder={categoryQuery.isPending ? "Memuat kategori…" : "Pilih kategori"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.kode} — {category.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.options ? (
                <Select value={form[field.name] ?? field.options[0]?.value ?? ""} onValueChange={(value) => value && setForm((current) => ({ ...current, [field.name]: value }))}>
                  <SelectTrigger id={`master-${field.name}`} aria-label={field.label}>
                    <SelectValue placeholder={`Pilih ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`master-${field.name}`}
                  name={field.name}
                  type={field.type ?? "text"}
                  required={field.required}
                  value={form[field.name] ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              )}
            </div>
          ))}
          {kind === "vendor" && !selected ? (
            <div className="grid gap-3 rounded-md border p-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={createVendorAccount} onChange={(event) => setCreateVendorAccount(event.target.checked)} />
                Buat akun login vendor juga
              </label>
              {createVendorAccount ? (
                <div className="grid gap-4 border-t pt-3">
                  {[
                    { name: "akunNama", label: "Nama pengguna", type: "text" },
                    { name: "akunEmail", label: "Email login", type: "email" },
                    { name: "akunPassword", label: "Password login (minimal 6 karakter)", type: "password" },
                  ].map((field) => (
                    <div className="grid gap-2" key={field.name}>
                      <Label htmlFor={`master-${field.name}`}>{field.label}</Label>
                      <Input
                        id={`master-${field.name}`}
                        type={field.type}
                        required
                        value={form[field.name] ?? ""}
                        minLength={field.name === "akunPassword" ? 6 : undefined}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Akun dibuat dengan role Vendor dan langsung ditautkan ke vendor ini.</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(removing) && canDelete}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title={`Hapus ${cfg.title.toLowerCase()}?`}
        message={`Data “${removing?.nama ?? ""}” akan dihapus.`}
        busy={remove.isPending}
      />
    </section>
  );
}
