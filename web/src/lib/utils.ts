import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shortens a hex string to `abcd1234…7890wxyz` for compact display. */
export function truncateHex(hex: string, lead = 6, trail = 6): string {
  if (hex.length <= lead + trail + 1) return hex;
  return `${hex.slice(0, lead)}…${hex.slice(-trail)}`;
}

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/** Renders a padded 32-byte label tag back to its readable form, e.g.
 * the "org:acme\0\0\0…" bytes used throughout the contract's tests. */
export function decodeLabel(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("utf8").replace(/\0+$/, "");
}
