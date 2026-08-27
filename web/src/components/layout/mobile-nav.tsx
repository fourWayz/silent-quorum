"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 items-center justify-center rounded-full text-paper transition-colors hover:bg-ink-800"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-16 border-b border-white/[0.06] bg-ink-950/97 px-5 py-6 backdrop-blur-xl"
        >
          <nav className="flex flex-col gap-1" aria-label="Primary">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 font-mono text-sm uppercase tracking-[0.1em] text-ink-100 transition-colors hover:bg-ink-800 hover:text-signal-300"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/console"
              onClick={() => setOpen(false)}
              className={buttonVariants({ variant: "primary", className: "mt-3 justify-center" })}
            >
              Enter Console
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
