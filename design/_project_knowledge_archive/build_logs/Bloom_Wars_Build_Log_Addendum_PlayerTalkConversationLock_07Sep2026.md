# Build Log Addendum — Player-Talk Conversation Lock, 7 Sep 2026

**Status: built, committed to the device, and now live-verified against the actual running dev build on Maxime's machine. Still not toolchain-verified — `tsc --noEmit`, `eslint`, and `vitest` have not been run, and the production build (`vite build`, as opposed to the dev server) has not been checked either. See section 5 for exactly what "live-verified" does and doesn't cover.**

Maxime, verbatim: *"today I said hello to one of my ant. it replied but it didnt stop it kept walking fast in the direction it wanted. we gotta fix that bug, if an npc talk to another they stop moving for 15sec or something so you can have other convo with them. and itl help the ant talk to each other too."*

## 1. This looked like a duplicate of an already-shipped fix. It wasn't.

`Bloom_Wars_NPC_Conversation_Lock_Fix_Proposal_05Sep2026.md` (5 Sep) and its build addendum, `Bloom_Wars_Build_Log_Addendum_NpcLockPortraitRevertWorriesStep2_06Sep2026.md` (6 Sep), already cover an NPC-conversation-lock bug with almost the same symptom. Read both, then read the live `Hub.ts` off Maxime's machine directly (540,875 bytes at the time), per this project's own standing discipline of verifying against the actual file rather than the doc's own claim.

**The 6 Sep fix is real and still correct — but it only ever covers ambient ant-to-ant chatter.** `HubNpc.engagedUntil` (checked via `isNpcEngaged()` in `updateNpcRoaming()`/`updateNpcEncounters()`) is set by exactly three functions: `runNpcEncounter()`, `runAngerBlowup()`, `runBoredomSpar()` — the three functions that stage an unprompted exchange between two idle ants. Grepping the file's ~57 `showBubble()` call sites (the function that actually draws a reply) found only those same three touching `engagedUntil` at all. Every PLAYER-initiated exchange — Talk, hello/bye, worry check-in, advice, banter, Share a Drink, Ask Out, Gift/Praise/Insult/Apology/Congratulate/Send-Off, every CO command (build/debrief/brief/confide/remove-pilot), and the generic chat fallback/dictionary-reaction paths — calls `showBubble()` directly and never touched `engagedUntil` at all. `bubbleUntil` (also set inside `showBubble()`) only ever controls how long the speech-bubble graphic stays visible — cosmetic, never wired to movement.

**A second gap, not caught by the 6 Sep fix and not mentioned in either prior doc:** `updateNpcMovement()` — the function that actually steps an ant toward wherever it's walking — checks only whether `targetX` is set, never `engagedUntil`. The 6 Sep fix never needed to handle this: `updateNpcEncounters()`'s own pairing guard only ever starts an ambient encounter between two ants that are *already idle* (`targetX === undefined`), so there was never a walk in progress to interrupt. The player has no such restriction — you can walk up and greet an ant that's already mid-route to somewhere else. Setting `engagedUntil` alone, without also clearing that ant's current target, would only have stopped it from picking a NEW destination once it finished the walk it was already on — which reads exactly like Maxime's report: the ant replies, and keeps walking to wherever it was already headed.

## 2. What shipped

Two design calls, put to Maxime directly rather than guessed (AskUserQuestion, both answered before any code):
- **Hold duration: kept the existing 7.8s (`NPC_ENGAGEMENT_HOLD_MS`)**, not the flat 15s first mentioned. A player-talk reply bubble itself disappears after 2.6–6s depending on line length (`showBubble()`'s own duration formula); 15s flat would leave the ant standing silently for several seconds after it's done talking, which reads as its own bug. Reusing the exact constant already tuned and shipped for the ambient case avoids a second number to maintain.
- **Scope: only face-to-face player talk, not every `showBubble()` call.** A blanket fix inside `showBubble()` itself would have been fewer lines, but it would also freeze an ant that's just the SUBJECT of a rumor landing in a room the player isn't even in, or an ant acknowledging a muster call and immediately relocating — cases where holding still is either meaningless (nobody's watching) or actively wrong (muster's whole point is "reply, then go").

**`Hub.ts` gained one helper**, `holdForPlayerTalk(npc)`, placed directly above `showBubble()`:

```ts
private holdForPlayerTalk(npc: HubNpc) {
  const now = this.time.now;
  npc.engagedUntil = now + NPC_ENGAGEMENT_HOLD_MS;
  npc.targetX = undefined;
  npc.targetY = undefined;
  npc.path = undefined;
  npc.stuckMs = 0;
}
```

Reuses the exact `engagedUntil`/`NPC_ENGAGEMENT_HOLD_MS`/`isNpcEngaged` machinery the 6 Sep fix already built and tested — no new field, no new constant. Clearing `targetX`/`targetY`/`path`/`stuckMs` mirrors `updateNpcMovement()`'s own genuine-arrival branch exactly, so an ant caught mid-route actually stops where it is rather than sliding to a finish. A mid-door-hop ant (`travelTargetRoom` still set) is untouched by this and resumes its trip on its own once `engagedUntil` lapses — `updateNpcRoaming()`'s existing journey-resume branch (the same recovery shape `sendToMuster`'s cross-deck fix already leans on) re-paths from wherever it actually stopped, so no new recovery logic was needed for that case.

**Called at 38 of the file's 57 `showBubble()` call sites** — every one that's a direct, face-to-face reply to something the player did:
- `submitChat`'s small-talk branch: the greeting/farewell broadcast loop, and the worry-checkin/advice/banter single-target case.
- The eight single-target crew verbs: `shareADrink`, `giveGift`, `praiseNpc`, `insultNpc`, `apologizeToNpc`, `congratulateNpc` (both its branches), `sendOffNpc`, and all four `askOut` outcome branches.
- All five CO command handlers: `handleBuildRequest` (all six outcome branches), `handleDebriefRequest`, `handleBriefRequest`, `handleConfideRequest`, `handleRemovePilotRequest` (all three branches).
- `showFallback()` (the generic "didn't understand, everyone in range shrugs/redirects" broadcast) and `showCatalystOrFallback()` (the catalyst-dictionary/hot-topic/shrug broadcast, all four of its branches including the delayed catalyst-clash rebuttal).
- `speak()` — the ordinary press-Talk-once broadcast verb, all six of its branches (stage-promotion reveal, rank-deference greeting, CO Tier-3 callout, relationship-stage banter, hot topics, ordinary Gate-0 ambient chatter).

**Deliberately left untouched (19 remaining `showBubble()` call sites), and why:**
- `runNpcEncounter`/`runAngerBlowup`/`runBoredomSpar` (8 sites) — already correctly handled by the 6 Sep fix, nothing to add.
- `askOut`'s own gossip-propagation branch, `startRumor()`, and `propagate()` (5 sites) — ambient rumor relay that travels the ship on its own via delayed calls, not a face-to-face reply.
- `broadcastMessage()`'s two branches (muster acknowledgment and decline) — muster's whole point is "reply, then relocate"; holding the ant still would fight the mechanic it's supposed to trigger.
- `updateBreakdownTrigger()`/`resolveBreakdown()` (2 sites) — an autonomous per-tick status event, not a reply to anything the player said.
- `pegBoard`/`poker`/`darts` closing lines (`closingNpc`, 3 sites) — minigames already gate other interaction behind their own `pegOpen`/`pokerOpen`/`dartsOpen` flags; whether an ant should also be held still through a full minigame session is a related but separate question, not investigated this pass.
- `provoke()` — an explicitly-flagged debug/prototype "telephone-wave" trigger, not a player-conversation verb.

## 3. Verified, and not verified — as of the original build

**Verified:** every one of the 38 insertion points was read in its real surrounding context before editing (not pattern-matched blind), cross-checked afterward by grepping both `showBubble(` and `holdForPlayerTalk(` call counts (57 and 38) and confirming the 19-site gap list above matches exactly, and confirmed brace-balanced across the whole file (a Node script walked every `{`/`}` in the file: net zero, never went negative). `HubNpc.engagedUntil`/`targetX`/`targetY`/`path`/`stuckMs` are all pre-existing optional fields — no type surface changed.

**Not verified at build time:** no shell on Maxime's machine that session, so `tsc --noEmit`, `eslint`, `vitest`, and `vite build` had not run against this change at all, and nobody had watched an ant actually stop on screen.

## 4. Open question, not decided this pass

Should the three minigames (peg board, poker, Fletchers) hold the opponent NPC in place for their full session, the same way ordinary talk now does? Not investigated — `pegOpen`/`pokerOpen`/`dartsOpen` already gate most other interaction while a minigame is open, so the practical impact of NOT holding the ant is unclear without checking whether the Hub's own roaming/movement update still runs (and is visible) while one of those panels covers the screen. Worth a quick look next time this area gets touched, not urgent enough to block this fix.

## 5. Live-verified against the real running dev build, same day — read the fine print

Maxime offered Chrome (the Claude in Chrome browser extension, driving his actual Chrome on his actual machine) after asking whether the earlier work had actually succeeded. His dev server was already running at `localhost:5173` — loaded it, no console errors, Phaser initialized clean, and `window.__bwGame` exposed the live Phaser instance, which made a direct, real check possible rather than another round of reading code.

Loaded his existing save into the Hub (Rec Room). Read the live scene's `npcs` array directly and found `pilot_bosk` genuinely mid-route — `x/y` at (244.8, 715.9), walking toward a `targetX/targetY` of (1101.3, 715.8), `engagedUntil` unset. Keyboard-driven movement (WASD/arrows via the automation) didn't register with the game — likely a focus quirk between the automated key events and Phaser's keyboard capture, not something resolved this pass — so rather than fight it, the player was repositioned next to Bosk directly through the same live scene reference, and `scene.speak()` was called — **the literal, compiled, unmodified method a real E-press triggers**, not a reimplementation or a mock.

Immediately after that single call: `engagedUntil` became `now + 7800` (matching `NPC_ENGAGEMENT_HOLD_MS` exactly), `targetX`/`targetY`/`path` all went to `undefined`, `stuckMs` reset to 0, and Bosk's `x`/`y` had not moved at all from the pre-call reading — he stopped dead where he was, not mid-slide toward the old target. A screenshot taken right after shows it visually too: the player standing on top of Bosk, a relationship-stage banner overhead ("M.Sgt. Halvard Bosk [Blooded] ♥ dating Bosk's Mek"), and a real reply line in the Overheard log ("HB: Upgrade came through. Good — means fewer of my own lessons get learned the hard way from here."). A later read of the same NPC (after enough real time had passed for the 7.8s hold to lapse) showed `engagedUntil` in the past and a fresh, nearby `targetX`/`targetY` — roaming had resumed on its own, exactly the journey-resume behavior the fix was designed to fall back to. No console errors at any point in the sequence.

**What this does and doesn't prove.** This confirms, on Maxime's own machine, against his own save, that the actual shipped `holdForPlayerTalk` function does exactly what sections 1–2 describe when the real `speak()` path calls it: it freezes a genuinely mid-walk ant in place, clears its route, and lets it resume roaming on its own once the hold lapses. That's the functional heart of the bug fixed, live, not just reasoned about.

What it does NOT confirm: `tsc --noEmit`, `eslint`, and `vitest` still have not been run — Vite's dev server (what was running here) transpiles TypeScript without type-checking it, so a real type error could still exist even though the dev build loads clean. Neither has `vite build` (the actual production build). And this test used direct scene access to reposition the player and call `speak()`, not Maxime literally walking up with WASD and pressing E himself — the keyboard-movement gap above is worth Maxime trying on his own end, since it's possible it's specific to the automation and not something he'd hit at all, but it hasn't been ruled out as a real issue either. Before this is fully done by this project's own gate: the toolchain, and Maxime's own hands-on pass through the same interaction.
