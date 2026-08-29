// Silent Quorum — shared devnet-test plumbing (wallet adapter, env config,
// providers). Split out of the original single-process race-test.ts so that
// setup.ts and racer.ts can each run as independent OS processes — required
// after finding that two levelPrivateStateProvider instances cannot reliably
// operate concurrently within one Node process (see RESEARCH.md).

import pino from "pino";
import { FluentWalletBuilder, type EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import { ZswapSecretKeys, DustSecretKey, LedgerParameters } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { MidnightProvider, WalletProvider, UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });

function withTimeout<T>(label: string, ms: number, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

export const envConfig: EnvironmentConfiguration = {
  walletNetworkId: "undeployed",
  networkId: "undeployed",
  indexer: "http://127.0.0.1:18088/api/v4/graphql",
  indexerWS: "ws://127.0.0.1:18088/api/v4/graphql/ws",
  node: "http://127.0.0.1:19944",
  nodeWS: "ws://127.0.0.1:19944",
  proofServer: "http://127.0.0.1:16300",
  faucet: ""
};

export const ALICE_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
export const BOB_MNEMONIC =
  "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote";

export const b32 = (label: string): Uint8Array => Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"));
export const secretFor = (label: string): Uint8Array => Uint8Array.from(Buffer.from(label.padEnd(32, "\0"), "utf8"));

type UnshieldedKeystoreLike = { getPublicKey(): unknown; signData(payload: Uint8Array): string };

export class DevnetWalletProvider implements MidnightProvider, WalletProvider {
  private constructor(
    public readonly label: string,
    private readonly wallet: any,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    private readonly unshieldedKeystore: UnshieldedKeystoreLike
  ) {}

  getCoinPublicKey() {
    return this.zswapSecretKeys.coinPublicKey;
  }
  getEncryptionPublicKey() {
    return this.zswapSecretKeys.encryptionPublicKey;
  }
  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()) {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl }
    );
    const signedRecipe = await this.wallet.signRecipe(recipe, (payload: Uint8Array) =>
      this.unshieldedKeystore.signData(payload)
    );
    return this.wallet.finalizeRecipe(signedRecipe);
  }
  submitTx(tx: any) {
    return this.wallet.submitTransaction(tx);
  }

  static async fromMnemonic(
    label: string,
    mnemonic: string,
    env: EnvironmentConfiguration = envConfig,
    syncTimeoutMs = 120_000
  ): Promise<DevnetWalletProvider> {
    // The local devnet's fee model tolerates a tiny overhead (1_000n).
    // Real networks (Preprod/Mainnet) need the value the official
    // docs.midnight.network "Funding a wallet" guide actually uses —
    // confirmed necessary empirically against Preprod, not assumed.
    const dustOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: env.networkId === "undeployed" ? 1_000n : 300_000_000_000_000n,
      feeBlocksMargin: 5
    };
    const builder = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
    const { wallet, seeds, keystore } = (await builder.withMnemonic(mnemonic).buildWithoutStarting()) as any;
    const zswapSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
    const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
    await wallet.start(zswapSecretKeys, dustSecretKey);

    logger.info(`[${label}] waiting for wallet sync...`);
    // Only unshielded (NIGHT, for fees) sync is waited on — none of this
    // project's scripts ever touch shielded/Zswap balances, and dust sync
    // specifically (wallet.dust.waitForSyncedState()) was empirically far
    // slower against Preprod than unshielded sync (which reliably
    // completes in under 2 seconds): even waiting on dust alongside
    // unshielded didn't complete within 3 minutes. Not investigated
    // further — out of scope for this deployment task; balancing a
    // transaction's fee reads whatever dust state is available at call
    // time regardless of this wait.
    await withTimeout("wallet sync", syncTimeoutMs, wallet.unshielded.waitForSyncedState());
    logger.info(`[${label}] wallet synced.`);
    return new DevnetWalletProvider(label, wallet, zswapSecretKeys, dustSecretKey, keystore);
  }
}

// contractFolder must match the specific contract's directory under
// contract/src/ — "quorum-core", "quorum-registry", or
// "consequence-claim-ledger" (each holds its own managed/ output directly,
// no extra nesting). Getting this wrong doesn't fail loudly at
// construction; it fails later with a ZKConfigurationReadError when the
// wrong contract's proving keys don't contain the circuit being called
// (found the hard way, once).
export function buildProviders(
  walletProvider: DevnetWalletProvider,
  accountId: string,
  contractFolder: string = "quorum-core",
  env: EnvironmentConfiguration = envConfig
) {
  const zkConfigProvider = new NodeZkConfigProvider(
    new URL(`../../contract/src/${contractFolder}/managed`, import.meta.url).pathname
  );
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `${contractFolder}-private-state-${accountId}`,
      signingKeyStoreName: `${contractFolder}-signing-keys-${accountId}`,
      privateStoragePasswordProvider: () => "SilentQuorum-RaceTest-2026!",
      accountId
    }),
    publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider
  } as any;
}
