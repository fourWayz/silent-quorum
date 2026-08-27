// Silent Quorum — race test, phase 1: setup.
//
// Deploys a fresh contract (threshold=4), gets it to tally=2 via two
// uncontested sequential pledges, registers the two identities that will
// race for positions 3 and 4, then prints the contract address for the two
// independent racer processes (racer.ts) to pick up.

import { WebSocket } from "ws";
// @ts-expect-error: needed for apollo's WebSocket usage under Node
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { persistentHash, CompactTypeVector, Bytes32Descriptor } from "@midnight-ntwrk/compact-runtime";
import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, BOB_MNEMONIC, b32, secretFor } from "./shared.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const LEAF_TAG = Uint8Array.from(Buffer.from("silent-quorum:leaf:".padEnd(32, "\0"), "utf8"));
const pairOfBytes32 = new CompactTypeVector(2, Bytes32Descriptor);
const commitmentFor = (identitySecret: Uint8Array): Uint8Array =>
  persistentHash(pairOfBytes32, [LEAF_TAG, identitySecret]);

const CompiledSilentQuorum = CompiledContract.make<SilentQuorum.Contract<SilentQuorumPrivateState>>(
  "SilentQuorum",
  SilentQuorum.Contract as any
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-core/managed")
);

async function main() {
  const alice = await DevnetWalletProvider.fromMnemonic("alice", ALICE_MNEMONIC);
  const bob = await DevnetWalletProvider.fromMnemonic("bob", BOB_MNEMONIC);
  const aliceProviders = buildProviders(alice, "alice-setup");
  const bobProviders = buildProviders(bob, "bob-setup");

  logger.info("Deploying Silent Quorum contract (threshold=4)...");
  const deployed = await deployContract(aliceProviders, {
    compiledContract: CompiledSilentQuorum,
    privateStateId: "silent-quorum-private-state",
    initialPrivateState: { identitySecret: secretFor("p1") } as SilentQuorumPrivateState,
    args: [b32("org:racetest"), b32("quorum:race2"), b32("action:strike"), 4n, b32("recipient:escrow"), 1000n]
  } as any);
  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Deployed at ${contractAddress}`);

  async function register(providers: any, deployedContract: any, label: string) {
    const tx = await deployedContract.callTx.register(commitmentFor(secretFor(label)));
    logger.info(`[register ${label}] tx ${tx.public.txHash} @ block ${tx.public.blockHeight}`);
  }
  async function pledgeAs(providers: any, deployedContract: any, secretLabel: string) {
    await providers.privateStateProvider.set("silent-quorum-private-state", { identitySecret: secretFor(secretLabel) });
    return deployedContract.callTx.pledge();
  }

  await register(aliceProviders, deployed, "p1");
  await pledgeAs(aliceProviders, deployed, "p1");
  logger.info("p1 pledged (tally=1).");

  await register(aliceProviders, deployed, "p2");
  await pledgeAs(aliceProviders, deployed, "p2");
  logger.info("p2 pledged (tally=2, one short of threshold=4... wait, need 2 more — that's correct, p3/p4 both needed).");

  const bobDeployed = await findDeployedContract(bobProviders, {
    contractAddress,
    compiledContract: CompiledSilentQuorum,
    privateStateId: "silent-quorum-private-state",
    initialPrivateState: { identitySecret: secretFor("p4") } as SilentQuorumPrivateState
  } as any);

  await register(aliceProviders, deployed, "p3");
  await register(bobProviders, bobDeployed, "p4");
  logger.info("p3 and p4 registered. Ready for the race.");

  writeFileSync(new URL("./race-address.json", import.meta.url), JSON.stringify({ contractAddress }, null, 2));
  logger.info(`Contract address written to race-address.json: ${contractAddress}`);
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
