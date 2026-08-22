// src/scenes/Battle.ts
// The playable battle scene (Build Brief step 10). Placeholder geometric
// shapes per GDD §12 — everything drawn with Phaser Graphics, no art
// pipeline. This file owns NO game rules: every move/attack/turn call
// goes through engine/mission.ts, and what's drawn is only ever a
// reflection of that engine state (Build Brief §5.2's load-bearing line).
import Phaser from "phaser";
import type { Coord, TileType } from "../data/types";
import { MISSIONS_BY_ID } from "../data/campaign";
import { Mission } from "../engine/mission";
import type { BattleUnit } from "../engine/units";
import { coordKey } from "../engine/grid";
import { BLOOM } from "../data/bloom";

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

  constructor() {
    super("Battle");
  }

  init(data: { missionId: string }) {
    const missionDef = MISSIONS_BY_ID[data.missionId] ?? Object.values(MISSIONS_BY_ID)[0];
    this.mission = new Mission(missionDef);
    this.selectedUnitId = null;
    this.reachable = [];
    this.attackable = [];
    this.repairable = [];
  }

  create() {
    const m = this.mission.map;
    this.tileSize = Math.max(16, Math.min(Math.floor(700 / m.width), Math.floor(560 / m.height)));

    this.gfx = this.add.graphics();
    this.hudText = this.add.text(720, 12, "", { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4", wordWrap: { width: 230 } });
    this.logText = this.add.text(720, 300, "", { fontFamily: "monospace", fontSize: "10px", color: "#8a97a6", wordWrap: { width: 230 } });

    const endTurnBtn = this.add
      .rectangle(835, 600, 200, 32, 0x2e5c7a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        if (this.mission.outcome !== "ongoing") return;
        this.selectedUnitId = null;
        this.reachable = [];
        this.attackable = [];
        this.repairable = [];
        this.mission.endPlayerTurn();
        this.render();
      });
    this.add.text(835, 600, "END TURN", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    endTurnBtn.setStrokeStyle(1, 0x4a7a9a);

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
      this.reachable = [];
      this.attackable = [];
      this.repairable = [];
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
      this.reachable = this.mission.getReachableTiles(unitHere.instanceId);
      this.attackable = this.mission.getAttackableFrom(unitHere.instanceId, unitHere.pos);
      this.repairable = this.mission.getRepairableFrom(unitHere.instanceId, unitHere.pos);
      this.render();
      return;
    }

    // Clicked empty/irrelevant ground — deselect.
    this.selectedUnitId = null;
    this.reachable = [];
    this.attackable = [];
    this.repairable = [];
    this.render();
  }

  /**
   * After a Move or Repair (the two action-costing-but-turn-continuing
   * actions), keep the unit selected and refresh its highlighted options if
   * it still has an action left; otherwise deselect. Attack always empties
   * actionsRemaining itself, so this only ever applies after Move/Repair.
   */
  private refreshSelectionAfterAction() {
    const unit = this.selectedUnitId ? this.mission.unitById(this.selectedUnitId) : undefined;
    if (unit && !unit.downed && unit.actionsRemaining > 0) {
      this.reachable = this.mission.getReachableTiles(unit.instanceId);
      this.attackable = this.mission.getAttackableFrom(unit.instanceId, unit.pos);
      this.repairable = this.mission.getRepairableFrom(unit.instanceId, unit.pos);
    } else {
      this.selectedUnitId = null;
      this.reachable = [];
      this.attackable = [];
      this.repairable = [];
    }
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
    if (this.selectedUnitId) {
      const u = this.mission.unitById(this.selectedUnitId);
      if (u) {
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRect(this.boardX + u.pos.x * ts, this.boardY + u.pos.y * ts, ts - 1, ts - 1);
      }
    }

    for (const unit of this.mission.livingUnits()) {
      this.drawUnit(g, unit, ts);
    }

    this.drawHud();
    this.drawOverlayIfNeeded();
  }

  private drawUnit(g: Phaser.GameObjects.Graphics, unit: BattleUnit, ts: number) {
    const cx = this.boardX + unit.pos.x * ts + ts / 2;
    const cy = this.boardY + unit.pos.y * ts + ts / 2;
    const r = ts * 0.32;
    const acted = unit.actionsRemaining <= 0 && unit.side === "player";

    const color = unit.side === "player" ? PLAYER_COLOR : unit.kind === "mech" ? HOSTILE_MECH_COLOR : parseInt(BLOOM[unit.archetypeId]?.colorPalette[0].replace("#", "") ?? "888888", 16);

    g.fillStyle(color, acted ? 0.55 : 1);
    g.lineStyle(unit.chassis === "centauroid" ? 3 : 1.5, 0xffffff, 0.9);

    const path = unit.path;
    if (unit.kind === "bloom" || !path) {
      // Bloom placeholder: a blob (circle), dashed/faint if still burrowed.
      if (unit.burrowed) {
        g.fillStyle(color, 0.25);
      }
      g.fillCircle(cx, cy, r);
      g.strokeCircle(cx, cy, r);
      if (unit.collapsed) {
        g.lineStyle(2, 0xff5555, 0.9);
        g.strokeCircle(cx, cy, r + 3);
      }
    } else if (path === "meeps") {
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineTo(cx - r, cy + r);
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else if (path === "tank") {
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      g.strokeRect(cx - r, cy - r, r * 2, r * 2);
    } else if (path === "reeps") {
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else {
      // munti — circle with a cross bar
      g.fillCircle(cx, cy, r);
      g.strokeCircle(cx, cy, r);
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(cx - r, cy, cx + r, cy);
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

  private drawHud() {
    const m = this.mission;
    const lines = [
      m.mission.displayName,
      `Turn ${m.turn} / ${m.mission.objectiveParams.turnLimit}  —  ${m.phase} phase`,
      "",
      m.mission.briefing,
      "",
      `Objective: ${m.mission.objective}`,
    ];
    if (this.selectedUnitId) {
      const selected = m.unitById(this.selectedUnitId);
      if (selected) lines.push("", `${selected.displayName}: ${selected.actionsRemaining} action(s) left`);
    }
    if (this.repairable.length) {
      lines.push("", "Cyan tile = Repair target (+HP, instead of attacking)");
    }
    this.hudText.setText(lines.join("\n"));

    const tail = m.log.slice(-14);
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
    const btn = this.add
      .rectangle(480, 390, 260, 40, 0x2e5c7a)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MapSelect"));
    const btnLabel = this.add.text(480, 390, "back to mission select", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    this.overlay.add([bg, title, sub, btn, btnLabel]);
  }
}
