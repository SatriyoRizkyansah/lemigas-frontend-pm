export const PROCUREMENT_METHODS = {
  pengadaan_langsung: {
    label: "Pembelian Langsung",
    enabled: true,
    description: "Pemilihan kompetitif melalui RFQ, evaluasi, negosiasi, dan memorandum.",
  },
  penunjukan_langsung: {
    label: "Penunjukan Langsung",
    enabled: true,
    description: "Satu penyedia dengan justifikasi, verifikasi, negosiasi, dan memorandum.",
  },
  tender: { label: "Tender", enabled: false },
  e_procurement: { label: "E-Procurement", enabled: false },
} as const;

export type ProcurementMethod = keyof typeof PROCUREMENT_METHODS;

export const ACTIVE_PROCUREMENT_METHODS = (Object.entries(PROCUREMENT_METHODS) as [ProcurementMethod, (typeof PROCUREMENT_METHODS)[ProcurementMethod]][]).filter(([, method]) => method.enabled);

export function procurementMethodLabel(method?: string | null): string {
  return PROCUREMENT_METHODS[method as ProcurementMethod]?.label ?? method ?? "—";
}
