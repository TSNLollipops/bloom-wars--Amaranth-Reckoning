# Build Log Addendum — House Amaranth: Mission 13, "New Terraces, New Faces" (31 Aug 2026)

Maxime: *"when you adjust difficulties. vary between the different enemy unit. that wsy the mission feel different. we got 6-7 enemy unit. so lets vary tjing up. adding crawlmass to a primary sporetrower or whatever. be creative. :) but you van go"* — Act II opens, and the first mission built to that direction directly.

## What shipped

**Act II begins.** Mission 13, "New Terraces, New Faces" — integrating a second lance as the program expands past what one company can hold. `eliminate_all`, new map (`map_house_amaranth_new_terraces_new_faces`, 20×12), new `CampaignMission` (`mission_house_amaranth_13`).

**First House Amaranth mission built around a genuinely different enemy-composition shape, not the Crawlmass+Splitfang base most of Act I reached for.** Checked before writing anything: Gallcyst hadn't appeared anywhere in this campaign's first 12 missions — a real gap, confirmed by grepping every `enemyWaves` block already shipped, not assumed. Made it the *primary* threat here rather than a filler unit: the new terraces come with their own freshly-installed point-defense, planted and waiting inside a single structure block center-map, not a drift that wandered in. Sporethrower is the secondary, pinned just outside the same structure covering it. Nothing in that pair moves — the squad has to go take the position, a different tactical problem from every prior mission's "something's coming at you" shape. Crawlmass stays the mobile filler, matching the campaign's own consistent base.

## Sim-tested across five passes — a real, non-obvious curve

`eliminate_all` doesn't actually time out (turnLimit is HUD-display-only for this objective, the same house rule every prior mission followed) and nothing in the fixed pair chases — so the real lever turned out to be Crawlmass count, the one mobile piece able to force real engagement, not turn limit at all.

```
3 Crawlmass  → WIN=150/150 (100%)  COMMANDER_DOWN=0    — no real risk, safe to poke-and-retreat forever
8 Crawlmass  → WIN=26/150  (17%)   COMMANDER_DOWN=124  — overshot the other way
6 Crawlmass  → WIN=2/150   (1%)    COMMANDER_DOWN≈149  — WORSE than 8, checked twice, not a fluke
4 Crawlmass  → WIN=135/150 (90%)   COMMANDER_DOWN=15   — still too easy
5 Crawlmass  → WIN=101/150 (67%), then WIN=98/150 (65%) across two independent batches
              COMMANDER_DOWN=42-44 (~28-29%), LOSS=0, TIMEOUT=5-10 (~3-7%)
```

The 6-vs-8 result is worth naming honestly rather than smoothing over — more enemies came back *safer*. Traced via verbose runs: at 6 Crawlmass, Orin (the roster's one Munti) reliably gets caught forward-healing right as the fixed crossfire's chip damage stacks on her specifically, and losing the only healer early snowballs into commander-down almost every run. At 8, the extra Crawlmass simply die too fast to player counter-fire to reliably land that same early hit on her — so the higher count is actually the safer one. Not a bug, a genuine non-monotonic tuning curve, and the kind of finding this session's own discipline is built to catch rather than paper over.

TIMEOUT (5-10 out of 150) is the sim's own runaway-loop guard catching the occasional very long grind against Gallcyst's 140 endurance — expected for this shape (a siege, not a burst fight), not a new bug.

Landed at **5 Crawlmass + 2 Gallcyst + 2 Sporethrower**: comfortably clear of the 30% floor, LOSS=0, commander-down the dominant and legible failure (the same focus-fire shape every mission this pass has taught, just delivered by a stationary crossfire instead of a mobile alpha strike — a genuinely different *feel*, which was the actual point).

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Act II, Missions 14-20. Act III, Missions 21-36. The Hub, mission-select wiring. Same standing boundary as every prior House Amaranth pass.
