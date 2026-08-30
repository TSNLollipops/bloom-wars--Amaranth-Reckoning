# THE BLOOM WARS — CO Briefing / Debriefing Scene: Plan v1

**Status: paper only, zero code touched.** Maxime asked for a Freespace-style briefing/debriefing scene with the CO — or "at least something special to do" — slotted in **after Early Access**, not as part of the EA pass itself. Written 30 Aug 2026, grounded directly in the live repo (`src/scenes/TransporterPad.ts`, `src/scenes/Debrief.ts`, `src/scenes/MapSelect.ts`, `src/scenes/Hub.ts`'s CO block, `src/data/types.ts`), not invented fresh.

---

## 0. Why this is a post-EA item, not now

The Hub Early-Access Readiness Plan already drew this exact line once: Carrier Defense Ops, the Major (a persistent antagonist), in-mission comms, and a formal Insult/talk-down verb are all explicitly "Phase 4+, own doc later" — real systems, not hub polish, and building them now would be the scope-creep that project's docs already flag against repeatedly. A dedicated Briefing/Debriefing scene belongs on that same shelf. It's a real, good idea — but it's new narrative surface area on top of a Hub that isn't shipped yet, not a fix to something broken in the EA pass. This doc exists so the idea doesn't get lost, and so it's ready to pick up the moment EA is out the door.

## 1. What already exists — ground truth, not assumption

This turns out to be a better-set-up ask than it looks, because two scenes already exist specifically waiting for this pass, and the CO himself is already real:

- **The CO already exists and already has a voice.** Arangement of Content — Carabil, stationed in the Grotto, brass-colored, "command" stage / bear catalyst, non-romanceable by design. He already hand-signs off on room-build requests through typed chat with real, specific written lines ("Only the CO signs off on that — find him in the grotto," "Approved. \[Bay], logged and building," "Not at your rank yet..."). That's proof the exact pattern this scene needs — a moment-specific, hand-written CO line, not a generic ambient pick — is already a working pattern in this codebase. It's just never been pointed at mission framing.
- **`TransporterPad.ts` — the squad-review-and-launch screen — flags itself, in its own header, as deliberately unbranded:** "Tier-0... no Providence references, no crew banter, no narrative dressing. Purely functional." That's not an oversight, it's a scene explicitly written to be superseded by exactly this kind of pass later.
- **`Debrief.ts` — the post-mission numbers screen — says the identical thing about itself:** "No Providence, no room fiction, no crew banter — same discipline `TransporterPad.ts` documents for itself." It already computes everything a debrief conversation would want to react to — win/loss, `permanentLosses`, Grief Catalyst mourning lines per lost pilot, the Munti emergency-replacement beat, bonus-objective success, Second/Third Lance integration — it just renders all of it as numbers and panels, never as the CO talking to you.
- **`lastMissionEcho`** already exists as a plumbing mechanism: Debrief writes the mission's win/loss outcome, Hub reads it once and lets *whichever* NPC you next talk to react — CO included, but as "an ordinary hot-topic-eligible NPC like any other," pulling from the same generic ambient pool every pilot draws from. This is the closest thing to a debrief reaction that exists today, and it's exactly the generic version this plan would replace with something written for the moment.
- **Every mission already carries a `briefing: string` field** (`CampaignMission.briefing`), currently shown as small print on `MapSelect`'s mission card. Raw material for a spoken briefing already exists; it's just displayed as a caption today, never delivered as dialogue.
- **The content-authoring discipline this project already uses twice** (Vault dedication, Mek backstories) is directly reusable here: hand-author the load-bearing beats, let a procedural/generic pool cover the rest, and gate whether a character reacts at all through the same cheap yes/no check (Gate 1 of the Reaction Formula) already adopted as the standard for Mek reactions.

## 2. What "Freespace-style" means translated into this game's own idiom

Not a new engine, and not a new visual system by default — the ask is a *dedicated, personal* pre-mission and post-mission beat with the CO, distinct from the functional screens either side of it, using the dialogue/portrait conventions this codebase already has (colored-circle-and-initials portraits, monospace terminal text, the bubble/typed-chat system Hub.ts already runs on).

- **Briefing** — before deploy: the CO frames the mission in his own voice (stakes, tone, maybe a line acknowledging current roster state — a recent loss, a new recruit) rather than a caption on a card. Ends in a "proceed" action into the existing `TransporterPad` squad picker.
- **Debriefing** — after the mission resolves: the CO reacts specifically to *this* mission's outcome — not the generic ambient-echo pool, a real reaction to what happened (a win, a loss, who was lost, whether the bonus objective landed) — separate from and in addition to `Debrief.ts`'s numbers screen, which keeps doing exactly what it does today.

## 3. Scope split — hand-authored vs. procedural, same discipline as the Vault and Meks

Hand-writing a bespoke CO line for all 36+ missions isn't realistic, and doesn't need to be. Recommend the same audit-then-build approach already used for the Enemy Variety pass:

- **Hand-authored, load-bearing beats:** Act I's opener, both existing Lance-integration wins (Mission 12, Mission 24 — already flagged as real story beats with their own Debrief callouts), any mission with a true permanent loss, and House Amaranth's own major turns once that track resumes. This is squarely the kind of writing this project already routes to Maxime directly (matches his own stated specialty), the same way Vault dedication and Mek backstory content are scoped as his authored material elsewhere in these docs.
- **Procedural fallback, everything else:** built from data already sitting on the mission/outcome (the `briefing` field, `bonusObjective` kind, win/loss, `permanentLosses`) plus the CO's own catalyst ("bear") and stage ("command") voice — the same mechanism `ambientLines.ts`/`hotTopics.ts` already use to generate pilot lines from a catalyst+stage pair, just pointed at mission context instead of social context. This means the CO is never silent on a mission that has no hand-written content, without demanding 36 bespoke debriefs before this can ship at all.
- **Gate 1, reused:** the Mek reaction system's cheap yes/no check ("does this character react at all") is a good fit for deciding when the CO's *personal* debrief beat fires versus when the numbers screen alone is enough — not necessarily every mission needs a CO conversation on top of the earnings panel.

## 4. Where this slots into the existing scene flow

Two real options, not resolved here:

**Option A — two small new scenes.** `Briefing` between `MapSelect` and `TransporterPad`; `CoDebrief` between Battle's win/loss overlay and `Debrief` (or after it, before Hub). Cleanest separation, mirrors Freespace's own two-screen shape, and — importantly — this is the option that actually honors what `TransporterPad.ts` and `Debrief.ts` already say about themselves: both explicitly describe themselves as placeholders for exactly this later pass, not scenes meant to carry narrative weight themselves.

**Option B — fold the CO's beat into the top of the existing screens.** Add a panel to `TransporterPad` and to `Debrief` rather than adding two new scene transitions. Cheaper to wire, but directly contradicts both files' own header comments about staying unbranded — that's not a blocker, just a real design reversal that should be a decision, not a side effect of picking the cheaper option.

**Recommend Option A.** Both files were written expecting to be superseded this way; Option A is the pass they were left open for.

## 5. Cut line — MVP through full Freespace fidelity

Same shape as the Hub EA plan's own ranked cut lines, cheapest first:

1. **MVP — debrief only, folded into the existing screen.** One hand-authored (or procedural-fallback) CO line surfaced directly on the `Debrief` screen, reacting to this mission's outcome/loss/milestone. No new scene, no briefing half yet. This is close to the "or at least something special to do" fallback floated alongside the full ask — cheapest real version of "the CO actually talks to you about what just happened."
2. **Mid — add the Briefing scene.** Pre-mission CO dialogue as its own scene (Option A), same hand-authored/procedural split, still text-and-portrait only in the existing terminal look — no new visual system.
3. **Full Freespace fidelity — a waypoint/objective map panel under the CO's dialogue.** This is the one genuinely new visual system in the whole plan (nothing in the codebase resembles it today) and should be scoped as its own follow-up pass once 1–2 are proven, the same way CIC/Energy allocation got split off from the Vault in the Hub EA plan rather than bundled in.

## 6. Open decisions, not made here

- MVP / Mid / Full — which tier ships first.
- Option A (two new scenes) vs. Option B (fold into existing screens) — recommend A, not decided.
- Does the CO's personal debrief fire every mission, or only on trigger conditions (a loss, a milestone) via a Gate-1-style check?
- Who writes the load-bearing hand-authored lines — Maxime directly, or a first draft from me to react to and edit?
- Confirmed: this stays Phase 4+/post-EA, sequenced after the Hub EA pass ships — flag if that's wrong.

## 7. Recommended order, once picked back up post-EA

1. Confirm the cut line (§5) and Option A vs. B (§4) with Maxime.
2. Build the procedural fallback first — reuses the existing catalyst/stage ambient-line pattern, gets "the CO is never silent" working cheaply across every mission before any hand-authoring happens.
3. Layer hand-authored lines onto the load-bearing missions named in §3 on top of that base.
4. If Mid or Full: build the `Briefing` scene shell (Option A).
5. If Full: the waypoint/map visual, last, as its own separately-scoped pass.
