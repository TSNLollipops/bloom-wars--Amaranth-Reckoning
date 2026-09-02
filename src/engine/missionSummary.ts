// src/engine/missionSummary.ts
// One record per finished mission — the telemetry plan's §3 schema
// (claude/Bloom_Wars_Player_Telemetry_Plan_v1.md, 1 Sep 2026). The single
// most important property: a bot run (src/sim) and a human run
// (scenes/Debrief.ts, scenes/Battle.ts's COMMAND DOWN path) both produce
// exactly this shape from exactly this function, so "which bot do real
// players resemble" is a one-line comparison later instead of two
// incompatible datasets. Pure: reads a finished Mission, returns a plain
// object, touches nothing. No Phaser (Build Brief §2.2).
import type { Mission } from "./mission";

export type SummarySource = "human" | "bot";
export type SummaryOutcome = "win" | "loss" | "commander_down" | "recalled";

export interface MissionSummaryPilot {
  pilotId: string;
  displayName: string;
  path: string;
  tier?: string;
  weaponBranch?: string;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  assists: number; // fractional kill-equivalents, rounded to 2 places
  downed: boolean;
  permanentlyLost: boolean;
  abilitiesUsed: Record<string, number>;
}

export interface MissionSummary {
  v: 1; // schema version — bump when fields change
  gameVersion: string;
  installId?: string; // random, per browser/install — see statsStore.ts
  campaignId?: string; // random, per playthrough — CampaignState.campaignId
  source: SummarySource;
  botTier?: "easy" | "moderate" | "hard";
  seed?: number;
  tag?: string; // free label, e.g. "dev" for Maxime's own play — never shown, only filtered on
  missionId: string;
  missionName: string;
  attemptNumber: number; // 1 on first try of this mission in this campaign, 2 on retry…
  outcome: SummaryOutcome;
  turns: number;
  turnLimit?: number;
  realSeconds?: number; // human only
  ironman?: boolean;
  squad: MissionSummaryPilot[];
  hostilesKilledByArchetype: Record<string, number>;
  fireSupportUsed: number;
  bonusObjective?: { kind: string; outcome: string };
  pointsBefore?: number;
  pointsAfter?: number;
  rosterSizeBefore?: number;
  rosterSizeAfter?: number;
  finishedAt: string; // ISO timestamp
}

/** Everything about a run the Mission object itself can't know. All optional but `source`. */
export interface SummaryMeta {
  source: SummarySource;
  gameVersion?: string;
  installId?: string;
  campaignId?: string;
  botTier?: MissionSummary["botTier"];
  seed?: number;
  tag?: string;
  attemptNumber?: number;
  /** Override the outcome read off the Mission — e.g. "recalled" for a 12h-clock recall, which never resolves the Mission itself. */
  outcome?: SummaryOutcome;
  realSeconds?: number;
  ironman?: boolean;
  pointsBefore?: number;
  pointsAfter?: number;
  rosterSizeBefore?: number;
  rosterSizeAfter?: number;
  /** Injected clock, for tests. */
  now?: () => Date;
}

/**
 * Build the record. `mission.outcome === "ongoing"` is accepted (a recall
 * summary is written for a mission that never finished) and reported as
 * whatever `meta.outcome` says, defaulting to "loss" — a mission that was
 * abandoned is not a win.
 */
export function summarizeMission(mission: Mission, meta: SummaryMeta): MissionSummary {
  const now = meta.now ? meta.now() : new Date();
  const lost = new Set(mission.permanentLosses.map((l) => l.pilotId));
  const squad: MissionSummaryPilot[] = [];
  for (const pilotId of mission.deployedPilotIds) {
    const unit = mission.units.find((u) => u.pilotId === pilotId);
    const perf = mission.unitPerformance[pilotId];
    squad.push({
      pilotId,
      displayName: unit?.displayName ?? pilotId,
      path: unit?.path ?? "unknown",
      tier: unit?.tier,
      weaponBranch: unit?.weaponBranchId,
      damageDealt: perf?.damageDealt ?? 0,
      damageTaken: perf?.damageTaken ?? 0,
      kills: perf?.kills ?? 0,
      assists: Math.round((perf?.assistCredit ?? 0) * 100) / 100,
      downed: perf?.wasDowned ?? false,
      permanentlyLost: lost.has(pilotId),
      abilitiesUsed: { ...(perf?.abilitiesUsed ?? {}) },
    });
  }
  const outcome: SummaryOutcome = meta.outcome ?? (mission.outcome === "ongoing" ? "loss" : mission.outcome);
  const fireSupportUsed = squad.reduce((n, p) => n + (p.abilitiesUsed["abil_fire_support"] ?? 0), 0);
  const bonus = mission.mission.bonusObjective;
  const bonusOutcome = bonus ? (bonus.kind === "rescue_pilot" ? mission.rescueOutcome : mission.clearBloomPatchOutcome) : undefined;
  return {
    v: 1,
    gameVersion: meta.gameVersion ?? "dev",
    installId: meta.installId,
    campaignId: meta.campaignId,
    source: meta.source,
    botTier: meta.botTier,
    seed: meta.seed,
    tag: meta.tag,
    missionId: mission.mission.id,
    missionName: mission.mission.displayName,
    attemptNumber: meta.attemptNumber ?? 1,
    outcome,
    turns: mission.turn,
    turnLimit: mission.mission.objectiveParams.turnLimit,
    realSeconds: meta.realSeconds,
    ironman: meta.ironman,
    squad,
    hostilesKilledByArchetype: { ...mission.hostileKills },
    fireSupportUsed,
    bonusObjective: bonus && bonusOutcome ? { kind: bonus.kind, outcome: bonusOutcome } : undefined,
    pointsBefore: meta.pointsBefore,
    pointsAfter: meta.pointsAfter,
    rosterSizeBefore: meta.rosterSizeBefore,
    rosterSizeAfter: meta.rosterSizeAfter,
    finishedAt: now.toISOString(),
  };
}

/** Convenience for the Debrief stat block and service records: who did the most damage, ties broken by kills. */
export function summaryMvp(summary: MissionSummary): MissionSummaryPilot | undefined {
  return [...summary.squad].sort((a, b) => b.damageDealt - a.damageDealt || b.kills - a.kills)[0];
}
