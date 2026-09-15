// Silent Quorum — the one authoritative place the real Preprod deployment
// addresses and endpoints live. Every other file that needs them imports
// from here — never hardcode an address anywhere else.
//
// These are all public values (contract addresses, a public indexer URL,
// a network name) — safe in client bundles, no "server-only" needed here.
// See PREPROD_DEPLOYMENT.md for how these were deployed and verified.

export const PREPROD_CONFIG = {
  network: process.env.MIDNIGHT_NETWORK ?? "preprod",
  indexerUrl: process.env.MIDNIGHT_INDEXER_URL ?? "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWsUrl: process.env.MIDNIGHT_INDEXER_WS_URL ?? "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  nodeUrl: process.env.MIDNIGHT_NODE_URL ?? "https://rpc.preprod.midnight.network",
  coreAddress:
    process.env.MIDNIGHT_CORE_ADDRESS ?? "8e9eec2f11b807074b65b3a595df6e46c22f897f8c4cd92db446c514c50968a1",
  registryAddress:
    process.env.MIDNIGHT_REGISTRY_ADDRESS ?? "a7d9fdf9fb056b275b8724ada9127bdbb97255186d807546807d637ac5d2bfd8",
  claimAddress:
    process.env.MIDNIGHT_CLAIM_LEDGER_ADDRESS ?? "8f02f4d7a7c284e09581334c141e9d1f138807b9b0f9e3d1bce2c5d7b77703ca"
} as const;

export type PreprodConfig = typeof PREPROD_CONFIG;
