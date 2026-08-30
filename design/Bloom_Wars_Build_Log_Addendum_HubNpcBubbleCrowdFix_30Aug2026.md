# Build Log Addendum — Hub NPC bubble-crowd throttle (30 Aug 2026)

Follows the same-day addenda on the hangar click-passthrough/depth bugs and the hold-zone visibility gap. This one's for Maxime's report: "got stuck. can you help make sure this doesn't happen again. ive been there for a while," with a screenshot showing a dense pile of overlapping NPC circles and overlapping status text ("Rourke's Mek and Marrow's... boarding Recruit Coldsnap... Marrow's Mek won. Bond +6." and more, stacked on top of each other).

## What it wasn't

Checked and ruled out, in order: the circle+initials NPC portrait style is the standard rendering for every NPC throughout the whole Hub (§12.2), not a special broken screen — the screenshot is the ordinary walkable floor, just severely crowded. There is no player/NPC collision anywhere in the scene (movement is WASD-only, not click-to-move, and a grep for collision logic near movement handling found nothing) — so nothing was physically trapping the player. Each individual NPC bubble already auto-hides on its own timer (`bubbleUntil`, capped `Math.min(6000, 2600 + line.length * 30)` ms) — no single bubble was stuck open forever.

## What it was

`updateNpcEncounters` — the system that has two settled, close, same-deck NPCs strike up a bubble exchange — carries its own comment dated 26 Aug 2026: *"O(n^2) over this.npcs, which is fine at today's roster size (3)... worth revisiting if the roster ever grows enough for that to matter."* Tier 3 (earlier this session) is exactly that: it switched Hub population from a fixed 3-pilot list to the full active campaign roster, 15-20+ pilots by midgame.

Nothing in the encounter system itself is broken — every pair's own cooldown (`nextEncounterAt`) still gates it correctly, one real thing per settled pair per tick, same as always. What changes at 15-20+ NPCs is what the player actually sees: `updateNpcRoaming`'s own same-room logic (clique-approach and mingle) actively walks bonded/idle NPCs toward each other, so a much bigger cast produces real physical clusters rather than just more scattered pairs. Once several NPCs are within `ENCOUNTER_RADIUS` of each other, the encounter scan can find and fire several *different* eligible pairs within the same few-second window — each one popping its own bubble. No single piece of that is stuck, but a spot with several NPCs in it never visibly clears, because something new keeps landing before the last thing finished fading. That reads as "stuck," even though every individual moving part is working exactly as designed. This matches Maxime's screenshot and "been there a while" description precisely.

## Fix

Added `MAX_CONCURRENT_BUBBLES_PER_DECK = 3`. `updateNpcEncounters` now counts how many bubbles are currently visible on the deck the player is actually looking at (`this.currentRoomId`) once per tick, and skips firing any *new* encounter for NPCs on that deck once it's at the cap. A skipped pair's own `nextEncounterAt` is left untouched, so it simply retries the next tick — the moment a bubble clears and a slot opens, the next eligible pair (possibly the same one) fires normally. This is a pure visual throttle: it doesn't touch cooldown timers, bond/stress math, or `runNpcEncounter`/`runAngerBlowup` themselves, and it only applies to the deck the player is currently viewing — encounters on other decks (not visible anyway) keep running in the background exactly as before, so their bond/stress state stays live and consistent for when the player does visit.

Deliberately scoped to the ambient NPC-vs-NPC encounter system specifically, since that's what the screenshot shows (third-person "X's Mek won against Y's" summaries, not first-person dialogue). Player-triggered Talk broadcasts (`speak()`, which lets every NPC within `TALK_RADIUS` respond to one keypress) are a related but separate system and weren't reported as a problem — noted here as a similar risk worth watching if the roster grows further, not something touched in this pass.

## For right now, in Maxime's live session

Since there's no player/NPC collision, walking in any direction (WASD) should move the player clear of a crowded spot even without this fix — the "stuck" feeling was visual/readability, not a physical block. This fix stops the pileup from reforming, but the current running session won't have it until the updated build is reloaded.

## Verification

Typecheck/lint clean, 1140/1140 tests passing. No test previously covered `updateNpcEncounters`'s bubble-visibility behavior (it's Phaser-scene UI, not engine logic under the existing headless test harness), so this is logic-traced and cross-checked directly against the actual roaming/encounter source, not click-tested live — same standing Playwright gap as every other Hub.ts/Battle.ts visual change this session, still worth closing with a real pass at some point.
