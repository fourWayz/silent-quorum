// Silent Quorum — Preprod deployment, patient variant.
//
// Earlier attempts skipped wallet.dust.waitForSyncedState() because it
// didn't complete within a few minutes and was assumed hung. Other
// Midnight builders independently report this exact step legitimately
// taking 1-3 hours the first time (a real sync, not a stall) and that
// killing it early is the actual cause of it "never finishing" (it
// restarts from scratch each time). This version waits on it properly,
// left running uninterrupted, before attempting deployment.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { writeFileSync } from "node:fs";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { FluentWalletBuilder } from "@midnight-ntwrk/testkit-js";
import { ZswapSecretKeys, DustSecretKey, LedgerParameters } from "@midnight-ntwrk/midnight-js-protocol/ledger";

import * as SilentQuorum from "../../contract/src/quorum-core/managed/contract/index.js";
import { witnesses, type SilentQuorumPrivateState } from "../../contract/src/quorum-core/witnesses.js";
import { issuerCommitmentFor, b32 } from "../../contract/src/domain.js";
import { buildProviders, secretFor } from "./shared.js";
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
// Minimal DevnetWalletProvider-alike built inline so we control the sync
// wait precisely, without touching shared.ts's already-working fast path
// used elsewhere.
class PatientWalletProvider {
  private constructor(
    private readonly wallet: any,
    private readonly zswapSecretKeys: any,
    private readonly dustSecretKey: any,
    private readonly keystore: any
  ) {}
  getCoinPublicKey() {
    return this.zswapSecretKeys.coinPublicKey;
  }
  getEncryptionPublicKey() {
    return this.zswapSecretKeys.encryptionPublicKey;
  }
  async balanceTx(tx: any, ttl = new Date(Date.now() + 3600_000)) {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl }
    );
    const signedRecipe = await this.wallet.signRecipe(recipe, (payload: Uint8Array) =>
      this.keystore.signData(payload)
    );
    return this.wallet.finalizeRecipe(signedRecipe);
  }
  submitTx(tx: any) {
    return this.wallet.submitTransaction(tx);
  }

  static async build(mnemonic: string): Promise<PatientWalletProvider> {
    const dustOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5
    };
    const builder = FluentWalletBuilder.forEnvironment(preprodEnvConfig).withDustOptions(dustOptions);
    const { wallet, seeds, keystore } = (await builder.withMnemonic(mnemonic).buildWithoutStarting()) as any;
    const zswapSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
    const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
    await wallet.start(zswapSecretKeys, dustSecretKey);

    logger.info("Waiting for unshielded sync (fast)...");
    await wallet.unshielded.waitForSyncedState();
    logger.info("Unshielded synced.");

    logger.info(
      "Waiting for DUST wallet sync — other builders report this taking well over 3 hours (one case " +
        "over 4 hours) on a first, from-scratch sync, eventually succeeding. No cap this time — left " +
        "running until it actually resolves. Progress pings every 2 minutes."
    );
    // Also pings the local proof server on every heartbeat — if Docker/WSL
    // suspends again mid-run (has happened once already this session),
    // this makes it visible in the log immediately rather than only
    // discovered later as an opaque failure "at the last step."
    const pinger = setInterval(async () => {
      let proofServerOk = false;
      try {
        const res = await fetch("http://127.0.0.1:16300/health", { signal: AbortSignal.timeout(3000) });
        proofServerOk = res.ok;
      } catch {
        proofServerOk = false;
      }
      logger.info(
        `still waiting on dust sync... (t+${process.uptime() | 0}s) proof-server: ${proofServerOk ? "OK" : "UNREACHABLE"}`
      );
    }, 120_000);
    try {
      const dustState = await wallet.dust.waitForSyncedState();
      logger.info({ balance: (dustState as any).balance(new Date()).toString() }, "DUST wallet synced.");
    } finally {
      clearInterval(pinger);
    }

    return new PatientWalletProvider(wallet, zswapSecretKeys, dustSecretKey, keystore);
  }
}

async function main() {
  const mnemonic = loadPreprodMnemonic();
  const walletProvider = (await PatientWalletProvider.build(mnemonic)) as any;
  const coreProviders = buildProviders(walletProvider, "preprod-core-patient", "quorum-core", preprodEnvConfig);

  logger.info("Deploying Quorum Core to Preprod (threshold=2)...");
  const core = await deployContract(coreProviders, {
    compiledContract: CompiledSilentQuorum,
    privateStateId: "preprod-core-private-state-patient",
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
  logger.info({ coreAddress }, "Quorum Core deployed");

  writeFileSync(
    new URL("./preprod-addresses.json", import.meta.url),
    JSON.stringify({ network: "preprod", coreAddress: String(coreAddress), deployedAt: new Date().toISOString() }, null, 2)
  );
  logger.info("Wrote preprod-addresses.json");
  process.exit(0);
}

main().catch(async (e) => {
  const util = await import("node:util");
  // eslint-disable-next-line no-console
  console.error(util.inspect(e, { depth: null, showHidden: true, maxStringLength: 4000 }));
  process.exit(1);
});
