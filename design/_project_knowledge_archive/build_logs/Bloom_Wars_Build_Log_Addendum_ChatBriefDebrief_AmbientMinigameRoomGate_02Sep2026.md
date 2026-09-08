# THE BLOOM WARS — Build Log Addendum: Chat "brief"/"debrief" Gap + Ambient Minigame Room-Gate Fix, 2 Sep 2026

Two one-line playtest reports from Maxime, both diagnosed against the real device repo (staged into a cloud sandbox, no guessing from memory or an older plan — per this project's own standing discipline) and both fixed same-pass.

## 1. "arangement of content doesnt accept brief, debrief as word"

**Diagnosis.** Typing "brief" or "debrief" to any NPC (Arangement of Content included) fell all the way through every recognizer in `src/data/chatIntent.ts` — muster, the four emotions, verb requests, unbuilt-verb lines, build requests, small talk (greeting/worry/farewell/advice/banter) — to the generic "Didn't catch that" shrug. Neither word appeared anywhere in the file. Confirmed by reading the live file directly, not assumed.

**First-pass fix (superseded — see "Correction" below).** Added `"brief"` and `"debrief"` to `HISTORY_KEYWORDS`, so both resolved to a generic History request answerable by any NPC. Also checked and ruled out: this is not a naming-lock/spoiler-lint collision. Read `tools/lint-spoiler.mjs` directly — the reserved term itself isn't even in that file (loaded from a git-ignored `.env.local` at runtime), and neither "brief" nor "debrief" shares any substring with "Synker Wars," the one reserved term this project's docs do write out.

**Correction, same day — Maxime's own words:** *"for the brief debrief. add it to the thing player can say specifically to the CO. other would tell you to ask the co instead. for now. later we can hav npc give you debrief if you ask them. their thought on the last mission. but thats later."* The History-request mapping was the wrong read — this is a CO-specific ask, not a generic recap anyone can answer. Reverted `HISTORY_KEYWORDS` to its original four entries and built it properly instead:

- New `detectDebriefRequest()` in `chatIntent.ts`, its own `DEBRIEF_KEYWORDS` (`"brief"`, `"debrief"`) — same "doesn't know or care who's nearby" shape as `detectBuildRequest`.
- `Hub.ts`'s `submitChat` gates it exactly the way build requests are already gated: recognized regardless of who's nearby, but `nearby?.pilotId !== CO_PILOT_ID` gets redirected — `"Ask the CO about that — find him in the grotto."` — same "who do I even ask" reasoning that block's own header already names. Reaching the CO this way also calls `markCoCheckedIn()`, same as a build request does.
- New `handleDebriefRequest()` on the CO's own path: if `campaignState.lastMissionEcho` is unset (no mission flown this save), an honest `"Nothing to report yet — you haven't flown a mission."` If a mission outcome is on record, it builds the same `HotTopic` shape `checkMissionEcho()` itself constructs and renders it through the CO's own real catalyst voice (`renderHotTopicLine`, wolf) — reusing the exact mission-echo content already written for the ambient hot-topics system rather than authoring new CO-bespoke lines. Deliberately independent of that system's own one-shot `announced` flag and `HOT_TOPIC_SPEAK_CHANCE` roll: a direct ask should always get a real answer, never miss because someone else already gossiped about it once or because a dice roll happened to fail.

**Deliberately NOT built, per Maxime's own "but thats later":** every other NPC giving their own personalized "thoughts on the last mission" when asked. This pass is the CO-only slice of that eventual generalization — not the generalization itself.

## 2. "mini game are being played by the bot outside the rec room too still"

**Diagnosis — a real, confirmed gap, not a hypothetical.** `Hub.ts`'s ambient/background NPC-to-NPC encounter roll (`updateNpcEncounters` → `runNpcEncounter` → `socialSim.ts`'s `simulateEncounter`/`pickEncounterKind`) only ever checked `sameDeck(npcA.room, npcB.room)` — and `recroom`, `hangarDeck`, and `berths` all share the same `"lower"` deck in `Hub.ts`'s own `ROOM_DECK` map, with no wall at the seam. `pickEncounterKind`'s weighted pool (talk 0.4 / pegBoard 0.25 / poker 0.2 / fletchers 0.15) had no concept of physical rooms at all — `socialSim.ts`'s own file header says so outright ("no live Hub visuals"). So a pair of NPCs idling in Hangar Deck or Berths could roll "played poker" or "played the peg board" and get a real bubble narrating it, nowhere near an actual table.

This is the exact same bug class Tier 2 (30 Aug 2026) already fixed for the **player-triggered** version — typing "let's play poker" outside the Rec Room now correctly blocks via `nearestNpcInRange`'s `requireRoom`. That fix never touched the ambient/background path, which is a separate call site entirely — this is the piece it missed.

**Fix.** Added an optional `minigamesEligible?: boolean` to `socialSim.ts`'s `EncounterInput`/`pickEncounterKind` (defaults to `true` when omitted, so `runSocialSim.ts`'s day-level CLI harness — which has no rooms to check at all — keeps rolling the full pool exactly as before, unaffected). `Hub.ts`'s `runNpcEncounter` now computes it explicitly: `npcA.room === "recroom" && npcB.room === "recroom"`, and passes it through. When false, the three real minigames drop out of the pool entirely — the pair still gets an ordinary Talk, it just can't roll into "played poker" while standing in Hangar Deck or Berths.

## Verification — now including a real live-browser pass

Maxime's own follow-up: *"you should have access to the claude app to test everything."* Correct that logic-tracing plus typecheck/lint/test/build isn't the same as watching it actually happen — this device has no shell on Maxime's own computer, so a dev server can't run there, but the exact same repo is already staged in this session's own cloud sandbox, which DOES have Chromium pre-installed and this project's own existing Playwright harness (`tools/verify/`, built 31 Aug 2026 for a prior pass). Reused that rather than skipping the live check:

- Full sandbox rebuild: entire `src/` tree, `tools/`, root config staged fresh, `npm install`, `npx tsc --noEmit` / `npx eslint .` / `node tools/lint-spoiler.mjs` (clean, skips with a warning — no `.env.local` in this sandbox, same as every prior cloud-sandbox run) / `npx vitest run` — **1337/1337 passing**, zero regressions — / `npm run build` — clean.
- `npx tsx src/sim/runSocialSim.ts` spot-run — confirmed the CLI day-sim harness still rolls pegBoard/poker/fletchers exactly as before (no `minigamesEligible` passed there, defaults to eligible, by design).
- **New:** `npx tsx tools/verify/genSave.ts` (15-pilot midgame save) + a new one-off Playwright script, `tools/verify/checkDebriefAndMinigameGate.mjs` (committed alongside `checkHubNpcs.mjs` as a second reusable check, per that folder's own README), booted the REAL dev server in the sandbox and drove the REAL chat UI (T, type, Enter — not a bypassed `submitChat()` call):
  - No mission flown, ask the CO "debrief" → `"Nothing to report yet — you haven't flown a mission."`
  - A win on record, ask "brief" → `"Good work out there. The pack held together the whole way through."` (a real wolf-catalyst `missionWin` line, confirming the content reuse actually renders)
  - A loss on record, ask "debrief" → `"Rough one. We're closing ranks tighter until it stops feeling like this."`
  - Ask a different NPC (not the CO) "debrief" → `"Ask the CO about that — find him in the grotto."`
  - Zero console/page errors across the whole run.
  - Ambient minigame gate: called the real, committed `runNpcEncounter` 300 times directly against two NPCs forced into Hangar Deck — 32 real "talk" encounters fired (confirming the function actually ran, not a no-op), **zero** mentioned pegBoard/poker/Fletchers. (One of those 32 lines happens to contain the word "brief" in an unrelated, pre-existing sense — "You skimmed the brief... Read. The. Brief." — pre-existing ambient content about a mission briefing document, not this feature; flagged so it doesn't read as a false positive later.)

This is a stronger verification than the previous pass — the fixes are now confirmed against the actual running game, not just logic-traced and unit-tested.

Committed to the real device repo with a fresh mtime-drift check on every touched file immediately beforehand, zero conflicts: `src/data/chatIntent.ts`, `src/scenes/Hub.ts`, `src/data/__tests__/chatIntent.test.ts`, `src/engine/socialSim.ts`, `src/engine/__tests__/socialSim.test.ts`, `tools/verify/checkDebriefAndMinigameGate.mjs` (new), `tools/verify/README.md`. `save.json`/screenshots/`debrief_report.json` are sandbox-only, same "not committed — regenerate it" convention `genSave.ts` already documents — not written back to the device.

**Master Index note:** this addendum isn't yet referenced from `claude/Bloom_Wars_Master_Index.md` — say the word if you want a pointer added there too.
