"use client";

"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  full: "max-w-[min(96vw,90rem)]",
} as const;

export function ModalSection({ title, description, action, children, className }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4 rounded-lg border bg-card p-4 sm:p-5", className)}>
      {(title || description || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ModalDetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</dl>;
}

export function ModalDetailItem({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-md bg-muted/30 px-3 py-2.5", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizeClasses;
  bodyClassName?: string;
  contentClassName?: string;
};

/** Shared responsive dialog shell. Keep form state and business logic in the consuming page. */
export function Modal({ open, onClose, title, description, children, footer, size = "md", bodyClassName, contentClassName }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className={cn("!grid !grid-rows-[auto_minmax(0,1fr)_auto] !h-auto !max-h-[90dvh] min-h-0 w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-xl border bg-background p-0 shadow-xl", sizeClasses[size], contentClassName)}
        showCloseButton
      >
        <DialogHeader className="min-h-0 border-b bg-background px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
          {description ? <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription> : null}
        </DialogHeader>
        <div className={cn("min-h-0 overflow-y-auto px-5 py-4 text-sm text-foreground sm:px-6", bodyClassName)}>{children}</div>
        {footer ? <div className="relative z-10 flex min-h-14 items-center justify-end gap-2 border-t bg-background px-5 py-3 sm:px-6">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
