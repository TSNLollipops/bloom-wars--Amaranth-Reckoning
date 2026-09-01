# Build Log Addendum — First real Playwright verification pass: Hub NPC roaming/door-cluster, 31 Aug 2026

Maxime: "ill do the live test later. keep building" (after a corrected
Mission 6 report — see the Player AI round 4 addendum; that thread's own
re-tuning decision is his to make later, not built this pass). This picks
up the progress doc's own standing "Cross-cutting still-open item" instead:
every UI change this whole build has shipped on logic-tracing +
typecheck/lint/test alone, never actually clicked in a live browser — and
that doc names a same-day case (the door-cluster spawn bug) where
logic-tracing itself gave a confidently wrong diagnosis. First slice: a
real, reusable Playwright harness, run against the highest-named risk.

## What got built

`tools/verify/` (new, checked in, reusable — not a one-off script):
- `genSave.ts` — builds a realistic **midgame** save via the same
  `createWardenCampaignState`/`integrateSecondLance`/`integrateThirdLance`
  the real game uses (15 pilots, 10 meks — Tier 3's own "15-20+ pilots"
  scale, the size the NPC bubble-crowd fix was actually tuned against),
  not the thin 5-pilot Act I start every prior logic-trace implicitly
  assumed.
- `checkHubNpcs.mjs` — boots the real dev server in headless Chromium,
  seeds `localStorage` with that save before the game's first script runs,
  clicks CONTINUE, lands in the live Hub scene, then samples the real NPC
  list every 6s for ~84s of real Hub time (two independent runs, same
  result both times). Reports per-NPC room history, total movement,
  whether `stuckMs` ever went meaningfully above the 500ms give-up
  threshold, and whether any 2+ NPCs sat within 20px of each other in the
  same room for nearly the whole window — a real door-cluster pile, not a
  passing overlap.
- `README.md` — how to run it, and how to extend it to the rest of the
  backlog this doesn't cover yet.

`src/main.ts` — one small, permanent, dev-only addition:
`window.__bwGame = <the live Phaser.Game>`, gated behind
`import.meta.env.DEV` (Vite's own build-time flag — `false` in `vite
build`'s production bundle, confirmed via `npm run typecheck` and a clean
`npm run lint`). This is what let the Playwright script read real
scene-internal state (NPC positions, `stuckMs`, room assignments) instead
of only screenshotting pixels and guessing — and it's reusable for every
future verification pass, not single-purpose.

## What it found, live, not logic-traced

Two independent 84-second runs against the full 15-pilot/10-mek roster,
both agreeing:

- Every one of the 14 roaming NPCs and 10 walkable Meks actually crossed
  rooms during the window (grotto, workshop, vault, recroom, berths, cic,
  hangarDeck, sparRoom all visited by someone) — real door-hopping, not
  frozen at spawn.
- **No NPC ever showed a sustained stuck signal** (`stuckMs` meaningfully
  above the 500ms give-up threshold) at any of the 14 samples, on either
  run.
- **No persistent door-cluster pile** — no pair of NPCs sat within 20px of
  each other in the same room for anywhere close to the full window,
  either run.
- The Carrier CO ("Arangement of Content") correctly never moved
  (0px, both runs) — checked against the code and confirmed intentional,
  not a bug: he's deliberately built with no `nextRoamAt`/`nextEncounterAt`
  ("stationed at his post," per his own construction comment), the same
  convention `updateNpcRoaming`/`updateNpcEncounters` already skip any
  undefined-clock NPC for.
- A screenshot at the 84s mark (`tools/verify/hub_end.png`, not shipped —
  see below) also happened to catch the Rec Room table feature (this
  session's own Phase A work) live in use: four NPCs seated around it with
  real OVERHEARD log lines referencing a poker/peg-board session at that
  table — a second, incidental confirmation alongside the one this pass
  actually went looking for.

**Reading this honestly**: this confirms Tier 1's door-landing/door-
approach jitter fix and the 30 Aug `stuckMs` give-up fix both hold up
under real browser timing, for this specific roster size and this specific
84-second sample — it does not prove no door-cluster case exists anywhere
(a much larger roster, a different room's door geometry, or a longer
session could still surface one), and it says nothing yet about the other
items still owed a real click-test (recruit names, hangar click-through/
depth, hold-zone visibility, Battle's Tab-cycle, Mek Workshop confinement,
the bubble-crowd throttle itself). Real progress on a real, named risk —
not the whole backlog closed.

## Verification

`npm run typecheck` / `lint` / `test` all clean on the final state —
**1184/1184**, unchanged (this pass added tooling, not engine/game code).
Two independent live-browser runs of the harness itself, both agreeing, as
detailed above.

## Delivered files

`src/main.ts` (the one production-code line, dev-gated), `tools/verify/
genSave.ts`, `tools/verify/checkHubNpcs.mjs`, `tools/verify/README.md` —
all new, all via the device bridge. **Not shipped**: `save.json`/
`report.json` (generated, regenerate via the README) and the two
screenshots (`hub_start.png`/`hub_end.png` — cloud-sandbox artifacts,
regenerate the same way if wanted as reference images later).

## Still open

The rest of the "Cross-cutting still-open item" list is still owed: recruit
names, door landing (the ORIGINAL far-side bug, distinct from this pass's
own near-side check), hangar click-through, hangar depth, hold-zone
visibility, the NPC bubble crowd throttle itself, Battle's Tab-cycle unit
selection, Mek Workshop confinement, and the Rec Room table/boredom/spar
systems all still need their own real click-test — this pass built the
reusable harness and spent it on the one item the progress doc itself
flagged as highest-risk (the door-cluster case, given the same-day
logic-tracing mistake already documented there), not the whole list.
