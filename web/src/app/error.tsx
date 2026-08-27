"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-ignition-300">Circuit failed</p>
      <h1 className="mt-4 font-display text-3xl text-paper">Something broke on this page.</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-300">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button variant="outline" className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
