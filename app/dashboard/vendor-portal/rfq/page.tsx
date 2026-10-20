import { redirect } from "next/navigation";

export default function VendorRfqPage() {
  redirect("/dashboard/vendor-portal?section=rfq");
}
