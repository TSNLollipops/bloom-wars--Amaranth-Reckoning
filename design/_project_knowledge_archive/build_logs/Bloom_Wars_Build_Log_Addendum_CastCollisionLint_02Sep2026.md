# Bloom Wars — Build Log Addendum: Cast-Collision Lint (2 Sep 2026)

*Maxime, same day as the Vault ship and the naming-lock policy update: "remove the naming lock and replace it with, the name lock over the character list in the book. the naming lock was suposed to cover that. so instead of trying to find if it work, scrap and rework."*

## What this actually turned out to mean

The naming lock isn't one thing, it's two, and only one was live going into this conversation:

1. **The branding-separation half** ("The Synker Wars"/"Synker") — already repealed earlier the same day, per `Bloom_Wars_Naming_Lock_Policy_Update_2Sep2026.md`. Fair game everywhere now.
2. **The book's own true-name spoiler** — a single hidden term, checked by `tools/lint-spoiler.mjs` against a git-ignored `BW_RESERVED_TERM` env var this session has never been shown, on purpose. Maxime kept this one explicitly live in that same policy update, in writing: his own call to make, not something "old rule is stale" resolves by implication.

Given that, "scrap and rework" was ambiguous — asked directly which one he meant. **Answer: keep the hidden reveal-word lint exactly as it is, add a new, separate check that scans Bloom Wars material against Qiraki's actual named-character roster, so no game NPC/name can accidentally collide with an existing book character.** `tools/lint-spoiler.mjs` is untouched — confirmed by a post-commit device listing showing the identical byte size and mtime it had before this pass started.

This is a genuinely different kind of protection than the spoiler lock. It's not about a reveal landing early; it's about continuity — the Master Index's own standing condition, "I want both clearly not conflicting," survives full crossover untouched. Two unrelated characters in two different properties sharing an exact name is an error a reader would notice if they ever held both side by side, not a crossover.

## What shipped

**`tools/qiraki_named_cast.json`** (new) — the reserved list, built from `Qiraki_Character_Sheets_v5.md` and `Qiraki_Military_Era_Outline_v3.md`, the two source-of-truth cast documents. Two buckets:

- **`approvedCrossover`** (11 names) — already deliberately ported into Bloom Wars and exempt from the check. Team One (Fracrals Thyns, Derek Barasj, Hiro Nagori, Yren Tourignie, Trav Calder) per the Canon Pass's original direct port. Team Two + the two bench replacements (Bram Solvig, Frida Green, Trahsin Hyrs, Elodie Dufours, Naomi Castell, Suki Arnesen) per Canon Pass §H, Maxime's own invitation ("add population to the mech folder with as many as you want") — see "A real finding" below for why this bucket needed a same-pass correction.
- **`reserved`** (33 names) — everyone else named in the source docs who is NOT currently in Bloom Wars: Reqa, Zeteii, Coherence of Process, Yssa Calder, the academy cast (Vrassik, Lissrak, Jifsook, Bruvald Ashe, Krethis, Peregrine Thale, Alina Firemoss, Toma Ruiz, Denic Voss, Ilyen Pral, Corw Adeyemi-Tal, Talia Renn, Fenn Okafor, Petra Lindqvist, Doyle Marsh, Sana Voight, Soren Adair, Mikka Reyes), staff (Dana Halvorsen, Cassia Vantree, Amara Osei, Devrin Osk, Aurelian Kest, Milo Castellane), and the academy-cast meks (Perrin Cato, Faela Bren, Reya Solt, Denna Ashworth, Vekk) — all deliberately excluded from the earlier crossover per Canon Pass §H's own scoping note ("deliberately excluding the academy-era cast... since GDD §1 locks the game as 'entirely military era, no academy content'").

**`tools/lint-cast-collision.mjs`** (new) — walks the same roots `lint-spoiler.mjs` already walks (`src`, `assets`, `public`, `index.html`), checking filenames and file contents against the reserved list. Matching is deliberately conservative: a two-word-or-longer name only matches as the complete phrase (never a surname or given name alone — Green, Marsh, Osei, Voss are all ordinary enough that matching them alone would flag unrelated content constantly), while a character known by one distinctive name only (Reqa, Zeteii, Vrassik, Krethis, Jifsook, Lissrak, Vekk) matches as a whole word. A hit is reported, never auto-fixed — the script's own output tells you to either rename the Bloom Wars use or move the name into `approvedCrossover` with a one-line note, the same way the 11 already there are recorded.

**`package.json`** — the new check is wired into `lint`, `pretest`, and `prebuild`, alongside (not replacing) `lint-spoiler.mjs`. Both run every time; either one failing fails the build, same discipline as the original lock.

## A real finding, caught and resolved before shipping

First run against the live repo (`src/data/meks.ts`) flagged 6 hits: Bram Solvig, Frida Green, Trahsin Hyrs, Elodie Dufours, Naomi Castell, Suki Arnesen — all in `ROSTER_DEPTH_PILOTS`. Checked against source before assuming either way, per this project's own standing rule: `Bloom_Wars_Canon_Pass_v1.md` §H confirms this is exactly the same kind of deliberate port as Team One, done at Maxime's own explicit invitation, and already has content written for it (`Bloom_Wars_Crew_Banter_Phrase_Bank_v1.md`'s own "Team Two & bench" section). Not a bug — a gap in this pass's own first-draft exemption list, since the Master Index's naming-lock section only ever named Team One explicitly. Fixed by moving all 6 into `approvedCrossover` with a citation. Re-ran clean.

Worth being direct about what this means: the tool did exactly its job on its very first run, and the "hit" it produced needed a human check against the actual source rather than either blind trust or a reflexive rename — same discipline as everywhere else in this project.

## Verification

**Self-test**, mirroring this project's own convention (`maps.py`'s throwaway-broken-input harness) — a temporary fixture with four cases: unrelated words that happen to contain a reserved name as a substring (`Vrassikans`, `Reqal`, `Denic Vosston` — correctly NOT flagged, confirming word-boundary matching works), a real single-token hit (`Vrassik`, correctly flagged), a real full-name hit with irregular whitespace (`Peregrine   Thale`, three spaces — initially NOT flagged, a real bug in the whitespace-normalization regex, found and fixed before shipping, then re-confirmed caught), and an approved-crossover name (`Trav Calder`, `Bram Solvig` — correctly NOT flagged). Fixture deleted after use, not part of the repo.

**Real-repo check, this pass:** staged and ran against every file most likely to carry a name — all of `src/data/*.ts` (40 files, including `campaignAmaranth.ts` and `campaignHouseAmaranth.ts` in full), all of `src/scenes/*.ts` including `Hub.ts`, and the name-adjacent `engine/` files (`heirlooms.ts`, `campaignState.ts`, `campaignEconomy.ts`, `houseStanding.ts`, `griefCatalyst.ts`, `socialSim.ts`, `missionSummary.ts`). Clean after the meks.ts correction above. **Not exhaustive** — the rest of `engine/`, `sim/`, and the test suite weren't scanned this pass (low-yield for character names, and this was a diligence check, not the ongoing enforcement). That distinction matters less going forward than it does today: the version now wired into `pretest`/`prebuild` walks the entire `src`/`assets`/`public`/`index.html` tree, same as `lint-spoiler.mjs`, on every real build and every real test run from here on — this pass's scoped check was a one-time sanity pass before wiring it in, not the limit of what it actually protects.

**Not run this pass:** `tsc --noEmit`, `eslint .`, the full vitest suite, or `npm run build` — this change touches no TypeScript, no engine logic, and no test surface (the two new files are plain Node ESM, same as `lint-spoiler.mjs` itself, which also has no dedicated test file in the suite). The only real risk was the lint script itself being wrong, which the self-test above targets directly.

**Committed:** `tools/lint-cast-collision.mjs` (new), `tools/qiraki_named_cast.json` (new), `package.json` (modified) — with a fresh mtime guard on `package.json` before writing (zero conflict) and a post-commit device listing confirming genuinely new sizes and mtimes on all three, `lint-spoiler.mjs` confirmed byte-identical and mtime-identical to before this pass.

## Honestly still open

- **`tools/lint-spoiler.mjs`'s own dead code, found but not touched.** Its `SOFT_TERM = "synker wars"` warning block is now pointless — that term was repealed as fair game earlier the same day — but the file was deliberately left exactly as it is, per Maxime's own choice this pass. Worth a one-line cleanup whenever he wants that file touched at all; not done here on purpose.
- **`BW_RESERVED_TERM` is still unset in `.env.local`** — flagged again in the Vault plan and its own build addendum, unrelated to this pass, still real: the spoiler lint has been passing vacuously in every recent build.
- **Doc-only scope.** This check covers the actual shipping repo (`src`/`assets`/`public`/`index.html`), same as `lint-spoiler.mjs` — it does NOT cover the GDD/Data Pack/Build Brief/Canon Pass `.docx` files, which this session still can't write to directly, or the ~250 other Bloom Wars planning docs in the Projects tool. A name could still land in a planning doc's prose without tripping this.
- **`Bloom_Wars_Master_Index.md`'s "Naming lock" section doesn't mention this yet** — same standing practice as the Naming Lock Policy Update doc itself, left for a routine sync pass rather than a same-day edit to that ~30,000-word file.
- **The reserved list is a snapshot, 2 Sep 2026.** Any new named Qiraki character added later needs a matching entry here, or this check quietly stops covering them. Worth a standing habit: whenever a new character gets locked in `Qiraki_Character_Sheets_v5.md` or a future outline, check whether they belong in `tools/qiraki_named_cast.json` too.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
