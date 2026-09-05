// src/scenes/ui/StandingsPanel.ts
// Rec Room Standings & NPC Learning, slice 4 — the board on the wall.
//
// Why this is its own file rather than another method on Hub.ts: that file
// is over 8,000 lines and 500 KB, by a wide margin the largest in the repo,
// and every panel added to it makes the next one harder to add. There is
// already in-repo precedent for pulling one out — scenes/shop/ShopPanel.ts
// is a standalone class Hub owns and toggles — so this follows it exactly:
// Hub constructs one, calls open/close/render, and owns nothing about how
// it draws.
//
// Construction copies buildHistoryOverlay's proven shape (one container at
// depth 60, a background rect, one monospace text block, one close button,
// no per-frame update). Every ranking decision comes from
// engine/recRoomRecord.ts's buildStandings, which is Phaser-free and unit
// tested; nothing in here decides who is ahead of whom.

import Phaser from "phaser";
import {
  buildStandings,
  type RecRoomState,
  type StandingsBoard,
  ordinal,
  type StandingsEntrant,
  type StandingsTab,
} from "../../engine/recRoomRecord";
import { REC_GAME_LABELS } from "../../data/recRoomAptitude";

const PANEL_BG = 0x1a2028;
const PANEL_BORDER = 0x3a4552;
const TEXT_MAIN = "#e8e2d4";
const TEXT_DIM = "#8a97a6";
const TEXT_ACCENT = "#c8b273";

const TABS: StandingsTab[] = ["pegBoard", "poker", "fletchers", "all"];

function tabLabel(tab: StandingsTab): string {
  return tab === "all" ? "All" : REC_GAME_LABELS[tab];
}

/** Left-pad / right-pad helpers — this is a fixed-width monospace table. */
function padR(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}
function padL(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s;
}

export interface StandingsPanelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class StandingsPanel {
  private container: Phaser.GameObjects.Container;
  private bodyText: Phaser.GameObjects.Text;
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private tab: StandingsTab = "all";

  private state: RecRoomState = { records: {} };
  private entrants: readonly StandingsEntrant[] = [];
  private day = 1;

  constructor(scene: Phaser.Scene, bounds: StandingsPanelBounds, onClose: () => void) {
    const cx = (bounds.left + bounds.right) / 2;
    this.container = scene.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

    const bg = scene.add
      .rectangle(cx, (bounds.top + bounds.bottom) / 2, bounds.right - bounds.left, bounds.bottom - bounds.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER)
      .setScrollFactor(0);
    this.container.add(bg);

    // Tab row. Every one of these is interactive and therefore needs its
    // OWN setScrollFactor(0) even though the container already has one:
    // Phaser renders a container's children using the container's scroll
    // factor but hit-tests them using each child's, so an interactive child
    // without it draws in the right place and takes clicks somewhere else,
    // off by exactly the camera's scroll. That bug is invisible to tsc,
    // lint and the whole unit suite — see Hub.ts's own note at its first
    // screen-pinned overlay, and tools/verify/checkHubInteractionAfterScroll.mjs.
    let tx = bounds.left + 18;
    for (const tab of TABS) {
      const t = scene.add
        .text(tx, bounds.top + 44, `[ ${tabLabel(tab)} ]`, { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      t.on("pointerdown", () => this.setTab(tab));
      t.setData("tab", tab);
      this.container.add(t);
      this.tabTexts.push(t);
      tx += t.width + 12;
    }

    this.bodyText = scene.add
      .text(bounds.left + 18, bounds.top + 66, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_MAIN,
        align: "left",
        lineSpacing: 3,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.container.add(this.bodyText);

    const closeBtn = scene.add
      .text(bounds.right - 20, bounds.top + 20, "[ close — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    closeBtn.on("pointerdown", onClose);
    this.container.add(closeBtn);
  }

  open(state: RecRoomState, entrants: readonly StandingsEntrant[], day: number): void {
    this.state = state;
    this.entrants = entrants;
    this.day = day;
    this.container.setVisible(true);
    this.render();
  }

  close(): void {
    this.container.setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  private setTab(tab: StandingsTab): void {
    this.tab = tab;
    this.render();
  }

  /** Exposed for the headless verify scripts, which drive tabs without clicking. */
  showTab(tab: StandingsTab): void {
    this.setTab(tab);
  }

  private render(): void {
    for (const t of this.tabTexts) {
      t.setColor(t.getData("tab") === this.tab ? TEXT_ACCENT : TEXT_DIM);
    }
    const board = buildStandings(this.state, this.entrants, this.tab);
    this.bodyText.setText(this.lines(board).join("\n"));
  }

  /**
   * The table, as text. Split out from render() so the shape of the board
   * is one readable block rather than fifty setText calls, and so a verify
   * script can read the rendered string back and assert on it.
   */
  private lines(board: StandingsBoard): string[] {
    const header = `THE BOARD — ${tabLabel(this.tab).toUpperCase()}`;
    const out: string[] = [`${padR(header, 44)}Day ${this.day}`, ""];

    if (board.rows.length === 0) {
      out.push("  Nobody aboard has played this one yet.");
      out.push("");
      out.push("  Sit down at the table in the Rec Room and the board");
      out.push("  starts keeping score — yours and theirs.");
      return out;
    }

    out.push(`  ${padL("#", 3)}  ${padR("PILOT", 22)}${padL("PTS", 4)}  ${padR("W-D-L", 9)}${padL("PLAYED", 7)}${padL("BEST", 6)}`);

    for (const r of board.rows) {
      // A lost pilot keeps their row. No code makes that happen — it is
      // this panel simply not filtering them out, and recRoomRecord.ts
      // never deleting the record underneath.
      // The marker column carries "who is this row" — "+" for a pilot who
      // is gone, ">" for you. The rank column always carries the real
      // rank, including a dead pilot's: they earned that record and it
      // still stands, which is the entire point of keeping the row.
      const mark = r.lost ? "+" : r.isPlayer ? ">" : " ";
      const rank = String(r.rank);
      const name = r.isPlayer ? "YOU" : r.displayName;
      const wdl = `${r.wins}-${r.draws}-${r.losses}`;
      const best = r.best === undefined ? "-" : String(Math.round(r.best));
      let line = `${mark} ${padL(rank, 3)}  ${padR(name, 22)}${padL(String(r.points), 4)}  ${padR(wdl, 9)}${padL(String(r.played), 7)}${padL(best, 6)}`;
      if (r.lost) line += r.lostOnDay !== undefined ? `   lost Day ${r.lostOnDay}` : "   lost";
      out.push(line);
    }

    out.push("");
    if (board.bestAboard) {
      // The one line the points column cannot say.
      out.push(`  Best player aboard: ${board.bestAboard.displayName} (skill ${Math.round(board.bestAboard.skill)}) — ${ordinal(board.bestAboard.rank)} on the board.`);
    }
    if (board.unplayed.length > 0) {
      const n = board.unplayed.length;
      out.push(`  ${n} aboard ${n === 1 ? "hasn't" : "haven't"} sat down to this one yet.`);
    }
    return out;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
