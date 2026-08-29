import { WebSocket } from "ws";
globalThis.WebSocket = WebSocket;
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FluentWalletBuilder } from "@midnight-ntwrk/testkit-js";
import { ZswapSecretKeys, DustSecretKey, LedgerParameters } from "@midnight-ntwrk/midnight-js-protocol/ledger";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.preprod");
const mnemonic = readFileSync(envPath, "utf8").match(/PREPROD_MNEMONIC="([^"]+)"/)[1];
const preprodEnvConfig = {
  walletNetworkId: "preprod", networkId: "preprod",
  indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preprod.midnight.network", nodeWS: "wss://rpc.preprod.midnight.network",
  proofServer: "http://127.0.0.1:16300", faucet: ""
};
const dustOptions = { ledgerParams: LedgerParameters.initialParameters(), additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 };
const builder = FluentWalletBuilder.forEnvironment(preprodEnvConfig).withDustOptions(dustOptions);
const { wallet, seeds } = await builder.withMnemonic(mnemonic).buildWithoutStarting();
await wallet.start(ZswapSecretKeys.fromSeed(seeds.shielded), DustSecretKey.fromSeed(seeds.dust));
const state = await wallet.unshielded.waitForSyncedState();
console.log("availableCoins:", JSON.stringify(state.availableCoins, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));
console.log("totalCoins:", state.totalCoins.length, "pendingCoins:", state.pendingCoins.length);
process.exit(0);
