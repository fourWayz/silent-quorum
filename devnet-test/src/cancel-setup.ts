// Silent Quorum — cancel-vs-pledge race, phase 1: setup.
// Deploys Core with threshold=2, gets one uncontested pledge in (tally=1,
// one short), registers a second identity — then the race is: does cancel()
// or pledge() win for that second identity, and what does the network do
// with the loser.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { persistentHash, CompactTypeVector, Bytes32Descriptor } from "@midnight-ntwrk/compact-runtime";
import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import { issuerCommitmentFor, b32 } from "../../contract/src/domain.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, secretFor } from "./shared.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const LEAF_TAG = Uint8Array.from(Buffer.from("silent-quorum:leaf:".padEnd(32, "\0"), "utf8"));
const pairOfBytes32 = new CompactTypeVector(2, Bytes32Descriptor);
const commitmentFor = (s: Uint8Array) => persistentHash(pairOfBytes32, [LEAF_TAG, s]);

const CompiledSilentQuorum = CompiledContract.make<SilentQuorum.Contract<SilentQuorumPrivateState>>(
  "SilentQuorum",
  SilentQuorum.Contract as any
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-core/managed")
);

const ISSUER_SECRET = secretFor("issuer");

async function main() {
  const alice = await DevnetWalletProvider.fromMnemonic("alice", ALICE_MNEMONIC);
  const providers = buildProviders(alice, "alice-cancelrace-setup");

  logger.info("Deploying Silent Quorum (threshold=2)...");
  const deployed = await deployContract(providers, {
    compiledContract: CompiledSilentQuorum,
    privateStateId: "silent-quorum-private-state",
    initialPrivateState: { identitySecret: secretFor("p1"), issuerSecret: ISSUER_SECRET } as SilentQuorumPrivateState,
    args: [
      b32("org:cancelrace"),
      b32("quorum:cr1"),
      b32("action:strike"),
      2n,
      issuerCommitmentFor(ISSUER_SECRET),
      b32("recipient:escrow"),
      1000n
    ]
  } as any);
  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Deployed at ${contractAddress}`);

  async function register(secretLabel: string) {
    const tx = await deployed.callTx.register(commitmentFor(secretFor(secretLabel)));
    logger.info(`[register ${secretLabel}] tx ${tx.public.txHash} @ block ${tx.public.blockHeight}`);
  }
  async function pledgeAs(secretLabel: string) {
    await providers.privateStateProvider.set("silent-quorum-private-state", {
      identitySecret: secretFor(secretLabel),
      issuerSecret: ISSUER_SECRET
    });
    return deployed.callTx.pledge();
  }

  await register("p1");
  await pledgeAs("p1");
  logger.info("p1 pledged (tally=1, threshold=2 — one short).");

  await register("p2");
  logger.info("p2 registered. Ready for the race: cancel() vs pledge(p2).");

  writeFileSync(new URL("./cancel-race-address.json", import.meta.url), JSON.stringify({ contractAddress }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
