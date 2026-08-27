// Silent Quorum — Claim Ledger race test, phase 2: racer.
// Usage: tsx src/claim-racer.ts <alice|bob>
// Both racers know the SAME recipient secret and submit the SAME claim —
// the race is over which submission lands first, per I19.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { readFileSync, writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as ClaimLedger from "../../contract/src/consequence-claim-ledger/managed/contract/index.js";
import { claimWitnesses, type ClaimPrivateState } from "../../contract/src/consequence-claim-ledger/witnesses.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, BOB_MNEMONIC, secretFor } from "./shared.js";

const [, , who, actionSuffix] = process.argv;
const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const CompiledClaimLedger = CompiledContract.make<ClaimLedger.Contract<ClaimPrivateState>>(
  "ConsequenceClaimLedger",
  ClaimLedger.Contract as any
).pipe(
  CompiledContract.withWitnesses(claimWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/consequence-claim-ledger/managed")
);

const ARBITER_SECRET = secretFor("arbiter");
const RECIPIENT_SECRET = secretFor("shared-recipient");

async function main() {
  const { contractAddress, org, quorum, recipientCommitment } = JSON.parse(
    readFileSync(new URL("./claim-address.json", import.meta.url), "utf8")
  );
  // A fresh, never-claimed action_id per race round — re-racing the exact
  // same triple would just replay "already claimed" against settled state,
  // not test a genuine race.
  const action = Buffer.from(
    Uint8Array.from(Buffer.from(`action:race${actionSuffix ?? ""}`.padEnd(32, "\0"), "utf8"))
  ).toString("hex");
  const mnemonic = who === "alice" ? ALICE_MNEMONIC : BOB_MNEMONIC;
  const wallet = await DevnetWalletProvider.fromMnemonic(who, mnemonic);
  const providers = buildProviders(wallet, `${who}-claim-racer`, "consequence-claim-ledger");

  const deployedContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledClaimLedger,
    privateStateId: "claim-private-state",
    initialPrivateState: { recipientSecret: RECIPIENT_SECRET, arbiterSecret: ARBITER_SECRET } as ClaimPrivateState
  } as any);

  logger.info(`[${who}] submitting claim NOW: ${new Date().toISOString()}`);
  try {
    const tx = await deployedContract.callTx.claim(
      Uint8Array.from(Buffer.from(org, "hex")),
      Uint8Array.from(Buffer.from(quorum, "hex")),
      Uint8Array.from(Buffer.from(action, "hex")),
      Uint8Array.from(Buffer.from(recipientCommitment, "hex")),
      0n
    );
    logger.info(`[${who}] SUCCESS tx=${tx.public.txHash} block=${tx.public.blockHeight}`);
    writeFileSync(new URL(`./claim-result-${who}.json`, import.meta.url), JSON.stringify({ who, outcome: "fulfilled" }, null, 2));
  } catch (e: any) {
    logger.error(`[${who}] REJECTED: ${e?.message ?? e}`);
    writeFileSync(new URL(`./claim-result-${who}.json`, import.meta.url), JSON.stringify({ who, outcome: "rejected", error: String(e?.message ?? e) }, null, 2));
  }
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
