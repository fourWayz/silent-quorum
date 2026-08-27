import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal-400">No signal found</p>
      <h1 className="mt-4 font-display text-4xl text-paper">This path leads nowhere.</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-300">
        Nothing was registered at this address — unlike a quorum&rsquo;s eligibility tree, there&rsquo;s no path to
        prove here.
      </p>
      <Link href="/" className={buttonVariants({ variant: "primary", className: "mt-8" })}>
        Return home
      </Link>
    </div>
  );
}
