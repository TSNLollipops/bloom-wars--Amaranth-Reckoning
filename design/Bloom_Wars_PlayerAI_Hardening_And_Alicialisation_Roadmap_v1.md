# THE BLOOM WARS — Player AI Hardening (Now) & Alicialisation Roadmap (Post-EA), v1

**Status: §2's Tier A–C executed and verified same day — see §1a. Taunt itself redesigned (no-charge, PvP root/lock) and Guard Taunt retried twice more against it — see §1b. §3 (Alicialisation) is still paper only, deliberately not started.** Written 30 Aug 2026, grounded directly in the live repo (`src/sim/playerAi/`, `design/build_log/engine_systems/player_ai_engine.md`, `design/Bloom_Wars_Build_Log_Addendum_Tier0PlayerAIClassTriangle_30Aug2026.md`, `design/Bloom_Wars_Rank_And_Command_v1.md`), not invented fresh. Exists because Maxime asked for two things in one breath that run on very different clocks — this doc splits them so neither gets lost or accidentally rushed.

---

## 0. The two asks, and why they're separate docs-in-one

Maxime's own framing: "make ai smarter... capable of following their npc commander, work as a team, etc. — post EA. for now, we gotta focus on making our test bot capable enough it doesn't falsify our test, because I keep finding mission much easier than they should because our test ai sucks."

That's two projects wearing the same coat:

1. **Right now — the test bot has to stop lying to us.** `src/sim/playerAi/` isn't flavor, it's the instrument the whole campaign gets balanced against (`npm run sim`, `npm run sim:batch`). If it plays worse than Maxime does, every mission's spawn count gets tuned to keep *it* alive — which means missions come out too easy the moment a real, competent player (Maxime, or any player) sits down. This is not a hunch — it's already documented, in Maxime's own words, in the repo (§1 below).
2. **Post-EA — "Alicialisation."** Personality-driven decisions, squadmates that actually follow an NPC commander, AI that works as a team. This is a real, exciting system — and it's explicitly *not* what's blocking anything today. It's parked here on purpose, same discipline the CO Briefing/Debriefing scene plan and the Hub's own need/want system already got (`Bloom_Wars_CO_Briefing_Debriefing_Scene_Plan_v1.md` §0, `Bloom_Wars_Hub_Early_Access_Readiness_Plan_v1.md` §4) — written down now so it's ready to pick up, not built early and rushed.

---

## 1. Ground truth — the test bot's fix is already half-landed, and its own known gaps are already written down

Nothing here is guessed. `player_ai_engine.md` — the engine's own living doc — already lists its unfixed limitations in plain language, and Maxime doesn't need to take my word for the diagnosis:

- **Tier 0 (30 Aug) shipped and is verified**, but narrow on purpose: only the bot's *in-range* target choice was made class-triangle-aware (Tank beats Meeps, Meeps beats Reeps, Reeps beats Tank). A wider version — weighting which *distant* enemy to chase, too — was tried and made things **worse** (73.25% → 67% win rate over 400 runs), because the bot chased type-advantaged targets across the map with zero sense of "is that actually safe to walk to." That version was reverted, on real evidence, not caution. Current verified baseline: 73.5% aggregate, flat against the pre-fix number, with real per-mission wins (Mission 6: 82% → 92%).
- **No ability usage at all.** Ambush, Interdict, Screen, Sensor Sweep, Taunt — five real combat verbs Maxime has personally play-tested and values — and the bot uses none of them. This is the single biggest gap on the list: a human using their kit will beat a mission a kit-blind bot struggles with, every time, and if the mission's spawn count got tuned against a bot that never taunts or ambushes, it was tuned soft.
- **No boss-priority sense.** The bot's target-priority formula treats a named boss (Heartwood, Mission 21) the same as cheap reinforcement fodder — it'll happily ignore the real threat for an easy kill. Never touched by the class-triangle fix (bosses carry no `path`, so the new weighting doesn't even apply to them).
- **Two missions the bot flat-out can't clear: Mission 3 and Mission 5, both confirmed still at 0% win rate after Tier 0**, while Maxime clears both "easily" playing for real. This is the single clearest piece of evidence for exactly what Maxime is describing — not a vibe, a logged number. The engine doc's own diagnosis: the bot's flat, reactive heuristics have a real tactical ceiling below "protect the fragile unit before it's critical" — not a mission-balance problem, a bot-competence one.
- **No distance/exposure reasoning**, even post-fix — the one thing the reverted wider fix exposed. The bot doesn't yet weigh "closer and safer" against "better matchup but a longer, riskier walk" for anything outside its current turn's reach.

None of this is new information Maxime hasn't already half-surfaced — this doc's only job is to put it in one place, in order, as a plan rather than five scattered addenda.

---

## 1a. Update, 30 Aug 2026 — Tiers A–C run same day, real numbers, one reverted

Full write-up: `design/Bloom_Wars_Build_Log_Addendum_PlayerAI_GuardTauntTriedReverted_And_BossPriority_30Aug2026.md`. Short version, since it changes what §2 below should be read as ("plan" vs. "done"):

- **Tier A (re-baseline): done.** 40-mission/1000-run batch, 72% aggregate — flat against Tier 0's own 73.5%, as expected. **The real find**: `commander_down` is the dominant failure mode campaign-wide, not just Mission 12's already-documented case — `mission_amaranth_8` went 25/25 commander_down, and 3/5/12/21 all show the same shape. This reframed B/C below: the 28 Aug commander-protection work only ever changed how Rourke moves *herself*; nothing ever pulled fire off her from the squad's side.
- **Tier B (ability usage) — Taunt specifically: tried, measured, reverted.** Built it (a non-protected Meeps taunts the moment a front-line ally is visible to any enemy) — isolated batch run came back **worse**, 72%→65%, with `mission_amaranth_25` collapsing 100%→20%. Root cause: Taunt's redirect lasts one hostile turn but costs the taunting unit's *whole* turn and the mission's only charge — a visibility-only trigger fires far too early and often, so the squad pays a full turn's lost output for one turn of insurance and has nothing left for the real crisis later. Reverted, not deleted — the primitives (`canGuardTaunt`, `frontLineAllyToProtect`) stay in `combat.ts` for a properly crisis-gated version later (HP-threshold-gated, not visibility alone). Ambush and the Screen-robustness item below are untouched this pass — ran out of runway after Taunt's own investigation, not judged low-value.
- **Tier C (boss/priority-target): shipped, honestly flat so far.** An opt-in boss-priority discount on `focusFireTargetInRange` only (same narrow-scope discipline as Tier 0's own class-triangle weighting). No regression (71% vs. 72% baseline), but no proven win either — a dedicated n=100 run on the one live emergent-boss mission (`mission_amaranth_21`, Wellroot) came back flat (26% vs. 28%). That mission's own failures are still overwhelmingly `commander_down` — the same problem Tier B's reverted fix was aimed at — which likely swamps whatever this nudge contributes. Kept because it's correct and zero-risk, not because the numbers prove it yet.
- **Tier D reframed, not started**: Missions 3/5 (the original ask) turn out to be the *archived*, non-shipping Team One slice — lower priority than it looked, since the *live* Amaranth campaign has the same commander_down problem, worse, and campaign-wide (see Tier A's own find above).
- **The actual next lever, now clearer than when this doc was first written**: something that protects the commander from the *squad's* side, not just her own movement — screening/blocking her approach tiles, or a properly crisis-gated Taunt reserved for the worst moment rather than the first sighting. Not yet built.

---

## 1b. Update, 30 Aug 2026 (same day, later) — Taunt redesigned real-side, Guard Taunt retried twice more, still reverted

Maxime, directly: "make taunt like ambush... no charge, just plain use," then "taunt should also lock the target in place so they dont run away." Full write-up: `design/Bloom_Wars_Build_Log_Addendum_TauntNoCharge_GuardTauntRetried_30Aug2026.md`.

- **Taunt itself (the real, shipped ability): redesigned, done.** No longer once-per-mission — reusable posture, same shape as Ambush's own 30 Aug redesign, whole-turn cost is the only rationing. Also now roots whatever it redirects (PvP-facing: an opposing human pilot's unit can no longer just walk away from a taunt for free) — confirmed a no-op against everything in the live campaign today, since no shipped hostile has any flee/kite behavior to lock down.
- **Guard Taunt (the sim-only heuristic from §1a's Tier B): retried twice against the now-reusable ability, since removing the charge should have unblocked it. It didn't, either way.** Visibility-only (same trigger as before): fixed `mission_amaranth_8` outright (0%→84%) but drove `mission_amaranth_21` to 0% — a Meeps with no defensive bonus taunting every visible turn dies to the swarm it's drawing. HP-gated (only guard an ally already below 60% hp): fixed `_21`/`_12` but broke `_8` right back to 0% (fires too late for a mission where the fatal hit lands the same turn the commander is first seen) and still left `_26` regressed. Reverted both, same call as attempt 1 — three attempts now, three different failure shapes, no clean win. The commander_down lever from §1a is **still** the single biggest thing left unsolved.

---

## 2. Priority plan — hardening the test bot, in the order that pays off fastest (original framing, 30 Aug morning — see §1a/§1b above for what actually happened running it)

Same cadence as the rest of the build so far ("fait tout en batch, 1 a la fois") — one tier at a time, each one verified with `npm run sim:batch` before moving to the next, so we always know whether a change actually helped before stacking another on top.

**Tier A — Full 36-mission re-baseline (do this first, before touching anything else).**
Already flagged as owed since Tier 0 shipped, never actually run as its own dedicated pass. We're about to make several more changes to this bot — we need one clean "here's where every mission stands today" number first, or we won't be able to tell which later fix moved which mission. Cheap (the tool already exists), and it directly answers "which missions are currently lying to us," not just the two we already know about.

**Tier B — Ability usage. The highest-leverage fix left, per the engine doc's own ranking.**
Teach the bot to actually reach for its kit instead of playing five characters with one button each:
- Taunt, when a Meeps/Tank is in a tanky position and something threatening is bearing down on a fragile ally or the commander (this one has a real, already-logged use case waiting: Mission 12's turn-4 Choir focus-fire on Rourke — Taunt was unlocked specifically for this scenario and may already solve it in live play, worth confirming before it's even wired into the bot).
- Ambush, when a Meeps unit has a clean setup for it (the redesigned 3-turn stealth-and-strike from Tier 5 is sitting there completely unused by the bot right now).
- A more robust Screen trigger than the current one (which "shipped, tested, correct" but almost never actually fires in practice, per its own honest write-up).

**Tier C — Boss/priority-target awareness.**
Give the target-priority formula a real notion of "this one matters more than its raw HP/defense says," gated to named high-value targets (Heartwood-style), not a blanket override that fights the class-triangle logic Tier 0 just tuned.

**Tier D — Missions 3 and 5, dedicated investigation.**
These are the two missions we can already prove are giving false readings. Worth a direct look at what Maxime actually does differently in real play that the flat heuristics don't capture — the engine doc's own guess ("protect the fragile unit before it's critical") is a real, testable hypothesis, not the end of the investigation.

**Tier E — Distance/exposure-aware chase-target selection (lower urgency, real complexity).**
The thing that broke when tried too early. Worth revisiting once B–D land, this time with an actual distance/risk term instead of pure type-advantage — but only after the cheaper wins above are banked, since this is the one that already bit us once.

Each tier gets the same treatment the last pass used: typecheck + lint + test + a real `sim:batch` run before it's called done, not "looks right."

---

## 3. Post-EA — "Alicialisation": AI that decides from character, and follows its commander

Parked here, deliberately not scoped for build yet. The point of writing it down now is so it's ready the moment it's actually next in line, and so nothing here gets invented from scratch later when good building blocks already exist today.

**What's already sitting in the repo, ready to be reused rather than rebuilt from zero:**

- **The catalyst/personality system already exists and is already load-bearing.** Every Mek and pilot already carries a `catalyst` (Wolf/Dog/Cat/Crow/Raven/Bear/Fox/Rabbit/Shark), and the Reaction Formula (`(A + B) + (a · b⁴(c)) = D + E`) already drives how NPCs react socially in the Hub. "Decisions based on characterization" isn't a new system to invent — it's this same formula's `c` term, pointed at combat choices instead of ambient dialogue. A Wolf-catalyst unit choosing to press an attack versus a Rabbit-catalyst unit choosing to disengage is the same shape of decision the Hub's social sim already makes constantly, just in a different scene.
- **The command structure already exists on paper.** `Bloom_Wars_Rank_And_Command_v1.md` already splits personal rank from command position (Lance Lead, Company Commander) and already maps it onto Warden Company's real roster. "AI capable of following their NPC commander" has a real structure to hook into — whoever holds Lance Lead in-fiction is the one the squad's AI should actually be taking cues from, not an abstract "the AI" with no chain of command.
- **The reuse path is already flagged by the team, not new here.** The Consolidated Build Plan's own Tier 0 entry calls out, in Maxime's own words, that this exact engine "double-duties... as the actual opponent AI for the already-parked Gladiator/PvP mode." So the same hardened bot from §2 isn't throwaway test infrastructure — it's the seed of the actual smart opponent AI, and from there, the same reasoning extends naturally to AI-controlled teammates that work *with* the player instead of just against them.

**What this would concretely need, once it's actually picked up:**
1. A combat-facing hook into the existing catalyst/Echo system — some per-catalyst bias on the target-priority and retreat/hold thresholds Tier 0–E already built, not a parallel decision system.
2. A command-following layer — squad AI reads who the active Lance Lead/Company Commander is (already a real field per Rank & Command §5, `PilotRecord.tier` plus the command-position mapping) and biases toward that unit's orders/positioning rather than pure local heuristics.
3. Eventually, the "work as a team" piece folds player-issued orders and AI-to-AI coordination into the same priority chain `playerAi/index.ts` already runs (kill > critical repair > retreat/hold > routine repair > focus fire > advance > seek fight) — extending an existing chain, not replacing it.

**Sequencing, explicit:** this whole thread sits after the House Amaranth build and after Early Access, same locked order Maxime already set (Player AI infra before Amaranth, per `Bloom_Wars_Decision_PlayerAI_Priority_Before_Amaranth_29Aug2026.md`) extended one step further — Alicialisation is real, wanted, and last, not forgotten.

---

## 4. What needs a direct answer from Maxime

- **The real open question now**: three tried-and-reverted Guard Taunt attempts point at the same conclusion — is it worth building a real fourth attempt that reasons about the taunting unit's own survival odds (threat count / incoming lethality), or should this specific lever wait until something else (a genuine crisis-only trigger, more data) makes it tractable? Removing the charge (§1b) didn't unblock it the way it looked like it would.
- Whether to try Taunt on Mission 12's turn-4 Choir wave live before any future automated version gets built — this was already asked once, still open, and now has extra weight given three separate naive automated versions have all failed differently.
- Whether the boss-priority discount (Tier C, shipped) is worth tuning further (the 0.5 constant was a guess, not sim-tuned) once commander protection actually improves and stops masking its signal, or left as-is.
- Taunt's new root/lock (§1b) has no live case to prove itself against yet — worth confirming it's still wanted as pure PvP-readiness infrastructure with zero current payoff, or whether it should wait until a PvP mode is actually being built.

## 5. What this doesn't change

The Player AI code changes in §1a/§1b (boss-priority; Guard Taunt's plumbing, reverted-but-present, three times over) live entirely in `src/sim/playerAi/` and `src/sim/run*.ts` — test-only infrastructure never imported by `mission.ts`/`Battle.ts`, so none of that touches shipped mechanics, mission content, or real balance numbers. Taunt's own redesign (§1b — no-charge, root/lock) is a real, shipped ability change, verified with the same typecheck/lint/test/`sim:batch` gate as everything else, and confirmed flat against the prior full-campaign batch (no regression). The actual spawn-list/difficulty edits that follow from a hardened bot's real numbers are still their own future pass, the same way Tier 6's enemy-variety edits followed the audit rather than being bundled into it.
