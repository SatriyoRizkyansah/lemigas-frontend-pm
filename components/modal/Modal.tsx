"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  xl: "max-w-5xl",
} as const;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizeClasses;
  bodyClassName?: string;
};

export function Modal({ open, onClose, title, children, footer, size = "md", bodyClassName }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className={`flex max-h-[90vh] flex-col gap-0 p-0 ${sizeClasses[size]}`} showCloseButton>
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className={`min-h-0 overflow-y-auto px-5 py-4 text-sm text-muted-foreground ${bodyClassName ?? ""}`}>{children}</div>
        {footer ? <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-xl px-5 py-3">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
