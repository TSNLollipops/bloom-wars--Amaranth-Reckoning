// src/scenes/Battle.ts
// The playable battle scene (Build Brief step 10). Placeholder geometric
// shapes per GDD §12 — everything drawn with Phaser Graphics, no art
// pipeline. This file owns NO game rules: every move/attack/turn call
// goes through engine/mission.ts, and what's drawn is only ever a
// reflection of that engine state (Build Brief §5.2's load-bearing line).
import Phaser from "phaser";
import type { Coord, TileType } from "../data/types";
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { Mission, type DeployRosterEntry } from "../engine/mission";
import type { BattleUnit } from "../engine/units";
import { coordKey } from "../engine/grid";
import { unitsVisibleToSide } from "../engine/ai";
import { BLOOM } from "../data/bloom";
import { findPilot, findMek } from "../data/pilotRegistry";
import { createWardenCampaignState, loadCampaignState } from "../engine/campaignState";
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

// Right-hand panel layout. The log occupies the band between the HUD block
// and the contextual action bar; drawHud() budgets its lines against it.
const HUD_TOP = 12;
const LOG_TOP = 336;
const LOG_BOTTOM = 505; // top edge of the action bar's upper row
// Wrapped-line metrics for the 230px-wide panel: ~7.2px/char at 12px
// monospace for the HUD, ~6px/char at 10px for the log.
const HUD_LINE_H = 15;
const HUD_CHARS_PER_LINE = 31;
const LOG_LINE_H = 13;
const LOG_CHARS_PER_LINE = 38;

// The contextual action bar (ability-depth pass): a 2x2 grid of slots above
// END TURN, filled per selected unit with only the verbs that unit's kit
// actually contains. Four slots is headroom — the widest kit in the game is
// three (a vibrissal Munti: OVERWATCH + SCREEN + SWEEP). Kept as a fixed
// pool of Phaser objects rather than created/destroyed per selection, so
// nothing leaks and render() stays a pure refresh.
const ACTION_SLOTS: Coord[] = [
  { x: 784, y: 524 },
  { x: 886, y: 524 },
  { x: 784, y: 560 },
  { x: 886, y: 560 },
];
const ACTION_SLOT_W = 98;
const ACTION_SLOT_H = 30;

/** The five silhouettes drawUnit() ever draws — "blob" covers both Bloom units and any pilot/mech archetype missing a path (defensive fallback only). Shared between the fill pass and the outline helpers below it so both draw the exact same geometry. */
type SilhouetteKind = "blob" | "meeps" | "tank" | "reeps" | "munti";

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
    this.mission = new Mission(missionDef, this.resolveDeployRoster(missionDef.playerPilotIds, data.selectedPilotIds));
    this.selectedUnitId = null;
    this.clearSelectionHighlights();
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
    this.hudText = this.add.text(720, 12, "", { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4", wordWrap: { width: 230 } });
    // Log starts below the HUD block. Nudged down from 300 when overwatch
    // added two more possible HUD lines — at 300 a selected overwatching
    // unit's status wrote straight over the top of the log.
    this.logText = this.add.text(720, LOG_TOP, "", { fontFamily: "monospace", fontSize: "10px", color: "#8a97a6", wordWrap: { width: 230 } });

    const endTurnBtn = this.add
      .rectangle(835, 600, 200, 32, 0x2e5c7a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        if (this.mission.outcome !== "ongoing") return;
        this.selectedUnitId = null;
        this.clearSelectionHighlights();
        this.mission.endPlayerTurn();
        this.render();
      });
    this.add.text(835, 600, "END TURN", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    endTurnBtn.setStrokeStyle(1, 0x4a7a9a);

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
      const label = this.add.text(p.x, p.y, "", { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" }).setOrigin(0.5);
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
    const tile = this.pixelToTile(px, py);
    if (!tile) return;

    const unitHere = this.mission.livingUnits().find((u) => u.pos.x === tile.x && u.pos.y === tile.y);

    // Attacking an enemy currently highlighted as attackable.
    if (this.selectedUnitId && unitHere && this.attackable.some((a) => a.instanceId === unitHere.instanceId)) {
      this.mission.attack(this.selectedUnitId, unitHere.instanceId);
      this.selectedUnitId = null;
      this.clearSelectionHighlights();
      this.render();
      return;
    }

    // Repairing an adjacent ally currently highlighted as repairable. Costs
    // 1 action and doesn't end the turn (two-action house rule, Maxime, 22
    // Aug 2026) — stay selected and recompute options if the healer still
    // has an action left, so a Munti can Repair a second ally, or Repair
    // then move.
    if (this.selectedUnitId && unitHere && this.repairable.some((a) => a.instanceId === unitHere.instanceId)) {
      this.mission.repairUnit(this.selectedUnitId, unitHere.instanceId);
      this.refreshSelectionAfterAction();
      this.render();
      return;
    }

    // Moving the selected unit to a reachable tile. Costs 1 action and
    // doesn't end the turn — stay selected and recompute options if the
    // unit still has an action left (double-move, or move-then-Repair).
    if (this.selectedUnitId && this.reachable.some((c) => coordKey(c) === coordKey(tile)) && !unitHere) {
      this.mission.moveUnit(this.selectedUnitId, tile);
      this.refreshSelectionAfterAction();
      this.render();
      return;
    }

    // Selecting one of your own units.
    if (unitHere && unitHere.side === "player" && !unitHere.downed && unitHere.actionsRemaining > 0) {
      this.selectedUnitId = unitHere.instanceId;
      this.recomputeSelectionHighlights(unitHere.instanceId);
      this.render();
      return;
    }

    // Clicked empty/irrelevant ground — deselect.
    this.selectedUnitId = null;
    this.clearSelectionHighlights();
    this.render();
  }

  private clearSelectionHighlights() {
    this.reachable = [];
    this.attackable = [];
    this.repairable = [];
    this.sweepArea = [];
    this.interdictZone = [];
    this.screenable = [];
  }

  /**
   * Every "what can this unit do from where it stands" highlight set, in
   * one place. Each of the ability sets comes back empty from the engine
   * unless that verb is usable right now, so this scene never needs to know
   * a cooldown, an action cost, or a once-per-mission rule to decide what
   * to draw.
   */
  private recomputeSelectionHighlights(unitId: string) {
    const unit = this.mission.unitById(unitId);
    if (!unit) return;
    this.reachable = this.mission.getReachableTiles(unitId);
    this.attackable = this.filterToVisibleHostiles(this.mission.getAttackableFrom(unitId, unit.pos));
    this.repairable = this.mission.getRepairableFrom(unitId, unit.pos);
    this.sweepArea = this.mission.getSensorSweepAreaFrom(unitId, unit.pos);
    this.interdictZone = this.mission.getInterdictedTilesFrom(unitId, unit.pos);
    this.screenable = this.mission.getScreenableFrom(unitId, unit.pos);
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
    if (unit.abilities.includes("abil_screen")) {
      out.push({ label: "SCREEN", usable: m.canScreen(id), endsTurn: false, run: () => void m.screenAllies(id) });
    }
    if (unit.abilities.includes("abil_sensor_sweep")) {
      // The only label that carries a number: a cooldown the player can't
      // see is a cooldown they'll click into repeatedly.
      const cd = m.abilityCooldownRemaining(id, "abil_sensor_sweep");
      out.push({ label: cd > 0 ? `SWEEP ${cd}` : "SWEEP", usable: m.canSensorSweep(id), endsTurn: false, run: () => void m.sensorSweep(id) });
    }
    return out.slice(0, ACTION_SLOTS.length);
  }

  private runActionSlot(index: number) {
    if (this.mission.outcome !== "ongoing" || this.mission.phase !== "player") return;
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

    for (const c of this.reachable) {
      g.fillStyle(0x4ade80, 0.35);
      g.fillRect(this.boardX + c.x * ts, this.boardY + c.y * ts, ts - 1, ts - 1);
    }
    for (const u of this.attackable) {
      g.fillStyle(0xef4444, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
    }
    for (const u of this.repairable) {
      g.fillStyle(0x22d3ee, 0.4);
      g.fillRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
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
    if (this.selectedUnitId) {
      const u = this.mission.unitById(this.selectedUnitId);
      if (u) {
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
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
    } else {
      // reeps
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
    }
    g.closePath();
    g.strokePath();
  }

  /**
   * GDD §12's species-outline table: human = single solid outline, hiopi =
   * double outline, osnius = single outline + two whisker ticks at the
   * leading edge. Replaces the old proxy (centauroid alone got a thicker
   * 3px line; everyone else got the same 1.5px line, which never actually
   * read as "double" or "whiskered" to a player) with the three genuinely
   * distinct treatments the table calls for. Keyed off unit.chassis, which
   * is a 1:1 stand-in for species per data/units.ts's own archetype rows
   * (human/bipedal, hiopi/centauroid, osnius/bipedal_vibrissal) — so no
   * separate species field is needed on BattleUnit.
   */
  private drawSpeciesOutline(g: Phaser.GameObjects.Graphics, unit: BattleUnit, kind: SilhouetteKind, cx: number, cy: number, r: number) {
    g.lineStyle(1.5, 0xffffff, 0.9);
    this.strokeSilhouette(g, kind, cx, cy, r);

    if (unit.chassis === "centauroid") {
      // Hiopi: a second, thinner pass at a slightly larger radius — a
      // genuine second line, not just a thicker one.
      g.lineStyle(1, 0xffffff, 0.55);
      this.strokeSilhouette(g, kind, cx, cy, r + 2.5);
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
    const cx = this.boardX + unit.pos.x * ts + ts / 2;
    const cy = this.boardY + unit.pos.y * ts + ts / 2;
    const r = ts * 0.32;
    const acted = unit.actionsRemaining <= 0 && unit.side === "player";

    const color = unit.side === "player" ? PLAYER_COLOR : unit.kind === "mech" ? HOSTILE_MECH_COLOR : parseInt(BLOOM[unit.archetypeId]?.colorPalette[0].replace("#", "") ?? "888888", 16);

    g.fillStyle(color, acted ? 0.55 : 1);

    const path = unit.path;
    const kind: SilhouetteKind = unit.kind === "bloom" || !path ? "blob" : path === "meeps" ? "meeps" : path === "tank" ? "tank" : path === "reeps" ? "reeps" : "munti";
    const burrowedBlob = kind === "blob" && unit.burrowed;
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
    } else {
      // munti — circle with a cross bar
      g.fillCircle(cx, cy, r);
    }

    // Outline pass, separated from the fill pass above so the same
    // silhouette geometry can be re-stroked at more than one radius (the
    // hiopi double outline) or swapped for a dashed version (a burrowed
    // Bloom) without duplicating each shape's fill code.
    if (burrowedBlob) {
      this.drawDashedCircleOutline(g, cx, cy, r, 0xffffff, 0.4);
    } else {
      this.drawSpeciesOutline(g, unit, kind, cx, cy, r);
    }
    if (kind === "munti") {
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(cx - r, cy, cx + r, cy);
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
        const originX = this.boardX + unit.pos.x * ts + ts - pipR * 2;
        const originY = this.boardY + unit.pos.y * ts + pipR * 2;
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
      g.strokeRect(this.boardX + unit.pos.x * ts + 2, this.boardY + unit.pos.y * ts + 2, ts - 5, ts - 5);
    }
    // Painted by an unexpired Sensor Sweep: a violet ring wider than the
    // silhouette, so the player can tell at a glance which contacts they
    // can only see because Anand ran the array — and which ones will
    // therefore vanish again when the paint expires.
    if (unit.side === "hostile" && this.mission.isRevealed(unit.instanceId)) {
      g.lineStyle(2, SWEEP_COLOR, 0.9);
      g.strokeCircle(cx, cy, r + 5);
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
    // The briefing is the first thing to go when a unit is selected. It's six
    // wrapped lines of text the player has already read, and the ability-depth
    // pass added up to five status lines plus four legend lines below it —
    // which is exactly how much room the briefing was using. Selected-unit
    // state is live and the briefing isn't, so the briefing yields.
    const lines = [m.mission.displayName, turnLine, "", `Objective: ${m.mission.objective}`];
    if (!this.selectedUnitId) lines.splice(3, 0, m.mission.briefing, "");
    if (this.selectedUnitId) {
      const selected = m.unitById(this.selectedUnitId);
      if (selected) {
        lines.push("", `${selected.displayName}: ${selected.actionsRemaining} action(s) left`);
        if (selected.overwatch && selected.concealed) lines.push("AMBUSH — unseen, holding a shot");
        else if (selected.overwatch) lines.push("ON OVERWATCH — holding fire");
        else if (selected.concealed) lines.push("CONCEALED — the Bloom cannot see this unit");
        if (selected.braced) lines.push("BRACED — pins hostiles that step alongside");
        if (selected.abilities.includes("abil_sensor_sweep")) {
          const cd = m.abilityCooldownRemaining(selected.instanceId, "abil_sensor_sweep");
          lines.push(cd > 0 ? `Sensor Sweep: ${cd} turn(s) to recharge` : "Sensor Sweep: ready");
        }
        if (selected.abilities.includes("abil_screen") && selected.usedScreenThisMission) {
          lines.push("Screen: spent (once per mission)");
        }
      }
    }
    // Highlight legend — only for the colours actually on the board right
    // now, so the panel doesn't turn into a permanent key.
    if (this.repairable.length) lines.push("", "Cyan tile = Repair target (+HP, instead of attacking)");
    if (this.screenable.length) lines.push("", `Pink tiles = Screen would conceal ${this.screenable.length} unit(s)`);
    if (this.interdictZone.length) lines.push("", "Orange tiles = ground Interdict would pin");
    if (this.sweepArea.length) lines.push("", "Violet box = Sensor Sweep reach");
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
    const bg = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.72);
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
    this.overlay.add([bg, title, sub, btn, btnLabel]);
  }
}
