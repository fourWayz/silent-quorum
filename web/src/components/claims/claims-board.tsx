"use client";

import { useState } from "react";
import { ClaimCard } from "./claim-card";
import { ClaimRitual } from "./claim-ritual";
import type { ClaimSnapshot } from "@/lib/protocol/types";

export function ClaimsBoard({
  initialClaims,
  eligible
}: {
  initialClaims: ClaimSnapshot[];
  eligible: { id: string; name: string; fired: boolean }[];
}) {
  const [claims, setClaims] = useState(initialClaims);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">Submit a Claim</h2>
        <ClaimRitual eligible={eligible} onSubmitted={setClaims} />
      </div>
      <div>
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">Recorded Claims</h2>
        <div className="flex flex-col gap-4">
          {claims.map((c) => (
            <ClaimCard key={c.claimId} claim={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
