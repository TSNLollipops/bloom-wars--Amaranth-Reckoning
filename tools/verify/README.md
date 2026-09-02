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
- `checkDebriefAndMinigameGate.mjs` — 2 Sep 2026, same save/boot pattern as
  `checkHubNpcs.mjs`. Drives the REAL chat UI (T, type, Enter — not a
  bypassed `submitChat()` call) to confirm: asking the CO for a "brief"/
  "debrief" with no mission flown yet gets an honest "nothing to report"
  line; with a win/loss on record, a real mission-echo reaction in his own
  voice; asking anyone else redirects to the CO. Also calls the real,
  committed `runNpcEncounter` directly 300 times against two NPCs forced
  into Hangar Deck to confirm the ambient encounter roll never narrates
  pegBoard/poker/fletchers outside the actual Rec Room (waiting on the real
  ambient cooldown/proximity timers for even one natural trial would take
  real wall-clock minutes, let alone 300). Writes `debrief_report.json` and
  two screenshots (`debrief_start.png`/`debrief_end.png`).
- `checkSocialActions.mjs` — 2 Sep 2026, same save/boot pattern again.
  Exercises the whole crew-interaction brainstorm pass (Gift/Praise/
  Insult/Apology/Congratulate/Send-Off, named chat targeting, CO Confide,
  and the Insult Tier-3 CO call-out + remove-pilot resolution) through the
  REAL chat UI end to end — never a direct call into a verb handler. This
  is the run that caught a real production bug before it shipped: the
  first pass's named-targeting test false-matched on a shared rank prefix
  ("Spec." resolving as if it were a given name), traced to
  `extractNamedTarget` stripping punctuation from a word instead of
  dropping rank tokens entirely — fixed to mirror `TransporterPad.ts`'s
  own `pilotInitials()` convention, re-verified clean. Also drives all six
  insults of the Tier-2/Tier-3 escalation ladder as six separate real chat
  round-trips, re-isolating the target NPC's position before each one to
  guard against live roaming drift over that many real wall-clock
  round-trips. Writes `social_report.json` and two screenshots
  (`social_start.png`/`social_end.png`). Full account, including the bug
  and its fix: `claude/Bloom_Wars_Build_Log_Addendum_CrewInteractionsBrainstorm_02Sep2026.md`
  in the Project.
- `checkCalendarClock.mjs` — 2 Sep 2026, same save/boot pattern again.
  Verifies the calendar economy (the real-time campaign-day clock). Scoped
  deliberately to what unit tests *cannot* reach: that Phaser's real update
  loop actually drives the clock, that the rate maps correctly onto real
  elapsed wall-clock, that the clock keeps running with the chat box open
  (it's ticked above `Hub.update`'s overlay early-returns on purpose — "the
  calandar run when you play. no matter what you do"), and that a real
  chat-driven verb pays its accent through `logVerbAndCharge`. This is the
  second run in this harness's short life to catch a real defect before it
  shipped, and a decent argument for the whole approach: every unit test
  passed while the live browser measured the Hub crediting only **~41%** of
  real elapsed time on ordinary frames — and ~100% with the chat box open,
  where `Hub.update` returns early and frames are cheap. Cause: Phaser's
  `delta` is smoothed and clamped, so a heavy frame under-reports how much
  time actually passed. That would have shipped a calendar running at a
  speed set by the player's frame rate, slower on a weak machine than a fast
  one — the opposite of the "inevitable clock" it's meant to be. Fixed by
  measuring wall-clock directly (`calendarClock.ts`'s `measureRealDelta`),
  re-verified at ratio 1.00. Writes `calendar_report.json` and two
  screenshots (`calendar_start.png`/`calendar_end.png`).

## How to run it

```
npm run dev -- --port 5183 --strictPort &     # or whatever port; edit the
                                                # PORT below to match
npx tsx tools/verify/genSave.ts
node tools/verify/checkHubNpcs.mjs
node tools/verify/checkDebriefAndMinigameGate.mjs
node tools/verify/checkSocialActions.mjs
node tools/verify/checkCalendarClock.mjs
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
