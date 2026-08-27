import * as React from "react";
import { cn } from "@/lib/utils";

/** The interface's one "layered optical surface" primitive. Used
 * deliberately, not everywhere — plenty of content in this app sits
 * directly on the background (see the design note in globals.css). */
export function GlassPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-lg)] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_20px_60px_-24px_rgba(0,0,0,0.65)]",
        className
      )}
      {...props}
    />
  );
}
