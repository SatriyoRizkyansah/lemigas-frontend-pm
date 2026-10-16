import type { Metadata } from "next";
import MasterDataPage from "@/components/master-data/MasterDataPage";
export const metadata: Metadata = { title: "Vendor" };
export default function VendorPage() {
  return <MasterDataPage kind="vendor" formColumns={2} />;
}
