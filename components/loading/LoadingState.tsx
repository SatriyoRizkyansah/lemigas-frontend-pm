import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-5" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-4/5" />
    </div>
  );
}
