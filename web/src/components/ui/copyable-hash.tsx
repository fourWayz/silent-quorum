"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn, truncateHex } from "@/lib/utils";

export function CopyableHash({
  value,
  label,
  lead = 8,
  trail = 8,
  className
}: {
  value: string;
  label?: string;
  lead?: number;
  trail?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable — fail silently, the value is still
      // visible and selectable by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md border border-ink-600 bg-ink-900/60 px-2.5 py-1.5 font-mono text-xs text-ink-100 transition-colors hover:border-signal-500/60 hover:text-signal-200",
        className
      )}
      aria-label={`Copy ${label ?? "value"} to clipboard`}
      title={value}
    >
      <span className="font-mono-tabular">{truncateHex(value, lead, trail)}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-signal-300" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-ink-300 group-hover:text-signal-300" aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
