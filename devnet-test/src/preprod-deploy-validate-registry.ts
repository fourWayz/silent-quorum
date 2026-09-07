// Silent Quorum — Preprod: deploy + validate Quorum Registry.
//
// Uses the proven patient wallet path (preprod-patient-wallet.ts) — NOT
// the old preprod-deploy.ts, which predates the DUST/sync findings and
// was never actually run to a successful deployment. Deploys the
// existing, unmodified Registry contract, then exercises it for real:
// registering the already-live Core instance, duplicate-registration
// rejection, deactivation, and an authorization-boundary rejection.
//
// Core's config_commitment is NOT read back from chain — it's
// recomputed client-side via the same deterministic configCommitmentFor
// helper used everywhere else in this codebase, from the exact
// constructor arguments Core was actually deployed with (see
// preprod-deploy-patient.ts). This is the protocol's own intended
// design (README: "independently reproducible by any client from the
// same constructor arguments"), not a shortcut around verification.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { readFileSync, writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { asBytes, ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/platform-js/effect/ContractAddress";

import * as Registry from "../../contract/src/quorum-registry/managed/contract/index.js";
import { registryWitnesses, type RegistryPrivateState } from "../../contract/src/quorum-registry/witnesses.js";
import { operatorCommitmentFor, issuerCommitmentFor, configCommitmentFor, b32 } from "../../contract/src/domain.js";
import { buildProviders, secretFor } from "./shared.js";
import { preprodEnvConfig, loadPreprodMnemonic } from "./preprod-env.js";
import { PatientWalletProvider } from "./preprod-patient-wallet.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("preprod");

const CompiledRegistry = CompiledContract.make<Registry.Contract<RegistryPrivateState>>(
  "QuorumRegistry",
  Registry.Contract as any
).pipe(
  CompiledContract.withWitnesses(registryWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-registry/managed")
);

const OPERATOR_SECRET = secretFor("preprod-operator");
const NOT_OPERATOR_SECRET = secretFor("preprod-not-operator");

// Exactly the constructor arguments Core was deployed with — see
// preprod-deploy-patient.ts. Reproduced here, not invented, so
// config_commitment can be independently recomputed client-side.
const CORE_CONFIG = {
  orgId: b32("org:silent-quorum-preprod"),
  quorumId: b32("quorum:flagship-2026"),
  actionId: b32("action:ignite"),
  threshold: 2n,
  issuerCommitment: issuerCommitmentFor(secretFor("preprod-issuer")),
  recipientCommitment: b32("recipient:preprod-escrow"),
  amount: 5_000n,
  protocolVersion: 2n
};

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
  const addresses = loadAddresses();
  const coreAddress = addresses.coreAddress as string;
  if (!coreAddress) throw new Error("preprod-addresses.json has no coreAddress — deploy Core first");

  const mnemonic = loadPreprodMnemonic();
  const walletProvider = (await PatientWalletProvider.build(mnemonic)) as any;
  const providers = buildProviders(walletProvider, "preprod-registry-patient", "quorum-registry", preprodEnvConfig);

  logger.info("Deploying Quorum Registry to Preprod...");
  const registry = await deployContract(providers, {
    compiledContract: CompiledRegistry,
    privateStateId: "preprod-registry-private-state-patient",
    initialPrivateState: { operatorSecret: OPERATOR_SECRET } as RegistryPrivateState,
    args: [operatorCommitmentFor(OPERATOR_SECRET)]
  } as any);
  const registryAddress = registry.deployTxData.public.contractAddress;
  const registryDeployTx =
    (registry.deployTxData.public as any).txHash ?? (registry.deployTxData.public as any).txId ?? "unknown";
  logger.info({ registryAddress, registryDeployTx }, "Quorum Registry deployed");

  // Persist immediately — real evidence survives even if a later
  // validation step fails.
  saveAddresses({
    registryAddress: String(registryAddress),
    registryDeployTx: String(registryDeployTx),
    registryDeployedAt: new Date().toISOString()
  });

  const coreAddressBytes = asBytes(ContractAddress(coreAddress));
  const coreConfigCommitment = configCommitmentFor(CORE_CONFIG);

  async function setOperator(secret: Uint8Array) {
    await providers.privateStateProvider.set("preprod-registry-private-state-patient", { operatorSecret: secret });
  }

  await step("A. register_quorum (real Core instance)", async () => {
    await setOperator(OPERATOR_SECRET);
    const tx = await registry.callTx.register_quorum(
      CORE_CONFIG.quorumId,
      { bytes: coreAddressBytes },
      coreConfigCommitment
    );
    logger.info({ tx: tx.public.txHash }, "registered real Core quorum");
  });

  await step("B. duplicate register_quorum (must be rejected)", async () => {
    await setOperator(OPERATOR_SECRET);
    let rejected = false;
    try {
      await registry.callTx.register_quorum(CORE_CONFIG.quorumId, { bytes: coreAddressBytes }, coreConfigCommitment);
    } catch (e) {
      rejected = true;
      logger.info({ err: String(e) }, "duplicate correctly rejected");
    }
    if (!rejected) throw new Error("duplicate registration was accepted, should have been rejected");
  });

  await step("D. unauthorized register_quorum (must be rejected)", async () => {
    await setOperator(NOT_OPERATOR_SECRET);
    let rejected = false;
    try {
      await registry.callTx.register_quorum(
        b32("quorum:preprod-auth-test"),
        { bytes: coreAddressBytes },
        b32("config:preprod-auth-test")
      );
    } catch (e) {
      rejected = true;
      logger.info({ err: String(e) }, "unauthorized call correctly rejected");
    }
    if (!rejected) throw new Error("unauthorized register_quorum was accepted, should have been rejected");
  });

  await step("C. deactivate_quorum (real Core instance)", async () => {
    await setOperator(OPERATOR_SECRET);
    const tx = await registry.callTx.deactivate_quorum(CORE_CONFIG.quorumId);
    logger.info({ tx: tx.public.txHash }, "deactivated real Core quorum");
  });

  saveAddresses({ registryValidation: results });
  logger.info({ results }, "=== REGISTRY VALIDATION RESULTS ===");
  process.exit(0);
}

main().catch(async (e) => {
  const util = await import("node:util");
  // eslint-disable-next-line no-console
  console.error(util.inspect(e, { depth: null, showHidden: true, maxStringLength: 4000 }));
  saveAddresses({ registryValidation: results });
  logger.info({ results }, "=== PARTIAL REGISTRY VALIDATION RESULTS (crashed) ===");
  process.exit(1);
});
