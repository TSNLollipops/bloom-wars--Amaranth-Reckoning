// src/sim/progressionRoster.ts
// Reference progression roster for the batch harness (mission rework pass,
// 8 Sep 2026). HARNESS-ONLY — nothing in the game imports this.
//
// WHY THIS EXISTS. Every headless sim run before this pass deployed
// `mission.playerPilotIds` straight through the static pilot registry, and
// every authored pilot record is tier G with no weapon branch. That is the
// right squad for Mission 1 and the wrong squad for Mission 30: the
// project's own economy model (runFrameSystemsEconomySim.ts, 6 Sep 2026)
// puts a Lance-A "focus" pilot at tier C by mission ~8 and at A by the
// mid-20s. A mission tuned so a G-tier bot barely wins is a cakewalk for
// the A-tier squad a real player actually brings to it — which is the
// "still missions are too easy" Maxime keeps reporting from his own play.
//
// So the harness gets a second deploy path: `--progression` builds a
// DeployRosterEntry[] whose tiers follow the schedule below (a deliberate,
// slightly conservative reading of the economy sim — it assumes the player
// also spends on branches/secondaries, not only on tier), and equips the
// first weapon branch of each path once the pilot clears its D-tier gate,
// the first two once they clear B (two mounts open at C; B leaves a
// mission or two of saving for the second branch's 220 points).
//
// The schedule is THE assumption every rework number in this pass rests
// on. It is one table; edit it here and re-run. Nothing else in the sim
// knows about it. Frame systems, mek secondaries bought mid-campaign, and
// Heirloom ranks are deliberately NOT modelled — all three are placeholder
// economies as of 6 Sep, and layering guesses on guesses would make every
// number here less honest, not more.
import type { CampaignMission, PilotRecord, Tier } from "../data/types";
import { findPilot, findMek } from "../data/pilotRegistry";
import { WEAPON_BRANCHES_BY_PATH } from "../data/weaponBranches";
import type { DeployRosterEntry } from "../engine/mission";

/** Which starting group a pilot belongs to — decides which tier curve they ride. */
export type ProgressionBand = "lance_a" | "lance_2" | "lance_3";

const TIER_LADDER: Tier[] = ["G", "F", "E", "D", "C", "B", "A"];

/**
 * Mission index (1-36, within its campaign) → tier index into TIER_LADDER,
 * per band. Lance A rides the economy sim's "focus" curve; the later lances
 * arrive at G on the mission that unlocks them (13 / 25 in both campaigns)
 * and climb the same shape, a little slower because they split the deploy
 * slots with veterans who out-earn them.
 */
function tierIndexFor(band: ProgressionBand, missionIndex: number): number {
  const m = missionIndex;
  switch (band) {
    case "lance_a":
      if (m <= 2) return 0; // G
      if (m <= 4) return 1; // F
      if (m <= 6) return 2; // E
      if (m <= 9) return 3; // D
      if (m <= 13) return 4; // C
      if (m <= 19) return 5; // B
      return 6; // A
    case "lance_2": {
      const k = m - 12; // 1 on the mission they arrive
      if (k <= 2) return 0;
      if (k <= 4) return 1;
      if (k <= 7) return 2;
      if (k <= 10) return 3;
      if (k <= 15) return 4;
      if (k <= 21) return 5;
      return 6;
    }
    case "lance_3": {
      const k = m - 24;
      if (k <= 2) return 0;
      if (k <= 4) return 1;
      if (k <= 7) return 2;
      if (k <= 10) return 3;
      return 4;
    }
  }
}

/** Both campaigns: the five authored starters are Lance A; ids 6-10 the second lance; 11-15 the third. */
function bandForPilot(pilotId: string, mission: CampaignMission): ProgressionBand {
  const idx = mission.playerPilotIds.indexOf(pilotId);
  // Missions that deploy a reduced explicit squad (Warden 21, 26) still
  // list Lance A first, so positional banding holds for every mission in
  // both campaigns — verified against the two campaign files' own
  // playerPilotIds arrays rather than assumed.
  if (idx < 5) return "lance_a";
  if (idx < 10) return "lance_2";
  return "lance_3";
}

/** Parse "mission_amaranth_17" / "mission_house_amaranth_3" → 17 / 3. */
export function missionIndexOf(missionId: string): number {
  const n = Number(missionId.split("_").pop());
  return Number.isFinite(n) ? n : 1;
}

export function progressionTierFor(pilotId: string, mission: CampaignMission): Tier {
  return TIER_LADDER[tierIndexFor(bandForPilot(pilotId, mission), missionIndexOf(mission.id))];
}

/**
 * Build the deploy roster the harness hands to `new Mission(...)`. Pure —
 * clones every PilotRecord it touches; the static registry is never
 * mutated (the same rule createPlayerUnit's own overrides doc insists on).
 */
export function buildProgressionRoster(mission: CampaignMission): DeployRosterEntry[] {
  return mission.playerPilotIds.map((pilotId) => {
    const base = findPilot(pilotId);
    if (!base) throw new Error(`progressionRoster: unknown pilot id ${pilotId}`);
    const tier = progressionTierFor(pilotId, mission);
    const tierIdx = TIER_LADDER.indexOf(tier);
    const branches = WEAPON_BRANCHES_BY_PATH[findPathOf(base)] ?? [];
    let equipped: string[] = [];
    if (tierIdx >= 5 && branches.length >= 2) equipped = [branches[0], branches[1]]; // B+: two mounts, two branches
    else if (tierIdx >= 3 && branches.length >= 1) equipped = [branches[0]]; // D+: first branch
    const pilot: PilotRecord = {
      ...base,
      tier,
      ownedWeaponBranches: equipped.length ? [...equipped] : base.ownedWeaponBranches,
      equippedWeaponBranch: equipped[0] ?? base.equippedWeaponBranch,
      equippedWeaponBranches: equipped.length ? [...equipped] : base.equippedWeaponBranches,
    };
    return { pilotId, pilot, mek: findMek(base.mekId) };
  });
}

function findPathOf(pilot: PilotRecord): "meeps" | "tank" | "reeps" | "munti" {
  // archetypeIds are "arch_<path>_<chassis>" — e.g. arch_meeps_bipedal.
  const head = pilot.archetypeId.replace(/^arch_/, "").split("_")[0];
  if (head === "meeps" || head === "tank" || head === "reeps" || head === "munti") return head;
  return "meeps";
}

/** One-line description for batch headers, so a printed number always says what squad produced it. */
export function describeProgression(mission: CampaignMission): string {
  const roster = buildProgressionRoster(mission);
  const counts: Record<string, number> = {};
  for (const e of roster) counts[e.pilot.tier] = (counts[e.pilot.tier] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => TIER_LADDER.indexOf(a[0] as Tier) - TIER_LADDER.indexOf(b[0] as Tier))
    .map(([t, n]) => `${n}×${t}`)
    .join(" ");
}
