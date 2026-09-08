# Build Log Addendum — Archive data layer shipped (7 Sep 2026)

**Status: written, gated, committed to `F:\The Bloom wars. Code project`. Nothing the player can see yet, on purpose.**

This is step 1 of the codex rework build. It lands the whole content layer and the live-dossier derivation without touching a single screen, so the game builds and plays exactly as it did this morning.

## Files

| File | State | What it is |
|---|---|---|
| `src/data/archive.ts` | **new**, 2600 lines | The schema and all 140 entries, generated from the approved sandbox (v1.14) rather than retyped. Pure data — imports only from sibling `data/` modules. |
| `src/engine/archiveDossier.ts` | **new** | The live half of a personnel dossier: rank, lance, frame, Mek, stress, morale, standing, relations, record, status. Reads `CampaignState`. Nothing here is authored per pilot. |
| `src/data/ambientLines.ts` | **modified**, one constant | `const PANIC_THRESHOLD = 25` → `export const MORALE_PANIC_THRESHOLD = 25`, so the morale band imports the engine's own number instead of copying it. |
| `src/data/__tests__/archive.test.ts` | **new** | 21 tests. |
| `src/engine/__tests__/archiveDossier.test.ts` | **new** | 14 tests. |

`src/data/codex.ts` and `scenes/Codex.ts` are **deliberately untouched**. The old Codex keeps working until `scenes/Archive.ts` replaces it.

## Gate

Baseline before the change: typecheck clean, 100 files / 2510 tests passing.
After: **typecheck clean, 102 files / 2545 tests passing, eslint clean, cast-collision lint clean, `vite build` succeeds.**

**One gate did NOT run and must be run on Maxime's machine.** `tools/lint-spoiler.mjs` skipped with *"BW_RESERVED_TERM not set (expected in a git-ignored .env.local)"*. That file is git-ignored and was never staged, so the reserved-term lock has not been checked against this content. `npm run lint` locally, before anything ships.

**Three files changed on the device after this working copy was staged** — `engine/ai.ts`, `engine/campaignEconomy.ts`, `engine/mission.ts`. None of the new code imports them, so there is no merge conflict, but the local suite ran against slightly older copies of those three. Re-run `npm test` locally to confirm.

## Two bugs the tests caught before the code shipped

1. **`facilityOf` read `campaignId` as a campaign identifier. It is a minted random id.** The first version returned "warden" for every save, including House Amaranth ones, which would have put the wrong company name on every House dossier's status line. Fixed by delegating to the existing `baseSceneKeyFor`, which already owns that question — so it can never drift.
2. **The loss line rendered `mission_9` instead of a mission name.** `PilotLossContext` stores `missionId`; the readable name lives on `PilotServiceRecord.permanentlyLost.missionName`. Now prefers the record and degrades gracefully.

## One design invariant the tests found and corrected

The first draft asserted that Glossary, Manual, Systems and Ranks are never gated. `system_requiem` **is** gated, deliberately — the ungated shipped version spoiled the Mission 12 transfer (plan doc §4 item 5). The real invariant is narrower and is now the one under test: **Glossary and Field Manual are never gated**, because those two are reachable with no save loaded and a locked row there is a dead end. Systems and Ranks may be gated. A second test pins `system_requiem` gated so the spoiler fix cannot be undone by accident.

## What the tests actually pin

Structure: no duplicate ids; every entry on a real section; no section empty on either console; exactly one body source per entry; no empty paragraph; revisions in ascending gate order; every gate inside 1–36.

Gating: null gates always open; numeric gates open on resolution; dual gates read each console's own number; a revisioned entry stays hidden until its first revision lands; the latest unlocked revision is what renders.

Bands: the stress band's top cut sits exactly on `STRESS_PANIC_THRESHOLD`, the morale band's bottom cut exactly on `MORALE_PANIC_THRESHOLD`, and `relationshipWord` agrees with `deriveRelationshipStage` at every boundary. These are the tests that stop the archive from ever describing a number differently from the system that acts on it.

Register: the player is "the Commander" / "the Colonel", never "you". No entry on the Glossary or Manual says *synker* except `gloss_synker` itself, which is the entry that teaches the word.

Live block: Rourke's rank follows `rourkeRank` and nobody else's name is touched; a departed pilot loses their mood lines and keeps their record; a recruit with no written file gets one intake sentence and never a fabricated bio; bond lines use the Hub's own `CLIQUE_THRESHOLD` / `RIVAL_THRESHOLD`; the struck group holds lost, reassigned and discharged alike.

## Next

Step 2 — `campaignState.ts` gains an `npcSocialStates` side table so the CO's and the Meks' social state survives a reload (plan doc §3b, approved as Q8).
Step 3 — `scenes/Archive.ts`, launch-and-pause, the two console points, CODEX buttons out and HOW TO PLAY in.
Step 4 — the Field Manual data edits (`ABILITIES` / `OBJECTIVES` / `ROSTER` / `MISSIONS` + `SECTIONS` deks) and `facilityHouseAmaranth.ts`'s Verinis catalyst, shark → cat.
