"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type DocumentActionButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "primary" | "neutral";
};

export function DocumentActionButton({ label, onClick, children, disabled = false, tone = "neutral" }: DocumentActionButtonProps) {
  const toneClass = tone === "primary" ? "text-primary hover:border-primary/20 hover:bg-primary/10" : "text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground";

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`inline-flex size-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 ${toneClass}`}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
