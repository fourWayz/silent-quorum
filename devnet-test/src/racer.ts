// Silent Quorum — race test, phase 2: racer.
//
// Runs as its own independent OS process (see race.sh) — genuinely
// independent preparation, not two async branches sharing one process's
// state. Usage: tsx src/racer.ts <alice|bob> <identityLabel>
//
// Each racer connects fresh, reads the current public ledger state via its
// own indexer connection, builds its own witness inputs, and submits
// exactly one pledge. Two racers launched at nearly the same wall-clock
// moment are as close as this test environment can get to "two
// independently-proved transactions targeting the same pre-crossing state."

import { WebSocket } from "ws";
// @ts-expect-error: needed for apollo's WebSocket usage under Node
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { readFileSync, writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, BOB_MNEMONIC, secretFor } from "./shared.js";

const [, , who, label] = process.argv;
const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const CompiledSilentQuorum = CompiledContract.make<SilentQuorum.Contract<SilentQuorumPrivateState>>(
  "SilentQuorum",
  SilentQuorum.Contract as any
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-core/managed")
);

async function main() {
  const { contractAddress } = JSON.parse(readFileSync(new URL("./race-address.json", import.meta.url), "utf8"));
  const mnemonic = who === "alice" ? ALICE_MNEMONIC : BOB_MNEMONIC;
  const wallet = await DevnetWalletProvider.fromMnemonic(who, mnemonic);
  const providers = buildProviders(wallet, `${who}-racer-${label}`);

  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledSilentQuorum,
    privateStateId: "silent-quorum-private-state",
    initialPrivateState: { identitySecret: secretFor(label) } as SilentQuorumPrivateState
  } as any);

  const preState = await providers.publicDataProvider.queryContractState(contractAddress);
  const preLedger = SilentQuorum.ledger(preState.data);
  logger.info(`[${who}/${label}] pre-submission ledger: tally=${preLedger.tally} fired=${preLedger.fired}`);

  logger.info(`[${who}/${label}] submitting pledge NOW: ${new Date().toISOString()}`);
  try {
    const tx = await deployedContract.callTx.pledge();
    const result = { who, label, outcome: "fulfilled", txHash: tx.public.txHash, blockHeight: tx.public.blockHeight };
    logger.info(`[${who}/${label}] SUCCESS tx=${tx.public.txHash} block=${tx.public.blockHeight}`);
    writeFileSync(new URL(`./result-${who}.json`, import.meta.url), JSON.stringify(result, null, 2));
  } catch (e: any) {
    const result = { who, label, outcome: "rejected", error: String(e?.message ?? e) };
    logger.error(`[${who}/${label}] REJECTED: ${result.error}`);
    writeFileSync(new URL(`./result-${who}.json`, import.meta.url), JSON.stringify(result, null, 2));
  }

  const postState = await providers.publicDataProvider.queryContractState(contractAddress);
  const postLedger = SilentQuorum.ledger(postState.data);
  logger.info(
    `[${who}/${label}] post-submission ledger: tally=${postLedger.tally} fired=${postLedger.fired} consequence_balance=${postLedger.consequence_balance}`
  );
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
