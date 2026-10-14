"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
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
import { Input } from "@/components/ui/input";

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
      render: (row: Entity) => (
        <div className="data-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelected(row);
              setForm(Object.fromEntries(cfg.fields.map((field) => [field.name, String(row[field.name] ?? "")])));
              setOpen(true);
            }}
          >
            Ubah
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setRemoving(row)}>
            Hapus
          </Button>
        </div>
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
    <section className="section page-top">
      <div className="section-head">
        <div>
          <h1 className="page-title">{cfg.title}</h1>
          <p>{cfg.description}</p>
        </div>
        <Button type="button" onClick={beginCreate}>
          <Plus size={18} /> Tambah
        </Button>
      </div>

      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <div className="dashboard-error" role="alert">
          {getApiErrorMessage(query.error)}{" "}
          <Button type="button" variant="link" size="sm" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={`Cari ${cfg.title.toLowerCase()}…`}
          emptyMessage={`Belum ada data ${cfg.title.toLowerCase()}.`}
          toolbarActions={
            <Button variant="outline" size="icon" type="button" aria-label="Muat ulang" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={18} className={query.isFetching ? "spin" : undefined} />
            </Button>
          }
        />
      )}
      {(create.isError || update.isError || remove.isError) && (
        <p className="form-error" role="alert">
          {getApiErrorMessage(create.error ?? update.error ?? remove.error)}
        </p>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={selected ? `Ubah ${cfg.title}` : `Tambah ${cfg.title}`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="master-form" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form id="master-form" className="master-form" onSubmit={save}>
          {cfg.fields.map((field) => (
            <label className="field" key={field.name}>
              <span>{field.label}</span>
              <Input name={field.name} type={field.type ?? "text"} required={field.required} value={form[field.name] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} />
            </label>
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
