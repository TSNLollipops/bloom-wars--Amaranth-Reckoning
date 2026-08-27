// src/data/types.ts
// Everything else imports from here. Transcribed from Data Pack §2.
// Pure types — no logic, no Phaser.

export type Path = "meeps" | "tank" | "reeps" | "munti";
// "carabil" added 27 Aug 2026 — the Carrier CO (Arangement of Content,
// Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.3) is confirmed Carabil, per
// romance.ts's own long-standing note: "add it to ROMANCE_CAPPED_SPECIES
// and the Species union together the moment one ever is." He isn't a
// UNIT_ARCHETYPES entry (not a deployable mek pilot), so this species
// value exists for isRomanceableSpecies() to key off directly rather than
// through the archetype lookup every combat pilot uses.
export type Species = "human" | "hiopi" | "osnius" | "carabil";
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
  | "dock"
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
  // "protect_asset" (Mission 22 "Ash on the Water," 25 Aug 2026 —
  // Independent Campaign doc, Appendix A: "a non-player off-board asset (a
  // ship) with its own damage state, implicitly defended"). Walked through
  // AskUserQuestion before building: zone-tick was the recommended and
  // chosen shape — the Providence isn't a unit on the board, it's a
  // perimeter. Deliberately a NEW field rather than reusing holdZone: the
  // two read oppositely (hold_zone wants a PLAYER standing there;
  // protect_asset wants no HOSTILE standing there), and a mission using one
  // could plausibly want the other's tiles to differ, so overloading one
  // field's meaning across both objective types risked exactly the kind of
  // confusion this project's own process notes warn about. See
  // engine/mission.ts's tickAssetDamage/checkWinLoss for the actual verb.
  defendZone?: Coord[];
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
    // burrowed? (Mission 21 "Cut the Root," 25 Aug 2026): the Heartwood's
    // own Data Pack §8.1 special rule ("every 2 turns from turn 3, spawns 2
    // Undertow burrowed at the map's spawn seams") is the first scripted
    // spawn event this game has ever needed to be a burrower — every prior
    // "spawn" event action (all reveal/dialogue-adjacent flavor, never a
    // burrowing archetype) went through createBloomUnit's default
    // (unburrowed) path with nobody noticing the gap. One optional field,
    // defaults to false so every existing event keeps its exact behavior —
    // see engine/mission.ts's applyEventAction for the one-line pass-through.
    | { type: "spawn"; archetypeIds: string[]; at: Coord[]; tier?: Tier; burrowed?: boolean }
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
  //
  // "survive_n_turns" (Mission 9 "Cut Off," 25 Aug 2026 — Independent
  // Campaign doc, Appendix A: "win at turn count with objective(s) intact,"
  // Build Brief §6's own "cheapest ask" flag). Win the instant `turn`
  // reaches `objectiveParams.turnLimit` with the squad not wiped — squad
  // wipe already ends every mission unconditionally (checkWinLoss's
  // `playerAlive.length` check runs before any objective-specific branch),
  // so nothing extra needs to stay "intact" for this simplest version; a
  // mission that layers on a real asset/zone to also protect would extend
  // this branch, not this comment. Deliberately reuses turnLimit itself as
  // the survive-until count rather than adding a new field — hold_zone's
  // own holdUntilTurn already defaults to turnLimit when unset for exactly
  // this reason (a mission with nothing more specific to name than "the
  // turn count" always lands on the same number either way). See
  // engine/mission.ts's checkWinLoss for the win check and
  // sim/playerAi/index.ts's header for why the Player AI has no dedicated
  // heuristic for this yet (falls through to ordinary combat/retreat/regroup
  // logic, which is a reasonable "survive" strategy on its own — a real
  // survive-specific heuristic, e.g. favoring defensible terrain over
  // pursuit as the clock runs down, is Player AI plan Phase 6, deferred
  // until there was an objective to build it for).
  // "contested_landing" (Mission 15 "Landfall," 25 Aug 2026 — Independent
  // Campaign doc, Act II: "Contested Landing [new objective type]. Opposed
  // drop; the D-Day beat." Walked through with Maxime before building:
  // mechanically identical to eliminate_all (win when no hostile remains,
  // lose only on a squad wipe, same house-rule-#5 no-turn-limit-fail
  // treatment) — "the whole tension is front-loaded into a rough, chaotic
  // opening" is a map/wave-design property (hostiles already positioned
  // at/near the deploy zone at turn 1, no grace period before contact),
  // not a new win-condition, and Maxime's own choice when asked ("Deploy
  // under fire") confirmed that reading. Kept as a real, distinct union
  // member anyway rather than silently reusing "eliminate_all" — the HUD
  // already renders `mission.objective` as a raw label with zero
  // formatting (scenes/Battle.ts's drawHud), so a fifth value costs
  // nothing to display, and Act III may build a real opposed-drop mechanic
  // on top of this name later without a rename.
  // "protect_asset" (Mission 22 "Ash on the Water," 25 Aug 2026 —
  // Independent Campaign doc, Appendix A: "a non-player off-board asset (a
  // ship) with its own damage state, implicitly defended," Act II's
  // "rehearsal for Act 3's capital-ship stakes"). Walked through
  // AskUserQuestion before building — chosen shape (of three offered):
  // zone-tick. A defended perimeter (MapDefinition.defendZone, new field
  // just above) reuses the hold_zone COORDINATE concept but not its field —
  // ship HP (Mission.assetHp/assetMaxHp, engine/mission.ts) ticks down once
  // per turn (environmentStep's new tickAssetDamage, same call site as
  // tickBloomRegrowth) by PROTECT_ASSET_TICK_DAMAGE per hostile that ended
  // its turn inside the zone — not per hostile that attacked anything, so
  // good positioning/kiting hostiles away from the perimeter is what keeps
  // the ship alive, the same way keeping a Munti out of a pack's reach
  // already matters everywhere else in this game. Same house-rule-#5 shape
  // as eliminate_all: reaching turnLimit is a WIN if assetHp is still above
  // zero (or the board clears early), never a timeout loss — the real loss
  // condition is assetHp hitting 0, checked in checkWinLoss.
  objective: "eliminate_all" | "hold_zone" | "extract_unit" | "clear_bloom" | "survive_n_turns" | "contested_landing" | "protect_asset";
  objectiveParams: {
    turnLimit: number;
    holdUntilTurn?: number;
    extractUnitId?: string;
    // protect_asset only — defaults to PROTECT_ASSET_DEFAULT_MAX_HP
    // (data/combatTables.ts) when unset, so most protect_asset missions
    // never need to name this explicitly; a per-mission override exists
    // because Appendix A already names a second protect_asset mission
    // (32, Act III) that may want a different ship-toughness feel than 22.
    assetMaxHp?: number;
    // extract_unit + civilianSpawns only (Mission 31 "The Last Convoy," 25
    // Aug 2026 — Independent Campaign doc: "not everyone gets out," same
    // flag as Mission 12's own permadeath note, §6a). The minimum number of
    // this mission's civilianSpawns that must reach an exit tile for a win.
    // Unset defaults to civilianSpawns.length (everyone has to make it) —
    // a mission author has to deliberately choose a number below the total
    // for "not everyone gets out" to be true by design rather than only by
    // bad luck. See engine/mission.ts's checkExtraction/checkWinLoss for
    // the actual verb; extractUnitId above is untouched and still governs
    // every existing single-pilot extract_unit mission (5, 17, 23, 26) —
    // the two never coexist on the same mission.
    extractThreshold?: number;
  };
  playerPilotIds: string[];
  // Mission 31 "The Last Convoy" (25 Aug 2026 — Maxime, on the escort AI's
  // shape: "go ham. 3, the game is meant to feel alive"). Non-combat units
  // spawned alongside the squad, side:"player" (real stakes — the hostile
  // AI targets them like anyone else) but moved by their own autonomous
  // flee/path-to-exit AI (engine/ai.ts's decideCivilianAction), never by a
  // click or the headless sim's player-autoplay loop. Deliberately NOT
  // referenced by instance id anywhere in mission data — engine/units.ts's
  // nextInstanceId is a single counter shared across every unit the mission
  // ever creates, so a spawned unit's runtime id isn't something authored
  // data can predict (the same reason Mission 28's own comment gives for
  // never hooking a unit_downed trigger to a hostile's id). checkExtraction
  // and checkWinLoss instead just ask "how many living BattleUnit.isCivilian
  // units are there, and how many already reached an exit" — see
  // objectiveParams.extractThreshold above for the win/loss math. Absent
  // (undefined/empty) on every mission but 31; when present, mission.objective
  // must be "extract_unit" and objectiveParams.extractUnitId must be unset —
  // the two extraction shapes never coexist.
  civilianSpawns?: { at: Coord; displayName: string }[];
  enemyWaves: EnemyWave[];
  events: MissionEvent[];
  rewardPoints: number;
  heirloomCharge: "locked" | "visible_capped" | "available";
  // Mission 5's rescue-and-recruit pass (23 Aug 2026) — see BonusObjective's
  // own comment above. Never gates mission win/loss; only ever adds.
  bonusObjective?: BonusObjective;
  // Stub, 25 Aug 2026 (Maxime, on missions 9-36: "I want the combat side to
  // be done, with the open nodes for the social interaction that will be
  // the best part of the game imho" — then, asked whether to build the
  // actual node system now or just leave a slot: "Stub an empty hook field
  // now"). A free-form label ONLY — nothing reads this field yet, and
  // nothing should start reading it before there's a real system behind
  // it. That system is `claude/Bloom_Wars_NPC_Reaction_Engine_v1.md`
  // (confirmed formula, explicitly "zero code, not scheduled") or whatever
  // it feeds — Favorability (Antfarm Carrier Hub §13.2), Stress (§11.4), or
  // an in-mission talk/fight/ambush choice (Spitball Ideas). This field
  // exists so a mission authored between now and whenever that engine gets
  // built has somewhere to name "there's a social beat here" without a
  // structural rework across every mission file later. Purely descriptive
  // today, e.g. "marrow_distant_sighting" or "bosk_last_words" — not an id
  // into any table, not validated, not required.
  socialHook?: string;
  // Mission-gated ability unlock (Taunt pass, 25 Aug 2026 — Maxime: "only
  // give them the ability for this mission onward"). CampaignState today
  // has no notion of "which mission number are we on" (rourkeRank's own
  // comment already flags the same gap for rank-up triggers), and
  // engine/mission.ts deliberately never imports a specific named
  // campaign's mission array — it only ever works from whatever
  // CampaignMission it's handed, so a real generic solution belongs on
  // the mission data itself, not as an id-parsing shortcut in the engine.
  // deployPlayerUnits() reads this at deploy time and layers the named
  // ability onto every living player unit of the given path, on top of
  // (never replacing) that unit's normal per-archetype kit.
  //
  // "Onward" is intentionally NOT solved generically here — there is no
  // campaign-state-level persistent unlock set, on purpose. Only mission 8
  // carries this field today because missions 9-12 don't exist yet; when
  // they're built, carry the same entry onto each of them too. If that
  // ever gets tedious (a real "unlocked once, applies to every mission
  // after" need), that's the moment to promote this into CampaignState —
  // not before, per this project's own scope-flagging rule.
  bonusAbilityUnlocks?: { path: Path; abilityId: string }[];
}

export interface AbilityDef {
  id: string;
  displayName: string;
  kind: "passive" | "active" | "active_reactive" | "party";
}
