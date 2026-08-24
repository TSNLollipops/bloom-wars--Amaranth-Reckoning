// src/data/types.ts
// Everything else imports from here. Transcribed from Data Pack §2.
// Pure types — no logic, no Phaser.

export type Path = "meeps" | "tank" | "reeps" | "munti";
export type Species = "human" | "hiopi" | "osnius";
export type Chassis = "bipedal" | "centauroid" | "bipedal_vibrissal";
export type Tier = "G" | "F" | "E" | "D" | "C" | "B" | "A";
export type MekTrack = "fabricator" | "armorer" | "runemaster" | "fieldwright" | "quartermaster";

export type Coord = { x: number; y: number };

export type TileType =
  | "plain"
  | "road"
  | "scrub"
  | "rubble"
  | "structure"
  | "bloom_mat"
  | "ridge"
  | "sump"
  | "deploy"
  | "spawn"
  | "exit"
  | "hold"
  | "wall";

export interface TileDef {
  id: TileType;
  displayName: string;
  moveCost: { bipedal: number; centauroid: number; flying: number };
  defenceStars: number;
  turnStartDamage?: number; // bloom_mat acid
  turnStartRepair?: number; // deploy pad
  reepsRangeBonus?: number; // ridge
  passableGround: boolean;
}

export interface UnitArchetype {
  id: string;
  displayName: string;
  path: Path;
  species: Species;
  chassis: Chassis;
  baseHp: number;
  moveRange: number;
  attackRange: [number, number];
  baseAttack: number; // 100 = the matrix as written
  baseDefense: number; // 100 = the matrix as written
  vision: number;
  canCounter: boolean;
  counterMaxRange: number; // 1 for every unit in the slice, including the Munti (attack range 2)
  abilities: string[];
  spriteKey: string;
}

// Casting is separate from balance data (Data Pack §1.2): who Trav is
// changes at a different rate than what a Meeps-on-centauroid is.
export interface PilotRecord {
  id: string;
  displayName: string;
  archetypeId: string;
  mekId: string;
  tier: Tier;
  // Permadeath exemption (engine/campaignState.ts's live Munti-presence
  // check, Amaranth Reckoning campaign doc / Spitball Ideas, 22 Aug 2026):
  // "the only character that is safe is the mc." Optional and false/absent
  // for every pilot except pilot_rourke (data/campaignAmaranth.ts) — kept
  // as an explicit, data-driven field rather than a hardcoded id check
  // buried in logic, per that pass's own instructions. Not read anywhere
  // outside the permadeath check.
  exemptFromPermadeath?: boolean;
}

export interface MekArchetype {
  id: string;
  displayName: string;
  primary: MekTrack;
  secondary: MekTrack | null;
  spareParts: number; // campaign-persistent, fabricator only
}

export interface BloomArchetype {
  id: string;
  displayName: string;
  weaponType: "claws" | "spines" | "acid" | "sonic" | "concussive" | "projectile" | "energy";
  movementType: "burrow" | "swarm" | "flight_membrane" | "flight_spore" | "limbless" | "sessile";
  perception: "compound" | "thermal" | "seismic" | "chemical" | "blind";
  intelligence: "reflexive" | "pack" | "emergent";
  endurance: number;
  vitality: number;
  moveRange: number;
  attackRange: [number, number];
  attackPower: number; // damage vs a 100-defence target at full endurance
  vision: number;
  swarmSize?: [number, number];
  onHit?: string; // effect id
  colorPalette: string[];
  spriteKey: string;
}

// Hostile mechs reuse the player UnitArchetype shape but are not pilots —
// they have no mek, no campaign persistence. See units.ts HOSTILE_MECHS.
export interface HostileMechArchetype {
  id: string;
  displayName: string; // "Unmarked Mech" for all four, per GDD §10.1's
  // quiet-critique discipline — the game never explains who they are.
  path: Path;
  tier: Tier;
  spawnAt: Coord;
}

export interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: TileType[][];
  deployZones: { player: Coord[]; enemy: Coord[] };
  exitTiles?: Coord[];
  holdZone?: Coord[];
}

export interface EnemyWave {
  archetypeId: string;
  count: number;
  atTurn: number;
  spawnAt: "enemy_deploy" | Coord[];
  burrowed?: boolean;
}

export interface MissionEvent {
  id: string;
  trigger:
    | { type: "turn_start"; turn: number; repeatEvery?: number }
    | { type: "zone_entered"; zone: Coord[] }
    | { type: "unit_downed"; unitId: string }
    | { type: "objective_complete" };
  action:
    | { type: "spawn"; archetypeIds: string[]; at: Coord[]; tier?: Tier }
    | { type: "reveal"; at: Coord[] }
    | { type: "dialogue"; text: string }
    | { type: "remove_from_roster"; unitIds: string[] };
  once: boolean;
  guardGroup?: string; // events sharing a guardGroup fire at most once between them
}

// Mission 3's "clean the bloom patch" pass (Maxime, 23 Aug 2026: "I'm
// thinking of making clean the bloom patch the objective of mission 3" —
// upgrading the earlier "cleaning job for munties" idea from a mission-3
// mechanic to mission 3's actual win condition) first shipped this as one
// optional layer, deliberately NOT the "every mission can carry N bonus
// objectives" system Maxime had also floated the same day ("if we got
// other mission with similar layout we can make those objective bonus
// objective in toher mission") — there was only one concrete objective
// type to generalize from at the time, and no debrief/scoring screen yet
// to show a player "you also did the bonus thing."
//
// Generalized 24 Aug 2026, once both existed (Maxime, having just gotten
// Mission 3's clear_bloom win condition and Mission 5's rescue-and-recruit
// bonus in the same build: "keep the rescue pilot and bloom patch thing
// around we are gonna use those as special objectif player can complete
// during mission for extra point" — then, asked about timing: "built the
// system to support adding those as 2cd objectif in later mission"). Still
// a plain discriminated union, not a generic/polymorphic payload field —
// every other typed shape in this file (EnemyWave, MissionEvent, TileDef)
// is concrete fields keyed by a `kind`/`type` discriminant rather than a
// generic bag, and following that same house style is what lets each
// variant's own fields (npcSpawnAt vs. patchTiles) type-check without a
// runtime cast anywhere they're read. `CampaignMission.bonusObjective`
// below stays a single optional field, not an array — one bonus objective
// per mission, of either kind.
export interface RescuePilotBonusObjective {
  kind: "rescue_pilot";
  npcSpawnAt: Coord;
  npcDisplayName: string;
  // Points on top of the recruit reward (Maxime, 24 Aug 2026 — asked
  // whether points should replace or add to the existing free-recruit
  // reward: "Points on top of the recruit (Recommended)"). See
  // engine/mission.ts's rescueOutcome and engine/campaignEconomy.ts's
  // computeBonusObjectivePoints.
  bonusPoints: number;
}

// engine/mission.ts's abil_clear_bloom verb (canClearBloom/
// getClearableBloomFrom/clearBloom) is already fully generic — it clears
// whatever bloom_mat tiles exist near the caster on the CURRENT mission's
// map, regardless of that mission's own `objective`. This variant reuses
// that exact verb as a bonus objective on any mission: `patchTiles` names
// a specific, fixed set of tiles that must all read non-bloom_mat for the
// bonus to succeed — independent of the mission's own win condition, so a
// mission whose real objective is eliminate_all can still carry a small
// bloom patch on the side. No "failed" outcome exists for this kind (see
// engine/mission.ts's clearBloomPatchOutcome) — unlike a rescue, which a
// hostile can actively deny by killing the NPC or the carrier, nothing on
// the board can make an uncleared patch fail; it's simply incomplete if
// the mission ends before every listed tile is clear.
export interface ClearBloomPatchBonusObjective {
  kind: "clear_bloom_patch";
  patchTiles: Coord[];
  bonusPoints: number;
}

export type BonusObjective = RescuePilotBonusObjective | ClearBloomPatchBonusObjective;

export interface CampaignMission {
  id: string;
  displayName: string;
  mapId: string;
  briefing: string;
  // "clear_bloom" (Mission 3, 23 Aug 2026): win when no bloom_mat tile
  // remains on the board — see engine/mission.ts's hasBloomMat/
  // tickBloomRegrowth and data/abilities.ts's abil_clear_bloom. Extends
  // house rule #5's no-turn-limit-fail shape rather than eliminate_all's
  // own turnLimit meaning anything new.
  objective: "eliminate_all" | "hold_zone" | "extract_unit" | "clear_bloom";
  objectiveParams: { turnLimit: number; holdUntilTurn?: number; extractUnitId?: string };
  playerPilotIds: string[];
  enemyWaves: EnemyWave[];
  events: MissionEvent[];
  rewardPoints: number;
  heirloomCharge: "locked" | "visible_capped" | "available";
  // Mission 5's rescue-and-recruit pass (23 Aug 2026) — see BonusObjective's
  // own comment above. Never gates mission win/loss; only ever adds.
  bonusObjective?: BonusObjective;
}

export interface AbilityDef {
  id: string;
  displayName: string;
  kind: "passive" | "active" | "active_reactive" | "party";
}
