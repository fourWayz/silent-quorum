// Silent Quorum — Registry race test, phase 1: setup.
// Deploys a fresh Registry, then hands off the address for two racer
// processes to independently attempt registering the same quorumId.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as Registry from "../../contract/src/managed/quorum-registry/contract/index.js";
import { registryWitnesses, type RegistryPrivateState } from "../../contract/src/registry-witnesses.js";
import { operatorCommitmentFor, b32 } from "../../contract/src/domain.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, secretFor } from "./shared.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const CompiledRegistry = CompiledContract.make<Registry.Contract<RegistryPrivateState>>(
  "QuorumRegistry",
  Registry.Contract as any
).pipe(
  CompiledContract.withWitnesses(registryWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/managed/quorum-registry")
);

const OPERATOR_SECRET = secretFor("registry-operator");

async function main() {
  const alice = await DevnetWalletProvider.fromMnemonic("alice", ALICE_MNEMONIC);
  const providers = buildProviders(alice, "alice-registry-setup", "quorum-registry");

  logger.info("Deploying Quorum Registry...");
  const deployed = await deployContract(providers, {
    compiledContract: CompiledRegistry,
    privateStateId: "registry-private-state",
    initialPrivateState: { operatorSecret: OPERATOR_SECRET } as RegistryPrivateState,
    args: [operatorCommitmentFor(OPERATOR_SECRET)]
  } as any);
  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Deployed at ${contractAddress}`);

  writeFileSync(
    new URL("./registry-address.json", import.meta.url),
    JSON.stringify({ contractAddress, quorumId: Buffer.from(b32("quorum:race-target")).toString("hex") }, null, 2)
  );
  logger.info("Ready for the race.");
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
