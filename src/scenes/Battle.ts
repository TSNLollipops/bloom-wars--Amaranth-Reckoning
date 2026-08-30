// src/scenes/Battle.ts
// The playable battle scene (Build Brief step 10). Placeholder geometric
// shapes per GDD §12 — everything drawn with Phaser Graphics, no art
// pipeline. This file owns NO game rules: every move/attack/turn call
// goes through engine/mission.ts, and what's drawn is only ever a
// reflection of that engine state (Build Brief §5.2's load-bearing line).
import Phaser from "phaser";
import type { BloomArchetype, Coord, TileType } from "../data/types";
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { Mission, type DeployRosterEntry } from "../engine/mission";
import type { BattleUnit } from "../engine/units";
import { coordKey } from "../engine/grid";
import { unitsVisibleToSide } from "../engine/ai";
import { BLOOM } from "../data/bloom";
import { findPilot, findMek } from "../data/pilotRegistry";
import { createWardenCampaignState, loadCampaignState, saveCampaignState, applyCommanderDownAttempt, hasSeenTutorial, markTutorialSeen } from "../engine/campaignState";
import { TILES } from "../data/tiles";
import { tierPipCount } from "../data/combatTables";

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

/** One entry in the contextual action bar. `usable` comes from the engine's own canX() predicate — this scene never re-derives one. */
interface ActionOption {
  label: string;
  usable: boolean;
  /** True when the verb ends the unit's turn (Overwatch/Ambush/Interdict), false when the unit keeps acting (Sweep/Screen). */
  endsTurn: boolean;
  run: () => void;
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
  // Mission real-time clock (25 Aug 2026) — wall-clock ms at BEAM DOWN, set
  // once in init(). See that method's own comment and
  // engine/campaignState.ts's "9. Mission real-time clock" section.
  private missionStartedAt = 0;
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
  private actionSlots: { btn: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private actionOptions: ActionOption[] = [];

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
    this.mission = new Mission(
      missionDef,
      this.resolveDeployRoster(missionDef.playerPilotIds, data.selectedPilotIds),
      loadCampaignState()?.builtBays ?? []
    );
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
    return roster;
  }

  create() {
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
    this.tutorialActive = this.mission.mission.id === "mission_amaranth_1" && !hasSeenTutorial();
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

    const doEndTurn = () => {
      if (this.mission.outcome !== "ongoing") return;
      if (this.isAnimatingMove) return; // board's mid-walk — same "can't act yet" beat as handleBoardClick
      this.selectedUnitId = null;
      this.clearSelectionHighlights();
      this.mission.endPlayerTurn();
      this.render();
    };
    const endTurnBtn = this.add
      .rectangle(835, 600, 200, 32, 0x2e5c7a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", doEndTurn);
    this.add.text(835, 600, "END TURN  [space]", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    endTurnBtn.setStrokeStyle(1, 0x4a7a9a);

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
    this.input.keyboard?.on("keydown-SPACE", doEndTurn);

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
        .on("pointerdown", () => this.runActionSlot(i));
      btn.setStrokeStyle(1, 0x4a7a9a);
      // 10px, down from the 4-slot grid's 11px (25 Aug 2026, fire support's
      // 3x2 layout) — narrower 70px buttons need the extra margin so
      // "OVERWATCH"/"INTERDICT" (the longest labels, 9 characters) don't
      // crowd the button edge.
      const label = this.add.text(p.x, p.y, "", { fontFamily: "monospace", fontSize: "10px", color: "#ffffff" }).setOrigin(0.5);
      this.actionSlots.push({ btn, label });
    }

    const backBtn = this.add
      .rectangle(835, 20, 200, 26, 0x1a2028)
      .setStrokeStyle(1, 0x3a4552)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MapSelect"));
    this.add.text(835, 20, "< mission select", { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6" }).setOrigin(0.5);
    void backBtn;

    this.overlay = this.add.container(0, 0).setVisible(false);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.handleBoardClick(p.x, p.y));

    this.render();
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
    const tile = this.pixelToTile(px, py);
    if (!tile) return;

    const unitHere = this.mission.livingUnits().find((u) => u.pos.x === tile.x && u.pos.y === tile.y);

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
      this.mission.attack(this.selectedUnitId, unitHere.instanceId);
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
    if (unitHere && unitHere.side === "player" && !unitHere.downed && !unitHere.npcIncapacitated && !unitHere.isCivilian && unitHere.actionsRemaining > 0) {
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
   */
  private animateWalk(unitId: string, path: Coord[], onComplete: () => void) {
    const STEP_MS = 130;
    this.isAnimatingMove = true;
    this.animatingUnitId = unitId;
    const visual = { x: path[0].x, y: path[0].y };
    this.animatingVisualPos = visual;

    let i = 0;
    const stepToNext = () => {
      if (i >= path.length - 1) {
        this.isAnimatingMove = false;
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

  private clearSelectionHighlights() {
    this.reachable = [];
    this.attackable = [];
    this.repairable = [];
    this.sweepArea = [];
    this.interdictZone = [];
    this.screenable = [];
    this.rescuableNpc = [];
    this.clearableBloom = [];
    this.fireSupportTargeting = false;
    this.fireSupportRange = [];
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
    if (this.fireSupportTargeting) return;
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
  }

  /**
   * After a Move, Repair, Sensor Sweep or Screen (the action-costing-but-
   * turn-continuing actions), keep the unit selected and refresh its
   * highlighted options if it still has an action left; otherwise deselect.
   * Attack, Overwatch, Ambush and Interdict all empty actionsRemaining
   * themselves and are handled by runActionSlot/handleBoardClick instead.
   */
  private refreshSelectionAfterAction() {
    const unit = this.selectedUnitId ? this.mission.unitById(this.selectedUnitId) : undefined;
    if (unit && !unit.downed && unit.actionsRemaining > 0) {
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
        },
      });
    }
    return out.slice(0, ACTION_SLOTS.length);
  }

  private runActionSlot(index: number) {
    if (this.mission.outcome !== "ongoing" || this.mission.phase !== "player") return;
    if (this.isAnimatingMove) return; // same lock as handleBoardClick — see animatingUnitId's field comment
    const option = this.actionOptions[index];
    if (!option || !option.usable) return;
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
    // The turn argument (ability-depth pass, 23 Aug 2026) is what lets an
    // abil_sensor_sweep paint show through the fog: a hostile whose
    // revealedUntilTurn hasn't expired counts as visible to the whole
    // player side regardless of distance, and regardless of being burrowed.
    // engine/ai.ts owns that expiry rule; this passes it the clock.
    return unitsVisibleToSide("player", this.mission.units, this.mission.turn);
  }

  private filterToVisibleHostiles(units: BattleUnit[]): BattleUnit[] {
    const visible = this.visibleHostileIds();
    return units.filter((u) => u.side !== "hostile" || visible.has(u.instanceId));
  }

  private render() {
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
    for (const u of this.repairable) {
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

    this.drawActionBar();
    this.drawHud();
    this.drawOverlayIfNeeded();
    this.updateTutorialHint();
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
    for (let i = 0; i < this.actionSlots.length; i++) {
      const slot = this.actionSlots[i];
      const option = this.actionOptions[i];
      if (!option) {
        slot.btn.setVisible(false);
        slot.label.setVisible(false);
        continue;
      }
      slot.btn.setVisible(true);
      slot.label.setVisible(true);
      slot.btn.setFillStyle(option.usable ? 0x2e5c7a : 0x1a2028);
      slot.btn.setStrokeStyle(1, option.usable ? 0x4a7a9a : 0x3a4552);
      slot.label.setText(option.label);
      slot.label.setColor(option.usable ? "#ffffff" : "#5a6572");
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
    // two shapes are mutually exclusive per mission).
    if (this.mission.mission.objective === "extract_unit" && unit.instanceId === this.mission.mission.objectiveParams.extractUnitId) {
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

  /** Takes as many leading entries as fit in `top..bottom` once wrapped at `charsPerLine`. */
  private fitLines(lines: string[], top: number, bottom: number, lineH: number, charsPerLine: number): string[] {
    const budget = Math.floor((bottom - top) / lineH);
    const out: string[] = [];
    let used = 0;
    for (const line of lines) {
      const wrapped = Math.max(1, Math.ceil(line.length / charsPerLine));
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
    if (m.mission.objective === "protect_asset") lines.push(`Providence: ${m.assetHp}/${m.assetMaxHp} HP`);
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
        const targetId = m.mission.objectiveParams.extractUnitId;
        const target = targetId ? m.unitById(targetId) : undefined;
        const status = !target ? "extracted — clear" : target.downed ? "DOWNED — mission lost" : "still in the field — get them to a green exit tile";
        lines.push(`Extract: ${target?.displayName ?? "target"} (${status})`);
      }
    }
    // Index 4 (not 3), since sortieLine above pushed everything down one —
    // splices the briefing+blank in ahead of the "Objective:" line exactly
    // as before, just accounting for the new sortieLine entry at index 2.
    if (!this.selectedUnitId) lines.splice(4, 0, m.mission.briefing, "");
    if (this.selectedUnitId) {
      const selected = m.unitById(this.selectedUnitId);
      if (selected) {
        lines.push("", `${selected.displayName}: ${selected.actionsRemaining} action(s) left`);
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
    // Highlight legend — only for the colours actually on the board right
    // now, so the panel doesn't turn into a permanent key.
    if (this.repairable.length) lines.push("", "Cyan tile = Repair target (+HP, instead of attacking)");
    if (this.screenable.length) lines.push("", `Pink tiles = Screen would conceal ${this.screenable.length} unit(s)`);
    if (this.interdictZone.length) lines.push("", "Orange tiles = ground Interdict would pin");
    if (this.sweepArea.length) lines.push("", "Violet box = Sensor Sweep reach");
    if (this.rescuableNpc.length) lines.push("", "Gold tile = Rescue (adjacent, downed pilot)");
    if (this.clearableBloom.length) lines.push("", `Gold tiles = ${this.clearableBloom.length} bloom mat tile(s) Clear would flip`);
    if (this.fireSupportTargeting) lines.push("", `Blue tiles = Fire Support strike center (shared, ${m.fireSupportChargesRemaining} charge(s) left) — click to call it in, or click elsewhere to cancel`);
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

  private drawOverlayIfNeeded() {
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
