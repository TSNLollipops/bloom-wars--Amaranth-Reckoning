// src/engine/statsStore.ts
// Local-first player statistics (claude/Bloom_Wars_Player_Telemetry_Plan_v1.md
// §4, 1 Sep 2026). An append-only list of MissionSummary records in the
// player's own browser/Electron storage, keyed to the INSTALL (a random id
// minted once here), not to any one save — statistics are about the
// player, so they survive New Game, Load, and Ironman exactly the way the
// tutorial-seen flag already does. Nothing here ever leaves the machine;
// the opt-in upload half of the plan is a separate, later decision and a
// separate module if it ever lands.
//
// Storage discipline copied from campaignState.ts: the `bloomwars_*_v1`
// key convention, the injectable CampaignStorage backend (so tests run
// under Node with a fake store and the headless sim gets a silent no-op),
// and "never throws" — a corrupt blob reads as empty, a failed write is
// swallowed. Statistics are best-effort; a stats bug must never take a
// real mission down with it. No Phaser (Build Brief §2.2).
import { resolveStorage, mintRandomId, type CampaignStorage } from "./campaignState";
import type { MissionSummary } from "./missionSummary";

export const STATS_STORAGE_KEY = "bloomwars_stats_v1";
/** Cap on stored records — a full campaign with retries is well under 100; when hit, the oldest non-win goes first. */
export const STATS_MAX_RECORDS = 500;

interface StatsBlob {
  v: 1;
  installId: string;
  records: MissionSummary[];
}

function readBlob(storage?: CampaignStorage): StatsBlob | null {
  const s = resolveStorage(storage);
  if (!s) return null;
  const raw = s.getItem(STATS_STORAGE_KEY);
  if (!raw) return { v: 1, installId: mintRandomId(), records: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<StatsBlob>;
    if (!parsed || !Array.isArray(parsed.records)) return { v: 1, installId: mintRandomId(), records: [] };
    return { v: 1, installId: typeof parsed.installId === "string" && parsed.installId ? parsed.installId : mintRandomId(), records: parsed.records };
  } catch {
    return { v: 1, installId: mintRandomId(), records: [] };
  }
}

function writeBlob(blob: StatsBlob, storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(STATS_STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Quota or a locked-down browser — statistics are best-effort.
  }
}

/** The per-install random id. Minted (and persisted) on first call; null with no storage at all. */
export function getInstallId(storage?: CampaignStorage): string | null {
  const blob = readBlob(storage);
  if (!blob) return null;
  const s = resolveStorage(storage);
  if (s && !s.getItem(STATS_STORAGE_KEY)) writeBlob(blob, storage);
  return blob.installId;
}

/** Append one finished-mission record. No-op without storage. */
export function appendMissionSummary(summary: MissionSummary, storage?: CampaignStorage): void {
  const blob = readBlob(storage);
  if (!blob) return;
  blob.records.push(summary);
  while (blob.records.length > STATS_MAX_RECORDS) {
    const idx = blob.records.findIndex((r) => r.outcome !== "win");
    blob.records.splice(idx === -1 ? 0 : idx, 1);
  }
  writeBlob(blob, storage);
}

/** Every stored record, oldest first. Empty without storage. */
export function listMissionSummaries(storage?: CampaignStorage): MissionSummary[] {
  return readBlob(storage)?.records ?? [];
}

/** How many times this mission has already been recorded for this campaign — the next attempt is this + 1. */
export function countAttempts(campaignId: string | undefined, missionId: string, storage?: CampaignStorage): number {
  if (!campaignId) return 0;
  return listMissionSummaries(storage).filter((r) => r.campaignId === campaignId && r.missionId === missionId).length;
}

/** "Delete my statistics" — the Options button. Keeps nothing, not even the install id. */
export function clearStats(storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.removeItem(STATS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** The export blob a tester pastes into a bug report — pretty JSON, everything in the store. */
export function exportStatsJson(storage?: CampaignStorage): string {
  const blob = readBlob(storage) ?? { v: 1, installId: "none", records: [] };
  return JSON.stringify(blob, null, 2);
}

// ---- Derived views (service records, memorial) ----------------------------

export interface PilotServiceRecord {
  pilotId: string;
  displayName: string;
  missionsFlown: number;
  wins: number;
  kills: number;
  assists: number;
  damageDealt: number;
  damageTaken: number;
  timesDowned: number;
  favoriteAbility?: string;
  permanentlyLost?: { missionId: string; missionName: string; turn: number; finishedAt: string };
}

/** Per-pilot career totals across every record for one campaign (or every campaign when campaignId is undefined). */
export function pilotServiceRecords(campaignId: string | undefined, storage?: CampaignStorage): Record<string, PilotServiceRecord> {
  const out: Record<string, PilotServiceRecord> = {};
  const abilityTallies: Record<string, Record<string, number>> = {};
  for (const r of listMissionSummaries(storage)) {
    if (campaignId && r.campaignId !== campaignId) continue;
    for (const p of r.squad) {
      const rec = (out[p.pilotId] ??= {
        pilotId: p.pilotId,
        displayName: p.displayName,
        missionsFlown: 0,
        wins: 0,
        kills: 0,
        assists: 0,
        damageDealt: 0,
        damageTaken: 0,
        timesDowned: 0,
      });
      rec.missionsFlown += 1;
      if (r.outcome === "win") rec.wins += 1;
      rec.kills += p.kills;
      rec.assists += p.assists;
      rec.damageDealt += p.damageDealt;
      rec.damageTaken += p.damageTaken;
      if (p.downed) rec.timesDowned += 1;
      const tally = (abilityTallies[p.pilotId] ??= {});
      for (const [id, n] of Object.entries(p.abilitiesUsed)) tally[id] = (tally[id] ?? 0) + n;
      if (p.permanentlyLost && !rec.permanentlyLost) rec.permanentlyLost = { missionId: r.missionId, missionName: r.missionName, turn: r.turns, finishedAt: r.finishedAt };
    }
  }
  for (const [pilotId, tally] of Object.entries(abilityTallies)) {
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (top && out[pilotId]) out[pilotId].favoriteAbility = top[0];
  }
  return out;
}

/** The memorial: every permanently lost pilot for a campaign, in the order they fell. */
export function memorial(campaignId: string | undefined, storage?: CampaignStorage): PilotServiceRecord[] {
  return Object.values(pilotServiceRecords(campaignId, storage))
    .filter((r) => r.permanentlyLost)
    .sort((a, b) => (a.permanentlyLost!.finishedAt < b.permanentlyLost!.finishedAt ? -1 : 1));
}
