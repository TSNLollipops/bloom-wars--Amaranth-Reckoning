# Frame Systems Layer — economy sim harness, `npm run sim:economy` — 6 September 2026

Maxime said "keep building" with no specific target. Rather than guess at a build with no obvious next item (see the AskUserQuestion pass this session — nothing was genuinely shovel-ready without either a design decision or risking scope creep the project's own standing rule says to flag first), the honest move was to surface that plainly and ask. He picked talking through the Frame Systems Layer proposal (`Bloom_Wars_Frame_Systems_Layer_v1.md`) — the doc's own §14 had five open questions sitting on it since 27 Aug 2026, three decided, none acted on.

## The five decisions, locked this session

Asked directly, twice (the second round corrected a wrong premise in the first — see below), via popup:

1. **The B-tier core system is granted free**, not purchased with personal points. Reads as "your frame comes online," not another shop decision — §9b already removed the choice element on purpose.
2. **The A-tier Frame Refit stands alone as the capstone purchase. Meeps and Tank are NOT forced into a 4th weapon branch to match Munti's new Combat Medic.** Munti needed a real 4th branch because its first three (Rapid Response/Aegis Ward/Field Doctor) were flat radius/cooldown tweaks on one mechanic with no flagship move; Meeps and Tank's three branches each already include one (Shock Claws, Grinder Claw). This also resolves Now & Next's own open "Needs Maxime's call" #5 the same way.
3. **Tier 1 and salvage ship together**, not staggered — matching §7's own framing that salvage is "the point of the layer," not a follow-on.
4. **An Heirloom holder still climbs the ordinary G→A ladder normally.** Gjallar/Requiem (currently Bosk's, not Rourke's — a real correction mid-session, see below) sits on top as a separate S-tier weapon, not a replacement for ordinary tier progression.
5. **But Requiem takes that pilot's core slot.** Whoever's holding it doesn't also get their path's B-tier core (no Bulwark Dome for Bosk while he carries Gjallar). Since the core is free either way, this has zero effect on the personal-points economy — noted so the omission from the harness below reads as deliberate.

**A real correction caught mid-conversation, worth recording plainly:** the first round of questions assumed Rourke carries the Heirloom by default. Wrong — Bosk carries Gjallar/Requiem starting Mission 2 (`Bloom_Wars_Heirloom_Naming_Update_2Sep2026.md`); Rourke only inherits it if Bosk dies. Caught by Maxime directly ("rourke doesnt get an heirloom unless bosk die"), the question was re-asked correctly rather than pushed through on the wrong premise.

Full exchange, both rounds of questions and answers, lives in this session's own chat record — not re-transcribed here per the "don't duplicate a doc's own content" discipline; this addendum is the build record, not the design conversation.

## What was actually built: the harness, not Tier 1 itself

Asked for a straight go/no-go on where to start (three options: the harness first, skip straight to Tier 1 data/shop, or stop and update docs only), Maxime picked **the harness** — matching the already-standing 27 Aug 2026 decision that "the economy sim harness gets built first, before Tier 1," which had never actually been acted on (§12: "there is still no economy sim harness... every Draw number, every cost, and every tier capacity in this doc is a guess with a shape, not a tuned value").

**New files:**
- `src/sim/runFrameSystemsEconomySim.ts` — the harness itself. `npm run sim:economy` (one company, seed 1); `-- --runs=N` for N companies aggregated; `--seed=N`; `--verbose` for a per-pilot table; `--json=path` to dump raw per-pilot end-state records.
- `src/sim/frameSystemsEconomyParams.ts` — every Frame Systems number the harness needs, split honestly into two kinds: numbers **transcribed straight from the design doc** (the §3 tier→Draw/mounts table, the §7 salvage non-Runemaster +1 Draw surcharge — real, decided content) and numbers **invented for this harness only**, each named `PLACEHOLDER_*` and commented with its reasoning (points-per-Draw, the one-time Refit cost, the salvage kill-count threshold, a Draw-cost sampling distribution matching §5's own catalog shape, the assumed Runemaster-mek fraction). Nothing in either file is wired into the live game — this is scratch for tuning numbers before a single line of shop UI exists, the same relationship `design/combat_sim.py` has to Data Pack numbers before they're locked in.
- `package.json` gained the `sim:economy` script entry, same convention as `sim`/`sim:batch`/`sim:social`/`sim:gate`/`sim:recroom`.

**What it simulates:** a synthetic 15-pilot company's PERSONAL-points earn/spend loop across a full 36-mission campaign — reusing the real, live `KILL_BONUS`/`SURVIVAL_BONUS`/`OBJECTIVE_BONUS`/`TIER_ORDER`/`TIER_UPGRADE_COST`/`MEK_SECONDARY_COST` from `engine/campaignEconomy.ts` and `WEAPON_BRANCH_COSTS`/`WEAPON_BRANCH_TIER_GATE`/`WEAPON_BRANCHES_BY_PATH` from `data/weaponBranches.ts` directly, so the harness can never quietly drift from the shipped economy the way a hand-copied number could. 15 pilots split into four deployment/performance bands (anchor/focus/core/bench, roughly 1/4/6/4) rather than 15 individually-tuned entries, since the doc asks for "a plausible spending policy," not a simulation of any one named pilot.

**What it deliberately does not do:** replay actual combat (kills/downs/wins are drawn from a plausible statistical model, not `driveMission()` — combat balance is `npm run sim`/`sim:batch`'s job already) or model the COMPANY pool (spare parts, carrier modules, Beacon stock — existing economy this proposal doesn't touch).

## A real bug the harness caught on its own first run

The first working version had a naive top-to-bottom spending priority (tier upgrade, then branch, then salvage, then mek secondary, then Refit, then dump remainder into generic systems) that looked right and produced a genuinely broken result: the top-earning "anchor" pilot got permanently stuck at tier D, never reaching C, despite earning far more than C's own upgrade cost over the campaign. Cause: the uncapped "buy systems" step at the bottom of the priority list always drained the balance back to near-zero every mission (systems have no ownership cap, only an equip-time Draw cap), so savings could never accumulate across multiple missions toward the next real milestone — every mission's leftover got vacuumed into flavor systems before the following mission's earnings had a chance to add up to anything.

Fixed with a savings-floor guard (`nextCappedCost()`): systems and salvage purchases are only allowed to spend points that sit *above* whatever the next real capped milestone (tier/branch/secondary/Refit) costs, so a pilot always saves toward their next real purchase before spending on discretionary systems. Documented in the code itself as exactly the kind of thing this harness exists to catch — not a design bug in the proposal, a bug in the first naive policy this harness tried.

## Findings — a 25-company (900 pilot-run) pass

Aggregate output, `npm run sim:economy -- --runs=25`:

- **Anchor** (the single busiest pilot, ~95% deployment): reaches tier C by mission ~10 every time, but only **fully maxes (A tier + all 3 branches + secondary + Refit) 48% of the time** — and when it does, averages **mission 34** of 36. The 5 Sep 2026 personal-points retune was sized against the pre-Frame-Systems purchase list (tier+branches+secondary = 2570 points, targeting "full max by mission 25-30"). Adding the Refit (a placeholder 350) and an open-ended systems economy on top pushes even the best pilot's full-max point later than that original target most of the time.
- **Focus** band (4 pilots, ~85% deployment): reaches C reliably (~mission 11-13) but **never fully maxes** under this policy — expected, since they're not the single top earner, but worth knowing the gap between "anchor" and "focus" is this wide once two more purchase categories exist.
- **Core** band (6 pilots, ~55% deployment): ~93-100% eventually reach C, but late — average mission 20-26, uncomfortably close to the Act III boundary (mission 25) for some.
- **Bench** band (4 pilots, ~25% deployment): **94-100% NEVER reach tier C at all.** This is the exact failure mode §12 names by name — "a player who can never afford a second mount" — and under this policy it's not a rare edge case, it's the default outcome for anyone who isn't deployed regularly.

**What this is worth to Maxime, plainly:** these are read-outs against placeholder numbers, not a verdict on the design itself — the point of building the harness before Tier 1 was exactly so a finding like "bench pilots are locked out of the second mount" surfaces now, against invented numbers, rather than after real numbers ship and a player notices in actual play. Two levers exist to change this before Tier 1 ships anything: raise `KILL_BONUS`/`SURVIVAL_BONUS`/`OBJECTIVE_BONUS` again (touches the whole economy, not just Frame Systems), or lower the tier-upgrade/system/Refit costs specifically (touches only this proposal). Worth deciding once, not per number.

## Verification

No `device_bash` on this device this session, so the usual staged-sandbox process: `src/data/*.ts` (44 files) and `src/engine/*.ts` + `cardTable/*.ts` (31 files) plus `package.json`/`package-lock.json`/`tsconfig.json`/`eslint.config.js` staged into a cloud sandbox, `npm ci` (148 packages, clean), then:

- `npx tsc --noEmit` — clean.
- `npx eslint src/sim/runFrameSystemsEconomySim.ts src/sim/frameSystemsEconomyParams.ts` — clean.
- `npx tsx src/sim/runFrameSystemsEconomySim.ts` (several runs, seeds 1/7/99, `--runs=10/25`, `--verbose`) — runs correctly, output sanity-checked by hand (see the bug catch above, and the findings section).

Not run: `npx vitest run` / `npx vite build` against the full repo (scenes/ was never staged — this harness is a standalone CLI tool with no scene dependency, same category as `run.ts`/`runBatch.ts`, neither of which has its own dedicated test file either) and `lint-spoiler.mjs` (same standing gap every recent build carries — it needs `BW_RESERVED_TERM` from Maxime's own git-ignored `.env.local`, not present in this sandbox). Read back both new files by hand before writing this addendum: neither mentions anything close to a reserved term — Draw, Refit, salvage, Foundry, and the four pilot-band names are the only new vocabulary, all generic and game-native.

Committed to the device: `src/sim/runFrameSystemsEconomySim.ts` (new), `src/sim/frameSystemsEconomyParams.ts` (new), `package.json` (modified, fresh mtime check immediately before committing, zero conflict).

## Genuinely still open

- **Tier 1 itself is not built.** This session built the harness the 27 Aug decision said comes first, not the data model/shop UI/equip screen — that's the next ask, once the earn-rate/cost-lever question above gets a real answer.
- **Every placeholder number in `frameSystemsEconomyParams.ts` is exactly that.** Named, commented, and reasoned about, but not Maxime's numbers — worth more harness runs (`--runs=100`+) once he has a preferred earn-rate/cost answer, before any of them become real shipped data.
- **The harness models the personal-points economy only**, as scoped — the company pool (spare parts, carrier modules, Beacon stock) is untouched and out of scope for this proposal.
- **The salvage kill-counter is a simplified aggregate** (one counter per pilot standing in for "kills toward whichever of the five salvage archetypes is closest"), not five separately-tracked archetype counters — a real Tier 1 build needs the real per-archetype version; this harness only needed a plausible aggregate to test the gating shape.
- **Nobody has watched this run on Maxime's own machine** — verified by a scoped sandbox toolchain pass and reading the console output by hand, not on his device.
