import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, userFromIdentity } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Profil" };

export default function ProfilPage() {
  const user = userFromIdentity(cookies().get(SESSION_COOKIE)?.value);
  const rows = [
    ["Nama", user.name],
    ["Peran", user.role],
    ["Email", user.email || "Belum diisi"],
  ];
  return (
    <section className="space-y-5 py-1">
      <PageHeader title="Profil" />
      <Card>
        <CardContent className="flex flex-col gap-6 py-6 sm:flex-row sm:items-center">
          <Avatar className="size-20">
            <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">{user.initials}</AvatarFallback>
          </Avatar>
          <Separator className="sm:h-24 sm:w-px" orientation="vertical" />
          <dl className="grid flex-1 gap-4 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}
