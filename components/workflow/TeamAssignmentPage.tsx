"use client";

import { useMemo } from "react";
import { ArrowLeft, UsersRound } from "lucide-react";
import Link from "next/link";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState } from "@/components/loading/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { TeamAssignmentPanel } from "./TeamAssignmentPanel";

type WorkflowStage = { key: string; label: string; urutan?: number };
function unwrap(value: unknown): any {
  let data = value as any;
  for (let i = 0; i < 3 && data && typeof data === "object" && "data" in data; i += 1) data = data.data;
  return data;
}

export default function TeamAssignmentPage({ pengadaanId: id }: { pengadaanId: string }) {
  const currentUser = useCurrentUser();
  const query = use_query<any, Error, string>({
    tag: "siklusTransaksiKomoditas",
    method: "transaksiControllerDetail",
    params: id,
    queryFn: async (procurementId) => {
      setBrowserToken();
      return unwrap(await apiData(browserApi.siklusTransaksiKomoditas.transaksiControllerDetail(procurementId, { format: "json" }) as Promise<{ data: unknown }>));
    },
  });
  const detail = query.data;
  const stages: WorkflowStage[] = useMemo(() => (detail?.tahapan ?? []).map((stage: any) => ({ key: stage.tahap, label: stage.label ?? stage.tahap.replaceAll("_", " "), urutan: stage.urutan })), [detail?.tahapan]);
  const canManage = currentUser.data?.role.toLowerCase() === "admin" || Boolean((detail?.anggota ?? []).some((member: any) => member.userId === currentUser.data?.id && member.peran === "pic_utama" && member.aktif));

  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>{getApiErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  return (
    <section className="space-y-5 py-1">
      <PageHeader
        title="Pengaturan Tim Pengadaan"
        description={detail?.judul ? `Atur anggota dan penanggung jawab tahap untuk ${detail.judul}.` : "Atur anggota dan penanggung jawab setiap tahap pengadaan."}
        actions={
          <Button variant="outline" render={<Link href={`/dashboard/pengadaan/${id}/siklus`} />}>
            <ArrowLeft size={16} />
            Kembali ke siklus
          </Button>
        }
      />
      {!canManage ? (
        <Alert>
          <UsersRound size={16} />
          <AlertDescription>Hanya PIC UTAMA atau Admin yang dapat mengubah anggota dan penugasan. Anda masih dapat melihat tim.</AlertDescription>
        </Alert>
      ) : null}
      <TeamAssignmentPanel pengadaanId={id} stages={stages} canManage={canManage} />
    </section>
  );
}
