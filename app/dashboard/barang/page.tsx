import type { Metadata } from "next";
import MasterDataPage from "@/components/master-data/MasterDataPage";
export const metadata: Metadata = { title: "Barang" };
export default function BarangPage() {
  return <MasterDataPage kind="barang" />;
}
