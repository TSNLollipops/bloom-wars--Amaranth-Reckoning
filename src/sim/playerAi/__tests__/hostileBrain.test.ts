// The Player AI driving the hostile side (17 Sep 2026, Player Bot Reuse
// Plan §2b, E-lite — sim/playerAi/hostileBrain.ts). Real Mission instances
// on the first mech-vs-mech mission (Warden 6), same discipline as the
// other files in this directory. What's pinned: the decision function is
// side-neutral (a hostile unit hunts the player's squad, never its own
// side), the adapter only takes the units it's told to, and a driven run is
// still replayable from its seed.
import { describe, it, expect } from "vitest";
import { Mission } from "../../../engine/mission";
import { AMARANTH_MISSION_2, AMARANTH_MISSION_6 } from "../../../data/campaignAmaranth";
import { createPlayerAiMemory, decidePlayerAiAction, HARD, MODERATE } from "../index";
import { createBotHostileBrain, hostileSideProfile, isHostileMech } from "../hostileBrain";
import { driveMission } from "../../driveMission";
import { threatMapFor } from "../hard";

const NEUTRAL = { mission: { objective: "eliminate_all" as const, objectiveParams: {} }, map: {} };

describe("decidePlayerAiAction is side-neutral", () => {
  it("a hostile mech only ever targets the player side", () => {
    const m = new Mission(AMARANTH_MISSION_6);
    const mech = m.units.find((u) => isHostileMech(u) && !u.downed)!;
    const player = m.units.find((u) => u.side === "player" && !u.downed && u.path !== "meeps")!;
    // Everyone else parked in a corner; one player unit right next to the mech.
    for (const u of m.units) if (u !== mech && u !== player) u.pos = { x: 0, y: 0 };
    player.pos = { x: mech.pos.x - 1, y: mech.pos.y };
    const memory = createPlayerAiMemory(Math.random, "hostile");
    const profile = hostileSideProfile("moderate");
    const decision = decidePlayerAiAction(m.map, mech, m.units, m.turn, NEUTRAL, profile, memory);
    expect(decision.attackTargetId).toBe(player.instanceId);
  });

  it("a player unit still targets hostiles (the default is unchanged)", () => {
    const m = new Mission(AMARANTH_MISSION_6);
    const pilot = m.units.find((u) => u.side === "player" && !u.downed && u.path !== "munti")!;
    const mech = m.units.find((u) => isHostileMech(u) && !u.downed)!;
    for (const u of m.units) if (u !== mech && u !== pilot) u.pos = { x: 0, y: 0 };
    pilot.pos = { x: mech.pos.x - 1, y: mech.pos.y };
    const decision = decidePlayerAiAction(m.map, pilot, m.units, m.turn, NEUTRAL, MODERATE, createPlayerAiMemory());
    if (decision.attackTargetId) {
      expect(m.units.find((u) => u.instanceId === decision.attackTargetId)!.side).toBe("hostile");
    }
  });

  it("the Hard threat map a hostile-side memory builds is the player squad's reach", () => {
    const m = new Mission(AMARANTH_MISSION_2);
    const hostileMemory = createPlayerAiMemory(Math.random, "hostile");
    const playerMemory = createPlayerAiMemory();
    expect(threatMapFor(hostileMemory, m.map, m.units, m.turn).footprints.every((f) => f.hostile.side === "player")).toBe(true);
    expect(threatMapFor(playerMemory, m.map, m.units, m.turn).footprints.every((f) => f.hostile.side === "hostile")).toBe(true);
  });
});

describe("hostileSideProfile", () => {
  it("keeps the tier's judgement, drops every ability and the oracle", () => {
    const p = hostileSideProfile("hard");
    expect(p.tier).toBe("hard");
    expect(p.threatMap).toBe(HARD.threatMap);
    expect(p.hostileOracle).toBe(false);
    expect(Object.keys(p.useAbilities)).toHaveLength(0);
  });
});

describe("createBotHostileBrain", () => {
  it("takes hostile mechs and leaves the Bloom to their own brains", () => {
    const m = new Mission(AMARANTH_MISSION_2); // Bloom only
    const brain = createBotHostileBrain();
    const bloom = m.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    expect(brain(m.map, bloom, m.units, m.turn)).toBeUndefined();
    const m6 = new Mission(AMARANTH_MISSION_6);
    const mech = m6.units.find((u) => isHostileMech(u))!;
    expect(brain(m6.map, mech, m6.units, m6.turn)).toBeDefined();
  });

  it("honours a custom `controls` filter", () => {
    const m = new Mission(AMARANTH_MISSION_6);
    const brain = createBotHostileBrain({ controls: () => false });
    const mech = m.units.find((u) => isHostileMech(u))!;
    expect(brain(m.map, mech, m.units, m.turn)).toBeUndefined();
  });

  it("only ever returns a move and an attack", () => {
    const m = new Mission(AMARANTH_MISSION_6);
    const brain = createBotHostileBrain({ tier: "hard" });
    for (const u of m.units.filter(isHostileMech)) {
      const d = brain(m.map, u, m.units, m.turn)!;
      expect(Object.keys(d).every((k) => k === "path" || k === "attackTargetId")).toBe(true);
    }
  });
});

describe("driveMission with hostileTier", () => {
  it("runs to an end and replays identically from the same seed", () => {
    const a = driveMission(AMARANTH_MISSION_6, { seed: 4242, hostileTier: "moderate" });
    const b = driveMission(AMARANTH_MISSION_6, { seed: 4242, hostileTier: "moderate" });
    expect(a.outcome).not.toBe("ongoing_timeout");
    expect(b.outcome).toBe(a.outcome);
    expect(b.mission.turn).toBe(a.mission.turn);
    expect(b.mission.log).toEqual(a.mission.log);
  });

  it("changes how the enemy plays (the log differs from the built-in brain on the same seed)", () => {
    const builtIn = driveMission(AMARANTH_MISSION_6, { seed: 4242 });
    const bot = driveMission(AMARANTH_MISSION_6, { seed: 4242, hostileTier: "hard" });
    expect(bot.mission.log).not.toEqual(builtIn.mission.log);
  });
});
