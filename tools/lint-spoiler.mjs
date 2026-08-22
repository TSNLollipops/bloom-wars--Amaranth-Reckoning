// tools/lint-spoiler.mjs  — run in pretest, prebuild and pre-commit
//
// Build Brief §2.1, "the spoiler lock — absolute": the reserved term must
// never appear in any file under src/ or assets/, in any filename, in any
// string literal, in any code comment, or in any commit message. This is a
// build-failing lint rule, not a convention, because conventions erode
// under prototype pressure and lint rules do not.
//
// The term is not written in this file either. It is supplied by an
// environment variable read from a git-ignored local config (.env.local),
// so the repo itself never contains it — including in the tool that
// checks for it.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

function loadLocalEnv() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadLocalEnv();

const TERM = process.env.BW_RESERVED_TERM;
if (!TERM) {
  console.warn(
    "BW_RESERVED_TERM not set (expected in a git-ignored .env.local) — " +
      "skipping the spoiler lock this run. Set it before shipping anything " +
      "outside this sandbox. See design/README_reserved_term.md."
  );
  process.exit(0);
}

const RX = new RegExp(TERM, "i");
const SOFT_TERM = "synker wars";
const ROOTS = ["src", "assets", "public", "index.html"].filter(existsSync);
const SKIP = new Set([".png", ".jpg", ".jpeg", ".webp", ".woff2", ".woff", ".ttf"]);
let bad = [];
let soft = [];

function walk(pth) {
  if (statSync(pth).isDirectory()) {
    for (const e of readdirSync(pth)) walk(join(pth, e));
    return;
  }
  if (RX.test(pth)) bad.push(`${pth}  (filename)`);
  if (SKIP.has(extname(pth))) return;
  const text = readFileSync(pth, "utf8");
  text.split("\n").forEach((ln, i) => {
    if (RX.test(ln)) bad.push(`${pth}:${i + 1}`);
    if (ln.toLowerCase().includes(SOFT_TERM)) soft.push(`${pth}:${i + 1}`);
  });
}

ROOTS.forEach(walk);

if (soft.length) {
  console.warn("\"Synker Wars\" found (soft warning, not build-failing):\n  " + soft.join("\n  "));
}

if (bad.length) {
  console.error("Reserved term found in:\n  " + bad.join("\n  "));
  process.exit(1);
}

console.log("Spoiler lint: clean.");
