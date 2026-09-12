// One-off, sandbox-only (12 Sep 2026, Emotional Brain): a Warden save that
// has been through the real Debrief write-back twice, so the Archive's
// "Carries" block, the Highlights reel's memory milestones and the drift
// have something real to show. Built through engine/debriefCatalyst.ts and
// engine/griefCatalyst.ts themselves, not hand-written memories, so what the
// screenshot shows is what the game would write.
import { createWardenCampaignState, applyMissionLosses, ensureNpcSocialState } from "../../src/engine/campaignState";
import { runGriefCatalyst } from "../../src/engine/griefCatalyst";
import { runDebriefCatalyst } from "../../src/engine/debriefCatalyst";
import { NPC_BOND_SEED } from "../../src/data/npcSeed";
import { mulberry32 } from "../../src/sim/rng";
import type { WorryEntry } from "../../src/data/worries";
import { writeFileSync } from "fs";

const w = (source: WorryEntry["source"], intensity: number): WorryEntry => ({ source, catalyst: "wolf", intensity, context: "battle", bornAt: 0, expiresAt: 1e15 });
const SQUAD = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];

const state = createWardenCampaignState(0);
ensureNpcSocialState(state, NPC_BOND_SEED);
const rng = mulberry32(12);

// Mission 2: a win, Anand downed and restocked, Bosk got the kill, Lask patched him.
state.calendarDay = 6;
runDebriefCatalyst(
  state,
  {
    missionId: "mission_amaranth_2",
    outcome: "win",
    deployedPilotIds: SQUAD,
    combatWorries: {
      pilot_anand: [w("combat_downed", 0.8), w("combat_permadeath_recoverable", 0.55)],
      pilot_bosk: [w("combat_kill", 0.4), w("combat_overwatch", 0.45)],
      pilot_lask: [w("combat_repair", 0.6)],
    },
    permanentlyLostPilotIds: [],
  },
  { rng, now: 1_757_700_000_000, today: 6 },
);

// Mission 5: a loss, Bosk permanently lost (no Munti standing), Iyari downed.
state.calendarDay = 17;
applyMissionLosses(state, [{ pilotId: "pilot_bosk", turn: 9, turnsWithoutMunti: 2, muntisDeployed: 1, wasLastMunti: false }], "mission_amaranth_5", "loss");
const grief = [runGriefCatalyst(state, SQUAD, "pilot_bosk", rng)];
runDebriefCatalyst(
  state,
  {
    missionId: "mission_amaranth_5",
    outcome: "loss",
    deployedPilotIds: SQUAD,
    combatWorries: { pilot_iyari: [w("combat_downed", 0.8)], pilot_anand: [w("combat_kill", 0.4)] },
    permanentlyLostPilotIds: ["pilot_bosk"],
    griefResults: grief,
  },
  { rng, now: 1_757_800_000_000, today: 17 },
);
state.calendarDay = 24;
state.lastMissionEcho = { missionId: "mission_amaranth_5", outcome: "loss", announced: true };

writeFileSync(new URL("./brainSave.json", import.meta.url), JSON.stringify(state));
for (const id of ["pilot_anand", "pilot_iyari", "pilot_lask"]) {
  const s = state.pilots[id].social!;
  console.log(id, "stress", s.stress, "morale", s.morale, "memories", s.memories?.map((m) => `${m.kind}${m.about.length ? `(${m.about.join(",")})` : ""}`).join(", "), "drift", JSON.stringify(s.echoDrift));
}
