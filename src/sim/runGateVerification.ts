// src/sim/runGateVerification.ts
// Tier 1 Gate Verification — Antfarm Realisation Phase 1 gate, item 4
// (claude_Bloom_Wars_Gate_Verification_Spec_v1.md), built 28 Aug 2026, same
// day and same session as the Groups 3-5 batch rebuild the functions below
// come from. See the spec's own §3 for the two-tier split this implements
// half of, and §4 for why this is framed as "the first slice of Phase 2,"
// not a separate, throwaway thing: a compressed-clock runner driving the
// live needs/Stress/reaction/bond code outside real-time IS the eventual
// Antfarm Realisation harness's own first working piece.
//
// This is the PLUMBING check (spec §3, Tier 1) — NOT the gate itself. The
// gate only closes on Tier 2: a real Hub session, played or left running
// normally, with the chain occurring because the systems produced it, not
// because anything was forced (spec §3, §5). A clean run of this script is
// not a claim that the gate is met; it's confirmation that a broken link
// here would be caught in minutes rather than discovered after hours of
// idle real-time play waiting on Tier 2. `npm run sim:gate`.
//
// Scoped narrowly per spec §4's own instruction ("Tier 1 only needs to run
// the specific chain in §2, not the full harness's eventual scope... Grow
// it later, don't build the whole thing now to answer one yes-or-no
// question"): this drives exactly the chain spec §2 describes (needs ->
// Stress -> Anger Blowup/Breakdown -> a real relationship shift) and
// nothing past it — no Grief Catalyst, no curated recall, no full harness
// scope. Lane 1 (Anger Blowup) demonstrates that shift as a real bond
// change; Lane 2 (Breakdown) resolves via the real "sleep" flavor, which
// is Stress relief only, no relationship gain — see runBreakdownLane's
// own header for why that's still the right flavor for this narrow a
// harness to exercise.
//
// Mirrors run.ts/runSocialSim.ts's own conventions: a plain Node/tsx
// script, no Phaser, prints a readable log, exits clean (non-zero on a real
// failure, same as runSocialSim.ts's own round-trip check). Deliberately
// does NOT import scenes/Hub.ts — same reason npcSeed.ts's own header
// already gives for why the background social-sim harness can't either
// (Phaser isn't safe to import under plain Node). Every function this
// script calls IS the exact function Hub.ts's own update loop calls
// (needsCounter.ts's tickNeed/needsStressMoraleDelta, angerBlowup.ts's
// isAngerBlowupEligible/applyAngerBlowupStressRelief, breakdown.ts's
// isBreakdownEligible/applyBreakdownStressRelief) — only the compressed-
// clock driving loop and the per-tick eligibility roll are reimplemented
// here, deliberately simplified (no room/proximity/cooldown modeling;
// Hub.ts's own scene-side pacing is already covered by its tsc/eslint/
// vitest pass, not re-proven here).
//
// Lane 2 rewritten, same day, second pass — the first version gated on
// Morale alone and resolved via an invented "bondmate" flavor that
// doesn't exist in the real module. breakdown.ts's real eligibility gate
// is isBreakdownEligible(stress, worried) — Stress crossing
// STRESS_PANIC_THRESHOLD AND a live Worry signal together, not Morale
// dropping on its own — so this lane now drives Stress up (via the same
// needsStressMoraleDelta neglect path Lane 1 already uses) and sets a
// synthetic worried=true directly, same "earn Stress through real decay,
// state the one condition that isn't itself a decay product plainly"
// balance Lane 1 already strikes for its own rivalry precondition.
//
// Deliberately starts every pilot at HEALTHY Stress/Morale and lets ONE
// specific need (never both/all three at once) decay unaddressed from a
// fresh, compressed clock — even though the real seeded data (npcSeed.ts)
// already has Anand well past STRESS_PANIC_THRESHOLD out of the box.
// Starting pre-loaded near the finish line would only prove the LAST link
// (reaction -> bond), not the whole chain §2 actually describes. This run
// earns its way there through real decay, same as an actual Hub session
// would, and reports exactly which need did it — the concrete, "point to
// it" detail spec §5's pass criteria itself asks for.
import { tickNeed, needsStressMoraleDelta, clampNeed } from "../data/needsCounter";
import { isAngerBlowupEligible, applyAngerBlowupStressRelief, pickAngerBlowupExchange, ANGER_BLOWUP_CHANCE, ANGER_BLOWUP_BOND_DELTA } from "../data/angerBlowup";
import { isBreakdownEligible, applyBreakdownStressRelief, pickBreakdownOnsetLine, pickBreakdownResolutionLine, BREAKDOWN_CHANCE, BREAKDOWN_FAVORABILITY_GAIN } from "../data/breakdown";
import { RIVAL_THRESHOLD } from "../data/npcBonds";
import { STRESS_PANIC_THRESHOLD } from "../data/ambientLines";

const MAX_TICKS = 3000; // generous headroom — see file header; the real expected fire time is well under 200 ticks in both lanes below

type GateResult = { passed: boolean; log: string[] };

// Lane 1 — Anger Blowup. Anand and Iyari, the real seeded rivalry
// (npcSeed.ts's NPC_BOND_SEED: bond -25, already at/below RIVAL_THRESHOLD
// -20 — a real, pre-existing rivalry is the chain's own precondition, not
// something needs create) — reused by name for a concrete, "point to it"
// result rather than an anonymous synthetic pilot, but their Stress starts
// at a healthy 20 here, NOT the real seed's own 78, so this run has to
// earn the panic threshold through real decay rather than start past it.
// Anand's sleep, specifically, is what goes unaddressed.
function runAngerBlowupLane(): GateResult {
  const log: string[] = [];
  const bond = -25; // real seeded Anand/Iyari value
  let anandSleep = 100;
  let anandStress = 20;
  const iyariStress = 30; // stays put — Iyari isn't the neglected one this run

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    anandSleep = tickNeed(anandSleep, false); // Anand's sleep, unaddressed — not in Berths
    const { stressDelta } = needsStressMoraleDelta(100, 100, anandSleep); // hunger/thirst held fine — only sleep is neglected this run
    anandStress = clampNeed(anandStress + stressDelta);

    if (!isAngerBlowupEligible(bond, anandStress, iyariStress)) continue;
    if (Math.random() >= ANGER_BLOWUP_CHANCE) continue;

    const exchange = pickAngerBlowupExchange();
    const newBond = bond + ANGER_BLOWUP_BOND_DELTA;
    const relievedStress = applyAngerBlowupStressRelief(anandStress);

    log.push(`Tick ${tick}: Anand's sleep decayed unaddressed to ${anandSleep} (needsCounter.ts's tickNeed, no restore room) -> Stress climbed to ${anandStress} (needsStressMoraleDelta), crossing STRESS_PANIC_THRESHOLD (${STRESS_PANIC_THRESHOLD}).`);
    log.push(`Tick ${tick}: real rivalry (Anand<->Iyari, bond ${bond}, at/below RIVAL_THRESHOLD ${RIVAL_THRESHOLD}) + Anand's panic Stress made this pair eligible; the ${ANGER_BLOWUP_CHANCE} roll fired.`);
    log.push(`Tick ${tick}: ANGER BLOWUP — "${exchange.lineA}" / "${exchange.lineB}"`);
    log.push(`Tick ${tick}: bond shifted ${bond} -> ${newBond} (ANGER_BLOWUP_BOND_DELTA ${ANGER_BLOWUP_BOND_DELTA}); Anand's Stress relieved ${anandStress} -> ${relievedStress} (applyAngerBlowupStressRelief).`);
    log.push(`Tick ${tick}: a later curated-recall {RIVAL} line (crewBanterSlots.ts) could now name Iyari specifically for Anand — the bond data behind it is real, not placeholder.`);
    return { passed: true, log };
  }

  log.push(`FAIL — never fired within ${MAX_TICKS} ticks. Anand's own Stress reached ${anandStress} (needed >= ${STRESS_PANIC_THRESHOLD}); a wiring gap sits somewhere between needsCounter.ts and angerBlowup.ts, or ANGER_BLOWUP_CHANCE never got a fair shot at rolling true — see Tier 1's own pass/fail guidance, spec §5.`);
  return { passed: false, log };
}

// Lane 2 — Breakdown. Bosk, real seeded Stress 20 (healthy) here for the
// same "earn it through real decay" reason as Lane 1's own Anand start —
// Bosk's sleep, specifically, is what goes unaddressed this run, driving
// Stress up toward STRESS_PANIC_THRESHOLD via the same needsCounter.ts
// path Lane 1 uses. Worry (AmbientPilotState.worried) is a LIVE boolean
// in the real game — recomputed every frame by missionWorry.ts off
// whether a mission is actively running, not a decay product of anything
// this compressed-clock loop drives — so it's set true directly here,
// same as this file's own header now explains, rather than simulated
// through a mission state this narrow Tier 1 harness has no reason to
// model. On firing, resolved via the real "sleep" flavor — no partner
// needed, so this lane doesn't have to stand up a second pilot or a real
// seeded bond just to reach a resolution; "spar"/"intimacy" both need
// room/partner state this harness deliberately doesn't model (see file
// header, MAX_TICKS's own comment on staying scoped to spec §2's chain).
function runBreakdownLane(): GateResult {
  const log: string[] = [];
  let boskSleep = 100;
  let boskStress = 20;
  const boskWorried = true; // live mission-worry signal, held true for this run — see header

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    boskSleep = tickNeed(boskSleep, false); // Bosk's sleep, unaddressed
    const { stressDelta } = needsStressMoraleDelta(100, 100, boskSleep);
    boskStress = clampNeed(boskStress + stressDelta);

    if (!isBreakdownEligible(boskStress, boskWorried)) continue;
    if (Math.random() >= BREAKDOWN_CHANCE) continue;

    const onsetLine = pickBreakdownOnsetLine();
    log.push(`Tick ${tick}: Bosk's sleep decayed unaddressed to ${boskSleep} (needsCounter.ts's tickNeed, no restore room) -> Stress climbed to ${boskStress} (needsStressMoraleDelta), crossing STRESS_PANIC_THRESHOLD (${STRESS_PANIC_THRESHOLD}), with Worry already live.`);
    log.push(`Tick ${tick}: the ${BREAKDOWN_CHANCE} roll fired. BREAKDOWN (onset) — "${onsetLine}"`);

    const relievedStress = applyBreakdownStressRelief(boskStress);
    const resolutionLine = pickBreakdownResolutionLine("sleep");
    log.push(`Tick ${tick}: resolved via "sleep" — nobody reached Bosk in time; BREAKDOWN_SLEEP_TIMEOUT_MS runs out on its own in the real game, no partner or room required for this flavor.`);
    log.push(`Tick ${tick}: BREAKDOWN (resolution) — "${resolutionLine}"`);
    log.push(`Tick ${tick}: Bosk's Stress relieved ${boskStress} -> ${relievedStress} (applyBreakdownStressRelief); no Favorability/bond gain this flavor (BREAKDOWN_FAVORABILITY_GAIN, ${BREAKDOWN_FAVORABILITY_GAIN}, only applies to the "spar"/"intimacy" flavors where someone actually showed up).`);
    log.push(`Tick ${tick}: a later curated-recall line could now reference this specific event and pilot — the data behind it is real, not placeholder.`);
    return { passed: true, log };
  }

  log.push(`FAIL — never fired within ${MAX_TICKS} ticks. Bosk's own Stress reached ${boskStress} (needed >= ${STRESS_PANIC_THRESHOLD}, Worry held true throughout) — a wiring gap sits somewhere between needsCounter.ts and breakdown.ts, or BREAKDOWN_CHANCE never got a fair shot at rolling true — see Tier 1's own pass/fail guidance, spec §5.`);
  return { passed: false, log };
}

console.log("=== Tier 1 Gate Verification — compressed-clock plumbing check ===");
console.log("Not the gate itself (see spec §3/§5) — a fast, dev-only confirmation the real chain wires end to end.");
console.log("");

console.log("--- Lane 1: needs -> Stress -> Anger Blowup -> bond ---");
const lane1 = runAngerBlowupLane();
for (const line of lane1.log) console.log(line);
console.log("");

console.log("--- Lane 2: needs -> Stress (+ live Worry) -> Breakdown -> Stress relief ---");
const lane2 = runBreakdownLane();
for (const line of lane2.log) console.log(line);
console.log("");

const allPassed = lane1.passed && lane2.passed;
console.log(`=== RESULT: ${allPassed ? "PASS" : "FAIL"} — Lane 1 (Anger Blowup): ${lane1.passed ? "fired" : "did not fire"}; Lane 2 (Breakdown): ${lane2.passed ? "fired" : "did not fire"} ===`);
if (!allPassed) process.exitCode = 1;
