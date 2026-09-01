# Build Log Addendum — House Amaranth: Scaffolding + First Mission (31 Aug 2026)

**Unattended pass.** Maxime: *"going to sleep start on 2"* — picking option 2 from the two offered right before he signed off: start on the parts of `Bloom_Wars_House_Amaranth_Full_Campaign_Plan_v1.md` that don't need the still-open naming/character decisions (room-set naming, the steward's identity, the supporting cast, save architecture, act/campaign titles — plan doc §9's "Still open" list). This addendum covers what actually got built while he was asleep, and flags every place a call had to be made without him there to ask.

## What shipped

Three new files, plus wiring into the shared lookup surfaces that already exist for exactly this purpose (same "resolve by id, don't add a mission-select tab" pattern `allCampaigns.ts`'s own header already documents for the archived Team One campaign):

- **`design/maps_house_amaranth.py`** — a third sibling to `maps.py`/`maps_amaranth.py`, same TILES table, same BFS-reachability `validate()`, same discipline ("a map only counts once it's run through the script and passed"). Contains one real hand-authored map, not 36 stubs.
- **`src/data/mapsHouseAmaranth.ts`** — `map_house_amaranth_first_harvest` (14×9, Mission 1's map), built through `data/maps.ts`'s own `makeMap()`/`deriveZones()` — the grid is transcribed verbatim from the validator's own output, never hand-edited.
- **`src/data/campaignHouseAmaranth.ts`** — `HOUSE_AMARANTH_PILOTS` (Marrow only), `HOUSE_AMARANTH_MEKS` (her mek), and `HOUSE_AMARANTH_MISSION_1` ("First Harvest"), a real, sim-tested, sim-passing mission.
- **Wired into `mapRegistry.ts` (`ALL_MAPS`), `pilotRegistry.ts` (`PILOT_INDEX`/`MEK_INDEX`), and `allCampaigns.ts` (`ALL_MISSIONS_BY_ID` only)** — additive spreads, nothing removed or reshaped. **Deliberately NOT added to `allCampaigns.ts`'s `CAMPAIGNS` array** — that's the array that actually puts a tab in front of a player on the mission-select screen, and one mission of a planned 36 isn't that yet. `npm run sim -- mission_house_amaranth_1` and `npm run sim:batch -- N mission_house_amaranth_1` both resolve and run correctly tonight; nothing changed for a player.

## Calls made without Maxime there to ask — flagged, not hidden

1. **Marrow's `PilotRecord`**: `archetypeId: "arch_tank_bipedal"` (human/bipedal — the unspecified-default read every other unspecified pilot in `campaignAmaranth.ts` gets, e.g. Rourke), `mekId: "mek_marrow"` with primary track **Armorer** (mirrors Bosk's own Tank-path track — "the mentor, holds the line" reasoning applies just as well to a career officer). `exemptFromPermadeath: true` — direct analogy to Rourke, on the strength of your own "the mc" / "1:1 mirror to Rourke" framing from the sign-off pass. None of this is sourced from the plan doc itself; all of it is a build-time call in the same spirit `campaignAmaranth.ts`'s own comments already make these calls for Warden Company's roster.
2. **No display callsign for Marrow** (just "Col. Ysolde Marrow") — every other named pilot in this project has one ("Lark," "Anvil," "Ledger"...), but nothing in the plan doc gives her one and inventing a nickname felt like exactly the kind of unilateral story content I got rightly called out for earlier tonight. Easy to add later.
3. **Mission 1 deploys Marrow alone**, not a "full lance." The plan doc's own §9 marks the supporting cast as still open — genuinely yours to write, not mine to invent placeholder squadmates for. The map still has 5 deploy pads (matching Warden's own "Muster"), so there's room to grow the squad the moment names exist; nothing about the map or the pipeline needs to change for that.
4. **The enemy wave count is 1 Crawlmass, not a "doubled" wave like Muster's own.** This wasn't a guess — I actually batch-simmed it. A solo `arch_tank_bipedal` (105 HP) against even 2 Crawlmass went 0/30 in `npm run sim:batch`; a Crawlmass's own `swarmSize` bracket in `bloom.ts` ([8,14]) is written for a full squad to wade into, not a solo duel. 1 Crawlmass batch-simmed 30/30, finishing turn 5 of a turnLimit-6 window — reads like the briefing's own "slow, stupid, easy" without being a free win. Full trace and batch numbers below.
5. **`rewardPoints: 50`** — half of Muster's 100, since this deploys one pilot instead of five and is explicitly the smaller of the two "Mission 1"s. A build-time guess, not sourced from anywhere.

## Verification actually run tonight (not just typecheck)

```
npm run typecheck   → clean
npm run lint         → clean (BW_RESERVED_TERM unset in this sandbox, spoiler lock
                        skips cleanly, same as every other pass this project)
npm test -- --run    → 56 files, 1184/1184 passing, zero regressions
npx tsx src/sim/run.ts mission_house_amaranth_1
                      → real playthrough, WIN on turn 5, Marrow at partial HP
npx tsx src/sim/runBatch.ts 30 mission_house_amaranth_1
                      → WIN=30/30 (100%), LOSS=0, COMMANDER_DOWN=0, TIMEOUT=0
```

The 3-Crawlmass and 2-Crawlmass versions I tried first both batch-simmed **0/30** (`COMMANDER_DOWN=30`) before I dropped to 1 — left in this doc rather than pretending the first draft was right, since that's the same "show the failed attempt, not just the fix" discipline this project's build log has followed all along.

## What this is NOT

Not the Bramble (no stat block, no `combat_sim.py` pass — that's the plan doc's own §8 step, and needs the lineage question's answer folded into real numbers, not just the AskUserQuestion confirmation). Not the Hub. Not missions 2-36 — no placeholder data was written for them; the plan doc's own §6 table is what future mission-authoring passes should build from directly, not anything invented here. Not wired into mission-select — a player starting the game tonight sees nothing different.

## Still open (unchanged from the plan doc's own §9)

Estate room-set naming, the steward/seneschal's identity, the supporting cast (names/callsigns/chassis for Marrow's lance), save/progress architecture confirmation, act/campaign titles. All genuinely yours to decide, not mine to guess further on tonight.

## One thing worth raising when you're back, not decided here

The Hub v1 content-volume answer from the sign-off pass — "full parity with Warden's current Hub" — is a big scope call (Warden's Hub took roughly a dozen separate build passes to reach its current depth, not one). I flagged it once before you went to sleep and didn't touch it again tonight; it's still just sitting there as a confirmed-but-unstarted decision, worth a real look together rather than either of us assuming what it means for the batch order in practice.
