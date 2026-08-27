import { Badge } from "@/components/ui/badge";
import { ENVIRONMENT_COPY } from "@/lib/protocol/environment-copy";
import type { EnvironmentKind } from "@/lib/protocol/types";
import { cn } from "@/lib/utils";

export function EnvironmentBadge({ kind, className }: { kind: EnvironmentKind; className?: string }) {
  const copy = ENVIRONMENT_COPY[kind];
  const tone: "signal" | "mute" | "outline" =
    kind === "local-devnet" ? "signal" : kind === "unconfigured" ? "mute" : "outline";
  return (
    <Badge tone={tone} className={cn("cursor-help", className)} title={copy.description}>
      {copy.label}
    </Badge>
  );
}
