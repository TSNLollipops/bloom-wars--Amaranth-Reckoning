// src/scenes/ui/FieldNotesPanel.ts
//
// Field Notes, the read side — Mission Chat / Player Notes / Battle HUD
// Relayout Plan v1, Workstream 1, 12 Sep 2026. data/playerNotes.ts holds
// the notebook itself; this file draws the one thing that reads it:
//
//   - renderFieldNotesList(): one paged list renderer with a per-note
//     DELETE (arm-then-confirm, same two-click idiom Pilot Discharge uses
//     in ShopPanel.ts — a note written with a typo or by a cat on the
//     keyboard is otherwise permanent, and a one-click delete on a feature
//     whose whole point is remembering things is the wrong default).
//     Used by scenes/Codex.ts's FIELD NOTES section, and by
//     ui/NotesOverlayPanel.ts's FIELD NOTES tab.
//
// Grouped by campaign (groupNotesByCampaign), newest first within a group,
// so a Warden save's notes and a House Amaranth save's notes never
// interleave into nonsense. Paged by a fixed per-page row budget rather
// than by pixel measurement: every row is one note (up to MAX_NOTE_CHARS,
// wrapped) plus its context line, and measuring real wrapped heights
// per-row would mean rendering to know how many fit — the codebase's own
// paged-not-scrolled convention (ShopPanel.ts, Codex.ts) already accepts a
// conservative fixed budget over that.
//
// 13 Sep 2026: the full-screen overlay that used to live in this file
// (showFieldNotesPanel, for a mid-mission ":notes" with no text) is now
// ui/NotesOverlayPanel.ts's showNotesOverlayPanel(scene, "field", onClose)
// — merged with the Tester Notes overlay into one tabbed panel, Maxime's
// call. This file keeps only the list renderer both callers share.
import Phaser from "phaser";
import { HoverTip } from "./HoverTip";
import { wrapTipText } from "../../engine/hoverTipLayout";
import { deletePlayerNote, formatNoteContext, buildNotesRows, loadPlayerNotes, notesRowsForPage, NOTES_PER_PAGE, type NotesPageRow } from "../../data/playerNotes";

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
