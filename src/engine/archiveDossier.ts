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
import { type Catalyst, stageFromTier } from "../data/ambientLines";
import { CLIQUE_THRESHOLD, RIVAL_THRESHOLD, pairKey } from "../data/npcBonds";
import { UNIT_ARCHETYPES } from "../data/units";
import type { MekTrack, PilotBackground } from "../data/types";
import {
  type CampaignPilotEntry,
  type CampaignState,
  type HubPilotSocialState,
  type LanceId,
  activeLanceIds,
  baseSceneKeyFor,
  lanceDisplayName,
  lanceOfPilotIn,
  lanceRoster,
  rankDisplayTitle,
} from "./campaignState";
import { type FacilityProfile, mekCatalystFor } from "./facility";
import { WARDEN_FACILITY } from "./facilityWarden";
import { HOUSE_AMARANTH_FACILITY } from "./facilityHouseAmaranth";
import { type PilotServiceRecord } from "./statsStore";
import { currentDay } from "./calendarClock";
import { topMemories, MEMORY_KIND_LABEL, type MemoryEntry } from "../data/memories";
import { ALL_MISSIONS_BY_ID } from "../data/allCampaigns";

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

/**
 * A Mek's own dossier — 9 Sep 2026, Bloom_Wars_Codex_Rework_Plan_v1.md §9b
 * (decided 8 Sep: "the full dossier, not the cheap line"). Same shape as a
 * pilot's minus the fields that don't apply to someone who never deploys
 * (rank, lance, frame, tier, record, points), plus the one line a pilot's
 * never needs: who they are attached to.
 */
export interface ArchiveMekDossier {
  mekId: string;
  /** The pilot this Mek is matched to — always exactly one. */
  pilotId: string;
  /** The Mek's own name, or the possessive label until one is picked. */
  displayName: string;
  lines: ArchiveLiveLine[];
  status: string;
  /**
   * The Mek's written paragraph, when their pilot's authored dossier
   * carries one (every hand-authored Mek's is the MEK tail on that entry).
   * A generated recruit's Mek has none and gets `intake` instead.
   */
  bio?: string;
  intake?: string;
}

const CO_PILOT_ID = "co";

/**
 * The CO's own npc id in HubPilotSocialState / CampaignState.npcSocialStates
 * — must match scenes/Hub.ts's own CO_PILOT_ID exactly (Hub.ts's own header
 * comment cross-references this one). Not imported from Hub.ts: engine/ may
 * not import scenes/, per this file's own header rule.
 */
const CO_NPC_ID = "npc_co";

/**
 * The CO's status line — Codex Rework Plan §9a: command staff never has a
 * mission outcome of their own to report, unlike a deployed pilot's status
 * line. Shared by archiveStatusText's CO branch (kept for a
 * CampaignPilotEntry with this id, should one ever exist) and
 * buildCoDossier below, so the two can't drift apart into two different
 * sentences describing the same thing.
 */
const CO_STATUS_TEXT = "Command staff, not a deployed roster slot. There is no mission outcome to report here.";

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

/**
 * The Codex intake line, real version — Catalyst_Gauntlet_v2_ThirdLance_
 * Verinis_Recruits.md §5 item 5: "the codex intake line reads the
 * background: 'Intake: the Understrand, Cistgate. Arcology stack.
 * Line-trained.' — four words the archive can say about a stranger
 * without inventing a life." Matched to that exact example, sentence by
 * sentence: sector+planet, then texture (sentence case — "Arcology Stack"
 * reads as "Arcology stack" here, an ordinary descriptive phrase, not a
 * proper noun), then academy verbatim (an institution's own name, kept in
 * its own title case, same as "Line-trained" already was in the example).
 *
 * A sector beginning "The " (only The Understrand today) gets that
 * article softened to lowercase for the mid-sentence "Intake: the
 * Understrand, ..." read, ordinary English style for a proper noun that
 * isn't sentence-initial — the example line does exactly this. Academy
 * names starting "The " (The Cistgate Ledgerworks, The Greywatch Muster)
 * are NOT softened: each is its own new sentence there, so the capital is
 * correct as written.
 */
function formatIntakeLine(background: PilotBackground): string {
  const sectorMidSentence = background.sector.startsWith("The ") ? `the ${background.sector.slice(4)}` : background.sector;
  const textureSentenceCase = background.texture.charAt(0).toUpperCase() + background.texture.slice(1).toLowerCase();
  return `Intake: ${sectorMidSentence}, ${background.planet}. ${textureSentenceCase}. ${background.academy}.`;
}

/**
 * The "Carries" block, 12 Sep 2026 (Emotional Brain build plan §3d): the
 * pilot's three loudest memories today (data/memories.ts topMemories),
 * rendered as record lines. "Lost M.Sgt. Bosk, The Fallow Line, day 31."
 * This is the file describing the pilot, not the pilot speaking, so it is
 * system text; Archive prose rule applies (no em dashes, no semicolons,
 * enforced by archiveDossier.test.ts). A pilot with nothing on the ledger
 * gets no Carries lines at all rather than a placeholder: an empty ledger
 * is a fresh recruit, and that reads honestly on its own.
 */
export function carriesFor(state: CampaignState, memories: readonly MemoryEntry[] | undefined): ArchiveLiveLine[] {
  const today = currentDay(state);
  const top = topMemories(memories, today, 3);
  return top.map((m, i) => {
    const about = m.about.map((id) => state.pilots[id]?.pilot.displayName.split("—")[0].trim()).filter((n): n is string => !!n);
    const where = m.missionId ? ALL_MISSIONS_BY_ID[m.missionId]?.displayName ?? m.missionId : "aboard";
    const value = `${MEMORY_KIND_LABEL[m.kind]}${about.length ? ` (${about.join(", ")})` : ""}. ${where}, day ${m.day}.`;
    return { label: i === 0 ? "Carries" : "", value, tone: m.kind === "lost_squadmate" ? "warn" : "muted" };
  });
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
    return CO_STATUS_TEXT;
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
      return `No longer serving with ${company}. Reassigned off the ship.`;
    case "discharged":
      return `No longer serving with ${company}. Discharged.`;
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
    lines.push(...carriesFor(state, social.memories));
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
    // 9 Sep 2026 — a generated recruit with a real background (the
    // Catalyst Gauntlet, engine/campaignState.ts's generatePilot) gets a
    // real intake line instead of the generic shop placeholder. The
    // placeholder survives for anyone with neither a written entry nor a
    // background — a save from before this pass, or a hand-authored
    // pilot who was never given one — so it never regresses to a blank.
    intake: written
      ? undefined
      : entry.pilot.background
        ? formatIntakeLine(entry.pilot.background)
        : `Joined ${fac === "warden" ? "Warden Company" : "House Amaranth"} out of the shop. No file beyond this one yet.`,
  };
}

// ---------------------------------------------------------------------
// The CO. 9 Sep 2026 — Codex Rework Plan §9a (decided 8 Sep): two live
// lines, relationship status and a command record, nothing about his own
// Stress/Morale/Standing — "even if we dont give the player his personal
// info the way we give the player their lance and mek info. its not
// relevant to his rank," Maxime's own words. Applies to both COs: Warden's
// Arangement and House Amaranth's Verinis (§9a, confirmed 8 Sep: "well its
// good for both amaranth and warden co").
//
// The CO is not a CampaignPilotEntry — he never deploys, is not in
// state.pilots, and archiveRosterGroups never lists him — so he gets his
// own small dossier builder rather than being forced through
// buildArchiveDossier's pilot-shaped block.
// ---------------------------------------------------------------------

export interface ArchiveCoDossier {
  displayName: string;
  lines: ArchiveLiveLine[];
  status: string;
  /** The authored entry — "co" for Warden's Arangement, "co_amaranth" for Verinis. */
  entry?: ArchiveEntry;
}

/**
 * The CO's relationship line, when he has one — the exact "Registered
 * partner" shape a pilot's own dossier uses (relationsFor above), pointed
 * at his own npcSocialStates entry instead of a CampaignPilotEntry's
 * social block. He is only ever romanceable by the player, never by
 * another crew member, so there is no second branch to check here the way
 * relationsFor checks state.npcSocial.relationships for pilot-to-pilot
 * couples.
 */
function coRelationsFor(state: CampaignState): ArchiveLiveLine[] {
  const social = state.npcSocialStates?.[CO_NPC_ID];
  if (!social?.inRelationship) return [];
  return [{
    label: "Registered partner",
    value: `${playerTitle(facilityOf(state))} (${relationshipWord(social.favorability)})`,
  }];
}

/**
 * The CO's own dossier. `missionsResolved` is passed in rather than
 * recomputed here — it is exactly Archive.ts's own header figure
 * (highestMissionIndexReached + 1), already computed once per scene load.
 * A second computation of the same number here would be a second source
 * for it, which is exactly the kind of drift this file's own header rule
 * exists to prevent (the archive and the Hub must never disagree about a
 * number they are both describing — same principle, one more screen).
 *
 * "Pilots lost" reads state.pilots directly for a permanently_lost count
 * rather than a new tracker — the doc's own §9a flagged this as the
 * honest option ("the struck-pilot group... is a plausible source"),
 * since nothing campaign-wide currently counts losses on its own.
 * "Clean extractions" specifically was flagged as unconfirmed data and is
 * deliberately left out rather than guessed at with an invented counter.
 */
export function buildCoDossier(state: CampaignState, missionsResolved: number): ArchiveCoDossier {
  const fac = facilityOf(state);
  const lines: ArchiveLiveLine[] = [...coRelationsFor(state)];

  const losses = Object.values(state.pilots).filter((p) => p.status === "permanently_lost").length;
  const resolved = Math.max(0, missionsResolved);
  lines.push({
    label: "Command record",
    value: `${resolved} mission${resolved === 1 ? "" : "s"} resolved · ${losses} pilot${losses === 1 ? "" : "s"} lost`,
    tone: losses > 0 ? "warn" : undefined,
  });

  const entryId = fac === "warden" ? CO_PILOT_ID : "co_amaranth";
  const entry = archiveEntryById(entryId);
  return {
    displayName: entry?.title ?? (fac === "warden" ? "the CO" : "Brig. Verinis Amaranth"),
    lines,
    status: CO_STATUS_TEXT,
    entry,
  };
}

// ---------------------------------------------------------------------
// Meks. 9 Sep 2026 — until today a Mek appeared in the Archive exactly
// once, as one line inside their pilot's file. Now each has a file of
// their own, and the pairing reads the other way round: the Mek's dossier
// names their synker (the official-paperwork word for pilot, cleared —
// Codex Rework Plan §5, Q9/Q10), which is where the old possessive label
// ("Rourke's Mek") goes to live once the Mek has a real name.
// ---------------------------------------------------------------------

/** Which building's profile a save reads — the same fork facilityOf makes, one level down. */
function profileOf(state: CampaignState): FacilityProfile {
  return facilityOf(state) === "amaranth" ? HOUSE_AMARANTH_FACILITY : WARDEN_FACILITY;
}

/** The pilot a Mek is matched to, on this save. A Mek with no pilot is not on the roster at all. */
export function pilotOfMek(state: CampaignState, mekId: string): CampaignPilotEntry | undefined {
  return Object.values(state.pilots).find((e) => e.pilot.mekId === mekId);
}

/**
 * A Mek's catalyst — exactly the answer the Workshop floor gives
 * (engine/facility.ts's mekCatalystFor, shared with scenes/Hub.ts), so the
 * dossier and the person standing in the cradle can never disagree.
 */
export function mekCatalystOf(state: CampaignState, mekId: string): Catalyst {
  return mekCatalystFor(profileOf(state), mekId, state.meks[mekId]?.background);
}

const TRACK_WORD: Record<MekTrack, string> = {
  fabricator: "Fabricator",
  armorer: "Armorer",
  runemaster: "Runemaster",
  fieldwright: "Fieldwright",
  quartermaster: "Quartermaster",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Replace a raw Mek id wherever one appears in authored text ("MEK —
 * mek_rourke, catalyst Raven") with that Mek's live name. The authored
 * tails were written against ids on purpose — the names weren't picked
 * yet — so the text is right the day the names land, without an edit.
 */
export function resolveMekIds(state: CampaignState, text: string): string {
  return text.replace(/\bmek_[a-z0-9_]+\b/g, (id) => state.meks[id]?.displayName ?? id);
}

/**
 * The Mek's own paragraph, lifted from their pilot's authored dossier: every
 * hand-authored pilot entry closes with a tail headed "MEK — <id>, catalyst
 * <Word>" whose body is the Mek's background. Read here rather than copied
 * into a second table, so there is one text to keep true.
 */
export function mekBioFor(mekId: string, pilotId: string): string | undefined {
  const written = archiveEntryById(`pilot_${pilotId.replace(/^pilot_/, "")}`) ?? archiveEntryById(pilotId);
  const tail = written?.tail;
  if (!tail || !tail.heading.startsWith("MEK")) return undefined;
  if (!tail.heading.includes(mekId)) return undefined;
  return tail.body;
}

/**
 * A Mek's mood, if the save holds one. Meks are not roster entries, so
 * theirs lives in CampaignState.npcSocialStates (7 Sep 2026) — seeded the
 * first time the Hub builds them, which always precedes the archive
 * console being reachable. Absent only on a save that has never loaded
 * the Hub since that field existed; the dossier then shows no mood rather
 * than inventing one.
 */
function mekSocialOf(state: CampaignState, mekId: string): HubPilotSocialState | undefined {
  return state.npcSocialStates?.[mekId];
}

/**
 * The status line for a Mek. A Mek is never lost to combat — they retire
 * the instant their own pilot is permanently lost (Mek NPC plan §4), and
 * follow their pilot off the ship on a reassignment or discharge ("the
 * Mek follows the pilot" — Maxime's rule, scenes/Hub.ts). The child
 * clause is the plan's own: the scaffolding flag exists, nothing sets it
 * yet, and the line is ready for the day something does.
 */
export function mekStatusText(state: CampaignState, pilot: CampaignPilotEntry, fac: ArchiveFacility): string {
  const company = fac === "warden" ? "Warden Company" : "House Amaranth";
  const who = archiveDisplayName(state, pilot);
  switch (pilot.status) {
    case "permanently_lost":
      return `Retired to civilian life when ${who} was lost.${pilot.hasChildWithMek ? " Their child went with them." : ""}`;
    case "reassigned":
      return `No longer aboard. Left with ${who} on reassignment.`;
    case "discharged":
      return `No longer aboard. Left with ${who} on discharge.`;
    default:
      return `Active, serving with ${company}. ${lanceDisplayName(lanceOfPilotIn(state, pilot.pilot.id))} workshop.`;
  }
}

/**
 * Build one Mek's live block. Null for a mekId the save doesn't hold or
 * that no pilot on the roster is matched to — neither belongs on the shelf.
 */
export function buildMekDossier(state: CampaignState, mekId: string): ArchiveMekDossier | null {
  const mek = state.meks[mekId];
  if (!mek) return null;
  const pilot = pilotOfMek(state, mekId);
  if (!pilot) return null;

  const fac = facilityOf(state);
  const active = pilot.status === "active";
  const lines: ArchiveLiveLine[] = [];

  lines.push({ label: "Attached synker", value: archiveDisplayName(state, pilot) });
  lines.push({ label: "Catalyst", value: capitalize(mekCatalystOf(state, mekId)) });
  lines.push({
    label: "Track",
    value: mek.secondary ? `${TRACK_WORD[mek.primary]}, second in ${TRACK_WORD[mek.secondary]}` : TRACK_WORD[mek.primary],
  });

  const social = mekSocialOf(state, mekId);
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
    lines.push(...mekRelationsFor(state, mekId, pilot.pilot.id));
  }

  const bio = mekBioFor(mekId, pilot.pilot.id);
  return {
    mekId,
    pilotId: pilot.pilot.id,
    displayName: mek.displayName,
    lines,
    status: mekStatusText(state, pilot, fac),
    bio,
    intake: bio
      ? undefined
      : mek.background
        ? formatIntakeLine(mek.background)
        : `Came aboard with ${archiveDisplayName(state, pilot)}. No file beyond this one yet.`,
  };
}

/**
 * Closest and worst bond for a Mek, by the same thresholds relationsFor
 * uses for a pilot — minus their own synker, whose bond is seeded high on
 * purpose (the Matchset pairing) and is already the first line of the file.
 */
export function mekRelationsFor(state: CampaignState, mekId: string, ownPilotId: string): ArchiveLiveLine[] {
  const out: ArchiveLiveLine[] = [];
  const bonds = state.npcSocial?.bonds ?? {};
  const nameOf = (id: string) =>
    Object.values(state.pilots).find((p) => p.pilot.id === id)?.pilot.displayName ?? state.meks[id]?.displayName ?? id;
  const others = [...allPilotIds(state), ...Object.keys(state.meks)].filter((id) => id !== mekId && id !== ownPilotId);

  let bestId: string | null = null;
  let bestVal = CLIQUE_THRESHOLD - 1;
  let worstId: string | null = null;
  let worstVal = RIVAL_THRESHOLD + 1;
  for (const id of others) {
    const v = bonds[pairKey(mekId, id)] ?? 0;
    if (v >= CLIQUE_THRESHOLD && v > bestVal) { bestVal = v; bestId = id; }
    if (v <= RIVAL_THRESHOLD && v < worstVal) { worstVal = v; worstId = id; }
  }
  if (bestId) out.push({ label: "Closest aboard", value: nameOf(bestId), tone: "ok" });
  if (worstId) out.push({ label: "Friction with", value: nameOf(worstId), tone: "warn" });
  return out;
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
