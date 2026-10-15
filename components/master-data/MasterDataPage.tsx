"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
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
import { PageHeader } from "@/components/common/PageHeader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Entity = { id: string; nama: string; [key: string]: unknown };
type Field = { name: string; label: string; type?: string; required?: boolean };
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

function unwrapList(value: unknown): Entity[] {
  let payload = value as any;
  for (let i = 0; i < 3 && payload && typeof payload === "object" && "data" in payload; i += 1) payload = payload.data;
  const list = Array.isArray(payload) ? payload : (payload?.items ?? payload?.data ?? []);
  return Array.isArray(list) ? list : [];
}

export default function MasterDataPage({ kind }: { kind: keyof typeof config }) {
  const cfg = config[kind];
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [removing, setRemoving] = useState<Entity | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const params = useMemo(() => ({ query: search || undefined, limit: 100, page: 1 }), [search]);
  const query = use_query<Entity[], Error, typeof params>({
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
  const rows = query.data ?? [];
  const columns = [
    ...cfg.fields.slice(0, 4).map((field) => ({ key: field.name, header: field.label, render: (row: Entity) => String(row[field.name] ?? "—") })),
    {
      key: "actions",
      header: "Aksi",
      className: "w-24 whitespace-nowrap",
      render: (row: Entity) => (
        <TooltipProvider>
          <div className="flex w-max flex-nowrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                type="button"
                aria-label={`Ubah ${row.nama}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={() => {
                  setSelected(row);
                  setForm(Object.fromEntries(cfg.fields.map((field) => [field.name, String(row[field.name] ?? "")])));
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Ubah</TooltipContent>
            </Tooltip>
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
          </div>
        </TooltipProvider>
      ),
    },
  ];
  function beginCreate() {
    setSelected(null);
    setForm({});
    setOpen(true);
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    const body = Object.fromEntries(cfg.fields.filter((field) => form[field.name] !== "").map((field) => [field.name, field.type === "number" ? Number(form[field.name]) : form[field.name]]));
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
          <Button type="button" onClick={beginCreate} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus size={18} /> Tambah
          </Button>
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
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} searchValue={search} onSearchChange={setSearch} searchPlaceholder={`Cari ${cfg.title.toLowerCase()}…`} emptyMessage={`Belum ada data ${cfg.title.toLowerCase()}.`} />
      )}
      {create.isError || update.isError || remove.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(create.error ?? update.error ?? remove.error)}</AlertDescription>
        </Alert>
      ) : null}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={selected ? `Ubah ${cfg.title}` : `Tambah ${cfg.title}`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="master-form" disabled={busy} className="bg-foreground text-background hover:bg-foreground/90">
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form id="master-form" className="grid gap-4" onSubmit={save}>
          {cfg.fields.map((field) => (
            <div className="grid gap-2" key={field.name}>
              <Label htmlFor={`master-${field.name}`}>{field.label}</Label>
              <Input
                id={`master-${field.name}`}
                name={field.name}
                type={field.type ?? "text"}
                required={field.required}
                value={form[field.name] ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
              />
            </div>
          ))}
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title={`Hapus ${cfg.title.toLowerCase()}?`}
        message={`Data “${removing?.nama ?? ""}” akan dihapus.`}
        busy={remove.isPending}
      />
    </section>
  );
}
