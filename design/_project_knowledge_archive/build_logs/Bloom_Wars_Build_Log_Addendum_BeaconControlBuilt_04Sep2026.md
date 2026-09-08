# The Bloom Wars — Build Log Addendum: Beacon Control & Restock Room Built (4 Sep 2026)

*Maxime's instruction: "build in the beacon." — implementing the previously design-only Beacon Control mid-mission revive mechanic from `Bloom_Wars_Beacon_Restock_Economy_v1.md` (2 Sep 2026, "design only, nothing built" at time of writing). That doc is now updated to "built" with every open item resolved; this addendum is the build account — what got asked, what got found, what got written, and how it was verified.*

## Two design questions asked and answered before writing code

Two genuinely open items in the source doc needed a real decision before this could be built correctly, asked via AskUserQuestion rather than guessed:

1. **Does Beacon Control need a living Munti to work at all, or does it work regardless and Munti just makes it cheaper?** Answered: **discount only.** Beacon Control works with 0 Restock Room charges as long as a living Munti is on the field — the Munti presence fully waives that revive's charge cost (a full waiver, not a partial discount; the source doc never specified a percentage, so a full waiver was the cleanest way to make "reduced" concrete against an integer stockpile — easy to retune to a fractional discount later).
2. **Should Beacon Control (and Restock Room) require the Generator to be built first, or ship independent of it like Weapons Bay and Fabricator already do?** Answered, verbatim: *"Sadly we need it enforced. Its gotta be something plsyer chose to spend they company point on."* Enforced.

## A scope self-correction, caught before coding

My own initial scope-flag on the Generator question overstated the cost — I described it as requiring "a real Generator power-budget mechanic from scratch." Re-reading `Bloom_Wars_Beacon_Restock_Economy_v1.md` in full before writing any code (per this project's own standing rule to verify against the actual current file rather than memory) turned up that §6 had already specified the dependency as a simple "requires Generator built first" rule — the exact same pattern Forward Battery already has on Weapons Bay, not a new system. Flagged the correction to Maxime directly rather than quietly building the wrong-sized thing. The actual implementation is a straightforward construction-time gate in `Hub.ts`'s `handleBuildRequest()`, mirroring Forward Battery's existing `if (moduleId === "forwardBattery" && !builtBays.includes("weaponsBay"))` check.

**Worth flagging on its own:** this Generator dependency was already written down for Sensor Array (23 Aug), and later for Weapons Bay and Fabricator too — but none of those three ever got a real code check behind the documented rule. Beacon Control and Restock Room are the *first* of the four Generator-dependent bays where the dependency is actually enforced in code, not just documented intent. Deliberately not retrofitted onto the other three in this pass — that's a separate, pre-existing gap, named here so it doesn't get silently assumed closed.

## A real discovery: the "AI-difficulty tier" starting-stock table doesn't have anywhere to attach

The source doc's §7 starting-stock table (Easy 5/5, Moderate 2/2 placeholder, Hard 0/0) assumed reuse of "the existing Easy/Moderate/Hard system from the Player AI Difficulty Tiers build." Checked before building rather than assumed: that system lives exclusively in `src/sim/playerAi/` — the offline batch-simulator's bot, used for balance-testing via `runBatch.ts --tier=x` — with no player-facing equivalent. Read `CampaignSetup.ts` (the actual New Campaign screen) directly to confirm: it offers only Warden/House Amaranth side selection and an Ironman checkbox, nothing difficulty-shaped.

Flagged to Maxime as a real scope discovery rather than silently building an unplanned player-facing difficulty-selector UI to give the table something to attach to. Resolved with a flat default: every campaign starts with 2 crates / 2 charges (the Moderate placeholder row), via `BEACON_STARTING_CRATES`/`BEACON_STARTING_CHARGES` in `engine/campaignState.ts`, with a code comment marking the one hook point for a real difficulty selector if one is ever built. The Easy/Hard rows stay on record as intent, not implemented.

## One UX simplification, named explicitly rather than silently guessed

The source doc frames this as literally placing a beacon *tile*, which then pulls back whoever it covers within range. The shipped UI collapses this into a direct click on a downed ally (same interaction shape as every other revive-adjacent ability already in the game — Migawari's Last Word Signature/Last Rites) rather than a separate tile-placement step. The vision+movement range rule itself is preserved exactly as designed — `beaconTargetInRange()` checks the holder's live vision first, then a reachable-tiles pass for movement+adjacency — only the two-step "place a tile, then it pulls back whoever's near it" UX is simplified to one click on the target itself.

## What got built

**Engine (`engine/mission.ts`):** `Mission.beaconHolderId()` — recomputed live every call off deployed, living player units' `tier` field (highest wins; S-tier, Heirloom-granted, ranks above A; ties keep the first-found unit). `canPlaceBeacon(unitId)` — the full gate: must be the current holder, all three bays built (Beacon Control, Restock Room, Generator), a beacon placement remaining (of 3 per mission), a crate remaining, and either a charge remaining or a living Munti on the field, plus the usual actor/action checks. `getBeaconTargetsFrom(unitId)` — empty whenever `canPlaceBeacon` is false (same "ask the engine, never guess" contract every other ability follows), otherwise every downed-this-mission, not-permanently-lost ally within the holder's vision+movement range. `useBeaconControl(unitId, targetId)` — fully restores the target, decrements the beacon/crate/charge counters (charge skipped when a living Munti is present), logs the result, costs the holder one action, does not end their turn.

**Campaign economy (`engine/campaignEconomy.ts`):** `purchaseBeaconCrate`/`purchaseBeaconCharge` — 50 Company points each, 25 once the Fabricator bay is built. `applyBeaconStockConsumption` — writes the mission's ending crate/charge counts back onto `CampaignState` at Debrief. `applyBeaconReviveCosts` — 15% of that mission's Company-pool completion bonus (`computeMissionCompletionBonus().total`) per revive used, deducted at Debrief, clamped so it can never push points negative; correctly 0 on a loss since the completion bonus itself is entirely win-gated. Confirmed against the actual current earning-split code (not assumed) that "the mission's own point payout" means the Company-pool completion bonus, not the separate per-pilot Personal-earnings formula — resolving one of the source doc's own open questions by reading code rather than guessing.

**Campaign state (`engine/campaignState.ts`):** `beaconCrates`/`beaconCharges` fields on `CampaignState`, `BEACON_STARTING_CRATES`/`BEACON_STARTING_CHARGES` (both 2, see the difficulty-tier discovery above).

**Hub (`scenes/Hub.ts`):** the Generator-dependency gate in `handleBuildRequest()`.

**Battle (`scenes/Battle.ts`):** a `BEACON ×N` action-bar button (gated by `beaconHolderId()` rather than the usual `unit.abilities.includes(...)` check, since ownership is dynamic), target-tile highlighting, and legend text.

**Shop (`scenes/shop/ShopPanel.ts`):** a new `"beaconStock"` row — buy a crate, buy a charge, shows current stock and the Fabricator discount.

**Debrief (`scenes/Debrief.ts`):** wires `applyBeaconReviveCosts`/`applyBeaconStockConsumption` into the existing mission-end sequence, and folds the revive cost into the Company pool's net-change display line.

**Data (`data/combatTables.ts`):** `BEACON_MAX_PER_MISSION = 3`.

**Tests (`engine/__tests__/beaconControl.test.ts`, new, 41 tests):** built on the same house pattern as `lastWord.test.ts` (a real `Mission` from real campaign data, `pilot_lask` — the Warden roster's actual `arch_munti_bipedal` pilot — for the Munti-waiver tests). Covers `beaconHolderId()` (tier ranking, ties, S-tier, downed exclusion, no-holder case), the full `canPlaceBeacon()` gate list (each of the three bays individually, beacon/crate/charge stock, actions, holder-only, hostile exclusion), `getBeaconTargetsFrom()`'s downed/living/hostile/permadeath filtering plus the vision+movement range rule specifically (including a test that isolates vision as the actual binding constraint, distinct from movement reach — Rourke's real deployed vision/moveRange, boosted by her Runemaster mek, are 6/6, not the archetype base 4/6, confirmed by inspecting a real constructed unit rather than assumed from the archetype table), the full revive/consumption/Munti-waiver behavior of `useBeaconControl()` including the per-mission cap, and the campaign-economy functions (purchase cost/discount, stock write-back, revive-cost percentage/rounding/win-gating/clamping).

## Verification

`tsc --noEmit`: clean. `node tools/lint-spoiler.mjs`: clean (skipped as expected in this sandbox — no `BW_RESERVED_TERM` set). `node tools/lint-cast-collision.mjs`: clean. `npx eslint .`: clean. `npx vitest run`: **90 test files, 2116 tests, all passing** (2075 pre-existing + 41 new). `npx vite build`: succeeds, only the pre-existing unrelated chunk-size warning. A live `npx tsx src/sim/runBatch.ts 20 mission_amaranth_1 --tier=hard` sanity run completed cleanly earlier in this same session, numbers matching prior documented fingerprints — confirming the new mission-options fields (`beaconCratesRemaining`/`beaconChargesRemaining`, both defaulting to 0/inert when unset) don't disturb the existing sim harness or balance baseline.

## Docs updated this pass

- `Bloom_Wars_Beacon_Restock_Economy_v1.md` — marked built, §9's open items resolved in place.
- `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.2 — the Beacon Control ("Resupply Beacon") and Restock Room rows rewritten to point here instead of ending on an open question; §11.4's speculated Stress-link candidate flagged as superseded (it never materialized — the "after effect of a restock" turned out to mean Beacon Control's own crate/charge economy, not a Stress cost); a short addendum appended at the end of the doc.
- `claude_Bloom_Wars_Master_Index.md` — updated to list this as built (see that doc directly).

## What's still open, on purpose

Same items §9 of the source doc now lists as genuinely unresolved: the ambient-dialogue "pilot" vs. "Synker" terminology pass (a content question, untouched by this build), and general tuning — every point/percentage number here (the 15% revive tax, the 50/25 crate-charge costs, the flat 2/2 starting stock) is real, shipped code but not sim-validated against actual play data, same caveat this project already carries for every other unset economy number.
