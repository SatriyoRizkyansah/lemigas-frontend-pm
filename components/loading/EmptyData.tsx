import { cn } from "cn";

type EmptyDataProps = {
  label?: string;
  className?: string;
};

export function EmptyData({ label = "Belum ada data", className }: EmptyDataProps) {
  return (
    <div className={cn("flex min-h-56 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background p-8 text-center", className)} role="status">
      <div className="empty-pyramid" aria-hidden="true">
        <div className="empty-pyramid-wrapper">
          <span className="empty-pyramid-side empty-pyramid-side-1" />
          <span className="empty-pyramid-side empty-pyramid-side-2" />
          <span className="empty-pyramid-side empty-pyramid-side-3" />
          <span className="empty-pyramid-side empty-pyramid-side-4" />
          <span className="empty-pyramid-shadow" />
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
