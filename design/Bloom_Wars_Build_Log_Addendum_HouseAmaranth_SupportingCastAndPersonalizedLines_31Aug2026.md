# Build Log Addendum — House Amaranth: Supporting Cast + Personalized Lines (31 Aug 2026)

Maxime, once he was back: confirmed the four-pilot draft roster, gave the real composition (*"his starting cast is 2 hiopi meeps a human reeps and a osnian munties"*), then *"good, lets work on supporting cast... make a plan for personalized line and add it to design. then start on the build."* Plan doc: `design/Bloom_Wars_House_Amaranth_Personalized_Line_Plan_v1.md`.

## The cast, closed

| Pilot | Callsign | Path / chassis / species | Mek track | Catalyst |
|---|---|---|---|---|
| Col. Ysolde Marrow | — | Tank / bipedal / human | Armorer | dog (loyalty) |
| Sgt. Petra Vondra | "Ironrow" | Meeps / centauroid / Hiopi | Runemaster | raven (instruction) |
| Cpl. Jonas Meir | "Sparrow" | Meeps / centauroid / Hiopi | Armorer | wolf (teamwork) |
| S.Sgt. Callum Bray | "Deadfall" | Reeps / bipedal / human | Runemaster | bear (isolation) |
| Cpl. Nessa Orin | "Quill" | Munti / vibrissal / Osnian | Fieldwright | rabbit (nurturing) |

All four new archetype ids (`arch_meeps_centauroid`, `arch_reeps_bipedal`, `arch_munti_vibrissal`) already existed in `units.ts` — no new mech types needed, confirmed by grep before writing a single `PilotRecord`.

## What "personalized line" turned out to mean, and what got built for it

Not a new system — `src/data/npcSeed.ts`'s existing `catalystForPilot()` is exactly this for Warden Company already: one hand-picked animal-archetype catalyst per named pilot, which is the whole authoring cost for that pilot's Hub idle/drunk/panic/grief lines to read as *them* instead of a generic voice. Everything downstream (sub-animals, grief reactions, the social sim) is already automatic once a catalyst exists.

- **`src/data/npcSeedHouseAmaranth.ts`** (new) — `HOUSE_AMARANTH_NPC_SEED` (all 5 pilots, catalysts per the table above) and `HOUSE_AMARANTH_NPC_BOND_SEED` (6 pairwise bonds among the 4 supporting pilots: a real mentor pair Vondra↔Meir at +35, a real friction pair Meir↔Bray at -20, four mild-to-warm values between — same "demonstrate texture, don't flatten it" bar Warden's own 3-pilot seed set uses).
- **`catalystForPilot()` extended** (`npcSeed.ts`) to check the new file after its existing Warden check, before falling through to the deterministic hash. Additive only — Warden's own `NPC_SEED`/`NPC_BOND_SEED` untouched.
- **Deliberately NOT merged into Warden's `NPC_SEED`/`NPC_BOND_SEED` directly**, and **`scenes/Hub.ts` untouched** — those two constants aren't purely generic data, `Hub.ts`'s `buildNpcs()` specifically walks `NPC_SEED` to seed the three hand-placed Rec Room regulars' live Hub *positions*. There's no `HubHouseAmaranth.ts` yet for these five pilots to walk around in (campaign plan §3c, still open) — merging would have bled into Warden's own live Hub for no reason.
- **One thing worth naming plainly: House Amaranth's MC has a hand-picked catalyst (dog) and Warden's own doesn't.** `npcSeed.ts`'s own comment flags Rourke's missing catalyst as "a real, previously-unflagged gap," not a design choice — so giving Marrow one here closes the same gap for a *different* protagonist rather than reproducing it. Closing Rourke's own version of that gap is a separate, un-asked-for task, not done tonight.
- **2 new tests** (`src/data/__tests__/npcSeed.test.ts`) — the five hand-picked catalysts resolve correctly, and the deterministic-hash fallback still holds for anyone not in either seed list.

## Mission 1 grown to the real lance, re-tuned and re-verified

Last night's "First Harvest" deployed Marrow alone (the cast didn't exist yet), tuned to 1 Crawlmass because a solo Tank couldn't survive more. With the real five-pilot roster now built, `HOUSE_AMARANTH_ROSTER_IDS` (derived from `HOUSE_AMARANTH_PILOTS.map`) automatically grew Mission 1's `playerPilotIds` to all five — the briefing line was rewritten to match ("Colonel wants her whole staff to know how a quiet morning runs" instead of "no sense pulling a full lance off the wire"), and the enemy wave was re-tuned rather than left at the solo-tuned number, which would have been a trivial stomp for five pilots.

Tried Warden's own Mission 1 ("Muster") numbers directly first — 11 Crawlmass, `turnLimit: 8`, `rewardPoints: 100` — rather than guessing fresh ones, since the two squads are now genuinely comparable in size (5 pilots each) even though the class spread differs (1 Tank/2 Meeps/1 Reeps/1 Munti here vs. Warden's 2 Meeps/1 Tank/1 Reeps/1 Munti). Batch-simmed clean on the first try: **38/40 (95%)**, `COMMANDER_DOWN=2` — batch-simmed Warden's own Muster alongside it for a direct comparison and got the identical 38/40 (95%). No further tuning needed; kept Muster's exact numbers rather than inventing different ones for the sake of being different.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean
npm test -- --run    → 57 files, 1186/1186 passing (2 new), zero regressions
npx tsx src/sim/runBatch.ts 40 mission_house_amaranth_1  → WIN=38/40 (95%), COMMANDER_DOWN=2
npx tsx src/sim/runBatch.ts 40 mission_amaranth_1        → WIN=38/40 (95%), COMMANDER_DOWN=2  (comparison baseline)
```

## What this is still NOT

Not the Hub — no walkable House Amaranth scene exists yet to actually show any of this personalization live; today's data is what that scene will read from the moment it's built, not placeholder work. Not missions 2-36. Not the Bramble. Not wired into `CAMPAIGNS`/mission-select — same standing scope boundary as last night's scaffolding pass. Room-set naming, the steward's identity, save architecture, and act/campaign titles are all still open per the plan doc's own §9.
