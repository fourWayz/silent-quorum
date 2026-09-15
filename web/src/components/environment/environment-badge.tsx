import { Badge } from "@/components/ui/badge";
import { ENVIRONMENT_COPY } from "@/lib/protocol/environment-copy";
import type { EnvironmentKind } from "@/lib/protocol/types";
import { cn } from "@/lib/utils";

export function EnvironmentBadge({ kind, className }: { kind: EnvironmentKind; className?: string }) {
  const copy = ENVIRONMENT_COPY[kind];
  // "preprod" gets the ignition (amber) tone deliberately — the same color
  // this design system reserves for a genuine, significant real-world
  // event (threshold ignition), not decoration. It's the one badge that
  // means "this is actually live," so it should not share a tone with
  // anything else.
  const tone: "signal" | "ignition" | "mute" | "outline" =
    kind === "preprod" ? "ignition" : kind === "local-devnet" ? "signal" : kind === "unconfigured" ? "mute" : "outline";
  return (
    <Badge tone={tone} className={cn("cursor-help", className)} title={copy.description}>
      {copy.label}
    </Badge>
  );
}
