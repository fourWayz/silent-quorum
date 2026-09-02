// Silent Quorum — Preprod deployment, patient variant.
//
// See preprod-patient-wallet.ts for why this exists: a fresh wallet
// process needs its DUST sub-wallet fully synced (multiple hours,
// confirmed) before it can correctly see a real DUST balance, even one
// that already exists on-chain. This is the actual bottleneck, not
// DUST *generation* rate — deployment succeeded immediately once this
// sync genuinely completed.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import { issuerCommitmentFor, b32 } from "../../contract/src/domain.js";
import { buildProviders, secretFor } from "./shared.js";
import { preprodEnvConfig, loadPreprodMnemonic } from "./preprod-env.js";
import { PatientWalletProvider } from "./preprod-patient-wallet.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("preprod");

const CompiledSilentQuorum = CompiledContract.make<SilentQuorum.Contract<SilentQuorumPrivateState>>(
  "SilentQuorum",
  SilentQuorum.Contract as any
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-core/managed")
);

const ISSUER_SECRET = secretFor("preprod-issuer");

async function main() {
  const mnemonic = loadPreprodMnemonic();
  const walletProvider = (await PatientWalletProvider.build(mnemonic)) as any;
  const coreProviders = buildProviders(walletProvider, "preprod-core-patient", "quorum-core", preprodEnvConfig);

  logger.info("Deploying Quorum Core to Preprod (threshold=2)...");
  const core = await deployContract(coreProviders, {
    compiledContract: CompiledSilentQuorum,
    privateStateId: "preprod-core-private-state-patient",
    initialPrivateState: { identitySecret: secretFor("p1"), issuerSecret: ISSUER_SECRET } as SilentQuorumPrivateState,
    args: [
      b32("org:silent-quorum-preprod"),
      b32("quorum:flagship-2026"),
      b32("action:ignite"),
      2n,
      issuerCommitmentFor(ISSUER_SECRET),
      b32("recipient:preprod-escrow"),
      5_000n
    ]
  } as any);
  const coreAddress = core.deployTxData.public.contractAddress;
  logger.info({ coreAddress }, "Quorum Core deployed");

  writeFileSync(
    new URL("./preprod-addresses.json", import.meta.url),
    JSON.stringify({ network: "preprod", coreAddress: String(coreAddress), deployedAt: new Date().toISOString() }, null, 2)
  );
  logger.info("Wrote preprod-addresses.json");
  process.exit(0);
}

main().catch(async (e) => {
  const util = await import("node:util");
  // eslint-disable-next-line no-console
  console.error(util.inspect(e, { depth: null, showHidden: true, maxStringLength: 4000 }));
  process.exit(1);
});
