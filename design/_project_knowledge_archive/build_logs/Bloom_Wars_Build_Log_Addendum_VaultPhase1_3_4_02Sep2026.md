# Bloom Wars — Build Log Addendum: The Vault, Phases 1 + 3 + 4 (2 Sep 2026)

*Follows `Bloom_Wars_Vault_Build_Plan_v1.md`. Built and committed the same day the plan was written, per Maxime's "start working, if you got question ask me popop."*

## What shipped

**Phase 1 — the counter.** The Vault plinth is real: walk to it (upper deck, same quadrant `HANGAR_SHOP_POINT` uses on the lower deck) and press E. The shortlist is on-screen for the first time — `currentShortlist()` rolls once when Act II opens and holds until a pick is made (Decision 1, locked in the plan), each candidate shown as a card (name, epithet, aristocrat, house, one-line hook, price), clickable when affordable, greyed when not. Recruiting calls the real `recruitHeirloom()` and shows its refusal sentence verbatim on failure — nothing hand-rolled.

**Phase 3 — the wall.** Everything the grievance system has been computing since this morning's House Standing pass is now visible: what the company currently holds and who's carrying it, what's been taken back and why (the house's own verdict clause), and — in red — any house that's gone estranged. This was the actual argument for building Phase 3 before Phase 2: a whole system with "full teeth" that nobody could see.

**Phase 4 — the dedication.** Mission 12's Vault scene, the one Antfarm Carrier Hub §8 calls "load-bearing, not skippable." Two new engine pieces: `acquireAberration()` (Gjallar's only door — no company points, no shortlist, no budget pick, since it was never a house's to offer), and `resolveVaultDedication()`, a one-shot check wired alongside `checkMekRetirement`/`checkHeirloomRecall` in `create()`. It reads who actually fell at Mission 12 specifically (via `lostContext.missionId`, not just "who's currently dead"), prefers Bosk if he's among the fallen, otherwise substitutes by the locked closest-bond rule, and hands Gjallar to Rourke. Delivery is **guaranteed, not probabilistic** — this deliberately does NOT go through `hotTopics` (the ~60%-chance ambient-gossip system every other one-shot check uses): the scene renders directly in the Vault overlay every time it's opened, so it can't be missed. Three hand-authored variants (Bosk fell / someone else fell / nobody fell), matching the locked "named slots, not procedural" rule for this one scene specifically.

**One interpretive call made without you, flagged rather than buried:** the plan didn't pin down what happens if literally nobody falls at Mission 12. I read the campaign's own "xcom purist, no plot armor" line as the tiebreaker — no death, no transfer, Gjallar stays with Bosk (uncased, unclaimed this campaign) rather than the beat firing regardless of casualties. Cheap to flip if that's not the read you wanted; it's one `if` in `resolveVaultDedication`.

**Explicitly not touched: Phase 2 (the shelf).** Fielding and ability-rank purchases stay out for the reason the plan gave — the ~30 Heirloom combat abilities don't fire in combat yet, so a shop for them would read as broken rather than finished.

## Two real bugs caught building this, both fixed before shipping

1. **`heirloomPicksRemaining()` and `recruitHeirloom()` both counted Gjallar against the 3-house recruit budget and price ladder.** Both read `hs.recruited.length` raw, and `acquireAberration` writes into that same list — so acquiring Gjallar silently ate one of the three house picks and bumped the next real recruit up a price rung, directly contradicting `acquireAberration`'s own doc comment ("no pick spent against HEIRLOOM_RECRUIT_BUDGET"). Caught by the acquireAberration tests, fixed with a shared `properRecruitedCount()` helper that both functions now use, and covered by a dedicated regression test (`"does not eat a house pick or bump the price ladder"`).
2. **A pre-existing test asserted a freshly recruited aristocrat's `personalPoints` was 0** — stale the moment `ARISTOCRAT_SIGNING_POOL` shipped this morning. Updated to assert the signing pool instead, with the reasoning in the comment.

## Verification

`npx tsc --noEmit`, `npx eslint src/` (full repo, not just touched files), `npx vitest run` — **71 files, 1560/1560 passing** (1543 baseline + 17 new: `currentShortlist`, `acquireAberration`, `resolveVaultDedication`, and the budget/price regression test), `npm run build`, and a `npm run sim` smoke run (unrelated Team One scenario, confirms nothing crashed — no balance or map files were touched this pass, so this was a sanity check, not a real coverage claim).

Hub.ts itself has no automated coverage (Phaser scene, matches this project's own standing limitation) — the plinth, prompt, overlay, and shortlist/wall/dedication rendering are code-reviewed and type-checked but not run in a browser this pass. Worth an actual playthrough before calling Phase 1/3/4 truly done.

## Docs

`ROOM_NOTES.vault` updated in-code (used to say "nothing built yet," now points at the plinth). `Bloom_Wars_Master_Index.md` needs a pointer to this doc and to `Vault_Build_Plan_v1.md`'s own decision log — not edited here per the standing "don't touch that file without being asked" practice.

**Still open, unchanged from the plan, not touched this pass:** `TIERS.S` never run through `combat_sim.py`; `BW_RESERVED_TERM` still unset in `.env.local` (the spoiler lint gate is still vacuous — this pass added a lot of new player-facing strings, house names and aristocrat names included, so this is worth doing soon); whether the salvaged-Heirloom / Runic Integration Line design still exists.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
