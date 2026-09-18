// src/sim/heirloomFielding.ts
// Fielding an Heirloom in a headless run (17 Sep 2026, Player Bot Reuse
// Plan §1c). In the real game only scenes/Battle.ts puts an Heirloom's kit
// on a pilot (resolveDeployRoster reads the campaign's fielded Heirloom).
// The harness has no campaign, so without this no unit in any batch run
// ever carried a single Heirloom verb, and teaching the bot to use them
// would have changed no number anywhere.
//
//   npm run sim:batch -- 100 --heirloom=cinder_line
//   npm run sim:batch -- 100 --heirloom=last_word:5            every ability at rank 5
//   npm run sim -- mission_amaranth_8 --heirloom=iron_oath@pilot_bosk
//
// Who carries it: the named pilot if one is given and deployed; otherwise
// the first deployed pilot on the Heirloom's own path; for the two "any
// path" Heirlooms, the first deployed pilot. The commander is only picked
// when nobody else fits.
import type { CampaignMission, Path } from "../data/types";
import { HEIRLOOMS, HEIRLOOM_MAX_ABILITY_RANK, type HeirloomId } from "../data/heirlooms";
import { findMek, findPilot } from "../data/pilotRegistry";
import type { DeployRosterEntry } from "../engine/mission";
import type { OnHitEffectKind } from "../engine/units";

export interface SimHeirloom {
  id: HeirloomId;
  /** Rank for every ability in the kit, 1-5. Default 1 (the free rank). */
  rank?: number;
  /** Force a wielder. Must be deployed on the mission. */
  pilotId?: string;
}

/** Every on-hit effect a campaign can have fought — what a late-campaign Simulacrum draws from. */
export const ALL_ON_HIT_EFFECT_KINDS: OnHitEffectKind[] = ["acid_dot", "debuff_attack", "knockback", "stun"];

/** `id`, `id:rank`, `id@pilot`, or `id:rank@pilot`. Throws on an unknown id or a rank outside 1-5. */
export function parseHeirloomFlag(raw: string): SimHeirloom {
  const [idAndRank, pilotId] = raw.split("@");
  const [id, rankRaw] = idAndRank.split(":");
  if (!(id in HEIRLOOMS)) throw new Error(`Unknown Heirloom "${id}". Known: ${Object.keys(HEIRLOOMS).join(", ")}`);
  const rank = rankRaw === undefined ? undefined : Number(rankRaw);
  if (rank !== undefined && (!Number.isInteger(rank) || rank < 1 || rank > HEIRLOOM_MAX_ABILITY_RANK)) {
    throw new Error(`Heirloom rank must be 1-${HEIRLOOM_MAX_ABILITY_RANK}, got "${rankRaw}"`);
  }
  return { id: id as HeirloomId, rank, pilotId: pilotId || undefined };
}

/** The mission's own static squad as deploy entries — what `new Mission(def)` builds when no roster is passed. */
export function staticRoster(mission: CampaignMission): DeployRosterEntry[] {
  return mission.playerPilotIds.map((pilotId) => {
    const pilot = findPilot(pilotId);
    if (!pilot) throw new Error(`heirloomFielding: unknown pilot id ${pilotId}`);
    return { pilotId, pilot, mek: findMek(pilot.mekId) };
  });
}

function pathOf(entry: DeployRosterEntry): Path {
  return entry.pilot.archetypeId.replace(/^arch_/, "").split("_")[0] as Path;
}

/**
 * A copy of `roster` with the Heirloom's kit on one pilot, and that pilot's
 * id. `wielderId` is undefined when nobody on the roster can carry it (a
 * path-locked Heirloom and no pilot of that path deployed); the roster then
 * comes back unchanged.
 */
export function fieldHeirloom(roster: DeployRosterEntry[], h: SimHeirloom): { roster: DeployRosterEntry[]; wielderId?: string } {
  const def = HEIRLOOMS[h.id];
  const rank = h.rank ?? 1;
  const candidates = roster.filter((e) => def.path === null || pathOf(e) === def.path);
  let wielder: DeployRosterEntry | undefined;
  if (h.pilotId) {
    wielder = roster.find((e) => e.pilotId === h.pilotId);
    if (!wielder) throw new Error(`heirloomFielding: ${h.pilotId} is not deployed on this mission`);
  } else {
    wielder = candidates.find((e) => !e.pilot.exemptFromPermadeath) ?? candidates[0];
  }
  if (!wielder) return { roster };
  const ranks: Record<string, number> = {};
  for (const ability of def.abilities) ranks[ability.id] = rank;
  const target = wielder;
  return {
    roster: roster.map((e) => (e === target ? { ...e, heirloomAbilityRanks: ranks } : e)),
    wielderId: target.pilotId,
  };
}
