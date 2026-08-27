import "server-only";
export { ENVIRONMENT_COPY } from "./environment-copy";

const NODE_URL = process.env.MIDNIGHT_NODE_URL ?? "http://127.0.0.1:19944";
const INDEXER_HEALTH_URL = process.env.MIDNIGHT_INDEXER_HEALTH_URL ?? "http://127.0.0.1:18088/api/v4/graphql";

export interface DevnetStatus {
  reachable: boolean;
  nodeUrl: string;
  indexerUrl: string;
  blockHeight: number | null;
  checkedAt: string;
}

/** A genuine, real connectivity probe — not a static badge. Queries the
 * indexer's GraphQL health/block data over the network. If the local
 * devnet stood up for Milestone 1/2 isn't running, this honestly reports
 * unreachable rather than fabricating a height. */
export async function checkLocalDevnet(): Promise<DevnetStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(INDEXER_HEALTH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ block { height } }" }),
      signal: AbortSignal.timeout(2500),
      cache: "no-store"
    });
    if (!res.ok) return { reachable: false, nodeUrl: NODE_URL, indexerUrl: INDEXER_HEALTH_URL, blockHeight: null, checkedAt };
    const json = (await res.json()) as { data?: { block?: { height?: unknown } } };
    const height = json?.data?.block?.height;
    return {
      reachable: typeof height === "number",
      nodeUrl: NODE_URL,
      indexerUrl: INDEXER_HEALTH_URL,
      blockHeight: typeof height === "number" ? height : null,
      checkedAt
    };
  } catch {
    return { reachable: false, nodeUrl: NODE_URL, indexerUrl: INDEXER_HEALTH_URL, blockHeight: null, checkedAt };
  }
}
