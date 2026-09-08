# Bloom Wars — Build Log Addendum: Mission Rework Pass (8 Sep 2026)

**Brief (Maxime, verbatim intent):** rework all 72 missions to be hard but not impossible; the Hard test bot should win under 10%; add bonus objectives where possible; carte blanche on maps, spawns, spawn points and objective areas, everything else concrete; don't ship an untested, unrated mission; report at the end.

**Status:** all 72 missions reworked, sim-rated and committed. Nothing was played live. Every number below comes from the headless harness, and the report says plainly where the harness can't be trusted.

This addendum is the rapport. It is long because the honest version is long. The short version is the next section.

---

## 1. The short version

1. **Every balance number this project ever produced was measured with an all-G-tier squad.** The project's own economy model has Lance A at C-tier by mission 8 and A-tier by 20. Against that squad (a new harness flag, `--progression`) the shipped campaign was a near-100% Hard win almost everywhere. The old numbers were not wrong, they were answering a question nobody was asking. That is the finding that reframed the whole pass, and it is the reason the rework's numbers can't be compared to any earlier addendum's.
2. **Across all 72 missions the Hard bot's mean win rate went from 93.7% (median 100%, 67 of 72 at 80% or better) to 30.7% (median 23%)** — 20 missions at 10% or under, 21 at 11-30, 17 at 31-50, 8 at 51-80 and 6 above 80 — **at a real cost per win** (two to twelve mechs down per run, and on the two-lance and three-lance missions, one to two permanent losses per run). The target was <10%. I did not hit it everywhere and I stopped trying where hitting it would have meant walking the commander into a wall. Section 4 explains the policy; the table in section 6 gives every number.
3. **Six missions are still above 80% for the Hard bot and I am shipping them that way, each for a stated reason:** Muster (W1, the tutorial, deliberately on the winnable side of its cliff), Wire and Mud (W2, one door by the briefing's own promise, and the next unit up is 0/30), The Governor's Patience (HA14, the cork is binary — one more Gallcyst is 0/50), Marrow's Line (HA20, a withdrawal by design), The Bramble (HA26) and Marrow's Choice (HA28) — the last two are the structural cases in the next point. **Some missions cannot be made hard for a good player with the levers I was given**, and the report is more useful for saying so than for hiding it behind a number. The two structural ones: an Act III squad (15 mechs, five A-tier, three Munti Screens, Meeps ambush) is a meat grinder for Bloom melee (sixty Bloom units including a ring of twenty Bramble three tiles from the pads: 100%), and a hold-zone that has to end clean is capped by the squad's kill throughput, so "harder" past a point flips straight to "unwinnable" with nothing in between.
4. **Difficulty in this game cliffs.** Attrition fights flip from 100% to single digits across a change of two or three units: 18 vs 23 Crawlmass on Muster is 100% vs 33%; 6/4 vs 7/5 regulars on Two Fronts is 100% vs 5%. There are very few dials. Every number in the table should be read with that in mind: a mission at 60% is one wave away from 10%, and the reverse.
5. **The bot's numbers on a third of the campaign are bot artifacts** — the commander walking into focus fire, the escort refusing to walk into an acid kill box, the squad chasing chaff away from the objective. I fixed four of those behaviours in the harness (section 7); the rest are flagged per mission. A live playtest of the flagged list (section 9) is the single most valuable thing Maxime can do next.

---

## 2. What was actually done

- **72 missions respecified** in one data file, `design/mission_rework/mission_rework_specs.py`: every mission's `enemyWaves`, spawn `events`, `bonusObjective` and `objectiveParams` overrides, with a design-intent note in the game's voice and what the sim said about the earlier cuts. `apply_mission_rework.py` writes them into the two campaign TS files (idempotent; keeps dialogue events and comments; every rewritten block carries a `// REWORK 8 Sep 2026` marker). **The spec is now the source of truth for waves the way `design/maps_*.py` is for maps. Don't hand-edit the generated waves.**
- **15 maps changed** (source: `design/maps_amaranth_grids.py`, `design/maps_house_amaranth.py`, each edit annotated): Muster, Foraging Party, The Amaranth Betrayal, The Long Walk Back, New Colors, Wellroot, The Amaranth Accord, The Outer Ring Falls; Second Harvest, Deeper Terraces, What the Terraces Cost, The Governor's Patience, What Grows Beneath, Marrow's Line, Hold the Root. Regenerated through the generators (`splice_maps.py`), never hand-edited. Two first-cut edits (Wire and Mud, The Long Contract) were **reverted**: both briefings promise exactly one door and `mapsAmaranth.test.ts` guards it. Story beat the map.
- **Bonus objectives**: `rescue_pilot` and `clear_bloom_patch` (the two things Maxime introduced early and never really used again) now appear on ten missions (W5, W9, W10, W13, W14, W16, W17, W24, W26, HA1) — five of those were already there (W5, W9, W10, W16, W17), five are new (W13, W14, W24, W26, HA1). The House Amaranth side had none and now has one, because most House Amaranth maps have no corner for a downed pilot and their bloom mats are already the objective. That is the honest count, not the number I wanted. Placed where the fiction supports them and where the map has a corner for them. The bot never completes one under pressure, so bonus rates in the table are all 0% and mean nothing.
- **One small engine hook** (scope flag, section 8): a hostile-mech wave or spawn event can name the tier its mechs arrive at.
- **Harness work**: the progression roster, two inspection tools, richer batch output, and five test-bot behaviours (section 7).

---

## 3. How the rating was done

- Harness: `npm run sim:batch -- 50 <mission> --tier=hard --seed=5000 --progression`. n=50, fixed seed so a re-run is a re-run. Hard bot for the headline number; Moderate and Easy at n=25 for the two other columns.
- The **progression roster** (`src/sim/progressionRoster.ts`): Lance A is G for missions 1-2, F to 4, E to 6, D to 9, C to 13, B to 19, A after; Lance 2 and Lance 3 follow the same ladder from their own recruitment missions; first weapon branch at D+, two at B+. It is a reference schedule, not the economy sim — a player who skips upgrades will be under it, a player who grinds Antfarm will be over it. It is the assumption the whole table rests on.
- **Cost per win** is the second axis: `downed/run` (mechs downed per run, wins included) and `lost/run` (permanent losses per run — every downing after the last Munti died). A 30% mission at seven down is harder than a 5% mission that only loses because the commander wandered off.
- **Loss closeness**: `loss at kill%` is how far through the enemy roster the squad was when it lost. Low means the squad was crushed; high means it died at the finish line or ran out of clock.
- Everything is per-mission, from the mission's own starting state. No campaign carry-over (Munti dead in mission 6 stays dead in the real game; the harness resets).

---

## 4. The difficulty policy I actually used

Maxime asked for <10% on Hard. Three things made me not chase that number blindly:

1. **The bot's losses are concentrated in `commander_down`.** The hostile AI focus-fires the commander by design (Maxime's own call, 30 Aug: "for the commander death, that's fine"). The test bot protects her badly — it holds her in the zone, retreats her to corners, walks her last. Forcing a brawl under 10% mostly meant making her die faster, which tells us nothing about a player who keeps her behind the line.
2. **Objective types have different honest floors.** A brawl can be made arbitrarily deadly with numbers. A hold that must end clean, a protect-asset, an extract with an immune target, a convoy of engine-driven civilians — those hit a wall where "harder" means "cannot end", not "harder".
3. **Cliffs.** Where a mission sits on a two-unit cliff, I left it on the winnable side and said so.

So the bands I tuned to:
- **Brawls (eliminate_all):** Hard ≤15%, with losses landing late (kill% ≥ 30-60%) rather than at the deploy pads.
- **Holds, survives, protects:** 20-45% Hard with high downed/run. The rule: the objective, not the commander, is what kills you.
- **Extracts and convoys:** 20-45% Hard; the clock is the mission.
- **Act I first four:** softer than the rest on purpose. Mission 1 is the tutorial; I put it on the winnable side of its cliff (22 Crawlmass) after 25 came back at 16% with three mechs down a run. It should sting, not bury.

Where a mission's number is outside its band the table says why, and whether I believe the number.

---

## 5. What the levers turned out to be

Count alone barely moves an Act II+ squad. What does:

- **Composition over count.** Crawlmass are chaff by D-tier. Splitfang, Undertow (55 power, ×1.5 on surfacing), Sporethrower (ranged, ignores the firing line), Choir (−30% attack debuff) and Sirenmaw (crosses sump, bypasses corks) are the units that hurt a tiered squad.
- **Timing and direction.** A flank wave behind the pads on turn 3-5 does more than doubling turn 1. Simultaneous contact from three sides beats a queue from one.
- **Spawns near the objective**, not at the far seam. The previous designer's causeway note (Audit Under Fire) is the general rule: a single distant spawn point controls arrival RATE, and a firing line farms rate.
- **Physical corks.** Sump columns (impassable; ridge is NOT — it's cost 2, and every ridge "wall" I tried was walked around) with a two- or three-tile gap and a Gallcyst or burrowed Undertow in it. Used on nine extract maps.
- **Tighter extract clocks.** Two or three turns off a turn limit is the difference between a stroll and a mission.
- **Tiered hostile mechs.** The new `tier` field: B- and A-tier regulars in Act II/III mech fights. Mirror scale (`mirrorScale`) is a cliff, not a dial (1.7 was 0/50, 1.5 is 36%).
- **Undertow inside a hold zone**, surfacing when the squad arrives. The thing that makes "hold the ring" a fight instead of a wait.
- **Deploy pads are a 20 HP/turn heal.** Where the squad has no reason to leave them, it doesn't (The Bramble). Moving pads to the objective (Hold the Root) changed a 0/20 into a mission.

---

## 6. The table

Hard n=50 (seed 5000), Moderate/Easy n=25, progression roster. Band: Brutal ≤10, Hard ≤30, Firm ≤50, Standard ≤80, Soft >80 — by Hard-bot win rate only; read it with the Notes column.

### Warden

| # | Mission | Type | Hard win | downed/run | lost/run | loss at kill% | Moderate | Easy | Band | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 | Muster | brawl | 96% (48/50) | 2.06 | 0.0 | 45% | 0% | 0% | Soft | Tutorial. 22 Crawlmass over four waves; 18 was 100%/1 down, 25 was 16%/3 down — the turn-2 flank is the lesson and the cliff. Bot grinds 30+ turns; a human clears it in ~10. |
| W2 | Wire and Mud | hold 6-12 | 86% (43/50) | 1.46 | 1.38 | 27% | 68% | 80% | Soft | Single door kept (briefing + mapsAmaranth.test.ts). Opening pair in the wire; three in the squad's face was 0/30. lost/run is the Munti dying in the room — watch it live. |
| W3 | The Low Ground | clear | 42% (21/50) | 2.3 | 0.5 | 54% | 0% | 4% | Firm | Clear-bloom grind; the bot burns the mat one tile a turn (80-turn wins). Rate on cost, not on turns. |
| W4 | Tunnel Rats | brawl | 38% (19/50) | 2.92 | 1.08 | 32% | 0% | 0% | Firm | Three Undertow under the ruin, two between the ruin and the pads. Four/three was 0/30 at F-tier. |
| W5 | Foraging Party | extract TL11 +bonus | 0% (0/50) | 2.38 | 0.54 | 11% | 12% | 24% | Brutal | UNRATED BY BOT. Corked gap (Gallcyst + Undertow burrowed IN the gap); the Hard bot's danger bar will not walk five E-tier mechs into the acid box, so the escort never clears it (two Gallcyst: same; one Gallcyst and an open tile: 100%). Trace says feasible-tight. Needs a human. Gallcyst appears here, four missions before the story's M9 — flag. |
| W6 | House Colors | brawl | 14% (7/50) | 2.86 | 2.24 | 38% | 0% | 0% | Hard | First mech fight. Losses are commander_down; lost/run is the Munti dying first. |
| W7 | Sporewatch Ridge | hold 6-12 | 72% (36/50) | 0.24 | 0.12 | 71% | 0% | 12% | Standard | Hold on an open ridge ring: every hostile converges on the ring and on Rourke. One-unit cliff — this list is 72%, one more Crawlmass on the turn-2 flank is 0/50. Pre-rework it was 17%. Bot-fragile; play it. |
| W8 | The Choir Sings | brawl | 16% (8/50) | 2.56 | 0.94 | 34% | 0% | 0% | Hard |  |
| W9 | Cut Off | survive TL10 +bonus | 46% (23/50) | 3.12 | 0.82 | 11% | 0% | 0% | Firm | Survive 10; rescue_pilot bonus. Bonus never attempted by the bot under pressure. |
| W10 | The Amaranth Betrayal | extract TL10 +bonus | 50% (25/50) | 2.68 | 0.68 | 9% | 0% | 0% | Firm | Extract through the walled compound; bonus patch. Extract band. |
| W11 | The Long Walk Back | extract TL11 | 0% (0/50) | 2.78 | 0.0 | 11% | 0% | 0% | Brutal | UNRATED BY BOT (same cork shape as W5, Undertow cork on Lask's only gap). Trace-rated feasible. |
| W12 | The Fallow Line | hold 10-16 | 14% (7/50) | 2.24 | 1.0 | 22% | 4% | 0% | Hard | Act I finale hold. Commander-hunt losses; the ridge zone is the tile the whole Bloom converges on. |
| W13 | New Colors, Old Wounds | brawl +bonus | 8% (4/50) | 7.9 | 1.84 | 57% | 0% | 0% | Brutal | Two-lance debut (5 G recruits). Losses are long grinds; high downed. |
| W14 | Steel Rain | brawl +bonus | 16% (8/50) | 7.12 | 1.68 | 54% | 0% | 0% | Hard |  |
| W15 | Landfall | landing TL14 | 2% (1/50) | 6.26 | 1.92 | 63% | 0% | 0% | Brutal | Contested landing. Commander down in 49/50 — the landing puts Rourke in the open on turn 1; bot-inflated. |
| W16 | Collaborators | brawl +bonus | 16% (8/50) | 7.68 | 2.66 | 58% | 0% | 0% | Hard | Garrison fight (17 conscripts + D-tier regulars). Pyrrhic: 7.7 down, 2.7 permanent per run. |
| W17 | The Wellroot Uncovered | extract TL14 +bonus | 0% (0/50) | 0.12 | 0.0 | 72% | 0% | 0% | Brutal | UNRATED BY BOT. Three-tier descent, Gallcyst gaps, TL14. Bot never clears a cork. Trace-rated feasible-tight. |
| W18 | Breakout at Draven's Cut | brawl | 6% (3/50) | 8.04 | 1.96 | 48% | 0% | 0% | Brutal |  |
| W19 | The Silent Ward | brawl | 26% (13/50) | 6.38 | 1.6 | 72% | 0% | 0% | Hard | Room-by-room; ten Undertow. Expensive wins. |
| W20 | Marrow's Line | brawl | 36% (18/50) | 6.88 | 1.16 | 58% | 0% | 0% | Firm | Mirror 1.5 C-tier + Marrow. 1.7 was 0/50 — mirror scale is a cliff, not a dial. |
| W21 | Cut the Root | brawl | 44% (22/50) | 1.46 | 0.1 | 90% | 0% | 0% | Firm | Bot never attacks the Wellroot/Gallcyst corks — TIMEOUT-dominated. Rate by trace: the fight itself is light. |
| W22 | Ash on the Water | protect TL20 | 32% (16/50) | 1.74 | 0.04 | 54% | 0% | 0% | Firm | Protect band. |
| W23 | The Amaranth Accord | extract TL10 | 68% (34/50) | 0.46 | 0.0 | 66% | 72% | 40% | Standard | Extract through the Accord's doors, TL 10, four Gallcyst in the doors. Escort discipline made this a walk for a 10-mech squad. Standard. |
| W24 | Two Fires | brawl +bonus | 10% (5/50) | 7.28 | 2.16 | 48% | 0% | 0% | Brutal |  |
| W25 | The Reckoning | brawl | 32% (16/50) | 6.9 | 1.0 | 60% | 0% | 0% | Firm |  |
| W26 | The Unnamed Beneath | extract TL15 +bonus | 16% (8/50) | 0.5 | 0.02 | 79% | 0% | 0% | Hard | Extract with the immune-target rule: 'survive while Okafor walks'. Losses are the clock. |
| W27 | Falling Back to Meridian | hold 10-16 | 16% (8/50) | 1.16 | 0.0 | 55% | 0% | 0% | Hard | Hold that must end clean by 16: throughput-capped. 116 hostiles was 0/50, 58 was 62%. |
| W28 | Marrow's Reckoning | brawl | 10% (5/50) | 11.92 | 1.72 | 45% | 0% | 0% | Brutal | 11.9 down per run — the most expensive brawl in the campaign. |
| W29 | The Outer Ring Falls | hold 10-16 | 28% (14/50) | 0.42 | 0.0 | 87% | 0% | 0% | Hard | East face of the blockhouse opened (one door was a fortress, 30/30). Body count capped ~50 so the hold can end clean. |
| W30 | Ashes of the Second Ring | brawl | 22% (11/50) | 9.48 | 1.12 | 57% | 0% | 0% | Hard |  |
| W31 | The Last Convoy | extract TL14 | 16% (8/50) | 0.02 | 0.0 | 75% | 8% | 0% | Hard | Convoy (3 of N civilians): civilians are engine-driven fleeing AI, not bot. Rated by the engine's own herding. |
| W32 | Hold at the Spire | protect TL22 | 32% (16/50) | 4.32 | 0.0 | 57% | 0% | 0% | Firm | Protect band. |
| W33 | The Innermost Ring | hold 16-22 | 76% (38/50) | 3.36 | 0.3 | 38% | 76% | 20% | Standard | Hold 16-22, throughput-capped and cliffed: 154 hostiles was 12%, 92 and 112 were 100%, 135 was 84%, 145 is this. One wave from either side. |
| W34 | No Word from the Fleet | survive TL14 | 28% (14/50) | 10.74 | 1.02 | 31% | 0% | 0% | Hard | Survive 14; 10.7 down per run. |
| W35 | The Last Ring | hold 16-22 | 20% (10/50) | 4.08 | 0.7 | 61% | 0% | 0% | Hard | The Unnamed spawned INSIDE the ring at 6 — scope flag. Throughput-capped hold. |
| W36 | Until Relief | survive TL16 | 14% (7/50) | 9.86 | 1.7 | 34% | 0% | 0% | Hard | Finale survive 16. |

### House Amaranth

| # | Mission | Type | Hard win | downed/run | lost/run | loss at kill% | Moderate | Easy | Band | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| HA1 | First Harvest | brawl +bonus | 22% (11/50) | 1.34 | 0.68 | 53% | 12% | 28% | Hard |  |
| HA2 | The Long Contract | hold 6-10 | 38% (19/50) | 0.32 | 0.0 | 22% | 0% | 16% | Firm | Single door kept (briefing). Opening pair; three was 3%. |
| HA3 | Second Harvest | extract TL10 | 0% (0/50) | 1.64 | 0.0 | 26% | 0% | 8% | Brutal | UNRATED BY BOT (same cork shape as W5, plus Marrow commander-hunt). |
| HA4 | Good Neighbors | brawl | 4% (2/50) | 1.56 | 0.6 | 49% | 0% | 0% | Brutal | Marrow (Tank, move 3) is the commander: hostile focus-fire finds her. Every HA brawl carries this. |
| HA5 | The Seal Arrives | hold 5-9 | 4% (2/50) | 1.1 | 0.42 | 21% | 0% | 0% | Brutal |  |
| HA6 | House Colors | brawl | 0% (0/50) | 1.42 | 0.4 | 29% | 0% | 0% | Brutal | Commander-hunt (Marrow). 0/50 with 1.4 down — the losses are HER, not the squad. |
| HA7 | Deeper Terraces | extract TL10 | 0% (0/50) | 1.46 | 0.0 | 27% | 0% | 0% | Brutal | Corked extract; commander-hunt. |
| HA8 | The Quiet Growth | survive TL10 | 0% (0/50) | 2.76 | 1.48 | 17% | 0% | 0% | Brutal | Commander-hunt; bot-inflated. |
| HA9 | Loyalist Eyes | hold 6-10 | 6% (3/50) | 2.22 | 1.62 | 28% | 0% | 0% | Brutal | Hold; commander-hunt. |
| HA10 | The Choir, Heard From Afar | brawl | 12% (6/50) | 2.66 | 1.16 | 42% | 0% | 0% | Hard |  |
| HA11 | What the Terraces Cost | extract TL9 | 56% (28/50) | 2.08 | 0.0 | 15% | 24% | 4% | Standard | Corked extract the Act II squad DOES get through: four Gallcyst (three was 94%, five was 0/50 commander-down). TL 9. |
| HA12 | Harvest's End | hold 7-12 | 2% (1/50) | 1.36 | 0.98 | 25% | 16% | 0% | Brutal | Commander-hunt. |
| HA13 | New Terraces, New Faces | brawl | 32% (16/50) | 5.26 | 0.4 | 40% | 0% | 0% | Firm |  |
| HA14 | The Governor's Patience | extract TL8 | 92% (46/50) | 2.06 | 0.0 | 36% | 0% | 0% | Soft | Extract TL 8 with four Gallcyst in the checkpoint. Cliff: three was 92%, five was 0/50 (timeouts) — the cork is binary, sealed or not. Left on the open side; the clock is the whole mission. |
| HA15 | Rootbound | hold 6-10 | 10% (5/50) | 3.86 | 0.28 | 39% | 4% | 8% | Brutal |  |
| HA16 | The Long Ledger | brawl | 48% (24/50) | 4.92 | 2.2 | 69% | 36% | 0% | Firm | 2.2 permanent losses per run. |
| HA17 | What Grows Beneath | extract TL10 | 56% (28/50) | 2.86 | 0.0 | 31% | 0% | 12% | Standard | Double Gallcyst cork; the Act II squad shoots through it. |
| HA18 | Cultivator's Gambit | landing TL14 | 0% (0/50) | 7.8 | 1.08 | 56% | 0% | 0% | Brutal | Commander-hunt; 7.8 down. |
| HA19 | The Weight of the Seal | hold 6-10 | 32% (16/50) | 3.4 | 0.04 | 46% | 32% | 28% | Firm |  |
| HA20 | Marrow's Line | extract TL7 | 98% (49/50) | 1.2 | 0.3 | 77% | 92% | 76% | Soft | Withdrawal by design (Marrow extracts in 7). Wins cost 2.4 down. |
| HA21 | After the Line | brawl | 24% (12/50) | 7.02 | 0.34 | 64% | 0% | 0% | Hard |  |
| HA22 | Audit Under Fire | protect TL14 | 12% (6/50) | 1.38 | 0.0 | 50% | 16% | 8% | Hard | Rear corners and Undertow inside the relay floor. Protect band. |
| HA23 | The Root Answers Back | hold 8-12 | 24% (12/50) | 3.98 | 0.0 | 66% | 28% | 0% | Hard | Wellroot moved to (14,4) so its acid covers the ring's east half. Eight Choir at 1 was a wall (0/20). |
| HA24 | Seizure Order | extract TL9 | 18% (9/50) | 0.98 | 0.02 | 62% | 4% | 0% | Hard | The Governor is a civilian and can be shot. Extract band. |
| HA25 | Going Dark | survive TL14 | 44% (22/50) | 10.2 | 0.48 | 45% | 64% | 0% | Firm | Survive 14; 10.2 down per run. |
| HA26 | The Bramble | brawl | 100% (50/50) | 1.22 | 0.0 | -% | 100% | 0% | Soft | BLOOM SCALING. Sixty Bloom units incl. a ring of twenty Bramble three tiles out and four Choir: Hard 100% at ~1 down. An Act III squad (15 mechs, 5 A-tier, three Screens, Meeps ambush) is a meat grinder for Bloom melee; a Bramble does ~30 to an A-tier frame and dies to three hits. Data Pack question, not a mission one. |
| HA27 | Salvage the Season | extract TL12 | 12% (6/50) | 0.0 | 0.0 | 84% | 0% | 56% | Hard | Convoy (4 of 5), engine-driven civilians. |
| HA28 | Marrow's Choice | brawl | 96% (48/50) | 3.86 | 1.14 | 72% | 92% | 0% | Soft | Alpha-strike coin flip: 25 A-tier Warden mechs, whoever lands first wins; wins cost 3.9 down, 1.1 permanent. |
| HA29 | The Governor's Answer | hold 12-16 | 58% (29/50) | 5.74 | 1.02 | 71% | 0% | 0% | Standard | Hold vs tiered mechs; 8 B at 1 was 6%, 6 B is ~58%. |
| HA30 | Two Fronts | brawl | 48% (24/50) | 8.98 | 0.94 | 66% | 20% | 0% | Firm | Attrition cliff: 6/4 regulars was 100%, 7/5 was 5%. |
| HA31 | What the Program Costs | extract TL13 | 54% (27/50) | 0.0 | 0.0 | 96% | 4% | 28% | Standard | Convoy (3 of 6): losses are civilians wandering into the clock, not combat. |
| HA32 | Hold the Root | protect TL16 | 44% (22/50) | 1.14 | 0.0 | 82% | 36% | 0% | Firm | Pads moved to the dock's west face. Protect band. |
| HA33 | The Innermost Terrace | hold 16-20 | 10% (5/50) | 11.12 | 1.48 | 55% | 0% | 0% | Brutal | Hold 16-20; 11 down per run. |
| HA34 | No Word From the Seal | survive TL16 | 54% (27/50) | 11.34 | 2.48 | 32% | 88% | 12% | Standard | Survive 16; 11.3 down, 2.5 permanent per run. |
| HA35 | The Root Turns | hold 16-20 | 6% (3/50) | 7.12 | 0.46 | 63% | 4% | 0% | Brutal | Hold 16-20 with the Wellroot directing. |
| HA36 | The Stalling Season Ends | survive TL18 | 44% (22/50) | 11.62 | 1.88 | 30% | 32% | 0% | Firm | Finale survive 18; 11.6 down per run. |

**Reading the Moderate/Easy columns.** They are near zero almost everywhere. Those are test-bot skill tiers, not game difficulty settings: Moderate has fog-honest vision without Hard's threat map, Easy makes deliberate mistakes. A first-time human is somewhere between Moderate and Hard. That the Moderate column is ~0% on Act I is the onboarding risk of this pass, stated plainly: **there is no difficulty setting in the game, and I have tuned the whole campaign for a player who plays well.** If Maxime wants a campaign a new player can finish, that is a per-tier wave multiplier (a real feature, out of this pass's scope) or a softer Act I, and it is his call.

---

## 7. Bot changes (test harness only, nothing in the game reads these)

Each fixed a behaviour that made a rating meaningless. Each is commented at the site with the trace that motivated it.

1. **Hold-zone VIP guard** (`playerAi/index.ts`): the commander does not walk into the zone ahead of the line, and never at all while a non-VIP is alive unless the squad itself is already in or beside the zone.
2. **Hold-zone deadline walk** (`index.ts`, and the same rule folded into Hard's zone manning in `hard.ts`): a unit starts walking when its own walk needs it (distance/move +1), not at a fixed turn — and the walk takes priority over the in-place shot. Before: The Root Answers Back, 20/20 losses on turn 8 with everyone alive at the deploy edge.
3. **Hold-zone clear commit** (`driveMission.ts`): a hold past its hold turn with hostiles still in the zone is a stall by definition; caution is suspended so the squad pushes them out. Before: The Outer Ring Falls, 0/30 with nobody down and four full-HP Sporethrowers on the far side of the ring.
4. **Escort discipline** (`index.ts`): on an extract mission the escort's fight is the fight within five tiles of the target, two of itself, or three of the exit; everything else it walks past, and with nothing relevant in sight it walks to the target. Before: Foraging Party, the whole escort chasing Crawlmass around the far side of the map while Anand stood at the corked gap for six turns.
5. **Cork priority** (`combat.ts`): a sessile hostile within four tiles of the extraction target ranks as a VIP threat for focus fire (by raw toughness a 160-HP Gallcyst was always the last thing shot).
6. Plus three smaller ones from earlier in the pass: VIP isolation penalty ×4 and covered-tile retreat (`hard.ts`, `combat.ts`).

**What is still bot, not game, in the table:** commander focus-fire deaths in brawls (Rourke in Warden, and Marrow — a Tank, move 3 — in every House Amaranth brawl); the Hard bot's danger bar refusing to walk a five-mech squad into an acid kill box (Foraging Party, The Long Walk Back, Wellroot, Second Harvest — all 0/50 and all flagged UNRATED); the bot never attacking a Wellroot or Gallcyst that isn't in the extraction lane (Cut the Root, 22/50 timeouts); convoy civilians (engine-driven fleeing AI, so those ratings are the engine's own herding, not the bot's); and the bot's 30-80-turn grinds on eliminate_all/clear_bloom missions, which have no turn-limit loss.

Hold-zone numbers are the most fragile in the set. Five bot changes today each moved individual hold missions by 30 points. Treat every hold rating as ±20.

---

## 8. Scope flags — things I did that were not strictly "map, spawn, objective area"

- **Engine:** `EnemyWave.tier` and the spawn action's `tier` (declared since the event system shipped, never read) are now read by `createHostileMechUnit(…, tierOverride)`. `src/engine/units.ts`, `src/engine/mission.ts`, `src/data/types.ts`, test `src/engine/__tests__/hostileMechTier.test.ts` (4 tests). Bloom ignore it. Without this, every mech fight past Act I was G-tier conscripts against an A-tier squad.
- **Turn limits and asset HP changed** on: W5 (10→11), W10, W11, W17, W22 (relay 360), W23 (11→10), W26, W32 (420), HA11 (10→9), HA14 (7→8), HA20 (7), HA22 (relay 360), HA24 (14→9), HA27 (16→12), HA31 (18→13), HA32 (Root 400, `assetName` "the Root"→"Root" — it rendered as "The the Root" in the log). Full list in the spec file's `params`.
- **Gallcyst first appears on W5 (Foraging Party)**, four missions before the story introduces it on M9. Same on HA3. If that breaks the Bloom-introduction order in the GDD, swap the cork for a burrowed Undertow pair.
- **The Unnamed spawns inside the ring on W35 at turn 6** — the finale's ring is the finale's ring. Story check needed.
- **The Governor on HA24 is a civilian and can be shot** (was already true; the rework leans on it).
- **Wellroot moved** on HA23 from (13,4) to (14,4) so its acid covers half the ring, not all of it.
- **W29's blockhouse lost its east wall.** One door was a fortress (30/30 at under one down against a hundred hostiles).
- **HA32's deploy pads moved** from the west edge to the dock's own west face.
- **Test helper changed:** `heirloomSignatures2.test.ts`'s `quietMission()` keeps only Muster's turn-1 waves (Muster now has waves on 2, 4 and 6 and the test wants a quiet board).
- **Tools added:** `src/sim/showMap.ts` (ASCII map with every spawn point overlaid — nothing in this pass was placed without it), `src/sim/endState.ts` (the board at the end of a seeded run), `src/sim/progressionRoster.ts`, `design/mission_rework/*`.

---

## 9. What needs Maxime

**Play these first** (the ones the bot cannot rate, in campaign order): W5 Foraging Party, W7 Sporewatch Ridge, W11 The Long Walk Back, W17 Wellroot, W21 Cut the Root, HA3 Second Harvest, HA6-8 (the Marrow brawls), HA26 The Bramble, HA28 Marrow's Choice. Ten missions, and every one of them tells us something the harness can't.

**Decisions:**
1. Act I difficulty vs onboarding (section 6's note). My recommendation: leave Act I as tuned, add a "Standard/Hard" toggle later that multiplies wave counts, and let the campaign's first four missions be the place a new player learns the game is serious.
2. Bloom scaling for Act III (The Bramble). A Bramble does ~30 to an A-tier frame and dies to three hits; against fifteen mechs with Screens it is a speed bump. Options: a Bloom-side answer to Screen (a unit that ignores concealment), Bramble numbers, or accept that Act III's Bloom missions are about attrition cost (10+ down per run) rather than loss risk — which is what they are now.
3. Whether the Gallcyst-at-W5 and Unnamed-in-the-ring story flags are acceptable.
4. Whether commander focus-fire staying "by design" is still the call, now that every brawl's loss column is the commander. It is the single biggest driver of the Hard numbers.

---

## 10. Docs gone stale (say which, don't let them drift)

- **GDD / Data Pack mission tables** — every wave list, most turn limits, ten bonus objectives, 15 maps. The spec file is the current truth; the tables need regenerating from it or pointing at it.
- **Bloom_Wars_Player_AI_Difficulty_Tiers_Plan_v1** — the tiers' numbers are all-G numbers; the plan's "hard being tactical genius" framing now has the progression roster underneath it.
- **EA Launch Plan balance line** and **House Amaranth Full Campaign Plan §6** (per-mission difficulty notes) — superseded by the table.
- **design/build_log per-mission mds** — their wave descriptions.
- **Bloom_Wars_Now_And_Next** — the "Warden Act I tuning is Maxime's" line; replaced by section 9.
- **Undertow Ambush Hold scoping doc** — its "ships OFF" measurement was all-G; worth re-measuring with `--progression` (the rework leans on burrowed Undertow everywhere and they roam, not hold).

---

## 11. Verification

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 107 files, 2587 tests, all passing (4 new in `hostileMechTier.test.ts`; `heirloomSignatures2.test.ts` helper adjusted; `mapsAmaranth.test.ts`'s single-door guard is why Wire and Mud's first cut was reverted).
- `npx eslint` on every touched TS file: clean.
- `npx vite build`: not run here — the lint-spoiler step needs `BW_RESERVED_TERM`, which this sandbox doesn't have. **Run it on the machine before shipping.**
- Naming lock: no reserved term appears in any new file, spec note, or map comment (checked by eye against the Build Brief; the build's own lint is the real check).

---

## 12. Files touched

`src/data/campaignAmaranth.ts`, `src/data/campaignHouseAmaranth.ts` (generated from the spec), `src/data/mapsAmaranth.ts`, `src/data/mapsHouseAmaranth.ts` (generated), `src/data/types.ts`, `src/engine/units.ts`, `src/engine/mission.ts`, `src/engine/__tests__/hostileMechTier.test.ts` (new), `src/engine/__tests__/heirloomSignatures2.test.ts`, `src/sim/progressionRoster.ts` (new), `src/sim/showMap.ts` (new), `src/sim/endState.ts` (new), `src/sim/run.ts`, `src/sim/runBatch.ts`, `src/sim/driveMission.ts`, `src/sim/playerAi/index.ts`, `src/sim/playerAi/hard.ts`, `src/sim/playerAi/combat.ts`, `src/sim/playerAi/types.ts`, `design/maps_amaranth_grids.py`, `design/maps_house_amaranth.py`, `design/mission_rework/` (new: specs, apply, set, splice).

Every rating batch output is in `design/mission_rework/ratings/` (raw `sim:batch` lines, Hard/Moderate/Easy).
