// src/scenes/ui/FieldNotesPanel.ts
//
// Field Notes, the read side — Mission Chat / Player Notes / Battle HUD
// Relayout Plan v1, Workstream 1, 12 Sep 2026. data/playerNotes.ts holds
// the notebook itself; this file draws it, in two hosts:
//
//   - renderFieldNotesList(): one paged list renderer with a per-note
//     DELETE (arm-then-confirm, same two-click idiom Pilot Discharge uses
//     in ShopPanel.ts — a note written with a typo or by a cat on the
//     keyboard is otherwise permanent, and a one-click delete on a feature
//     whose whole point is remembering things is the wrong default).
//     Used by scenes/Codex.ts's FIELD NOTES section, and by the overlay
//     below.
//   - showFieldNotesPanel(): a full-screen overlay hosting that same list,
//     for ":notes" typed with no text from inside a MISSION. Battle can't
//     scene.start("Codex") the way the Hub does — leaving the Battle scene
//     mid-mission and coming back restarts it, which is a mission reset,
//     not a page turn — so in a mission the notebook opens in place.
//     Same shell as scenes/ui/NotesPanel.ts (the Tester Notes scratchpad,
//     a different feature — see playerNotes.ts's own header for the
//     distinction), same Escape-always-closes rule and the reason for it
//     (CopyTextPanel.ts's header: a real DOM element can end up painted
//     over a canvas CLOSE button at some Display Size settings, so no close
//     path may depend on hitting a button). This overlay has no DOM element
//     of its own, but the rule is kept for consistency rather than
//     re-deciding it per panel.
//
// Grouped by campaign (groupNotesByCampaign), newest first within a group,
// so a Warden save's notes and a House Amaranth save's notes never
// interleave into nonsense. Paged by a fixed per-page row budget rather
// than by pixel measurement: every row is one note (up to MAX_NOTE_CHARS,
// wrapped) plus its context line, and measuring real wrapped heights
// per-row would mean rendering to know how many fit — the codebase's own
// paged-not-scrolled convention (ShopPanel.ts, Codex.ts) already accepts a
// conservative fixed budget over that.
import Phaser from "phaser";
import { makeShopButton } from "../shop/ShopPanel";
import { HoverTip } from "./HoverTip";
import { wrapTipText } from "../../engine/hoverTipLayout";
import {
  deletePlayerNote,
  formatNoteContext,
  loadPlayerNotes,
  buildNotesRows,
  notesPageCount,
  notesRowsForPage,
  NOTES_PER_PAGE,
  type NotesPageRow,
} from "../../data/playerNotes";

const TEXT_MAIN = "#e8e2d4";
const TEXT_DIM = "#8a97a6";
const TEXT_FAINT = "#5a6472";
const ACCENT = "#e0b23c";

export interface FieldNotesListOptions {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  hoverTip: HoverTip;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
  /** Called after a real deletion so the host can re-read and redraw (and clamp its page). */
  onChanged: () => void;
}

/**
 * Draws one page of the notebook into `layer`. Returns the row list it
 * drew from so the host can size page nav from the same data.
 */
export function renderFieldNotesList(opts: FieldNotesListOptions): NotesPageRow[] {
  const { scene, layer, hoverTip, x, y, w, h, page, onChanged } = opts;
  const notes = loadPlayerNotes();
  const rows = buildNotesRows(notes);
  if (notes.length === 0) {
    const empty = scene.add
      .text(x, y, "No field notes yet.\n\nOpen the chat box (T) and type  :notes <what you want to remember>  — aboard or in the middle of a mission. Each note is stamped with the campaign, mission and turn it was written in, and it stays here even if that campaign is lost.", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_DIM,
        wordWrap: { width: w },
      })
      .setOrigin(0, 0);
    layer.add(empty);
    return rows;
  }
  const rowH = Math.floor(h / (NOTES_PER_PAGE + 1)); // +1 leaves room for one group header per page
  let cy = y;
  let armedDeleteId: string | null = null;
  const armedLabels = new Map<string, Phaser.GameObjects.Text>();
  for (const row of notesRowsForPage(rows, page)) {
    if (row.kind === "header") {
      const header = scene.add.text(x, cy, row.label!.toUpperCase(), { fontFamily: "monospace", fontSize: "10px", color: ACCENT }).setOrigin(0, 0);
      layer.add(header);
      cy += 18;
      continue;
    }
    const note = row.note!;
    const body = scene.add
      .text(x, cy, note.text, { fontFamily: "monospace", fontSize: "11px", color: TEXT_MAIN, wordWrap: { width: w - 110 } })
      .setOrigin(0, 0);
    const when = new Date(note.createdAt);
    const stamp = `${formatNoteContext(note)} · ${when.toLocaleDateString()}`;
    const ctx = scene.add.text(x, cy + body.height + 2, stamp, { fontFamily: "monospace", fontSize: "9px", color: TEXT_FAINT }).setOrigin(0, 0);
    layer.add([body, ctx]);
    // DELETE — arm on the first click (label flips to CONFIRM), delete on
    // the second, disarm if any other note's button is clicked instead.
    const bx = x + w - 48;
    const by = cy + 10;
    const btnBg = scene.add.rectangle(bx, by, 88, 22, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552).setInteractive({ useHandCursor: true });
    const btnLabel = scene.add.text(bx, by, "DELETE", { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM }).setOrigin(0.5);
    layer.add([btnBg, btnLabel]);
    armedLabels.set(note.id, btnLabel);
    const tip = ["Delete this note", "", ...wrapTipText("Click once to arm, click again to confirm. Nothing else will bring a deleted note back.", 42)];
    btnBg.on("pointerover", (p: Phaser.Input.Pointer) => hoverTip.show(tip, p.x, p.y));
    btnBg.on("pointermove", (p: Phaser.Input.Pointer) => hoverTip.show(tip, p.x, p.y));
    btnBg.on("pointerout", () => hoverTip.hide());
    btnBg.on("pointerdown", () => {
      if (armedDeleteId === note.id) {
        hoverTip.hide();
        if (deletePlayerNote(note.id)) onChanged();
        return;
      }
      if (armedDeleteId) {
        const prev = armedLabels.get(armedDeleteId);
        if (prev && prev.active) {
          prev.setText("DELETE");
          prev.setColor(TEXT_DIM);
        }
      }
      armedDeleteId = note.id;
      btnLabel.setText("CONFIRM?");
      btnLabel.setColor("#ef4444");
    });
    cy += Math.max(rowH, body.height + 16);
  }
  return rows;
}

/**
 * The in-mission overlay (see the file header). Returns the container so a
 * caller can check `.active`; `onClose` fires after it's destroyed.
 */
export function showFieldNotesPanel(scene: Phaser.Scene, onClose: () => void): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(537, 320, 900, 540, 0x0c0f12, 0.97).setStrokeStyle(2, 0x4a7a9a).setInteractive();
  const title = scene.add.text(537, 70, "FIELD NOTES", { fontFamily: "monospace", fontSize: "14px", color: "#facc15" }).setOrigin(0.5);
  const subtitle = scene.add
    .text(537, 90, "Your own notebook. Written with  :notes <text>  from the chat box. Yours across every campaign, not the commander's.", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: TEXT_DIM,
      align: "center",
      wordWrap: { width: 820 },
    })
    .setOrigin(0.5);
  const listLayer = scene.add.container(0, 0);
  const navLayer = scene.add.container(0, 0);
  const closeLayer = scene.add.container(0, 0);
  const panel = scene.add.container(0, 0, [bg, title, subtitle, listLayer, navLayer, closeLayer]);
  const hoverTip = new HoverTip(scene);
  let page = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", onKeyDown);

  function close() {
    document.removeEventListener("keydown", onKeyDown);
    panel.destroy(true);
    hoverTip.destroy();
    onClose();
  }

  function redraw() {
    listLayer.removeAll(true);
    navLayer.removeAll(true);
    const rows = renderFieldNotesList({ scene, layer: listLayer, hoverTip, x: 117, y: 112, w: 840, h: 420, page, onChanged: () => redraw() });
    const pageCount = notesPageCount(rows);
    if (page > pageCount - 1) {
      page = pageCount - 1;
      redraw();
      return;
    }
    if (pageCount > 1) {
      const y = 548;
      makeShopButton(scene, navLayer, 780, y, 26, 22, "<", page > 0, () => { page--; redraw(); }, ["Previous Page"], hoverTip);
      navLayer.add(scene.add.text(824, y, `PAGE ${page + 1} / ${pageCount}`, { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM }).setOrigin(0.5));
      makeShopButton(scene, navLayer, 868, y, 26, 22, ">", page < pageCount - 1, () => { page++; redraw(); }, ["Next Page"], hoverTip);
    }
  }
  redraw();

  makeShopButton(
    scene,
    closeLayer,
    537,
    576,
    220,
    30,
    "CLOSE (or press Esc)",
    true,
    close,
    ["Close", "", ...wrapTipText("Back to the mission. Notes are already saved as you wrote them.", 42)],
    hoverTip
  );
  return panel;
}
