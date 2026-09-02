// Send-Off tactical payoff (2 Sep 2026) — the crew-interactions pass that
// shipped the Hub-side ritual (data/socialActions.ts's pickSendOffLine,
// CampaignState.preMissionSendOff) left the actual Battle-side bonus as a
// real, named but intentionally unconsumed hook. This is that hook's own
// test coverage: the flat effectiveDefense bonus createPlayerUnit grants a
// sent-off pilot, both directly (engine/units.ts) and through the real
// Mission/DeployRosterEntry path (engine/mission.ts) — the two places this
// project's own "verify against the actual current file" discipline says
// need checking, since a flag threaded through three files is exactly the
// kind of wiring that's easy to get half-right.
//
// NOT covered here: scenes/Battle.ts's resolveDeployRoster, which is where
// CampaignState.preMissionSendOff actually gets read and consumed. That
// method lives on a Phaser Scene (Battle.ts imports Phaser at module scope,
// same reason scenes/Hub.ts has had zero unit tests since Phase 1 — see
// engine/hubGeometry.ts's own header) and this sandbox has no way to run it
// outside a real browser. Checked instead by direct code reading: the
// consumption logic mirrors the Munti-guarantee/bonus-objective "resolve
// once against whatever state exists" pattern already proven elsewhere in
// this codebase, and it's a straight-line find-and-flip with no branching
// this test suite's own createPlayerUnit coverage can't already validate.
import { describe, it, expect } from "vitest";
import { createPlayerUnit } from "../units";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { findPilot } from "../../data/pilotRegistry";
import { SEND_OFF_DEFENSE_BONUS } from "../../data/socialActions";

describe("Send-Off tactical payoff", () => {
  it("createPlayerUnit: no sendOffBonus override leaves effectiveDefense and sentOff untouched", () => {
    const plain = createPlayerUnit("pilot_rourke", { x: 0, y: 0 });
    const baseline = createPlayerUnit("pilot_rourke", { x: 0, y: 0 }, {});
    expect(plain.sentOff).not.toBe(true);
    expect(plain.effectiveDefense).toBe(baseline.effectiveDefense);
  });

  it("createPlayerUnit: sendOffBonus: true adds exactly SEND_OFF_DEFENSE_BONUS to effectiveDefense and flags sentOff", () => {
    const plain = createPlayerUnit("pilot_rourke", { x: 0, y: 0 });
    const sentOff = createPlayerUnit("pilot_rourke", { x: 0, y: 0 }, { sendOffBonus: true });
    expect(sentOff.sentOff).toBe(true);
    expect(sentOff.effectiveDefense).toBe(plain.effectiveDefense + SEND_OFF_DEFENSE_BONUS);
    // Nothing else about the unit should move — this is a defense-only
    // bonus, not a general stat-up.
    expect(sentOff.effectiveAttack).toBe(plain.effectiveAttack);
    expect(sentOff.maxHp).toBe(plain.maxHp);
  });

  it("createPlayerUnit: sendOffBonus: false behaves identically to omitting it", () => {
    const omitted = createPlayerUnit("pilot_rourke", { x: 0, y: 0 });
    const explicit = createPlayerUnit("pilot_rourke", { x: 0, y: 0 }, { sendOffBonus: false });
    expect(explicit.sentOff).not.toBe(true);
    expect(explicit.effectiveDefense).toBe(omitted.effectiveDefense);
  });

  it("Mission + DeployRosterEntry: only the roster entry carrying sendOffBonus gets the bonus, nobody else on the squad does", () => {
    const nagori = findPilot("pilot_nagori")!;
    const barasj = findPilot("pilot_barasj")!;
    const mission = new Mission(MISSION_1A, [
      { pilotId: "pilot_nagori", pilot: nagori, sendOffBonus: true },
      { pilotId: "pilot_barasj", pilot: barasj },
    ]);
    const sentOffUnit = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    const ordinaryUnit = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    expect(sentOffUnit.sentOff).toBe(true);
    expect(ordinaryUnit.sentOff).not.toBe(true);

    // Cross-check against the same pilot built with no bonus at all, so this
    // assertion can't pass by coincidence if Nagori's own base defense ever
    // changes.
    const nagoriBaseline = createPlayerUnit("pilot_nagori", { x: 0, y: 0 }, { pilot: nagori });
    expect(sentOffUnit.effectiveDefense).toBe(nagoriBaseline.effectiveDefense + SEND_OFF_DEFENSE_BONUS);
  });
});
