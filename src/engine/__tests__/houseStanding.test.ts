// The houses' verdict on a lost aristocrat — 2 Sep 2026.
//
// This system exists because of a correction Maxime made to its own first
// design. That draft imagined three different causes of death for a house
// to react to (died holding the line / died on a botched extraction / left
// behind). His answer killed it in one line: "die only count if there no
// restock." Confirmed against the live engine rather than taken on faith —
// evaluatePermadeathCheck (campaignState.ts) has exactly one branch that
// returns permanent, "no living Munti remains on this side," and every
// other downing is a restock. So cause of death is a CONSTANT in this game
// and carries no information whatsoever.
//
// What varies is the arrangement the company had in place. The four
// signals below are all decisions a player made, never dice, which is the
// whole reason a family could be angry about them. Most of this file is
// about pinning that distinction, because it is the thing that would
// quietly rot if someone later "improved" the scoring by adding a
// how-they-died axis that cannot exist.
import { describe, it, expect, vi } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createWardenCampaignState, applyMissionLosses, type CampaignState, type PilotLossContext } from "../campaignState";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";
import { houseCharges, houseGrievance, grievanceScore } from "../houseStanding";
import {
  recruitHeirloom,
  rollHeirloomShortlist,
  aristocratPilotId,
  heirloomHouseVerdicts,
  heirloomHouseVerdict,
  aristocracyStanding,
  returnedHeirlooms,
} from "../heirlooms";
import {
  HEIRLOOM_RECRUIT_COSTS,
  HEIRLOOM_SHORTLIST_SIZE,
  HEIRLOOM_SHORTLIST_MIN,
  HOUSE_VERDICT_CLAUSES,
  HEIRLOOMS,
} from "../../data/heirlooms";
import { renderHotTopicLine } from "../../data/hotTopics";
import { LINE_BANK, type Catalyst } from "../../data/ambientLines";

/** The cleanest possible loss: two Muntis brought, mission won, fell the same turn the last one did, not a Munti themselves. */
function cleanLoss(over: Partial<PilotLossContext> = {}): PilotLossContext {
  return {
    missionId: "amaranth_1",
    outcome: "win",
    turn: 4,
    turnsWithoutMunti: 0,
    muntisDeployed: 2,
    wasLastMunti: false,
    ...over,
  };
}

describe("houseGrievance — what a family can actually hold the company to", () => {
  it("a company that brought a spare Munti, won, and lost them in the same volley has NO charge against it", () => {
    // This case has to stay reachable. If every loss produced a grievance,
    // "the family had no complaint" would be a line of content nobody ever
    // sees, and the whole system would just be a flat tax on losing a
    // pilot rather than a judgement about how.
    const g = houseGrievance(cleanLoss());
    expect(g.charges).toEqual([]);
    expect(g.score).toBe(0);
    expect(g.verdict).toBe("honoured");
  });

  it("launching on the legal minimum of one Munti is a charge on its own", () => {
    // canLaunchMission's floor is exactly one, so this is a legal squad —
    // and the thinnest bet the rules allow. A house can read a manifest.
    const g = houseGrievance(cleanLoss({ muntisDeployed: 1 }));
    expect(g.charges).toContain("thin_manifest");
    expect(g.verdict).toBe("aggrieved");
  });

  it("sole_lifeline is charged ONLY on top of a thin manifest, never on its own", () => {
    // An aristocrat Munti in a squad with a second Munti who dies as the
    // last one standing is a bad turn. An aristocrat Munti who was the
    // ONLY Munti was made the company's whole lifeline before a shot was
    // fired. Those are different things and only the second is a decision.
    const withSpare = houseCharges(cleanLoss({ wasLastMunti: true, muntisDeployed: 2 }));
    expect(withSpare).not.toContain("sole_lifeline");

    const alone = houseCharges(cleanLoss({ wasLastMunti: true, muntisDeployed: 1 }));
    expect(alone).toContain("sole_lifeline");
    expect(alone).toContain("thin_manifest");
  });

  it("losing the mission too is its own charge — the death bought nothing", () => {
    expect(houseCharges(cleanLoss({ outcome: "loss" }))).toContain("nothing_gained");
  });

  it("left_alone gets heavier the longer the squad kept fighting with no lifeline", () => {
    const brief = grievanceScore(cleanLoss({ turnsWithoutMunti: 1 }));
    const long = grievanceScore(cleanLoss({ turnsWithoutMunti: 3 }));
    expect(brief).toBeGreaterThan(0);
    expect(long).toBeGreaterThan(brief);
    // One turn is a fight going wrong. Three is a company that kept
    // pushing while somebody's heir was out there with nobody coming.
    expect(houseGrievance(cleanLoss({ turnsWithoutMunti: 1 })).verdict).toBe("honoured");
    expect(houseGrievance(cleanLoss({ turnsWithoutMunti: 3 })).verdict).toBe("aggrieved");
  });

  it("the worst case — thin, sole lifeline, lost the mission, left out there — reads estranged and names all four charges", () => {
    const g = houseGrievance({
      missionId: "amaranth_1",
      outcome: "loss",
      turn: 9,
      turnsWithoutMunti: 4,
      muntisDeployed: 1,
      wasLastMunti: true,
    });
    expect(g.verdict).toBe("estranged");
    expect(g.charges.sort()).toEqual(["left_alone", "nothing_gained", "sole_lifeline", "thin_manifest"]);
  });

  it("charges come back heaviest first, so a line of dialogue can lead with the worst of it", () => {
    const g = houseGrievance(cleanLoss({ muntisDeployed: 1, wasLastMunti: true, turnsWithoutMunti: 1 }));
    // thin_manifest (2) outranks both sole_lifeline (1) and left_alone (1).
    expect(g.charges[0]).toBe("thin_manifest");
  });

  it("is pure — the same context scores identically every time, with no state and no rolls", () => {
    const ctx = cleanLoss({ muntisDeployed: 1, outcome: "loss" });
    const runs = new Set(Array.from({ length: 50 }, () => houseGrievance(ctx).score));
    expect(runs.size).toBe(1);
  });
});

// ---- The capture half: Mission has to actually record these -------------

// Same rigged-kill shape commanderDown.test.ts and rescuePilot.test.ts
// already use — a real downing through the public attack() path, so
// handleDowned's own side effects (the collapse latch, the permadeath
// check, the record push) all really run, rather than poking unit.downed
// directly and skipping every one of them.
function riggedKill(mission: Mission, targetId: string) {
  const target = mission.units.find((u) => u.instanceId === targetId)!;
  const hostile = mission.units.find((u) => u.side === "hostile")!;
  hostile.pos = { x: target.pos.x + 1, y: target.pos.y };
  hostile.attackPower = 9999;
  hostile.actionsRemaining = MAX_ACTIONS_PER_TURN;
  target.currentHp = 1;
  const spy = vi.spyOn(Math, "random").mockReturnValue(0.99); // over MEEPS_DODGE_CHANCE — no dodge
  try {
    return mission.attack(hostile.instanceId, targetId);
  } finally {
    spy.mockRestore();
  }
}

/**
 * Ejection capsules (15 Sep 2026): a downed pilot sits in a capsule until
 * the mission ends, and permanentLosses is written then. Ends the mission
 * as a win (every hostile off the board, then the end-of-turn check) so
 * the records exist to read.
 */
function winNow(mission: Mission): void {
  for (const u of mission.units) if (u.side === "hostile") u.downed = true;
  mission.endPlayerTurn();
  expect(mission.outcome).toBe("win");
}

describe("Mission.permanentLosses — capturing how the company was standing", () => {
  it("counts the Muntis the squad actually launched with, latched at deploy", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    const muntis = mission.units.filter((u) => u.side === "player" && u.path === "munti");
    expect(mission.muntisDeployed).toBe(muntis.length);
    expect(mission.muntisDeployed).toBeGreaterThan(0);
  });

  it("records the four facts on a real permanent loss, and turnsWithoutMunti counts from the Munti's own downing", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    const muntis = mission.units.filter((u) => u.side === "player" && u.path === "munti");
    const victim = mission.units.find(
      (u) => u.side === "player" && u.path !== "munti" && u.pilotId && u.pilotId !== "pilot_rourke",
    )!;

    // Drop every Munti first — that is the only thing in this game that
    // makes a later downing permanent at all.
    for (const m of muntis) riggedKill(mission, m.instanceId);
    expect(mission.muntiCollapseTurn).toBe(1);

    mission.turn = 4;
    riggedKill(mission, victim.instanceId);
    expect(mission.permanentLosses).toHaveLength(0); // still in a capsule until the fight ends
    winNow(mission);

    const loss = mission.permanentLosses.find((l) => l.pilotId === victim.pilotId);
    expect(loss).toBeDefined();
    expect(loss!.turn).toBe(4);
    expect(loss!.turnsWithoutMunti).toBe(3);
    expect(loss!.muntisDeployed).toBe(muntis.length);
    expect(loss!.wasLastMunti).toBe(false);
  });

  it("the last Munti dying is itself a permanent loss, with turnsWithoutMunti 0 and wasLastMunti true", () => {
    // The collapse latch has to fire on the SAME downing that produces the
    // record, not one downing late: by the time handleDowned runs,
    // engine/combat.ts has already set unit.downed, so the living-Munti
    // filter correctly excludes the unit currently going down.
    const mission = new Mission(AMARANTH_MISSION_1);
    const muntis = mission.units.filter((u) => u.side === "player" && u.path === "munti");
    for (const m of muntis) riggedKill(mission, m.instanceId);
    winNow(mission);

    const last = muntis[muntis.length - 1];
    const loss = mission.permanentLosses.find((l) => l.pilotId === last.pilotId);
    expect(loss).toBeDefined();
    expect(loss!.wasLastMunti).toBe(true);
    expect(loss!.turnsWithoutMunti).toBe(0);
  });

  it("the collapse turn is latched once and never moved by a later downing", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    const muntis = mission.units.filter((u) => u.side === "player" && u.path === "munti");
    for (const m of muntis) riggedKill(mission, m.instanceId);
    expect(mission.muntiCollapseTurn).toBe(1);

    mission.turn = 7;
    const victim = mission.units.find(
      (u) => u.side === "player" && !u.downed && u.pilotId && u.pilotId !== "pilot_rourke",
    );
    if (victim) riggedKill(mission, victim.instanceId);
    expect(mission.muntiCollapseTurn).toBe(1);
  });
});

describe("applyMissionLosses — the stamp, at the one moment it can be made", () => {
  // Lifted out of scenes/Debrief.ts specifically so this could be tested.
  // A Phaser scene is the one place in this repo nothing reaches, and
  // "written once, at the only moment anyone can still see it" is exactly
  // the kind of rule that has to be pinned or it rots.
  it("flips status, discards banked points, and records how it happened", () => {
    const state = createWardenCampaignState();
    const pilotId = Object.keys(state.pilots)[0];
    state.pilots[pilotId].personalPoints = 400;

    const flipped = applyMissionLosses(
      state,
      [{ pilotId, turn: 6, turnsWithoutMunti: 2, muntisDeployed: 1, wasLastMunti: false }],
      "amaranth_1",
      "loss",
    );

    expect(flipped).toEqual([pilotId]);
    const entry = state.pilots[pilotId];
    expect(entry.status).toBe("permanently_lost");
    expect(entry.personalPoints).toBe(0);
    expect(entry.lostContext).toEqual({
      missionId: "amaranth_1",
      outcome: "loss",
      turn: 6,
      turnsWithoutMunti: 2,
      muntisDeployed: 1,
      wasLastMunti: false,
      // Added 3 Sep 2026 for the Rec Room standings board, which keeps a
      // dead pilot's row and wants to say when they were lost beside it.
      // A fresh campaign is on day 1.
      lostOnDay: 1,
    });
  });

  it("carries the mission outcome, which is the one fact Mission itself cannot know at the moment of the downing", () => {
    // Permadeath resolves as the mission ends (ejection capsules, 15 Sep
    // 2026), but the record itself still doesn't carry the outcome. A company CAN lose someone
    // and still win, and a house reads those two very differently.
    const state = createWardenCampaignState();
    const pilotId = Object.keys(state.pilots)[0];
    applyMissionLosses(
      state,
      [{ pilotId, turn: 3, turnsWithoutMunti: 0, muntisDeployed: 2, wasLastMunti: false }],
      "amaranth_1",
      "win",
    );
    expect(state.pilots[pilotId].lostContext!.outcome).toBe("win");
    expect(houseGrievance(state.pilots[pilotId].lostContext!).verdict).toBe("honoured");
  });

  it("skips a record naming a pilot this campaign has never heard of, rather than inventing an entry", () => {
    const state = createWardenCampaignState();
    const before = Object.keys(state.pilots).length;
    const flipped = applyMissionLosses(
      state,
      [{ pilotId: "pilot_nobody", turn: 1, turnsWithoutMunti: 0, muntisDeployed: 1, wasLastMunti: false }],
      "amaranth_1",
      "loss",
    );
    expect(flipped).toEqual([]);
    expect(Object.keys(state.pilots)).toHaveLength(before);
  });

  it("takes a Mission's own permanentLosses array unchanged — the two shapes have to stay compatible", () => {
    // A structural guard, not a behaviour one: if PermanentLossRecord and
    // PilotLossContext ever drift apart, this is where it shows up as a
    // failure rather than as a silently unstamped loss in live play.
    const mission = new Mission(AMARANTH_MISSION_1);
    const muntis = mission.units.filter((u) => u.side === "player" && u.path === "munti");
    for (const m of muntis) riggedKill(mission, m.instanceId);
    winNow(mission);
    expect(mission.permanentLosses.length).toBeGreaterThan(0);

    const state = createWardenCampaignState();
    const flipped = applyMissionLosses(state, mission.permanentLosses, AMARANTH_MISSION_1.id, "loss");
    for (const id of flipped) expect(state.pilots[id].lostContext).toBeDefined();
  });
});

// ---- The teeth: what one house's verdict costs with the others ----------

/** An Act II campaign with money, one Heirloom recruited, and its aristocrat lost under `ctx`. */
function stateWithLostAristocrat(ctx: PilotLossContext, points = 10_000): CampaignState {
  const state = createWardenCampaignState();
  state.points = points;
  state.rourkeRank = "capt";
  const result = recruitHeirloom(state, "widows_ledger");
  expect(result.ok).toBe(true);
  const entry = state.pilots[aristocratPilotId("widows_ledger")];
  entry.status = "permanently_lost";
  entry.lostContext = ctx;
  return state;
}

describe("aristocracyStanding — the houses compare notes", () => {
  it("reads a verdict off the lost aristocrat's own stamped context", () => {
    const state = stateWithLostAristocrat(cleanLoss({ muntisDeployed: 1, outcome: "loss", turnsWithoutMunti: 4 }));
    expect(returnedHeirlooms(state)).toContain("widows_ledger");
    const verdicts = heirloomHouseVerdicts(state);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].heirloomId).toBe("widows_ledger");
    expect(verdicts[0].house).toBe(HEIRLOOMS.widows_ledger.pilot!.house);
    expect(verdicts[0].verdict).toBe("estranged");
    expect(heirloomHouseVerdict(state, "widows_ledger")).toBe("estranged");
  });

  it("a holder who left WITHOUT dying produces no verdict at all — a transfer is not a grievance", () => {
    // Also covers a save made before lostContext existed: missing data
    // should quietly grant the benefit of the doubt, never invent anger.
    const state = createWardenCampaignState();
    state.points = 10_000;
    state.rourkeRank = "capt";
    recruitHeirloom(state, "widows_ledger");
    state.pilots[aristocratPilotId("widows_ledger")].status = "reassigned";

    expect(returnedHeirlooms(state)).toContain("widows_ledger");
    expect(heirloomHouseVerdicts(state)).toEqual([]);
    expect(aristocracyStanding(state).costSteps).toBe(0);
  });

  it("an honoured verdict costs the company nothing with the other houses", () => {
    const state = stateWithLostAristocrat(cleanLoss());
    const standing = aristocracyStanding(state);
    expect(standing.costSteps).toBe(0);
    expect(standing.shortlistPenalty).toBe(0);
    expect(standing.anyEstranged).toBe(false);
  });

  it("an aggrieved house pushes the NEXT recruitment a rung up the ladder", () => {
    // Aimed sideways on purpose: the house whose child died has already
    // taken back the only thing it had to take. Houses are 1:1 with
    // Heirlooms here, so a grievance can only travel to the others.
    const state = stateWithLostAristocrat(cleanLoss({ muntisDeployed: 1 }));
    expect(aristocracyStanding(state).verdicts[0].verdict).toBe("aggrieved");

    const before = state.points;
    const result = recruitHeirloom(state, "iron_oath");
    expect(result.ok).toBe(true);
    // One pick already made would normally price this at COSTS[1]; the
    // grievance moves it to COSTS[2].
    expect(result.cost).toBe(HEIRLOOM_RECRUIT_COSTS[2]);
    expect(state.points).toBe(before - HEIRLOOM_RECRUIT_COSTS[2]);
  });

  it("an estranged house ends Heirloom recruiting for the run, by name rather than by a missing price", () => {
    // The designed end state of the full-teeth rule, and a real cost: lose
    // one badly early in Act II and the rest of the Heirloom content goes
    // unseen that run. Worth pinning the SENTENCE, not just the refusal —
    // the pre-existing "no price is set for that pick" would have been a
    // developer's error message shown to a player.
    const state = stateWithLostAristocrat(cleanLoss({ muntisDeployed: 1, outcome: "loss", turnsWithoutMunti: 4 }));
    const result = recruitHeirloom(state, "iron_oath");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no house will put a name forward/i);
    // A refusal is free: nothing spent, nothing recruited.
    expect(state.points).toBe(10_000 - HEIRLOOM_RECRUIT_COSTS[0]);
    expect(returnedHeirlooms(state)).toEqual(["widows_ledger"]);
  });

  it("an estranged house withdraws a name from the shortlist, and the floor holds", () => {
    const clean = createWardenCampaignState();
    clean.rourkeRank = "capt";
    expect(rollHeirloomShortlist(clean, () => 0.5)).toHaveLength(HEIRLOOM_SHORTLIST_SIZE);

    const angry = stateWithLostAristocrat(cleanLoss({ muntisDeployed: 1, outcome: "loss", turnsWithoutMunti: 4 }));
    expect(rollHeirloomShortlist(angry, () => 0.5)).toHaveLength(HEIRLOOM_SHORTLIST_SIZE - 1);
    // A shortlist of nothing is a lockout wearing a shortlist's clothes —
    // and the lockout already has its own, clearer sentence above.
    expect(rollHeirloomShortlist(angry, () => 0.5, 1).length).toBe(HEIRLOOM_SHORTLIST_MIN);
  });

  it("standing is derived every call — nothing about a house's opinion is written into the save", () => {
    const state = stateWithLostAristocrat(cleanLoss({ muntisDeployed: 1 }));
    expect(aristocracyStanding(state).costSteps).toBe(1);
    // Undo the death and the grievance is simply gone, because there was
    // never a stored copy of it to go stale.
    state.pilots[aristocratPilotId("widows_ledger")].status = "active";
    expect(aristocracyStanding(state).costSteps).toBe(0);
    expect(JSON.stringify(state)).not.toContain("estranged");
    expect(JSON.stringify(state)).not.toContain("aggrieved");
  });
});

describe("heirloomRecalled — the beat the player actually sees", () => {
  const CATALYSTS = Object.keys(LINE_BANK) as Catalyst[];

  it("renders with no placeholder left behind, for every catalyst and every verdict", () => {
    for (const catalyst of CATALYSTS) {
      for (const verdict of ["honoured", "aggrieved", "estranged"] as const) {
        for (let i = 0; i < 12; i++) {
          const line = renderHotTopicLine(
            {
              kind: "heirloomRecalled",
              aboutPilotId: "pilot_heirloom_widows_ledger",
              aboutName: "Corin Ashby-Voss",
              houseName: "House Voss",
              heirloomName: "Skuld",
              verdictClause: HOUSE_VERDICT_CLAUSES[verdict],
              at: Date.now(),
              mentionedBy: [],
            },
            catalyst,
          );
          expect(line).not.toContain("{");
          // Every line has to identify WHAT was taken or WHOSE it was —
          // not necessarily the weapon by name (one line deliberately says
          // "their weapon back" instead, and reads better for it), but a
          // line that named none of the three would be gossip about
          // nothing.
          expect(line.includes("Skuld") || line.includes("House Voss") || line.includes("Corin Ashby-Voss")).toBe(true);
          // The house's temperature always lands, whichever line was drawn.
          expect(line).toContain(HOUSE_VERDICT_CLAUSES[verdict]);
        }
      }
    }
  });

  it("the three verdict clauses are distinct — the house's temperature is the point", () => {
    const clauses = Object.values(HOUSE_VERDICT_CLAUSES);
    expect(new Set(clauses).size).toBe(clauses.length);
  });
});
