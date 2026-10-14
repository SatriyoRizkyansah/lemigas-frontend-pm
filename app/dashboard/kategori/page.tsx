import type { Metadata } from "next";
import MasterDataPage from "@/components/master-data/MasterDataPage";
export const metadata: Metadata = { title: "Kategori" };
export default function KategoriPage() {
  return <MasterDataPage kind="kategori" />;
}
