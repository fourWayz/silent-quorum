// Silent Quorum — cancel-vs-pledge race, phase 2: racer.
// Usage: tsx src/cancel-vs-pledge-racer.ts <alice|bob> <cancel|pledge>

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { readFileSync, writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, BOB_MNEMONIC, secretFor } from "./shared.js";

const [, , who, action] = process.argv;
const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const CompiledSilentQuorum = CompiledContract.make<SilentQuorum.Contract<SilentQuorumPrivateState>>(
  "SilentQuorum",
  SilentQuorum.Contract as any
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-core/managed")
);

const ISSUER_SECRET = secretFor("issuer");

async function main() {
  const { contractAddress } = JSON.parse(
    readFileSync(new URL("./cancel-race-address.json", import.meta.url), "utf8")
  );
  const mnemonic = who === "alice" ? ALICE_MNEMONIC : BOB_MNEMONIC;
  const wallet = await DevnetWalletProvider.fromMnemonic(who, mnemonic);
  const providers = buildProviders(wallet, `${who}-cancelrace-racer`);

  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledSilentQuorum,
    privateStateId: "silent-quorum-private-state",
    initialPrivateState: { identitySecret: secretFor("p2"), issuerSecret: ISSUER_SECRET } as SilentQuorumPrivateState
  } as any);

  const pre = await providers.publicDataProvider.queryContractState(contractAddress);
  const preLedger = SilentQuorum.ledger(pre.data);
  logger.info(`[${who}/${action}] pre-submission: tally=${preLedger.tally} fired=${preLedger.fired} cancelled=${preLedger.cancelled}`);

  logger.info(`[${who}/${action}] submitting NOW: ${new Date().toISOString()}`);
  try {
    const tx = action === "cancel" ? await deployedContract.callTx.cancel() : await deployedContract.callTx.pledge();
    logger.info(`[${who}/${action}] SUCCESS tx=${tx.public.txHash} block=${tx.public.blockHeight}`);
    writeFileSync(new URL(`./cancel-race-result-${action}.json`, import.meta.url), JSON.stringify({ who, action, outcome: "fulfilled" }, null, 2));
  } catch (e: any) {
    logger.error(`[${who}/${action}] REJECTED: ${e?.message ?? e}`);
    writeFileSync(new URL(`./cancel-race-result-${action}.json`, import.meta.url), JSON.stringify({ who, action, outcome: "rejected", error: String(e?.message ?? e) }, null, 2));
  }

  const post = await providers.publicDataProvider.queryContractState(contractAddress);
  const postLedger = SilentQuorum.ledger(post.data);
  logger.info(
    `[${who}/${action}] post-submission: tally=${postLedger.tally} fired=${postLedger.fired} cancelled=${postLedger.cancelled} consequence_balance=${postLedger.consequence_balance}`
  );
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
