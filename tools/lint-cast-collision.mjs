// tools/lint-cast-collision.mjs  — run in pretest, prebuild and pre-commit,
// alongside tools/lint-spoiler.mjs (a separate, unrelated check — see below)
//
// This is NOT the Build Brief's spoiler lock. That one guards a single,
// still-hidden reveal word for the book's own climactic twist, and it stays
// exactly as it is: blind to this repo, read from a git-ignored env var,
// untouched by this file. (13 Sep 2026: that word is also kept out of every
// comment in this repo, this file included — the spoiler lint is a plain
// regex and does not know a "permitted" mention from a leak.)
//
// This checks something different and much broader: whether a Bloom Wars
// name (an NPC, a pilot, an Heirloom, anything player-facing) accidentally
// collides with an EXISTING, ALREADY-NAMED character from the book series
// (public title: Enlightened). Full crossover (2 Sep 2026) made
// species/setting/structural borrowing the standing default, but a
// coincidental name collision is a continuity problem, not a spoiler one —
// the Master Index's own "I want both clearly not conflicting" condition
// survives full crossover untouched. If a reader ever holds both properties
// side by side, two unrelated characters sharing a name would read as an
// error, not a crossover.
//
// tools/reserved_cast.json is the reserved list. Since 13 Sep 2026 its
// canonical source is the book project's own naming/spoiler lock document
// (v1, 12 Sep 2026), which has priority on book facts; the JSON's own
// _comment says what was kept beyond it and why. The archived Team One/Two
// roster (data/meks.ts) is listed under "approvedCrossover" for the record
// and never flagged: hidden from the player on purpose, Maxime's call.
//
// Three match modes, each deliberately scoped to stay useful rather than
// noisy:
//   "full"    — two-word-or-longer names match only as the complete phrase,
//               case-insensitive. Never on a surname or given name alone.
//   "single"  — characters known by one distinctive name (Reqa, Zeteii,
//               Vrassik, Krethis, Jifsook, Lissrak, Vekk) and one-word
//               battle-clan names match as a whole word, case-insensitive.
//   "surname" — a family name from the book's two naming registers (the
//               lock doc's Part 3: the book keeps minting new characters
//               from these families, so blocking the family name catches a
//               character who has not been written yet). Whole word and
//               CASE-SENSITIVE, so a marsh tile or an ash cloud in prose
//               never trips "Marsh" or "Ashe". Surnames already carried by a
//               shipped game character (Okafor, Reyes, Osei, Voss), by the
//               archived Team One/Two roster, or by the game's own
//               vocabulary (Green, the rank stage) are NOT in this mode —
//               see "registerExemptions" in the JSON for each one's reason.
//
// A hit here is a real, unresolved question for a person, not something
// this script should ever "fix" by renaming a Bloom Wars NPC — that's
// exactly the kind of call the project's own rules reserve for Maxime. If a
// specific collision turns out to be fine (a deliberate future crossover,
// or a name he wants to keep despite the overlap), move it into
// "approvedCrossover" (a full name) or "registerExemptions" (a surname) in
// the JSON with a one-line note, the same way the existing entries are
// recorded.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "reserved_cast.json");
const { approvedCrossover, reserved } = JSON.parse(readFileSync(DATA_PATH, "utf8"));

function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CHECKS = reserved.map(({ name, match }) => ({
  name,
  rx:
    match === "single"
      ? new RegExp(`\\b${escapeRx(name)}\\b`, "i")
      : match === "surname"
        ? new RegExp(`\\b${escapeRx(name)}\\b`)
        : new RegExp(`\\b${name.split(/\s+/).map(escapeRx).join("\\s+")}\\b`, "i"),
}));

const ROOTS = ["src", "assets", "public", "index.html"].filter(existsSync);
const SKIP = new Set([
  // Images
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".bmp",
  // Fonts
  ".woff2", ".woff", ".ttf", ".otf", ".eot",
  // Audio — added 13 Sep 2026 after thrusterFire_003.ogg's compressed binary
  // data produced a coincidental byte run that decoded as "Osk" and tripped
  // the surname check at a fake "line 303". Binary audio has no player-facing
  // text in it; reading it as UTF-8 was always going to eventually spell
  // something by accident. Same reasoning extends to video/other binaries
  // below, none of which are known to be in the repo yet but all of which
  // would hit the same failure mode the first time one is added.
  ".ogg", ".mp3", ".wav", ".m4a", ".flac",
  // Video
  ".mp4", ".webm", ".mov",
  // Other binary blobs
  ".wasm", ".zip",
]);
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
    `Cast-collision lint: ${hits.length} hit(s) against the book's named roster ` +
      `(tools/reserved_cast.json). Each one is a real question, not a bug to ` +
      `autofix — either rename the Bloom Wars use, or record the exemption in the ` +
      `JSON ("approvedCrossover" for a full name, "registerExemptions" for a ` +
      `surname) with a one-line note if the overlap is fine.\n`
  );
  for (const h of hits) console.error(`  ${h.file}  —  "${h.name}"`);
  process.exit(1);
}

const surnames = reserved.filter((r) => r.match === "surname").length;
console.log(
  `Cast-collision lint: clean. (${reserved.length} reserved names, ${surnames} of them ` +
    `register surnames; ${approvedCrossover.length} approved crossover names exempted.)`
);
