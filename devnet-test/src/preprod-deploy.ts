// Silent Quorum — Preprod deployment.
//
// Deploys real Quorum Core, Quorum Registry, and Consequence Claim Ledger
// instances to the live Preprod network, using the single funded wallet
// generated for this session (see .env.preprod). All three contracts
// share one wallet as fee-payer; each contract's private state (identity
// secrets, issuer secret, operator secret, arbiter secret) is independent
// of the wallet's own keys — exactly the same separation the local-devnet
// scripts already rely on.
//
// A deliberately small threshold (2) keeps the real fee/time budget
// realistic for a single funded wallet in one session, while still
// genuinely exercising every state transition (below threshold, at
// threshold, fired, replay-rejected).
//
// STATUS: written and network/signing-path verified (sync, providers,
// and the constructor call shape all reach the real node correctly —
// confirmed by the specific "Insufficient Funds: could not balance dust"
// rejection, which only happens after everything upstream of fee-payment
// succeeded), but not yet run to a completed deployment. Root cause is
// external, not a bug here: the wallet's registered NIGHT needs real
// time (Midnight's DUST battery reaches full capacity over ~1 week of
// linear accrual, per the network's own published tokenomics) to
// generate enough spendable DUST to pay a deployment's fee. Re-run this
// once the funding wallet (see preprod-env.ts / .env.preprod) has
// accrued sufficient DUST.
//
// Registry cross-registration (recording Core's real address/config
// commitment in the Registry) is deliberately NOT automated in this
// script — it needs Core's real deployed config_commitment read back via
// getPublicStates, which needs a successful Core deployment to test
// against first. Do that as an explicit follow-up step once Core is
// live, not blind here.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import * as Registry from "../../contract/src/quorum-registry/managed/contract/index.js";
import { registryWitnesses, type RegistryPrivateState } from "../../contract/src/quorum-registry/witnesses.js";
import * as ClaimLedger from "../../contract/src/consequence-claim-ledger/managed/contract/index.js";
import { claimWitnesses, type ClaimPrivateState } from "../../contract/src/consequence-claim-ledger/witnesses.js";

import { issuerCommitmentFor, operatorCommitmentFor, arbiterCommitmentFor, b32 } from "../../contract/src/domain.js";
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
const CompiledRegistry = CompiledContract.make<Registry.Contract<RegistryPrivateState>>(
  "QuorumRegistry",
  Registry.Contract as any
).pipe(
  CompiledContract.withWitnesses(registryWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/quorum-registry/managed")
);
const CompiledClaimLedger = CompiledContract.make<ClaimLedger.Contract<ClaimPrivateState>>(
  "ConsequenceClaimLedger",
  ClaimLedger.Contract as any
).pipe(
  CompiledContract.withWitnesses(claimWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/consequence-claim-ledger/managed")
);

const ISSUER_SECRET = secretFor("preprod-issuer");
const OPERATOR_SECRET = secretFor("preprod-operator");
const ARBITER_SECRET = secretFor("preprod-arbiter");

async function main() {
  const mnemonic = loadPreprodMnemonic();
  const wallet = await DevnetWalletProvider.fromMnemonic("deployer", mnemonic, preprodEnvConfig, 180_000);

  const coreProviders = buildProviders(wallet, "preprod-core", "quorum-core", preprodEnvConfig);
  logger.info("Deploying Quorum Core to Preprod (threshold=2)...");
  const core = await deployContract(coreProviders, {
    compiledContract: CompiledSilentQuorum,
    privateStateId: "preprod-core-private-state",
    initialPrivateState: { identitySecret: secretFor("p1"), issuerSecret: ISSUER_SECRET } as SilentQuorumPrivateState,
    args: [
      b32("org:silent-quorum-preprod"),
      b32("quorum:flagship-2026"),
      b32("action:ignite"),
      2n,
      issuerCommitmentFor(ISSUER_SECRET),
      b32("recipient:preprod-escrow"),
      5_000n
    ]
  } as any);
  const coreAddress = core.deployTxData.public.contractAddress;
  const coreDeployTx = core.deployTxData.public.txHash ?? core.deployTxData.public.txId ?? "unknown";
  logger.info({ coreAddress, coreDeployTx }, "Quorum Core deployed");

  const registryProviders = buildProviders(wallet, "preprod-registry", "quorum-registry", preprodEnvConfig);
  logger.info("Deploying Quorum Registry to Preprod...");
  const registry = await deployContract(registryProviders, {
    compiledContract: CompiledRegistry,
    privateStateId: "preprod-registry-private-state",
    initialPrivateState: { operatorSecret: OPERATOR_SECRET } as RegistryPrivateState,
    args: [operatorCommitmentFor(OPERATOR_SECRET)]
  } as any);
  const registryAddress = registry.deployTxData.public.contractAddress;
  logger.info({ registryAddress }, "Quorum Registry deployed");

  const claimProviders = buildProviders(wallet, "preprod-claims", "consequence-claim-ledger", preprodEnvConfig);
  logger.info("Deploying Consequence Claim Ledger to Preprod...");
  const claims = await deployContract(claimProviders, {
    compiledContract: CompiledClaimLedger,
    privateStateId: "preprod-claim-private-state",
    initialPrivateState: {
      recipientSecret: secretFor("preprod-recipient"),
      arbiterSecret: ARBITER_SECRET
    } as ClaimPrivateState,
    args: [arbiterCommitmentFor(ARBITER_SECRET)]
  } as any);
  const claimAddress = claims.deployTxData.public.contractAddress;
  logger.info({ claimAddress }, "Consequence Claim Ledger deployed");

  writeFileSync(
    new URL("./preprod-addresses.json", import.meta.url),
    JSON.stringify(
      {
        network: "preprod",
        coreAddress: String(coreAddress),
        coreDeployTx,
        registryAddress: String(registryAddress),
        claimAddress: String(claimAddress),
        deployedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
  logger.info("Wrote preprod-addresses.json");
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
