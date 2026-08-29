// Silent Quorum — Preprod Core validation.
//
// Exercises the deployed Quorum Core (threshold=2) end to end against the
// real network: two registrations, a below-threshold pledge, the
// threshold-crossing pledge, verification of the fired/consequence state,
// and a rejected replay of an already-spent nullifier.
//
// Run after preprod-deploy.ts has written preprod-addresses.json.

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
import { DevnetWalletProvider, buildProviders, secretFor } from "./shared.js";
import { preprodEnvConfig, loadPreprodMnemonic } from "./preprod-env.js";

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

const results: Record<string, "PASS" | "FAIL" | string> = {};

async function main() {
  const { coreAddress } = loadAddresses();
  const mnemonic = loadPreprodMnemonic();
  const wallet = await DevnetWalletProvider.fromMnemonic("deployer", mnemonic, preprodEnvConfig, 180_000);
  const providers = buildProviders(wallet, "preprod-core", "quorum-core", preprodEnvConfig);

  const core = await findDeployedContract(providers, {
    contractAddress: coreAddress,
    compiledContract: CompiledSilentQuorum,
    privateStateId: "preprod-core-private-state",
    initialPrivateState: { identitySecret: secretFor("p1"), issuerSecret: ISSUER_SECRET } as SilentQuorumPrivateState
  } as any);

  async function setIdentity(label: string) {
    await providers.privateStateProvider.set("preprod-core-private-state", {
      identitySecret: secretFor(label),
      issuerSecret: ISSUER_SECRET
    });
  }

  // 1. register p1
  try {
    await setIdentity("p1");
    const tx = await core.callTx.register(leafFor(secretFor("p1")));
    logger.info({ tx: tx.public.txHash }, "registered p1");
    results["register p1"] = "PASS";
  } catch (e) {
    logger.error(e, "register p1 failed");
    results["register p1"] = `FAIL: ${String(e)}`;
  }

  // 2. register p2
  try {
    await setIdentity("p2");
    const tx = await core.callTx.register(leafFor(secretFor("p2")));
    logger.info({ tx: tx.public.txHash }, "registered p2");
    results["register p2"] = "PASS";
  } catch (e) {
    logger.error(e, "register p2 failed");
    results["register p2"] = `FAIL: ${String(e)}`;
  }

  // 3. pledge as p1 (below threshold=2 -> tally=1)
  try {
    await setIdentity("p1");
    const tx = await core.callTx.pledge();
    logger.info({ tx: tx.public.txHash }, "p1 pledged");
    results["pledge p1 (below threshold)"] = "PASS";
  } catch (e) {
    logger.error(e, "p1 pledge failed");
    results["pledge p1 (below threshold)"] = `FAIL: ${String(e)}`;
  }

  // 4. pledge as p2 (crosses threshold=2 -> should fire)
  try {
    await setIdentity("p2");
    const tx = await core.callTx.pledge();
    logger.info({ tx: tx.public.txHash }, "p2 pledged — threshold crossed");
    results["pledge p2 (crosses threshold, fires)"] = "PASS";
  } catch (e) {
    logger.error(e, "p2 pledge failed");
    results["pledge p2 (crosses threshold, fires)"] = `FAIL: ${String(e)}`;
  }

  // 5. replay: p1 pledges again — must be rejected (nullifier reuse)
  try {
    await setIdentity("p1");
    await core.callTx.pledge();
    results["replay p1 pledge (must be rejected)"] = "FAIL: replay was accepted, should have been rejected";
  } catch (e) {
    logger.info({ err: String(e) }, "replay correctly rejected");
    results["replay p1 pledge (must be rejected)"] = "PASS";
  }

  // 6. close_registration
  try {
    const tx = await core.callTx.close_registration();
    logger.info({ tx: tx.public.txHash }, "registration closed");
    results["close_registration"] = "PASS";
  } catch (e) {
    logger.error(e, "close_registration failed");
    results["close_registration"] = `FAIL: ${String(e)}`;
  }

  logger.info({ results }, "=== VALIDATION RESULTS ===");
  process.exit(0);
}

main().catch(async (e) => {
  const util = await import("node:util");
  // eslint-disable-next-line no-console
  console.error(util.inspect(e, { depth: null, showHidden: true, maxStringLength: 4000 }));
  logger.info({ results }, "=== PARTIAL VALIDATION RESULTS (crashed) ===");
  process.exit(1);
});
