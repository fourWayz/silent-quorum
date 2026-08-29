// Silent Quorum — Preprod bootstrap, phase 1: register the funded wallet
// for DUST generation and wait for a usable balance.
//
// Run only after the wallet has been funded with tNIGHT via the Preprod
// faucet (see scripts/print-preprod-address.mjs for the address, and
// scripts/generate-preprod-wallet.mjs for how the wallet was created).
//
// DUST accrues continuously once this registration transaction lands —
// this script waits for it, it does not fabricate a balance.

import { WebSocket } from "ws";
// @ts-expect-error
globalThis.WebSocket = WebSocket;

import pino from "pino";
import { FluentWalletBuilder } from "@midnight-ntwrk/testkit-js";
import { ZswapSecretKeys, DustSecretKey, LedgerParameters } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { preprodEnvConfig, loadPreprodMnemonic } from "./preprod-env.js";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });

function withTimeout<T>(label: string, ms: number, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

async function main() {
  const mnemonic = loadPreprodMnemonic();
  // additionalFeeOverhead matches the official docs.midnight.network
  // "Funding a wallet" guide's real value for a live network — the
  // local-devnet scripts' 1_000n (shared.ts) is for the local devnet's
  // much smaller fee model only, and is not a real Preprod value.
  const dustOptions = {
    ledgerParams: LedgerParameters.initialParameters(),
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5
  };
  const builder = FluentWalletBuilder.forEnvironment(preprodEnvConfig).withDustOptions(dustOptions);
  const { wallet, seeds, keystore } = (await builder.withMnemonic(mnemonic).buildWithoutStarting()) as any;
  const zswapSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);

  logger.info("Starting wallet against Preprod...");
  await wallet.start(zswapSecretKeys, dustSecretKey);

  logger.info("Waiting for unshielded sync...");
  const unshieldedState = await wallet.unshielded.waitForSyncedState();
  const balance = unshieldedState.balances;
  logger.info({ balance }, "unshielded balance");

  const availableCoins = unshieldedState.availableCoins;
  if (availableCoins.length === 0) {
    logger.error("No unshielded UTXOs found — the faucet request has not landed yet, or funding hasn't happened.");
    process.exit(1);
  }

  logger.info({ count: availableCoins.length }, "available NIGHT UTxOs");

  // The facade (`wallet` itself) exposes the high-level registration
  // methods directly — `wallet.dust`/`wallet.unshielded` are the lower-
  // level sub-wallets underneath it, not where these live. Found this by
  // printing wallet's own prototype after the first two guesses
  // (wallet.dust.estimateRegistration, then wallet.dust's raw
  // createDustGenerationTransaction) both failed against the real network.
  //
  // estimateRegistration() itself is skipped here — three separate runs
  // all hung at exactly this call for 10+ minutes of sustained ~100% CPU
  // with zero requests ever reaching the (confirmed healthy) local proof
  // server, so whatever it computes is happening entirely client-side and
  // is not a prerequisite for registerNightUtxosForDustGeneration itself
  // (it's documented as purely informational). Not investigated further —
  // out of scope for this deployment task.
  const nightVerifyingKey = keystore.getPublicKey();
  logger.info("Building DUST registration transaction...");
  const recipe = await withTimeout(
    "registerNightUtxosForDustGeneration",
    5 * 60 * 1000,
    wallet.registerNightUtxosForDustGeneration(availableCoins, nightVerifyingKey, (payload: Uint8Array) =>
      keystore.signData(payload)
    )
  );

  // Matches the official docs.midnight.network "Funding a wallet" guide
  // exactly: registerNightUtxosForDustGeneration already receives the
  // signing callback and returns an already-signed recipe — an extra
  // wallet.signRecipe() on top of it (what an earlier version of this
  // script did, by analogy with the plain balanceTx flow elsewhere in
  // this codebase) corrupted the signature count and was rejected by the
  // real node as Custom error 192 (InputsSignaturesLengthMismatch, per
  // midnight-node/ledger/src/versions/common/types.rs) on every attempt.
  logger.info("Finalizing and submitting DUST registration transaction...");
  const finalized = await wallet.finalizeRecipe(recipe);

  // Real, observed flakiness: the RPC WebSocket closes with a plain
  // "1000: Normal Closure" right around submission, several times in a
  // row against the live Preprod node — not a transaction rejection (the
  // node never got far enough to evaluate the extrinsic). Retrying is the
  // honest mitigation for real-world connection churn, not a workaround
  // for anything about the protocol or the transaction itself.
  let txResult;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      txResult = await wallet.submitTransaction(finalized);
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      logger.warn({ attempt, err: String(err) }, "submission attempt failed, retrying");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (lastErr) throw lastErr;
  logger.info({ txResult }, "registration transaction submitted");

  logger.info("Waiting for projected DUST generation to reach threshold...");
  await wallet.waitForGeneratedDust(availableCoins, 1_000n, { timeoutMs: 20 * 60 * 1000 });

  // IMPORTANT: this resolving is NOT the same as having a spendable DUST
  // balance. waitForGeneratedDust tracks the PROJECTED future generation
  // rate reaching the threshold, which is near-instant right after
  // registration — the actual materialized, spendable balance still has
  // to accrue in real time. Per Midnight's own published tokenomics, a
  // NIGHT UTxO's DUST battery reaches full capacity over roughly one
  // week of linear accrual; confirmed empirically here too — this script
  // exiting successfully was repeatedly followed by real deployment
  // attempts still failing with Wallet.InsufficientFunds up to ~40
  // minutes later. Do not treat this log line as "funded and ready."
  logger.info("Registration confirmed. Spendable DUST will accrue over real time (hours+), not immediately.");
  process.exit(0);
}

main().catch(async (e) => {
  const util = await import("node:util");
  // eslint-disable-next-line no-console
  console.error(util.inspect(e, { depth: null, showHidden: true, maxStringLength: 4000 }));
  process.exit(1);
});
