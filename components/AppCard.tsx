import { ArrowRight, FolderOpen } from "lucide-react";
import type { AppItem } from "@/lib/apps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppCard({ app }: { app: AppItem }) {
  const active = app.status === "active";
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <span className="inline-flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
          <FolderOpen size={22} />
        </span>
        <Badge variant="outline" className={active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
          {active ? "Aktif" : "Pemeliharaan"}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        <CardTitle>{app.name}</CardTitle>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{app.description}</p>
      </CardContent>
      <CardFooter>
        {active ? (
          <Button className="w-full" render={<a href={app.href} target="_blank" rel="noopener noreferrer" />}>
            Open app <ArrowRight size={16} aria-hidden="true" />
          </Button>
        ) : (
          <Button className="w-full" disabled>
            Tidak tersedia
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
