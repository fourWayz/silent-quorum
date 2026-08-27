// Client-side identity secret handling for the Simulator/Demo pledge
// ritual. The secret never leaves the browser except in the one call that
// needs it (register/pledge/claim), sent directly to the server action
// that runs the real circuit — the same trust boundary a real wallet has
// with its own client: the holder's own software necessarily sees the
// secret it holds. It is never logged, rendered, or persisted server-side.

const STORAGE_PREFIX = "silent-quorum:identity:";

function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** One persistent identity secret per quorum per browser — mirrors the
 * real protocol's expectation that a fresh secret per quorum avoids the
 * cross-quorum linkability documented in ARCHITECTURE.md. */
export function getOrCreateIdentitySecret(quorumId: string): string {
  if (typeof window === "undefined") return "";
  const key = `${STORAGE_PREFIX}${quorumId}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const fresh = randomHex();
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // Storage unavailable (private browsing, blocked site data, etc.) —
    // fall back to an in-memory-only secret for this page view.
    return randomHex();
  }
}

export function getOrCreateClaimSecret(scope: string): string {
  if (typeof window === "undefined") return "";
  const key = `${STORAGE_PREFIX}claim:${scope}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const fresh = randomHex();
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return randomHex();
  }
}
