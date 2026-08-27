// Silent Quorum — Claim Ledger race test, phase 1: setup.
import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as ClaimLedger from "../../contract/src/managed/consequence-claim-ledger/contract/index.js";
import { claimWitnesses, type ClaimPrivateState } from "../../contract/src/claim-witnesses.js";
import { arbiterCommitmentFor, recipientCommitmentFor, b32 } from "../../contract/src/domain.js";
import { DevnetWalletProvider, buildProviders, ALICE_MNEMONIC, secretFor } from "./shared.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
setNetworkId("undeployed");

const CompiledClaimLedger = CompiledContract.make<ClaimLedger.Contract<ClaimPrivateState>>(
  "ConsequenceClaimLedger",
  ClaimLedger.Contract as any
).pipe(
  CompiledContract.withWitnesses(claimWitnesses),
  CompiledContract.withCompiledFileAssets("../../contract/src/managed/consequence-claim-ledger")
);

const ARBITER_SECRET = secretFor("arbiter");
const RECIPIENT_SECRET = secretFor("shared-recipient"); // both racers know this — the race is over who's FIRST, not over who owns it

async function main() {
  const alice = await DevnetWalletProvider.fromMnemonic("alice", ALICE_MNEMONIC);
  const providers = buildProviders(alice, "alice-claim-setup", "consequence-claim-ledger");

  logger.info("Deploying Consequence Claim Ledger...");
  const deployed = await deployContract(providers, {
    compiledContract: CompiledClaimLedger,
    privateStateId: "claim-private-state",
    initialPrivateState: { recipientSecret: RECIPIENT_SECRET, arbiterSecret: ARBITER_SECRET } as ClaimPrivateState,
    args: [arbiterCommitmentFor(ARBITER_SECRET)]
  } as any);
  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Deployed at ${contractAddress}`);

  writeFileSync(
    new URL("./claim-address.json", import.meta.url),
    JSON.stringify(
      {
        contractAddress,
        org: Buffer.from(b32("org:race")).toString("hex"),
        quorum: Buffer.from(b32("quorum:race")).toString("hex"),
        action: Buffer.from(b32("action:race")).toString("hex"),
        recipientCommitment: Buffer.from(recipientCommitmentFor(RECIPIENT_SECRET)).toString("hex")
      },
      null,
      2
    )
  );
  logger.info("Ready for the race.");
  process.exit(0);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
