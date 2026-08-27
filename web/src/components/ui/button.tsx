import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-[var(--ease-out)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-signal-400 text-ink-950 hover:bg-signal-300 active:scale-[0.98] shadow-[0_0_0_1px_rgba(52,202,164,0.35),0_8px_24px_-8px_rgba(52,202,164,0.55)]",
        outline:
          "border border-ink-400 text-paper hover:border-signal-400 hover:text-signal-300 active:scale-[0.98]",
        ghost: "text-ink-100 hover:text-paper hover:bg-ink-800 active:scale-[0.98]",
        ignition:
          "bg-ignition-400 text-ink-950 hover:bg-ignition-200 shadow-[0_0_0_1px_rgba(242,165,61,0.4),0_8px_28px_-6px_rgba(242,165,61,0.65)] active:scale-[0.98]"
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-14 px-8 text-base"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
