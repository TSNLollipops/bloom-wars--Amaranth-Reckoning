# Morning Report — 4 September 2026

You went to sleep with *"there many plan done today, i'm going to sleep you
got full creative power. complete as many of them as you can. they are all
kinda important."*

**Everything below is already on your machine, in the real repo, verified.**
Nothing is sitting in a sandbox waiting for you to pull it. Two things need
your call and are flagged as such; nothing was decided on your behalf.

Gates at commit: `tsc`, `eslint`, `lint-cast-collision`, `vite build` clean.
**87 test files / 2020 tests** (up from 1968). `npm run sim`, `sim:social`,
`sim:gate` and the new `sim:recroom` all clean. **All 14 live Playwright
scripts in `tools/verify/` pass**, including two I had to fix first.

---

## 1. The Rec Room standings board is real — this is the one to go look at

`claude/Bloom_Wars_Rec_Room_Standings_And_NPC_Learning_Plan_v1.md`, slices
1 through 6. Load a save, walk into the Rec Room, press **B**. There's also
a board on the wall in the games corner you can walk up to and press E.

You get a ranked table of everyone aboard at the peg board, poker and
Fletchers — four tabs, the crew and you on the same board, ranked inline,
exactly as you asked for it on 2 Sep. Pilots who are gone keep their row,
greyed, with the day they were lost next to it. Underneath the table is the
line the points column can't say: *"Best player aboard: Corin Lask (skill
43) — 6th on the board."*

And the crew genuinely play each other now. Poker and Fletchers were a coin
flip narrated as a game; they're real sessions, and the bubble reports the
score instead of an apology about being abstracted.

This reverses the *"NPC learning — closed, filed as someday"* call from
26 Aug. That was closed for one stated reason — it needed persistence that
didn't exist — and that reason has been gone for about a week.

**Slice 7 (banter, a hot topic when #1 changes, a Highlights milestone, a
codex entry) is deliberately not built.** It's the slice that's content
rather than mechanism, and it wants your voice, not mine.

## 2. The tuning harness broke three of my own numbers, which is the point

`npm run sim:recroom` — four checks, run it yourself. It failed two on its
first run and I'm glad it did:

- **A knob I'd written was making play *worse*.** `PegSkill` had a
  `lookahead` parameter that switched on a two-ply search for strong
  players. At equal skill, where both sides used it, seat A's win rate
  collapsed from 51% to 10.7%. I took it out rather than repair it — a knob
  you have to fix before it helps isn't a knob.
- **Poker skill was decorative.** Skill-70 vs skill-30 measured 50.3% — a
  coin flip. Two rounds of real fixes later it's 52.4%, and 58% at the
  extremes. Statistically solid, honestly small. Eight hands of heads-up
  no-limit is dominated by cards; that's true of real poker too.
- **Darts was too decisive.** 99.9% for the better player. That's not a
  game — the underdog never has a night. Retuned to 91%.

## 3. What needs your call

**a) Poker's skill edge is small (52%).** Raising it means either a lot more
hands per NPC sitting (frame cost) or capping raise sizing so single pots
stop deciding sessions — and that second one changes how the table plays
when *you* sit at it. Both are real design decisions, so I wrote them down
instead of picking one. Over a few hundred ambient sessions a 52% edge does
separate the ladder, which the harness's check 3 shows.

**b) The Undertow ambush fix is built and shipped OFF.** One word in
`engine/ai.ts` (`ENABLE_UNDERTOW_AMBUSH_HOLD`) turns it on. I built it
exactly as your scoping note specified, then ran that note's own
verification plan, and it says don't ship it yet:

- **Mission 22 — the mission it was for — didn't move at all.** 0% / 0% / 2%
  at n=500 per tier, identical with it on and off.
- The full 76-mission sweep moved nine missions. Re-measured at n=200:
  `amaranth_4` **27% -> 0%, with 122 of 200 runs timing out** (from zero);
  `amaranth_26` 100% -> 82%; `amaranth_29` 61% -> 33%;
  `house_amaranth_15` 0% -> 53%; `house_amaranth_21` **5% -> 95%**.

Mission 4 timing out is exactly the failure your own note warned about by
name. Rebalancing five missions, one into a timeout, isn't something I
should decide while you're asleep. Your note's instinct — that the last
change of this class looked safe and wasn't — was right a second time.

Proof the shipped balance is untouched: the sweep at the same seed after the
flag went in returns 909/1900 (48%), byte-identical to the baseline.

## 4. Three bugs found and fixed that nobody asked about

- **`anyOverlayOpen()` was missing `vaultOpen`.** `update()`'s early returns
  hid it from the hotkeys, but the hover tip is wired to the *pointermove
  event*, not to `update()` — so moving the mouse with the Vault open popped
  a tip about whichever NPC was underneath the panel.
- **`npx eslint .` was red on the repo as it stood** — a comma expression in
  `checkHangarShopFitsDock.mjs` from the 4 Sep commit. Fixed.
- **`checkVaultShelf.mjs` was clicking one button and grading another.** It
  took the *first* `[ rank up ]` on the shelf — Vindex's — and then asserted
  about Iron Word. It fails identically on the untouched code that was on
  your machine, which I confirmed by running it against a pristine copy, so
  it's not from tonight. It looked frightening (250 points spent, rank still
  1, i.e. *"the player pays and gets nothing"*) and it isn't: dumping the
  ranks map showed Vindex correctly at rank 2. **The game was never wrong.**
  The check has been passing that assertion on a technicality since the
  shelf shipped.

## 5. The UI audit's blind spot from your phone photo is closed

Your 4 Sep note flagged it and left it: the sweep compared labels against
the 1074x640 canvas, not against a scene's own possibly-narrower camera
viewport — Hub's main camera stops at 838 because the OVERHEARD dock owns
the rest. It measures the right rectangle now, and there's a self-test case
that specifically fails on the old rule and passes on the new one.

The sweep's own save also had every pilot at 0 points, so the long strings
that clip never existed on screen; it now carries a realistic spread plus
one deliberately extreme balance.

**Honest limit:** I could not get that original Hangar Shop clipping to
reproduce from the sweep's save even with your `fitWidth` fix removed. So
the *rule* is fixed and proven; it is not proven that the sweep would now
catch that exact screen.

## 6. Worth knowing

The 28-screen sweep is **not deterministic** — it reported one finding on
one run and zero on the next with no code change in between, because Hub
NPCs roam and a label's position decides which button it pairs with. A
single clean sweep isn't proof.

## 7. Still open, honestly

- Slice 7 above, and the aptitude table's 27 numbers are flavour — yours to
  overrule. Three character reads have tests pinning them as deliberate
  (the shark is the card shark, the bear doesn't bluff, the crow has the
  quick hands); the rest are a first pass.
- I couldn't run `lint-spoiler` — `BW_RESERVED_TERM` lives in a git-ignored
  `.env.local` that isn't in the sandbox. I kept every new player-facing
  string to game-native vocabulary, but **run `npm run lint` once on your
  machine** before shipping anything from tonight.
- `Bloom_Wars_Walkable_Hub_Build_Plan_v1.md` §15/§16 still says NPC learning
  is "filed as someday". I left it alone because the project copy and the
  on-device copy of that file have diverged, and picking the wrong one at
  4am is how doc drift gets worse instead of better. Worth a look.
- The GDD and Data Pack have no entry for the new persistent state slice,
  the panel, or the aptitude table — same `.docx` blocker as always.

## The docs

- `claude/Bloom_Wars_Build_Log_Addendum_RecRoomStandings_NpcLearning_04Sep2026.md`
- `claude/Bloom_Wars_Build_Log_Addendum_UndertowAmbushHold_ShippedOff_04Sep2026.md`
- `claude/Bloom_Wars_Build_Log_Addendum_VerifyToolBlindSpots_04Sep2026.md`

Both plan docs have their status corrected in place, with the divergences
between what they predicted and what measurement actually said left visible
rather than tidied away.
