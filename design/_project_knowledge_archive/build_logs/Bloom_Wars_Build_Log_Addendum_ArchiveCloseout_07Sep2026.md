# Build Log Addendum — codex rework closeout (7 Sep 2026)

**Status: shipped to `F:\The Bloom wars. Code project`. The rework is done.**

Steps 3 and 4. Four things, all of them things earlier passes had promised.

## 1. The CO and the Meks now remember you (Q8)

`CampaignState.npcSocialStates` — a side table for Hub NPCs with no roster entry.

The bug it fixes was real and completely silent. The ship's CO and every Mek have no `CampaignPilotEntry`, so `ensureHubSocialState` hit its "fail open" branch and handed back **a fresh throwaway object on every call**. `Hub.ts`'s `persistNpcSocial` mutated that object and called `saveCampaignState`. The save succeeded. The change went nowhere. Every drink with the CO, every point of favorability with a Mek, gone on reload — no error, no warning, nothing in the log.

Same optional/lazy shape as `npcSocial`: absent on every save written before today, created on first write, no migration. `ensureHubSocialState`'s doc comment, which described the old broken behaviour as if it were fine, is rewritten.

Five tests in `engine/__tests__/npcSocialPersistence.test.ts`, including the one that actually matters: **a second call returns the same object, not a new one.**

## 2. The Field Manual now describes this game (Q13)

Data rewrite in `scenes/Codex.ts` — `OBJECTIVES`, `ABILITIES`, `ROSTER`, `MISSIONS`, `TERRAIN` and six `SECTIONS` deks.

| Fixed | Was | Now |
|---|---|---|
| Objectives | 3 types | **7**, each with whether the clock can kill you |
| `protect_asset` | undocumented | says in capitals that it bleeds per hostile **ending its turn** in the perimeter, not per hostile that attacks |
| `contested_landing` | undocumented | named as mechanically `eliminate_all`, so it stops reading as an unknown fail state |
| Terrain | 13 tiles | **14** — Dock perimeter added, with its real 2 defence stars |
| Sensor Sweep | "isn't wired up, treat it as flavour" | a real burrow-detection edge, Runemaster Meks extend it |
| Mek tracks | 3 | **5** — Fabricator and Quartermaster were missing |
| Sec. 08 | five hard-coded Warden pilots | **Paths, Chassis and Mek Tracks** |
| Sec. 09 | four demo missions | **Reading a Briefing** |
| Sec. 14 dek | "rank is paper only" | names the two things `rourkeRank` actually gates |
| Sec. 06 dek | "added during Maxime's own playtesting" | player-facing wording |

**Two renderers had to change with the content, and that is worth noting as its own lesson.** `renderObjectives` drew three cards across one row because there were exactly three objectives; seven would have run off the panel. `renderRoster` was a five-column table sized for short pilot cells and the new rows are system explanations. Both now use `renderAbilities`' proven 2×2 / stacked-card layouts. *Content that outgrows its renderer is a layout bug waiting for the day someone adds the fourth item.*

## 3. Verinis is a Cat (Q12)

`facilityHouseAmaranth.ts`, `catalyst: "shark"` → `"cat"`. The shark was a flagged placeholder from 4 Sep and it was mine, not the material's.

Two independent lines land on cat: the gauntlet derivation (Aerius / Terrace Farmstead / Conservatory → Frontier × Forged → Spider → Cat), and 63 shipped voice lines with no ambition anywhere in them — he is not climbing, he is holding ground that is already his.

Checked before writing it into a comment: `CATALYST_CLASH_PAIRS` puts cat against **wolf** and **dog**; shark was against **wolf** and **rabbit**. Meir is wolf (`npcSeedHouseAmaranth.ts:40`), so the friction the character was built for survives the change. Orin is rabbit and no longer clashes.

## 4. The Codex is HOW TO PLAY now (Q3)

Both buttons renamed — `MenuOverlay.ts` (pause menu) and `MainMenu.ts`. The six lore sections (Personnel, Bestiary, World, Systems, Ranks, Glossary) are gone from `SECTIONS`; they live at the Archive console. Nine manual sections remain, all `needsSave: false`, so HOW TO PLAY works with no campaign loaded. Header reads *"OUT-OF-FICTION HELP — LORE LIVES AT THE ARCHIVE."*

**The six render methods are left standing, unreachable, with a comment saying so.** Deleting ~200 lines of working code at the end of a long session, for tidiness, with no test covering the deletion and no user-visible benefit, is how a green build stops being green. They cost nothing at runtime and about 6KB in the bundle. Follow-up: delete them and their `data/codex.ts` imports as their own small change, with the suite run around it.

## Gate

**Typecheck clean · eslint clean · cast-collision lint clean · 104 files / 2558 tests passing · `vite build` succeeds.**

Headless run: HOW TO PLAY opens with exactly nine sections, all rewritten pages render inside their panels, zero console errors beyond the portrait assets missing from this sandbox's copy of `public/`.

**`lint-spoiler.mjs` still skips here** — `BW_RESERVED_TERM` lives in a git-ignored `.env.local`. Run `npm run lint` locally before shipping.

## What the rework shipped, end to end

- `data/archive.ts` — 140 entries, generated from the approved sandbox, pure data
- `engine/archiveDossier.ts` — the live block, derived from the save, nothing authored
- `scenes/Archive.ts` — three-pane reader, launch-and-pause, first scene in the game to work that way
- The console in both buildings, on furniture that was already in the room
- `npcSocialStates` so the CO and the Meks persist
- The Field Manual rewritten against the actual files
- Verinis resolved
- The Codex reduced to out-of-fiction help

**43 new tests across four files.** Six real bugs found and fixed along the way, three of them only findable by looking at the screen.

## Follow-ups, none blocking

- Delete the six unreachable render methods and their imports
- `data/codex.ts`'s `PERSONNEL` / `BESTIARY` / `WORLD` / `SYSTEMS` / `GLOSSARY` are now read by nothing but their own tests — retire with the above
- `hist_gladiator`'s optional Hiopi aside, "Warden Holdings" as a proper noun, the Osnian "bad omen" line, Bray's "Deadfall" colliding with Ichigeki's Deadfall Strike
- Slot 9 of the Verinis voice bank (Debrief / Campaign Shop callouts) still has no lines
- Arangement of Content has no bespoke voice bank at all
