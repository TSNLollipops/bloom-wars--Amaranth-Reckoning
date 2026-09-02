# THE BLOOM WARS — Rec Room Standings & NPC Learning Plan v1

**Written 2 Sep 2026.** Nothing in this doc is built yet. This is the plan for
replacing `resolveAbstractedMinigameEncounter`'s coin flip with real NPC-vs-NPC
minigame sessions, giving every pilot a skill that grows with practice, and
putting a ship-wide standings board in the Rec Room.

---

## 0. Read this first — this reverses a filed decision

This exact feature is already on record, in your own words, from 26 Aug 2026.
`Bloom_Wars_Walkable_Hub_Build_Plan_v1.md` §15:

> "id love it if our npc csn get experience and learn to play those game good
> as time goes on"

plus the detail in the same message about a dead pilot's high score still
sitting on a leaderboard being heartwrenching.

§16 then closed it as **"NPC learning — closed, filed as someday,"** for one
stated reason:

> "gets better over time" only means something once it survives a reload,
> which is blocked on the same pilot-persistence decision flagged since §8

**That blocker no longer exists.** Since 26 Aug the Hub grew real persistence:
`CampaignState.npcSocial` (bonds, relationships), `CampaignPilotEntry.social`
(Favorability, Stress, Morale, drunk timer, social log), the calendar clock,
house standing, Heirloom recall flags. The reason this was deferred has been
gone for about a week.

So this plan is a **correction pass on §15/§16**, not a new idea. That doc needs
updating so it doesn't sit there saying "filed as someday" while the thing is
being built (§9 below).

---

## 1. What's actually in the code today

Checked against the real files, not remembered.

| Piece | State |
| --- | --- |
| `engine/pegBoard.ts` | `pickAiMove(state, aiSide)` takes a **side**, not a hardcoded seat. Genuinely side-agnostic. |
| `engine/holdem.ts` | `pickAiAction(state)` hardcodes seat index `1`. `preflopStrength` / `postflopStrength` / `decideAction` are module-private, not exported. |
| `engine/darts.ts` | `pickAiThrowValue()` takes **no arguments at all**. Skill is two module constants, `AI_SKILL_MEAN = 0.62` and `AI_SKILL_SPREAD = 0.28`. |
| `engine/socialSim.ts` | `resolvePegBoardEncounter` runs the **real** peg engine, both sides. `resolveAbstractedMinigameEncounter` is a `rng() < 0.5` coin flip for poker and Fletchers. Its own header says why, and says the fix means refactoring two shipped files. |
| Persistence | Nothing anywhere stores a per-pilot minigame result. Player sessions move Favorability / Morale / Stress and write a social-log line, then the result is gone. |

The placeholder you want gone is `resolveAbstractedMinigameEncounter`
(`socialSim.ts` line ~295). Its header is honest about being a stub — no silent
cap, which is why this is a clean thing to replace rather than a mess to
untangle.

**Good news that halves the work:** darts doesn't need a seat refactor at all.
`DartsPlayerId = "human" | "ai"` are just two labels — nothing in the engine
does anything human-specific with them. For an NPC-vs-NPC session, "human" is
seat A and "ai" is seat B, and the engine never knows the difference. Darts only
needs the *skill* parameter. Poker is the only real seat refactor.

---

## 2. Decisions you made (2 Sep 2026)

1. **Skill and rank are two separate numbers.** A practice-driven skill number
   that only ever climbs and drives how well the AI actually plays, plus a
   win/loss record that drives standing on the board.
2. **Starting aptitude is derived from catalyst + archetype** — deterministic,
   no hand-authored table, every future recruit has a personality on day one.
3. **You sit on the same board as the crew**, ranked inline, and beating you
   moves their record like any other session.

Everything below follows those three.

---

## 3. Making the engines seat-agnostic

### The idea, in plain language

Right now two of the three engines know there's a human on the other side of the
screen. `holdem.ts` has a seat literally called `"human"`, and the function that
decides a move is hardcoded to seat 1. That's the engine knowing something it has
no business knowing — the rules of Hold'em don't change based on who's sitting
there.

The fix is a pattern usually called **policy** (or **agent**): the engine only
ever says "it's seat X's turn, here's the legal state." Something *outside* the
engine answers "here's the move." A human's policy is "wait for a click." An
NPC's policy is "call this function with this skill number." The engine never
asks which one it's talking to.

The peg board already works this way, which is precisely why it's the one game
that can already run NPC vs NPC. This step is making the other two match it.

### The discipline that keeps it safe

**Every existing exported function keeps its exact current signature and
behaviour**, delegating to a new parameterized version at a default skill:

```ts
// darts.ts
export function pickThrowValue(skill: DartsSkill = DEFAULT_DARTS_SKILL): number { ... }
export function pickAiThrowValue(): number { return pickThrowValue(); }  // unchanged
```

The three suites currently have 599+ combined cases. **They must all stay green
with zero edits.** If a test needs changing, the refactor changed behaviour, and
that's a bug in the refactor — not a stale test. That's the check, and it's the
whole safety net for touching three shipped, working files.

(The general principle, worth having a name for: *make the change easy, then
make the easy change.* Slice 1 adds no features at all. It just moves the
furniture so the feature is a small step instead of a big one.)

### What "skill" means, per game

One number in storage, three different meanings — because a single generic
"difficulty" dial would need a different curve in each game anyway.

**Fletchers / darts.** Skill maps straight onto the two constants that already
exist: higher skill raises `mean` (aims closer to the bullseye) and tightens
`spread` (more consistent). Direct and honest.

```ts
export interface DartsSkill { mean: number; spread: number; }
```

**Peg board.** Skill maps to how often they actually play the best move, and how
far they look ahead. The current AI scores every legal move one ply deep and
takes the top one. A weak player often takes a random legal move instead; a
strong one always takes the best and searches two ply.

```ts
export interface PegSkill { bestMoveChance: number; lookahead: 1 | 2; }
```

**Poker.** Four knobs, each one a real poker leak — which is what makes
"learning" concrete and testable here rather than a vibe:

```ts
export interface PokerSkill {
  noise: number;           // decision jitter — a weak player is inconsistent
  potOddsRespect: number;  // 0..1 — does the price they're offered actually change their mind
  bluffRate: number;       // how often they fire without a hand
  valueSizing: number;     // how much of the legal raise span a strong hand takes
}
```

A bad player calls too much (ignores pot odds), never bluffs or bluffs at
random, min-bets or shoves with no middle ground, and plays the same hand two
different ways on two different days. Getting better *is* those four converging
toward well-calibrated values. That's a definition a test can check.

### Signatures

```ts
// holdem.ts — the only real seat refactor
export function pickSeatAction(state, seatIndex: 0 | 1, skill?: PokerSkill): BettingAction;
export function pickAiAction(state) { return pickSeatAction(state, 1); }   // unchanged

// pegBoard.ts
export function pickMove(state, side: PegSide, skill?: PegSkill): PegMove | null;
export function pickAiMove(state, aiSide) { return pickMove(state, aiSide); }  // unchanged

// darts.ts
export function pickThrowValue(skill?: DartsSkill): number;
export function pickAiThrowValue() { return pickThrowValue(); }            // unchanged
```

---

## 4. The record store

New file `src/engine/recRoomRecord.ts`. Pure, no Phaser, no `scenes/` import —
same discipline as `pegBoard.ts` / `darts.ts` / `holdem.ts`, so it's unit-testable
without a browser and usable from the headless sim.

```ts
export type RecGameId = "pegBoard" | "poker" | "fletchers";   // reuses the existing VerbId strings

export interface GameRecord {
  played: number;          // sessions completed — this is what drives skill
  wins: number;
  draws: number;
  losses: number;
  best?: number;           // best single result; per-game meaning, a keepsake, drives nothing
  lastPlayedDay?: number;  // calendar day, so the panel can say "nothing since Day 41"
}
```

### Skill is derived, not stored

```
skill(played) = aptitude × (1 − e^(−played / LEARNING_TAU))
```

A saturating exponential — the standard shape of a real practice curve. With
`LEARNING_TAU = 25`: 63% of ceiling at 25 sessions, 86% at 50, 95% at 75. A real
early climb, a long plateau, no runaway.

Note what this means: **skill is a pure function of `played` and `aptitude`, so
there's no reason to store it.** Store the input, derive the output. No drift, no
way for a bug to corrupt someone's skill, and retuning the curve later needs no
save migration — it just reads differently next load. Worth internalizing as a
general habit: store what happened, derive what it means.

### Aptitude — the ceiling

Deterministic, from data that already exists. `catalystForPilot(pilotId)` in
`data/npcSeed.ts` already resolves a catalyst for every named pilot, every Mek,
and every generated recruit, with a stable hash fallback. That's the hook.

New file `src/data/recRoomAptitude.ts`: a 9-catalyst × 3-game table, plus a small
archetype modifier, plus a small deterministic per-pilot jitter from the pilot id
so two ravens aren't clones.

First-pass character reads (flavor — yours to overrule):

| Catalyst | Peg board | Poker | Fletchers | Read |
| --- | --- | --- | --- | --- |
| shark | mid | **high** | mid | the card shark |
| raven | **high** | mid-high | low | patient, calculating |
| crow | low | low | **high** | restless, quick hands, far too loose with chips |
| wolf | mid-high | mid-high | mid-high | reliable, no standout |
| fox | mid | **high** | mid | bluffs |
| bear | **high** | low | mid | grinds it out, no bluff in him |
| cat | low | mid | **high** | good hands, loses interest |
| dog | mid-high | mid | mid | sticks with it |
| rabbit | mid | low | mid-high | folds too much |

Archetype nudge: Meeps → darts (fast hands), Tank → peg board (patience),
Reeps → poker (reads the field).

### Standing — the rank number

```
points = wins × 3 + draws × 1
```

Ties broken by win rate, then by fewer games played (you earned it in less),
then by name for a stable sort. Simple, readable on a board, no Elo maths to
explain to a player.

### Why the split earns its keep

This is the part worth sitting with, because it's what makes your pick better
than a single rating number would have been: **skill and standing can disagree,
and the disagreement is the story.**

A high-aptitude rookie plays genuinely well and has no points yet. A mediocre
veteran with 200 sessions sits at the top on sheer volume. The board can honestly
show *"Bosk — 4th, and nobody on this ship plays better than him."* A single Elo
rating collapses both facts into one number and loses that entirely.

### Where it lives

Follows the `npcSocial` precedent exactly — optional field, one `ensure`
function as the only creator, no migration step needed:

```ts
// campaignState.ts
recRoom?: RecRoomState;

export interface RecRoomState {
  records: Record<string, Partial<Record<RecGameId, GameRecord>>>;
}
export const PLAYER_RECORD_ID = "player_rourke";   // you sit in the same map
export function ensureRecRoomState(state: CampaignState): RecRoomState;
```

### The one rule that makes the grief beat work

**Nothing ever deletes from `records`.** Not on death, not on reassignment, not
in a save cleanup pass. A record outliving its pilot is the whole point.

This needs to be a loud comment in the file, because it looks exactly like a bug
to anyone who later writes a cleanup pass and sees keys pointing at pilots who
aren't on the roster. Those aren't orphans. That's the feature.

---

## 5. Recording a session

One function, three callers:

```ts
export function recordSession(state: CampaignState, entry: {
  gameId: RecGameId;
  a: string; b: string;            // pilotIds, or PLAYER_RECORD_ID
  winner: string | "draw";
  bestA?: number; bestB?: number;
  day: number;                     // currentDay(state)
}): void;
```

Wired into:

1. **`finishPegBoard` / `finishPoker` / `finishDarts`** in `Hub.ts` — one line
   each, right next to the existing `persistNpcSocial(npc)` call. Both sides get
   a session.
2. **`runNpcEncounter`** — the ambient NPC-vs-NPC path (§6).
3. **`runSocialSim.ts`** — the headless harness (§7).

---

## 6. Real NPC-vs-NPC sessions

`resolveAbstractedMinigameEncounter` splits into `resolvePokerEncounter` and
`resolveFletchersEncounter`, both mirroring the shape `resolvePegBoardEncounter`
already uses: run the real engine with both sides driven by policy, guard the
loop, return the same `EncounterResult`.

`EncounterInput` gains optional `skillA` / `skillB`, defaulting to the current
fixed skill — so `runSocialSim.ts`'s day-level harness keeps working untouched.
Same additive discipline `minigamesEligible` already used on 2 Sep.

`EncounterResult` gains optional `detail?: { scoreA: number; scoreB: number }` so
the board's `best` field has something real to read.

### Frame cost — a real design consequence, flagged not hidden

A full Hold'em session to bust-out at 500 chips with 10/20 blinds can run
hundreds of hands. Running that inside a single Hub frame will hitch visibly.
Darts is already bounded (18 throws) and the peg board is ~20 moves — both free.
Poker is the only problem.

**Recommendation: cap the NPC-vs-NPC sitting at `NPC_POKER_HANDS = 8` and score
on chips won, not bust-out.** Cheap, bounded, and honestly better fiction — two
crew on a break play a few hands, they don't play until one of them is broke. The
alternative (chunking the session across frames) is more code for a worse story.

Either way it goes in the summary line, not hidden behind a result that looks
like a full session — same "no silent caps" discipline this codebase already
holds.

### Immediate visible win

The bubble stops narrating a coin flip:

> before: "Bosk and Anand played Fletchers (abstracted — no real throw-by-throw
> session) — Bosk won. Bond +6."
>
> after: "Bosk and Anand played Fletchers — Bosk took it 87-64."

That lands before the panel exists.

---

## 7. The Standings panel

### Where it lives in code

§16 locked scene-stacking for future *minigames*. A read-only panel isn't a
minigame, so the overlay pattern is correct here.

But **not inside `Hub.ts`.** That file is now **8,008 lines / 431 KB**, which is
a real maintainability problem independent of this feature — it's the single
biggest file in the repo by a wide margin. There's already in-repo precedent for
pulling a panel out: `src/scenes/shop/ShopPanel.ts` is a standalone class Hub
owns and toggles. Follow it exactly: **`src/scenes/ui/StandingsPanel.ts`**.

Construction copies `buildHistoryOverlay`'s proven shape — one container at depth
60, background rect, one text block, one close button, no per-frame update.

### What's on it

Four tabs: Peg Board / Poker / Fletchers / All.

```
THE BOARD — FLETCHERS                                Day 118

  #   PILOT                  PTS   W-D-L   PLAYED   BEST
  1   Iyari — Foxfire         34   11-1-3     15     142
  2   YOU                     27    9-0-5     14     138
  3   Bosk — Ironwood         21    7-0-9     16     121
  4   Anand — Farsight        12    4-0-8     12     109
  +   Vashti — Kite            9    3-0-2      5     151    lost Day 94

  Best player aboard: Bosk (skill 71) — 3rd on the board.
```

- **Dead pilots stay listed**, greyed, marked, with the day they were lost. Their
  best score stays exactly where it was. No code makes this happen — it's the
  panel simply not filtering them out.
- **You're ranked inline**, per your call.
- The line under the table is where the skill/standing split pays off — it says
  the thing the points column can't.

### Access

A drawn board object in the Rec Room near `RECROOM_TABLE`, plus a hotkey.

**`B` is free** — checked the live bindings: W/A/S/D movement, E interact,
M muster, R rumor, T chat, H history, L highlights, ESC close. Follows the same
`openNearestPanel` shape the 2 Sep hotkey pass established, but simpler: no NPC
target, just gated on `currentRoomId === "recroom"` and `!anyOverlayOpen()`.

---

## 8. Tuning harness — `npm run sim:recroom`

Project rule: a number only counts once a script has run it and it passed. There's
no `combat_sim.py` equivalent for this system, so build one:
`src/sim/runRecRoomSim.ts`, mirroring `runSocialSim.ts`'s conventions.

Four things it has to prove:

1. **Skill actually does something.** A skill-70 NPC beats a skill-30 NPC clearly
   more than half the time, in all three games, over 5,000 sessions. **This is
   the single most important check** — if it fails, the skill knobs are
   decorative and the whole system is theatre.
2. **No degenerate game.** Skill-90 vs skill-90 on the peg board shouldn't be a
   100% draw or a 100% first-player win. If it is, the peg board isn't deep
   enough to carry a ladder, and that's worth knowing in slice 6 rather than
   after shipping.
3. **Ladder shape over a campaign.** Simulate ~300 days of ambient encounters at
   real encounter rates and print the final board. Does one pilot run away with
   it? Does everyone converge into a tie? Is the spread readable?
4. **Frame cost.** Time 1,000 NPC-vs-NPC sessions per game. Anything over ~1 ms
   per session means poker needs the off-frame path after all.

---

## 9. Docs that need updating

Your standing rule — say which docs drift when a decision changes:

1. **`Bloom_Wars_Walkable_Hub_Build_Plan_v1.md` §15/§16** — "NPC learning —
   closed, filed as someday" is being reversed. Needs a correction pass, not a
   quiet contradiction.
2. **`engine/socialSim.ts`'s own header** — its "would mean refactoring two
   other shipped, tested files — real, separate scope, not undertaken in this
   pass" note becomes a description of work that got done.
3. **`Bloom_Wars_Master_Index.md`** — stale since 25 Aug independently of this.
4. **GDD / Data Pack** — new persistent state slice, new panel, new aptitude
   table.

---

## 10. Slice order

Each slice is shippable on its own.

| # | Slice | Player-visible? |
| --- | --- | --- |
| 1 | Parameterize the three engines. All 599+ existing tests green, zero edits. | No |
| 2 | `recRoomRecord.ts` + aptitude table + `CampaignState` slice. Pure, tested. | No |
| 3 | Record your own sessions in `finishPegBoard`/`finishPoker`/`finishDarts`. | No |
| 4 | **The Standings panel.** | **Yes — first playable moment** |
| 5 | Real NPC-vs-NPC sessions replace the coin flip. | Yes |
| 6 | `sim:recroom` harness + tuning pass. | No |
| 7 | Banter slot, hot topic on a #1 change, Highlights milestone, codex entry. | Yes |

**Slices 1–4 are the shortest path to something on screen.** Stop after 4 and you
still have a working board that tracks your own games — a real feature, not a
half-built one. Slice 5 is what fills it in while you're not looking.

---

## 11. Scope warning

This is a genuine scope addition, not a bug fix: a new content type (a persistent
per-pilot record living outside both the mission and social systems), a new
persistent state slice, a new panel, and a refactor of three shipped engine files.

Two things I'd cut first if you want it smaller:

- **The archetype modifier on aptitude.** Catalyst alone gives plenty of
  character. Saves an hour and a table.
- **The `best` field.** A nice keepsake, but it's a fourth number needing a
  separate definition per game, and nothing depends on it.

Everything else is load-bearing.

---

## 12. Naming lock

The reserved terms stay out of all of it — file names, type names, UI strings,
comments. Worth a specific note here because §15's original capture quotes a line
containing one of them; that quote is book-side history, not a game string, and
nothing in this system carries it forward. `tools/lint-spoiler.mjs` catches it at
build time either way, but the point is not to write it in the first place.
