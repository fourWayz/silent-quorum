import Link from "next/link";
import { DevnetStatusLine } from "@/components/environment/devnet-status";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-base text-paper">Silent Quorum</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              An atomic threshold-ignition protocol for privacy-preserving collective action, built on Midnight.
              Participant identities are private; the running pledge count is public in this version.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">Protocol</span>
              <Link href="/protocol" className="text-ink-200 hover:text-signal-300">
                How it works
              </Link>
              <Link href="/console" className="text-ink-200 hover:text-signal-300">
                Quorums
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">Layers</span>
              <Link href="/registry" className="text-ink-200 hover:text-signal-300">
                Registry
              </Link>
              <Link href="/claims" className="text-ink-200 hover:text-signal-300">
                Claim Ledger
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] text-ink-400">© 2026 Silent Quorum. Protocol frozen and audited.</p>
          <DevnetStatusLine />
        </div>
      </div>
    </footer>
  );
}
