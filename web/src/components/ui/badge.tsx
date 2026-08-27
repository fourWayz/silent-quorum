import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] font-mono",
  {
    variants: {
      tone: {
        neutral: "border-ink-500 text-ink-200 bg-ink-800/60",
        signal: "border-signal-600/60 text-signal-300 bg-signal-950/70",
        ignition: "border-ignition-600/60 text-ignition-200 bg-ignition-600/10",
        mute: "border-mute-500/50 text-mute-300 bg-ink-800/60",
        outline: "border-ink-400 text-ink-100 bg-transparent"
      }
    },
    defaultVariants: { tone: "neutral" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dotClassName?: string;
}

export function Badge({ className, tone, dotClassName, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", dotClassName)} aria-hidden="true" />
      {children}
    </span>
  );
}
