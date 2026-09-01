# Live-browser verification harness (Playwright)

Answers the progress doc's own "Cross-cutting still-open item": every UI
change this whole build has shipped on logic-tracing + typecheck/lint/test
alone, never actually clicked in a live browser. This is real click-testing
against the actual running game, not a mock.

## What's here

- `genSave.ts` — builds a realistic **midgame** save (all three lances
  integrated, 15 pilots / 10 meks — Tier 3's own "15-20+ pilots" scale, not
  the thin 5-pilot Act I start) and writes it to `save.json`. Run with
  `npx tsx tools/verify/genSave.ts` whenever you need a fresh one (it's not
  committed — regenerate it).
- `checkHubNpcs.mjs` — boots the real dev server's page in headless
  Chromium, seeds `localStorage` with `save.json` before the game's first
  script runs (`addInitScript`), clicks CONTINUE, lands in the live Hub
  scene, then samples `window.__bwGame`'s real NPC list every 6s for ~84s
  of real Hub time. Reports, per NPC: rooms visited, total movement in
  pixels, whether `stuckMs` ever went meaningfully above
  `STUCK_TIMEOUT_MS`, and whether any 2+ NPCs sat within 20px of each
  other in the same room for nearly the whole window (a real door-cluster
  pile, not a passing overlap). Writes `report.json` (full samples) and
  two screenshots (`hub_start.png`/`hub_end.png`) for a visual gut-check
  alongside the numbers.

## How to run it

```
npm run dev -- --port 5183 --strictPort &     # or whatever port; edit the
                                                # PORT below to match
npx tsx tools/verify/genSave.ts
node tools/verify/checkHubNpcs.mjs
```

Chromium's already installed in the cloud sandbox at a fixed path (see
`checkHubNpcs.mjs`'s own `executablePath`) — don't run `playwright install`
there. On Maxime's own machine, plain `npx playwright install chromium`
once is enough; drop the `executablePath` override or point it at whatever
`npx playwright install` reports.

## Why `window.__bwGame` is a real (dev-only) hook, not a leftover debug line

`src/main.ts` sets `window.__bwGame = <the live Phaser.Game>` gated behind
`import.meta.env.DEV` — Vite's own build-time flag, `false` in
`vite build`'s production bundle, so it never ships. This is what lets a
Playwright script read real scene-internal state (NPC positions, `stuckMs`,
room assignments) instead of only screenshotting pixels and guessing.
Reuse it for the next verification pass rather than re-inventing a hook —
any scene's private fields are reachable the same way, e.g.
`window.__bwGame.scene.getScene("Battle")`.

## Extending this to the rest of the backlog

The progress doc's "Cross-cutting still-open item" lists specific UI
changes still owed a real click-test: recruit names, door landing, hangar
click-through, hangar depth, hold-zone visibility, the NPC bubble crowd,
Battle's Tab-cycle, Mek Workshop confinement, Rec Room table/boredom/spar.
Each is a new small script here (or a new function in a shared one) —
seed whatever `CampaignState`/mission the case needs, click through to the
scene, assert on real scene state the same way `checkHubNpcs.mjs` does.
Not all of it is done this pass — see the build log addendum for exactly
what this first pass covered and what's still owed.
