# Build Log Addendum — House Amaranth: Mission 7, "Deeper Terraces" (31 Aug 2026)

Maxime, on Mission 6's re-tune: *"good. thsts the kinda mission I want. keep going."* Taken as standing intent for the rest of this batch, not a one-off note — this mission got pushed past its own first-guess result rather than shipped there.

## What shipped

Mission 7, "Deeper Terraces" — Act I's second extraction. Expanding the ward-crop program onto a new tier; a research team needs pulling out when the drift there runs hot. `extract_unit`, new map (`map_house_amaranth_deeper_terraces`, 20×13), new `CampaignMission` (`mission_house_amaranth_7`).

**No Warden mirror named for this one in the plan doc's own §6 table, so a fresh geometry rather than a borrowed shape** — the first genuinely original map this pass, not a retextured or reused proven layout. The map's own point is a literal two-tier terrace, not just a fiction label: deploy sits on the established lower tier (south), split from a new upper tier (north) by a two-row ridge band. Ridge tiles are passable, not a wall (same elevated-terrain movement-cost tax every other ridge use in this campaign already carries), so the climb is real friction, not a hard gate. The new tier is where the drift actually runs hot — the exit cluster and two spawn seams live up there; two more spawn seams sit at the ridge's own base, Bloom that's already crept partway down before the squad even reaches the climb.

**Extraction target: Orin again, the Fieldwright** — same track precedent as Mission 3. Worth naming why that's not a lazy repeat: Warden's own campaign reuses a single Fieldwright (Anand) as its `extract_unit` target more than once too (`campaignAmaranth.ts`, missions at `turnLimit` 14 and 17), so this is following an established convention, not skipping the work of inventing a new one.

## Sim-tested across three real passes, not shipped on a first guess

Starting composition: Mission 3's own Crawlmass/Splitfang base (6+2) plus one Sporethrower up on the new tier — the actual fiction reason the drift "runs hot" there specifically.

```
npx tsx src/sim/run.ts mission_house_amaranth_7        → clean WIN, turn 11 of 16
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_7 → WIN=149/150 (99%), COMMANDER_DOWN=0
```

99% — clears the floor but reads nothing like "hot." Per Maxime's own Mission 6 read, pushed further rather than left here.

**First bump (Splitfang 2→3, kept 1 Sporethrower) — catastrophic overshoot, caught by sim:**

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_7 → WIN=11/150 (7%), COMMANDER_DOWN=131
```

A single extra Splitfang was enough to let 2 Crawlmass + 3 Splitfang + Sporethrower alpha-strike Marrow for 128+ damage in one hostile phase while the squad was still clustered near deploy, before she could reach the ridge — confirmed from a verbose run (commander down turn 3). The same "added pressure hits an extraction squad harder than the raw numbers suggest" lesson Mission 6 taught for `eliminate_all`, now confirmed for `extract_unit` too, and sharper here.

**Landed: reverted Splitfang to 2 (the tested-safe number), added a second Sporethrower up on the new tier instead, pinned near the far side of the exit cluster:**

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_7 → WIN=67/150 (45%), LOSS=83, COMMANDER_DOWN=0
```

Worth naming what that 45% actually is, checked against sample verbose runs rather than assumed: not commander deaths — a genuine turn-limit squeeze. Two stationary ranged units guarding the exit cluster cost real turns to close on and clear, and a meaningful share of runs simply run past `turnLimit: 16` doing it. A fair kind of hard — a clock, not a coin-flip alpha strike — comfortably clear of the 30% floor. Shipped at this composition (6 Crawlmass + 2 Splitfang + 2 Sporethrower).

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 8-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
