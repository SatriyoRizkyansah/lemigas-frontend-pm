import { redirect } from "next/navigation";

export default function VendorNegotiationPage() {
  redirect("/dashboard/vendor-portal?section=negotiation");
}
