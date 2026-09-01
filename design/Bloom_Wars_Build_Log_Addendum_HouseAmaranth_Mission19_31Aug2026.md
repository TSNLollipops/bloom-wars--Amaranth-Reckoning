# Build Log Addendum — House Amaranth: Mission 19, "The Weight of the Seal" (31 Aug 2026)

Maxime, continuing off Mission 18: *"u can keep going."*

## What shipped

Mission 19, "The Weight of the Seal" — plan doc §6's own pitch: "Halcyon Amaranth herself visits the front for the first time; Marrow holds a real fight while explaining, live, why the numbers still work." `hold_zone`, new map (`map_house_amaranth_the_weight_of_the_seal`, 22×11), new `CampaignMission` (`mission_house_amaranth_19`).

**Halcyon Amaranth's first in-person appearance anywhere in this campaign.** Every prior reference to her was off-screen — Mission 5 "The Seal Arrives" was her seal-holder proxy on a controlled muster ground, Mission 9 "Loyalist Eyes" a hostile auditor on a managed tour. This mission puts Halcyon herself on an actual forward overlook watching a real fight break out around her, not a rehearsed one.

**A compact 3×4 hold block (12 tiles) flanked by ridge north and south**, deploy hugging the west edge (8 pads). Gallcyst as one of the two primary threats for the first time in a hold_zone mission this campaign — paired with Splitfang for fast harassment from above and below. Gallcyst was paired with Sporethrower in Mission 13; this is a fresh combination.

## A real placement bug, not just a difficulty number

First attempt dug Gallcyst in past the hold block's own **east** edge (col 17, block at cols 11-14). Sim: **100% (150/150)**, even at 7 Gallcyst + 8 Splitfang — suspiciously easy. Traced a verbose run and found Gallcyst never fired a single shot the entire mission. `hold_zone` only requires **one** hold tile occupied (`engine/mission.ts`'s own win check), so the squad always claims the tile nearest deploy — col 11 — six tiles from a col-17 Gallcyst and outside its own `attackRange [1,3]` every run. A stationary archetype makes its own placement a real correctness question, not flavor: moved it to the block's **west** flank (col 9, two tiles from the near hold edge), in range regardless of which tile the squad claims first.

## Sim-tuning journey — a second cliff, on the difficulty side this time

```
7 Gallcyst + 8 Splitfang (west flank, corrected placement) → 0% (0/150), LOSS=10, COMMANDER_DOWN=140
3 Gallcyst + 4 Splitfang → 100%
5 Gallcyst + 6 Splitfang → 31% (46/150) — right on the floor itself, too close to risk
4 Gallcyst + 6 Splitfang → 67% (100/150) and 70% (105/150) across two independent batches
```

Landed at 4 Gallcyst + 6 Splitfang — a real mix of LOSS and COMMANDER_DOWN both times, comfortably clear of the 30% floor and a full step away from the known 31% neighbor at 5/6. Traced a losing run: the squad spends long enough clearing the west-flank Gallcyst and the Splitfang harassment that it never actually settles onto the hold block before `turnLimit` runs out — "Loss: turn limit reached without holding the zone," a genuinely different failure texture from Mission 18's cornered-commander shape: a pacing race caused by the approach fight itself, not a death spiral. Shipped at 4 Gallcyst + 6 Splitfang, Gallcyst on the west flank.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Act II, Mission 20 (the shared convergence point, "Marrow's Line" — plan doc §5's own note that House Amaranth's side needs its own map/mission entry, likely `extract_unit`, not a literal reuse of Warden's Mission 20 data). Act III, Missions 21-36. The full campaign-state/Hub wiring pass. The Missions 1-11 enemy-variety reform plan, still awaiting Maxime's go-ahead.
