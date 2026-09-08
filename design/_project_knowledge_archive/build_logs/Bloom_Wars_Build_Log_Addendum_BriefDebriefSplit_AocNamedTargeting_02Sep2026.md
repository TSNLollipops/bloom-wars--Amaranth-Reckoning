# THE BLOOM WARS — Build Log Addendum: Brief/Debrief Split + "aoc" Named-Targeting Fix (Playtest Tally Item 7), 2 Sep 2026

Follow-up to the same day's earlier `Bloom_Wars_Build_Log_Addendum_ChatBriefDebrief_AmbientMinigameRoomGate_02Sep2026.md` pass, which is what introduced the bug this one fixes. That pass folded "brief" and "debrief" into one shared `DEBRIEF_KEYWORDS` bucket on the read that both meant "tell me about the mission." Maxime's playtest caught the actual gap same day.

## The report

Maxime, verbatim: *"curently playtesting tally bug. brief does the same thing as debrief. it should not. brief is before a mission debrief is after a mission. arrangemnt of content should regonise itself if the player say aoc, debrief. or aoc, brief."*

Followed immediately by an explicit hold — *"dont fix yet. just tally and plan"* — so this went through two passes: a diagnosis-and-plan-only tally entry first (item 7 in `Bloom_Wars_Playtest_Notes_Running_Tally_29Aug2026.md`), then the actual build once Maxime said *"you can apply fix now."*

## Diagnosis (unchanged from the tally entry — recapped here for the standalone record)

**Part A — one shared bucket.** `chatIntent.ts`'s `DEBRIEF_KEYWORDS = ["brief", "debrief"]` fed a single `detectDebriefRequest()` returning a plain boolean, so `Hub.ts`'s `submitChat` always routed both words to the same `handleDebriefRequest()` — the POST-mission recap only. No PRE-mission content existed anywhere in the build; "brief" had nowhere else to go.

**Part B — no named-targeting for the CO.** The five CO-only gates (build/debrief/confide/remove-pilot, and now brief) checked physical proximity only — whichever NPC was nearest within `APPROACH_RADIUS`. The six social-action verbs (praise/insult/gift/etc., same day) already had this solved via `resolveChatTarget()`/`extractNamedTarget()`, which tries a named match before falling back to nearest — but even that machinery wouldn't have caught "aoc": `extractNamedTarget` only matches literal words split out of the CO's real `displayName`, "Arangement of Content" ("Arangement"/"Content" survive its filter; "of" is dropped for being under 3 characters). "aoc" isn't a substring of that name anywhere — it needed its own alias list.

## What shipped

**`src/data/chatIntent.ts`** — split the joint bucket. `DEBRIEF_KEYWORDS` is now `["debrief"]` only (unchanged behavior, still wired to the existing post-mission recap). New `BRIEF_KEYWORDS = ["brief"]` / `detectBriefRequest()`, identical shape to the debrief detector. New `CO_ALIASES = ["aoc"]` / `mentionsCoByAlias()`, same `\b`-word-boundary-anchored `countHits()` pattern every other keyword bucket in this file already uses — which is also exactly why "brief"/"debrief" never collided with each other in the first place (no boundary between "de" and "brief" inside the word "debrief") and why "aoc" won't false-match inside an unrelated word either.

**`src/scenes/Hub.ts`** — new `isReachingCo(raw)` helper, replacing the repeated `nearestNpcInRange` + `pilotId !== CO_PILOT_ID` check that used to be copy-pasted across all five CO-only gates:

```ts
private isReachingCo(raw: string): boolean {
  const nearby = this.nearestNpcInRange(APPROACH_RADIUS);
  if (nearby?.pilotId === CO_PILOT_ID) return true;
  if (!mentionsCoByAlias(raw)) return false;
  const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
  return !!co && sameDeck(co.room, this.currentRoomId);
}
```

Scoped to "same deck as him," not "anywhere on the ship" — the identical scope `resolveChatTarget` already uses for the six social verbs, not a new, bigger "radio the CO from anywhere" behavior. The grotto happens to be alone on its own deck (same as the Spar Room), so in practice this means: anywhere in the grotto reaches him by name, even out of physical bubble range; anywhere else on the ship still doesn't, alias or not. New `handleBriefRequest()` alongside the existing `handleDebriefRequest()`. All five CO-only gates (build/debrief/brief/confide/remove-pilot) now call `isReachingCo()` instead of repeating the old inline check.

**`src/data/__tests__/chatIntent.test.ts`** — new coverage for both new functions: `detectBriefRequest` recognizes "brief" and not "debrief" (the exact inverse of the bug report); `mentionsCoByAlias` recognizes "aoc" case-insensitively as a real word and does not false-match it as a substring inside a longer word (`\b`-boundary regression test).

## Two open questions, answered by default rather than left blocking

Neither got a direct answer before the go-ahead, so both were resolved with the smallest, most reversible option and are flagged here for correction if you want something different:

1. **What "brief" actually says.** Went with the minimal placeholder option flagged in the tally plan — `"No formal briefing drawn up yet — check the mission board for what's on offer."` — same "for now" scoping the original debrief feature itself got, zero new systems touched. The two bigger options (name-dropping the next available mission, or a real per-mission objective briefing) are still open if you want either later.
2. **CO_ALIASES scope.** Shipped with just `"aoc"`. Didn't add "commander" or "co" — a bare two-letter "co" risks false-matching ordinary sentences far more than "aoc" does, and the report only ever used "aoc." Easy to extend the list later.

## Verification

Full non-browser suite, all clean: `tsc --noEmit`, `eslint .`, `lint-spoiler.mjs` (skips with a warning as expected — no `BW_RESERVED_TERM` in this cloud sandbox, same as every prior pass), `vitest run` at 1543/1543 passing, `npm run build`, both simulation scripts.

Then a live-browser Playwright pass (new script, `tools/verify/checkBriefDebriefSplit.mjs`, same pattern as `checkDebriefAndMinigameGate.mjs` — real dev server, real DOM chat box, T/type/Enter, never a bypassed `submitChat()` call) against the actual running game, all 9 checks passing with zero console/page errors:

- Standing at the CO's own spot, no mission flown: "debrief" → `"Nothing to report yet — you haven't flown a mission."`; "brief" → the new placeholder. Genuinely different lines.
- A win recorded: "debrief" now reflects it (`"Good work out there..."`); "brief" stays the exact same placeholder as before the win — proving brief never quietly reuses debrief's content.
- Standing in the grotto but far enough from the CO's own spot to fail the old proximity check (100px away — outside `APPROACH_RADIUS`=78 but still inside `TALK_RADIUS`=130, so the redirect line is actually visible rather than silently swallowed): plain "debrief" redirects (`"Ask the CO about that — find him in the grotto."`); "aoc, debrief" and "aoc, brief" both reach him anyway, correct content each.
- Standing on a different deck entirely (rec room): "aoc, debrief" still redirects — confirms the alias is scoped to his own deck, not the whole ship.

## Committed to the device repo

Fresh mtime-drift check on all three touched files immediately before sending — zero drift, zero conflicts (this session's earlier stage of `Hub.ts` had already picked up an unrelated concurrent "House Standing" pass mid-session; re-confirmed clean before this commit): `src/data/chatIntent.ts`, `src/scenes/Hub.ts`, `src/data/__tests__/chatIntent.test.ts`. The new verify script and its generated `save.json`/report are sandbox-only, same convention as the rest of `tools/verify/` — not written back to the device.

**Master Index note:** same as the earlier same-day addendum, this one isn't yet referenced from `claude/Bloom_Wars_Master_Index.md` either — say the word if you want a pointer added there too.
