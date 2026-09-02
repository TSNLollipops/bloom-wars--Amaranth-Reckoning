// tools/lint-cast-collision.mjs  — run in pretest, prebuild and pre-commit,
// alongside tools/lint-spoiler.mjs (a separate, unrelated check — see below)
//
// This is NOT the Build Brief's spoiler lock. That one guards a single,
// still-hidden reveal word for the book's own climactic twist, and it stays
// exactly as it is: blind to this repo, read from a git-ignored env var,
// untouched by this file.
//
// This checks something different and much broader: whether a Bloom Wars
// name (an NPC, a pilot, an Heirloom, anything player-facing) accidentally
// collides with an EXISTING, ALREADY-NAMED Qiraki character. Full crossover
// (2 Sep 2026) made species/setting/structural borrowing the standing
// default, but a coincidental name collision is a continuity problem, not a
// spoiler one — the Master Index's own "I want both clearly not conflicting"
// condition survives full crossover untouched. If a reader ever holds both
// properties side by side, two unrelated characters sharing a name would
// read as an error, not a crossover.
//
// tools/qiraki_named_cast.json is the reserved list: every named Qiraki
// character (Qiraki_Character_Sheets_v5.md, Qiraki_Military_Era_Outline_v3.md)
// except the five already, deliberately ported as Bloom Wars' own archived
// Team One roster (Fracrals Thyns, Derek Barasj, Hiro Nagori, Yren
// Tourignie, Trav Calder) — those are listed under "approvedCrossover" for
// the record and are never flagged.
//
// Matching is deliberately conservative to keep this useful rather than
// noisy: two-word-or-longer names ("full") only match as the complete
// phrase, never on a surname or given name alone — several Qiraki surnames
// (Green, Marsh, Osei, Voss) are ordinary enough that matching them alone
// would flag unrelated Bloom Wars content constantly. Characters known by a
// single, distinctive name only ("single" — Reqa, Zeteii, Vrassik, Krethis,
// Jifsook, Lissrak, Vekk) match as a whole word, since they have no surname
// to pair with and are unusual enough that a coincidental hit is unlikely.
//
// A hit here is a real, unresolved question for a person, not something
// this script should ever "fix" by renaming a Bloom Wars NPC — that's
// exactly the kind of call the project's own rules reserve for Maxime. If a
// specific collision turns out to be fine (a deliberate future crossover,
// or a name he wants to keep despite the overlap), move it into
// "approvedCrossover" in the JSON with a one-line note, the same way the
// five Team One names are recorded there.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "qiraki_named_cast.json");
const { approvedCrossover, reserved } = JSON.parse(readFileSync(DATA_PATH, "utf8"));

function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CHECKS = reserved.map(({ name, match }) => ({
  name,
  rx:
    match === "single"
      ? new RegExp(`\\b${escapeRx(name)}\\b`, "i")
      : new RegExp(`\\b${name.split(/\s+/).map(escapeRx).join("\\s+")}\\b`, "i"),
}));

const ROOTS = ["src", "assets", "public", "index.html"].filter(existsSync);
const SKIP = new Set([".png", ".jpg", ".jpeg", ".webp", ".woff2", ".woff", ".ttf"]);
const hits = [];

function walk(pth) {
  if (statSync(pth).isDirectory()) {
    for (const e of readdirSync(pth)) walk(join(pth, e));
    return;
  }
  for (const c of CHECKS) {
    if (c.rx.test(pth)) hits.push({ file: `${pth}  (filename)`, name: c.name });
  }
  if (SKIP.has(extname(pth))) return;
  const text = readFileSync(pth, "utf8");
  text.split("\n").forEach((ln, i) => {
    for (const c of CHECKS) {
      if (c.rx.test(ln)) hits.push({ file: `${pth}:${i + 1}`, name: c.name });
    }
  });
}

ROOTS.forEach(walk);

if (hits.length) {
  console.error(
    `Cast-collision lint: ${hits.length} hit(s) against Qiraki's named roster ` +
      `(tools/qiraki_named_cast.json). Each one is a real question, not a bug to ` +
      `autofix — either rename the Bloom Wars use, or move the name into ` +
      `"approvedCrossover" with a one-line note if the overlap is fine.\n`
  );
  for (const h of hits) console.error(`  ${h.file}  —  "${h.name}"`);
  process.exit(1);
}

console.log(
  `Cast-collision lint: clean. (${reserved.length} reserved names, ` +
    `${approvedCrossover.length} approved crossover names exempted.)`
);
