// Copies each contract's compiled Compact output (managed/) into the tsc
// dist/ mirror. tsc only transforms .ts sources under src/; the managed/
// directories are already-generated plain JS + declarations from the
// Compact compiler, so they just need to be copied alongside the compiled
// TS output for anything importing from dist/ (e.g. the web app) to
// resolve them. Purely a build-plumbing step — does not touch, regenerate,
// or reinterpret any contract output.
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const contracts = ["quorum-core", "quorum-registry", "consequence-claim-ledger"];

for (const name of contracts) {
  const src = path.join(root, "..", "src", name, "managed");
  const dest = path.join(root, "..", "dist", name, "managed");
  if (!existsSync(src)) {
    console.error(`missing ${src} — run "npm run compact" first`);
    process.exit(1);
  }
  cpSync(src, dest, { recursive: true });
  console.log(`copied ${name}/managed -> dist/${name}/managed`);
}
