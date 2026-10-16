// Serves the starter bot as a download, so a first upload needs no install.
//
//   ../examples/my_agent.py   the same file `papersseum new` writes (tests/test_library.py runs it)
//
// Writes (git-ignored): public/starter/my_agent.py. Copied byte for byte, so the download
// always matches the deployed site. Runs before dev/build.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");

export const STARTER_NAME = "my_agent.py";

export function syncStarter(repoRoot, { webDir = WEB } = {}) {
  const source = fs.readFileSync(path.join(repoRoot, "examples", STARTER_NAME));
  if (!source.includes("class Agent")) throw new Error(`starter: examples/${STARTER_NAME} has no class Agent`);
  const out = path.join(webDir, "public", "starter");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, STARTER_NAME), source);
  return { bytes: source.byteLength };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { bytes } = syncStarter(path.resolve(WEB, ".."));
  console.log(`starter: ${STARTER_NAME}, ${bytes} bytes`);
}
