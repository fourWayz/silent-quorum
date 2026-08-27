"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import type { QuorumPrimaryStatus } from "@/lib/protocol/types";

const COLORS = {
  dormant: "#3d4450",
  signal: "#34caa4",
  signalBright: "#a9f4dd",
  ignition: "#f2a53d"
};

/** The console's central visualization: a physical field of dots — one
 * per unit of threshold — filling in as `tally` rises, with a threshold
 * boundary ring that tightens and brightens as the count closes in. Pure
 * canvas 2D (no WebGL) so it stays cheap on every console page; the 3D
 * field is reserved for the hero. */
export function ThresholdField({
  tally,
  threshold,
  status,
  size = 340
}: {
  tally: number;
  threshold: number;
  status: QuorumPrimaryStatus;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const outerR = size * 0.42;
    const count = Math.max(threshold, 1);
    const dotR = count > 60 ? 1.6 : count > 30 ? 2.2 : 3;

    const points: { x: number; y: number; filled: boolean }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const r = outerR * Math.sqrt((i + 0.5) / count);
      const theta = i * golden;
      points.push({
        x: center + r * Math.cos(theta),
        y: center + r * Math.sin(theta),
        filled: i < tally
      });
    }

    let raf = 0;
    let t = 0;
    const ringBase = status === "cancelled" ? "#6b6660" : status === "fired" ? COLORS.ignition : COLORS.signal;
    const pct = Math.min(1, tally / count);

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);

      // boundary ring
      ctx.beginPath();
      ctx.arc(center, center, outerR + 8, 0, Math.PI * 2);
      ctx.strokeStyle = ringBase;
      ctx.globalAlpha = status === "fired" ? 0.55 : 0.18 + pct * 0.35;
      ctx.lineWidth = status === "fired" ? 2 : 1.2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (status === "fired" && !reducedMotion) {
        const pulse = (Math.sin(t / 480) + 1) / 2;
        ctx.beginPath();
        ctx.arc(center, center, outerR + 8 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.ignition;
        ctx.globalAlpha = 0.25 * pulse;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.filled ? dotR : dotR * 0.65, 0, Math.PI * 2);
        if (p.filled) {
          ctx.fillStyle = status === "cancelled" ? "#948f88" : status === "fired" ? COLORS.ignition : COLORS.signal;
        } else {
          ctx.fillStyle = COLORS.dormant;
        }
        ctx.fill();
      }

      t += 16;
      if (!reducedMotion) raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [tally, threshold, status, size, reducedMotion]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden="true" />
      <div className="pointer-events-none absolute flex flex-col items-center">
        <span className="font-mono-tabular font-display text-5xl text-paper">{tally}</span>
        <span className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-ink-300">
          of {threshold} pledged
        </span>
      </div>
    </div>
  );
}
