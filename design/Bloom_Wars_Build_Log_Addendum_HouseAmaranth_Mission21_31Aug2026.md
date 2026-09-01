# Build Log Addendum — House Amaranth: Mission 21, "After the Line" (31 Aug 2026)

Maxime: *"mission 21 of house amaranth"* — Act III's opener, next in sequence per the plan's own §6 table and Mission 20's own closing note.

## What shipped

Mission 21, "After the Line" — `eliminate_all`, `turnLimit: 16` (house-rule #5: `eliminate_all` doesn't actually enforce the turn limit as a loss condition, HUD-display only). New map (`map_house_amaranth_after_the_line`, 20×11), new `CampaignMission` (`mission_house_amaranth_21`), new `HOUSE_AMARANTH_ACT3` array (currently just this one mission) folded into `HOUSE_AMARANTH_MISSIONS_BY_ID`.

Per the plan doc's own §6 pitch: Marrow comes back from the duel changed — not broken by the bargain, more committed to it, for reasons the squad doesn't understand yet. Briefing and the opening `dialogue` event both lean on that: she's quieter, not shaken, and she's not explaining herself, just putting the squad back to work while she works out what she saw.

## Map reused deliberately, not out of laziness

The map reuses Mission 20's scrub/rubble ground rather than the more common bloom_mat terrace — a deliberate call, not a shortcut: "after the line" reads better sitting on the same literal ground the line was held on last mission than on a fresh terrace with no connection to what just happened. 20×11, deploy west (4 pads, 2 columns), two enemy clusters (a rubble-block center strip flanked by open lanes, mirrored spawn seams north and south) plus a second pair of spawn seams at the far east edge — the squad has to cross the whole board and clear both pockets, not funnel through one chokepoint.

Ran clean through `maps_house_amaranth.py` on the first pass: 21 of 21 authored maps still valid, deploy-to-objective reachability holds (min 4 deploy pads, 1+ spawn seam, both satisfied). TS grid hand-transcribed verbatim from the script's own generated output into `mapsHouseAmaranth.ts`, per the project's standing rule — never hand-edited directly.

## Enemy composition — Enemy Variety Reuse principle applied

Maxime's own standing note: any bloom shown should get reused across missions, vary the mix, don't lean on the same primary every time. Recently-used primaries (Gallcyst, Sirenmaw, Splitfang, hostile mechs) were sitting fresh from Missions 17-20, so Mission 21 goes back to Undertow + Crawlmass instead — a pairing this campaign hasn't leaned on in a while.

## Sim-tuning journey — second mission built under the new ≤15% ceiling

```
Undertow 6 + Crawlmass 12 (18 total)   → 75% (way over the ceiling)
Undertow 10 + Crawlmass 20 (30 total)  → 0% (150/150 COMMANDER_DOWN — a hard wall, not a tune)
Undertow 8 + Crawlmass 16 (24 total)   → 7% (11/150), 11% (16/150), 8% (12/150)
```

The doubling attempt is the same non-monotonic cliff this campaign keeps finding (Missions 13, 17, 18, and the Warden-side Wellroot fight all did this too) — going from "too easy" straight to "unwinnable" with no usable middle ground in between at that step size. Bisecting down to 8+16 landed the mission stably under the ceiling: three independent 150-run batches (39/450 pooled, ~8.7%), not a single-batch fluke.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (disposable Python-script scratch output deleted first — same
                         housekeeping step Missions 19 and 20's own addenda already flagged)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
npm run build          → clean (tsc + vite build), only the pre-existing >500kB chunk-size warning
```

`tools/lint-spoiler.mjs` itself only no-ops in this sandbox — `BW_RESERVED_TERM` lives in a git-ignored `.env.local` never staged here, by design. Worth a real local `npm run lint` on Maxime's own machine before this ships anywhere, same caveat as every prior mission this session.

## Doc drift fixed while touching these files

Three stale header/status comments corrected in the same pass, all from being left stale across many missions' worth of edits without anyone circling back: `maps_house_amaranth.py`'s own header ("STATUS: skeleton, not the full 36. Only Mission 1..." → now reflects 21 of 36 authored), `mapsHouseAmaranth.ts`'s matching header, and `campaignHouseAmaranth.ts`'s file-top STATUS comment ("ONE real mission, not thirty-six" → now reflects 21 of 36 built, Act III begun).

## Also flagged this pass: a live concurrent-session signal

`Bloom_Wars_EA_Launch_Plan_31Aug2026.md`'s mtime and size changed on-device partway through this session, after it had already been staged and read — a real instance of the exact concurrent-editing risk this file's own header warns about, not a hypothetical. Not a file this pass touched, so nothing here was at risk, but worth Maxime's own awareness: something else may be actively editing that specific doc right now.

## What's still not built

Act III, Missions 22-36 of House Amaranth. The full campaign-state/Hub wiring pass. The Missions 1-11 enemy-variety reform plan, still awaiting Maxime's go-ahead. Maxime's own planned n=500 whole-campaign retune pass, once every mission exists.
