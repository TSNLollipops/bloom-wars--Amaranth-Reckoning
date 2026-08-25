# THE BLOOM WARS — NPC Reaction Engine v1

*Confirmed design direction, 25 Aug 2026 — zero code, not scheduled. Captures
the formula Maxime is building for how NPCs (pilots first, House Amaranth
actors and eventually the CO later) react to what's happening around them —
the mechanism underneath Favorability (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md`
§13.2) and Stress (§11.4), and the likely engine for the in-mission
talk/fight/ambush choices flagged in `Bloom_Wars_Spitball_Ideas.md`.*

**Scope flag, per the project's own standing rule.** This is a new system,
not a tuning pass on an existing one — a formula for computing how a pilot
reacts to a given moment, not a Favorability-bar increment. Bigger in scope
than Favorability itself, since Favorability (a single number moving up or
down) could plausibly turn out to be one of this engine's *outputs* rather
than a separate thing. Flagging that plainly rather than letting this read as
a subsection of something already sized. Nothing here is built, and nothing
here changes the standing sequencing rule already locked in Spitball Ideas —
hard tactical loop before the social part of the game. This document exists
so the formula doesn't drift or get lost before that gate clears, not to
schedule building it.

**Where it comes from.** Maxime, introducing it: "let me show you something.
v30 is usable for now. its the best character engine I know." Adapted from a
personal character/story-generation reference Maxime maintains outside this
project — not Qiraki canon, not detailed further here, kept out of this doc
on purpose. What follows is the formula itself, translated into something
this project can build against, not the source material it came from.

**Updated, 25 Aug 2026 — checked against a newer pass of that same source.**
Maxime shared an updated working snapshot of the source reference, described
there as having "actually been run against real material" rather than
untested theory. §1a, §3's two new notes, §3a, and §3b below are new,
translated the same way everything above them already was — kept to the
structural shape, not the source's own internal vocabulary or its own
supporting documents, same restraint as the original pass. Nothing already
locked in §1–§4a below changed; this is additive.

**Confidence, carried over from the source, in short.** The source itself
flags which of its own pieces are proven under real use versus still soft —
worth knowing before treating everything below as equally solid. Solid: the
"does this even react" gate (§1a), the self/other/propagate shape (§3a), and
the complexity ladder (§3b) all reportedly held up under real pressure-
testing. Soft: the exact three-animal reopening question (§3's new note) and
the audience-changes-available-actions idea inside §3a — both real, neither
proven repeatable yet even in the source. Flagged per-item below rather than
asserted as a blanket status.

## 1. The formula

```
(A + B) + (a + b4(c)) = D + E
```

- **A** — the scene's context. A position on a 12-point abstract diagram
  (nine numbered positions plus three more, called the three pillars: Time,
  Volume, Matter — all twelve read as one sequence, the pillars aren't a
  separate add-on) plus whatever else is active in the moment.
- **B** — fixed, not a variable. Always the player's own point of view.
  Confirmed 25 Aug 2026: "POV being from the consumer POV." This formula
  isn't modeling a pilot's true internal state — it's computing what the
  player actually perceives, which is the only thing a game needs to render
  anyway.
- **a** — A, scoped down to one specific pilot rather than the whole scene.
- **b4(c)** — that pilot's archetype, run through its four echoes: love,
  fear, anger, sadness, in that order (confirmed), combined with **c**.
- **c** — the catalyst. What the pilot is visibly doing at the moment
  someone can look at them — confirmed 25 Aug 2026: "c is what the guy is
  going at the moment someone can look at him." Simplified on purpose to a
  single pass through one list (the animal list, below) rather than the
  fuller three-layer version the source material also describes — Maxime's
  own call: "yeah, building it simpler for the game. for now, its
  complicated enough."
- **D** — the output. What actually shows in-game.
- **E** — feedback. How D changes the state that the next pass reads back in
  as A and a.

**Note, 25 Aug 2026 — the source's own notation has since shifted.** The
newer pass writes this as `(A + B) + (a · b⁴(c)) = D + E` — multiplication
between **a** and **b⁴(c)**, not addition. Doesn't change anything locked
above: this project already deliberately chose addition over the source's
own notation for buildability reasons (§3's "Addition, not division" note),
independent of whatever the source itself uses at any given moment. Recorded
here only so a future pass doesn't mistake the source's drift for something
this doc needs to chase.

## 1a. Gate 0 — does this pilot even react? (new, 25 Aug 2026)

**Checked first, before anything else below loads.** A plain yes/no: does
this specific pilot register this specific catalyst at all? No is a valid,
common answer, not a failure to find something — per the source, this
should be the single most frequent outcome across an ordinary stretch of
play, and it's also the cheapest possible check: everything else in this
document (the animal pass, the pillars, the scene-level gates in §3a) is
skipped entirely the moment this resolves no.

**Why this matters for Bloom Wars specifically, not just as a formula
footnote.** Right now nothing in this doc's own formula has an explicit
"nothing happens" branch — §1 as written implicitly assumes every catalyst
produces some echo. A real reaction engine needs the opposite default: most
pilots, most of the time, watching most things happen around them, don't
react in any way worth rendering. This is also the cheapest possible hook
point once this engine actually gets built — a single boolean check, no new
data schema, no animal pass needed for the common case. Worth remembering
when §5's "not scheduled" gate finally opens: this gate is the natural
first slice to prototype, not the full formula at once.

**Not designed here — what decides yes/no isn't specified in the source
either**, beyond "checked first, cheapest." Left open the same way the rest
of this document leaves its open questions open (§4).

## 2. The animal list (confirmed)

Nine entries, the most recent recovery from the source material (dated 24
Aug 2026 in that document) — checked directly against the source rather than
assumed, since an earlier, non-matching eight-item version exists in the
same reference:

Wolf (teamwork), Dog (loyalty), Cat (selfishness), Crow (indulgence), Raven
(instruction), Bear (isolation), Fox (trickery), Rabbit (nurturing), Shark
(ambition).

This is the full content of **c** — nine possible read-outs for "what the
pilot is visibly doing right now."

## 3. Deliberate simplifications from the source material

Worth keeping on record, since the source itself is a much bigger, still
actively-changing system, and this project is only taking one piece of it —
so a future pass doesn't accidentally "correct" this back toward the fuller
original:

- **One list, not three.** The source material's best-supported reading
  runs the catalyst through three separate lists, one per phase — instinct,
  thinking, action. This project runs all three phases through the animal
  list alone. A deliberate simplification, confirmed 25 Aug 2026, not an
  oversight.
- **Addition, not division.** The source's own fullest notation attempt
  uses division — an abstract possibility-space narrowing down to the one
  concrete thing that happened. This project uses addition instead — a
  combinable score is more buildable than a narrowing operation, and
  division was never confirmed as anything more than one candidate reading
  in the source itself.
- **B redefined.** In the source material, B is a self-referential formula
  (Archetype's own internal structure). Here, B is fixed as the player's
  point of view — see §1.
- **Volume, defined for this project as personal significance** — how much
  space something takes up in the pilot's own life/priorities. Worth
  flagging: the source material has at least two other live, unreconciled
  readings for this same term (a "footprint of story consequences" reading,
  and a "physical distance" reading) — this project isn't adopting either of
  those, it's picking a third one that reads clearest for a game context.

**New, 25 Aug 2026 — Matter, sharpened by the source's own updated pass.**
Previously undefined here beyond being one of the three pillars alongside
Time and Volume. The source now reads it as **agency** — not a binary
consistency check, but a real, continuous weight: how much standing or
capacity a given character actually has, right now, to convert a reaction
into an effective action. Zero agency (an illiterate character can't act on
a note they can't read, in the source's own example) sits at the floor of
that same scale rather than being a separate mechanism. **Open question, not
answered here:** what "agency" maps to for a Bloom Wars pilot specifically.
Candidates already sitting in this project unused for this purpose: gear
tier (G–A, `Bloom_Wars_Data_Pack_v0.1.docx` §6.4), command position (Pilot →
Lance Lead → Company Commander, `Bloom_Wars_Rank_And_Command_v1.md`), or
simple battlefield state (deployed and able to act vs. downed vs. off the
roster entirely, which is agency's own literal floor). Not deciding between
them here — flagging that the pieces to build this from already exist
elsewhere in the project, whenever this gate opens.

**New, 25 Aug 2026 — a reopened question about the single-animal
simplification, flagged rather than acted on.** The source's updated pass
describes two deliberate modes, not one: **all the way down** (one animal
governs instinct, thought, and action alike — fast, cheap, the default for
most reactions) and a **three-animal path**, a different animal per phase,
reserved for a beat that needs real internal conflict, since a single
animal structurally can't produce genuine values-conflict against itself.
This is close to, but not the same question as, this project's own "one
list, not three" simplification above — that one collapsed three *phases*
into one *lookup*, always; the source's two-mode version keeps the
single-animal default for the common case and only spends the extra cost
on beats that are actually about internal conflict. **Not adopted here,
just surfaced:** whether Bloom Wars ever wants the three-animal path for
its own highest-stakes beats (a Command Vacuum moment, say, or a founding
pilot's death) is a real design question worth putting to Maxime directly
rather than deciding unilaterally — this doc's own existing simplification
stays exactly as locked until that conversation happens.

## 3a. The scene-level gates — self vs. environment, self vs. other,
propagate (new, 25 Aug 2026)

Three more gates from the source's updated pass, sitting after the animal
pick and pillar read in its own sequence. Not previously captured in this
document at all — genuinely new material here, not a refinement of
something already written above.

- **Self vs. environment.** The environment isn't a combatant — it doesn't
  push back with its own will. What it does is decide which of a pilot's
  usual self-directed moves are even available to make right now. The
  source's own example: an audience changes what action is possible: the
  same instinct can survive a scene with no actual action left to perform
  at all, if acting on it isn't available with other people watching.
  **Not modeled anywhere in Bloom Wars today** — every reaction currently
  built (echoes, toxic friction, gossip, Command Vacuum) fires the same way
  regardless of who else is present or watching. A real, unexplored idea,
  not proven repeatable yet even in the source itself — flagged, not
  queued.
- **Self vs. other.** One pilot's own output (**D**) can become a second
  pilot's own input (**a**), directly, in the same scene — real causality,
  not two independent rolls that happen to land near each other. Doesn't
  need to be mutual; a one-directional reaction is legitimate and common.
  It *can* loop — the second pilot's own **D** reaching back to re-trigger
  the first pilot's chain a second time — but only when that first pilot is
  the kind of person, or in the kind of relationship, that would actually
  register the second one's reaction in the first place. The loop is the
  heaviest configuration the source has found so far, three full gate-passes
  for one exchange — reserved for the beat that's actually *about* the
  relationship, not spent on an ordinary exchange. **This is already what
  Grief Catalyst (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13.2, shipped in
  the sandbox) independently does** — every existing bond among a group of
  mourners shifts based on how their two echoes combine. Worth naming that
  connection explicitly: the sandbox already built a working instance of
  this specific gate before this document had language for it.
- **Propagate.** Two separate channels, not one. Absent archetypes and the
  wider world reacting to consequences they didn't personally witness — and
  separately, present characters' own instinct/thought/action pushing
  outward past the scene itself, not just inward against each other. The
  source's own note: log it, don't resolve it here. **Also already partly
  built:** `recordMuntiLost()`'s squad-wide broadcast (every living pilot
  remembers a lost Munti, whether or not they were present) and the new
  Command Vacuum mechanic (a lance feels its own Lead's loss, not just
  whoever was directly bonded to them) are both instances of the first
  channel — consequences reaching pilots who weren't there for the original
  event. The second channel (a present pilot's own reaction pushing outward
  past the immediate exchange) isn't built yet.

## 3b. How much of this to actually run — a complexity ladder (new, 25 Aug
2026)

The source's own answer to "when does the full formula actually fire,"
carried over because it's a genuinely useful cost model, not just a
process note:

- **Most moments:** nothing. Gate 0 (§1a) resolves no before anything else
  loads.
- **An ordinary reaction:** single animal, all the way down.
- **A beat that already matters:** the three-animal self-fight (§3's new
  note, not adopted yet) or an asymmetric self-vs-other collision (§3a).
- **The actual point of a scene:** the full loop (§3a).

**Worth naming: Bloom Wars already independently arrived at roughly this
same ladder**, one system at a time, without anyone designing it as a
ladder on purpose. Ambient idle lines are the cheapest tier and fire
constantly. Ordinary mission/Rec Room/drink events sit at the "single
animal" tier — one echo pick, done. Toxic Pairs and Command Vacuum are
asymmetric, heavier, gated behind a real condition (a toxic bond, a Lead's
loss) rather than firing every time. Grief Catalyst is the closest thing
already built to the full loop — multiple bonded pilots' echoes combining
and feeding back into each other. Seeing the existing systems land on the
same shape as the source's own explicit cost model is a good sign the
translation so far has been sound, not just convenient.

**One more principle worth locking in plainly, carried over from the
source's own closing note:** *the formula never supplies the tiebreaker —
character history does.* Every gate above that requires a pick (which
echo, which animal, whether the loop is worth the cost) usually has more
than one plausible answer; what actually resolves it is the specific
pilot's own history, not the formula itself. This already matches how the
sandbox's echo selection works for a bonded pair — Favorability tier biases
the pick (a close bond leans love/warmth, a toxic one leans anger/fear,
per `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13.2) rather than picking blind.
It's also why a pilot with **no** recorded history for a given interaction
still falls back to an even random pick — not a gap in the design, just the
honest case where there's no history yet to break the tie with.

## 4. Where this plugs in — not yet decided

Genuinely open, not designed here:

- How **D** and **E** concretely translate into a Favorability delta
  (Antfarm Hub §13.2), a Stress change (§11.4), or an in-mission dialogue
  outcome (the talk/fight/ambush idea, Spitball Ideas).
- Whether this runs once per mission, once per meaningful choice, or
  continuously.
- How a pilot's Planet position, pillar weights, and archetype get assigned
  — by hand per named pilot, generated for player-created recruits, or some
  mix of the two. **Cross-ref, 25 Aug 2026 — partially answered for one
  case:** `claude/Bloom_Wars_Character_Editor_v1.md` §2 proposes an answer
  for player-created pilots specifically — the player picks a label off the
  animal list (§2 above) as the pilot's catalyst read, and a small preset
  table (not designed here either) maps that label to a starting Planet
  position / pillar weighting, so the player never has to touch the
  diagram directly. Named, hand-authored pilots are untouched by that
  proposal — this bullet's "by hand per named pilot" half is still exactly
  as open as it was.
- Data schema — none of this exists as a type or a data file yet.
- **New, 25 Aug 2026 — the cheapest real starting point, if/when this gate
  opens:** Gate 0 (§1a) alone, wired to fire before any of the rest. A
  single yes/no check needs none of the schema work the full formula does,
  and it's already confirmed (both in the source and by the sandbox's own
  existing "not every catalyst needs a rendered reaction" instinct) to be
  the single most common outcome — the highest-value, lowest-cost slice to
  prototype first, whenever §5's gate actually opens.

## 4a. A combat-side bridge point (25 Aug 2026 — captured, not designed)

Maxime, unprompted, mid-conversation about the Player AI engine work
(`src/sim/playerAi/`): "personally I wonder how the characterisation formula
handle combat. but thats for later XD" — then, asked to precise it: "any way
to bridge the social and the fighting."

Not designed here — same standing rule as everything else in this doc — but
worth recording the observation before it's lost, because it's a real one:
**c**, the catalyst, is defined as "what the pilot is visibly doing at the
moment someone can look at them," and combat is already producing exactly
that, turn by turn, without anyone building it for this purpose.
`engine/mission.ts` logs a structured outcome for every action already — a
kill, a repair and how much it healed, a downing, a permadeath check's
verdict, an overwatch trigger, a dodge. Separately, `src/sim/playerAi/`'s own
decision reasons (`kill`, `repair_critical_ally`, `retreat_low_hp`,
`hold_cornered`, `regroup_low_hp`, ...) are the test bot's own read of "what
is this pilot doing right now" — which is the identical question **c** asks.
The two vocabularies already line up without forcing it: a Munti healing a
critical ally under fire reads as Rabbit or Dog; landing the kill reads as
Shark; fighting on alone because retreat had nowhere left to go
(`hold_cornered`) reads as Bear, forced into the open.

**The one precision worth keeping on record:** the bridge should NOT be
"read the Player AI engine's own reason codes directly." Those only exist
inside the headless sim bot (`src/sim/playerAi/`) — a human playing a real
mission through `scenes/Battle.ts` never produces a `PlayerAiReason` at all,
since no AI is choosing their actions for them. The reusable part sits one
level down: a classifier that reads catalyst off the **engine's own action
outcomes** (mission.ts's kill/repair/downed/permadeath/overwatch events),
which exist identically whether a human or the sim bot triggered them. Built
that way, whenever this engine's gate actually opens, combat doesn't need to
be touched or re-instrumented to feed it — the raw material is already being
produced every turn, for every unit, human-played or not.

## 5. Status

Design only. Not scheduled. Same standing rule as the rest of the
social/hub layer: nothing here gets built before the hard tactical loop is
proven (`Bloom_Wars_Spitball_Ideas.md`, "the game is Amaranth now" entry).
This document exists to keep the confirmed formula from drifting before that
gate clears, not to schedule it.
