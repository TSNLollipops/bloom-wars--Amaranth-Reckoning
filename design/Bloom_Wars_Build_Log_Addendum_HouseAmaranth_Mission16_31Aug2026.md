# Build Log Addendum — House Amaranth: Mission 16, "The Long Ledger" (31 Aug 2026)

Maxime: *"keep going."* Continuing Act II under the same standing enemy-variety direction.

## What shipped

Mission 16, "The Long Ledger" — a rival House tries to poach the diversion contract by force, the bargain's first enemy that isn't the Bloom. `eliminate_all`, new map (`map_house_amaranth_the_long_ledger`, 22×11), new `CampaignMission` (`mission_house_amaranth_16`).

**First House Amaranth mission to field hostile mechs at all.** Every prior mission (Missions 1-15, including Mission 6's own "House Colors" mirror beat) fought Bloom exclusively — Mission 6 told its checkpoint-dispute mirror through a Bloom incursion plus a closing dialogue line, not PvP, because the engine has one hostile faction slot per mission and that beat didn't need a second one. This mission does.

**Which mech archetype, checked directly rather than assumed.** `src/data/units.ts` has three separate hostile-mech pools: `AMARANTH_HOSTILE_MECHS` (House Amaranth's own line troopers — wrong faction to attack House Amaranth itself), `AMARANTH_CONSCRIPT_MECHS` (already committed elsewhere — confirmed via direct read that `campaignAmaranth.ts`'s own `mission_amaranth_16`, "Collaborators," already uses these; a different campaign, different mission, same number by coincidence only), and the generic `HOSTILE_MECHS` (`hostile_mech_01`-`04`, "Unmarked Mech," tank/meeps/meeps/reeps, tier G — previously used only in the archived Team One campaign). Went with the generic set: "unmarked" reads as deniable, which is exactly what a rival House poaching a bargain by force would actually field, and it was sitting unused everywhere else in this campaign.

**A fresh map shape.** A supply depot straddling a single east-west road, two warehouse rows (structure tiles — passable but costly) flanking it north and south, deploy centered on the road defending the depot itself, with spawn seams at both far ends of the road — a two-pronged pincer down the one avenue in, rather than this campaign's now-repeated center-block-plus-corner-spawns pattern (Missions 12, 13, 15 all used a variant of that). Built via the now-standard Python-helper-with-length-assertions discipline; validated clean on the first pass.

## Sim-tested, tuned honestly (not shipped on the first number)

First pass — the standard 4-unit detachment alone (1 tank/2 meeps/1 reeps, matching Warden Mission 6's own precedent for this exact archetype family):

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_16 → WIN=147/150 (98%), COMMANDER_DOWN=3
```

Too easy for Act II — the same "cakewalk" this campaign already accepts for Act I openers, but not the right texture here, especially for the campaign's first human/mech fight. Added a turn-5 reinforcement wave (2 more mercs, same archetype family) rather than just inflating the opening wave, so the fight gets a real second beat instead of a bigger first one:

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_16 → WIN=71/150 (47%), LOSS=0, COMMANDER_DOWN=78, TIMEOUT=1
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_16 → WIN=82/150 (55%), LOSS=0, COMMANDER_DOWN=68, TIMEOUT=0
```

Real spread between the two independent runs (47-55%), but both comfortably clear of the 30% floor. Traced a losing run directly rather than assumed the cause: the turn-5 reinforcement lands while the squad is still mopping up the first wave and spread out — in the traced run, Orin (the roster's one Munti) was mid-repair rather than positioned when it hit, went down first (stripping the "standard restock" permadeath safety net for the rest of the fight), and Marrow herself got focus-fired down two mechs deep in the very next hostile phase. Same campaign-wide commander-focus-fire pattern already documented and accepted elsewhere in this project — not a new or degenerate failure mode. Shipped at 4 (turn 1) + 2 (turn 5).

**Genuinely plays differently from every Bloom fight so far** — real counter-damage exchanges both directions (mechs counter same as player pilots do), no swarm-thinning attrition, and no archetype-specific quirks like Sporethrower's no-counter rule or Undertow's burrow — worth naming as its own texture, not just "harder."

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## Open question raised mid-build, not yet resolved

Maxime asked, mid-session: *"are act 2 mission setup for 10 mech. 2 lance."* Checked directly: **no.** `HOUSE_AMARANTH_PILOTS` still has exactly 5 entries (Marrow + Vondra + Meir + Bray + Orin) — the same roster deployed via `HOUSE_AMARANTH_ROSTER_IDS` on every mission including 13-16. Mission 13's own briefing line ("The second lance arrives with the new ground already half-built around them...") is narrative color over that same 5-pilot roster — no second-lance `PilotRecord`s were ever actually authored. Flagged to Maxime directly rather than assumed either way; this is a real scope decision (naming, chassis/species picks, and mek assignments for 5 new pilots, the same authorial weight the original roster took), not something to build unilaterally mid-mission-batch.

## What's still not built

Act II, Missions 17-20. Act III, Missions 21-36. The Hub, mission-select wiring. The Missions 1-11 enemy-variety reform plan is written but not executed, awaiting Maxime's go-ahead. The second-lance question above is now also open, pending his call.
