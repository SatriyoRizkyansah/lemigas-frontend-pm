import TeamAssignmentPage from "@/components/workflow/TeamAssignmentPage";

export default function Page({ params }: { params: { pengadaanId: string } }) {
  return <TeamAssignmentPage pengadaanId={params.pengadaanId} />;
}
