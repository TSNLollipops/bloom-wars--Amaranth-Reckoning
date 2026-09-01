# Build Log Addendum — House Amaranth: Second Lance + Act II Retune (31 Aug 2026)

Maxime, mid-Mission-16-build: *"are act 2 mission setup for 10 mech. 2 lance."* Checked directly — no. Followed up: *"The player recruit their npc. So no need to name them. The 1st 5 is normal as you start with them. But look at how... look at warden side."*

## What this covers

Read `campaignAmaranth.ts` / `engine/campaignState.ts`'s own Second Lance system (`SECOND_LANCE_PILOTS`/`SECOND_LANCE_MEKS`/`ACT2_DEFAULT_SQUAD`, `integrateSecondLance`) as the precedent to mirror, per Maxime's own instruction, then built House Amaranth's equivalent and retuned every Act II mission that already existed (13-16) onto the resulting 10-pilot squad.

## Second Lance — data layer built, engine wiring deliberately deferred

**Built:** `HOUSE_AMARANTH_SECOND_LANCE_PILOTS` (5 newly-named pilots: Sgt. Rutger Kessler "Tallgrass" — Tank/human-bipedal; Cpl. Imara Vantana "Windbreak" — Meeps/osnius-vibrissal; Spec. Toma Reyken "Longshadow" — Reeps/hiopi-centauroid; Cpl. Adaeze Solano "Backfurrow" — Reeps/human-bipedal; Sgt. Ondine Marrin "Greenhand" — Munti/hiopi-centauroid), `HOUSE_AMARANTH_SECOND_LANCE_MEKS` (track assignments matching this campaign's own established discipline), `HOUSE_AMARANTH_SECOND_LANCE_ROSTER_IDS`, and `HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD` (the combined 10, same role as Warden's own `ACT2_DEFAULT_SQUAD`). Names hand-authored, not asked back to Maxime one at a time (per his own "no need to name them" — read as: don't gate this on another naming pass, not "leave them nameless") — checked against every existing `displayName` in `data/*.ts` first, no collisions. Path spread deliberately different from the first lance (Tank1/Meeps1/Reeps2/Munti1 vs. the first lance's Tank1/Meeps2/Reeps1/Munti1), same "the two lances aren't interchangeable" reasoning Warden's own comment gives — combined roster lands Tank2/Meeps3/Reeps3/Munti2, a second Munti so a squad can for the first time choose two healers or none.

**Real bug caught before it shipped:** used the plain names `SECOND_LANCE_PILOTS`/`SECOND_LANCE_MEKS`/`SECOND_LANCE_ROSTER_IDS` first, which collide with Warden's own exports of the same name in `data/pilotRegistry.ts` — a real correctness bug, not a style nit (the second import would have silently shadowed or conflicted with the first). Caught before running anything, renamed with the `HOUSE_AMARANTH_` prefix this file already uses everywhere else.

**Wired into `data/pilotRegistry.ts`** so `createPlayerUnit` can resolve the new pilot/mek ids at all — first sim attempt threw `Unknown pilot id: pilot_kessler` outright, confirming the registry is genuinely load-bearing (same gap Warden's own Second Lance comment already documents hitting).

**NOT wired into `engine/campaignState.ts`.** Checked directly: that file has zero House Amaranth awareness at all — no `integrateSecondLance`-equivalent function, no roster seeding, nothing. This isn't an oversight this pass introduced; `campaignHouseAmaranth.ts`'s own header already flags "deliberately NOT wired into CAMPAIGNS... plan doc §8 step 9, not this pass's" for the whole campaign. Building a `integrateHouseAmaranthSecondLance()` function now, with no `CampaignState` initialization path to call it from, would be genuinely disconnected dead code — unlike mission/map data, which the sim pipeline already consumes even unwired from the Hub. What DOES exist now (the pilot/mek data, resolvable by id) is exactly the same "resolvable but not yet offered in a picker" shape this file's whole header already sets. The actual runtime recruit mechanic Maxime described ("the player recruit their npc") — both this scripted Second Lance integration and the separate `generateRandomRescuedPilot`/`rescue_pilot` random-recruit system — lands together with the full campaign-state/Hub wiring pass, still correctly deferred.

## Act II retune — all four existing missions re-sim'd and rebalanced

`HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD` (10 pilots) replaces `HOUSE_AMARANTH_ROSTER_IDS` (5) as `playerPilotIds` on Missions 13-16 — mirrors Warden's own precedent exactly: `ACT2_DEFAULT_SQUAD` is a full 10-pilot deploy from Act II's own first mission on, not eased in gradually. Doubling squad size trivialized every one of the four missions' existing tuning outright (13/15/16 all re-sim'd at 100%, 14 at 96%) — each was retuned honestly, sim-first, with two genuine deterministic cliffs found and worked around rather than smoothed over. Full per-mission detail lives in each mission's own updated header comment in `campaignHouseAmaranth.ts`; summary:

- **Mission 13** (eliminate_all): 100% → doubled the fixed Gallcyst/Sporethrower emplacements, trimmed Crawlmass back to 6 → **90% (135/150)**, stable across two batches.
- **Mission 14** (extract_unit): 96% at the original comp → a genuine cliff at 5 Undertow (0/150, deterministic — the 5th burrowed surfacer's 1.5x strike reliably stacks lethal with whatever else is hitting that turn), backed off to 4 and moved the real lever to Crawlmass pacing (split into two waves) → **72-74% across two batches**, same turn-limit-race failure shape as the original.
- **Mission 15** (hold_zone): 100% at the original comp → a second genuine cliff (8 Sporethrower + 9 Crawlmass = 0/150 deterministic COMMANDER_DOWN, one more Crawlmass than the safe 8; splitting the Crawlmass into two waves neutralized the threat entirely instead of gradating it) → backed Sporethrower to its original 4 and added a NEW archetype (2 pairs of Undertow flanking the hold zone) rather than more of what was already there → **57-59% across two batches**, a real mix of LOSS and COMMANDER_DOWN.
- **Mission 16** (eliminate_all, hostile mechs): 100% at the original comp → doubled every merc count (89%, still soft) → bumped the turn-5 reinforcement specifically rather than the opener again → **57-59% across two batches**.

All four cliffs found this pass were confirmed with a second independent batch before being treated as real (not noise) and worked around by changing composition shape (new archetype, different wave split) rather than just picking a number that happened to land safely on one side of a wall that could shift under a future edit.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

Spot-checked Mission 1 (Act I, unaffected — still the 5-pilot roster) at 97% (58/60), matching its pre-existing tuning; Act I's own `playerPilotIds` were untouched by this pass.

## What's still not built

Act II, Missions 17-20 (all of which, going forward, should also deploy `HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD` from the start, not need a retune afterward). Act III, Missions 21-36. The full campaign-state/Hub wiring pass (the actual `integrateSecondLance`-equivalent function, the random-recruit mechanic, Debrief/TransporterPad wiring) — still correctly deferred, per this file's own standing status. The Missions 1-11 enemy-variety reform plan, still awaiting Maxime's go-ahead.
