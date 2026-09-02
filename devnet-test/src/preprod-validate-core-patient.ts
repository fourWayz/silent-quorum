// Silent Quorum — Preprod Core validation, patient variant.
//
// The fast-path validation script (preprod-validate-core.ts) was run
// first and every dust-spending call failed with Wallet.InsufficientFunds
// — including against a Core instance whose deployment (via the patient
// wallet) had *just* succeeded, proving the wallet definitely holds
// enough real DUST. The fast path just can't see it. This variant pays
// the same full dust-sync cost as deployment before attempting anything,
// so results here are trustworthy — including the "replay rejected"
// check, which only means something if the registration and first
// pledge it depends on actually happened first.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { readFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import { leafFor } from "../../contract/src/domain.js";
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

function loadAddresses() {
  const raw = readFileSync(new URL("./preprod-addresses.json", import.meta.url), "utf8");
  return JSON.parse(raw);
}

const results: Record<string, "PASS" | string> = {};

async function main() {
  const { coreAddress } = loadAddresses();
  const mnemonic = loadPreprodMnemonic();
  const walletProvider = (await PatientWalletProvider.build(mnemonic)) as any;
  const providers = buildProviders(walletProvider, "preprod-core-patient", "quorum-core", preprodEnvConfig);

  const core = await findDeployedContract(providers, {
    contractAddress: coreAddress,
    compiledContract: CompiledSilentQuorum,
    privateStateId: "preprod-core-private-state-patient",
    initialPrivateState: { identitySecret: secretFor("p1"), issuerSecret: ISSUER_SECRET } as SilentQuorumPrivateState
  } as any);

  async function setIdentity(label: string) {
    await providers.privateStateProvider.set("preprod-core-private-state-patient", {
      identitySecret: secretFor(label),
      issuerSecret: ISSUER_SECRET
    });
  }

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

  await step("register p1", async () => {
    await setIdentity("p1");
    const tx = await core.callTx.register(leafFor(secretFor("p1")));
    logger.info({ tx: tx.public.txHash }, "registered p1");
  });

  await step("register p2", async () => {
    await setIdentity("p2");
    const tx = await core.callTx.register(leafFor(secretFor("p2")));
    logger.info({ tx: tx.public.txHash }, "registered p2");
  });

  await step("pledge p1 (below threshold)", async () => {
    await setIdentity("p1");
    const tx = await core.callTx.pledge();
    logger.info({ tx: tx.public.txHash }, "p1 pledged");
  });

  await step("pledge p2 (crosses threshold, fires)", async () => {
    await setIdentity("p2");
    const tx = await core.callTx.pledge();
    logger.info({ tx: tx.public.txHash }, "p2 pledged — threshold crossed");
  });

  // This result only means something because p1's pledge above genuinely
  // succeeded — unlike the fast-path run, where this "passed" for the
  // wrong reason (p1 was never registered in the first place).
  await step("replay p1 pledge (must be rejected)", async () => {
    await setIdentity("p1");
    let rejected = false;
    try {
      await core.callTx.pledge();
    } catch (e) {
      rejected = true;
      logger.info({ err: String(e) }, "replay correctly rejected");
    }
    if (!rejected) throw new Error("replay was accepted, should have been rejected");
  });

  await step("close_registration", async () => {
    const tx = await core.callTx.close_registration();
    logger.info({ tx: tx.public.txHash }, "registration closed");
  });

  logger.info({ results }, "=== PATIENT VALIDATION RESULTS ===");
  process.exit(0);
}

main().catch(async (e) => {
  const util = await import("node:util");
  // eslint-disable-next-line no-console
  console.error(util.inspect(e, { depth: null, showHidden: true, maxStringLength: 4000 }));
  logger.info({ results }, "=== PARTIAL PATIENT VALIDATION RESULTS (crashed) ===");
  process.exit(1);
});
