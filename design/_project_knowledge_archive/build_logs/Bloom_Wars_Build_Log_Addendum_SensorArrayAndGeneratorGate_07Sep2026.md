# Build Log Addendum — Sensor Array wired, Generator gate extended to Weapons Bay and Sensor Array
**7 Sep 2026**

*Maxime, on reading the codex sandbox's own dev note on the Sensor Array entry ("DESIGNED, NOT BUILT — do not ship this entry until the bay does something"): "ah. better fix those two buildable room. do that while I check the codex." Both fixes built, gated, and committed to his machine in the same sitting. This is the record.*

## What was actually broken — verified against the real files, not the docs

**The Long-Range Sensor Array did nothing.** Locked 23 Aug 2026 in `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.2 — "removes fog of war from mission maps campaign-wide, from the moment it's built onward", burrowed and concealed units unchanged, Generator-dependent — and never wired. On 7 Sep, `sensorArray` appeared in the engine in exactly two places, both of them the bay marker in the two facility profiles. `chatIntent.ts` listed it as a `BuildableBayId`; `Hub.ts` would take the company points, log "Approved. SENSOR ARRAY, logged and building.", and paint the marker solid. Nothing in `ai.ts`, `mission.ts`, or `Battle.ts` ever read whether it was built. This has been true since 28 Aug, when Weapons Bay and Fabricator got wired and "the other four" were deferred; Beacon Control and Restock Room caught up on 4 Sep and the Sensor Array never did.

**The Weapons Bay wasn't Generator-gated.** The 23 Aug lock named it one of the three Generator-dependent bays. The 28 Aug delivery note (`Bloom_Wars_Weapons_Bay_And_Fabricator_Delivery_v1.md`) flagged plainly that the dependency wasn't implemented and asked; the 4 Sep Beacon Control build enforced the gate for Beacon/Restock and its own `Hub.ts` comment said, honestly, that retrofitting Weapons Bay and Sensor Array "would change already-shipped, already-playtested behavior nobody asked to change on this pass." Nobody asked until today.

## What shipped

**1. The Sensor Array's reveal, in `engine/ai.ts`.** `unitsVisibleToSide(side, allUnits, currentTurn?, options?)` gained an optional fourth argument, `{ sensorArray?: boolean }`. With it set, every living, *standing* enemy of `side` counts as visible regardless of distance from any observer. Burrowed and concealed targets stay hidden — exactly §11.2's own carve-out — and are still only seen the ways they always were (a sweep's paint, a `detectsBurrowedRadius` observer, or the cloak dropping). Omitted or false, the function is byte-identical to before: every existing caller, every existing test, and the sim harness keep their old fog. The rule lives next to `isVisibleTo`, where every other fog rule lives.

**2. One fog query on `Mission`, and every player-facing caller routed through it.** New public getter `Mission.sensorArrayBuilt` and new method `Mission.playerVisibleHostileIds()` — `unitsVisibleToSide("player", this.units, this.turn, { sensorArray: this.sensorArrayBuilt })`. Four call sites used to ask `ai.ts` directly and now ask the Mission instead: `scenes/Battle.ts`'s `visibleHostileIds()` (what's drawn and clickable on the board), and the three any-range Heirloom target pools in `mission.ts` — Ichigeki's `getDeadfallStrikeTargetsFrom` and `deadfallStrike`, and Simulacrum's `getLedgerhallStaticTargetsFrom`. (The first draft of this sentence — and of `playerVisibleHostileIds`'s own doc comment, which was already committed — called all three "Deadfall's"; checked against the file before the addendum went out, the third is Ledgerhall Static. The code comment was corrected in a second commit to `mission.ts`, recorded below.) That reroute *is* the fix: the Mission is the one object that knows which bays the campaign built, so it's the one place the bay can be applied. `Battle.ts` dropped its now-unused `unitsVisibleToSide` import.

**3. The sim bot sees what the player sees.** `sim/playerAi/types.ts`'s `PlayerAiMissionContext` gained an optional `sensorArrayBuilt?: boolean` (same optional-for-hand-built-test-contexts shape as `fireSupportBonusChargeReady`), read structurally off the live Mission the way the rest of that context already is. Both `honestVision` fog queries in `sim/playerAi/index.ts` pass it through. A fog-honest bot on a campaign that built the array is no longer playing blinder than the human on the same save. Driven end to end: `driveMission(AMARANTH_MISSION_4, { builtBays: ["generator","sensorArray"], seed: 7 })` completes with `sensorArrayBuilt: true` on the resulting mission.

**4. The Generator gate moved into the engine and grew.** New in `engine/campaignEconomy.ts`: `GENERATOR_DEPENDENT_BAYS = ["beaconControl", "restockRoom", "weaponsBay", "sensorArray"]` and `bayNeedsGeneratorFirst(bayId, builtBays)`. `Hub.ts`'s `handleBuildRequest` calls that instead of its own inline two-item list and keeps only the CO's line ("needs power first, Commander — get the Generator built before that one"). A rule about what the company may build belongs with the other purchase rules, and a Phaser scene can't be unit-tested; the 4 Sep version couldn't be. The comment on the constant is the honest record of what's gated and what isn't.

**Deliberately not gated, still: the Fabricator.** It was the *first* bay §11.2 named as Generator-dependent ("allow you to power fabricator and other heavy room") and it's the one Maxime's "those two" didn't name. Left as shipped and flagged here, same discipline the 4 Sep pass held. One line to change when he says so.

**Not a teardown.** The gate is construction-time only. A save from before today that built the Weapons Bay with no Generator keeps it; nothing is retroactively unpowered. `bayNeedsGeneratorFirst("weaponsBay", ["weaponsBay"])` returns true, and `Hub.ts` refuses a duplicate build before the rule is ever consulted — pinned by a test so a future refactor can't quietly turn it into one.

## Tests

New `src/engine/__tests__/sensorArray.test.ts`, 14 cases in three groups: the `sensorArray` option on `unitsVisibleToSide` (baseline unchanged with no option, `{}`, and `false`; a far standing hostile revealed; burrowed stays hidden; swept-and-burrowed still seen — the array adds, never subtracts; concealed stays hidden, tested from the hostile side against a cloaked Rourke; downed never revealed); `Mission.playerVisibleHostileIds` (matches the plain query with no bay; reveals a far Crawlmass and not a far burrowed Undertow with the bay; every other bay built but not this one behaves as unbuilt; the Deadfall pool still returns cleanly); and `bayNeedsGeneratorFirst` (exactly the four powered bays; each refused without the Generator and allowed with it; Generator and Fabricator never gated; already-built bays untouched). Named pilots' own detection quirks (Rourke's Runemaster-primary burrow detection, Anand's vibrissal chassis) are stripped in the test fixture so distance is the only variable — each has its own tests elsewhere.

## Verification gate

Run in a sandbox mirror built from all 236 files staged fresh off Maxime's machine this session (no shell on his machine today; a `git clone` was refused by the sandbox policy, so the tree was staged in five batches and `npm ci` run against his own `package-lock.json`). Baseline on the untouched mirror first — `tsc` 0 errors, 100 files / 2510 tests — matching the last recorded gate exactly, which is the proof the mirror is faithful. Then, with the change:

- `npx tsc --noEmit` — clean
- `npx eslint` on all eight touched files — clean
- `node tools/lint-spoiler.mjs` — no-op (`BW_RESERVED_TERM` unset in the sandbox, as always)
- `node tools/lint-cast-collision.mjs` — clean
- `npx vitest run` — **101 files / 2524 tests, all passing** (2510 + 14)
- `npx vite build` — clean (the pre-existing chunk-size warning only)
- `driveMission` smoke on Mission 4 with and without the array — both complete

**Committed to Maxime's machine** via the device bridge: `src/engine/ai.ts`, `src/engine/mission.ts`, `src/engine/campaignEconomy.ts`, `src/scenes/Hub.ts`, `src/scenes/Battle.ts`, `src/sim/playerAi/index.ts`, `src/sim/playerAi/types.ts`, and the new test file. Every existing file carried the `expectedMtimeMs` from its own staging this session; zero rejections, so nobody else wrote to any of them in between. **A second commit to `mission.ts` alone** followed minutes later — the doc-comment correction noted in §2 above (comment-only; `tsc` and eslint re-run clean on the file), against the mtime the first commit had just produced, again with zero rejections.

## What's still owed

- **Nobody has watched it on Maxime's screen.** Build the Generator, then the Sensor Array, deploy, and watch a hostile outside every pilot's vision appear on the board — and watch a burrowed Undertow *not* appear. Same "never seen live" caveat every other build this week carries.
- **`npm run lint` on his machine**, for the real `lint-spoiler` pass. No new player-facing strings this pass (the CO's refusal line already existed), so nothing new to trip it.
- **The Fabricator's Generator gate** — one line in `GENERATOR_DEPENDENT_BAYS`, waiting on his word.
- **The codex sandbox's Sensor Array entry** loses its "designed, not built" flag; the codex rework plan's §4 item 6 is updated in the same pass as this addendum.

## Docs this touches

- `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.2 — the Sensor Array row should read "built, 7 Sep 2026" and the Weapons Bay row's Generator note should say "enforced, 7 Sep 2026". Not edited from this session (that doc is large; the project's own convention is to fold these in on the next full pass).
- `Bloom_Wars_Weapons_Bay_And_Fabricator_Delivery_v1.md` "Open, for you" #1 and #3 — both now answered (Weapons Bay gated; Sensor Array wired). Same fold-in convention.
- `Bloom_Wars_Codex_Rework_Plan_v1.md` §4 item 6 — updated in this pass.
- `Bloom_Wars_Now_And_Next.md` and `Bloom_Wars_History.md` — updated in this pass.
