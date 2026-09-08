// ---------------------------------------------------------------------
// THE ARCHIVE — the live half of a Personnel dossier.
//
// data/archive.ts holds the written entries. This file holds the part that
// cannot be written: the block that opens every personnel dossier, read
// straight off the save. Rank, lance, frame, Mek, stress, morale, standing,
// who they are with, what their service record says, whether they are still
// here. Nothing below is authored per pilot, which is why a shop recruit who
// has no bio at all still gets a real dossier the moment they join.
//
// Lives in engine/ rather than data/ because it needs CampaignState. The
// band words and the archive's own register (the player is "the Commander"
// or "the Colonel", never "you") come from data/archive.ts, so the archive
// can never disagree with the Hub about a number it is describing.
//
// Wired 7 Sep 2026 from the approved sandbox (Archive Sandbox v1.14, 3a).
// ---------------------------------------------------------------------

import {
  type ArchiveEntry,
  type ArchiveFacility,
  archiveEntryById,
  moraleBand,
  playerTitle,
  relationshipWord,
  stressBand,
} from "../data/archive";
import { stageFromTier } from "../data/ambientLines";
import { CLIQUE_THRESHOLD, RIVAL_THRESHOLD, pairKey } from "../data/npcBonds";
import { UNIT_ARCHETYPES } from "../data/units";
import {
  type CampaignPilotEntry,
  type CampaignState,
  type LanceId,
  activeLanceIds,
  baseSceneKeyFor,
  lanceDisplayName,
  lanceOfPilotIn,
  lanceRoster,
  rankDisplayTitle,
} from "./campaignState";
import { type PilotServiceRecord } from "./statsStore";

/** One row of the live block. `tone` is a rendering hint, not a rule. */
export interface ArchiveLiveLine {
  label: string;
  value: string;
  tone?: "warn" | "ok" | "muted";
}

export interface ArchiveDossier {
  pilotId: string;
  /** Display name with the live rank applied where the save carries one. */
  displayName: string;
  lines: ArchiveLiveLine[];
  status: string;
  /** The authored entry, when this pilot has one. Recruits do not. */
  entry?: ArchiveEntry;
  /** Stands in for a bio when there is none. One sentence, never a fake bio. */
  intake?: string;
}

/** A lance, or the struck group, as the Personnel list renders it. */
export interface ArchiveRosterGroup {
  id: LanceId | "struck";
  label: string;
  entries: CampaignPilotEntry[];
}

const CO_PILOT_ID = "co";

/**
 * Rourke is the one person on the roster whose rank actually moves, and the
 * shipped codex bakes "2nd Lt." into her displayName as a string. Left alone
 * that means a Major reads as a Second Lieutenant in her own file. Everyone
 * else's rank is part of the name they were written with and is correct.
 */
export function archiveDisplayName(state: CampaignState, entry: CampaignPilotEntry): string {
  const name = entry.pilot.displayName;
  if (entry.pilot.id !== "pilot_rourke") return name;
  return `${rankDisplayTitle(state.rourkeRank)} ${name.replace(/^2nd Lt\.\s*/, "")}`;
}

/** Every pilot's id on this save, for bond lookups. */
function allPilotIds(state: CampaignState): string[] {
  return Object.values(state.pilots).map((p) => p.pilot.id);
}

/**
 * Who this pilot is with, and who they cannot stand. Uses exactly the rules
 * Hub.ts's own npcPartnerLabel/npcRivalLabel already use, so the archive and
 * the Hub can never disagree about whether two people are together.
 */
export function relationsFor(state: CampaignState, entry: CampaignPilotEntry): ArchiveLiveLine[] {
  const out: ArchiveLiveLine[] = [];
  const social = entry.social;
  const fav = social?.favorability ?? 0;

  if (social?.inRelationship) {
    out.push({
      label: "Registered partner",
      value: `${playerTitle(facilityOf(state))} (${relationshipWord(fav)})`,
    });
  }

  const bonds = state.npcSocial?.bonds ?? {};
  const others = allPilotIds(state).filter((id) => id !== entry.pilot.id);
  const nameOf = (id: string) =>
    Object.values(state.pilots).find((p) => p.pilot.id === id)?.pilot.displayName ?? id;

  for (const key of state.npcSocial?.relationships ?? []) {
    const [a, b] = key.split("|");
    if (a !== entry.pilot.id && b !== entry.pilot.id) continue;
    const partner = a === entry.pilot.id ? b : a;
    out.push({
      label: "Registered partner",
      value: `${nameOf(partner)} (${relationshipWord(bonds[pairKey(entry.pilot.id, partner)] ?? 0)})`,
    });
  }

  let bestId: string | null = null;
  let bestVal = CLIQUE_THRESHOLD - 1;
  let worstId: string | null = null;
  let worstVal = RIVAL_THRESHOLD + 1;
  for (const id of others) {
    const v = bonds[pairKey(entry.pilot.id, id)] ?? 0;
    if (v >= CLIQUE_THRESHOLD && v > bestVal) { bestVal = v; bestId = id; }
    if (v <= RIVAL_THRESHOLD && v < worstVal) { worstVal = v; worstId = id; }
  }
  if (bestId) out.push({ label: "Closest aboard", value: nameOf(bestId), tone: "ok" });
  if (worstId) out.push({ label: "Friction with", value: nameOf(worstId), tone: "warn" });

  return out;
}

/**
 * Which console this save belongs to.
 *
 * Delegates to baseSceneKeyFor rather than inventing a second rule.
 * CampaignState.campaignId is a minted random id, NOT a campaign identifier
 * — reading it as one looks right and is wrong, which is what the first
 * version of this function did until its own test caught it. The real
 * discriminator is which cast is on the roster, and baseSceneKeyFor already
 * owns that question for the whole codebase.
 */
export function facilityOf(state: CampaignState): ArchiveFacility {
  return baseSceneKeyFor(state) === "HubHouseAmaranth" ? "amaranth" : "warden";
}

function recordLine(rec: PilotServiceRecord | undefined): ArchiveLiveLine {
  if (!rec || rec.missionsFlown === 0) {
    return { label: "Record", value: "No missions flown.", tone: "muted" };
  }
  const parts = [
    `${rec.missionsFlown} flown`,
    `${rec.wins} won`,
    `${rec.kills} killed`,
  ];
  if (rec.timesDowned > 0) parts.push(`${rec.timesDowned} down`);
  return { label: "Record", value: parts.join(" · ") };
}

/**
 * The status line. Departed pilots keep their record and lose their mood:
 * the archive is the file, not a second memorial (decided 7 Sep, Q7).
 */
export function archiveStatusText(
  entry: CampaignPilotEntry,
  fac: ArchiveFacility,
  record?: PilotServiceRecord,
): string {
  const company = fac === "warden" ? "Warden Company" : "House Amaranth";
  if (entry.pilot.id === CO_PILOT_ID) {
    return "Command staff, not a deployed roster slot — there is no mission outcome to report here.";
  }
  switch (entry.status) {
    case "permanently_lost": {
      // The mission's readable NAME lives on the service record, not on
      // lostContext (which stores the id) — so prefer the record and fall
      // back to the turn alone rather than showing the player "mission_9".
      const where = record?.permanentlyLost?.missionName;
      const turn = entry.lostContext?.turn ?? record?.permanentlyLost?.turn;
      if (where && turn !== undefined) return `Lost on ${where}, turn ${turn}. Struck from the roster.`;
      if (where) return `Lost on ${where}. Struck from the roster.`;
      return "Lost. Struck from the roster.";
    }
    case "reassigned":
      return `No longer serving with ${company} — reassigned off the ship.`;
    case "discharged":
      return `No longer serving with ${company} — discharged.`;
    default:
      return `Active, serving with ${company}.`;
  }
}

/**
 * Build one pilot's live block. `records` is pilotServiceRecords()'s output,
 * passed in rather than read here so this stays a pure function of its
 * arguments and the tests do not need storage.
 */
export function buildArchiveDossier(
  state: CampaignState,
  entry: CampaignPilotEntry,
  records: Record<string, PilotServiceRecord> = {},
): ArchiveDossier {
  const fac = facilityOf(state);
  const lines: ArchiveLiveLine[] = [];
  const active = entry.status === "active";

  if (entry.pilot.id === "pilot_rourke") {
    lines.push({ label: "Rank", value: rankDisplayTitle(state.rourkeRank) });
  }

  if (active) {
    const lance = lanceOfPilotIn(state, entry.pilot.id);
    lines.push({ label: "Lance", value: lanceDisplayName(lance) });
  }

  const arch = UNIT_ARCHETYPES[entry.pilot.archetypeId];
  if (arch) lines.push({ label: "Frame", value: arch.displayName });
  lines.push({
    label: "Tier",
    value: `${entry.pilot.tier} (${stageFromTier(entry.pilot.tier)})`,
  });

  const mek = state.meks[entry.pilot.mekId];
  if (mek) lines.push({ label: "Mek", value: `${mek.displayName} — ${mek.primary}` });

  const social = entry.social;
  if (active && social) {
    lines.push({
      label: "Stress",
      value: `${stressBand(social.stress)} ${social.stress}`,
      tone: social.stress >= 70 ? "warn" : undefined,
    });
    lines.push({
      label: "Morale",
      value: `${moraleBand(social.morale)} ${social.morale}`,
      tone: social.morale <= 25 ? "warn" : undefined,
    });
    lines.push({ label: "Standing", value: String(social.favorability) });
    if (social.refusesDeployment) {
      lines.push({ label: "Deployment", value: "Refusing.", tone: "warn" });
    }
    lines.push(...relationsFor(state, entry));
  }

  lines.push({ label: "Points", value: String(entry.personalPoints) });
  lines.push(recordLine(records[entry.pilot.id]));

  const written = archiveEntryById(`pilot_${entry.pilot.id.replace(/^pilot_/, "")}`)
    ?? archiveEntryById(entry.pilot.id);

  return {
    pilotId: entry.pilot.id,
    displayName: archiveDisplayName(state, entry),
    lines,
    status: archiveStatusText(entry, fac, records[entry.pilot.id]),
    entry: written,
    intake: written
      ? undefined
      : `Joined ${fac === "warden" ? "Warden Company" : "House Amaranth"} out of the shop. No file beyond this one yet.`,
  };
}

/**
 * The Personnel list: every active pilot grouped by their lance, then one
 * struck group at the bottom holding everyone who left, however they left.
 */
export function archiveRosterGroups(state: CampaignState): ArchiveRosterGroup[] {
  const groups: ArchiveRosterGroup[] = [];
  for (const lance of activeLanceIds(state)) {
    const entries = lanceRoster(state, lance).filter((e) => e.status === "active");
    if (entries.length) groups.push({ id: lance, label: lanceDisplayName(lance), entries });
  }
  const struck = Object.values(state.pilots).filter((e) => e.status !== "active");
  if (struck.length) groups.push({ id: "struck", label: "Struck from the roster", entries: struck });
  return groups;
}
