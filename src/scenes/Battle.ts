// src/scenes/Battle.ts
// The playable battle scene (Build Brief step 10). Placeholder geometric
// shapes per GDD §12 — everything drawn with Phaser Graphics, no art
// pipeline. This file owns NO game rules: every move/attack/turn call
// goes through engine/mission.ts, and what's drawn is only ever a
// reflection of that engine state (Build Brief §5.2's load-bearing line).
import Phaser from "phaser";
import type { BloomArchetype, Coord, TileType } from "../data/types";
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { Mission, type DeployRosterEntry, type HostilePhaseEvent } from "../engine/mission";
import { playAmbient, stopAmbient, playSfx } from "./audio/AudioManager";
import type { BattleUnit } from "../engine/units";
import { coordKey, tileAt } from "../engine/grid";
import { BLOOM, BLOOM_ON_HIT_EFFECTS } from "../data/bloom";
import { findPilot, findMek } from "../data/pilotRegistry";
import { createWardenCampaignState, loadCampaignState, saveCampaignState, applyCommanderDownAttempt, hasSeenTutorial, markTutorialSeen, areTutorialHintsEnabled } from "../engine/campaignState";
import { fieldedHeirloom, heirloomForPilot, abilityRank } from "../engine/heirlooms";
import { HEIRLOOMS } from "../data/heirlooms";
// Calendar economy, 2 Sep 2026 — mission time feeds the same campaign clock
// the Hub does. Maxime: "time spent in the hub and time spent on mission run
// on the same ckock."
import { accrueRealMs, creditRealMs, measureRealDelta } from "../engine/calendarClock";
import { TILES } from "../data/tiles";
import { tierPipCount, CINDER_LINE_DAMAGE_PER_TURN, CINDER_LINE_MAX_TILES, CUTTING_ROOM_CHARGE_MAX_LINE_TILES, MASER_LANCE_CONE_RANGE } from "../data/combatTables";
// requiem_severance (Gjallar, Vault Phase 2 slice 7, 3 Sep 2026) — SEVERANCE.maxCharge for the HUD's own charge-meter line, same locked-numbers reuse engine/mission.ts's own Requiem section already does rather than a second placeholder constant.
import { SEVERANCE } from "../data/abilities";
import { recordHumanMissionSummary, activeRosterSize } from "../engine/telemetry";
// Cursor-following hover tip, 2 Sep 2026 — see scenes/ui/HoverTip.ts and
// engine/hoverTipLayout.ts. The CONTENT is hoverLines() below, unchanged
// and already shipped; this only moves where it's drawn.
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";
import { VITAL_SIGNS_WARN_FRACTION } from "../data/carrierModules";
import { UNIT_ARCHETYPES } from "../data/units";
import { pageActionBar, advancePage, moreButtonLabel } from "../engine/actionBarPaging";
// Item-info tooltip pass, 11 Sep 2026 (playtest note: "found by accident
// that one of his units could heal — nothing told him that going in").
// WEAPON_BRANCHES.description already exists for every branch (it's the
// same text the shop's own tooltip pass, same night, put on the BUY/EQUIP
// buttons) — this reuses it on the unit's own inspect card, see
// loadoutLines() below.
import { WEAPON_BRANCHES } from "../data/weaponBranches";

const TILE_COLORS: Record<TileType, number> = {
  plain: 0x3a4636,
  road: 0x5a5a5a,
  scrub: 0x455233,
  rubble: 0x8a7a5f,
  structure: 0x55606b,
  bloom_mat: 0x4a2e3a,
  ridge: 0x6a5a4a,
  sump: 0x2a4a5a,
  deploy: 0x2e5c7a,
  spawn: 0x7a2430,
  exit: 0x3d8a4a,
  hold: 0x8a7a2a,
  // dock (Mission 22, "Ash on the Water," 25 Aug 2026) — Protect Asset's
  // defended perimeter tile. Blue-leaning like deploy's own 0x2e5c7a (both
  // read as "friendly infrastructure"), shifted brighter/more teal so the
  // two are still visually distinct on the same board.
  dock: 0x2e8a7a,
  wall: 0x151515,
};

const PLAYER_COLOR = 0x2e5c7a;
const HOSTILE_MECH_COLOR = 0x7a6a55;

// Highlight/tell colours for the ability-depth pass (23 Aug 2026). Each is
// deliberately distinct from every colour already spoken for on this board:
// green 0x4ade80 = reachable, red 0xef4444 = attackable, cyan 0x22d3ee =
// repair target, amber 0xfbbf24 = overwatch brackets, red ring = collapsed
// Bloom. Violet does double duty for the two things Sensor Sweep connects
// (the sweep footprint, and being unseen/painted), which is the one place
// sharing a hue is the point rather than a collision.
const SWEEP_COLOR = 0xa855f7; // abil_sensor_sweep footprint + painted-contact ring
const CONCEAL_COLOR = 0xc084fc; // abil_ambush / abil_screen — this unit is not seen
const INTERDICT_COLOR = 0xfb923c; // abil_interdict kill-box
const SCREEN_COLOR = 0xf472b6; // abil_screen coverage preview
const FIRE_SUPPORT_COLOR = 0x38bdf8; // abil_fire_support — a distinct sky blue, chosen apart from every hue above so an armed strike's click-target wash never reads as a repaint of an existing verb (Sweep's own violet, Interdict's orange, Screen's pink)
const DEADFALL_STRIKE_COLOR = 0xd946ef; // deadfall_strike (Vault Phase 2 slice 2) — fuchsia, distinct from attackable's red and every hue above: this target set is NOT the normal attackable list (it ignores range), so it needs its own tell rather than borrowing red's meaning
// cinder_line_signature (Vault Phase 2 slice 3, 3 Sep 2026) — two colours,
// two different facts, deliberately not one: CINDER_LINE_TARGET_COLOR washes
// every legal click endpoint while the ability is armed (same "static area
// highlight" shape FIRE_SUPPORT_COLOR/missile's own range already use), a
// burnt orange distinct from every existing hue including INTERDICT_COLOR's
// lighter 0xfb923c. CINDER_LINE_BURN_COLOR is a separate, darker ember red —
// drawn every render() call (not just while armed) over whichever tiles are
// ACTUALLY on fire right now, on either side, the persistent hazard tell a
// player needs to not walk a unit through their own line by accident.
const CINDER_LINE_TARGET_COLOR = 0xea580c;
const CINDER_LINE_BURN_COLOR = 0x991b1b;
// cutting_room_charge (Zanretsu, Vault Phase 2 slice 4, 3 Sep 2026) — same
// filled-wash-while-armed treatment as CINDER_LINE_TARGET_COLOR, own hue: a
// cool steel blue-violet, distinct from every existing wash above including
// Cinder Line's own burnt orange (the two could plausibly be armed on
// different units in the same session, even if never on the SAME unit).
const CUTTING_ROOM_CHARGE_TARGET_COLOR = 0x6366f1;

// Migawari/lastword_signature (Vault Phase 2 slice 5, 3 Sep 2026) — a
// downed-ally target set, but a fundamentally bigger deal than
// fieldTriage's own cyan ("gets healed"): this one fully revives, and
// costs the WIELDER permanently. Emerald — reads as "restored to life,"
// distinct from every existing hue above.
const LAST_WORD_SIGNATURE_TARGET_COLOR = 0x10b981;
// Last Rites/lastword_last_rites (Vault Phase 2 slice 5, 3 Sep 2026) — also
// a downed-ally target set, own hue: amber, distinct from Migawari's own
// emerald just above (the two abilities are both on the same Heirloom and
// can both be armed in the same session, even if never on the same unit at
// once) — "one last flicker," not a full restoration.
const LAST_RITES_TARGET_COLOR = 0xfbbf24;
// Ledgerhall Static/seal_ledgerhall_static (Simulacrum/The Stolen Seal,
// Vault Phase 2 slice 6, 3 Sep 2026) — a HOSTILE target set, unlike every
// color above it (all downed-ally sets) — violet, distinct from
// attackable's red (this isn't a damage option) and from every other hue
// already claimed.
const LEDGERHALL_STATIC_TARGET_COLOR = 0x8b5cf6;
// Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md, built 4
// Sep 2026) — also a downed-ally, full-revive target set, same category as
// LAST_WORD_SIGNATURE_TARGET_COLOR's own emerald just above, but this is a
// purchased/logistics revive, not an Heirloom's personal-cost one — a
// distinct sky-blue reads as "called in," matching the "beacon"/signal
// framing, rather than reusing emerald and implying the same permanent-cost
// mechanic Migawari's own ability actually carries.
const BEACON_TARGET_COLOR = 0x38bdf8;
// requiem_severance (Gjallar, Vault Phase 2 slice 7, 3 Sep 2026) — a bone-
// white, deliberately unlike every warm hue claimed above (every existing
// target wash reads as "an ordinary tactical option," red/orange/pink/
// purple/indigo/emerald/amber): Requiem is the one attack in the game that
// hits its own side unconditionally, and its own tell on the board should
// look like nothing else here rather than borrow a color that already
// means "safe to click."
const REQUIEM_TARGET_COLOR = 0xfafaf9;
// abil_maser_lance (Tank's 3rd weapon branch, 5 Sep 2026) — this engine's
// first direction-picked strike that ISN'T Requiem (a hostile-and-friendly
// unconditional beam), so it needs its own tell rather than borrowing
// REQUIEM_TARGET_COLOR's deliberately "unlike anything else" bone-white,
// which that comment reserves for the one attack with no ally carve-out at
// all. A hot rose/crimson instead — reads as a heat weapon, distinct from
// attackable's red (0xef4444), Screen's pink (0xf472b6), and Deadfall's
// fuchsia (0xd946ef), the three nearest warm hues already in use.
const MASER_LANCE_TARGET_COLOR = 0xf43f5e;

// Right-hand panel layout. The log occupies the band between the HUD block
// and the contextual action bar; drawHud() budgets its lines against it.
//
// Bug fix, 27 Aug 2026 (Campaign Playtest Review — "the mission title line
// renders as 'Am' and then gets clipped by the floating '< mission select'
// button sitting on top of it. Never once saw the full title on screen.").
// Root cause, confirmed by reading the actual geometry rather than
// guessing: the back button below (`backBtn`, added after hudText so it
// draws on top per Phaser's default z-order) is a 200x26 rect centered at
// (835, 20) — i.e. it spans y=7 to y=33. hudText used to start at y=12,
// squarely inside that band, with the button's opaque fill covering
// everything past its own left edge (x=735) — hence "Am" and nothing
// after it. Moved below the button's bottom edge (33) with a small
// margin; was 12.
const HUD_TOP = 40;
const LOG_TOP = 336;
const LOG_BOTTOM = 505; // top edge of the action bar's upper row
// Wrapped-line metrics for the 230px-wide panel: ~7.2px/char at 12px
// monospace for the HUD, ~6px/char at 10px for the log.
const HUD_LINE_H = 15;
const HUD_CHARS_PER_LINE = 31;
const LOG_LINE_H = 13;
const LOG_CHARS_PER_LINE = 38;

// The contextual action bar (ability-depth pass): a grid of slots above END
// TURN, filled per selected unit with only the verbs that unit's kit
// actually contains. Grown from a 2x2 (4-slot) grid to 3x2 (6 slots) on
// abil_fire_support's own addition (25 Aug 2026, Mission 14 "Steel Rain")
// — a vibrissal Munti's kit (OVERWATCH + SCREEN + CLEAR + SWEEP, already
// four before this pass — the previous "widest kit is three" comment here
// undercounted Clear Bloom) hits FIVE the moment fire support's per-path
// unlock (data/campaignAmaranth.ts's FIRE_SUPPORT_UNLOCKS, granted to every
// path, not just one) reaches that same unit, and the old 4-slot pool
// silently dropped whichever entry availableActions() pushed last —
// exactly the FIRE button, on exactly the Munti this batch's own default
// squad deploys (Vashti, arch_munti_vibrissal). Caught by reasoning through
// the actual archetype data rather than assuming the file's own comment was
// still accurate. Three columns fit the same 720-950px right-panel width
// hudText/logText already use, so nothing else on this panel needed to
// move. Kept as a fixed pool of Phaser objects rather than created/
// destroyed per selection, so nothing leaks and render() stays a pure
// refresh.
const ACTION_SLOTS: Coord[] = [
  { x: 757, y: 524 },
  { x: 835, y: 524 },
  { x: 913, y: 524 },
  { x: 757, y: 560 },
  { x: 835, y: 560 },
  { x: 913, y: 560 },
];
const ACTION_SLOT_W = 70;
const ACTION_SLOT_H = 30;
/** Left inset where an action label starts, leaving the hotkey digit its own column. See the label's creation site in create(). */
const ACTION_LABEL_GUTTER = 13;
/**
 * Labels at or past this length drop a point of font size so they still fit
 * the button's remaining width. Monospace at 10px advances ~6px per
 * character, so 10 characters is 60px against the ~52px a 70px button has
 * left after the digit gutter and a right margin; at 9px it is ~54px, which
 * fits. checkActionBarPaging.mjs measures the real Phaser Text objects and
 * fails if any label still overruns its button, so this number is checked
 * rather than assumed.
 */
const ACTION_LABEL_LONG_CHARS = 10;

/**
 * The silhouettes drawUnit() ever draws. "blob" is now a true defensive
 * fallback only (a burrowed Undertow while hidden, or any archetype
 * missing a path/movementType) — Bloom units used to always render as
 * "blob" regardless of archetype; the five bloom_* kinds below replace
 * that with the Bloom Silhouette Doctrine's own movementType → shape rule
 * (claude/Bloom_Wars_Bloom_Silhouette_Doctrine_Proposal_v1.md, adopted
 * 27 Aug 2026 — "an automatic in," Maxime). Shared between the fill pass
 * and the outline helpers below it so both draw the exact same geometry.
 */
type SilhouetteKind = "blob" | "meeps" | "tank" | "reeps" | "munti" | "bloom_swarm" | "bloom_burrow" | "bloom_sessile" | "bloom_flight" | "bloom_limbless";

/**
 * BloomArchetype.movementType has six values (flight_membrane and
 * flight_spore both exist in data/types.ts) but the Doctrine proposal
 * itself only ever names five silhouette families — no archetype uses
 * flight_spore yet, and when one eventually does, it reads as the same
 * "airborne, ignores terrain" silhouette flight_membrane already gets,
 * not a sixth new shape. Folded here rather than in data/bloom.ts so that
 * file's own type keeps its real six values and this is the one place
 * that collapses them for rendering.
 */
function bloomSilhouetteKind(movementType: BloomArchetype["movementType"]): SilhouetteKind {
  switch (movementType) {
    case "swarm":
      return "bloom_swarm";
    case "burrow":
      return "bloom_burrow";
    case "sessile":
      return "bloom_sessile";
    case "flight_membrane":
    case "flight_spore":
      return "bloom_flight";
    case "limbless":
      return "bloom_limbless";
  }
}

/**
 * Set an action-bar label, dropping a point of size for the long ones so
 * they stay inside their 70px button. Both call sites in drawActionBar go
 * through here rather than calling setText directly, so the MORE button and
 * a verb can never end up with different sizing rules.
 */
function setActionLabel(text: Phaser.GameObjects.Text, value: string) {
  text.setFontSize(value.length >= ACTION_LABEL_LONG_CHARS ? 9 : 10);
  text.setText(value);
}

/** One entry in the contextual action bar. `usable` comes from the engine's own canX() predicate — this scene never re-derives one. */
interface ActionOption {
  label: string;
  usable: boolean;
  /** True when the verb ends the unit's turn (Overwatch/Ambush/Interdict), false when the unit keeps acting (Sweep/Screen). */
  endsTurn: boolean;
  run: () => void;
}

// Action-bar ability tooltips, 11 Sep 2026 (same playtest note as the
// WEAPON_BRANCHES import above: "found by accident that one of his units
// could heal"). Keyed by the option's own label with any "×N" charge count
// stripped off (stripActionChargeSuffix below) — a charge count changes
// mission to mission, the rule text under it never does, and keying on the
// live number would mean writing "SWEEP ×1" and "SWEEP ×2" as two separate
// entries for no reason.
//
// Every line here is transcribed from data/abilities.ts's own design
// comments (the authoritative cost/effect text for each ability, verified
// against engine/mission.ts's actual canX()/verb bodies where the two could
// have drifted — see the Missile/Maser Lance entries below) or from
// data/weaponBranches.ts's own description field where a verb is a weapon
// branch rather than a kit ability. Nothing here is invented flavor text —
// this project's own rule (Bloom_Wars_Combat_Worry_Lines_v1.md) is that
// Claude doesn't write character voice, and rules text isn't voice, but it
// still isn't a place to guess.
//
// Coverage note, updated 12 Sep 2026: this table originally covered only
// the base/universal kit (the ten verbs below). BEACON is now folded in
// here too (its label carries a live "×N" count stripped by
// stripActionChargeSuffix below, same as SWEEP/FIRE/MISSILE above, and it
// has no rank — company-wide equipment, not a Heirloom ability — so a
// flat string is the right shape for it same as everything else in this
// table). The 16 Heirloom-exclusive SIGNATURE verbs (IRON WORD, TRIAGE,
// PANOPTES, OVEREXTEND, OATHKEEPER, ICHIGEKI, SURTR, FIREBREAK, DRAFT,
// ZANRETSU, SURE FOOT, MIGAWARI, LAST RITES, SIMULACRUM, STATIC, GJALLAR)
// deliberately do NOT live in this table — they rank up (rank1 vs rank5
// text genuinely differs) and a flat string can't represent that. See
// HEIRLOOM_ABILITY_ID_BY_LABEL and heirloomAbilityTooltipBody() below,
// and actionSlotTooltipLines' own updated body, for how those are covered
// instead: keyed by ability id, composed live off the wielding unit's own
// heirloomAbilityRanks (BattleUnit's public field — the exact one
// Mission's private heirloomRank() reads internally, see
// engine/mission.ts's own heirloomRank()/canRequiemSeverance for that),
// so a rank1 wielder and a rank5 wielder of the same kit see accurate,
// different text rather than one guessed at.
const BASE_ABILITY_TOOLTIPS: Record<string, string> = {
  OVERWATCH: "Hold fire. Take one free shot at the first hostile that moves into your range and sight during the enemy phase. Costs your whole turn.",
  AMBUSH: "Vanish from enemy sight for 3 of your own turns — full movement and attacks while hidden. Breaks the moment you attack; that shot deals double damage. Costs your whole turn. Refused with a hostile already adjacent.",
  INTERDICT: "Until your next turn, any hostile that finishes a move within range and sight loses every remaining action — no damage dealt. Costs your whole turn. Unlimited uses.",
  TAUNT: "Forces every hostile that can see you to target and root against you until your next turn — no closing distance, no retargeting, no defence bonus for you. Costs your whole turn.",
  SCREEN: "You and allies within 1 tile vanish from enemy sight until their next turn. Breaks individually the moment any of you attacks. 1 action, doesn't end your turn. Once per mission.",
  CLEAR: "Instead of attacking, clear every Bloom-fouled tile in range back to plain ground, including your own. 1 action, doesn't end your turn. No limit.",
  SWEEP: "Reveals every living hostile in your vision (plus bonus) through walls and fog, for the rest of this turn and the enemy's next — including burrowed units, though it doesn't surface them. 1 action, doesn't end your turn.",
  FIRE: "Off-board strike on any tile in range — hostiles only, no friendly fire, no counter. Shared charge pool across your squad. Pick a tile to fire; ends your turn once it lands.",
  MISSILE: "Splash strike on any tile in range — hits every unit in the blast, friendlies included. Charges are per-unit. Pick a tile to fire; ends your turn once it lands.",
  "MASER LANCE": "Fires a widening cone in one of 8 directions from where you stand — friendly-fire capable, splash isn't dodgable. Charges are per-unit. Pick a direction to fire; ends your turn once it lands.",
  BEACON:
    "Revives one downed, not-permanently-lost ally in range (adjacent, or reachable-then-adjacent) — full HP, back on the field immediately. Burns one of this mission's beacon placements, one crate (their own Fabricator spare part first, a company crate otherwise), and one Restock Room charge — waived entirely if a living Munti is anywhere on the field. Needs the Beacon Control system, Restock Room, and Generator all built, and only fires from whoever currently holds Beacon Control. 1 action, doesn't end your turn. Also costs a slice of this mission's payout at Debrief.",
};

/** Strips a trailing " ×N" charge count off an action-bar label, so "SWEEP ×2"/"SWEEP ×1" and "BEACON ×2"/"BEACON ×1" all key against the same BASE_ABILITY_TOOLTIPS entry. */
function stripActionChargeSuffix(label: string): string {
  return label.replace(/\s*×\d+$/, "");
}

/**
 * Heirloom-exclusive signature-verb tooltips, 12 Sep 2026 — closes the
 * coverage gap BASE_ABILITY_TOOLTIPS' own header used to flag. Action-bar
 * label -> the ability's real id in data/heirlooms.ts, so
 * heirloomAbilityTooltipBody() below can pull that unit's live rank
 * (unit.heirloomAbilityRanks?.[id] ?? 1 — the exact same lookup
 * engine/mission.ts's private heirloomRank() does, just read from the
 * public field instead of through that private method) and pick the
 * matching rank1/rank5 text instead of a single flat string.
 */
const HEIRLOOM_ABILITY_ID_BY_LABEL: Record<string, string> = {
  "IRON WORD": "oath_iron_word",
  TRIAGE: "lastword_field_triage",
  PANOPTES: "farsight_signature",
  OVEREXTEND: "ledger_overextended",
  OATHKEEPER: "oath_oathkeeper",
  ICHIGEKI: "deadfall_strike",
  SURTR: "cinder_line_signature",
  FIREBREAK: "cinder_firebreak",
  DRAFT: "cinder_draft",
  ZANRETSU: "cutting_room_charge",
  "SURE FOOT": "cutting_room_sure_footing",
  MIGAWARI: "lastword_signature",
  "LAST RITES": "lastword_last_rites",
  SIMULACRUM: "seal_borrowed_authority",
  STATIC: "seal_ledgerhall_static",
  GJALLAR: "requiem_severance",
};

/**
 * Rank-aware tooltip body for one of the 16 Heirloom signature verbs above.
 * Every rank1/rank5 fact transcribed from that ability's own entry in
 * data/heirlooms.ts (id, rank1, rank5 fields — grep that file for the
 * ability id to check any of these against the source directly), cost/
 * turn-ending text cross-checked against this scene's own actionOptions
 * builder just above (`endsTurn` per verb — every one of these is `false`
 * except IRON WORD's `true`, so "costs the whole turn" is IRON WORD-only
 * and every other line reads "1 action, doesn't end your turn"), and
 * cooldownTurns values transcribed from the same heirlooms.ts entries.
 * GJALLAR is the one deliberate exception to "N-turn cooldown": Requiem
 * doesn't have one — SEVERANCE.maxCharge/chargePerTenHpDealt/
 * chargePerTenHpTaken (data/abilities.ts) back a shared 0-100 charge meter
 * instead, read live off `charge` (mission.getRequiemCharge(), the exact
 * public accessor whose own doc comment says it exists "for
 * scenes/Battle.ts's HUD meter and hover tip") so the tip explains why a
 * greyed GJALLAR button is greyed — not charged yet vs. no action left —
 * matching that button's own build-time comment ("the hover tip … is where
 * the player learns which").
 */
function heirloomAbilityTooltipBody(abilityId: string, rank: number, charge: number): string {
  const r5 = rank >= 5;
  switch (abilityId) {
    case "oath_iron_word":
      return `Forces every hostile that can reach the wielder within radius ${r5 ? 3 : 2} to target it this turn. Costs the whole turn. 3-turn cooldown.`;
    case "lastword_field_triage":
      return `Repairs ${r5 ? "three" : "two"} allies within radius ${r5 ? 3 : 2} this turn instead of the usual one. 1 action, doesn't end your turn. 3-turn cooldown.`;
    case "farsight_signature":
      return `Reveals every hostile unit on the map, burrowed included, for ${r5 ? "2 turns" : "1 turn"}. 1 action, doesn't end your turn. 5-turn cooldown.`;
    case "ledger_overextended":
      return `Trades all defense for ${r5 ? "2 turns" : "1 turn"} — 0 DEF, +40% ATK. 1 action, doesn't end your turn. 2-turn cooldown.`;
    case "oath_oathkeeper":
      return r5
        ? "Cannot be reduced below 1 HP for 3 turns. Every bit of damage that would have landed during that window hits all at once, halved, the instant it ends. 1 action, doesn't end your turn. 5-turn cooldown."
        : "Cannot be reduced below 1 HP for 2 turns. Every bit of damage that would have landed during that window hits all at once, in full, the instant it ends. 1 action, doesn't end your turn. 5-turn cooldown.";
    case "deadfall_strike":
      return r5
        ? "An unavoidable, uncounterable strike at double damage, any range. Reveals the wielder's exact position to every enemy, but the reveal is delayed a full turn instead of firing immediately — one free shot at real stealth per use. 1 action, doesn't end your turn. 5-turn cooldown."
        : "An unavoidable, uncounterable strike at double damage, any range — reveals the wielder's exact position to every enemy for the rest of the turn the instant it lands. 1 action, doesn't end your turn. 5-turn cooldown.";
    case "cinder_line_signature":
      return `Sets a chosen line of up to 5 tiles burning for ${r5 ? "4 turns" : "3 turns"} — 15 damage/turn to anything standing on it, hostile or friendly, no exception on the tiles themselves. 1 action, doesn't end your turn. 5-turn cooldown.`;
    case "cinder_firebreak":
      return r5
        ? "Instantly extinguishes one of the wielder's own active Surtr lines, and deals that line's entire remaining total damage to every hostile currently standing on it, all at once. 1 action, doesn't end your turn. 1-turn cooldown."
        : "Instantly extinguishes one of the wielder's own active Surtr lines. 1 action, doesn't end your turn. 1-turn cooldown.";
    case "cinder_draft":
      return `Allies moving through a friendly Surtr line take no burn damage from it for ${r5 ? "2 turns" : "1 turn"}. 1 action, doesn't end your turn. 3-turn cooldown.`;
    case "cutting_room_charge":
      return r5
        ? "Moves through and strikes every enemy in a straight line, ignoring terrain cost, ending adjacent to the last one hit. Full commitment — can't be called off partway through. Damage no longer falls off against the 3rd+ target hit. 1 action, doesn't end your turn. 4-turn cooldown."
        : "Moves through and strikes every enemy in a straight line, ignoring terrain cost, ending adjacent to the last one hit. Full commitment — can't be called off partway through. Damage falls off against the 3rd+ target hit. 1 action, doesn't end your turn. 4-turn cooldown.";
    case "cutting_room_sure_footing":
      return `Immune to knockback and forced movement for ${r5 ? "2 turns" : "1 turn"}. 1 action, doesn't end your turn. 2-turn cooldown.`;
    case "lastword_signature":
      return `Fully restores one downed ally mid-mission, no spare part spent — but permanently lowers the wielder's own max HP by ${r5 ? "5%" : "10%"} for the rest of the campaign, every single use. 1 action, doesn't end your turn. 6-turn cooldown.`;
    case "lastword_last_rites":
      return r5
        ? "A downed ally not yet lost to permadeath gets one final action this turn, fully healed first — then goes back down again afterward as normal; this doesn't save them permanently. 1 action, doesn't end your turn. 5-turn cooldown."
        : "A downed ally not yet lost to permadeath gets one final action this turn before actually going down. 1 action, doesn't end your turn. 5-turn cooldown.";
    case "seal_borrowed_authority":
      return r5
        ? "Next attack copies a random on-hit effect drawn from any Bloom archetype or House Amaranth unit fought this campaign — reroll the draw once before committing. 1 action, doesn't end your turn. 5-turn cooldown."
        : "Next attack copies a random on-hit effect drawn from any Bloom archetype or House Amaranth unit fought this campaign. 1 action, doesn't end your turn. 5-turn cooldown.";
    case "seal_ledgerhall_static":
      return r5
        ? "Jams the target's single strongest available ability specifically, no longer random, for 2 turns. 1 action, doesn't end your turn. 4-turn cooldown."
        : "Jams one random enemy ability for 2 turns. 1 action, doesn't end your turn. 4-turn cooldown.";
    case "requiem_severance":
      return `A fixed 8-tile line strike, ignoring terrain, hitting every unit on it — friend and foe alike, no exception. 80 damage, bypasses the normal full-HP damage cap (only matters against Bloom, whose Vitality it checks directly instead of going through Endurance). Needs the squad's own shared charge meter full (built from damage dealt AND taken) — currently ${charge}/100. Resets to 0 on use. Does not rank up.`;
    default:
      return "";
  }
}

export class Battle extends Phaser.Scene {
  private mission!: Mission;
  private tileSize = 32;
  private boardX = 16;
  private boardY = 60;
  private gfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  // Mission 1 tutorial hints (27 Aug 2026 — Onboarding_Tutorial_Plan_v1.md
  // §3's recommended shape: state-gated, Mission 1 only, reads state that
  // already exists rather than inventing any). tutorialActive is decided
  // once in create() (right mission + never seen before) and only ever
  // turns false from there, never re-checked mid-mission. The three "has"
  // flags are the one piece of new state this genuinely needs — a hint
  // must not reappear once demonstrated even if the player deselects or
  // the matching highlight set (reachable/attackable) is momentarily
  // empty, so "did this already happen" can't be read purely from current
  // selection state the way the hint's own trigger condition can.
  private tutorialActive = false;
  private tutorialHasSelected = false;
  private tutorialHasMoved = false;
  private tutorialHasAttacked = false;
  private tutorialSeenMarked = false; // guards markTutorialSeen() to a single call
  private tutorialText!: Phaser.GameObjects.Text;
  private selectedUnitId: string | null = null;
  private reachable: Coord[] = [];
  private attackable: BattleUnit[] = [];
  private repairable: BattleUnit[] = [];
  // Ability-depth pass (23 Aug 2026): the three new highlight sets, each
  // filled straight from the matching engine query and each empty whenever
  // the selected unit can't use that verb right now — the greying rule and
  // the highlight rule are therefore the same rule, asked once, in
  // engine/mission.ts.
  private sweepArea: Coord[] = [];
  private interdictZone: Coord[] = [];
  private screenable: BattleUnit[] = [];
  // Mission 5's rescue-and-recruit / Mission 3's clean-the-bloom-patch
  // passes (23 Aug 2026): rescuableNpc follows repairable's own shape
  // (click a highlighted unit); clearableBloom follows sweepArea/
  // interdictZone's shape (a preview of what a self-targeted action-bar
  // button would do, not a click target).
  private rescuableNpc: BattleUnit[] = [];
  private clearableBloom: Coord[] = [];
  // lastword_field_triage preview (Vault Phase 2, slice 1, 2 Sep 2026):
  // follows repairable's own shape (a set of units, not tiles) since it's
  // the same "will get healed" meaning as ordinary Repair, just self-
  // centered and multi-target — drawn with repairable's own color for that
  // reason rather than a new hue. Not a click target: the TRIAGE button
  // runs on press, same as screenable/clearableBloom's own sets above.
  private fieldTriageTargets: BattleUnit[] = [];
  // abil_fire_support (25 Aug 2026, Mission 14 "Steel Rain") — the one
  // action-bar verb that needs a genuine two-click flow instead of "click
  // the button, it runs": pressing FIRE arms fireSupportTargeting and fills
  // fireSupportRange (engine/mission.ts's getFireSupportAreaFrom) rather
  // than calling Mission.fireSupport() immediately, since the strike's
  // target is an arbitrary tile the player has to choose, not the caster's
  // own position or an adjacent unit. handleBoardClick's fire-support
  // branch has to run BEFORE the reachable/attackable/repairable checks —
  // the range this covers overlaps all three, and an armed strike should
  // win that click, not get reinterpreted as a move.
  private fireSupportTargeting = false;
  private fireSupportRange: Coord[] = [];
  // Walk animation (25 Aug 2026 — "the walk thing should be a feature like
  // xcom pause when the unit move. allowing you to have moment when the
  // board is in flux," Maxime). This is a deliberate, narrow exception to
  // this file's own header rule ("what's drawn is only ever a reflection
  // of that engine state"): mission.moveUnit() already commits the real
  // move instantly (unit.pos, actionsRemaining, zone events — all resolved
  // before the animation ever starts), and animatingVisualPos is a pure
  // rendering overlay on top of that — nothing else in the scene or engine
  // ever reads it, so it can't desync targeting, reachability, or combat.
  // It exists only so drawUnit() can draw ONE unit (animatingUnitId) a few
  // tile-widths behind where the engine already believes it is, for the
  // half-second or so it takes to visually step there.
  private animatingUnitId: string | null = null;
  private animatingVisualPos: { x: number; y: number } | null = null;
  // Input lock for the duration of a walk animation — handleBoardClick,
  // doEndTurn and runActionSlot all bail out early on this, the same way
  // they already bail out on `mission.outcome !== "ongoing"`. This is the
  // actual feature Maxime asked for (XCOM's own "board is in flux, you
  // can't act yet" beat), not just a side effect of the animation existing.
  private isAnimatingMove = false;
  // Enemy-phase playback (feature-gap report A4, 9 Sep 2026 — see
  // engine/mission.ts's HostilePhaseEvent for the full design). The engine
  // resolves the whole hostile phase synchronously the instant
  // confirmEndTurn() calls mission.endPlayerTurn(); this is what plays that
  // already-decided outcome back on screen afterward, reusing isAnimatingMove
  // as the SAME input lock a player's own walk uses (see animateWalk's
  // `manageLock` param) so nothing new has to re-teach handleBoardClick,
  // doEndTurn, cancelCurrent etc. to also check a second lock.
  //
  // isPlayingHostilePhase is a NARROWER flag than isAnimatingMove — it's
  // true only while THIS specific sequence is running, so keydown-SPACE can
  // tell "player is mid-own-move, ignore" (isAnimatingMove alone) apart from
  // "hostile phase is playing back, this press means skip" (this flag too).
  private isPlayingHostilePhase = false;
  private skipHostilePhasePlayback = false;
  // playAttackBeat's own transient flash — which unit, and what to draw at
  // its tile for the pause's duration. Cleared the instant the beat ends.
  private hostilePhaseFlashTarget: { unitId: string; result: "hit" | "dodge" | "kill" } | null = null;
  // Audio (A6, 9 Sep 2026) — the pilot-lost sting's own edge-triggered
  // latch. mission.permanentLosses only ever grows, never shrinks, so
  // "did it just grow since the last render() call" is a correct, single
  // choke point for firing this regardless of WHICH code path produced the
  // loss (a manual attack, an overwatch reaction, environmentStep — every
  // one of them already calls render() afterward). Reset in create() for
  // the same "scene instance is reused across mission launches" reason
  // flushCalendarTime/playAmbient reset their own per-mission state there.
  // Known simplification: two permanent losses landing in the SAME
  // hostile-phase resolution (mission.endPlayerTurn() resolves the whole
  // phase before playback's first render() call) plays the sting once, not
  // twice — accepted rather than built out for a case rare enough it's
  // not worth sequencing the sting to individual playback events for.
  private permanentLossesSeen = 0;
  // Audio (A6) — the mission-win sting's own once-only latch, same
  // edge-triggering reason as permanentLossesSeen above: drawOverlayIfNeeded
  // fully rebuilds the overlay (including this branch) on every render()
  // call once the mission has ended, and render() keeps getting called
  // afterward (mouse movement, etc.) — without this it would replay the
  // sting on every one of those. No equivalent latch for a loss/
  // commander_down ending: the report's own A6 scope asks for a
  // mission-WIN sting and a pilot-lost sting specifically, not a third one
  // for failure — see engine/mission.ts's permanentLosses for that half.
  private missionWinStingPlayed = false;
  // Mission real-time clock (25 Aug 2026) — wall-clock ms at BEAM DOWN, set
  // once in init(). See that method's own comment and
  // engine/campaignState.ts's "9. Mission real-time clock" section.
  private missionStartedAt = 0;
  // Calendar economy, 2 Sep 2026 — real play time accumulated in this battle,
  // in ms, flushed to the campaign calendar once on shutdown (see update()
  // and the shutdown handler in create()). Deliberately NOT derived from
  // missionStartedAt above: that's a wall-clock deadline stamp, and the
  // calendar wants time actually spent playing, not time elapsed while a tab
  // sat open. See engine/calendarClock.ts's creditRealMs comment for why
  // that distinction is worth a separate field rather than a subtraction.
  private calendarMsAccrued = 0;
  // Calendar economy, 2 Sep 2026 — `Date.now()` at the previous accrual tick;
  // 0 means no previous frame yet. See calendarClock.ts's measureRealDelta.
  private lastCalendarTickAt = 0;
  // Commander-down pass (25 Aug 2026) — guards applyCommanderDownAttempt so
  // it runs exactly once. drawOverlayIfNeeded() (below) is called from
  // every full-board redraw, not just the moment outcome first flips, so
  // without this flag a still-open commander_down overlay would clear +
  // save CampaignState's activeMissionAttempt on every single redraw while
  // the player just sits looking at it — harmless (clearing an
  // already-cleared field is a no-op) but a wasted localStorage write every
  // frame-equivalent, and not the once-per-outcome shape every other
  // CampaignState mutation in this codebase follows.
  private commanderDownAttemptCleared = false;
  // The contextual action bar's fixed slot pool, plus the options currently
  // bound to them. Whether a slot is usable is Mission's call (canX()),
  // never this scene's.
  private actionSlots: { btn: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; key: Phaser.GameObjects.Text }[] = [];
  private actionOptions: ActionOption[] = [];
  // Action-bar paging, 3 Sep 2026 (engine/actionBarPaging.ts — read that
  // file's header for the bug this closes). actionOptions above is the
  // unit's WHOLE kit; slotOptions is only what the six buttons are showing
  // right now, and it is what runActionSlot() indexes into. A null entry is
  // an empty slot; the MORE button is a slot index rather than an entry, so
  // that a page's last real action and MORE can never be confused for each
  // other by an off-by-one.
  private actionPage = 0;
  private slotOptions: (ActionOption | null)[] = [];
  private moreSlotIndex = -1;
  // Action-bar tooltip pass, 11 Sep 2026 — which slot (0-5) the pointer is
  // currently over, or null. Read fresh from slotOptions at hover time
  // (actionSlotTooltipLines below) rather than captured once, because
  // drawActionBar() relabels these same six button objects instead of
  // recreating them (see actionSlots' own field comment) — the option bound
  // to slot i changes under the pointer without it ever leaving the button.
  private hoveredActionSlot: number | null = null;
  /** Whose kit the bar is currently paged over. A change resets to page 1 — a player selecting a new unit should never land on that unit's page 2. */
  private actionBarUnitId: string | null = null;
  // Legibility pass, 1 Sep 2026 (claude/Bloom_Wars_First_Game_Dev_Feature_
  // Gap_Report_1Sep2026.md, items A1/A3/A8/C4/C5 — every one verified
  // absent in this file before being built):
  //   hoverTile — the board tile under the pointer, tracked by a pointermove
  //     listener; drives the combat forecast (A1), the hover-to-inspect
  //     block (C4) and the strike splash preview. Only ever triggers a
  //     render() when the TILE changes, never per pixel.
  //   forecastLabels — a fixed pool of Text objects (same accumulate-once
  //     discipline as actionSlots, see that field's own bug-history comment)
  //     for the damage number drawn over every attackable enemy while a
  //     unit is selected — Into the Breach's own "see the number before you
  //     commit" convention.
  //   missileTargeting/missileRange — abil_missile's two-click arm-then-tile
  //     flow (A8: the engine verb shipped 26 Aug with tests, the Reeps
  //     weapon branch grants it, and no button here ever offered it — a
  //     player who bought Missiles got nothing). Mirrors fireSupport's own
  //     pair above exactly; the two are never armed at once.
  //   endTurnPrompt — the "units still have actions" confirmation (A3).
  //     Under permadeath-by-default, an accidental Space with the Munti
  //     unmoved is a run-ender; XCOM's own prompt is the precedent.
  private hoverTile: Coord | null = null;
  // Cursor tip, 2 Sep 2026. hoverTile above still gates WHAT the tip says
  // (and still only re-renders the board on a real tile change); these two
  // track raw pixels, because the box itself has to follow the pointer
  // smoothly inside a tile rather than jumping tile-to-tile.
  private hoverTip: HoverTip | null = null;
  private pointerX = 0;
  private pointerY = 0;
  /** Vital Signs Uplink bought? Snapshotted per mission in init() — see there. */
  private vitalSignsUplink = false;
  private forecastLabels: Phaser.GameObjects.Text[] = [];
  private missileTargeting = false;
  private missileRange: Coord[] = [];
  // deadfall_strike (Ichigeki/Deadfall, Vault Phase 2 slice 2, 3 Sep 2026) —
  // a third arm-then-click flow, mirroring missileTargeting/missileRange's
  // own shape, except the click target is a UNIT anywhere visible on the
  // board rather than a tile in range: deadfallTargets is filled from
  // engine/mission.ts's getDeadfallStrikeTargetsFrom (every visible hostile,
  // not just this unit's own attackRange), and handleBoardClick's own
  // deadfall branch checks membership in it the same way the fire-support/
  // missile branches check their own tile sets.
  private deadfallTargeting = false;
  private deadfallTargets: BattleUnit[] = [];
  // cinder_line_signature (Surtr, Vault Phase 2 slice 3, 3 Sep 2026) — same
  // arm-then-click shape as fireSupportTargeting/fireSupportRange: SURTR's
  // button fills cinderLineArea from engine/mission.ts's
  // getCinderLineAreaFrom (every legal line-endpoint tile), and
  // handleBoardClick's own branch below checks membership in it the same
  // way the fire-support/missile branches check theirs.
  private cinderLineTargeting = false;
  private cinderLineArea: Coord[] = [];
  // cutting_room_charge (Zanretsu, Vault Phase 2 slice 4, 3 Sep 2026) — same
  // arm-then-click shape as cinderLineTargeting/cinderLineArea just above:
  // ZANRETSU's button fills cuttingRoomChargeArea from engine/mission.ts's
  // getCuttingRoomChargeAreaFrom (every legal line-endpoint tile — cardinal
  // only, not Cinder Line's 8-way set, see that method's own header), and
  // handleBoardClick's own branch below checks membership in it the same
  // way cinderLineArea's own branch does.
  private cuttingRoomChargeTargeting = false;
  private cuttingRoomChargeArea: Coord[] = [];
  // Vault Phase 2, slice 5 (3 Sep 2026) — Migawari's remaining 2 of 3
  // abilities. Both are click-a-UNIT flows, same shape as
  // deadfallTargeting/deadfallTargets above (a downed ally, not a visible
  // hostile, but the same "arm, then click a member of a precomputed
  // list" contract) — see engine/mission.ts's getLastWordSignatureTargetsFrom/
  // getLastRitesTargetsFrom for what fills each list.
  private lastWordSignatureTargeting = false;
  private lastWordSignatureTargets: BattleUnit[] = [];
  private lastRitesTargeting = false;
  private lastRitesTargets: BattleUnit[] = [];
  // Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md, built 4
  // Sep 2026) — same click-a-unit arm-then-click shape as
  // lastWordSignatureTargeting/lastRitesTargeting directly above (a downed
  // ally, range-limited — see engine/mission.ts's getBeaconTargetsFrom for
  // what fills this list and beaconTargetInRange for the range rule).
  private beaconTargeting = false;
  private beaconTargets: BattleUnit[] = [];
  // seal_ledgerhall_static (Simulacrum/The Stolen Seal, Vault Phase 2 slice
  // 6, 3 Sep 2026) — same click-a-unit arm-then-click shape as
  // deadfallTargeting/deadfallTargets above, except the target pool is
  // getLedgerhallStaticTargetsFrom (visible hostiles that actually have an
  // ability to jam), not downed allies. seal_borrowed_authority needs no
  // targeting state of its own — it's a self-only cast, same tier as
  // OATHKEEPER's own single-click button below, no arm/click flow at all.
  private ledgerhallStaticTargeting = false;
  private ledgerhallStaticTargets: BattleUnit[] = [];
  // requiem_severance (Gjallar, Vault Phase 2 slice 7, 3 Sep 2026) — same
  // arm-then-click shape as cinderLineTargeting/cinderLineArea above:
  // GJALLAR's button fills requiemDirectionTargets from engine/mission.ts's
  // getRequiemDirectionTargets (one representative tile per legal
  // direction), and handleBoardClick's own branch below checks whether the
  // clicked tile shares a direction with any of them the same way the
  // Cinder Line branch checks membership in cinderLineArea. Unlike Cinder
  // Line, requiemDirectionTargets is always at most 8 entries (one per
  // direction, not one per (direction, step) pair) — the line's LENGTH is
  // fixed (SEVERANCE.shape.length), never chosen by the click, so there's
  // nothing to enumerate per-step here.
  private requiemTargeting = false;
  private requiemDirectionTargets: Coord[] = [];
  // abil_maser_lance (Tank's 3rd weapon branch, 5 Sep 2026) — same
  // arm-then-click-a-direction shape as requiemTargeting/
  // requiemDirectionTargets directly above: TANK's MASER LANCE button fills
  // maserLanceDirectionTargets from engine/mission.ts's
  // getMaserLanceDirectionTargets (every in-bounds tile along each of the 8
  // legal directions, out to the board edge — the clickable set, not the
  // narrower actual cone footprint a given click resolves to), and
  // handleBoardClick's own branch checks membership in it the same way the
  // Gjallar branch checks requiemDirectionTargets.
  private maserLanceTargeting = false;
  private maserLanceDirectionTargets: Coord[] = [];
  private endTurnPrompt: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("Battle");
  }

  init(data: { missionId: string; selectedPilotIds?: string[] }) {
    const missionDef = MISSIONS_BY_ID[data.missionId] ?? Object.values(MISSIONS_BY_ID)[0];
    // builtBays (28 Aug 2026, Weapons Bay pass): read once here, same
    // "snapshot for the mission's lifetime" treatment the rest of this
    // constructor call already gets — a bay built mid-mission (it can't be,
    // since the CO build-request flow only runs in the Hub, but even so)
    // wouldn't retroactively arm a bonus charge on an in-progress mission.
    const campaignForMission = loadCampaignState();
    this.mission = new Mission(
      missionDef,
      this.resolveDeployRoster(missionDef.playerPilotIds, data.selectedPilotIds),
      campaignForMission?.builtBays ?? [],
      // Forward Battery (2 Sep 2026) reads this to widen the Fire Support
      // blast. Snapshotted with builtBays for the same reason, from the
      // same single load — this used to call loadCampaignState() twice in
      // this constructor, which was two reads of a store that could in
      // principle disagree.
      {
        builtModules: campaignForMission?.builtModules ?? [],
        // seal_borrowed_authority (Simulacrum/The Stolen Seal, Vault Phase 2
        // slice 6) — same "snapshot campaign state for this mission's
        // lifetime" read as builtBays/builtModules above, from the same
        // single loadCampaignState() call. See CampaignState.foughtOnHitEffectKinds'
        // own comment for the full design.
        foughtOnHitEffectKinds: campaignForMission?.foughtOnHitEffectKinds ?? [],
        // Beacon Control (4 Sep 2026) — same single-load snapshot as
        // builtBays/builtModules/foughtOnHitEffectKinds above, from the
        // same campaignForMission read. Absent (?? 0) on any save from
        // before this field existed, same "no stock" default
        // MissionOptions' own comment already explains.
        beaconCratesRemaining: campaignForMission?.beaconCrates ?? 0,
        beaconChargesRemaining: campaignForMission?.beaconCharges ?? 0,
        // Beacon Control's holder gate (6 Sep 2026 — see Mission.beaconHolderId's
        // own header): Rourke only, Captain or higher. Same single-load
        // snapshot as everything else in this options object, from the same
        // campaignForMission read. Absent (?? "2nd_lt") on any save from
        // before rourkeRank existed — the real starting rank, not a
        // placeholder, so an old save correctly starts Beacon locked out
        // rather than silently granted.
        rourkeRank: campaignForMission?.rourkeRank ?? "2nd_lt",
      }
    );
    // Vital Signs Uplink (2 Sep 2026, data/carrierModules.ts) — snapshotted
    // here for the same reason builtBays is on the line above: this is a
    // read of campaign state that must not change under a mission already
    // in progress. HUD-only, so unlike builtBays it isn't handed to the
    // Mission at all; nothing in the engine needs to know.
    this.vitalSignsUplink = (campaignForMission?.builtModules ?? []).includes("vitalSigns");
    this.selectedUnitId = null;
    this.clearSelectionHighlights();
    // Mission real-time clock (25 Aug 2026) — the HUD half of "add that
    // timer as something soldier keep track of," Maxime's own framing for
    // why this shouldn't be an invisible trap that only shows up as a
    // recall notice after the fact. TransporterPad.ts stamped
    // activeMissionAttempt.startedAt the instant BEAM DOWN fired; read the
    // same CampaignState independently here (this scene already does that
    // in resolveDeployRoster below, same pattern) rather than threading it
    // through scene data. Falls back to "now" — reading as a fresh clock,
    // not a crash — for the one case that field can legitimately be
    // missing: a scene started directly without going through
    // TransporterPad at all (resolveDeployRoster's own doc comment below
    // names this same case for selectedPilotIds).
    this.missionStartedAt = loadCampaignState()?.activeMissionAttempt?.startedAt ?? Date.now();
  }

  /**
   * Transporter-pad squad-selection pass (22 Aug 2026): turns the ids the
   * pad actually beamed down (`selectedPilotIds` — falls back to the
   * mission's own static roster when absent, e.g. a scene started directly
   * without going through TransporterPad) into the resolved
   * DeployRosterEntry[] Mission's constructor wants. Reads the same
   * CampaignState the pad itself read, independently — not trusting
   * anything serialized through scene data — so a live, campaign-persistent
   * pilot/mek copy (tier upgrades, mek secondaries) deploys correctly, and
   * so does a generated recruit (engine/campaignState.ts's generatePilot),
   * which data/pilotRegistry.ts's static findPilot() alone could never
   * resolve — see engine/units.ts's createPlayerUnit `overrides` doc
   * comment for the full reasoning.
   */
  private resolveDeployRoster(missionPilotIds: string[], selectedPilotIds?: string[]): DeployRosterEntry[] {
    const state = loadCampaignState() ?? createWardenCampaignState();
    const ids = selectedPilotIds ?? missionPilotIds;
    const roster: DeployRosterEntry[] = [];
    for (const pilotId of ids) {
      const entry = state.pilots[pilotId];
      if (entry) {
        roster.push({ pilotId, pilot: entry.pilot, mek: state.meks[entry.pilot.mekId] ?? findMek(entry.pilot.mekId) });
        continue;
      }
      // Defensive fallback only — shouldn't happen for a well-formed
      // selection (every deployable id comes from this same CampaignState),
      // but stays consistent with static-registry resolution rather than
      // silently dropping the pilot.
      const pilot = findPilot(pilotId);
      if (pilot) roster.push({ pilotId, pilot, mek: findMek(pilot.mekId) });
    }
    // Send-Off tactical payoff (2 Sep 2026) — CampaignState.preMissionSendOff
    // was a real, named hook left intentionally unconsumed by the crew-
    // interactions pass that added it; this is that consumption. Consumed on
    // THIS mission launch specifically, whether or not the sent-off pilot
    // actually made the deployed squad — the ritual happened right before
    // BEAM DOWN, so "the next mission" means this one, not a standing buff
    // that waits around for its pilot to eventually deploy. A pilot benched
    // this time simply loses the blessing, same as skipping a meal you were
    // handed — no error, no carry-over, matching how every other one-shot
    // Hub hook in this codebase (the Munti guarantee, bonus objectives)
    // resolves once against whatever state exists at the moment it fires.
    if (state.preMissionSendOff) {
      const target = roster.find((e) => e.pilotId === state.preMissionSendOff!.pilotId);
      if (target) target.sendOffBonus = true;
      state.preMissionSendOff = undefined;
      saveCampaignState(state);
    }
    // Vault Phase 2, slice 1 (2 Sep 2026) — the one currently-fielded
    // Heirloom (state.heirlooms.fielded, filtered through fieldedHeirloom's
    // own "does it still have a living holder" check) grants its wielder
    // the kit's ability ids at their current ranks. Read-only here: unlike
    // preMissionSendOff, nothing about fielding is consumed by deploying —
    // the same Heirloom stays fielded mission after mission until the
    // player benches or loses it (engine/heirlooms.ts's fieldHeirloom/
    // unfieldHeirloom own that, not this scene).
    const heirloomId = fieldedHeirloom(state);
    if (heirloomId) {
      const wielderId = Object.keys(state.pilots).find((pid) => heirloomForPilot(state, pid) === heirloomId);
      const target = wielderId ? roster.find((e) => e.pilotId === wielderId) : undefined;
      if (target) {
        const def = HEIRLOOMS[heirloomId];
        const ranks: Record<string, number> = {};
        for (const ability of def.abilities) ranks[ability.id] = abilityRank(state, heirloomId, ability.id);
        target.heirloomAbilityRanks = ranks;
      }
    }
    return roster;
  }

  /**
   * Calendar economy, 2 Sep 2026 — accumulate this battle's real play time.
   * Nothing else happens here; this scene is turn-based and has never needed
   * a frame loop, so this is the whole method on purpose.
   *
   * Accumulating into a field rather than calling tickCalendar directly:
   * unlike Hub.ts, this scene holds no live CampaignState, so a per-frame
   * tick would mean a localStorage round trip 60 times a second. Flushed once
   * in the shutdown handler below.
   */
  update() {
    // Wall-clock, not Phaser's `delta` — same reason as Hub.ts's own tick,
    // and it matters at least as much here: a battle is the frame-heaviest
    // scene in the game, so a smoothed delta would under-credit mission time
    // worst exactly where the player spends it. See calendarClock.ts's
    // measureRealDelta.
    const measured = measureRealDelta(this.lastCalendarTickAt, Date.now());
    this.lastCalendarTickAt = measured.at;
    this.calendarMsAccrued = accrueRealMs(this.calendarMsAccrued, measured.deltaMs);
  }

  /**
   * Calendar economy, 2 Sep 2026 — flush this battle's accumulated play time
   * into the campaign calendar, once, on the way out.
   *
   * On shutdown rather than piggybacking the Debrief handoff, deliberately:
   * `scene.start("Debrief")` is only ONE of the ways out of a battle (quitting
   * to the menu is another), and time played is time played regardless of
   * whether the mission resolved. Hooking the one transition would silently
   * drop a player's whole session if they backed out — and hooking shutdown
   * costs a single load/save on scene exit, which is nothing next to a
   * per-frame write.
   *
   * No double-count risk with Debrief: Debrief only ever adds the flat
   * MISSION_COMPLETION_DAY_COST, never this accrued time.
   */
  private flushCalendarTime(): void {
    if (this.calendarMsAccrued <= 0) return;
    const ms = this.calendarMsAccrued;
    // Zeroed before the write, not after: if anything below throws, the
    // worst case is losing this battle's time, never crediting it twice.
    this.calendarMsAccrued = 0;
    const state = loadCampaignState();
    if (!state) return;
    creditRealMs(state, ms);
    saveCampaignState(state);
  }

  create() {
    // Calendar economy, 2 Sep 2026 — see flushCalendarTime's own comment.
    // Registered per-create() because Phaser reuses this scene instance across
    // mission launches; SHUTDOWN's listener list is cleared between runs, so
    // this re-registers rather than stacking duplicates.
    this.calendarMsAccrued = 0;
    this.lastCalendarTickAt = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.flushCalendarTime());
    // Audio, "enough for EA" scope (A6, 9 Sep 2026) — battle's own ambient
    // loop, same registered-per-create()/stopped-on-SHUTDOWN shape as
    // flushCalendarTime right above (and for the same reason: this scene
    // instance is reused across mission launches).
    playAmbient(this, "battle");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopAmbient());
    this.permanentLossesSeen = this.mission.permanentLosses.length;
    this.missionWinStingPlayed = false;

    const m = this.mission.map;
    this.tileSize = Math.max(16, Math.min(Math.floor(700 / m.width), Math.floor(560 / m.height)));

    this.gfx = this.add.graphics();
    this.hudText = this.add.text(720, HUD_TOP, "", { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4", wordWrap: { width: 230 } });
    // Log starts below the HUD block. Nudged down from 300 when overwatch
    // added two more possible HUD lines — at 300 a selected overwatching
    // unit's status wrote straight over the top of the log.
    this.logText = this.add.text(720, LOG_TOP, "", { fontFamily: "monospace", fontSize: "10px", color: "#8a97a6", wordWrap: { width: 230 } });

    // Mission 1 tutorial hints — see the field comments for the state
    // machine. Scoped to Mission 1 by mission id (Muster is the doc's own
    // "designated tutorial mission," §1) and to a player who's never
    // finished the sequence before (hasSeenTutorial() — a flag outside
    // CampaignState entirely, see that function's own comment for why).
    // Reset every create() (this scene instance is reused across mission
    // launches, same as every other per-create() field in this file) —
    // otherwise a player who finished the sequence on an earlier Mission 1
    // attempt this session would carry tutorialHasSelected etc. into a
    // fresh one and see no hints at all, independent of hasSeenTutorial().
    // areTutorialHintsEnabled() added 8 Sep 2026 — the Options screen ON/OFF
    // switch; a player who's turned hints off never sees this sequence at
    // all, even on a browser that's never marked it seen.
    this.tutorialActive = this.mission.mission.id === "mission_amaranth_1" && !hasSeenTutorial() && areTutorialHintsEnabled();
    this.tutorialHasSelected = false;
    this.tutorialHasMoved = false;
    this.tutorialHasAttacked = false;
    this.tutorialSeenMarked = false;
    // Below the board, not the right-hand panel — genuinely empty screen
    // space at every board size Mission 1 can produce, and keeping it off
    // the panel means it never competes with the HUD/log's own layout
    // budget (fitLines' whole reason for existing). wordWrap matches the
    // board's own pixel width so a long line wraps instead of running
    // under the right panel.
    const boardBottom = this.boardY + m.height * this.tileSize;
    this.tutorialText = this.add
      .text(this.boardX + (m.width * this.tileSize) / 2, boardBottom + 14, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#facc15",
        align: "center",
        wordWrap: { width: m.width * this.tileSize },
      })
      .setOrigin(0.5, 0);

    // End turn, with the "units still have actions" check (1 Sep 2026,
    // feature-gap report A3). First press with unspent units up opens the
    // prompt; a second press (Space or the END TURN button) while it's open
    // confirms — so a player who meant it pays one extra keystroke, and a
    // player who fat-fingered Space with the Munti unmoved gets the turn
    // back. Nothing to confirm when every unit is spent: ends immediately,
    // exactly as before this pass.
    const doEndTurn = () => {
      if (this.mission.outcome !== "ongoing") return;
      if (this.isAnimatingMove) return; // board's mid-walk — same "can't act yet" beat as handleBoardClick
      if (this.endTurnPrompt) {
        this.confirmEndTurn();
        return;
      }
      const pending = this.unitsWithActionsLeft();
      if (pending.length > 0) {
        this.openEndTurnPrompt(pending);
        return;
      }
      this.confirmEndTurn();
    };
    const endTurnBtn = this.add
      .rectangle(835, 600, 200, 32, 0x2e5c7a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        // Audio (A6) — mouse click gets the UI-click sting the same way
        // makeShopButton's own click handler does (ShopPanel.ts); this
        // button and the action-bar's below are hand-rolled rather than
        // built through that shared helper, so each wires its own. SPACE's
        // own end-turn binding deliberately does NOT — a keyboard shortcut
        // isn't a "UI click."
        playSfx(this, "click");
        doEndTurn();
      });
    this.add.text(835, 600, "END TURN  [space]", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    endTurnBtn.setStrokeStyle(1, 0x4a7a9a);
    // [tab] next mech hint, same idea as "[space]" on the button above it —
    // a static label rather than a Mission 1 tutorial-flow hint (see
    // tutorialHasSelected's own comment block) since this one has no
    // natural one-shot trigger condition and is meant to just sit there as
    // a standing reminder, the same way a real XCOM HUD keeps its own
    // hotkey legend always on screen rather than teaching it once.
    // 2 Sep 2026 — widened from "[tab] next mech" to the full standing
    // legend now that there's more than one binding worth advertising.
    // Deliberately one line and abbreviated: the action digits already
    // print on their own buttons (drawActionBar), so this only has to
    // cover the bindings with nothing on screen to hang them off.
    this.add
      .text(835, 618, "[tab] next  [1-6] action  [esc] cancel", { fontFamily: "monospace", fontSize: "10px", color: "#8fb3c9" })
      .setOrigin(0.5);

    // Spacebar end-turn (XCOM's own binding — Maxime reached for it before
    // checking whether it existed). Explicit off() first: this scene's own
    // Scene instance is reused across mission launches (create() re-runs,
    // it isn't a fresh object — see the actionSlots/tabButtons comments
    // elsewhere in this file for the identical accumulation risk), so
    // without it a second mission launched in the same browser session
    // would stack a second listener and fire doEndTurn() twice per press.
    // addCapture stops the browser's own default (page scrolls on Space)
    // from firing alongside the game's own handler — otherwise every end
    // turn also jumps the page.
    this.input.keyboard?.addCapture("SPACE");
    this.input.keyboard?.off("keydown-SPACE");
    // Enemy-phase playback (9 Sep 2026): SPACE while the hostile phase is
    // playing back means "skip to the end," not "end turn" — the turn is
    // already over the instant confirmEndTurn() called endPlayerTurn(),
    // this playback is just the board catching the player's eye up to it.
    // Checked ahead of doEndTurn's own isAnimatingMove guard (which would
    // otherwise just silently eat the press, same as it does mid a
    // player's own walk) rather than folded into that guard, since the two
    // presses mean opposite things.
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.isPlayingHostilePhase) {
        this.skipHostilePhasePlayback = true;
        return;
      }
      doEndTurn();
    });

    // Tab-to-cycle (30 Aug 2026, Maxime: "we could prolly instil some kinda
    // way to mvoe easily between mech like in xcom") — same well, same
    // reflex as SPACE just above: XCOM's own Tab/Shift+Tab binding for
    // "next/previous soldier who still has actions left." Cycles only
    // units eligible to be selected by a click in the first place (the
    // exact same guard as the click-select branch below: side "player",
    // not downed/npcIncapacitated/isCivilian, actionsRemaining > 0 OR a
    // ready Field Doctor bonus — see that guard's own comment) — a unit
    // that's already spent its turn (and has no Field Doctor bonus left)
    // is skipped, same as XCOM greying out a soldier who's done. Order
    // follows mission.livingUnits()'s own order, which is deployment
    // order — stable across a turn, not re-sorted by position, so
    // repeated Tabs step through the squad the same way every time. No
    // selection yet -> starts at the first eligible unit; already at the
    // last eligible unit -> wraps around, same reason a modal loop beats
    // a dead end at either edge.
    const cycleSelectableUnit = (direction: 1 | -1) => {
      if (this.mission.outcome !== "ongoing") return;
      if (this.mission.phase !== "player") return;
      if (this.isAnimatingMove) return;
      const eligible = this.mission
        .livingUnits()
        .filter(
          (u) =>
            u.side === "player" &&
            !u.downed &&
            !u.npcIncapacitated &&
            !u.isCivilian &&
            (u.actionsRemaining > 0 || this.mission.fieldDoctorReady(u.instanceId))
        );
      if (eligible.length === 0) return;
      const currentIndex = this.selectedUnitId ? eligible.findIndex((u) => u.instanceId === this.selectedUnitId) : -1;
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + eligible.length) % eligible.length;
      const next = eligible[nextIndex];
      this.selectedUnitId = next.instanceId;
      this.tutorialHasSelected = true;
      this.recomputeSelectionHighlights(next.instanceId);
      this.render();
    };
    this.input.keyboard?.addCapture("TAB");
    this.input.keyboard?.off("keydown-TAB");
    this.input.keyboard?.on("keydown-TAB", (event: KeyboardEvent) => {
      cycleSelectableUnit(event.shiftKey ? -1 : 1);
    });

    // The contextual action bar. This replaced the single, always-present
    // OVERWATCH button (47ab304) when the ability-depth pass took the verb
    // count per unit from one to as many as three: a fixed row of every
    // ability in the game would have been mostly dead buttons for every
    // unit, so the bar is filled per selection from availableActions()
    // below with only the verbs the selected unit's kit actually contains.
    // Same visual language as the button it replaced — monospace label,
    // centred, on a plain rectangle in the existing panel blue, greyed to
    // the existing 0x1a2028/0x3a4552/#5a6572 when the engine says the verb
    // isn't usable right now.
    //
    // Bug fix (Maxime, 23 Aug 2026 — "mission 2 didn't have overwatch or
    // sweep or the ability", then mission 3 "didn't have ability eiter"):
    // create() runs again every time this scene is (re)started — once per
    // mission launched from MapSelect/TransporterPad in the same browser
    // session — and Phaser destroys every GameObject this scene owns on
    // the way out (Scenes.Systems#shutdown -> DisplayList#shutdown ->
    // list[i].destroy(true), confirmed against node_modules/phaser's own
    // source). `actionSlots` is a persistent array field, though, and
    // without the reset below each create() just PUSHED four more entries
    // onto it — so after mission 2's create() ran, index 0-3 were mission
    // 1's now-destroyed buttons and mission 2's real, live buttons sat at
    // 4-7. drawActionBar() (below) always writes to indices 0-3: it was
    // therefore calling .setText()/.setFillStyle() on dead GameObjects
    // every single render() from the second mission onward, which throws
    // inside Phaser's Text#updateText ("Cannot read properties of null
    // (reading 'drawImage')") — confirmed via a headless Playwright replay
    // of exactly this sequence (mission 1 -> mission select -> mission 2).
    // That exception aborted render() before it reached drawHud() below
    // drawActionBar() in the call order, which is also why the HUD panel's
    // unit-info lines and the log went blank alongside the action bar —
    // one root cause, not two. The fix is just making this the fresh-pool
    // reset every other per-create() field already gets via reassignment
    // (this.gfx, this.hudText, ...) — actionSlots is the one field on this
    // scene built by accumulation instead, and it needed the same
    // "current create() call owns this from scratch" treatment.
    this.actionSlots = [];
    for (let i = 0; i < ACTION_SLOTS.length; i++) {
      const p = ACTION_SLOTS[i];
      const btn = this.add
        .rectangle(p.x, p.y, ACTION_SLOT_W, ACTION_SLOT_H, 0x2e5c7a)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.runActionSlot(i))
        // Action-bar tooltip pass, 11 Sep 2026 — attached once, here, at
        // create() time, same as pointerdown just above; NOT re-attached by
        // drawActionBar() every relabel, since these are the same six
        // Rectangle objects for the scene's whole lifetime (see this loop's
        // own header comment on actionSlots being a per-create() reset).
        // The index `i` is the only thing captured — hoveredActionSlot just
        // records which slot, and actionSlotTooltipLines reads
        // this.slotOptions[i] live, so the tooltip always matches whatever
        // verb is CURRENTLY bound to this slot, not whatever was bound when
        // the pointer first arrived.
        .on("pointerover", () => {
          this.hoveredActionSlot = i;
          this.updateHoverTip();
        })
        .on("pointerout", () => {
          if (this.hoveredActionSlot === i) this.hoveredActionSlot = null;
          this.updateHoverTip();
        });
      btn.setStrokeStyle(1, 0x4a7a9a);
      // 10px, down from the 4-slot grid's 11px (25 Aug 2026, fire support's
      // 3x2 layout) — narrower 70px buttons need the extra margin so
      // "OVERWATCH"/"INTERDICT" (the longest labels, 9 characters) don't
      // crowd the button edge.
      // Left-aligned, starting after the hotkey digit's gutter (3 Sep 2026).
      // This used to be .setOrigin(0.5) — centred — with the digit drawn as
      // a separate object pinned to the same button's left edge, and the two
      // collided for any label of about eight characters or more. Not
      // hypothetical and not new: the shipping bar for a Munti carrying
      // Migawari reads "1OVERWATCH", "5MIGAWARI" and, worst of all,
      // "6LAST RITES" with the digit fused into the L so it scans as "BAST
      // RITES". Found by actually looking at a screenshot of the real bar
      // while verifying something else, which is the only way this class of
      // bug ever gets found — tsc, eslint and 1965 unit tests were all clean
      // through every frame of it. Giving the digit its own gutter and
      // letting the text start after it removes the overlap by construction
      // rather than by tuning a font size until it happens to fit; the
      // long-label size drop in drawActionBar() handles the remaining width.
      const label = this.add
        .text(p.x - ACTION_SLOT_W / 2 + ACTION_LABEL_GUTTER, p.y, "", { fontFamily: "monospace", fontSize: "10px", color: "#ffffff" })
        .setOrigin(0, 0.5);
      // Hotkey digit (2 Sep 2026) — pinned inside the button's left edge,
      // vertically centred, in a dimmer blue than the label so it reads as
      // chrome rather than part of the action's name. See drawActionBar.
      const key = this.add
        .text(p.x - ACTION_SLOT_W / 2 + 5, p.y, "", { fontFamily: "monospace", fontSize: "9px", color: "#8ab4d8" })
        .setOrigin(0, 0.5);
      this.actionSlots.push({ btn, label, key });
    }

    const backBtn = this.add
      .rectangle(835, 20, 200, 26, 0x1a2028)
      .setStrokeStyle(1, 0x3a4552)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MapSelect"));
    this.add.text(835, 20, "< mission select", { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6" }).setOrigin(0.5);
    void backBtn;

    this.overlay = this.add.container(0, 0).setVisible(false);
    // Per-create() resets for the legibility-pass fields (see their field
    // comments): the label pool and the prompt are rebuilt from scratch
    // each mission, same reason actionSlots is above.
    this.forecastLabels = [];
    this.endTurnPrompt = null;
    this.hoverTile = null;
    // Same reset, same reason (action-bar tooltip pass, 11 Sep 2026): a
    // scene restart rebuilds actionSlots' six buttons from scratch just
    // below, so a hoveredActionSlot left over from the previous mission's
    // last frame would point at a slot whose new button never got its own
    // pointerover yet — harmless once the pointer actually moves, but wrong
    // for however long the tip sat still first.
    this.hoveredActionSlot = null;
    // Rebuilt per create() like every other display object here — a scene
    // restart destroys the old one with the display list, so holding a
    // stale reference across missions would draw into a dead scene.
    this.hoverTip = new HoverTip(this);

    // Right-click = cancel (feature-gap report C5), same reflex Esc gets
    // below. disableContextMenu stops the browser's own menu from opening
    // over the canvas on that click. Left-click keeps its existing path.
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.cancelCurrent();
      else this.handleBoardClick(p.x, p.y);
    });
    // Hover tracking — the tile under the pointer, re-rendered only when it
    // actually changes tile (not per pixel), and only when something on
    // screen depends on it: a selected unit with attackable targets (the
    // forecast), an armed strike (the splash preview), or a visible unit
    // to inspect. Cheap either way; render() is already a full redraw on
    // every click.
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // Pixel position first, and unconditionally — the tip box follows the
      // cursor even while it stays inside one tile, which is the whole
      // point of it being at the cursor rather than in the side panel.
      this.pointerX = p.x;
      this.pointerY = p.y;
      const tile = this.pixelToTile(p.x, p.y);
      const same = (tile === null && this.hoverTile === null) || (tile !== null && this.hoverTile !== null && tile.x === this.hoverTile.x && tile.y === this.hoverTile.y);
      if (same) {
        // Same tile: content can't have changed, so this is a cheap
        // reposition, not a re-render.
        this.updateHoverTip();
        return;
      }
      this.hoverTile = tile;
      if (this.mission.outcome === "ongoing" && !this.isAnimatingMove) this.render();
      else this.updateHoverTip();
    });
    // Esc: close the end-turn prompt, else cancel an armed strike, else
    // deselect — the same escalation cancelCurrent() applies to right-click.
    // Explicit off() first for the same scene-reuse reason SPACE/TAB have.
    this.input.keyboard?.addCapture("ESC");
    this.input.keyboard?.off("keydown-ESC");
    this.input.keyboard?.on("keydown-ESC", () => this.cancelCurrent());

    // Action hotkeys, 2 Sep 2026 (Maxime: "add some natural keybinding for
    // the majority of action"). 1-6 fire the six action-bar slots — the
    // same runActionSlot() the buttons call, so a key can never do
    // something a click can't (including the guards runActionSlot already
    // has for a closed prompt, an unusable action, or an empty slot).
    //
    // Digits are the natural choice here for the same reason every tactics
    // game uses them: the bar is positional and already numbered on screen
    // now. The off()-before-on() and addCapture() both match the SPACE/TAB/
    // ESC bindings just above — off() because this scene is restarted
    // rather than recreated between missions (a missing off() is how you
    // end up firing an action once per mission played this session), and
    // addCapture() so the browser never steals the key.
    const digits = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"];
    this.input.keyboard?.addCapture(digits.join(","));
    digits.forEach((name, i) => {
      this.input.keyboard?.off(`keydown-${name}`);
      this.input.keyboard?.on(`keydown-${name}`, () => this.runActionSlot(i));
    });

    this.render();
  }

  /** Living player units that could still act this turn — the end-turn prompt's own question. */
  private unitsWithActionsLeft(): BattleUnit[] {
    return this.mission
      .livingUnits()
      .filter(
        (u) =>
          u.side === "player" &&
          !u.downed &&
          !u.npcIncapacitated &&
          !u.isCivilian &&
          (u.actionsRemaining > 0 || this.mission.fieldDoctorReady(u.instanceId))
      );
  }

  /**
   * Cancel whatever is "open" right now, most-transient first: the end-turn
   * prompt, then an armed Fire Support / Missile strike (back to the unit's
   * ordinary highlights, still selected), then the selection itself. One
   * escalation shared by Esc and right-click so the two never disagree.
   */
  private cancelCurrent() {
    if (this.mission.outcome !== "ongoing" || this.isAnimatingMove) return;
    if (this.endTurnPrompt) {
      this.closeEndTurnPrompt();
      this.render();
      return;
    }
    if (
      (this.fireSupportTargeting ||
        this.missileTargeting ||
        this.cinderLineTargeting ||
        this.cuttingRoomChargeTargeting ||
        this.lastWordSignatureTargeting ||
        this.lastRitesTargeting ||
        this.beaconTargeting ||
        this.requiemTargeting ||
        this.maserLanceTargeting) &&
      this.selectedUnitId
    ) {
      this.fireSupportTargeting = false;
      this.fireSupportRange = [];
      this.missileTargeting = false;
      this.missileRange = [];
      this.cinderLineTargeting = false;
      this.cinderLineArea = [];
      this.cuttingRoomChargeTargeting = false;
      this.cuttingRoomChargeArea = [];
      this.lastWordSignatureTargeting = false;
      this.lastWordSignatureTargets = [];
      this.lastRitesTargeting = false;
      this.lastRitesTargets = [];
      this.beaconTargeting = false;
      this.beaconTargets = [];
      this.requiemTargeting = false;
      this.requiemDirectionTargets = [];
      this.maserLanceTargeting = false;
      this.maserLanceDirectionTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
      this.render();
      return;
    }
    if (this.selectedUnitId) {
      this.selectedUnitId = null;
      this.clearSelectionHighlights();
      this.render();
    }
  }

  private openEndTurnPrompt(pending: BattleUnit[]) {
    if (this.endTurnPrompt) return;
    // Centred on the board, not the right panel — it has to be impossible
    // to miss, and the board is where the player's eyes already are. The
    // backdrop is interactive purely to swallow clicks meant for the board
    // underneath (Phaser only blocks click-through between interactive
    // objects, not by draw order — same lesson the Rec Room help panel
    // recorded); handleBoardClick/runActionSlot also bail while it's open.
    const cx = this.boardX + (this.mission.map.width * this.tileSize) / 2;
    const cy = this.boardY + (this.mission.map.height * this.tileSize) / 2;
    const names = pending.map((u) => u.displayName);
    const listed = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
    const bg = this.add.rectangle(cx, cy, 420, 130, 0x0c0f12, 0.94).setStrokeStyle(2, 0x4a7a9a).setInteractive();
    const title = this.add
      .text(cx, cy - 40, `${pending.length} unit${pending.length === 1 ? "" : "s"} can still act this turn`, { fontFamily: "monospace", fontSize: "14px", color: "#facc15" })
      .setOrigin(0.5);
    const who = this.add.text(cx, cy - 18, listed, { fontFamily: "monospace", fontSize: "11px", color: "#e8e2d4", wordWrap: { width: 390 }, align: "center" }).setOrigin(0.5);
    const yes = this.add
      .rectangle(cx - 90, cy + 32, 160, 30, 0x7a2430)
      .setStrokeStyle(1, 0xef4444)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.confirmEndTurn());
    const yesLabel = this.add.text(cx - 90, cy + 32, "END TURN ANYWAY", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" }).setOrigin(0.5);
    const no = this.add
      .rectangle(cx + 90, cy + 32, 160, 30, 0x2e5c7a)
      .setStrokeStyle(1, 0x4a7a9a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.closeEndTurnPrompt();
        this.render();
      });
    const noLabel = this.add.text(cx + 90, cy + 32, "KEEP PLAYING  [esc]", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" }).setOrigin(0.5);
    const hint = this.add.text(cx, cy + 56, "space again = end turn", { fontFamily: "monospace", fontSize: "10px", color: "#8a97a6" }).setOrigin(0.5);
    this.endTurnPrompt = this.add.container(0, 0, [bg, title, who, yes, yesLabel, no, noLabel, hint]);
  }

  private closeEndTurnPrompt() {
    if (!this.endTurnPrompt) return;
    this.endTurnPrompt.destroy(true);
    this.endTurnPrompt = null;
  }

  private confirmEndTurn() {
    this.closeEndTurnPrompt();
    this.selectedUnitId = null;
    this.clearSelectionHighlights();
    this.mission.endPlayerTurn();
    // Enemy-phase playback (feature-gap report A4, 9 Sep 2026): endPlayerTurn()
    // above already resolved the ENTIRE hostile phase — every move, every
    // attack, the environment step, the turn counter — before this line
    // runs; mission.hostilePhaseEvents is that phase's own chronological
    // record of it. playHostilePhase replays the record on screen and only
    // THEN calls render() with the final, already-decided state — see that
    // method's own comment for why the render has to wait rather than
    // firing immediately the way it used to.
    this.playHostilePhase(this.mission.hostilePhaseEvents, () => this.render());
  }

  private pixelToTile(px: number, py: number): Coord | null {
    const x = Math.floor((px - this.boardX) / this.tileSize);
    const y = Math.floor((py - this.boardY) / this.tileSize);
    if (x < 0 || y < 0 || x >= this.mission.map.width || y >= this.mission.map.height) return null;
    return { x, y };
  }

  private handleBoardClick(px: number, py: number) {
    if (this.mission.outcome !== "ongoing") return;
    if (this.mission.phase !== "player") return;
    // Walk animation lock (25 Aug 2026): the whole point of the feature is
    // a moment the player can't act in while the board's in flux, so every
    // click is ignored outright — not queued — until the current move
    // finishes playing out. See animatingUnitId's own field comment.
    if (this.isAnimatingMove) return;
    // End-turn prompt open (1 Sep 2026): the prompt's own buttons handle
    // themselves; every board click underneath it is swallowed until it's
    // answered — a modal, not a suggestion.
    if (this.endTurnPrompt) return;
    const tile = this.pixelToTile(px, py);
    if (!tile) return;

    const unitHere = this.mission.livingUnits().find((u) => u.pos.x === tile.x && u.pos.y === tile.y);

    // Cinder Line, armed (Surtr, Vault Phase 2 slice 3, 3 Sep 2026) —
    // checked first of all, ahead of Deadfall/missile/fire-support: its own
    // click target set (every legal line-endpoint tile) can overlap every
    // other set below (attackable, reachable, the other two strikes' own
    // ranges), and an armed line placement should win an ambiguous click
    // the same reason those three already do for each other.
    if (this.selectedUnitId && this.cinderLineTargeting) {
      if (this.cinderLineArea.some((c) => coordKey(c) === coordKey(tile))) {
        this.mission.cinderLineSignature(this.selectedUnitId, tile);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      // Clicked outside the legal endpoint set — cancel targeting, same
      // escape hatch every other armed-strike branch here uses, then fall
      // through to ordinary click handling on this same tile.
      this.cinderLineTargeting = false;
      this.cinderLineArea = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Gjallar, armed (requiem_severance, Vault Phase 2 slice 7, 3 Sep 2026)
    // — same "armed strike wins the click, checked ahead of every other
    // block" reasoning as Cinder Line's own comment just above. A click
    // matching requiemDirectionTargets fires the FULL fixed-length line in
    // that direction (mission.requiemSeverance), not just the clicked tile
    // — same "one click, engine resolves the whole affected set" contract
    // Cinder Line's own click branch uses.
    if (this.selectedUnitId && this.requiemTargeting) {
      if (this.requiemDirectionTargets.some((c) => coordKey(c) === coordKey(tile))) {
        this.mission.requiemSeverance(this.selectedUnitId, tile);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      // Clicked outside the legal direction set — cancel targeting, same
      // escape hatch every other armed-strike branch here uses, then fall
      // through to ordinary click handling on this same tile.
      this.requiemTargeting = false;
      this.requiemDirectionTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Maser Lance, armed (Tank's 3rd weapon branch, 5 Sep 2026) — same
    // "armed strike wins the click" reasoning as Gjallar's own block just
    // above, and the same shape: a click matching maserLanceDirectionTargets
    // resolves a direction and fires the FULL cone footprint in it
    // (mission.maserLanceStrike), not just the clicked tile.
    if (this.selectedUnitId && this.maserLanceTargeting) {
      if (this.maserLanceDirectionTargets.some((c) => coordKey(c) === coordKey(tile))) {
        this.mission.maserLanceStrike(this.selectedUnitId, tile);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      // Clicked outside the legal direction set — cancel targeting, same
      // escape hatch every other armed-strike branch here uses, then fall
      // through to ordinary click handling on this same tile.
      this.maserLanceTargeting = false;
      this.maserLanceDirectionTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Zanretsu, armed (cutting_room_charge, Vault Phase 2 slice 4, 3 Sep
    // 2026) — same "checked first, ahead of every other armed-strike
    // branch" shape Cinder Line's own block above just established, for the
    // identical reason: its click target set can overlap attackable/
    // reachable/every other strike's own range, and an armed charge should
    // win the click.
    if (this.selectedUnitId && this.cuttingRoomChargeTargeting) {
      if (this.cuttingRoomChargeArea.some((c) => coordKey(c) === coordKey(tile))) {
        this.mission.cuttingRoomCharge(this.selectedUnitId, tile);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      // Clicked outside the legal endpoint set — cancel targeting, same
      // escape hatch every other armed-strike branch here uses, then fall
      // through to ordinary click handling on this same tile.
      this.cuttingRoomChargeTargeting = false;
      this.cuttingRoomChargeArea = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Migawari (lastword_signature, Vault Phase 2 slice 5, 3 Sep 2026) —
    // checked next, same "armed strike wins the click" reasoning as every
    // block above. Matched by POSITION, not `unitHere`: the target is a
    // DOWNED ally, and `unitHere` above is deliberately derived from
    // livingUnits() (excludes downed units) — see that assignment's own
    // comment. Position match against the precomputed target list is the
    // same contract cinderLineArea/cuttingRoomChargeArea's own tile-set
    // checks already use, just against unit positions instead of a raw
    // coordinate set.
    if (this.selectedUnitId && this.lastWordSignatureTargeting) {
      const target = this.lastWordSignatureTargets.find((t) => coordKey(t.pos) === coordKey(tile));
      if (target) {
        this.mission.lastWordSignature(this.selectedUnitId, target.instanceId);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      this.lastWordSignatureTargeting = false;
      this.lastWordSignatureTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Last Rites (lastword_last_rites, Vault Phase 2 slice 5, 3 Sep 2026) —
    // same shape as Migawari's own block just above (a downed-ally target,
    // matched by position).
    if (this.selectedUnitId && this.lastRitesTargeting) {
      const target = this.lastRitesTargets.find((t) => coordKey(t.pos) === coordKey(tile));
      if (target) {
        this.mission.lastRites(this.selectedUnitId, target.instanceId);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      this.lastRitesTargeting = false;
      this.lastRitesTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md, built
    // 4 Sep 2026) — same shape as Migawari's/Last Rites' own blocks just
    // above (a downed-ally target, matched by position).
    if (this.selectedUnitId && this.beaconTargeting) {
      const target = this.beaconTargets.find((t) => coordKey(t.pos) === coordKey(tile));
      if (target) {
        this.mission.useBeaconControl(this.selectedUnitId, target.instanceId);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      this.beaconTargeting = false;
      this.beaconTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Deadfall Strike, armed (Ichigeki/Deadfall, Vault Phase 2 slice 2, 3
    // Sep 2026) — checked next, ahead of missile/fire-support (only Cinder
    // Line's own block above it now, added later — see that block's own
    // comment for why it claims the very first slot instead): its own
    // target set (any visible hostile, not just this unit's own attackRange)
    // can overlap the ordinary attackable set, and an armed strike should
    // win that click, not get reinterpreted as a normal Attack.
    if (this.selectedUnitId && this.deadfallTargeting) {
      if (unitHere && this.deadfallTargets.some((t) => t.instanceId === unitHere.instanceId)) {
        this.mission.deadfallStrike(this.selectedUnitId, unitHere.instanceId);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      // Clicked outside the target set — cancel targeting, same escape
      // hatch the fire-support/missile branches below use, then fall
      // through to the normal click handling below using this same tile.
      this.deadfallTargeting = false;
      this.deadfallTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Ledgerhall Static, armed (seal_ledgerhall_static, Vault Phase 2 slice
    // 6, 3 Sep 2026) — same shape as Deadfall Strike's own block just above:
    // a visible-hostile target set, checked ahead of the ordinary attackable
    // set so an armed jam wins the click.
    if (this.selectedUnitId && this.ledgerhallStaticTargeting) {
      if (unitHere && this.ledgerhallStaticTargets.some((t) => t.instanceId === unitHere.instanceId)) {
        this.mission.ledgerhallStatic(this.selectedUnitId, unitHere.instanceId);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      this.ledgerhallStaticTargeting = false;
      this.ledgerhallStaticTargets = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Missile, armed (1 Sep 2026, feature-gap report A8) — identical shape
    // to the fire-support branch right below it, checked first for the same
    // reason: the strike's tile set overlaps every other click target.
    if (this.selectedUnitId && this.missileTargeting) {
      if (this.missileRange.some((c) => coordKey(c) === coordKey(tile))) {
        this.mission.missileStrike(this.selectedUnitId, tile);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      this.missileTargeting = false;
      this.missileRange = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Fire support, armed (25 Aug 2026, Mission 14 "Steel Rain") — checked
    // FIRST, ahead of attack/repair/rescue/move: fireSupportRange overlaps
    // all of those (it's every tile in vision, occupied or not), and an
    // armed strike has to win an ambiguous click rather than silently
    // getting reinterpreted as a move onto the same tile.
    if (this.selectedUnitId && this.fireSupportTargeting) {
      if (this.fireSupportRange.some((c) => coordKey(c) === coordKey(tile))) {
        // Ends the turn itself here (mission.fireSupport already zeroed
        // actionsRemaining) — same shape as the attack branch just below,
        // not the stay-selected shape Repair/Rescue/Move use.
        this.mission.fireSupport(this.selectedUnitId, tile);
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.render();
        return;
      }
      // Clicked outside the strike radius — cancel targeting (an escape
      // hatch, same idea as clicking empty ground to deselect elsewhere in
      // this method) rather than leaving the board stuck mid-arm, then fall
      // through to the normal click handling below using this same tile —
      // restoring the selected unit's ordinary highlights first so a click
      // that lands on, say, an attackable enemy still resolves as an attack
      // in the same click instead of requiring a second one.
      this.fireSupportTargeting = false;
      this.fireSupportRange = [];
      this.recomputeSelectionHighlights(this.selectedUnitId);
    }

    // Attacking an enemy currently highlighted as attackable.
    if (this.selectedUnitId && unitHere && this.attackable.some((a) => a.instanceId === unitHere.instanceId)) {
      const outcome = this.mission.attack(this.selectedUnitId, unitHere.instanceId);
      // Audio (A6, 9 Sep 2026) — the player's own manual attack, resolved
      // synchronously right above, gets its hit/dodge/kill sting the
      // instant it lands rather than waiting for playAttackBeat, which is
      // enemy-phase-playback-only (see that method's own header — a
      // player's own click has no "board is in flux" replay to wait for).
      if (outcome) playSfx(this, outcome.defenderDowned ? "kill" : outcome.defenderDodged ? "dodge" : "hit");
      this.tutorialHasAttacked = true;
      this.selectedUnitId = null;
      this.clearSelectionHighlights();
      this.render();
      return;
    }

    // Repairing an ally in range (branch-aware, not just adjacent — see
    // engine/mission.ts's getRepairableFrom) currently highlighted as
    // repairable. Costs 1 action and doesn't end the turn (two-action house
    // rule, Maxime, 22 Aug 2026) — stay selected and recompute options if
    // the healer still has an action left, so a Munti can Repair a second
    // ally, or Repair then move.
    if (this.selectedUnitId && unitHere && this.repairable.some((a) => a.instanceId === unitHere.instanceId)) {
      this.mission.repairUnit(this.selectedUnitId, unitHere.instanceId);
      this.refreshSelectionAfterAction();
      this.render();
      return;
    }

    // Rescuing the downed NPC (Mission 5's rescue-and-recruit bonus
    // objective, 23 Aug 2026) — same shape as Repair above: costs 1 action,
    // doesn't end the turn, stays selected afterward.
    if (this.selectedUnitId && unitHere && this.rescuableNpc.some((a) => a.instanceId === unitHere.instanceId)) {
      this.mission.rescueUnit(this.selectedUnitId, unitHere.instanceId);
      this.refreshSelectionAfterAction();
      this.render();
      return;
    }

    // Moving the selected unit to a reachable tile. Costs 1 action and
    // doesn't end the turn — stay selected and recompute options once the
    // walk animation finishes, if the unit still has an action left
    // (double-move, or move-then-Repair).
    //
    // Walk animation (25 Aug 2026): getMovePath is called BEFORE moveUnit
    // on purpose, while the board is still in its pre-move state, so the
    // path matches exactly what moveUnit is about to compute internally
    // and commit instantly. The engine's own idea of the unit's position
    // is correct and final the moment moveUnit returns; only the DRAWING
    // lags behind it, on purpose, for the length of the animation — see
    // animatingUnitId's field comment for why that's safe.
    if (this.selectedUnitId && this.reachable.some((c) => coordKey(c) === coordKey(tile)) && !unitHere) {
      const walkUnitId = this.selectedUnitId;
      const walkPath = this.mission.getMovePath(walkUnitId, tile);
      this.mission.moveUnit(walkUnitId, tile);
      this.tutorialHasMoved = true;
      // Clear the reachable/attackable/etc. washes now rather than after
      // the animation — they were computed from the tile the unit is
      // about to leave, so leaving them up while it visibly walks away
      // from them would read as stale, not as "the board is in flux."
      // selectedUnitId itself is untouched, so the HUD panel keeps showing
      // this unit while it's mid-step.
      this.clearSelectionHighlights();
      if (walkPath && walkPath.length > 1) {
        this.animateWalk(walkUnitId, walkPath, () => {
          this.refreshSelectionAfterAction();
          this.render();
        });
      } else {
        // Defensive fallback only — getMovePath mirrors moveUnit's own
        // reachability check against the same, unchanged board state, so
        // this shouldn't actually happen. If it ever does, fall back to
        // the old instant behaviour rather than leaving the unit stuck
        // mid-selection with no path to animate.
        this.refreshSelectionAfterAction();
      }
      this.render();
      return;
    }

    // Selecting one of your own units. npcIncapacitated is excluded
    // (Mission 5's rescue-and-recruit pass) — the downed NPC is side
    // "player" so the fog-of-war/targeting code doesn't need to special-
    // case it, but it's not one of the deploying squad and was never meant
    // to be clickable as an actor; you interact with it only by walking an
    // actual pilot adjacent and using the Rescue click-target above.
    // !unitHere.isCivilian (Mission 31, 25 Aug 2026): same exclusion,
    // same reason as npcIncapacitated right above — on the board, at real
    // risk, but never one of the deploying squad. A civilian moves only
    // through its own escort AI (engine/ai.ts's decideCivilianAction),
    // never a click; its actionsRemaining is permanently 0 anyway (see
    // engine/units.ts's createCivilianUnit), so this guard is
    // defense-in-depth rather than the only thing stopping a select here.
    // actionsRemaining > 0 OR mission.fieldDoctorReady(...) (Field Doctor,
    // 1 Sep 2026): a Munti who's spent both actions still needs to be
    // selectable when their free Field Doctor Repair is off cooldown —
    // otherwise the branch's entire reason to exist (repairing after your
    // normal actions are gone) would be invisible to an actual click,
    // even though the engine underneath already allows it.
    if (
      unitHere &&
      unitHere.side === "player" &&
      !unitHere.downed &&
      !unitHere.npcIncapacitated &&
      !unitHere.isCivilian &&
      (unitHere.actionsRemaining > 0 || this.mission.fieldDoctorReady(unitHere.instanceId))
    ) {
      this.selectedUnitId = unitHere.instanceId;
      this.tutorialHasSelected = true;
      this.recomputeSelectionHighlights(unitHere.instanceId);
      this.render();
      return;
    }

    // Clicked empty/irrelevant ground — deselect.
    this.selectedUnitId = null;
    this.clearSelectionHighlights();
    this.render();
  }

  /**
   * XCOM-style walk animation (25 Aug 2026): "the walk thing should be a
   * feature like xcom pause when the unit move. allowing you to have
   * moment when the board is in flux" — Maxime, in response to the unit
   * jumping straight to its destination tile with nothing in between.
   *
   * Steps animatingVisualPos through every tile of `path` in order,
   * calling render() on each tween tick so drawUnit() draws the moving
   * unit a bit behind where the engine already committed it (see
   * animatingUnitId's own field comment — the engine's move already
   * happened; only this drawing lags). `isAnimatingMove` is what actually
   * blocks input for the duration — this method's only other job is
   * turning that lock off again and calling `onComplete` once the last
   * tile is reached.
   *
   * STEP_MS is a per-tile duration, not a total — a long move animates
   * longer than a short one, which is the "distance should look like
   * distance" behaviour XCOM itself has, rather than every move taking the
   * same total time regardless of how far it went.
   *
   * `manageLock` (enemy-phase playback, 9 Sep 2026) — defaults true, the
   * original behaviour: this call owns isAnimatingMove start-to-finish,
   * same as a player's own move always has. playHostilePhase() passes
   * false when it's sequencing several of these back-to-back (a hostile's
   * move, then maybe an attack beat, then the next hostile's move): the
   * LOCK should span the whole sequence, not blink off between events, so
   * the sequencer sets it once itself and this call only manages
   * animatingUnitId/animatingVisualPos for its own one leg.
   */
  private animateWalk(unitId: string, path: Coord[], onComplete: () => void, opts?: { manageLock?: boolean }) {
    const STEP_MS = 130;
    const manageLock = opts?.manageLock ?? true;
    if (manageLock) this.isAnimatingMove = true;
    this.animatingUnitId = unitId;
    const visual = { x: path[0].x, y: path[0].y };
    this.animatingVisualPos = visual;

    let i = 0;
    const stepToNext = () => {
      if (i >= path.length - 1) {
        if (manageLock) this.isAnimatingMove = false;
        this.animatingUnitId = null;
        this.animatingVisualPos = null;
        onComplete();
        return;
      }
      const to = path[i + 1];
      i++;
      this.tweens.add({
        targets: visual,
        x: to.x,
        y: to.y,
        duration: STEP_MS,
        ease: "Linear",
        onUpdate: () => this.render(),
        onComplete: stepToNext,
      });
    };
    stepToNext();
  }

  /**
   * Enemy-phase playback's own sequencer (feature-gap report A4). Steps
   * through one hostile phase's worth of HostilePhaseEvent in order, one at
   * a time — a "move" reuses animateWalk (manageLock: false, since this
   * method owns the lock for the whole sequence); an "attack" pauses and
   * flashes the defender via playAttackBeat. Both call `advance` when their
   * one event is done, which either starts the next or, once every event
   * has played (or a skip was requested), tears the lock down and hands
   * control back to `onDone` — confirmEndTurn's own final render(), which
   * is the first render() since the lock came down and so the first one
   * that can show a win/loss overlay for this turn.
   *
   * A unit not currently visible to the player (fog of war — see
   * visibleHostileIds()'s own comment) skips its move's tile-by-tile tween
   * entirely: there is nothing on screen to watch it walk across, so
   * animating it anyway would just be a dead pause. Its attack, if it has
   * one, still gets a beat — the flash lands on the defender, which is
   * always visible (a hostile can only ever be attacking a player unit, or
   * being reaction-fired at by one, and neither side hides a player unit
   * from itself).
   */
  private playHostilePhase(events: readonly HostilePhaseEvent[], onDone: () => void) {
    if (events.length === 0) {
      onDone();
      return;
    }
    this.isAnimatingMove = true;
    this.isPlayingHostilePhase = true;
    this.skipHostilePhasePlayback = false;

    let i = 0;
    const finish = () => {
      this.isAnimatingMove = false;
      this.isPlayingHostilePhase = false;
      this.skipHostilePhasePlayback = false;
      this.animatingUnitId = null;
      this.animatingVisualPos = null;
      this.hostilePhaseFlashTarget = null;
      onDone();
    };
    const advance = () => {
      if (this.skipHostilePhasePlayback || i >= events.length) {
        finish();
        return;
      }
      const ev = events[i];
      i++;
      if (ev.kind === "move") {
        const visible = this.visibleHostileIds().has(ev.unitId);
        if (!visible || ev.path.length < 2) {
          advance();
          return;
        }
        this.animateWalk(ev.unitId, ev.path, advance, { manageLock: false });
      } else {
        this.playAttackBeat(ev, advance);
      }
    };
    advance();
  }

  /**
   * One beat of enemy-phase playback: pause on the defender's tile with a
   * colored flash (hostilePhaseFlashTarget, read by render()'s own overlay
   * pass) so a hit registers as a moment rather than a number that just
   * appears in the log. No existing VFX to reuse here — moves already had
   * animateWalk, attacks had nothing before this. BEAT_MS is deliberately
   * shorter than a per-tile walk step: a hit is one moment, not a journey.
   */
  private playAttackBeat(event: Extract<HostilePhaseEvent, { kind: "attack" }>, onComplete: () => void) {
    const BEAT_MS = 260;
    const result: "hit" | "dodge" | "kill" = event.outcome.defenderDowned
      ? "kill"
      : event.outcome.defenderDodged
        ? "dodge"
        : "hit";
    this.hostilePhaseFlashTarget = { unitId: event.defenderId, result };
    playSfx(this, result);
    this.render();
    this.time.delayedCall(BEAT_MS, () => {
      this.hostilePhaseFlashTarget = null;
      onComplete();
    });
  }

  private clearSelectionHighlights() {
    this.reachable = [];
    this.attackable = [];
    this.repairable = [];
    this.sweepArea = [];
    this.interdictZone = [];
    this.screenable = [];
    this.rescuableNpc = [];
    this.clearableBloom = [];
    this.fieldTriageTargets = [];
    this.fireSupportTargeting = false;
    this.fireSupportRange = [];
    this.missileTargeting = false;
    this.missileRange = [];
    this.deadfallTargeting = false;
    this.deadfallTargets = [];
    this.cinderLineTargeting = false;
    this.cinderLineArea = [];
    this.cuttingRoomChargeTargeting = false;
    this.cuttingRoomChargeArea = [];
    this.lastWordSignatureTargeting = false;
    this.lastWordSignatureTargets = [];
    this.lastRitesTargeting = false;
    this.lastRitesTargets = [];
    this.beaconTargeting = false;
    this.beaconTargets = [];
    this.ledgerhallStaticTargeting = false;
    this.ledgerhallStaticTargets = [];
    this.requiemTargeting = false;
    this.requiemDirectionTargets = [];
    this.maserLanceTargeting = false;
    this.maserLanceDirectionTargets = [];
  }

  /**
   * Every "what can this unit do from where it stands" highlight set, in
   * one place. Each of the ability sets comes back empty from the engine
   * unless that verb is usable right now, so this scene never needs to know
   * a cooldown, an action cost, or a once-per-mission rule to decide what
   * to draw.
   */
  private recomputeSelectionHighlights(unitId: string) {
    // Fire support armed (25 Aug 2026): bail out before touching any other
    // highlight set. Without this guard, refreshSelectionAfterAction's call
    // into this method — which runs right after the FIRE button's own
    // run() arms targeting, since that option's endsTurn is false — would
    // immediately repopulate reachable/attackable/repairable/etc. from the
    // engine again, undoing the suppression that same run() just did and
    // leaving a confusing mix of washes on the board mid-targeting.
    if (
      this.fireSupportTargeting ||
      this.missileTargeting ||
      this.deadfallTargeting ||
      this.cinderLineTargeting ||
      this.cuttingRoomChargeTargeting ||
      this.lastWordSignatureTargeting ||
      this.lastRitesTargeting ||
      this.beaconTargeting ||
      this.ledgerhallStaticTargeting ||
      this.requiemTargeting ||
      this.maserLanceTargeting
    )
      return;
    const unit = this.mission.unitById(unitId);
    if (!unit) return;
    this.reachable = this.mission.getReachableTiles(unitId);
    this.attackable = this.filterToVisibleHostiles(this.mission.getAttackableFrom(unitId, unit.pos));
    this.repairable = this.mission.getRepairableFrom(unitId, unit.pos);
    this.sweepArea = this.mission.getSensorSweepAreaFrom(unitId, unit.pos);
    this.interdictZone = this.mission.getInterdictedTilesFrom(unitId, unit.pos);
    this.screenable = this.mission.getScreenableFrom(unitId, unit.pos);
    this.rescuableNpc = this.mission.getRescuableFrom(unitId, unit.pos);
    this.clearableBloom = this.mission.getClearableBloomFrom(unitId, unit.pos);
    this.fieldTriageTargets = this.mission.getFieldTriageTargetsFrom(unitId, unit.pos);
  }

  /**
   * After a Move, Repair, Sensor Sweep or Screen (the action-costing-but-
   * turn-continuing actions), keep the unit selected and refresh its
   * highlighted options if it still has an action left; otherwise deselect.
   * Attack, Overwatch, Ambush and Interdict all empty actionsRemaining
   * themselves and are handled by runActionSlot/handleBoardClick instead.
   * actionsRemaining > 0 OR mission.fieldDoctorReady(...) (Field Doctor,
   * 1 Sep 2026, same reasoning as the two selection guards above): without
   * this, a Munti who spends their last normal action on a Move would get
   * silently deselected one action before their free Field Doctor Repair
   * ever became visible, forcing an extra re-click to reach it.
   */
  private refreshSelectionAfterAction() {
    const unit = this.selectedUnitId ? this.mission.unitById(this.selectedUnitId) : undefined;
    if (unit && !unit.downed && (unit.actionsRemaining > 0 || this.mission.fieldDoctorReady(unit.instanceId))) {
      this.recomputeSelectionHighlights(unit.instanceId);
    } else {
      this.selectedUnitId = null;
      this.clearSelectionHighlights();
    }
  }

  /**
   * The verbs the selected unit's kit contains, in a stable order, each
   * carrying the engine's own verdict on whether it's usable right now.
   * Deliberately lists everything the unit HAS rather than only what it can
   * do this instant, and greys the rest: a bar whose buttons appear and
   * disappear as actions are spent is much harder to learn than one whose
   * buttons go dim, and greying-not-hiding is the precedent the single
   * OVERWATCH button already set.
   */
  private availableActions(): ActionOption[] {
    const id = this.selectedUnitId;
    if (!id || this.mission.phase !== "player" || this.mission.outcome !== "ongoing") return [];
    const unit = this.mission.unitById(id);
    if (!unit) return [];
    const m = this.mission;
    const out: ActionOption[] = [];

    out.push({ label: "OVERWATCH", usable: m.canEnterOverwatch(id), endsTurn: true, run: () => void m.enterOverwatch(id) });

    if (unit.abilities.includes("abil_ambush")) {
      out.push({ label: "AMBUSH", usable: m.canAmbush(id), endsTurn: true, run: () => void m.ambush(id) });
    }
    if (unit.abilities.includes("abil_interdict")) {
      out.push({ label: "INTERDICT", usable: m.canInterdict(id), endsTurn: true, run: () => void m.interdict(id) });
    }
    if (unit.abilities.includes("abil_taunt")) {
      out.push({ label: "TAUNT", usable: m.canTaunt(id), endsTurn: true, run: () => void m.taunt(id) });
    }
    if (unit.abilities.includes("abil_screen")) {
      out.push({ label: "SCREEN", usable: m.canScreen(id), endsTurn: false, run: () => void m.screenAllies(id) });
    }
    if (unit.abilities.includes("abil_clear_bloom")) {
      out.push({ label: "CLEAR", usable: m.canClearBloom(id), endsTurn: false, run: () => void m.clearBloom(id) });
    }
    if (unit.abilities.includes("abil_sensor_sweep")) {
      // The only label that carries a number: a budget the player can't
      // see is a budget they'll spend by accident.
      const charges = m.sensorSweepChargesRemaining(id);
      out.push({ label: `SWEEP ×${charges}`, usable: m.canSensorSweep(id), endsTurn: false, run: () => void m.sensorSweep(id) });
    }
    if (unit.abilities.includes("abil_fire_support")) {
      // fireSupportChargesRemaining is squad-wide, not per-unit (unlike
      // Sweep's own ×N above) — every eligible unit's button shows the same
      // number for that reason, and the HUD legend line (see the "Amber
      // tiles" text below) spells out "shared" so the number doesn't read
      // as a personal allowance. run() arms targeting rather than calling
      // Mission.fireSupport() directly — see fireSupportTargeting's own
      // field comment for why this one verb needs a second click.
      const charges = m.fireSupportChargesRemaining;
      out.push({
        label: `FIRE ×${charges}`,
        usable: m.canFireSupport(id),
        endsTurn: false,
        run: () => {
          this.fireSupportTargeting = true;
          this.fireSupportRange = m.getFireSupportAreaFrom(id, unit.pos);
          // Suppress every other highlight while armed — reachable/
          // attackable/repairable all overlap fireSupportRange (it's every
          // tile in vision, occupied or not) and refreshSelectionAfterAction
          // (called right after run() returns, since this option's own
          // endsTurn is false) would otherwise repopulate them straight
          // back, leaving a confusing mix of washes on the board during
          // what is otherwise a locked-in two-click sequence.
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    if (unit.abilities.includes("abil_missile")) {
      // abil_missile (1 Sep 2026, feature-gap report A8) — the Reeps
      // weapon-branch splash. Per-unit charges (unlike FIRE's shared pool),
      // and it hits friendlies, which the HUD legend says in as many words
      // while it's armed. Same arm-then-click-tile flow as FIRE above; the
      // splash preview on hover (drawHud/render) is where a player sees
      // exactly who's inside the blast before committing.
      const charges = m.missileChargesRemaining(id);
      out.push({
        label: `MISSILE ×${charges}`,
        usable: m.canMissileStrike(id),
        endsTurn: false,
        run: () => {
          this.missileTargeting = true;
          this.missileRange = m.getMissileAreaFrom(id, unit.pos);
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    if (unit.abilities.includes("abil_maser_lance")) {
      // abil_maser_lance (Tank's 3rd weapon branch, 5 Sep 2026) — same
      // per-unit-charges shape as MISSILE just above, but an arm-then-
      // click-a-DIRECTION flow (mirrors GJALLAR below), not arm-then-click-
      // a-tile: run() fills maserLanceDirectionTargets, not a range.
      const charges = m.maserLanceChargesRemaining(id);
      out.push({
        label: `MASER LANCE ×${charges}`,
        usable: m.canMaserLanceStrike(id),
        endsTurn: false,
        run: () => {
          this.maserLanceTargeting = true;
          this.maserLanceDirectionTargets = m.getMaserLanceDirectionTargets(id);
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    // Vault Phase 2, slice 1 (2 Sep 2026) — the four Heirloom abilities that
    // need a player-facing button (salt_root_salt is passive and never
    // shows here — see engine/combat.ts's saltRootMultiplier instead). No
    // "arm targeting" flow for any of these, unlike FIRE/MISSILE above:
    // none of them target a tile. Iron Word and Ledger Overextended are
    // self-only postures (same shape as OVERWATCH/TAUNT's own buttons);
    // Field Triage and Farsight Signature are self-centered radius/global
    // effects (same shape as SCREEN/SWEEP's own buttons).
    if (unit.abilities.includes("oath_iron_word")) {
      out.push({ label: "IRON WORD", usable: m.canIronWord(id), endsTurn: true, run: () => void m.ironWord(id) });
    }
    if (unit.abilities.includes("lastword_field_triage")) {
      out.push({ label: "TRIAGE", usable: m.canFieldTriage(id), endsTurn: false, run: () => void m.fieldTriage(id) });
    }
    if (unit.abilities.includes("farsight_signature")) {
      out.push({ label: "PANOPTES", usable: m.canFarsightSignature(id), endsTurn: false, run: () => void m.farsightSignature(id) });
    }
    if (unit.abilities.includes("ledger_overextended")) {
      out.push({ label: "OVEREXTEND", usable: m.canLedgerOverextended(id), endsTurn: false, run: () => void m.ledgerOverextended(id) });
    }
    // Vault Phase 2, slice 2 (3 Sep 2026) — the two more Heirloom
    // abilities that need a player-facing button (ledger_entry is passive,
    // same carve-out as salt_root_salt just above — see engine/combat.ts's
    // ledgerEntryMultiplier instead). Oathkeeper is a self-only posture,
    // same shape as OVEREXTEND's own button just above; Deadfall Strike is
    // the one genuinely new flow here — it arms a click-a-unit targeting
    // mode, same two-click shape as FIRE/MISSILE above except the target
    // pool is a set of UNITS (getDeadfallStrikeTargetsFrom), not tiles.
    if (unit.abilities.includes("oath_oathkeeper")) {
      out.push({ label: "OATHKEEPER", usable: m.canOathkeeper(id), endsTurn: false, run: () => void m.oathkeeper(id) });
    }
    if (unit.abilities.includes("deadfall_strike")) {
      out.push({
        label: "ICHIGEKI",
        usable: m.canDeadfallStrike(id),
        endsTurn: false,
        run: () => {
          this.deadfallTargeting = true;
          this.deadfallTargets = m.getDeadfallStrikeTargetsFrom(id);
          // Suppress every other highlight while armed — same reasoning as
          // FIRE/MISSILE's own run() just above: refreshSelectionAfterAction
          // runs right after this (endsTurn is false) and would otherwise
          // repopulate reachable/attackable/etc. straight back.
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    // Vault Phase 2, slice 3 (3 Sep 2026) — Surtr's full 3-ability kit.
    // SURTR itself arms a click-a-tile targeting mode, the fourth of this
    // shape after FIRE/MISSILE/ICHIGEKI (see cinderLineTargeting's own field
    // comment) — its target set is every legal line endpoint
    // (getCinderLineAreaFrom), not the unit's own attackRange. Firebreak and
    // Draft are both self-only, one-action postures with no targeting step
    // of their own, same shape as OATHKEEPER's button just above.
    if (unit.abilities.includes("cinder_line_signature")) {
      out.push({
        label: "SURTR",
        usable: m.canCinderLineSignature(id),
        endsTurn: false,
        run: () => {
          this.cinderLineTargeting = true;
          this.cinderLineArea = m.getCinderLineAreaFrom(id, unit.pos);
          // Suppress every other highlight while armed — same reasoning as
          // FIRE/MISSILE/ICHIGEKI's own run() above.
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    if (unit.abilities.includes("cinder_firebreak")) {
      out.push({ label: "FIREBREAK", usable: m.canFirebreak(id), endsTurn: false, run: () => void m.firebreak(id) });
    }
    if (unit.abilities.includes("cinder_draft")) {
      out.push({ label: "DRAFT", usable: m.canDraft(id), endsTurn: false, run: () => void m.draft(id) });
    }
    // Vault Phase 2, slice 4 (3 Sep 2026) — Zanretsu's full 3-ability kit.
    // ZANRETSU itself arms a click-a-tile targeting mode, same shape as
    // SURTR's own button above — its target set is every legal line
    // endpoint (getCuttingRoomChargeAreaFrom), cardinal only. Sure Footing
    // is a self-only, one-action posture with no targeting step, same
    // shape as OATHKEEPER/FIREBREAK/DRAFT above. cutting_room_momentum has
    // no button at all — it isn't separately activated, see
    // BattleUnit.momentumPending's own comment.
    if (unit.abilities.includes("cutting_room_charge")) {
      out.push({
        label: "ZANRETSU",
        usable: m.canCuttingRoomCharge(id),
        endsTurn: false,
        run: () => {
          this.cuttingRoomChargeTargeting = true;
          this.cuttingRoomChargeArea = m.getCuttingRoomChargeAreaFrom(id, unit.pos);
          // Suppress every other highlight while armed — same reasoning as
          // every other armed-strike button above.
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    if (unit.abilities.includes("cutting_room_sure_footing")) {
      out.push({
        label: "SURE FOOT",
        usable: m.canCuttingRoomSureFooting(id),
        endsTurn: false,
        run: () => void m.cuttingRoomSureFooting(id),
      });
    }
    // Vault Phase 2, slice 5 (3 Sep 2026) — Migawari's remaining 2 of 3
    // abilities. Both arm a click-a-UNIT targeting mode, same shape as
    // ICHIGEKI's own button above except the target pool is a set of
    // DOWNED allies (getLastWordSignatureTargetsFrom / getLastRitesTargetsFrom),
    // not visible hostiles. lastword_field_triage (TRIAGE, above) is
    // unrelated and untouched.
    if (unit.abilities.includes("lastword_signature")) {
      out.push({
        label: "MIGAWARI",
        usable: m.canLastWordSignature(id),
        endsTurn: false,
        run: () => {
          this.lastWordSignatureTargeting = true;
          this.lastWordSignatureTargets = m.getLastWordSignatureTargetsFrom(id);
          // Suppress every other highlight while armed — same reasoning as
          // every other armed-strike button above.
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    if (unit.abilities.includes("lastword_last_rites")) {
      out.push({
        label: "LAST RITES",
        usable: m.canLastRites(id),
        endsTurn: false,
        run: () => {
          this.lastRitesTargeting = true;
          this.lastRitesTargets = m.getLastRitesTargetsFrom(id);
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    // Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md, built
    // 4 Sep 2026, holder rule changed 6 Sep 2026) — deliberately NOT gated
    // by unit.abilities.includes(...) like every other button in this list:
    // ownership is computed live by engine/mission.ts's beaconHolderId(),
    // not tagged onto a fixed archetype/Heirloom kit. That method now
    // returns Rourke specifically, gated by her own campaign rank (Captain
    // or higher) — see its own header for why this replaced the original
    // "whichever pilot holds the highest gear tier" rule. Shown only on the
    // current holder's own action bar — canPlaceBeacon(id) already fails
    // for anyone else, but checking id === m.beaconHolderId() here too
    // avoids drawing a permanently-greyed-out button on every OTHER unit's
    // bar for a mission that has no stock/bays/holder at all.
    if (id === m.beaconHolderId()) {
      out.push({
        label: `BEACON ×${m.beaconsRemaining}`,
        usable: m.canPlaceBeacon(id),
        endsTurn: false,
        run: () => {
          this.beaconTargeting = true;
          this.beaconTargets = m.getBeaconTargetsFrom(id);
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    // Vault Phase 2, slice 6 (3 Sep 2026) — Simulacrum's full 3-ability kit
    // (stolen_seal/The Stolen Seal). seal_inherited_weight is passive
    // (rolled once at mission start, engine/mission.ts's
    // rollInheritedWeight()) — same no-button carve-out as ledger_entry/
    // salt_root_salt above. seal_borrowed_authority is self-only, same
    // single-click shape as OATHKEEPER's own button above (no arm/click
    // flow — its rank5 reroll is resolved internally, see
    // Mission.sealBorrowedAuthority's own header for why). seal_ledgerhall_static
    // is a click-a-hostile flow, same shape as ICHIGEKI's own button above.
    if (unit.abilities.includes("seal_borrowed_authority")) {
      out.push({
        label: "SIMULACRUM",
        usable: m.canSealBorrowedAuthority(id),
        endsTurn: false,
        run: () => void m.sealBorrowedAuthority(id),
      });
    }
    if (unit.abilities.includes("seal_ledgerhall_static")) {
      out.push({
        label: "STATIC",
        usable: m.canLedgerhallStatic(id),
        endsTurn: false,
        run: () => {
          this.ledgerhallStaticTargeting = true;
          this.ledgerhallStaticTargets = m.getLedgerhallStaticTargetsFrom(id);
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    // requiem_severance (Gjallar, Vault Phase 2 slice 7, 3 Sep 2026) — same
    // arm-then-click-a-direction shape as SURTR/ZANRETSU above, gated on
    // this SAME uniform `unit.abilities.includes(...)` convention every
    // other button here uses (see engine/mission.ts's own Requiem section
    // header, FLAGGED ASSUMPTION #1, for why "any own unit" from the GDD
    // text is read as "the ordinary selected unit," not a second unit-pick
    // step). `usable` folds in BOTH gates — the shared charge meter being
    // full AND this specific unit still having an action — so the button
    // greys out for the mundane reason (already acted) exactly the same way
    // it greys out for the dramatic one (not charged yet); the hover tip
    // (see drawHud below) is where the player learns which.
    if (unit.abilities.includes("requiem_severance")) {
      out.push({
        label: "GJALLAR",
        usable: m.canRequiemSeverance(id),
        endsTurn: false,
        run: () => {
          this.requiemTargeting = true;
          this.requiemDirectionTargets = m.getRequiemDirectionTargets(id);
          this.reachable = [];
          this.attackable = [];
          this.repairable = [];
          this.sweepArea = [];
          this.interdictZone = [];
          this.screenable = [];
          this.rescuableNpc = [];
          this.clearableBloom = [];
          this.fieldTriageTargets = [];
        },
      });
    }
    // Returns the WHOLE kit — no slice, no cap (3 Sep 2026). This used to
    // end with `out.slice(0, ACTION_SLOTS.length)` and a console.warn, which
    // meant a seventh verb was dropped on the floor with nothing on screen
    // saying so: 23 Aug 2026 it was a Munti losing FIRE, and by the time the
    // Heirloom kits landed it was reachable by fifteen different archetype x
    // Heirloom pairings, peaking at eight buttons for six slots. drawActionBar
    // pages the overflow now (engine/actionBarPaging.ts), so the honest thing
    // for this function to return is everything the unit can actually do, and
    // the "does it fit" question belongs entirely to the drawing side.
    return out;
  }

  private runActionSlot(index: number) {
    if (this.mission.outcome !== "ongoing" || this.mission.phase !== "player") return;
    if (this.isAnimatingMove) return; // same lock as handleBoardClick — see animatingUnitId's field comment
    if (this.endTurnPrompt) return; // modal — see handleBoardClick's own guard
    // MORE (3 Sep 2026): turns the page rather than running a verb. Checked
    // before the option lookup because on an overflowing bar this slot holds
    // no option at all. Deliberately not gated on the mission/animation
    // guards above being *loose* — it goes through exactly the same ones, so
    // paging is impossible at moments when acting is, which keeps the bar's
    // contents stable while a modal is open or a move is animating.
    if (index === this.moreSlotIndex) {
      const pageCount = pageActionBar(this.actionOptions, ACTION_SLOTS.length, this.actionPage).pageCount;
      this.actionPage = advancePage(this.actionPage, pageCount);
      this.render();
      return;
    }
    const option = this.slotOptions[index];
    if (!option || !option.usable) return;
    // Audio (A6) — the action-bar's own click, single choke point for both
    // the action-bar buttons and the 1-6 digit hotkeys (both routes call
    // this method) — see makeShopButton's own click wiring in ShopPanel.ts
    // for the sibling case this doesn't go through.
    playSfx(this, "click");
    option.run();
    if (option.endsTurn) {
      // The unit has nothing left to do, but stays SELECTED (same call the
      // OVERWATCH button already made) so the HUD can show the player what
      // it is now doing.
      this.clearSelectionHighlights();
    } else {
      this.refreshSelectionAfterAction();
    }
    this.render();
  }

  /**
   * Fog of war (Maxime, 22 Aug 2026 — "missions resolve in minutes, XCOM
   * missions take hours"). engine/ai.ts's hostile AI was already
   * vision-gated — it never acts on a target it can't see — but nothing on
   * this side asked the same question: every hostile on the board was
   * drawn and targetable regardless of whether any player unit could
   * actually see it. unitsVisibleToSide (engine/ai.ts) is the same
   * isVisibleTo the AI itself uses, just aggregated across the whole
   * living player roster; recomputed fresh every call rather than cached,
   * since it depends on live positions that change with every action and
   * unit counts here are small enough that this is cheap.
   *
   * Deliberately NOT built this pass (flagging so it doesn't read as an
   * oversight): terrain-tile graying for "unexplored ground" — the map
   * layout itself was never secret, only unit positions are, so only unit
   * visibility is gated; a "last-known position" ghost for a hostile that
   * WAS visible and isn't any more — this is strict current-visibility
   * only, matching how the AI's own vision already works, no memory on
   * either side; a vision-radius overlay showing the player their own
   * sight range — future polish, not required for the fog itself.
   */
  private visibleHostileIds(): Set<string> {
    // Routed through the Mission since 7 Sep 2026 rather than asking
    // engine/ai.ts directly: Mission.playerVisibleHostileIds is the same
    // unitsVisibleToSide call this used to make (turn argument included —
    // that's what lets an abil_sensor_sweep paint show through the fog),
    // plus the Long-Range Sensor Array bay's reveal once it's built. The
    // Mission is the one thing here that knows which bays the campaign
    // built, so it's the one place the bay can be applied; asking ai.ts
    // from here was exactly why a built Sensor Array changed nothing.
    return this.mission.playerVisibleHostileIds();
  }

  private filterToVisibleHostiles(units: BattleUnit[]): BattleUnit[] {
    const visible = this.visibleHostileIds();
    return units.filter((u) => u.side !== "hostile" || visible.has(u.instanceId));
  }

  private render() {
    // Audio (A6) — see permanentLossesSeen's own field comment.
    if (this.mission.permanentLosses.length > this.permanentLossesSeen) {
      this.permanentLossesSeen = this.mission.permanentLosses.length;
      playSfx(this, "pilot_lost");
    }

    const g = this.gfx;
    g.clear();
    const map = this.mission.map;
    const ts = this.tileSize;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x];
        g.fillStyle(TILE_COLORS[tile], 1);
        g.fillRect(this.boardX + x * ts, this.boardY + y * ts, ts - 1, ts - 1);
        this.drawDefenseStars(g, tile, this.boardX + x * ts, this.boardY + y * ts, ts);
      }
    }

    // cinder_line_signature — persistent burning-tile overlay (Vault Phase
    // 2 slice 3, 3 Sep 2026). Drawn every render() call, not gated on any
    // selection/arming state: a Surtr line is a fact about the BOARD (any
    // unit standing here takes damage at the next tick, either side, no
    // exception), not about whoever currently has a unit selected — the
    // same reason terrain itself is drawn unconditionally just above,
    // rather than only while some unit that cares about it is selected.
    // Read straight from Mission.getActiveSurtrLines() (engine/mission.ts)
    // rather than any local Battle.ts cache, so a line placed, ticked down,
    // or extinguished this frame is always exactly what's on the board —
    // there is no separate copy here to fall out of sync.
    for (const line of this.mission.getActiveSurtrLines()) {
      for (const c of line.tiles) {
        g.fillStyle(CINDER_LINE_BURN_COLOR, 0.55);
        g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
      }
    }

    // Contrast pass, 27 Aug 2026 (Campaign Playtest Review — "it took me
    // real time to stop misreading terrain color for a movement highlight
    // (the two look similar enough at a glance that I wasted several turns
    // before I sorted it out)"). Root cause: at 0.35 alpha, a green fill
    // over an already-greenish terrain tile (plain 0x3a4636, scrub
    // 0x455233 — both TILE_COLORS above) blends closer to the terrain than
    // to the highlight. Bumped fill alpha and added a solid stroke border,
    // matching the Onboarding plan's own §3 framing ("likely a contrast/
    // saturation pass... rather than new content") — same hue, same
    // meaning, just legible against green ground now. Deliberately a value
    // tweak only, not a hue change: 0x4ade80 = reachable is a locked
    // meaning referenced by this file's own header comment above, and
    // changing it would risk exactly the "more than a value tweak"
    // scope-creep that plan's §6 flagged as worth avoiding here.
    for (const c of this.reachable) {
      g.fillStyle(0x4ade80, 0.55);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
      g.lineStyle(2, 0x4ade80, 0.95);
      g.strokeRect(this.boardX + c.x * ts + 1, this.boardY + c.y * ts + 1, ts - 3, ts - 3);
    }
    for (const u of this.attackable) {
      g.fillStyle(0xef4444, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    // deadfall_strike target preview (Vault Phase 2 slice 2) — its own
    // fuchsia, not attackable's red: this set ignores attackRange entirely
    // (any visible hostile, anywhere), so reusing red would read as an
    // ordinary Attack option and mislead a player into expecting the normal
    // dodge/counter rules.
    for (const u of this.deadfallTargets) {
      g.fillStyle(DEADFALL_STRIKE_COLOR, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    for (const u of this.repairable) {
      g.fillStyle(0x22d3ee, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    // lastword_field_triage preview — same cyan as repairable just above,
    // same meaning ("gets healed"); see fieldTriageTargets' own field
    // comment for why this doesn't need a color distinct from Repair's.
    for (const u of this.fieldTriageTargets) {
      g.fillStyle(0x22d3ee, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    // Rescue target / Clear Bloom preview (23 Aug 2026) share one hue —
    // gold, unused elsewhere on the board — since no mission ever has both
    // (Mission 5 has the rescue, Mission 3 has the patch) so there is no
    // real ambiguity between "a unit to click" and "tiles a button would
    // flip" in practice.
    for (const u of this.rescuableNpc) {
      g.fillStyle(0xfacc15, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    for (const c of this.clearableBloom) {
      g.fillStyle(0xfacc15, 0.35);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    // Ability-depth previews for the selected unit. Each set is already
    // empty unless the engine says that verb is usable from here.
    for (const c of this.interdictZone) {
      g.fillStyle(INTERDICT_COLOR, 0.3);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    for (const u of this.screenable) {
      g.fillStyle(SCREEN_COLOR, 0.35);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    // The sweep footprint is drawn as an outline, not a wash: it's a square
    // (Chebyshev radius) covering a big fraction of the board, and tinting
    // that many tiles would bury every other highlight under it.
    if (this.sweepArea.length) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const c of this.sweepArea) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x);
        maxY = Math.max(maxY, c.y);
      }
      g.lineStyle(2, SWEEP_COLOR, 0.85);
      g.strokeRect(this.boardX + minX * ts + 1, this.boardY + minY * ts + 1, (maxX - minX + 1) * ts - 3, (maxY - minY + 1) * ts - 3);
    }
    // Fire support targeting (25 Aug 2026) — a filled wash, not an outline
    // like Sweep's box just above: unlike Sweep, this IS the click target
    // set (every other highlight is suppressed while armed — see
    // recomputeSelectionHighlights' own guard — so there's nothing else on
    // the board competing for attention here), and a player has to be able
    // to see exactly which tile they're about to click, not just the
    // footprint's outer edge.
    for (const c of this.fireSupportRange) {
      g.fillStyle(FIRE_SUPPORT_COLOR, 0.3);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    // Missile targeting (1 Sep 2026) — same wash, same hue as Fire Support
    // on purpose: it's the same interaction (armed strike, click a tile),
    // the two are never armed at once, and the HUD legend names which one
    // is live. A second colour here would be a second thing to learn for
    // no new information.
    for (const c of this.missileRange) {
      g.fillStyle(FIRE_SUPPORT_COLOR, 0.3);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    // Cinder Line targeting (Surtr, Vault Phase 2 slice 3, 3 Sep 2026) —
    // same filled-wash treatment as Fire Support/Missile just above, own
    // colour: this IS the click target set, every other highlight is
    // suppressed while armed (see SURTR's own run() in availableActions).
    for (const c of this.cinderLineArea) {
      g.fillStyle(CINDER_LINE_TARGET_COLOR, 0.3);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    // Zanretsu targeting (cutting_room_charge, Vault Phase 2 slice 4, 3 Sep
    // 2026) — same filled-wash treatment as Cinder Line just above, own
    // colour: this IS the click target set, every other highlight is
    // suppressed while armed (see ZANRETSU's own run() in availableActions).
    for (const c of this.cuttingRoomChargeArea) {
      g.fillStyle(CUTTING_ROOM_CHARGE_TARGET_COLOR, 0.3);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    // Migawari / Last Rites target previews (Vault Phase 2 slice 5, 3 Sep
    // 2026) — unit-position washes, same shape as deadfallTargets/
    // fieldTriageTargets above, not the cinderLineArea/cuttingRoomChargeArea
    // raw-tile-set shape just above (there's no line/area to trace, just a
    // handful of specific downed allies to pick from).
    for (const u of this.lastWordSignatureTargets) {
      g.fillStyle(LAST_WORD_SIGNATURE_TARGET_COLOR, 0.45);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    for (const u of this.lastRitesTargets) {
      g.fillStyle(LAST_RITES_TARGET_COLOR, 0.45);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    // Beacon Control target preview (built 4 Sep 2026) — same shape as
    // Migawari/Last Rites' own unit-position washes directly above.
    for (const u of this.beaconTargets) {
      g.fillStyle(BEACON_TARGET_COLOR, 0.45);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    // Ledgerhall Static target preview (Vault Phase 2 slice 6, 3 Sep 2026) —
    // a hostile-unit wash, same shape as deadfallTargets above, own violet.
    for (const u of this.ledgerhallStaticTargets) {
      g.fillStyle(LEDGERHALL_STATIC_TARGET_COLOR, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    // Gjallar targeting (requiem_severance, Vault Phase 2 slice 7, 3 Sep
    // 2026) — same filled-wash treatment as Cinder Line/Zanretsu above, own
    // colour (REQUIEM_TARGET_COLOR's own comment explains the deliberate
    // "unlike anything else on this board" choice). This IS the click
    // target set — every direction, out to the board edge, not just the
    // fixed 8-tile hit-list (see getRequiemDirectionTargets' own comment).
    for (const c of this.requiemDirectionTargets) {
      g.fillStyle(REQUIEM_TARGET_COLOR, 0.22);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    // Maser Lance targeting (Tank's 3rd weapon branch, 5 Sep 2026) — same
    // filled-wash treatment as Gjallar just above, own colour: this IS the
    // click target set (every direction, out to the board edge), not the
    // narrower actual cone footprint a given click resolves to (see the
    // preview outline just below for that).
    for (const c of this.maserLanceDirectionTargets) {
      g.fillStyle(MASER_LANCE_TARGET_COLOR, 0.22);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    // Splash preview: while a strike is armed and the pointer sits on a
    // legal target tile, outline the blast footprint so "who's inside"
    // is visible on the board itself, not only in the HUD's victim list.
    if (this.hoverTile && (this.fireSupportTargeting || this.missileTargeting)) {
      const range = this.fireSupportTargeting ? this.fireSupportRange : this.missileRange;
      if (range.some((c) => coordKey(c) === coordKey(this.hoverTile!))) {
        const h = this.hoverTile;
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRect(this.boardX + (h.x - 1) * ts + 1, this.boardY + (h.y - 1) * ts + 1, 3 * ts - 3, 3 * ts - 3);
      }
    }
    // Cinder Line preview: unlike Fire Support/Missile's fixed-size blast
    // box, a Surtr line's actual affected set is a variable-length RUN from
    // the wielder out to wherever the pointer sits — the clickable area
    // above (every legal endpoint) is NOT the same shape as what a given
    // click would ignite, so this outlines the real tile-by-tile run
    // (Mission.previewCinderLineFrom) rather than a fixed box, the one
    // piece of information the flat area wash above can't convey on its
    // own.
    if (this.selectedUnitId && this.hoverTile && this.cinderLineTargeting) {
      const preview = this.mission.previewCinderLineFrom(this.selectedUnitId, this.hoverTile);
      if (preview) {
        for (const c of preview) {
          g.lineStyle(2, 0xffffff, 0.9);
          g.strokeRect(this.boardX + c.x * ts + 1, this.boardY + c.y * ts + 1, ts - 3, ts - 3);
        }
      }
    }
    // Zanretsu preview: same "outline the real tile-by-tile run" treatment
    // as Cinder Line's own preview just above, for the identical reason —
    // the clickable area wash above is every legal endpoint, not the same
    // shape as what a given click would actually charge through.
    if (this.selectedUnitId && this.hoverTile && this.cuttingRoomChargeTargeting) {
      const preview = this.mission.previewCuttingRoomChargeFrom(this.selectedUnitId, this.hoverTile);
      if (preview) {
        for (const c of preview) {
          g.lineStyle(2, 0xffffff, 0.9);
          g.strokeRect(this.boardX + c.x * ts + 1, this.boardY + c.y * ts + 1, ts - 3, ts - 3);
        }
      }
    }
    // Gjallar preview: same "outline the real fixed-length hit-list"
    // treatment as Cinder Line/Zanretsu's own preview just above, for the
    // identical reason — the direction-set wash above only says which way
    // the beam points, not the actual (always exactly SEVERANCE.shape.length
    // -or-shorter-at-an-edge) tiles it hits. Drawn in REQUIEM_TARGET_COLOR
    // rather than the neutral white every other preview outline here uses,
    // on purpose: this outline always includes the wielder's OWN tile (GDD
    // §8.2's "the origin unit is included"), so a plain white box here would
    // read as "you are safe, standing in the preview area" exactly backward
    // from the truth — the player needs to see their own square is part of
    // the kill zone before they commit to the click, not after.
    if (this.selectedUnitId && this.hoverTile && this.requiemTargeting) {
      const preview = this.mission.previewRequiemSeverance(this.selectedUnitId, this.hoverTile);
      if (preview) {
        for (const c of preview) {
          g.lineStyle(2, REQUIEM_TARGET_COLOR, 0.95);
          g.strokeRect(this.boardX + c.x * ts + 1, this.boardY + c.y * ts + 1, ts - 3, ts - 3);
        }
      }
    }
    // Maser Lance preview: same "outline the real footprint" treatment as
    // Cinder Line/Zanretsu/Gjallar's own previews above, for the identical
    // reason — the direction-set wash above only says which way the cone
    // points, not the actual widening footprint a click there would fire
    // (previewMaserLanceCone re-derives that from the hovered tile). Drawn
    // in MASER_LANCE_TARGET_COLOR, not the neutral white Cinder Line/
    // Zanretsu use, so it reads as "this specific ability's shape," matching
    // Gjallar's own reasoning for using its own colour rather than white.
    if (this.selectedUnitId && this.hoverTile && this.maserLanceTargeting) {
      const preview = this.mission.previewMaserLanceCone(this.selectedUnitId, this.hoverTile);
      if (preview) {
        for (const c of preview) {
          g.lineStyle(2, MASER_LANCE_TARGET_COLOR, 0.95);
          g.strokeRect(this.boardX + c.x * ts + 1, this.boardY + c.y * ts + 1, ts - 3, ts - 3);
        }
      }
    }
    // Hold Zone marker (30 Aug 2026, Maxime: "i reach turn 16 and it give me
    // mission failed, no unit died, i cleared lot of bloom"). Root cause,
    // traced through engine/mission.ts's checkWinLoss: hold_zone's actual
    // win condition is a live snapshot check — a player unit standing ON
    // this map's holdZone tile(s) with no hostile also on them, checked
    // every turn from holdUntilTurn on — and until now NOTHING on this
    // screen ever showed the player where that tile is, or whether they
    // currently satisfy it. A player who spent the mission chasing Bloom
    // instead of standing on an unmarked tile could do everything else
    // right and still lose on the turn-limit branch, exactly as reported,
    // with no way to have seen it coming. Always drawn (not gated behind a
    // unit being selected, same as Protect Asset's HP line in drawHud below
    // — this is core objective state, not an action preview), independent
    // of the existing action-preview highlights above so it never disappears
    // just because nothing is selected. Teal is unused by every other
    // highlight on this board (see the _COLOR constants above); the fill
    // color itself then reports live status so the player doesn't have to
    // cross-reference the HUD text to read it off the map: green once the
    // win condition is currently true, red while a hostile occupies the
    // zone, dim teal otherwise (nobody there yet, or too early to count).
    if (this.mission.mission.objective === "hold_zone") {
      const hold = map.holdZone ?? [];
      const holdUntil = this.mission.mission.objectiveParams.holdUntilTurn ?? this.mission.mission.objectiveParams.turnLimit;
      const livingNow = this.mission.livingUnits();
      const playerOnHold = livingNow.some((u) => u.side === "player" && !u.downed && hold.some((c) => coordKey(c) === coordKey(u.pos)));
      const hostileOnHold = livingNow.some((u) => u.side === "hostile" && !u.downed && hold.some((c) => coordKey(c) === coordKey(u.pos)));
      const fillColor = hostileOnHold ? 0xef4444 : this.mission.turn >= holdUntil && playerOnHold ? 0x22c55e : 0x2dd4bf;
      const fillAlpha = hostileOnHold || (this.mission.turn >= holdUntil && playerOnHold) ? 0.4 : 0.18;
      for (const c of hold) {
        g.fillStyle(fillColor, fillAlpha);
        g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
        g.lineStyle(2, 0x2dd4bf, 0.9);
        g.strokeRect(this.boardX + c.x * ts + 1, this.boardY + c.y * ts + 1, ts - 3, ts - 3);
      }
    }
    if (this.selectedUnitId) {
      const u = this.mission.unitById(this.selectedUnitId);
      if (u) {
        // Walk animation: travels with the unit's own visual position
        // while it's mid-step, same override drawUnit() uses — otherwise
        // this box would sit at the (already-committed) destination the
        // whole time while the unit's own silhouette is still walking
        // toward it, two readings of "where is it" disagreeing on screen.
        const selPos = u.instanceId === this.animatingUnitId && this.animatingVisualPos ? this.animatingVisualPos : u.pos;
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRect(this.boardX + selPos.x * ts, this.boardY + selPos.y * ts, ts - 1, ts - 1);
      }
    }

    // Fog of war: a hostile is only ever drawn if at least one living
    // player unit currently has it in vision — see visibleHostileIds()'s
    // own doc comment for what this pass does and doesn't cover. Player
    // units are never hidden from their own side.
    const visibleHostiles = this.visibleHostileIds();
    for (const unit of this.mission.livingUnits()) {
      if (unit.side === "hostile" && !visibleHostiles.has(unit.instanceId)) continue;
      // A braced Tank's kill-box is drawn under the units, not over them,
      // so a hostile standing in it is still readable.
      for (const c of this.mission.interdictedTiles(unit.instanceId)) {
        g.lineStyle(2, INTERDICT_COLOR, 0.75);
        g.strokeRect(this.boardX + c.x * ts + 2, this.boardY + c.y * ts + 2, ts - 5, ts - 5);
      }
      this.drawUnit(g, unit, ts);
    }
    // Enemy-phase playback (9 Sep 2026) — a unit currently mid-walk that the
    // engine has ALREADY downed (killed by the very overwatch its own move
    // triggered — see HostilePhaseEvent's own comment on this gap) is drawn
    // one more time here, outside the livingUnits() loop above that would
    // otherwise skip it outright. Kept out of that loop rather than folded
    // into it so it never picks up an interdiction box meant for the living
    // — a downed unit has none anyway (interdictedTiles reads live state),
    // but the two loops having different jobs is the point, not an accident.
    if (this.animatingUnitId && !this.mission.livingUnits().some((u) => u.instanceId === this.animatingUnitId)) {
      const dyingUnit = this.mission.unitById(this.animatingUnitId);
      if (dyingUnit) this.drawUnit(g, dyingUnit, ts);
    }
    // playAttackBeat's flash — a ring around the defender's tile, colored by
    // what the hit actually did, held for the beat's short pause. Reads
    // unit.pos directly (never animatingVisualPos): the defender in an
    // enemy-phase attack event is never also the one currently walking.
    if (this.hostilePhaseFlashTarget) {
      const target = this.mission.unitById(this.hostilePhaseFlashTarget.unitId);
      if (target) {
        const flashColor =
          this.hostilePhaseFlashTarget.result === "kill" ? 0xef4444 : this.hostilePhaseFlashTarget.result === "dodge" ? 0x8a97a6 : 0xfacc15;
        g.lineStyle(3, flashColor, 0.95);
        g.strokeRect(this.boardX + target.pos.x * ts + 1, this.boardY + target.pos.y * ts + 1, ts - 3, ts - 3);
      }
    }

    this.drawForecastLabels(ts);
    this.drawActionBar();
    this.drawHud();
    this.drawOverlayIfNeeded();
    this.updateTutorialHint();
  }

  /**
   * Combat forecast on the board (1 Sep 2026, feature-gap report A1): the
   * damage this selected unit would deal, written over every enemy it can
   * currently hit — "34", or "KILL" when the engine says the hit downs the
   * target, with "~" prefixed when the target has a dodge roll. Drawn from
   * Mission.forecastAttack(), which runs the real resolver read-only, so
   * these numbers can't disagree with the hit that follows except by a
   * dodge. Text objects come from a fixed pool (same accumulate-once
   * discipline as actionSlots) — hidden, not destroyed, when unused.
   */
  private drawForecastLabels(ts: number) {
    const wanted: { x: number; y: number; text: string; color: string }[] = [];
    if (this.selectedUnitId && !this.isAnimatingMove && this.mission.outcome === "ongoing") {
      for (const target of this.attackable) {
        const f = this.mission.forecastAttack(this.selectedUnitId, target.instanceId);
        if (!f) continue;
        const dodge = f.dodgeChance > 0 ? "~" : "";
        wanted.push({
          x: this.boardX + target.pos.x * ts + ts / 2,
          y: this.boardY + target.pos.y * ts - 2,
          text: f.defenderDowned ? `${dodge}KILL` : `${dodge}${f.damage}`,
          color: f.defenderDowned ? "#fde047" : "#fca5a5",
        });
      }
    }
    while (this.forecastLabels.length < wanted.length) {
      const t = this.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#fca5a5", stroke: "#000000", strokeThickness: 3 }).setOrigin(0.5, 1);
      this.forecastLabels.push(t);
    }
    this.forecastLabels.forEach((label, i) => {
      const w = wanted[i];
      if (!w) {
        label.setVisible(false);
        return;
      }
      label.setPosition(w.x, w.y).setText(w.text).setColor(w.color).setVisible(true);
    });
  }

  /**
   * Mission 1 tutorial hints — see the field comments for the state
   * machine this reads. A priority chain, not independent checks: select
   * always outranks move, move always outranks attack, so a unit that
   * happens to have both a reachable tile and an attackable target still
   * teaches "move" first, matching the plan's own Select → Move → Attack
   * teaching order regardless of what's actually available to click.
   */
  private updateTutorialHint() {
    if (!this.tutorialActive) return;
    let line: string | null = null;
    if (!this.tutorialHasSelected) {
      // The one line that isn't gated on a click at all — Maxime's own
      // call, softly warning rather than either spelling out the full
      // permadeath/Munti rule or staying silent (Onboarding plan §5's
      // open question): "we should softly warn them."
      line = "TUTORIAL — click one of your own units to select it.\nLosses out here can be permanent. Keep a Munti in the fight.";
    } else if (!this.tutorialHasMoved && this.reachable.length > 0) {
      line = "TUTORIAL — click a highlighted green tile to move there.";
    } else if (!this.tutorialHasAttacked && this.attackable.length > 0) {
      line = "TUTORIAL — click a highlighted red enemy to attack it.";
    }
    if (line) {
      this.tutorialText.setText(line).setVisible(true);
      return;
    }
    this.tutorialText.setVisible(false);
    if (this.tutorialHasSelected && this.tutorialHasMoved && this.tutorialHasAttacked) {
      this.tutorialActive = false;
      if (!this.tutorialSeenMarked) {
        this.tutorialSeenMarked = true;
        markTutorialSeen();
      }
    }
  }

  /**
   * Fills the contextual action bar from availableActions(): one slot per
   * verb the selected unit's kit holds, the rest hidden. Greying follows
   * the engine's canX() verdict, exactly as the single OVERWATCH button it
   * replaced did.
   */
  private drawActionBar() {
    this.actionOptions = this.availableActions();
    // Page 1 whenever the selection changes. Without this, selecting a
    // seven-verb unit, pressing MORE, then clicking a three-verb unit would
    // leave the new unit's bar on a page that doesn't exist — pageActionBar
    // clamps rather than blanks, so it would have shown the last page, but
    // "I clicked a unit and got its second page" is still wrong.
    if (this.selectedUnitId !== this.actionBarUnitId) {
      this.actionBarUnitId = this.selectedUnitId;
      this.actionPage = 0;
    }
    const paged = pageActionBar(this.actionOptions, ACTION_SLOTS.length, this.actionPage);
    this.actionPage = paged.page - 1; // absorb any clamp, so MORE steps from where we actually are
    this.moreSlotIndex = paged.moreSlotIndex;
    this.slotOptions = [];
    for (let i = 0; i < this.actionSlots.length; i++) {
      const slot = this.actionSlots[i];
      // MORE always sits in the last slot and is always pressable — it is
      // navigation, not a verb, so it never greys out with the unit's
      // remaining actions. Drawn in the same blue as a usable action rather
      // than a colour of its own: a third button colour on a six-button bar
      // reads as a third *kind* of thing, and this is just a page turn.
      if (i === paged.moreSlotIndex) {
        this.slotOptions.push(null);
        slot.btn.setVisible(true);
        slot.label.setVisible(true);
        slot.btn.setFillStyle(0x2e5c7a);
        slot.btn.setStrokeStyle(1, 0x4a7a9a);
        setActionLabel(slot.label, moreButtonLabel(paged.page, paged.pageCount));
        slot.label.setColor("#ffffff");
        slot.key.setVisible(true);
        slot.key.setText(String(i + 1));
        slot.key.setColor("#8ab4d8");
        continue;
      }
      const option = paged.items[i];
      this.slotOptions.push(option ?? null);
      if (!option) {
        slot.btn.setVisible(false);
        slot.label.setVisible(false);
        slot.key.setVisible(false);
        continue;
      }
      slot.btn.setVisible(true);
      slot.label.setVisible(true);
      slot.btn.setFillStyle(option.usable ? 0x2e5c7a : 0x1a2028);
      slot.btn.setStrokeStyle(1, option.usable ? 0x4a7a9a : 0x3a4552);
      setActionLabel(slot.label, option.label);
      slot.label.setColor(option.usable ? "#ffffff" : "#5a6572");
      // Hotkey digit, 2 Sep 2026 (Maxime: "add some natural keybinding for
      // the majority of action"). A binding nobody can find is worth
      // nothing, and a legend in the corner is the thing players read once
      // and forget — the digit belongs ON the button, the way every hotbar
      // game since Diablo has taught it. Drawn as its own object pinned to
      // the button's left edge rather than prefixed onto the label: these
      // buttons are 70px wide and "OVERWATCH" at 10px already crowds them
      // (see the label's own comment in create()), so a "1 " prefix would
      // have pushed the longest labels past the edge. Same loop index
      // drives the digit, the label and the keydown handler, so they can't
      // drift apart.
      slot.key.setVisible(true);
      slot.key.setText(String(i + 1));
      slot.key.setColor(option.usable ? "#8ab4d8" : "#4a5562");
    }
  }

  /**
   * GDD §12: "Terrain: flat fills from a nine-colour palette, with defence
   * stars printed as small dots in the tile corner." TILE_COLORS above only
   * ever implemented the fill half of that sentence — data/tiles.ts's
   * TileDef.defenceStars has been sitting unread by this scene since the
   * placeholder pass. Drawn in the tile's bottom-left corner, deliberately
   * not top-right, so it never competes with a unit's gear-tier pips below
   * (also a tile-corner mark, but always top-right, and drawn later so it
   * sits above whatever's standing on the tile).
   */
  private drawDefenseStars(g: Phaser.GameObjects.Graphics, tile: TileType, tileX: number, tileY: number, ts: number) {
    const stars = TILES[tile].defenceStars;
    if (stars <= 0) return;
    const dotR = Math.max(1, ts * 0.045);
    const pad = ts * 0.12;
    const spacing = dotR * 2.4;
    g.fillStyle(0xe8e2d4, 0.55);
    for (let i = 0; i < stars; i++) {
      g.fillCircle(tileX + pad + i * spacing, tileY + ts - pad, dotR);
    }
  }

  /**
   * Traces and strokes just the outline of a silhouette at the given
   * radius — no fill. Shared by drawSpeciesOutline (below) so the hiopi
   * double-outline pass can re-stroke the exact same geometry at a second,
   * larger radius instead of hand-duplicating each shape's path.
   */
  private strokeSilhouette(g: Phaser.GameObjects.Graphics, kind: SilhouetteKind, cx: number, cy: number, r: number) {
    if (kind === "blob" || kind === "munti") {
      g.strokeCircle(cx, cy, r);
      return;
    }
    if (kind === "bloom_swarm") {
      const cr = r * 0.62;
      const off = r * 0.45;
      g.strokeCircle(cx - off, cy + off * 0.6, cr);
      g.strokeCircle(cx + off, cy + off * 0.6, cr);
      g.strokeCircle(cx, cy - off * 0.7, cr);
      return;
    }
    if (kind === "bloom_limbless") {
      g.strokeEllipse(cx, cy, r * 2.3, r * 1.05);
      return;
    }
    if (kind === "bloom_burrow") {
      // Same jagged-spike point loop the fill pass uses below — see that
      // branch's own comment for why this only ever runs while surfaced.
      g.beginPath();
      const spikes = 6;
      const outerR = r * 1.05;
      const innerR = r * 0.45;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outerR : innerR;
        const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
      return;
    }
    g.beginPath();
    if (kind === "meeps") {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineTo(cx - r, cy + r);
    } else if (kind === "tank") {
      g.moveTo(cx - r, cy - r);
      g.lineTo(cx + r, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineTo(cx - r, cy + r);
    } else if (kind === "reeps") {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
    } else if (kind === "bloom_sessile") {
      g.moveTo(cx - r, cy + r * 0.5);
      g.lineTo(cx - r * 0.6, cy - r * 0.3);
      g.lineTo(cx - r * 0.25, cy - r);
      g.lineTo(cx + r * 0.25, cy - r);
      g.lineTo(cx + r * 0.6, cy - r * 0.3);
      g.lineTo(cx + r, cy + r * 0.5);
    } else {
      // bloom_flight — same lifted geometry the fill pass uses, so the
      // outline traces the wing where it's actually drawn, not the tile.
      const liftCy = cy - r * 0.35;
      g.moveTo(cx, liftCy - r * 0.6);
      g.lineTo(cx + r, liftCy + r * 0.35);
      g.lineTo(cx + r * 0.15, liftCy + r * 0.15);
      g.lineTo(cx, liftCy + r * 0.5);
      g.lineTo(cx - r * 0.15, liftCy + r * 0.15);
      g.lineTo(cx - r, liftCy + r * 0.35);
    }
    g.closePath();
    g.strokePath();
  }

  /**
   * GDD §12's species-outline table: human = single solid outline, hiopi =
   * legs fanning from the base, osnius = single outline + two whisker
   * ticks at the leading edge. Hiopi's mark went through two proxies
   * before this one: first a uniformly-thicker 3px line for centauroid
   * alone (never read as anything), then a genuine second ring at a
   * slightly larger radius (23 Aug 2026 — a real second line, but still
   * just "thicker," not "different creature"). This pass (23 Aug 2026,
   * Character Visual Identity concept doc §2) replaces the ring with four
   * short downward strokes off the base of the silhouette — Hiopi are
   * canonically quadruped/centaur-built, so legs reference that directly
   * instead of adding line weight. Same tick-mark grammar as the
   * vibrissal whiskers below, opposite anchor: whiskers reach up from the
   * top, legs reach down from the base. Keyed off unit.chassis, which is
   * a 1:1 stand-in for species per data/units.ts's own archetype rows
   * (human/bipedal, hiopi/centauroid, osnius/bipedal_vibrissal) — so no
   * separate species field is needed on BattleUnit.
   */
  private drawSpeciesOutline(g: Phaser.GameObjects.Graphics, unit: BattleUnit, kind: SilhouetteKind, cx: number, cy: number, r: number) {
    g.lineStyle(1.5, 0xffffff, 0.9);
    this.strokeSilhouette(g, kind, cx, cy, r);

    if (unit.chassis === "centauroid") {
      // Hiopi: four short legs fanning down and slightly outward from
      // the base of the silhouette, suggesting a quadruped stance.
      const legLen = r * 0.5;
      const baseY = cy + r * 0.85;
      const spread = r * 0.35;
      [-1.5, -0.5, 0.5, 1.5].forEach((i) => {
        const x = cx + i * spread;
        g.lineBetween(x, baseY, x + i * 2, baseY + legLen);
      });
    } else if (unit.chassis === "bipedal_vibrissal") {
      // Osnius: two short whisker ticks off the leading edge — "leading
      // edge" reads as "top of the silhouette" here since units have no
      // facing direction on this board. Echoes the sensor-whisker motif
      // the archetype ids already use (arch_*_vibrissal).
      const tickLen = r * 0.55;
      const originY = cy - r * 0.85;
      g.lineBetween(cx - r * 0.3, originY, cx - r * 0.3 - tickLen * 0.5, originY - tickLen);
      g.lineBetween(cx + r * 0.3, originY, cx + r * 0.3 + tickLen * 0.5, originY - tickLen);
    }
  }

  /**
   * A dashed ring, faked with short stroked arcs and gaps since Phaser
   * Graphics has no native dash pattern. Only ever called for a burrowed
   * Bloom right now (GDD §12: "Burrowed: dashed outline, 40% opacity") —
   * written as a general helper in case a later state wants the same look.
   */
  private drawDashedCircleOutline(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number, alpha: number) {
    const segments = 10;
    const gapFraction = 0.45;
    g.lineStyle(1.5, color, alpha);
    for (let i = 0; i < segments; i++) {
      const start = (i / segments) * Math.PI * 2;
      const end = start + ((Math.PI * 2) / segments) * (1 - gapFraction);
      g.beginPath();
      g.arc(cx, cy, r, start, end, false);
      g.strokePath();
    }
  }

  private drawUnit(g: Phaser.GameObjects.Graphics, unit: BattleUnit, ts: number) {
    // Walk animation (25 Aug 2026): draw THIS unit at its animated visual
    // position, continuous tile coordinates, instead of unit.pos, while
    // it's the one currently walking — see animatingUnitId's field
    // comment. Every other unit, and this unit outside of its own move,
    // draws from unit.pos exactly as before. `pos` is used for every
    // position calculation in this function from here down (pips, the
    // concealed-frame outline) so nothing drawn for this unit floats away
    // from its own silhouette mid-step.
    const pos = unit.instanceId === this.animatingUnitId && this.animatingVisualPos ? this.animatingVisualPos : unit.pos;
    const cx = this.boardX + pos.x * ts + ts / 2;
    const cy = this.boardY + pos.y * ts + ts / 2;
    const r = ts * 0.32;
    const acted = unit.actionsRemaining <= 0 && unit.side === "player";

    // npcIncapacitated (Mission 5's rescue-and-recruit pass, 23 Aug 2026):
    // side "player" for targeting purposes, but reading as PLAYER_COLOR
    // would look like one of the deploying squad. A pale, neutral tone
    // instead — "someone down, not a combatant" — checked before the
    // ordinary side/kind branch below rather than folded into it.
    // isCivilian (Mission 31, 25 Aug 2026): its own pale sky-blue, distinct
    // from both PLAYER_COLOR (the deploying squad) and npcIncapacitated's
    // tan below — "someone to protect, not a combatant, not already down,"
    // a third reading this board hasn't needed before this mission.
    const color = unit.isCivilian
      ? 0x9fc9e8
      : unit.npcIncapacitated
      ? 0xe8e2d4
      : unit.side === "player"
        ? PLAYER_COLOR
        : unit.kind === "mech"
          ? HOSTILE_MECH_COLOR
          : parseInt(BLOOM[unit.archetypeId]?.colorPalette[0].replace("#", "") ?? "888888", 16);

    const fillAlpha = acted ? 0.55 : 1;
    g.fillStyle(color, fillAlpha);

    const path = unit.path;
    const bloomArch = unit.kind === "bloom" ? BLOOM[unit.archetypeId] : undefined;
    // Burrowed-and-hidden stays the plain "blob" fallback regardless of
    // movementType — Bloom Silhouette Doctrine §2: "the shape only appears
    // in the ×1.5 damage window," i.e. once surfaced. A surfaced Undertow
    // (unit.burrowed false) gets its real bloom_burrow spike shape below.
    const burrowedBlob = !!(bloomArch?.movementType === "burrow" && unit.burrowed);
    const kind: SilhouetteKind = bloomArch
      ? burrowedBlob
        ? "blob"
        : bloomSilhouetteKind(bloomArch.movementType)
      : !path
        ? "blob"
        : path === "meeps"
          ? "meeps"
          : path === "tank"
            ? "tank"
            : path === "reeps"
              ? "reeps"
              : "munti";
    if (burrowedBlob) {
      // Bloom placeholder, still underground: fainter fill, per GDD §12
      // ("Burrowed: dashed outline, 40% opacity") — the outline half of
      // that rule is drawn below, after the fill branches.
      g.fillStyle(color, 0.4);
    }

    if (kind === "blob") {
      g.fillCircle(cx, cy, r);
    } else if (kind === "meeps") {
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineTo(cx - r, cy + r);
      g.closePath();
      g.fillPath();
    } else if (kind === "tank") {
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else if (kind === "reeps") {
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.fillPath();
    } else if (kind === "bloom_swarm") {
      // Swarm (Crawlmass/Splitfang): three small overlapping circles
      // instead of one solid shape — "individually weak, dangerous in
      // numbers," per the Doctrine's own reading of this family.
      const cr = r * 0.62;
      const off = r * 0.45;
      g.fillCircle(cx - off, cy + off * 0.6, cr);
      g.fillCircle(cx + off, cy + off * 0.6, cr);
      g.fillCircle(cx, cy - off * 0.7, cr);
    } else if (kind === "bloom_burrow") {
      // Burrow, surfaced (Undertow): a jagged six-point spike. Only ever
      // reached when burrowedBlob is false — see the kind derivation above.
      g.beginPath();
      const spikes = 6;
      const outerR = r * 1.05;
      const innerR = r * 0.45;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outerR : innerR;
        const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
    } else if (kind === "bloom_sessile") {
      // Sessile (Gallcyst/Heartwood/Unnamed): a wide, flat-based dome —
      // "can't come to you" should read before a player checks moveRange.
      // Root ticks into the tile are drawn after the outline pass below.
      g.beginPath();
      g.moveTo(cx - r, cy + r * 0.5);
      g.lineTo(cx - r * 0.6, cy - r * 0.3);
      g.lineTo(cx - r * 0.25, cy - r);
      g.lineTo(cx + r * 0.25, cy - r);
      g.lineTo(cx + r * 0.6, cy - r * 0.3);
      g.lineTo(cx + r, cy + r * 0.5);
      g.closePath();
      g.fillPath();
    } else if (kind === "bloom_flight") {
      // Flight (Sirenmaw/Choir): a faint ground shadow at the unit's real
      // tile position, then a swept-wing silhouette lifted above it —
      // "ignores terrain, can't be blocked" should read as airborne before
      // a player checks movementType. The shadow uses its own fillStyle
      // call, so the wing's fill is restored right after at this
      // function's own color/alpha.
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(cx, cy + r * 0.55, r * 1.3, r * 0.5);
      g.fillStyle(color, fillAlpha);
      const liftCy = cy - r * 0.35;
      g.beginPath();
      g.moveTo(cx, liftCy - r * 0.6);
      g.lineTo(cx + r, liftCy + r * 0.35);
      g.lineTo(cx + r * 0.15, liftCy + r * 0.15);
      g.lineTo(cx, liftCy + r * 0.5);
      g.lineTo(cx - r * 0.15, liftCy + r * 0.15);
      g.lineTo(cx - r, liftCy + r * 0.35);
      g.closePath();
      g.fillPath();
    } else if (kind === "bloom_limbless") {
      // Limbless (Sporethrower): an elongated, legless capsule with one
      // lit gland at the launch point — ranged, not melee, and can't run
      // either, so nothing about the shape should suggest speed.
      g.fillEllipse(cx, cy, r * 2.3, r * 1.05);
      g.fillStyle(0xffe27a, fillAlpha);
      g.fillCircle(cx + r * 0.95, cy, r * 0.22);
      g.fillStyle(color, fillAlpha);
    } else {
      // munti — circle with a cross bar
      g.fillCircle(cx, cy, r);
    }

    // Outline pass, separated from the fill pass above so the same
    // silhouette geometry can be re-stroked at more than one radius (the
    // hiopi double outline) or swapped for a dashed version (a burrowed
    // Bloom) without duplicating each shape's fill code.
    if (unit.npcIncapacitated) {
      // Same dashed-outline grammar a burrowed Bloom already uses — "a
      // distinct state, not a normal actor" reads the same way whether the
      // reason is "hidden underground" or "down and waiting to be
      // rescued." Brighter than burrowedBlob's 0.4 alpha since this unit's
      // own fill isn't dimmed the way a burrowed unit's is.
      this.drawDashedCircleOutline(g, cx, cy, r, 0xffffff, 0.6);
    } else if (burrowedBlob) {
      this.drawDashedCircleOutline(g, cx, cy, r, 0xffffff, 0.4);
    } else {
      this.drawSpeciesOutline(g, unit, kind, cx, cy, r);
    }
    if (kind === "munti") {
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(cx - r, cy, cx + r, cy);
    } else if (kind === "bloom_sessile") {
      // Root/tendril ticks driven into the tile below the dome's base —
      // reinforces "rooted in place" beyond just the shape's own outline.
      g.lineStyle(1.5, 0xffffff, 0.55);
      const baseY = cy + r * 0.5;
      [-0.45, 0, 0.45].forEach((off) => {
        g.lineBetween(cx + off * r, baseY, cx + off * r * 1.3, baseY + r * 0.35);
      });
    }
    if (unit.collapsed) {
      // GDD §12 wants a "pulsing rim." Real per-frame animation would mean
      // driving render() off this scene's update(time) every frame instead
      // of only on input/state changes — a bigger structural change than
      // this pass makes, so it's flagged rather than silently shipped as a
      // single static ring pretending to be the finished spec. Approximated
      // instead with a static double ring, which at least reads as more
      // than a plain outline at a glance.
      g.lineStyle(2, 0xff5555, 0.9);
      g.strokeCircle(cx, cy, r + 3);
      g.lineStyle(1, 0xff5555, 0.5);
      g.strokeCircle(cx, cy, r + 6);
    }

    // Gear-tier pips (GDD §12: "one pip per step above G, top-right").
    // engine/units.ts's BattleUnit.tier carries the raw Tier letter for
    // exactly this; a Bloom unit never has one, so it correctly draws none
    // — "gear" isn't a Bloom concept.
    if (unit.tier) {
      const pips = tierPipCount(unit.tier);
      if (pips > 0) {
        const pipR = Math.max(1, ts * 0.05);
        const originX = this.boardX + pos.x * ts + ts - pipR * 2;
        const originY = this.boardY + pos.y * ts + pipR * 2;
        g.fillStyle(0xd4af37, 0.95);
        for (let i = 0; i < pips; i++) {
          const col = i % 3;
          const row = Math.floor(i / 3);
          g.fillCircle(originX - col * pipR * 2.4, originY + row * pipR * 2.4, pipR);
        }
      }
    }

    // Overwatch tell: amber targeting brackets at the four corners of the
    // unit's tile. Deliberately not another ring or another alpha — a
    // collapsed Bloom already owns the red ring at r+3, and "has acted"
    // already owns alpha 0.55 (which an overwatching unit also has, since
    // holding fire spends its turn). Corner brackets sit outside every unit
    // silhouette in drawUnit above, so they read the same on a Meeps
    // triangle, a Tank square and a Reeps diamond, and they don't collide
    // with the shield bar's real estate above the unit either.
    if (unit.overwatch) {
      const half = ts * 0.45;
      const arm = ts * 0.18;
      g.lineStyle(2, 0xfbbf24, 0.95);
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const x = cx + sx * half;
        const y = cy + sy * half;
        g.lineBetween(x, y, x - sx * arm, y);
        g.lineBetween(x, y, x, y - sy * arm);
      }
    }

    // Ability-depth tells (23 Aug 2026). Both are tile-edge marks rather
    // than more rings or more alpha, for the same reason the overwatch
    // brackets are: r+3 already belongs to the collapsed-Bloom red ring and
    // alpha 0.55 already means "has acted."
    //
    // Concealed (abil_ambush / abil_screen): a violet frame inset inside
    // the tile — this unit is on the board but off the Bloom's map.
    if (unit.concealed) {
      g.lineStyle(2, CONCEAL_COLOR, 0.95);
      g.strokeRect(this.boardX + pos.x * ts + 2, this.boardY + pos.y * ts + 2, ts - 5, ts - 5);
    }
    // Painted by an unexpired Sensor Sweep: a violet ring wider than the
    // silhouette, so the player can tell at a glance which contacts they
    // can only see because Anand ran the array — and which ones will
    // therefore vanish again when the paint expires.
    if (unit.side === "hostile" && this.mission.isRevealed(unit.instanceId)) {
      g.lineStyle(2, SWEEP_COLOR, 0.9);
      g.strokeCircle(cx, cy, r + 5);
    }
    // Extraction target tell (30 Aug 2026 — see drawHud's own "Extract:"
    // line comment for the full report and root cause). Points straight at
    // the one unit that has to reach an exit tile, on the board itself, not
    // just in the side panel text — a green ring, same hue family as
    // TILE_COLORS.exit and Hold Zone's own "objective satisfied" green, so
    // green already reads as "this is the extraction thing" everywhere else
    // on this board. Only ever the single-target shape (Mission 31's
    // civilian convoy doesn't set extractUnitId, so this simply never
    // matches there — see engine/mission.ts's checkExtraction for why the
    // two shapes are mutually exclusive per mission). Reads
    // resolvedExtractionTargetId, not the literal configured
    // objectiveParams.extractUnitId — 31 Aug 2026 role-fallback pass
    // (engine/mission.ts's tagExtractionTarget comment): the named pilot
    // may never have been deployed this run, in which case this ring needs
    // to follow whoever the role actually transferred to, not point at
    // nobody.
    if (this.mission.mission.objective === "extract_unit" && unit.instanceId === this.mission.resolvedExtractionTargetId) {
      g.lineStyle(3, 0x22c55e, 0.95);
      g.strokeCircle(cx, cy, r + 6);
    }

    // HP bar(s) above the unit.
    const barW = ts * 0.8;
    const barX = cx - barW / 2;
    const barY = cy - ts / 2 - 6;
    if (unit.kind === "bloom" && unit.maxEndurance !== undefined) {
      const enduranceFrac = unit.maxEndurance > 0 ? (unit.endurance ?? 0) / unit.maxEndurance : 0;
      const vitalityFrac = (unit.vitality ?? 0) / (BLOOM[unit.archetypeId]?.vitality || 1);
      g.fillStyle(0x222222, 0.9);
      g.fillRect(barX, barY, barW, 5);
      g.fillStyle(0x60a5fa, 1);
      g.fillRect(barX, barY, barW * enduranceFrac, 2.5);
      g.fillStyle(0xf87171, 1);
      g.fillRect(barX, barY + 2.5, barW * vitalityFrac, 2.5);
    } else {
      const frac = Math.max(0, unit.currentHp / unit.maxHp);
      g.fillStyle(0x222222, 0.9);
      g.fillRect(barX, barY, barW, 4);
      g.fillStyle(frac > 0.5 ? 0x4ade80 : frac > 0.25 ? 0xfacc15 : 0xef4444, 1);
      g.fillRect(barX, barY, barW * frac, 4);

      // Tank shield house rule — an extra blue line above the HP bar,
      // shown only while the unit is actually in an eligible Tank's radius.
      if (unit.maxShield && unit.maxShield > 0) {
        const shieldFrac = Math.max(0, (unit.shield ?? 0) / unit.maxShield);
        const shieldY = barY - 4;
        g.fillStyle(0x0c2a3d, 0.9);
        g.fillRect(barX, shieldY, barW, 3);
        g.fillStyle(0x38bdf8, 1);
        g.fillRect(barX, shieldY, barW * shieldFrac, 3);
      }
    }
  }

  /** "Xh Ym" (or "Ym" under an hour) — the HUD's sortie-clock readout. Floors rather than rounds so it never claims more time has passed than actually has. */
  private formatSortieElapsed(elapsedMs: number): string {
    const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  /**
   * How many visual lines `text` will actually render as once word-wrapped at `charsPerLine` — a greedy
   * word-wrap simulation (break on spaces, respect existing "\n" breaks), not a flat character-count
   * division. Both hudText and logText are monospace, so this matches Phaser's own wordWrap layout closely:
   * every character is the same width, so wrapping by character count is equivalent to Phaser's real
   * pixel-width wrapping for this font.
   *
   * Claude, 4 Sep 2026: added while chasing a real bug found in the Track 1 screenshot pass (see
   * Bloom_Wars_UI_Improvement_Plan_v1.md). fitLines used to estimate a long entry's height as
   * `Math.ceil(line.length / charsPerLine)`, which assumes every wrapped line is packed to the last
   * character. Real word-wrap breaks at word boundaries and routinely leaves several characters unused per
   * line, so that flat estimate under-counted the true height of any long prose entry (worst case: the
   * mission briefing, which can run several hundred characters). fitLines let more content through than
   * actually fit between HUD_TOP and LOG_TOP, and since hudText has no mask or hard bottom clip, the real
   * (correctly wrapped) text just kept growing past LOG_TOP and started drawing over logText's own content —
   * visible as the HUD's "Objective:" line overlapping turn 1's own "(dialogue) ..." log entry on any
   * mission with both a long briefing and an extra objective-status line (hold_zone, extract_unit with
   * civilianSpawns) pushing it over the old, too-generous budget.
   */
  private wrappedLineCount(text: string, charsPerLine: number): number {
    let total = 0;
    for (const paragraph of text.split("\n")) {
      if (paragraph.length === 0) {
        total += 1;
        continue;
      }
      let lineLen = 0;
      let lines = 1;
      for (const word of paragraph.split(" ")) {
        const candidate = lineLen === 0 ? word.length : lineLen + 1 + word.length;
        if (candidate > charsPerLine && lineLen > 0) {
          lines += 1;
          lineLen = word.length;
        } else {
          lineLen = candidate;
        }
      }
      total += lines;
    }
    return Math.max(1, total);
  }

  /** Takes as many leading entries as fit in `top..bottom` once wrapped at `charsPerLine`. */
  private fitLines(lines: string[], top: number, bottom: number, lineH: number, charsPerLine: number): string[] {
    const budget = Math.floor((bottom - top) / lineH);
    const out: string[] = [];
    let used = 0;
    for (const line of lines) {
      const wrapped = this.wrappedLineCount(line, charsPerLine);
      if (used + wrapped > budget) break;
      out.push(line);
      used += wrapped;
    }
    return out;
  }

  private drawHud() {
    const m = this.mission;
    // eliminate_all has no turn-limit fail condition any more (Maxime, 22
    // Aug 2026 — see engine/mission.ts checkWinLoss) — the turn count is
    // still shown, but as a bonus-scoring target, not a deadline, so it
    // doesn't read like a clock the player can lose to. hold_zone and
    // extract_unit still have a real deadline, so they keep the "/ limit"
    // framing.
    const turnLine =
      m.mission.objective === "eliminate_all"
        ? `Turn ${m.turn}  (bonus if clear by turn ${m.mission.objectiveParams.turnLimit})  —  ${m.phase} phase`
        : `Turn ${m.turn} / ${m.mission.objectiveParams.turnLimit}  —  ${m.phase} phase`;
    // Mission real-time clock (25 Aug 2026) — "add that timer as something
    // soldier keep track of," Maxime's own framing for why this needs to be
    // felt during play, not just discovered after a recall. A different
    // axis from turnLine above on purpose: turnLine is in-mission turns
    // (house rule #5 — no fail line), this is real wall-clock time since
    // BEAM DOWN, and IS a real deadline (engine/campaignState.ts's
    // MISSION_REAL_TIME_LIMIT_MS / evaluateMissionTimeout, enforced back at
    // scenes/Boot.ts on the next game load, not inside this scene). Always
    // visible, same as turnLine right above it — a clock nobody can see
    // isn't the feature Maxime asked for.
    const sortieLine = `Sortie clock: ${this.formatSortieElapsed(Date.now() - this.missionStartedAt)} elapsed — Command recalls a lance past 12h`;
    // The briefing is the first thing to go when a unit is selected. It's six
    // wrapped lines of text the player has already read, and the ability-depth
    // pass added up to five status lines plus four legend lines below it —
    // which is exactly how much room the briefing was using. Selected-unit
    // state is live and the briefing isn't, so the briefing yields.
    const lines = [m.mission.displayName, turnLine, sortieLine, "", `Objective: ${m.mission.objective}`];
    // Protect Asset (Mission 22, 25 Aug 2026) — the ship's HP has no other
    // on-screen representation (it's not a unit, per data/types.ts's own
    // "off-board asset" framing), so this is the only place a player can
    // see it. Always shown, not just while a unit is selected, same as the
    // Objective line right above it.
    // Label was hardcoded "Providence" until House Amaranth's Mission 22
    // (31 Aug/1 Sep 2026) needed a different one for the same objective
    // type — see engine/mission.ts's Mission.assetName comment.
    if (m.mission.objective === "protect_asset") lines.push(`${m.assetName}: ${m.assetHp}/${m.assetMaxHp} HP`);
    // Hold Zone status line (30 Aug 2026) — see drawBoard's own teal-marker
    // comment for the full "reached the turn limit, nobody died, mission
    // failed anyway" bug this closes. Same always-shown treatment as
    // Providence's HP line right above: this is the actual win condition,
    // not an action preview, so it stays visible whether or not a unit is
    // selected. Text status mirrors the board's own fill color exactly
    // (green/red/teal) so a player who only reads the HUD panel — or is
    // colorblind to the on-map wash — gets the same information either way.
    if (m.mission.objective === "hold_zone") {
      const hold = m.map.holdZone ?? [];
      const holdUntil = m.mission.objectiveParams.holdUntilTurn ?? m.mission.objectiveParams.turnLimit;
      const livingNow = m.livingUnits();
      const playerOnHold = livingNow.some((u) => u.side === "player" && !u.downed && hold.some((c) => coordKey(c) === coordKey(u.pos)));
      const hostileOnHold = livingNow.some((u) => u.side === "hostile" && !u.downed && hold.some((c) => coordKey(c) === coordKey(u.pos)));
      let zoneStatus: string;
      if (hostileOnHold) zoneStatus = "CONTESTED — a hostile is on the zone";
      else if (m.turn >= holdUntil && playerOnHold) zoneStatus = "HELD — objective clear";
      else if (playerOnHold) zoneStatus = `standing by (holds from turn ${holdUntil})`;
      else zoneStatus = "EMPTY — no one is standing on it";
      lines.push(`Hold Zone (teal tile${hold.length > 1 ? "s" : ""}): ${zoneStatus}`);
    }
    // Extraction objective status line (30 Aug 2026, Maxime, Mission 17: "I
    // couldnt find out which unit need extraction so I failed the mission.
    // need more extraction square maybe to fit the number of fielded
    // unit"). Same bug shape as Hold Zone just above, same fix: the raw
    // "Objective: extract_unit" enum on its own never said WHICH unit has
    // to reach a (green) exit tile, or that it's only one — a squad of 5-10
    // deployed had no way to tell "everyone" from "just this one" apart.
    // It isn't that this mission type needs more exit tiles (every extract
    // map already has a small exit cluster; Mission 17's own map has four
    // exit cells at its far corner) — the player just had no way to know
    // only Solheim mattered. drawUnit's own
    // green ring (below) marks the same unit on the board itself, so a
    // player doesn't have to keep re-reading this panel mid-fight. Single-
    // target missions win the instant the target reaches an exit (see
    // checkWinLoss), so there's no "already extracted, still fighting"
    // state to show here — only "still out there" or "downed, lost."
    // Multi-civilian missions (Mission 31, The Last Convoy) are a genuinely
    // different shape — several NPCs, a threshold, not everyone has to make
    // it — so they get a running tally instead of a single name.
    if (m.mission.objective === "extract_unit") {
      if (m.mission.civilianSpawns?.length) {
        const total = m.mission.civilianSpawns.length;
        const threshold = m.mission.objectiveParams.extractThreshold ?? total;
        lines.push(`Extraction (green exit tiles): ${m.extractedCivilianCount}/${threshold} needed out (of ${total} total)`);
      } else {
        // resolvedExtractionTargetId, not the literal configured
        // objectiveParams.extractUnitId — 31 Aug 2026 role-fallback pass
        // (engine/mission.ts's tagExtractionTarget comment). Reading the
        // literal id here used to be able to show "extracted — clear" from
        // turn 1 when the named pilot was never even deployed (target
        // undefined reads as the already-extracted state below), which is
        // exactly backwards — nothing had happened, and the real win
        // condition could never fire either.
        const targetId = m.resolvedExtractionTargetId;
        const target = targetId ? m.unitById(targetId) : undefined;
        const status = !target ? "extracted — clear" : target.downed ? "DOWNED — mission lost" : "still in the field — get them to a green exit tile";
        lines.push(`Extract: ${target?.displayName ?? "target"} (${status})`);
      }
    }
    // Index 4 (not 3), since sortieLine above pushed everything down one —
    // splices the briefing+blank in ahead of the "Objective:" line exactly
    // as before, just accounting for the new sortieLine entry at index 2.
    // 2 Sep 2026 — the hover block moved out of this panel and onto the
    // cursor (see updateHoverTip below). It used to be computed here so the
    // briefing could yield to it; with the hover content gone from the
    // panel entirely there's nothing left to yield to, so the briefing is
    // simply shown whenever no unit is selected. That also retires the
    // fitLines-trimming problem the old arrangement caused (both blocks
    // competing for the same panel budget, caught in the 1 Sep headless
    // smoke test) rather than working around it.
    if (!this.selectedUnitId) lines.splice(4, 0, m.mission.briefing, "");
    if (this.selectedUnitId) {
      const selected = m.unitById(this.selectedUnitId);
      if (selected) {
        lines.push("", `${selected.displayName}: ${selected.actionsRemaining} action(s) left`);
        // Field Doctor (1 Sep 2026): the one case where "0 actions left"
        // alone would read as "nothing more to do here" when it isn't —
        // this unit can still Repair once, free, if the bonus is off
        // cooldown. Silent otherwise (branch not equipped, or on cooldown)
        // so this doesn't clutter the panel for every other Munti.
        if (m.fieldDoctorReady(selected.instanceId)) lines.push("FIELD DOCTOR — one free Repair ready");
        if (selected.overwatch && selected.concealed) lines.push("AMBUSH — unseen, holding a shot");
        else if (selected.overwatch) lines.push("ON OVERWATCH — holding fire");
        else if (selected.concealed) lines.push("CONCEALED — the Bloom cannot see this unit");
        if (selected.braced) lines.push("BRACED — pins hostiles that step alongside");
        if (selected.taunting) lines.push("TAUNTING — every hostile that can see this unit targets it first");
        // No "spent" status line here, deliberately — Taunt is a reusable
        // posture now (30 Aug 2026 no-charge redesign, same as Ambush just
        // above), not a once-per-mission charge, so there's nothing to
        // report as spent. Mirrors Ambush's own UI, which never had one.
        if (selected.abilities.includes("abil_sensor_sweep")) {
          const charges = m.sensorSweepChargesRemaining(selected.instanceId);
          lines.push(charges > 0 ? `Sensor Sweep: ${charges} charge(s) left this mission` : "Sensor Sweep: spent for this mission");
        }
        if (selected.abilities.includes("abil_screen") && selected.usedScreenThisMission) {
          lines.push("Screen: spent (once per mission)");
        }
        if (selected.carryingRescueId) lines.push("CARRYING — cannot attack until they're out");
      }
    }
    // Vital Signs Uplink (2 Sep 2026) — the carrier module's whole effect.
    // Fires only when the Munti you have left is the LAST one and it's
    // hurt: losing your only field doctor is the quiet way a run ends, and
    // the existing HUD gives you no reason to look at their HP bar until
    // it's already too late. Placed above the legends with the other
    // decision-support lines, since fitLines trims from the bottom and
    // this is the one line here a player must not miss.
    if (this.vitalSignsUplink) {
      const munti = m.livingUnits().filter((u) => u.side === "player" && !u.downed && findPilot(u.pilotId ?? "") && UNIT_ARCHETYPES[findPilot(u.pilotId ?? "")?.archetypeId ?? ""]?.path === "munti");
      if (munti.length === 1) {
        const last = munti[0];
        if (last.currentHp <= last.maxHp * VITAL_SIGNS_WARN_FRACTION) {
          lines.push("", `!! VITAL SIGNS — ${last.displayName} is your last Munti, at ${last.currentHp}/${last.maxHp}`);
        }
      }
    }
    // Highlight legend — only for the colours actually on the board right
    // now, so the panel doesn't turn into a permanent key.
    if (this.repairable.length) lines.push("", "Cyan tile = Repair target (+HP, instead of attacking)");
    if (this.screenable.length) lines.push("", `Pink tiles = Screen would conceal ${this.screenable.length} unit(s)`);
    if (this.interdictZone.length) lines.push("", "Orange tiles = ground Interdict would pin");
    if (this.sweepArea.length) lines.push("", "Violet box = Sensor Sweep reach");
    if (this.rescuableNpc.length) lines.push("", "Gold tile = Rescue (adjacent, downed pilot)");
    if (this.clearableBloom.length) lines.push("", `Gold tiles = ${this.clearableBloom.length} bloom mat tile(s) Clear would flip`);
    if (this.fireSupportTargeting) lines.push("", `Blue tiles = Fire Support strike center (shared, ${m.fireSupportChargesRemaining} charge(s) left) — click to call it in, or click elsewhere to cancel`);
    if (this.missileTargeting && this.selectedUnitId)
      lines.push("", `Blue tiles = MISSILE target (${m.missileChargesRemaining(this.selectedUnitId)} charge(s) left) — splash hits EVERYONE within 1 tile, allies included. Click to fire, Esc/right-click to cancel`);
    if (this.cinderLineTargeting)
      lines.push("", `Orange tiles = SURTR line endpoints, up to ${CINDER_LINE_MAX_TILES} tiles — click one to set the whole run burning, either side, no exception. Esc/right-click to cancel`);
    if (m.getActiveSurtrLines().length) lines.push("", "Dark red tiles = an active Surtr line — burns anything standing on it, either side");
    if (this.cuttingRoomChargeTargeting)
      lines.push("", `Indigo tiles = ZANRETSU line endpoints, up to ${CUTTING_ROOM_CHARGE_MAX_LINE_TILES} tiles — click one to charge the whole run, full commitment, ends the turn. Esc/right-click to cancel`);
    if (this.lastWordSignatureTargeting)
      lines.push("", "Emerald tile = MIGAWARI target — fully restores a downed ally, permanently reduces the wielder's own max HP. Esc/right-click to cancel");
    if (this.lastRitesTargeting)
      lines.push("", "Amber tile = LAST RITES target — one final action for an ally downed this turn, then they go back down. Esc/right-click to cancel");
    if (this.beaconTargeting)
      lines.push(
        "",
        `Sky-blue tile = BEACON target — fully restocks a downed ally, costs a crate (their own Fabricator spare part if their mek has one, else Restock Room stock: ${m.beaconCratesRemaining} left)${
          m.beaconChargesRemaining > 0 ? " and a Restock Room charge (waived with a living Munti on the field)" : " (no Restock Room charges left — needs a living Munti on the field to use anyway)"
        }. Esc/right-click to cancel`
      );
    if (this.requiemTargeting)
      lines.push(
        "",
        `Bone-white tiles = GJALLAR direction — an unconditional ${SEVERANCE.shape.length}-tile beam, ${SEVERANCE.damage} fixed damage, EVERYONE on it including your own unit, no exception. Click to fire, Esc/right-click to cancel`
      );
    if (this.maserLanceTargeting && this.selectedUnitId)
      lines.push(
        "",
        `Rose tiles = MASER LANCE direction (${m.maserLanceChargesRemaining(this.selectedUnitId)} charge(s) left) — click one to fire a widening cone that way, ${MASER_LANCE_CONE_RANGE} tiles deep, allies included. Esc/right-click to cancel`
      );
    // Gjallar's charge meter — shown whenever the party actually holds it
    // this mission (a living player unit carries requiem_severance),
    // independent of whether it's currently armed, so the player can watch
    // it fill toward SEVERANCE.maxCharge over the course of the fight the
    // same way GDD §8.3 describes ("the meter appears... the player learns
    // it exists").
    {
      const requiemWielder = this.mission.livingUnits().find((u) => u.side === "player" && u.abilities.includes("requiem_severance"));
      if (requiemWielder) {
        lines.push("", `Gjallar charge (${requiemWielder.displayName}): ${this.mission.getRequiemCharge()}/${SEVERANCE.maxCharge}`);
      }
    }
    // Same legend treatment as every highlight above, for the terrain
    // itself rather than an action preview — green exit tiles are drawn as
    // base terrain (TILE_COLORS.exit) on every extract_unit map already, so
    // there was never a missing highlight here, just no line anywhere
    // saying what that green terrain meant. See drawHud's "Extract:" line
    // and drawUnit's green ring, just above, for the rest of this same fix.
    if (m.mission.objective === "extract_unit") lines.push("", "Green tiles = Exit — green ring on the board marks who has to reach one");
    // Standing tallies, so the player can see their firing line is set
    // without having to re-select each unit. Amber brackets on the board
    // mark overwatchers, violet frames mark the concealed, an orange ring
    // marks interdicted ground and a violet ring marks a painted contact
    // (see drawUnit).
    const players = m.livingUnits().filter((u) => u.side === "player");
    const holding = players.filter((u) => u.overwatch).length;
    const hidden = players.filter((u) => u.concealed).length;
    const bracing = players.filter((u) => u.braced).length;
    const painted = m.livingUnits().filter((u) => u.side === "hostile" && m.isRevealed(u.instanceId)).length;
    if (holding) lines.push("", `Amber brackets = overwatch (${holding})`);
    if (hidden) lines.push(`Violet frames = concealed (${hidden})`);
    if (bracing) lines.push(`Orange ring = interdicted ground (${bracing})`);
    if (painted) lines.push(`Violet rings = swept contacts (${painted})`);
    // Hard stop at the log's top edge. Same wrapped-line budgeting the log
    // itself does below, for the same reason: counting ENTRIES rather than
    // rendered lines is what let the old flat log slice run off the canvas,
    // and the HUD gained enough conditional lines this pass to have the same
    // problem in the other direction — a selected vibrissal Munti with a
    // screen up can produce five status lines and four legend lines on top of
    // the fixed header. Everything above the cut is ordered most-important-
    // first (mission, turn, objective, selected unit, then legends, then
    // standing tallies), so a trim only ever loses the tallies.
    this.hudText.setText(this.fitLines(lines, HUD_TOP, LOG_TOP, HUD_LINE_H, HUD_CHARS_PER_LINE).join("\n"));
    // The cursor tip is refreshed from the same pass that rebuilds the HUD,
    // so selecting a unit (which changes the forecast) updates the box
    // under a stationary pointer without waiting for the next mouse move.
    this.updateHoverTip();

    // Fit as many of the most recent log lines as actually fit between the
    // HUD block and the OVERWATCH button, newest last. This used to be a
    // flat slice(-14), which counted log ENTRIES, not the wrapped lines
    // they render as — a run of long entries (the reaction-fire and
    // Meeps-dodge lines are both long) spilled the panel down past the
    // buttons and out of the canvas, which is exactly where an overwatch
    // shot's own line ended up. Budgeting in wrapped lines instead keeps
    // the newest events on screen whatever their length.
    // Newest-last, so the tail is fitted in reverse and flipped back.
    const tail = this.fitLines([...m.log].reverse(), LOG_TOP, LOG_BOTTOM, LOG_LINE_H, LOG_CHARS_PER_LINE).reverse();
    this.logText.setText(tail.join("\n"));
  }

  /**
   * Push the current hover content into the cursor tip (2 Sep 2026).
   *
   * hoverLines() is unchanged and still the single source of that content —
   * this only decides whether to draw it and where. Hidden outright once
   * the mission is over, since the end-of-mission overlay owns the screen
   * at that point and a tip floating over it reads as a bug.
   */
  private updateHoverTip(): void {
    if (!this.hoverTip) return;
    if (this.mission.outcome !== "ongoing") {
      this.hoverTip.hide();
      return;
    }
    // Action-bar tooltip pass, 11 Sep 2026 — an action-bar button sits
    // outside the board grid, so pixelToTile() under it reads as "no tile
    // hovered" and hoverLines() below would return nothing (or, worse,
    // whatever tile the pointer last crossed on its way there). Checked
    // first and returns early so the two hover systems never fight over
    // the same box; see hoveredActionSlot's own field comment.
    if (this.hoveredActionSlot !== null) {
      const lines = this.actionSlotTooltipLines(this.hoveredActionSlot);
      if (lines) this.hoverTip.show(lines, this.pointerX, this.pointerY);
      else this.hoverTip.hide();
      return;
    }
    this.hoverTip.show(this.hoverLines(), this.pointerX, this.pointerY);
  }

  /**
   * Tooltip content for action-bar slot `index`, or null to show nothing
   * (an empty slot, the MORE page-turn button, or a verb outside
   * BASE_ABILITY_TOOLTIPS' deliberate base-kit-only coverage — see that
   * const's own header). Reads this.slotOptions live rather than a value
   * captured at pointerover time, for the same reason hoveredActionSlot
   * itself does: the option bound to a slot can change while the pointer
   * never leaves the button (a fresh drawActionBar() mid-hover, e.g. after
   * a MORE click or a new unit selection under a stationary mouse).
   */
  private actionSlotTooltipLines(index: number): string[] | null {
    const option = this.slotOptions[index];
    if (!option) return null;
    const key = stripActionChargeSuffix(option.label);
    const body = BASE_ABILITY_TOOLTIPS[key];
    if (body) return [option.label, "", ...wrapTipText(body, 42)];
    // Heirloom-exclusive signature verbs, 12 Sep 2026 — not in
    // BASE_ABILITY_TOOLTIPS (see that const's own header for why), looked
    // up here instead against the CURRENT wielder's own live rank so
    // rank1 and rank5 text is never mixed up. actionBarUnitId, not
    // selectedUnitId — see that field's own comment for why it's the
    // correct source of "whose kit is this bar showing right now."
    const heirloomId = HEIRLOOM_ABILITY_ID_BY_LABEL[key];
    if (!heirloomId) return null;
    const unit = this.actionBarUnitId ? this.mission.unitById(this.actionBarUnitId) : undefined;
    if (!unit) return null;
    const rank = unit.heirloomAbilityRanks?.[heirloomId] ?? 1;
    const heirloomBody = heirloomAbilityTooltipBody(heirloomId, rank, this.mission.getRequiemCharge());
    if (!heirloomBody) return null;
    return [option.label, "", ...wrapTipText(heirloomBody, 42)];
  }

  /** The living unit under the pointer, if any — hostiles only when the player side can currently see them (fog of war). */
  private hoveredUnit(): BattleUnit | undefined {
    if (!this.hoverTile) return undefined;
    const h = this.hoverTile;
    const unit = this.mission.livingUnits().find((u) => u.pos.x === h.x && u.pos.y === h.y);
    if (!unit) return undefined;
    if (unit.side === "hostile" && !this.visibleHostileIds().has(unit.instanceId)) return undefined;
    return unit;
  }

  /** Plain-words description of a Bloom archetype's on-hit effect, from data/bloom.ts's own table. */
  private describeOnHit(fxId: string | undefined): string | null {
    if (!fxId) return null;
    const fx = BLOOM_ON_HIT_EFFECTS[fxId];
    if (!fx || fx.kind === "none") return null;
    if (fx.kind === "acid_dot") return `on hit: acid — ${fx.magnitude} dmg/turn for ${fx.duration} turns, fouls the tile`;
    if (fx.kind === "debuff_attack") return `on hit: -${Math.round(fx.magnitude * 100)}% attack for ${fx.duration} turns, spreads to nearby allies`;
    return `on hit: knocks the target back ${fx.magnitude} tile`;
  }

  /** The active Surtr line (if any) whose tiles include `c`, for hoverLines' own burning-tile readout — Mission.getActiveSurtrLines() is the single source, this is purely a lookup. */
  private surtrLineAt(c: Coord): { damagePerTurn: number; turnsRemaining: number } | undefined {
    const key = coordKey(c);
    for (const line of this.mission.getActiveSurtrLines()) {
      if (line.tiles.some((t) => coordKey(t) === key)) return line;
    }
    return undefined;
  }

  /** The HUD's hover block — see drawHud's call site for the priority order. */
  private hoverLines(): string[] {
    const m = this.mission;
    const out: string[] = [];
    if (!this.hoverTile || m.outcome !== "ongoing") return out;
    const selectedId = this.selectedUnitId;
    const h = this.hoverTile;

    // Armed strike over a legal tile: who's in the blast.
    if (selectedId && (this.fireSupportTargeting || this.missileTargeting)) {
      const kind = this.fireSupportTargeting ? "fire_support" : "missile";
      const range = this.fireSupportTargeting ? this.fireSupportRange : this.missileRange;
      if (range.some((c) => coordKey(c) === coordKey(h))) {
        const victims = m.forecastSplash(selectedId, h, kind);
        out.push("", `BLAST at (${h.x},${h.y}): ${victims.length === 0 ? "nobody inside" : ""}`);
        for (const v of victims) {
          out.push(`  ${v.displayName}${v.side === "player" ? " [FRIENDLY]" : ""}: ${v.damage} dmg${v.downed ? " — DOWNED" : ""}`);
        }
      }
      return out;
    }

    // Cinder Line, armed: which tiles a click here would actually ignite —
    // the wash over the whole clickable area (every legal endpoint) can't
    // convey that on its own, same reasoning as the BLAST readout above.
    if (selectedId && this.cinderLineTargeting) {
      const preview = m.previewCinderLineFrom(selectedId, h);
      if (preview) {
        out.push("", `LINE at (${h.x},${h.y}): ${preview.length} tile(s), ${CINDER_LINE_DAMAGE_PER_TURN} dmg/turn, hits either side`);
      }
      return out;
    }

    // Gjallar, armed: same "the click-target wash can't show WHO gets hit"
    // reasoning as Cinder Line's own hover block just above, sharpened —
    // this is the one preview in the game that can and should report the
    // wielder's OWN name among the casualties, since GDD §8.2's "origin
    // unit included" means the acting unit is ALWAYS in this list the
    // instant it has a legal direction at all.
    if (selectedId && this.requiemTargeting) {
      const preview = m.previewRequiemSeverance(selectedId, h);
      if (preview) {
        const tileSet = new Set(preview.map((c) => coordKey(c)));
        const hit = m.livingUnits().filter((u) => tileSet.has(coordKey(u.pos)));
        const allies = hit.filter((u) => u.side === "player").length;
        const hostiles = hit.filter((u) => u.side === "hostile").length;
        out.push(
          "",
          `GJALLAR at (${h.x},${h.y}): ${preview.length} tile(s), ${SEVERANCE.damage} dmg fixed — ${hit.length} hit (${allies} of yours, ${hostiles} hostile), no exception`
        );
      }
      return out;
    }

    // Maser Lance, armed: same "the direction wash can't show WHO gets hit
    // or for how much" reasoning as Gjallar's own hover block just above,
    // sharpened the other way — unlike Gjallar's fixed damage, Maser Lance
    // runs the ordinary combat formula per victim (own stats, own terrain),
    // so this is a REAL per-target forecast (forecastMaserLance), the same
    // "see the number before you commit" BLAST readout Fire Support/Missile
    // already give, not just a tile/hit count.
    if (selectedId && this.maserLanceTargeting) {
      const preview = this.mission.previewMaserLanceCone(selectedId, h);
      if (preview) {
        const victims = this.mission.forecastMaserLance(selectedId, h);
        out.push("", `MASER LANCE at (${h.x},${h.y}): ${preview.length} tile(s)${victims.length === 0 ? ", nobody inside" : ""}`);
        for (const v of victims) {
          out.push(`  ${v.displayName}${v.side === "player" ? " [FRIENDLY]" : ""}: ${v.damage} dmg${v.downed ? " — DOWNED" : ""}`);
        }
      }
      return out;
    }

    // Zanretsu, armed: same "the click-target wash can't show WHO gets
    // charged through" reasoning as Cinder Line's own hover block just
    // above — this preview names every enemy actually on the run, not just
    // its tile count, since that's the number a player is really deciding
    // on.
    if (selectedId && this.cuttingRoomChargeTargeting) {
      const preview = m.previewCuttingRoomChargeFrom(selectedId, h);
      if (preview) {
        const tileSet = new Set(preview.map((c) => coordKey(c)));
        const hit = m.livingUnits().filter((u) => u.side === "hostile" && tileSet.has(coordKey(u.pos)));
        out.push("", `CHARGE at (${h.x},${h.y}): ${preview.length} tile(s)${hit.length ? `, ${hit.length} enemy(ies) in the run` : ", nothing there to hit"}`);
      }
      return out;
    }

    const hovered = this.hoveredUnit();
    // Bare ground (2 Sep 2026): feature-gap report C4's own second half —
    // "Hover a tile: terrain name and defence stars" — which the 1 Sep pass
    // never built, because in the side panel a terrain readout for every
    // idle mouse position would have been noise competing with the log. At
    // the cursor it costs nothing when you aren't pointing at anything.
    // Defence stars are the one number here a player genuinely can't infer
    // from the tile's colour, and cover is what decides where you stand.
    if (!hovered) {
      if (h.x < 0 || h.y < 0 || h.x >= m.map.width || h.y >= m.map.height) return out;
      const def = TILES[tileAt(m.map, h)];
      if (!def) return out;
      out.push(`${def.displayName} (${h.x},${h.y})`);
      out.push(def.defenceStars > 0 ? `Cover: ${"*".repeat(def.defenceStars)} (${def.defenceStars})` : "Cover: none");
      if (def.turnStartDamage) out.push(`Burns ${def.turnStartDamage} HP at turn start`);
      if (def.reepsRangeBonus) out.push(`+${def.reepsRangeBonus} range for Reeps standing here`);
      if (!def.passableGround) out.push("Impassable on the ground");
      const burning = this.surtrLineAt(h);
      if (burning) out.push(`SURTR LINE — ${burning.damagePerTurn} dmg/turn, ${burning.turnsRemaining} turn(s) left, hits either side`);
      return out;
    }

    // A target the selected unit can hit: the forecast.
    if (selectedId && this.attackable.some((a) => a.instanceId === hovered.instanceId)) {
      const f = m.forecastAttack(selectedId, hovered.instanceId);
      const attacker = m.unitById(selectedId);
      if (f && attacker) {
        const pct = (p: number) => `${Math.round(p * 100)}%`;
        out.push("", `FORECAST — ${attacker.displayName} → ${hovered.displayName}`);
        // Runemaster initiative (6 Sep 2026): the defender counters FIRST,
        // so the forecast reads in that order too — counter, then the hit
        // (or no hit at all, if the counter would put the attacker down).
        if (f.defenderStruckFirst) {
          let first = `${hovered.displayName} STRIKES FIRST (initiative): ${f.counterDamage} dmg to you`;
          if (f.counterDodgeChance > 0) first += `, you dodge ${pct(f.counterDodgeChance)}`;
          out.push(first, `→ ${attacker.displayName} at ${f.attackerHpAfter}/${attacker.maxHp}${f.attackerHpAfter <= 0 ? " — DOWN, your attack never lands" : ""}`);
          if (f.attackerHpAfter > 0) {
            let hit = `Then your hit: ${f.damage} dmg`;
            if (f.decloakStrike) hit += " (DECLOAK ×2)";
            else if (f.charged) hit += " (charge)";
            if (f.shieldAbsorbed > 0) hit += `, shield eats ${f.shieldAbsorbed}`;
            if (f.dodgeChance > 0) hit += `, ${pct(f.dodgeChance)} dodge`;
            out.push(hit, f.defenderDowned ? `→ ${hovered.displayName} goes DOWN` : `→ ${hovered.displayName} at ${f.defenderHpAfter}/${hovered.maxHp}`);
          }
          return out;
        }
        let hit = `Hit: ${f.damage} dmg`;
        if (f.decloakStrike) hit += " (DECLOAK ×2)";
        else if (f.charged) hit += " (charge)";
        if (f.shieldAbsorbed > 0) hit += `, shield eats ${f.shieldAbsorbed}`;
        if (f.dodgeChance > 0) hit += `, ${pct(f.dodgeChance)} dodge`;
        out.push(hit);
        out.push(f.defenderDowned ? `→ ${hovered.displayName} goes DOWN` : `→ ${hovered.displayName} at ${f.defenderHpAfter}/${hovered.maxHp}`);
        if (f.countered) {
          let back = `Counter: ${f.counterDamage} dmg back`;
          if (f.counterDodgeChance > 0) back += `, you dodge ${pct(f.counterDodgeChance)}`;
          out.push(back, `→ ${attacker.displayName} at ${f.attackerHpAfter}/${attacker.maxHp}${f.attackerHpAfter <= 0 ? " — DOWN" : ""}`);
        } else {
          out.push("No counter");
        }
        return out;
      }
    }

    // Anything else visible: the inspect card.
    if (hovered.kind === "bloom") {
      const arch = BLOOM[hovered.archetypeId];
      out.push("", `${hovered.displayName}${arch ? ` — ${arch.intelligence}` : ""}`);
      if (hovered.collapsed) out.push(`COLLAPSED — Vitality ${hovered.vitality ?? 0} (a hit of that much kills it)`);
      else out.push(`Endurance ${hovered.endurance ?? 0}/${hovered.maxEndurance ?? 0}, Vitality ${hovered.vitality ?? 0}`);
      out.push(`Hits for ${hovered.attackPower ?? "?"}, range ${hovered.attackRange[0]}-${hovered.attackRange[1]}, moves ${hovered.moveRange}, sees ${hovered.vision}`);
      const fx = this.describeOnHit(arch?.onHit);
      if (fx) out.push(fx);
      if (hovered.burrowed) out.push("BURROWED — surfaces to strike at ×1.5");
    } else {
      const who = hovered.side === "player" ? hovered.displayName : `${hovered.displayName} (hostile)`;
      out.push("", `${who} — ${hovered.path ?? "?"}${hovered.tier ? ` tier ${hovered.tier}` : ""}`);
      const shield = hovered.shield && hovered.shield > 0 ? ` +${hovered.shield} shield` : "";
      out.push(`HP ${hovered.currentHp}/${hovered.maxHp}${shield}, ATK ${hovered.effectiveAttack} DEF ${hovered.effectiveDefense}`);
      out.push(`Range ${hovered.attackRange[0]}-${hovered.attackRange[1]}, moves ${hovered.moveRange}, sees ${hovered.vision}${hovered.canCounter ? ", counters" : ""}`);
      const fx = hovered.statusEffects?.map((s) => (s.kind === "acid_dot" ? `acid ${s.turnsRemaining}t` : `-${Math.round(s.magnitude * 100)}% atk ${s.turnsRemaining}t`)) ?? [];
      if (fx.length) out.push(`Status: ${fx.join(", ")}`);
      const burning = this.surtrLineAt(hovered.pos);
      if (burning) out.push(`Standing on a Surtr line — ${burning.damagePerTurn} dmg at the next tick`);
      out.push(...this.loadoutLines(hovered));
    }
    return out;
  }

  /**
   * "What can this unit do that isn't a button" — equipped weapon branches
   * and mek-track passives, straight off BattleUnit's own precomputed
   * fields (baked once at deploy time by engine/units.ts from
   * data/weaponBranches.ts / data/meks.ts's MEK_TRACK_EFFECTS — nothing
   * here is re-derived or guessed at). This is the direct answer to the 11
   * Sep playtest note: "found by accident that one of his units could
   * heal — nothing told him that going in." Player units only — hostile
   * meks resolve through a bare archetype with no pilot/mek pairing
   * (Canon Pass §A.2's own note on arch_<path>_bipedal), so none of these
   * fields are ever set on them.
   */
  private loadoutLines(u: BattleUnit): string[] {
    if (u.side !== "player") return [];
    const out: string[] = [];
    const weapons = (u.weaponBranchIds ?? []).map((id) => WEAPON_BRANCHES[id]?.displayName).filter((n): n is string => !!n);
    if (weapons.length) out.push(`Weapons: ${weapons.join(", ")}`);
    if (u.stationaryHeal) out.push(`Self-repairs while stationary: ${u.stationaryHeal}/turn`);
    if (u.repairOutputMult && u.repairOutputMult !== 1) out.push(`Repairs allies at ×${u.repairOutputMult}`);
    // effectPotency scales the DURATION/DISTANCE of an on-hit effect this
    // unit inflicts through a weapon branch (acid, knockback, stun) — see
    // units.ts's own field comment. Not a generic "abilities are stronger"
    // multiplier, so this says exactly that rather than the vaguer phrasing
    // this line had before Maxime's fabricator-tooltip request (11 Sep,
    // round 2) caught the same imprecision in ShopPanel.ts's own
    // secondary-track tooltip and it got fixed there first.
    if (u.effectPotency && u.effectPotency !== 1) out.push(`On-hit effects (acid/knockback/stun) run ×${u.effectPotency} longer/further`);
    if (u.initiative) out.push(`+${u.initiative} initiative`);
    if (u.detectsBurrowedRadius) out.push(`Detects burrowed units within ${u.detectsBurrowedRadius}`);
    // !== undefined, not a truthy check: units.ts bakes 0 (has the
    // Fabricator track, no parts left) and undefined (no Fabricator track
    // at all) as two different facts on purpose — see its own field
    // comment — and this should say so too rather than collapsing "empty"
    // into "doesn't have one."
    if (u.fabricatorPartsRemaining !== undefined) out.push(`${u.fabricatorPartsRemaining} spare part(s) banked for Beacon Control`);
    return out;
  }

  private drawOverlayIfNeeded() {
    // Enemy-phase playback (9 Sep 2026): endPlayerTurn() resolves the whole
    // hostile phase — including any win/loss — before playback even starts,
    // so mission.outcome can already be non-"ongoing" while the board is
    // still mid-replay. Reusing isAnimatingMove here (the same lock a
    // player's own walk already sets) rather than adding a second gate:
    // the result screen has to wait for the SAME "board is in flux" window
    // that blocks every other input, or a mission-complete screen would pop
    // over units still visibly fighting.
    if (this.isAnimatingMove) {
      this.overlay.setVisible(false);
      return;
    }
    this.overlay.removeAll(true);
    if (this.mission.outcome === "ongoing") {
      this.overlay.setVisible(false);
      return;
    }
    this.overlay.setVisible(true);

    // Commander down (25 Aug 2026) — a distinct overlay, not a MISSION
    // FAILED reskin: no earnings readout, no Debrief, no permadeath roll
    // to report. See Mission.handleDowned() (engine/mission.ts) for where
    // this outcome actually gets set.
    if (this.mission.outcome === "commander_down") {
      this.drawCommanderDownOverlay();
      return;
    }

    // Tier 6 hotfix, 30 Aug 2026 — main.ts's own canvas grew (Hub.ts's chat
    // window, see that file's own header) so this backdrop now reads the
    // live camera size instead of the old hardcoded 960x640 — otherwise the
    // new strip of canvas on the right would show live gameplay peeking
    // out from under this "everything is dimmed" result screen instead of
    // actually being dimmed.
    const bg = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.72);
    const win = this.mission.outcome === "win";
    if (win && !this.missionWinStingPlayed) {
      this.missionWinStingPlayed = true;
      playSfx(this, "mission_win");
    }
    const title = this.add
      .text(480, 280, win ? "MISSION COMPLETE" : "MISSION FAILED", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: win ? "#4ade80" : "#ef4444",
      })
      .setOrigin(0.5);
    const extra = this.mission.removedFromRoster.length
      ? `Lost to extraction failure: ${this.mission.removedFromRoster.join(", ")}`
      : "";
    const sub = this.add.text(480, 330, extra, { fontFamily: "monospace", fontSize: "13px", color: "#e8e2d4" }).setOrigin(0.5);
    // Rescue-and-recruit bonus objective (23 Aug 2026) — the actual new
    // pilot is only minted at Debrief (generateRandomRescuedPilot needs a
    // live CampaignState, which this scene doesn't hold); this is just the
    // headline so the player knows to look for it there. null (not a text
    // object) when there's nothing to say, so the overlayExtras array below
    // stays clean rather than pushing an empty label.
    const rescueLine =
      this.mission.rescueOutcome === "succeeded" || this.mission.rescueOutcome === "failed"
        ? this.add
            .text(
              480,
              355,
              this.mission.rescueOutcome === "succeeded"
                ? "Rescue successful — a new recruit awaits at Debrief."
                : "The rescue attempt did not succeed.",
              { fontFamily: "monospace", fontSize: "12px", color: this.mission.rescueOutcome === "succeeded" ? "#4ade80" : "#8a97a6" }
            )
            .setOrigin(0.5)
        : null;
    // Debrief wiring (22 Aug 2026): this outcome overlay used to send the
    // player straight back to MapSelect, skipping the meta layer entirely.
    // It's kept exactly as-is (the win/loss beat is worth seeing, not
    // rushed past the instant `outcome` flips) — only the button's
    // destination changes. `this.mission` — the live Mission instance, not
    // a re-serialized copy of it — goes through Phaser's scene data as-is:
    // scene.start's data isn't JSON-serialized, it's handed to the next
    // scene by reference in the same JS heap, which is exactly what
    // engine/campaignEconomy.ts's computeMissionEarnings /
    // computeMissionCompletionBonus / computeCoBonus want (they all take a
    // live Mission directly) — see scenes/Debrief.ts's own header.
    const btn = this.add
      .rectangle(480, 390, 260, 40, 0x2e5c7a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("Debrief", { mission: this.mission }));
    const btnLabel = this.add.text(480, 390, "continue to debrief", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    this.overlay.add(rescueLine ? [bg, title, sub, rescueLine, btn, btnLabel] : [bg, title, sub, btn, btnLabel]);
  }

  /**
   * Commander down (25 Aug 2026) — Independent Campaign doc §6a: the
   * exempt pilot reaching 0 HP "ends the mission attempt outright and
   * sends the player back to the briefing screen to try again, with
   * nothing about that attempt ever resolving." Mirrors scenes/Boot.ts's
   * own RECALLED notice deliberately (same red title / grey clarifying
   * subtext / single "nothing was lost" line / one button shape) — both
   * screens exist to tell the player a mission attempt was voided through
   * no fault of the roster, not that they lost. The one real difference:
   * Boot's recall is caught on the NEXT load, after the fact; this fires
   * the instant it happens, mid-battle, because Battle.ts is the only
   * scene watching mission.outcome live.
   */
  private drawCommanderDownOverlay(): void {
    // Clear the mission real-time clock's activeMissionAttempt exactly
    // once, the first time this overlay draws — see
    // engine/campaignState.ts's applyCommanderDownAttempt for the full
    // reasoning and commanderDownAttemptCleared's own comment above for why
    // this needs the guard (this method runs on every redraw while the
    // overlay is up, not just once).
    if (!this.commanderDownAttemptCleared) {
      this.commanderDownAttemptCleared = true;
      const state = loadCampaignState();
      // Telemetry (1 Sep 2026, Player Telemetry Plan §2): a commander-down
      // attempt never reaches Debrief, so it's recorded here — the most
      // interesting failures would otherwise vanish from the stats. Same
      // single funnel Debrief uses (engine/telemetry.ts). Read startedAt
      // before applyCommanderDownAttempt clears it.
      recordHumanMissionSummary(this.mission, state, {
        outcome: "commander_down",
        startedAt: state?.activeMissionAttempt?.startedAt ?? this.missionStartedAt,
        pointsBefore: state?.points,
        pointsAfter: state?.points,
        rosterSizeBefore: activeRosterSize(state),
        rosterSizeAfter: activeRosterSize(state),
      });
      if (state) {
        applyCommanderDownAttempt(state);
        saveCampaignState(state);
      }
    }

    const commander = this.mission.commanderDownPilotId ? findPilot(this.mission.commanderDownPilotId) : undefined;
    const commanderName = commander?.displayName ?? "Command";

    // Tier 6 hotfix, 30 Aug 2026 — same camera-size fix as this file's other
    // full-screen dimming backdrop, right above (see its own comment).
    const bg = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.72);
    const title = this.add.text(480, 260, "COMMAND DOWN", { fontFamily: "monospace", fontSize: "36px", color: "#ef4444" }).setOrigin(0.5);
    const sub = this.add
      .text(480, 310, `${commanderName} is down — the attempt ends here.`, { fontFamily: "monospace", fontSize: "13px", color: "#e8e2d4" })
      .setOrigin(0.5);
    const note = this.add
      .text(
        480,
        344,
        "No permadeath roll. No earnings. The mission is simply available again — back to briefing to try again.",
        { fontFamily: "monospace", fontSize: "12px", color: "#8a97a6", wordWrap: { width: 640 }, align: "center" }
      )
      .setOrigin(0.5);
    const btn = this.add
      .rectangle(480, 400, 260, 40, 0x2e5c7a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MapSelect"));
    const btnLabel = this.add.text(480, 400, "return to briefing", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    this.overlay.add([bg, title, sub, note, btn, btnLabel]);
  }
}
