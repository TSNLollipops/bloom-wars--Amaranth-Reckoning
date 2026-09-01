# Build Log Addendum — House Amaranth: Mission 10, "The Choir, Heard From Afar" (31 Aug 2026)

Maxime: *"so far its fine. keep going."* Continuing the batch under the same standing intent as Missions 6-9.

## What shipped

Mission 10, "The Choir, Heard From Afar" — Act I's mirror of Warden's own Mission 8 mid-boss, "The Choir Sings." `eliminate_all`, new map (`map_house_amaranth_the_choir_heard_from_afar`, 22×13), new `CampaignMission` (`mission_house_amaranth_10`).

**How the mirror actually works.** Warden's Mission 8 is that campaign's first Bloom encounter built with real coordination rather than incidentally — `bloom_choir` (pack intelligence, sonic/flight_membrane, `data/bloom.ts`) meeting Warden's lance head-on. This side plays the same coordinated pack differently, per the plan doc's own pitch: House Amaranth doctrine handles it by redirection, not annihilation. Only the stragglers that wouldn't be steered actually get fought here — which is why the shipped composition (2 Choir + 3 Crawlmass) is deliberately smaller than Warden's own 4 + 4, not a straight copy. The bulk of the swarm passes at a distance, off camera, successfully redirected — "heard from afar," not fought head-on.

**Map reuses The Choir Sings' own proven open-field/ridge-corner shape**, border retextured ridge/scrub → bloom_mat, same discipline every other borrowed House Amaranth shape uses this pass. The interior bloom_mat crop clusters were already the right tile identity for this campaign's fiction, so they carried over untouched.

**Same mechanical answer at the same narrative beat.** Warden's own Mission 8 is where `abil_taunt` unlocks for the Meeps path — this mission does the same for House Amaranth's own two Meeps pilots (Vondra, Meir), matching the precedent exactly rather than inventing a different unlock trigger for an equivalent moment.

## Sim-tested — landed on the first real pass, no retune needed

```
npx tsx src/sim/run.ts mission_house_amaranth_10        → clean WIN, turn 13 of 14, real drawn-out engagement
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_10 → WIN=115/150 (77%), COMMANDER_DOWN=35, LOSS=0, TIMEOUT=0
```

77% — checked against three sample verbose runs rather than assumed. The failure is legible and repeatable: two Choir hits stacking on Marrow in a single hostile phase (~52 damage, close to its own 2×32 max), the same "concentrated pack fire catches the commander" shape every prior mission this pass has taught, not a new or degenerate failure type. Already comfortably in this session's own established "real teeth" range (Missions 6/7/8/9 all landed 45-77% after tuning) — shipped at 2 Choir + 3 Crawlmass without pushing further.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 11-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
