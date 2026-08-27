// Silent Quorum — Registry race test, phase 2: racer.
// Usage: tsx src/registry-racer.ts <alice|bob> <coreAddressLabel>
// Both racers attempt to register the SAME quorumId (from registry-address.json)
// with a DIFFERENT claimed coreAddress — exactly the "who gets there first"
// conflict I16 exists to prevent.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { readFileSync, writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as Registry from "../../contract/src/quorum-registry/managed/contract/index.js";
import { registryWitnesses, type RegistryPrivateState } from "../../contract/src/quorum-registry/witnesses.js";
import { b32 } from "../../contract/src/domain.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, BOB_MNEMONIC, secretFor } from "./shared.js";

const [, , who, coreLabel] = process.argv;
const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const CompiledRegistry = CompiledContract.make<Registry.Contract<RegistryPrivateState>>(
  "QuorumRegistry",
  Registry.Contract as any
).pipe(
  CompiledContract.withWitnesses(registryWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-registry/managed")
);

const OPERATOR_SECRET = secretFor("registry-operator");
const addressFor = (label: string) => ({ bytes: Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8")) });

async function main() {
  const { contractAddress, quorumId } = JSON.parse(
    readFileSync(new URL("./registry-address.json", import.meta.url), "utf8")
  );
  const mnemonic = who === "alice" ? ALICE_MNEMONIC : BOB_MNEMONIC;
  const wallet = await DevnetWalletProvider.fromMnemonic(who, mnemonic);
  const providers = buildProviders(wallet, `${who}-registry-racer`, "quorum-registry");

  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledRegistry,
    privateStateId: "registry-private-state",
    initialPrivateState: { operatorSecret: OPERATOR_SECRET } as RegistryPrivateState
  } as any);

  logger.info(`[${who}] submitting register_quorum(quorumId, core:${coreLabel}) NOW: ${new Date().toISOString()}`);
  try {
    const tx = await deployedContract.callTx.register_quorum(
      Uint8Array.from(Buffer.from(quorumId, "hex")),
      addressFor(`core:${coreLabel}`),
      b32(`config:${coreLabel}`)
    );
    logger.info(`[${who}] SUCCESS tx=${tx.public.txHash} block=${tx.public.blockHeight}`);
    writeFileSync(new URL(`./registry-result-${who}.json`, import.meta.url), JSON.stringify({ who, outcome: "fulfilled" }, null, 2));
  } catch (e: any) {
    logger.error(`[${who}] REJECTED: ${e?.message ?? e}`);
    writeFileSync(new URL(`./registry-result-${who}.json`, import.meta.url), JSON.stringify({ who, outcome: "rejected", error: String(e?.message ?? e) }, null, 2));
  }
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
