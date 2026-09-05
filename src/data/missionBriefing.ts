// src/data/missionBriefing.ts
// Codex Rebuild & Live Briefing Plan v1, Part B — live pre-mission briefing
// data. Pure data/logic module: no Phaser, no engine import.
//
// Build Brief §5.2 / eslint.config.js's own no-restricted-imports rule:
// src/data may only import from ./types (siblings inside data/ are fine —
// chatIntent.ts already imports ./ambientLines and ./verbs the same way —
// it's ../engine/*, ../scenes/*, ../ui/*, ../sim/* that are blocked). The
// "which mission is next" question needs CampaignState.lastMissionEcho,
// which lives on engine/campaignState.ts's CampaignState — rather than
// importing that type here, nextWardenMission below takes just the one
// field it actually needs, typed inline. Hub.ts (the only caller — see its
// handleBriefRequest) already has the real CampaignState in hand and passes
// state.lastMissionEcho straight through.
//
// Scope: Warden Company only. Hub.ts (the scene that owns the CO and the
// briefing panel built on top of this) is built entirely around
// WARDEN_PILOTS / the Warden roster — engine/campaignState.ts's own
// baseSceneKeyFor() routes any save without pilot_rourke to Hangar instead,
// which has no CO and no chat at all. House Amaranth has no Hub yet
// ("ill do the hub some other day" — Maxime, 1 Sep 2026, that same file's
// comment), so there is no live-briefing consumer for that roster's mission
// order to serve. If that ever changes, WARDEN_MISSION_ORDER is the one
// constant a second, House-Amaranth-scoped order would sit alongside, not
// replace.
import type { CampaignMission } from "./types";
import { AMARANTH_ACT1, AMARANTH_ACT2, AMARANTH_ACT3 } from "./campaignAmaranth";
import { BLOOM } from "./bloom";
import { ALL_HOSTILE_MECHS } from "./units";

/**
 * A wave's archetypeId can name either a Bloom creature (data/bloom.ts) or
 * a named hostile mech (data/units.ts's ALL_HOSTILE_MECHS — e.g. Mission
 * 6's "House Amaranth Line Trooper" waves, the first fight in the campaign
 * against something other than the Bloom). Checked in that order since
 * Bloom encounters are the overwhelming majority; falls back to the raw id
 * only for a genuinely unrecognized archetype, which shouldn't happen
 * against real mission data.
 */
function archetypeDisplayName(archetypeId: string): string {
  return BLOOM[archetypeId]?.displayName ?? ALL_HOSTILE_MECHS[archetypeId]?.displayName ?? archetypeId;
}

/**
 * The full 36-mission Warden Company order — Act I, then II, then III,
 * concatenated once (same three-array concatenation data/allCampaigns.ts's
 * own CAMPAIGNS entries are built from, just without the per-act CampaignDef
 * wrapping — this module only cares about one continuous mission sequence).
 * Exported for tests and for anything else that ever needs the whole order
 * rather than just "what's next."
 */
export const WARDEN_MISSION_ORDER: CampaignMission[] = [...AMARANTH_ACT1, ...AMARANTH_ACT2, ...AMARANTH_ACT3];

/**
 * The next mission a Warden Company save should be briefed on, derived from
 * the one progress field CampaignState actually carries —
 * `lastMissionEcho.missionId` (engine/campaignState.ts; OVERWRITTEN each
 * time a mission resolves, never accumulated — there is no explicit
 * completed-missions list anywhere on CampaignState, see that field's own
 * comment). No echo yet (a brand-new campaign, nothing flown) means Mission
 * 1 — matches CampaignSetup.ts's own new-campaign behavior. An echo naming
 * a mission this order doesn't recognize (a House Amaranth save's echo
 * reaching here by mistake, or synthetic test data) falls back to Mission 1
 * rather than guessing at a position. Reaching past the final mission
 * (echo names Mission 36, the campaign's last) means the campaign is
 * complete — returns null, which callers must handle explicitly rather than
 * risking a silent blank panel.
 */
export function nextWardenMission(lastMissionEcho: { missionId: string } | undefined): CampaignMission | null {
  if (!lastMissionEcho) return WARDEN_MISSION_ORDER[0] ?? null;
  const idx = WARDEN_MISSION_ORDER.findIndex((m) => m.id === lastMissionEcho.missionId);
  if (idx === -1) return WARDEN_MISSION_ORDER[0] ?? null;
  return WARDEN_MISSION_ORDER[idx + 1] ?? null;
}

/**
 * A mission's position in the 36-mission Warden order, 0-based. -1 if the id
 * isn't in WARDEN_MISSION_ORDER at all (a House Amaranth id, or bad data).
 * Exported for codex.ts's own unlock gating (Codex Rebuild & Live Briefing
 * Plan v1, Part A) — a codex entry names the mission that unlocks it, and
 * needs to compare that mission's position against how far the save has
 * actually gotten.
 */
export function wardenMissionIndex(missionId: string): number {
  return WARDEN_MISSION_ORDER.findIndex((m) => m.id === missionId);
}

/**
 * How far into WARDEN_MISSION_ORDER a save has actually gotten, as a 0-based
 * index — codex.ts's own gating question ("has this save resolved mission X
 * yet, win or loss") reduces to "is X's index <= this number."
 *
 * Built on the same lastMissionEcho field nextWardenMission reads (see that
 * function's own comment: OVERWRITTEN each time, never accumulated — there
 * is no explicit completed-missions list on CampaignState). Because
 * nextWardenMission always advances one slot regardless of win or loss (a
 * loss doesn't loop you back to retry the same mission — see that
 * function's own logic), "the last mission named in the echo" and "the
 * highest mission this save has resolved" are the same mission: whatever
 * lastMissionEcho names IS the highest one reached, win or loss alike.
 *
 * No echo yet (nothing flown) returns -1 — lower than every real mission's
 * index (0 upward), so nothing gated on "after mission 1" or later shows
 * for a brand-new campaign. An unrecognized id (shouldn't happen against
 * real save data) also falls to -1 rather than guessing at a position —
 * safer to under-unlock than to risk spoiler content on bad data.
 */
export function highestWardenMissionIndexReached(lastMissionEcho: { missionId: string } | undefined): number {
  if (!lastMissionEcho) return -1;
  return wardenMissionIndex(lastMissionEcho.missionId);
}

/**
 * A plain-English mechanics line for a mission's objective — the briefing
 * panel's own second block, under the mission's already-written narrative
 * `briefing` text. Every branch reads only the objectiveParams fields that
 * objective type actually sets (data/types.ts's own CampaignMission.
 * objectiveParams comment documents exactly which fields pair with which
 * objective) — no fallback guessing across types.
 *
 * The `default` branch below is unreachable today (the switch already
 * covers every member of CampaignMission["objective"]) but throws rather
 * than silently returning an empty string if that union ever grows a new
 * value this function hasn't been taught yet — same "flag it, don't guess"
 * discipline as everywhere else in this project.
 */
export function describeObjective(mission: CampaignMission): string {
  const p = mission.objectiveParams;
  switch (mission.objective) {
    case "eliminate_all":
      return "Eliminate every hostile on the field. No turn limit — losing the whole squad is the only way to fail this one.";
    case "hold_zone": {
      const holdFrom = p.holdUntilTurn ?? p.turnLimit;
      return `Hold the marked zone — keep every hostile off it from turn ${holdFrom} onward, through turn ${p.turnLimit}. Real deadline: losing the zone unopposed past that point ends the mission.`;
    }
    case "extract_unit":
      if (p.extractThreshold !== undefined) {
        return `Get at least ${p.extractThreshold} of the civilians aboard to an exit tile before turn ${p.turnLimit}. Real deadline.`;
      }
      return `Get the named unit to an exit tile before turn ${p.turnLimit}. Real deadline.`;
    case "clear_bloom":
      return "Clear every bloom mat tile on the board. No turn limit — losing the whole squad is the only way to fail this one.";
    case "survive_n_turns":
      return `Survive with the squad intact until turn ${p.turnLimit}. No board to clear — just live through it.`;
    case "contested_landing":
      return "Eliminate every hostile. Expect contact the instant you land — no grace period before this one turns hot.";
    case "protect_asset": {
      const name = p.assetName ?? "Providence";
      return `Protect ${name} through turn ${p.turnLimit}. It takes damage every turn a hostile ends its move inside the defended zone — keep them out of it.`;
    }
    default:
      throw new Error(`describeObjective: unhandled objective type ${String(mission.objective)}`);
  }
}

/** Oxford-comma join — "A", "A and B", "A, B, and C". */
function joinWithAnd(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Composition-and-count-only passive scan — Maxime's own confirmed depth
 * (AskUserQuestion, 4 Sep 2026, Codex Rebuild & Live Briefing Plan v1 §4:
 * "Composition & count only"). Deliberately sums only `mission.enemyWaves`
 * — the base roster a mission spawns with — and never `mission.events`.
 * A mission's scripted `events` (a `"spawn"` action) are reinforcements or
 * ambushes the mission author placed on purpose to surprise the player
 * (Mission 4's burrowed-Undertow reveal is the plan doc's own named example
 * of exactly this); a passive pre-mission scan that spoiled those would
 * undercut the entire reason they're kept separate from the base wave list
 * in the first place. No positions, no per-wave turn timing, no mention of
 * `mirrorPlayerSquad` scaling — just "roughly how many, roughly what kind."
 */
export function passiveScan(mission: CampaignMission): string {
  // Grouped by DISPLAY NAME, not archetype id — Mission 6's four named
  // House Amaranth Line Trooper archetypes (hostile_mech_amaranth_01..04,
  // data/units.ts) are four distinct pilots but read to a player as the
  // same kind of hostile, and the game never distinguishes them anywhere
  // else either (identical displayName on every one of them). Grouping by
  // id first would report "House Amaranth Line Trooper" four separate
  // times instead of once, which is composition data the scan was never
  // meant to expose in the first place.
  const counts = new Map<string, number>();
  for (const wave of mission.enemyWaves) {
    const name = archetypeDisplayName(wave.archetypeId);
    counts.set(name, (counts.get(name) ?? 0) + wave.count);
  }
  if (counts.size === 0) {
    return "Scans show no hostile signatures on the approach — whatever's out there isn't visible from here.";
  }

  const entries = [...counts.entries()]
    .map(([displayName, n]) => ({ displayName, n }))
    .sort((a, b) => b.n - a.n);
  const total = entries.reduce((sum, e) => sum + e.n, 0);

  if (total === 1) {
    return `Scans show a single hostile signature: ${entries[0].displayName}.`;
  }
  if (entries.length === 1) {
    return `Scans show roughly ${total} hostiles, all ${entries[0].displayName}.`;
  }
  return `Scans show roughly ${total} hostiles, mixed ${joinWithAnd(entries.map((e) => e.displayName))}.`;
}
