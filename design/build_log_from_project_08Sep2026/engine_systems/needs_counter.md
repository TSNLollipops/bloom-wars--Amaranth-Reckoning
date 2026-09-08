# Off-Duty Needs Counter — Hunger/Thirst/Sleep (shipped 28 Aug 2026)

Origin: item 1 of Maxime's own "Antfarm Réalisation plan" Phase 1 gate (a plan not otherwise on record in this project — referenced by the spec PDF's own header, not located elsewhere; worth asking Maxime where the rest of that plan lives if it matters later). Built from `claude_Bloom_Wars_Needs_Counter_Spec_v1.pdf`, a zero-code, fully-decided build spec written under Maxime's own explicit latitude: **"you'll make a lot of decisions for me."** Every numeric constant is a first guess, flagged as such in both the spec and the code, same "not locked, tune against real play" status as every other placeholder in this project.

This is also the first real writer `HubPilotSocialState.stress`/`.morale` have ever had. Both fields have sat persisted-but-unused since the Hub Build Plan's §19 (26 Aug) — flagged as an open gap four separate times, most recently in `Bloom_Wars_Stress_Morale_Trigger_Proposal_v1.md`. See that doc's own resolution note for how this spec answers its four open questions.

## The three meters

Hunger, Thirst, Sleep — plain `number`, 0-100, per pilot, on `HubNpc` (the scene's own transient per-NPC state), not persisted. Not built onto the CO (`Arangement of Content`): he gets the three fields (required by the type) seeded at 100 but no `nextNeedsTickAt`, so they never tick — same exclusion pattern already established for his `nextRoamAt`/`nextEncounterAt`.

**Off-duty only, as an emergent property of the architecture, not a special-cased check.** The spec calls for meters frozen while a pilot is deployed on a mission, resuming the moment they're back in the Hub. `updateNeeds()` only ever runs from `Hub.ts`'s own `update()` loop, which Phaser only calls while the Hub scene is the active one — during a mission the player is in `Battle.ts` instead, so the Hub scene simply isn't ticking at all. Nothing needed to be written to detect "deployed"; it falls out of the scene being inactive, the same way Mission Worry's own real-minute clock is already scene-relative rather than wall-clock.

**Decay and restore are additive, not restore-replacing-decay** — a deliberate reading of the spec's wording, named in `needsCounter.ts`'s own header comment so it's easy to overrule: `NEEDS_DECAY_PER_MIN = 1` always, off-duty; `NEEDS_RESTORE_PER_MIN = 2` on top of that while standing in the right room. Net: -1/min anywhere, +1/min while actually resting/eating in the matching room. Sleep restores in Berths; Hunger and Thirst both restore in Rec Room (already the space Share a Drink's own fiction lives in) — `NEED_ROOM: Record<NeedKind, "berths" | "recroom">` is the single lookup both the restore check and the roaming bias (below) read from, so they can't disagree about which room matters for which meter.

## What it writes to

Once a meter drops below `NEEDS_LOW_THRESHOLD` (30 — shared across all three uses below, per the spec's own framing), it ticks a small Stress/Morale delta once per real minute it stays low: `+1` Stress / `-1` Morale per meter below threshold, capped at `NEEDS_STRESS_MORALE_TICK_CAP = 3` regardless of how many meters are low (with exactly three meters this can never bind tighter than the natural one-point-per-meter sum, but it's still its own named constant, not an implicit consequence of "there happen to be three meters" — a future fourth meter can't silently blow past what the spec actually asked for). Writes through the same `persistNpcSocial()` path every other Hub social mutation already uses.

One JS-specific bug caught in testing: `moraleDelta: -magnitude` produces `-0` when `magnitude` is `0` — a distinct value from `0` under `toEqual`. Fixed as `magnitude === 0 ? 0 : -magnitude`.

## Surfacing, without a bar

Per the spec's own §1 answer to the visible-bar question — implicit only, no new UI, matching how Stage and relationship-stage already surface (readouts and dialogue tone, not a meter):

- **Roaming bias.** `worstNeed(hunger, thirst, sleep)` — a single shared "which meter is worst" function — feeds a weight bump (`NEEDS_ROAM_WEIGHT_BONUS`) toward that meter's matching room inside `pickExploreTarget`, stacking with the existing Berths bump rather than replacing it. Same function also drives the flavor-line pick below, so the room an NPC drifts toward and the line they might say about it can never disagree.
- **A 6-line flavor bank** (`NEEDS_FLAVOR_BANK`, 2 lines each for hunger/thirst/sleep, fear- or sadness-echo tagged) drawn at `pickAmbientLineWithMemory()`'s entry point — checked first, ahead of the ordinary catalyst/echo/sub-animal-bleed chain — via a flat `NEEDS_FLAVOR_CHANCE = 0.3` roll whenever a need is low. Same shape as `catalystProfile.ts`'s existing `AMBIENT_BLEED_CHANCE` roll (a chance substitution at the same draw point), kept as its own separate constant since the two features aren't meant to drift together just because they start at the same value. A flat override, not routed through `pickSlottedVariant`/`LINE_BANK` — the six lines are fixed factual text, not personality-flavored content.

## Persistence

The needs meters themselves are **not** persisted — same "ephemeral, gone on reload" choice Mission Worry already made, per the spec's own §5. Reseeded to 100 for every pilot on scene construction (`buildNpcs()`). What the meters *drive* (Stress/Morale) **is** persisted, exactly as it already was on `HubPilotSocialState` — this system is a new writer to an existing persisted field, not a new save-schema addition itself.

## What this deliberately doesn't do (per the spec's own §6)

No CO/grotto Stress-relief hook — no real CO Stress-relief content exists yet to hang it on; for now this counter is the *primary* passive Stress/Morale driver, with Share a Drink/minigames/Ask Out as the active, player-triggered counterweights (spec §1, answer 4). No mission-outcome writer — stays out of `Debrief.ts`/campaign state entirely; partial coverage already exists via the hot-topics mission echo and Munti-grief lines. No bar or numeric readout anywhere. No new verb, no new room — restore is entirely passive off room presence.

## Verification

Full local-clone pipeline, same discipline as every other change landed this way this project: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` (**48 files / 1016 tests**, up from 1003 — 13 new in `needsCounter.test.ts`), `npm run build`, plus `npm run sim`/`npm run sim:social` as clean-exit sanity checks — all clean. One TypeScript catch along the way: an inline array literal chained straight into `.filter()` inside `worstNeed()` widened its `kind` field to plain `string` before the filter ran, since the type annotation sat on the post-filter result rather than the literal itself; fixed by splitting into two statements with the annotation directly on the array.

Committed to the device same session: `data/needsCounter.ts` (new), `data/__tests__/needsCounter.test.ts` (new), `scenes/Hub.ts` (modified) — with a fresh mtime check on `Hub.ts` immediately before committing, which also resolved a loose end from earlier the same day: `Hub.ts`'s previously-unexplained 02:39:04 UTC mtime was confirmed unchanged right up to this commit, meaning nothing else touched the file in between and this system's edits are safely layered on exactly the state that mystery write left behind — still unexplained, but no longer a risk of silently overwriting unrelated work.

## Still genuinely open

Every numeric constant (`NEEDS_DECAY_PER_MIN`, `NEEDS_RESTORE_PER_MIN`, `NEEDS_LOW_THRESHOLD`, `NEEDS_STRESS_MORALE_TICK_CAP`, `NEEDS_FLAVOR_CHANCE`, `NEEDS_ROAM_WEIGHT_BONUS`) is a first guess, meant to be tuned once this is live rather than argued over now — same status as `WORRY_ONSET_MS`/`RIVAL_AVOID_CHANCE`/every other placeholder this project already holds to that standard. No live-browser/Playwright check of how the roaming bias or flavor lines actually read in the running game — this session has no way to reach a localhost dev server or Maxime's own screen; verification here is unit tests plus the four-command gate, same honest gap several other Hub.ts passes have carried. The CO/grotto Stress-relief hook, a mission-outcome writer, and any visible readout all remain deliberately out of scope, per the spec's own §6 — nameable follow-ups, not gaps in this pass.

**Origin thread still open:** the "Antfarm Réalisation plan" the spec's own header names as this item's source isn't a doc that exists anywhere in this project — worth asking Maxime whether the rest of that plan lives somewhere else (a personal note, a different tool) that should get folded in, or whether this spec's own §1-§7 is the whole of it.
