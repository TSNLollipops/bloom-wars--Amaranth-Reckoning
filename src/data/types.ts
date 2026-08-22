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

export interface CampaignMission {
  id: string;
  displayName: string;
  mapId: string;
  briefing: string;
  objective: "eliminate_all" | "hold_zone" | "extract_unit";
  objectiveParams: { turnLimit: number; holdUntilTurn?: number; extractUnitId?: string };
  playerPilotIds: string[];
  enemyWaves: EnemyWave[];
  events: MissionEvent[];
  rewardPoints: number;
  heirloomCharge: "locked" | "visible_capped" | "available";
}

export interface AbilityDef {
  id: string;
  displayName: string;
  kind: "passive" | "active" | "active_reactive" | "party";
}
