"use client";

import { MotionConfig } from "motion/react";

/** Makes every `motion.*` component in the app automatically honor the
 * OS-level prefers-reduced-motion setting, without each component having
 * to check useReducedMotion itself. IgnitionOverlay and the 3D field still
 * do their own explicit, more substantial reduced-motion handling (they
 * swap to genuinely different visuals, not just shorter transitions) —
 * this covers everything else. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
