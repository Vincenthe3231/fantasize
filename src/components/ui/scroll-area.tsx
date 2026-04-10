import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Single scroll surface so `max-h-*` / `flex-1 min-h-0` reliably produce scrollbars
 * (a nested `h-full` viewport often never gets a definite height, e.g. in dropdowns).
 */
const ScrollArea = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "min-h-0 overflow-y-auto overflow-x-hidden rounded-[inherit] scrollbar-thin",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

/** API compatibility; scrolling uses the element above. */
const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & { orientation?: "vertical" | "horizontal" }
>(() => null);
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
