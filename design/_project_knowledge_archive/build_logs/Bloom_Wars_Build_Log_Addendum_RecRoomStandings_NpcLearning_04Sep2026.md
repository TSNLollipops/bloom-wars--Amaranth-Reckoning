# Build Log Addendum — Rec Room Standings & NPC Learning, slices 1–6 (3–4 Sep 2026)

Built unattended overnight, on Maxime's own hand-off: *"there many plan done
today, i'm going to sleep you got full creative power. complete as many of
them as you can. they are all kinda important."*

Source plan: `claude/Bloom_Wars_Rec_Room_Standings_And_NPC_Learning_Plan_v1.md`
(2 Sep 2026). Its own §0 is worth re-reading — this reverses a decision
filed as *"NPC learning — closed, filed as someday"* in
`Bloom_Wars_Walkable_Hub_Build_Plan_v1.md` §16, for a reason that stopped
being true about a week ago. All six no-UI-decision slices are now built,
verified, and on the device.

---

## What a player can actually do now that they couldn't yesterday

Walk into the Rec Room, press **B** (or walk up to the new board on the
wall and press E), and see a ranked table of everyone aboard at the peg
board, poker and Fletchers — the crew's records and yours, on the same
board, ranked inline. Pilots who are gone keep their row, greyed, with the
day they were lost beside it.

And the crew now genuinely play each other. Poker and Fletchers used to be
a coin flip narrated as a game; they are real sessions now, and the bubble
says the score.

---

## Slice by slice

**Slice 1 — the three engines became seat-agnostic.** `holdem.ts` had a
seat literally called `"human"` and a decision function hardcoded to seat 1;
the rules of Hold'em do not change based on who is sitting there. Each
engine now exposes a parameterized decision function (`pickSeatAction`,
`pickMove`, `pickThrowValue`) taking a skill object, with every previously
exported function kept at its exact old signature and delegating at a
default that reproduces the shipped behaviour byte for byte — including the
same sequence of `Math.random()` calls, which matters more than it looks:
a test that stubs `Math.random` would otherwise see its values consumed in
a different order and fail for reasons unrelated to what it was testing.

**The check on that slice was that no existing test changed. None did.**
`darts.test.ts`, `pegBoard.test.ts`, `holdem.test.ts` and both `cardTable`
suites — 75 cases — stayed green with zero edits, through slice 1 and
through every later retune, because the retunes only ever touched the
`*SkillFor` mappers and skill-gated branches, never the defaults.

**Slice 2 — the record store.** `engine/recRoomRecord.ts` (pure, no Phaser)
and `data/recRoomAptitude.ts` (a 9-catalyst × 3-game table, an archetype
nudge, and a deterministic per-pilot jitter so two ravens are not clones).

Skill is **derived, never stored**: `skill = aptitude × (1 − e^(−played/25))`.
The general habit worth taking from it — *store what happened, derive what
it means*. `played` is a fact; skill is an interpretation of it. Keeping
only the fact means no second copy to drift, no way for a bug to corrupt
someone's skill, and no save migration if the curve is ever retuned.

Standing is `wins × 3 + draws × 1`, ties broken by win rate, then by fewer
games played, then by name. No Elo, deliberately: a player can read this off
the screen and know what would move it.

**Nothing ever deletes from `records`.** That rule has a loud comment in the
file and a test named after it, because it looks exactly like a bug to
whoever eventually writes a save-cleanup pass and sees keys pointing at
pilots who are not on the roster. Those are not orphans. That is the
feature Maxime asked for by name on 26 Aug.

**Slice 3 — your own sessions are recorded**, from `finishPegBoard` /
`finishPoker` / `finishDarts`, both sides, with the calendar day stamped
and a real keepsake score (darts total, final poker stack; the peg board
has no score at all, so it stores none rather than inventing one).

**Slice 4 — the board.** `scenes/ui/StandingsPanel.ts`, a standalone class
Hub owns and toggles, following `ShopPanel`'s precedent rather than adding
a ninth overlay method to a file that is already 8,000 lines and 500 KB.
All ranking lives in `recRoomRecord.ts`'s `buildStandings`, on the testable
side of the Phaser line.

`CampaignPilotEntry.lostContext` gained a `lostOnDay` field — the day a
pilot was lost existed nowhere in the save until now (that context recorded
the mission and the turn, not the date), and the board wants to say it.

**Slice 5 — the coin flip is gone.** `resolveAbstractedMinigameEncounter`
now routes to real `resolvePokerEncounter` / `resolveFletchersEncounter`.
`EncounterResult` gained a real `winner` field: the only previous statement
of who won lived inside the human-readable `summary` string, and parsing
that back out would have been a bug waiting for the first reworded line.
NPC poker is capped at **8 hands, scored on chips**, and the cap is stated
in the summary rather than hidden — a full sitting to bust-out can run
hundreds of hands inside one Hub frame, and two crew on a break do not play
until one of them is broke anyway.

**Slice 6 — `npm run sim:recroom`.** Four checks. It earned its keep on the
first run by failing two of them.

---

## What the harness caught, and what changed because of it

**1. A knob I wrote was making play worse, and it came out.** `PegSkill`
originally had a second parameter, `lookahead: 1 | 2`, switching on a
two-ply search for strong players. At 90-vs-90, where both sides used it,
seat A's win rate collapsed from a healthy 51% to **10.7%**. The extra ply
was not making anyone play better — it was making whoever used it markedly
worse, and asymmetrically. It was removed rather than repaired: a knob that
has to be fixed before it helps is not a knob, and shipping it as
decoration would have made the system harder to reason about, not easier.
`bestMoveChance` alone gives the stronger player a clear, measured edge.

**2. Poker skill was decorative, and is now real but small.** First
measurement: a skill-70 beat a skill-30 **50.3%** of the time — a coin
flip. Two rounds of real fixes followed, each measured: a calling-station
leak (a weak player paying off hands he should fold — the leak that
actually transfers chips, where folding correctly transfers nothing), a
systematic *overvaluation* bias (beginners misread their hand in one
direction, not symmetrically), and pot-relative raise sizing for NPC play
so single shoved pots stop deciding sittings.

Final: **52.4%** at 70-vs-30, **58%** at 100-vs-0. The edge is statistically
solid (z = 6.9 over 20,000 sessions) and honestly small, and the harness
prints that distinction rather than hiding behind a PASS. Eight hands of
heads-up no-limit is dominated by cards — that is true of real poker too.
Pushing it further means many more hands per sitting (frame cost) or
changing how the shipped human-vs-NPC table plays. **Neither is my call to
make**, so both are written down instead.

**3. Darts was too decisive and got loosened.** First tuning had a skill-70
beating a skill-30 **99.9%** of the time. That is not a game — the underdog
never has a night, and a board where the result was decided before anyone
threw is a table of aptitudes, not a record. Retuned to **91%**.

**4. The peg board is the expensive one, not poker** — about 1.45 ms a
session, against the plan's 1 ms line. Rather than quietly relax that line,
the check now has two tiers: a soft note at 1 ms and a hard budget at 4 ms
(what would actually hitch a 16.7 ms frame). **The 1.45 ms is pre-existing
and unchanged** — timing the exact pre-slice-5 shipped path gives 1.449 ms,
because `resolvePegBoardEncounter` has driven both sides through the real
engine since 26 Aug.

---

## Verification

`tsc` / `eslint` / `lint-cast-collision` / `vite build` clean.
**87 files / 2020 tests** (up from 1968), `npm run sim`, `sim:social`,
`sim:gate`, `sim:recroom` all clean, and every one of the 14 live
Playwright scripts in `tools/verify/` passes.

Beyond that: a new `tools/verify/checkStandingsBoard.mjs` boots the real
game against a save carrying 400 real NPC-vs-NPC sessions and one pilot
genuinely lost on day 94 through `applyMissionLosses`, presses **B** the
way a player would, clicks each tab with real mouse events at their real
screen coordinates, and reads the rendered table back. It confirmed the
room gate refuses to open the board from the Berths, that every tab is
screen-pinned (the container-renders/child-hit-tests trap this project
already has a rule about), that the dead pilot keeps his row, and that Esc
closes it. Zero console errors. Screenshots are in `tools/verify/`.

Two things that pass caught by looking at the actual render rather than the
assertions: pilot names were truncating mid-callsign in a fixed-width
column, and the dead pilot's rank was showing as "+" instead of the rank he
actually still holds. Both fixed.

---

## One pre-existing bug fixed in passing

`anyOverlayOpen()` in `Hub.ts` did not include `vaultOpen`. `update()`'s own
per-overlay early returns hid it from the hotkeys, but `updateHoverTip()` is
wired to the **pointermove event**, not to `update()`, so moving the mouse
with the Vault open still popped a hover tip about whichever NPC happened to
be underneath the panel. Fixed in the one place that decides "is the screen
owned right now."

---

## Honestly still open

- **Slice 7** (a banter slot, a hot topic when #1 changes, a Highlights
  milestone, a codex entry) is not built. It is the one slice that is
  content rather than mechanism, and it wants Maxime's own voice.
- **Poker's small edge**, above — a real decision, written down, not made.
- The **aptitude table's 27 numbers are flavour**, explicitly Maxime's to
  overrule. Three character reads have tests pinning them as deliberate
  (the shark is the card shark, the bear does not bluff, the crow has the
  quick hands); the rest are a first pass.
- The plan's §9 doc-drift list is only partly done: this addendum and the
  plan's own status are updated; `Bloom_Wars_Walkable_Hub_Build_Plan_v1.md`
  §15/§16 still says "filed as someday", and the GDD / Data Pack still have
  no entry for the new persistent state slice or the panel.
