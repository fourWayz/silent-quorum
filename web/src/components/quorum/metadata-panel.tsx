import { CopyableHash } from "@/components/ui/copyable-hash";
import type { QuorumSnapshot } from "@/lib/protocol/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{label}</dt>
      <dd className="text-sm text-paper">{children}</dd>
    </div>
  );
}

export function MetadataPanel({ quorum }: { quorum: QuorumSnapshot }) {
  return (
    <dl className="grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
      <Row label="Organization">{quorum.orgLabel}</Row>
      <Row label="Quorum ID">{quorum.quorumLabel}</Row>
      <Row label="Action">{quorum.actionLabel}</Row>
      <Row label="Protocol version">v{quorum.protocolVersion}</Row>
      <Row label="Consequence recipient">{quorum.consequenceRecipientLabel}</Row>
      <Row label="Consequence amount">
        <span className="font-mono-tabular">{Number(quorum.consequenceAmount).toLocaleString()}</span>{" "}
        <span className="text-ink-400">units, recorded on-chain — not a real-world transfer</span>
      </Row>
      <Row label="Registration">{quorum.registrationOpen ? "Open" : "Closed"}</Row>
      <Row label="Participants registered">{quorum.participantCount}</Row>

      <div className="col-span-full grid grid-cols-1 gap-3 py-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Config commitment</dt>
          <CopyableHash value={quorum.configCommitment} label="config commitment" />
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Issuer commitment</dt>
          <CopyableHash value={quorum.issuerCommitment} label="issuer commitment" />
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Recipient commitment</dt>
          <CopyableHash value={quorum.consequenceRecipientCommitment} label="recipient commitment" />
        </div>
      </div>
    </dl>
  );
}
