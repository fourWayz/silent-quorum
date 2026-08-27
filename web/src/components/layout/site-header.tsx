import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { href: "/protocol", label: "Protocol" },
  { href: "/console", label: "Quorums" },
  { href: "/registry", label: "Registry" },
  { href: "/claims", label: "Claims" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-signal-400 shadow-[0_0_12px_2px_rgba(52,202,164,0.65)] transition-transform duration-300 group-hover:scale-125"
          />
          <span className="font-display text-lg tracking-tight text-paper">Silent Quorum</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-[13px] uppercase tracking-[0.1em] text-ink-200 transition-colors hover:text-signal-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/console" className={buttonVariants({ variant: "outline", size: "sm", className: "hidden md:inline-flex" })}>
          Enter Console
        </Link>

        <MobileNav items={NAV} />
      </div>
    </header>
  );
}
