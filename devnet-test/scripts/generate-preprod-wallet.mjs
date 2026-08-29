// One-time helper: generates a fresh, real 24-word BIP39 mnemonic and
// writes it directly to devnet-test/.env.preprod (gitignored via the
// root .gitignore's .env.* pattern). Never prints the mnemonic itself —
// only confirms word count and validity — so it never lands in a
// terminal transcript or log.
import { generateMnemonic, validateMnemonic } from "bip39";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.preprod");

if (existsSync(envPath)) {
  console.log(".env.preprod already exists — refusing to overwrite an existing wallet.");
  process.exit(1);
}

const mnemonic = generateMnemonic(256); // 24 words
if (!validateMnemonic(mnemonic)) {
  console.error("generated mnemonic failed its own checksum validation — aborting");
  process.exit(1);
}

writeFileSync(envPath, `PREPROD_MNEMONIC="${mnemonic}"\n`, { mode: 0o600 });
console.log(`Wrote .env.preprod — ${mnemonic.split(" ").length} words, checksum valid.`);
