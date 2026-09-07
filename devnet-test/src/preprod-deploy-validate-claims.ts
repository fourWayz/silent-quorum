// Silent Quorum — Preprod: deploy + validate Consequence Claim Ledger.
//
// Uses the proven patient wallet path, same as the Registry script. Only
// run after Registry deployment/validation has genuinely succeeded (per
// the task's own ordering requirement) — this script does not check that
// itself, it's a process-level sequencing decision.
//
// Claims reference the real, already-fired Core instance's
// (org, quorum, action) triple — the same one used for Registry's real
// registration — for narrative coherence, not because the Claim Ledger
// requires it: the contract cannot and does not check that Core actually
// fired (see consequence-claim-ledger.compact's own header comment and
// ARCHITECTURE.md). That boundary is preserved exactly as designed.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { readFileSync, writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import * as ClaimLedger from "../../contract/src/consequence-claim-ledger/managed/contract/index.js";
import { claimWitnesses, type ClaimPrivateState } from "../../contract/src/consequence-claim-ledger/witnesses.js";
import { arbiterCommitmentFor, recipientCommitmentFor, b32 } from "../../contract/src/domain.js";
import { buildProviders, secretFor } from "./shared.js";
import { preprodEnvConfig, loadPreprodMnemonic } from "./preprod-env.js";
import { PatientWalletProvider } from "./preprod-patient-wallet.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("preprod");

const CompiledClaimLedger = CompiledContract.make<ClaimLedger.Contract<ClaimPrivateState>>(
  "ConsequenceClaimLedger",
  ClaimLedger.Contract as any
).pipe(
  CompiledContract.withWitnesses(claimWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/consequence-claim-ledger/managed")
);

const ARBITER_SECRET = secretFor("preprod-arbiter");
const RECIPIENT_SECRET = secretFor("preprod-recipient");
const WRONG_SECRET = secretFor("preprod-wrong-recipient");

// Same triple Core was actually deployed and fired with.
const ORG_ID = b32("org:silent-quorum-preprod");
const QUORUM_ID = b32("quorum:flagship-2026");
const ACTION_ID = b32("action:ignite");
// A distinct, never-claimed action for the "wrong recipient" check — a
// fresh (org, quorum, action) triple, not the real fired one, so this
// check doesn't collide with the real claim recorded above.
const WRONG_TEST_ACTION_ID = b32("action:ignite-wrong-test");

function loadAddresses(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(new URL("./preprod-addresses.json", import.meta.url), "utf8"));
  } catch {
    return {};
  }
}

function saveAddresses(patch: Record<string, unknown>) {
  const current = loadAddresses();
  writeFileSync(
    new URL("./preprod-addresses.json", import.meta.url),
    JSON.stringify({ ...current, ...patch }, null, 2)
  );
}

const results: Record<string, "PASS" | string> = {};

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results[name] = "PASS";
    logger.info(`[PASS] ${name}`);
  } catch (e) {
    results[name] = `FAIL: ${String(e)}`;
    logger.error({ err: String(e) }, `[FAIL] ${name}`);
  }
}

async function main() {
  const mnemonic = loadPreprodMnemonic();
  const walletProvider = (await PatientWalletProvider.build(mnemonic)) as any;
  const providers = buildProviders(walletProvider, "preprod-claims-patient", "consequence-claim-ledger", preprodEnvConfig);

  logger.info("Deploying Consequence Claim Ledger to Preprod...");
  const claims = await deployContract(providers, {
    compiledContract: CompiledClaimLedger,
    privateStateId: "preprod-claim-private-state-patient",
    initialPrivateState: {
      recipientSecret: RECIPIENT_SECRET,
      arbiterSecret: ARBITER_SECRET
    } as ClaimPrivateState,
    args: [arbiterCommitmentFor(ARBITER_SECRET)]
  } as any);
  const claimAddress = claims.deployTxData.public.contractAddress;
  const claimDeployTx =
    (claims.deployTxData.public as any).txHash ?? (claims.deployTxData.public as any).txId ?? "unknown";
  logger.info({ claimAddress, claimDeployTx }, "Consequence Claim Ledger deployed");

  saveAddresses({
    claimAddress: String(claimAddress),
    claimDeployTx: String(claimDeployTx),
    claimDeployedAt: new Date().toISOString()
  });

  async function setPrivateState(recipientSecret: Uint8Array, arbiterSecret: Uint8Array) {
    await providers.privateStateProvider.set("preprod-claim-private-state-patient", {
      recipientSecret,
      arbiterSecret
    });
  }

  await step("A. claim (real recipient secret)", async () => {
    await setPrivateState(RECIPIENT_SECRET, ARBITER_SECRET);
    const tx = await claims.callTx.claim(
      ORG_ID,
      QUORUM_ID,
      ACTION_ID,
      recipientCommitmentFor(RECIPIENT_SECRET),
      1n
    );
    logger.info({ tx: tx.public.txHash }, "claim recorded");
  });

  await step("B. duplicate claim (must be rejected)", async () => {
    await setPrivateState(RECIPIENT_SECRET, ARBITER_SECRET);
    let rejected = false;
    try {
      await claims.callTx.claim(ORG_ID, QUORUM_ID, ACTION_ID, recipientCommitmentFor(RECIPIENT_SECRET), 1n);
    } catch (e) {
      rejected = true;
      logger.info({ err: String(e) }, "duplicate claim correctly rejected");
    }
    if (!rejected) throw new Error("duplicate claim was accepted, should have been rejected");
  });

  await step("C. wrong recipient secret (must be rejected)", async () => {
    // Claims to be the real recipient (supplies their real commitment as
    // the public argument) but the witness only knows a different,
    // wrong secret — the circuit's own recompute-and-compare must fail.
    await setPrivateState(WRONG_SECRET, ARBITER_SECRET);
    let rejected = false;
    try {
      await claims.callTx.claim(
        ORG_ID,
        QUORUM_ID,
        WRONG_TEST_ACTION_ID,
        recipientCommitmentFor(RECIPIENT_SECRET),
        1n
      );
    } catch (e) {
      rejected = true;
      logger.info({ err: String(e) }, "wrong-recipient claim correctly rejected");
    }
    if (!rejected) throw new Error("claim with wrong recipient secret was accepted, should have been rejected");
  });

  await step("D. dispute (real arbiter secret)", async () => {
    await setPrivateState(RECIPIENT_SECRET, ARBITER_SECRET);
    const tx = await claims.callTx.dispute(ORG_ID, QUORUM_ID, ACTION_ID);
    logger.info({ tx: tx.public.txHash }, "dispute recorded");
  });

  saveAddresses({ claimValidation: results });
  logger.info({ results }, "=== CLAIM LEDGER VALIDATION RESULTS ===");
  process.exit(0);
}

main().catch(async (e) => {
  const util = await import("node:util");
  // eslint-disable-next-line no-console
  console.error(util.inspect(e, { depth: null, showHidden: true, maxStringLength: 4000 }));
  saveAddresses({ claimValidation: results });
  logger.info({ results }, "=== PARTIAL CLAIM LEDGER VALIDATION RESULTS (crashed) ===");
  process.exit(1);
});
