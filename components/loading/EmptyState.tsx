import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title = "Belum ada data", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
        <strong className="text-sm text-foreground">{title}</strong>
        {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
