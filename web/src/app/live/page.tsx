import type { Metadata } from "next";
import Link from "next/link";
import { EnvironmentBadge } from "@/components/environment/environment-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { GlassPanel } from "@/components/ui/glass-panel";
import { CopyableHash } from "@/components/ui/copyable-hash";
import { QuorumStatusPill, RegistryStatusPill, ClaimStatusPill } from "@/components/ui/status-pill";
import { ThresholdField } from "@/components/quorum/threshold-field";
import { MetadataPanel } from "@/components/quorum/metadata-panel";
import { buttonVariants } from "@/components/ui/button";
import { getPreprodCore, getPreprodRegistry, getPreprodClaims, getPreprodHealth } from "@/lib/protocol/engine/preprod";
import { PREPROD_CONFIG } from "@/lib/protocol/preprod-config";
import { primaryStatus } from "@/lib/protocol/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Live · Preprod" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const [health, core, registry, claims] = await Promise.all([
    getPreprodHealth(),
    getPreprodCore(),
    getPreprodRegistry(),
    getPreprodClaims()
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          eyebrow="Real Midnight Preprod deployment"
          title="Live"
          description="Every value on this page is read directly from the live Midnight Preprod indexer and decoded with the same compiled circuits used everywhere else in this project. This page is read-only — no transaction can be submitted from here. See PREPROD_DEPLOYMENT.md for full deployment evidence."
        />
        <EnvironmentBadge kind="preprod" />
      </div>

      {/* Health strip — a real, live connectivity check, not a static claim */}
      <GlassPanel className="mb-10 flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <HealthItem label="Network" value={health.network} ok />
        <HealthItem
          label="Indexer"
          value={health.reachable ? `block ${health.blockHeight?.toLocaleString()}` : "unreachable"}
          ok={health.reachable}
        />
        <HealthItem label="Core" value={health.core} ok={health.core === "reachable"} />
        <HealthItem label="Registry" value={health.registry} ok={health.registry === "reachable"} />
        <HealthItem label="Claim Ledger" value={health.claimLedger} ok={health.claimLedger === "reachable"} />
        <span className="ml-auto font-mono text-[11px] text-ink-500">checked {new Date(health.checkedAt).toLocaleTimeString()}</span>
      </GlassPanel>

      {/* Core */}
      <section className="mb-16">
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">Quorum Core</h2>
        {core.ok ? (
          <>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[auto_1fr] lg:items-center">
              <div className="flex justify-center">
                <ThresholdField tally={core.data.tally} threshold={core.data.threshold} status={primaryStatus(core.data)} />
              </div>
              <div>
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <QuorumStatusPill status={primaryStatus(core.data)} />
                  <span className="font-mono text-xs text-ink-400">
                    {core.data.tally}/{core.data.threshold} pledged
                  </span>
                  <span className="font-mono text-xs text-ink-500">
                    registration {core.data.registrationOpen ? "open" : "closed"}
                  </span>
                </div>
                <p className="mb-4 max-w-lg text-sm leading-relaxed text-ink-200">{core.data.summary}</p>
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    Contract address
                  </span>
                  <CopyableHash value={PREPROD_CONFIG.coreAddress} label="Core address" lead={10} trail={10} />
                </div>
              </div>
            </div>
            <div className="mt-10 border-t border-white/[0.06] pt-8">
              <MetadataPanel quorum={core.data} />
            </div>
          </>
        ) : (
          <UnavailablePanel error={core.error} />
        )}
      </section>

      {/* Registry */}
      <section className="mb-16">
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">Quorum Registry</h2>
        {registry.ok ? (
          <div className="flex flex-col gap-3">
            {registry.data.length === 0 ? (
              <GlassPanel className="p-5 text-sm text-ink-300">No quorums registered.</GlassPanel>
            ) : (
              registry.data.map((entry) => {
                const matches = entry.coreConfigCommitment === entry.configCommitment;
                return (
                  <GlassPanel key={entry.quorumId} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                          {entry.coreAddressLabel.slice(0, 16)}…
                        </p>
                        <h3 className="mt-1 font-display text-lg text-paper">{entry.quorumLabel}</h3>
                      </div>
                      <RegistryStatusPill status={entry.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                          Operator-claimed config commitment
                        </p>
                        <CopyableHash value={entry.configCommitment} label="registry config commitment" />
                      </div>
                      <div>
                        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
                          Core&rsquo;s actual config commitment
                        </p>
                        {entry.coreConfigCommitment ? (
                          <CopyableHash value={entry.coreConfigCommitment} label="core config commitment" />
                        ) : (
                          <span className="text-xs text-ink-400">Core instance not resolvable</span>
                        )}
                      </div>
                    </div>
                    <p className={cn("mt-3 font-mono text-[11px]", matches ? "text-signal-300" : "text-ignition-300")}>
                      {matches
                        ? "✓ Matches — verified by this client, not by the protocol"
                        : "⚠ Mismatch"}
                    </p>
                  </GlassPanel>
                );
              })
            )}
          </div>
        ) : (
          <UnavailablePanel error={registry.error} />
        )}
      </section>

      {/* Claim Ledger */}
      <section className="mb-16">
        <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">Consequence Claim Ledger</h2>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-300">
          A claim recorded here proves only that the claimant controls the recipient secret behind the commitment
          they supplied. It does <strong className="text-paper">not</strong> prove Quorum Core fired — the Claim
          Ledger has no way to check that, by design (see <code className="font-mono text-xs">ARCHITECTURE.md</code>
          ). Core above did fire; the claim below references that same quorum, but its status reflects real
          claim/dispute activity, not proof of firing.
        </p>
        {claims.ok ? (
          claims.data.length === 0 ? (
            <GlassPanel className="p-5 text-sm text-ink-300">No claims recorded yet.</GlassPanel>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {claims.data.map((claim) => (
                <GlassPanel key={claim.claimId} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                        {claim.orgLabel}
                      </p>
                      <h3 className="mt-1 font-display text-lg text-paper">{claim.quorumLabel}</h3>
                      <p className="mt-1 text-xs text-ink-400">{claim.actionLabel}</p>
                    </div>
                    <ClaimStatusPill status={claim.status} />
                  </div>
                  <div className="mt-4 flex flex-col gap-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Claim ID</p>
                    <CopyableHash value={claim.claimId} label="claim id" />
                  </div>
                </GlassPanel>
              ))}
            </div>
          )
        ) : (
          <UnavailablePanel error={claims.error} />
        )}
      </section>

      <div className="flex flex-col items-center gap-3 border-t border-white/[0.06] pt-10 text-center">
        <p className="max-w-md text-sm text-ink-300">
          Want to actually pledge, register, or dispute? This page is read-only. The full interactive ritual runs
          in the Simulator, against the exact same compiled circuits.
        </p>
        <Link href="/console" className={buttonVariants({ variant: "outline" })}>
          Try the interactive Simulator
        </Link>
      </div>
    </div>
  );
}

function HealthItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-signal-400" : "bg-mute-400")} aria-hidden="true" />
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-500">{label}</span>
      <span className="font-mono-tabular text-xs text-paper">{value}</span>
    </div>
  );
}

function UnavailablePanel({ error }: { error: string }) {
  return (
    <GlassPanel className="border-ignition-600/30 p-5 text-sm text-ignition-200">
      Unavailable — this value could not be read from the live indexer right now. Not substituted with simulator
      data.
      <p className="mt-2 font-mono text-xs text-ink-400">{error}</p>
    </GlassPanel>
  );
}
