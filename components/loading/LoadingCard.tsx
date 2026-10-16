import { cn } from "cn";

type LoadingCardProps = {
  label?: string;
  className?: string;
};

export function LoadingCard({ label = "Loading...", className }: LoadingCardProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10 p-4 backdrop-blur-[2px]" role="status" aria-live="polite" aria-label={label}>
      <div className={cn("flex h-40 w-48 flex-col items-center justify-center gap-5 rounded-[1.75rem] border border-border/70 bg-background/95 p-5 text-center shadow-xl", className)}>
        <div className="spinner" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="spinner-blade" />
          ))}
        </div>
        <p className="text-base font-medium text-foreground">{label}</p>
      </div>
    </div>
  );
}
