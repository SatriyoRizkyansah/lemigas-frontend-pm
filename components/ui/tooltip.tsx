"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "cn";

function TooltipProvider({ children, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider {...props}>{children}</TooltipPrimitive.Provider>;
}

function Tooltip({ children, ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger {...props} />;
}

function TooltipContent({ className, side = "top", sideOffset = 6, children, ...props }: TooltipPrimitive.Popup.Props & { side?: "top" | "right" | "bottom" | "left"; sideOffset?: number }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset}>
        <TooltipPrimitive.Popup className={cn("z-[100] rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-md", className)} {...props}>
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
