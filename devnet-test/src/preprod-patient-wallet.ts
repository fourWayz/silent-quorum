// Silent Quorum — shared patient wallet builder for Preprod.
//
// shared.ts's DevnetWalletProvider only waits on unshielded sync (fast,
// under 2 seconds) — correct for reading balances/addresses, but NOT
// sufficient for any transaction that spends DUST: empirically, a wallet
// built that way still throws Wallet.InsufficientFunds even once a real,
// large DUST balance exists on-chain, because the dust sub-wallet's own
// view of that balance hasn't caught up yet. There is no snapshot/restore
// path wired up in this codebase, so every fresh process pays the full
// first-time dust sync again — confirmed to take multiple hours against
// Preprod, matching what other Midnight builders independently report.
// This waits on it properly instead of assuming it's hung.

import pino from "pino";
import { FluentWalletBuilder } from "@midnight-ntwrk/testkit-js";
import { ZswapSecretKeys, DustSecretKey, LedgerParameters } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { preprodEnvConfig } from "./preprod-env.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });

export class PatientWalletProvider {
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
      "Waiting for DUST wallet sync — confirmed to take multiple hours on a fresh process against " +
        "Preprod. No cap — left running until it actually resolves. Progress pings every 2 minutes, " +
        "including a proof-server reachability check on each one."
    );
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
