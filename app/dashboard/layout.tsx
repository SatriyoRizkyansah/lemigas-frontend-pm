import { cookies } from "next/headers";
import Shell from "@/components/Shell";
import { SESSION_COOKIE, userFromIdentity } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = userFromIdentity(cookies().get(SESSION_COOKIE)?.value);
  return <Shell user={user}>{children}</Shell>;
}
