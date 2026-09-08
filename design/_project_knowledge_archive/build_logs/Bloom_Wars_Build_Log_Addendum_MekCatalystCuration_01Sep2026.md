# Bloom Wars — Build Log Addendum: Mek Catalyst Curation (1 Sep 2026)

Follow-through on the Mek Scope Decision (`claude/Bloom_Wars_Build_Log_Addendum_MekScopeDecision_01Sep2026.md`), which itself needed a correction — recorded here in full since it changes what this pass actually was.

## The correction that came first

That doc's own "What this actually commits to" section claimed roughly 10–15 Mek NPCs still needed building from scratch — a walkable Hub spot, a bond to their pilot, a catalyst, and the retirement hookup — plus new per-pilot names. Before building anything against that claim, `src/scenes/Hub.ts` and `src/data/campaignAmaranth.ts` were read directly, per this project's standing rule to verify a specific claim against the current file rather than an existing plan's own framing.

The claim didn't hold up:

1. **Every one of the 15 pilots already has a real, named Mek record.** `campaignAmaranth.ts`'s `WARDEN_MEKS`, `SECOND_LANCE_MEKS`, and `THIRD_LANCE_MEKS` all use the "X's Mek" pattern (`mek_okafor: { displayName: "Okafor's Mek", ... }`, etc.) — the same convention Team One's own roster uses in `data/meks.ts`. Nothing to author.
2. **`Hub.ts`'s `buildNpcs()` already places a walkable HubNpc for every active pilot's Mek**, not just the first 5. A `mekSeeds` array (hand-placed position + catalyst) covers Rourke/Bosk/Iyari/Anand/Lask; a second loop right after it — added in the 30 Aug "Hub population driven by real roster" pass (Tier 3, `claude/Bloom_Wars_Consolidated_Build_Plan_Progress.md`) — builds the identical NPC (same room, same Matchset bond via `pairKey`/`MEK_MATCHSET_BOND`, same social state, same interactivity) for every other active pilot. The only real difference: auto-placed position (`pickInitialNpcSpot`) instead of a hand-picked one, and `catalystForPilot(mekId)` — a deterministic hash fallback (`src/data/npcSeed.ts`) — instead of a hand-picked catalyst.
3. **`checkMekRetirement()` already scans all 15 pilots**, not just the named 5 — this was already correct before the scope decision was made; its own in-code comment already says as much.

So the walkable/bonded/gossip-wired mechanism the scope decision asked for was already shipped for the full roster. The actual gap was narrow: 10 of the 15 Meks had no hand-picked catalyst, just the safe-but-arbitrary hash fallback.

## The change made

Added a small override lookup in `Hub.ts` so the other 10 Meks get curated catalysts too, without touching how they're built otherwise (position stays auto-placed via `pickInitialNpcSpot` — not worth risking a hand-picked layout for 10 more bodies in one room).

**Edit 1** — a `MEK_CATALYST_OVERRIDES: Record<string, Catalyst>` const, inserted right after the existing `mekSeeds` array (before the loop that consumes it):

```ts
const MEK_CATALYST_OVERRIDES: Record<string, Catalyst> = {
  mek_okafor: "bear",
  mek_solheim: "shark",
  mek_tarrant: "crow",
  mek_vashti: "rabbit",
  mek_reyes: "cat",
  mek_kova: "wolf",
  mek_ness: "bear",
  mek_onwuka: "crow",
  mek_delgado: "fox",
  mek_yeun: "rabbit",
};
```

Same "not tied to any MekTrack specialization, picked for voice variety" caveat as `mekSeeds`' own catalysts, plus a few deliberate echoes: both other Munti Meks (Vashti, Yeun) share "rabbit" with Lask's own, continuing a healer-adjacent thread; Okafor's Mek echoes Bosk's "bear" since Okafor's own pilot comment in `campaignAmaranth.ts` already calls his track a direct mirror of Bosk's; Tarrant's Mek echoes Iyari's "crow" the same way Tarrant's own pilot comment says he "gets Armorer like Iyari." Anyone not listed here (a future lance, a generated recruit) keeps the same safe hash fallback as before.

All 10 `mekId`s were confirmed to exist in `campaignAmaranth.ts` before writing the map, and all 10 catalyst words were confirmed against `npcSeed.ts`'s own fixed `ALL_CATALYSTS` vocabulary (`wolf/dog/cat/crow/raven/bear/fox/rabbit/shark`) before use.

**Edit 2** — the generic loop's Mek-building code now checks the override first:

```ts
ambient: { catalyst: MEK_CATALYST_OVERRIDES[mekId] ?? catalystForPilot(mekId), stage: "blooded", stress: mekSocial.stress, morale: mekSocial.morale, drunk: false, worried: isMissionWorrySignal(this.campaignState) },
```

No new names, no invented words — only already-shipped `mekId`s and words from the already-in-use catalyst vocabulary, so no naming-lock check was needed for this specific change.

## Verification

Both anchor strings were confirmed to match exactly once in `Hub.ts` before editing (checked via a fresh device re-stage of the file, not from memory of an earlier read this session). After editing, the full verification chain was run in the cloud sandbox against a fresh stage of the whole repo tree (`src/`, `tools/`, `public/`, and the root config files) plus the one edited `Hub.ts`:

- `npm install` — clean, 148 packages, 0 vulnerabilities.
- `npx tsc --noEmit` — clean, no errors.
- `npx eslint .` — clean, no errors.
- `node tools/lint-spoiler.mjs` — skipped the spoiler check itself (`BW_RESERVED_TERM` isn't set in the sandbox, same known cloud-sandbox gap as the Week 1 hardening pass), but this change touches no names or filenames, so nothing was actually at risk here.
- `npx vitest run` — clean: **58 test files, 1194 tests, all passed.**
- `npm run build` — clean (`tsc && vite build` succeeded; the only output was Vite's pre-existing "chunk larger than 500kB" advisory, unrelated to this change and present before it).

Hub.ts has no dedicated unit test suite of its own (Phaser-dependent, can't run outside a browser — noted in the file's own comments), so this clean typecheck/lint/full-suite/build is the real bar, same as every other Hub.ts change this project has shipped.

## Commit

Before committing, `Hub.ts`'s on-device mtime was re-checked and matched exactly what had been staged (`1788256304804`, size `373162` unchanged) — no concurrent edit, safe to commit straight through. Committed to `F:\The Bloom wars. Code project\bloom-wars\bloom-wars\src\scenes\Hub.ts` with `expectedMtimeMs` set from that check; the write succeeded with no rejection. Post-commit, the file on-device is 375,022 bytes (up from 373,162 — matches the size of the two edits above), new mtime confirmed.

## Bottom line

The Mek scope decision looked, on paper, like it needed a real content push — 10–15 new NPCs. It didn't: that work was already done on 30 Aug. The only real gap was cosmetic (curated vs. hashed catalyst voice), and it's closed now. See the corrected `claude/Bloom_Wars_Build_Log_Addendum_MekScopeDecision_01Sep2026.md` for the decision record with this correction folded in.

## Follow-up: checked the picks against Maxime's actual stated principle (1 Sep 2026, later same day)

Maxime clarified, verbatim, the principle the curated picks above were supposed to be serving: **"the mek are chosen for ease of familiarisation and friendlyness between pilot and mek."** That's a real design intent the first pass never explicitly checked its 10 picks against — it optimized for voice variety and a few deliberate character echoes (see above), not for pilot/Mek compatibility as such. So a dedicated check was run.

**Verification method.** Every Mek catalyst in the game — both the 5 original hand-placed `mekSeeds` entries (Rourke, Bosk, Iyari, Anand, Lask) and the 10 `MEK_CATALYST_OVERRIDES` entries added in this same doc's earlier pass — was checked against its own paired pilot's catalyst: the pilot's hand-seeded catalyst where one exists (only Bosk, Anand, and Iyari's pilots have one), or `catalystForPilot()`'s deterministic hash fallback (`src/data/npcSeed.ts`) otherwise, since that's the real catalyst value that pilot carries in-game whether or not it was ever hand-chosen. "Friendly" was defined concretely using the engine's own already-built `CATALYST_CLASH_PAIRS` list in `src/data/catalystProfile.ts` — the specific catalyst pairs the game itself treats as genuinely opposed (e.g. rabbit/shark: nurturing vs. ambition), which feed `findCatalystClash()` and stage a live disagreement beat between two NPCs in Hub dialogue when their catalysts clash. A pair not on that list reads as neutral-to-compatible; a pair on that list reads as friction, the opposite of what Maxime asked for.

**The one real conflict found and fixed.** `mek_solheim`'s catalyst was "shark." Its paired pilot, Cpl. Nadia Solheim ("Static"), has no hand-authored catalyst of her own, so she falls through to the hash fallback, which computes to "rabbit." Rabbit/shark is a defined `CATALYST_CLASH_PAIRS` entry — so this one pairing was set up to read as clashing, working against the stated principle. Fixed in `Hub.ts`: `mek_solheim` changed from `"shark"` to `"dog"`. Dog (loyalty) isn't on the clash list against rabbit, and reads as a warm, companionable pairing against a nurturing-read pilot — a good fit for the found-family tone the Mek system is already going for. The explanatory comment directly above `MEK_CATALYST_OVERRIDES` in `Hub.ts` was also extended with a short note recording this correction and the reasoning, so the "why dog" isn't only in this doc.

All 14 other pairings (9 remaining overrides plus the 5 original `mekSeeds` picks) were checked the same way and came back clean — no other clash-pair matches turned up. Full pairing-by-pairing detail isn't repeated here; it was verified directly this session by reading the source files fresh and running the actual hash algorithm, not estimated.

**Why the fix matters less than it might sound, and why it still mattered.** Every pilot/Mek pair shares a flat, hardcoded `MEK_MATCHSET_BOND = 75` starting bond, regardless of catalyst — well above `CLIQUE_THRESHOLD = 20`, so the numeric closeness between any pilot and their own Mek was never actually at risk from a catalyst mismatch. Catalyst choice doesn't feed into that bond number at all. What it does affect is tone: whether their live Hub dialogue reactions to each other play out as agreeing or as a staged clash. So the Solheim/shark pick wasn't a mechanical problem, but it was a real miss on the specific, human thing Maxime said he wanted from these pairings — worth fixing on its own terms.

**Open flag, not acted on.** Only 3 of the 15 named pilots (Bosk, Anand, Iyari — raven/wolf/crow respectively) have a real hand-authored catalyst of their own. Rourke, Lask, and all 10 Second/Third Lance pilots currently rely on the same anonymous hash fallback used for generated recruits — meaning most of these "friendliness" checks above are really checking a curated Mek catalyst against an arbitrary hashed pilot catalyst, not two deliberately paired choices. A future pass could hand-author real catalysts for all 15 named pilots and design each pilot/Mek catalyst pair together as a genuinely intentional match rather than one side checked against the other after the fact. That's new content-authoring for named characters (15 new deliberate personality choices), which is real scope growth — flagging it back rather than just doing it.

**Verification and commit.** Same fresh-device-restage discipline as the pass above: `Hub.ts` was re-staged fresh from the device (not trusted from any cached copy) before editing, the `MEK_CATALYST_OVERRIDES` block and the `mek_solheim: "shark",` line were confirmed present exactly as expected, then edited. The full toolchain was re-run clean against a fresh stage of the whole repo tree: `npm install` (148 packages, 0 vulnerabilities), `npx tsc --noEmit` (clean), `npx eslint .` (clean), `npx vitest run` (**58 test files, 1194 tests, all passed** — same count as the pass above), `npm run build` (clean, same pre-existing chunk-size advisory as before, unrelated to this change). Immediately before committing, `Hub.ts`'s on-device mtime was re-checked against the mtime it was staged at — unchanged, no concurrent edit — so the commit went through directly rather than needing a re-stage-and-redo. Committed to `F:\The Bloom wars. Code project\bloom-wars\bloom-wars\src\scenes\Hub.ts`.
