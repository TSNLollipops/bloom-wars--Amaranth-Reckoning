// src/engine/telemetry.ts
// The one call site that turns a finished human mission into a stored
// MissionSummary (claude/Bloom_Wars_Player_Telemetry_Plan_v1.md §2, 1 Sep
// 2026). Both places a human's mission ends — scenes/Debrief.ts (win/loss)
// and scenes/Battle.ts's COMMAND DOWN overlay (which never reaches
// Debrief) — call this and nothing else, so the two can't drift on what a
// record contains. The bot harness (src/sim) builds its own records
// through summarizeMission() directly, with source: "bot".
//
// Best-effort by construction: every step is wrapped, so a stats failure
// can never take a real Debrief down with it. No Phaser (Build Brief §2.2).
import type { Mission } from "./mission";
import type { CampaignState } from "./campaignState";
import { summarizeMission, type MissionSummary, type SummaryOutcome } from "./missionSummary";
import { appendMissionSummary, countAttempts, getInstallId } from "./statsStore";

/** vite.config.ts bakes __APP_VERSION__ into the browser bundle; under tsx/vitest without it, "dev". `typeof` on an undeclared global is safe. */
export function currentGameVersion(): string {
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
}

export interface HumanRunExtras {
  outcome?: SummaryOutcome;
  /** Date.now() when BEAM DOWN fired — CampaignState.activeMissionAttempt.startedAt, captured before Debrief clears it. */
  startedAt?: number;
  pointsBefore?: number;
  pointsAfter?: number;
  rosterSizeBefore?: number;
  rosterSizeAfter?: number;
  tag?: string;
}

/** Build + store the record for a human-played mission. Returns it (for the Debrief stat block) or null if anything went wrong. */
export function recordHumanMissionSummary(mission: Mission, state: CampaignState | null, extras: HumanRunExtras = {}): MissionSummary | null {
  try {
    const campaignId = state?.campaignId;
    const summary = summarizeMission(mission, {
      source: "human",
      gameVersion: currentGameVersion(),
      installId: getInstallId() ?? undefined,
      campaignId,
      attemptNumber: countAttempts(campaignId, mission.mission.id) + 1,
      outcome: extras.outcome,
      realSeconds: extras.startedAt ? Math.max(0, Math.round((Date.now() - extras.startedAt) / 1000)) : undefined,
      ironman: state?.ironman,
      pointsBefore: extras.pointsBefore,
      pointsAfter: extras.pointsAfter,
      rosterSizeBefore: extras.rosterSizeBefore,
      rosterSizeAfter: extras.rosterSizeAfter,
      tag: extras.tag,
    });
    appendMissionSummary(summary);
    return summary;
  } catch {
    return null;
  }
}

/** Active-roster headcount — the "roster size" the summary records before and after a mission's losses and recruits. */
export function activeRosterSize(state: CampaignState | null): number {
  if (!state) return 0;
  return Object.values(state.pilots).filter((e) => e.status === "active").length;
}
