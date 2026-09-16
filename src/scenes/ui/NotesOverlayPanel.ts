// src/scenes/ui/NotesOverlayPanel.ts
//
// The combined Field Notes / Tester Notes overlay. Maxime's call, 13 Sep
// 2026 evening: these shipped 12 Sep and 10 Sep respectively as two
// separate panels (FieldNotesPanel.ts's showFieldNotesPanel, NotesPanel.ts's
// showNotesPanel) reached from two unconnected places — a mid-mission
// ":notes", and Options.ts's TESTER NOTES button — with no link between
// them. This is the same overlay shell both already used (see NotesPanel.ts's
// retired header for the CopyTextPanel idiom this follows), now with a tab
// bar on top: FIELD NOTES and TESTER NOTES read from the same window,
// one click apart, wherever this panel is opened from.
//
// Presentation only. Neither store changed: data/playerNotes.ts and
// engine/testerNotes.ts still each own their data exactly as before, still
// completely independent of each other (still no shared format, still no
// reason to ever need one — this is one window onto two unrelated things,
// not a merged data model). Field Notes keeps its own paging
// (renderFieldNotesList, unchanged, reused from FieldNotesPanel.ts). Tester
// Notes keeps its own DOM-textarea-plus-clipboard idiom (lifted from the
// retired showNotesPanel, same autosave-on-input behavior).
//
// The textarea is created once and hidden rather than destroyed when the
// player switches to FIELD NOTES, so flipping tabs mid-sentence never loses
// the caret or an in-flight edit — it's just not visible until TESTER NOTES
// is picked again.
//
// Centered on the canvas's real width (537 = 1074/2, src/main.ts) rather
// than NotesPanel.ts's old 480 — a small pre-existing drift from before the
// 12 Sep relayout fixed as a side effect of merging into this shell, not a
// deliberate change of its own.
import Phaser from "phaser";
import { makeShopButton } from "../shop/ShopPanel";
import { HoverTip } from "./HoverTip";
import { wrapTipText } from "../../engine/hoverTipLayout";
import { renderFieldNotesList } from "./FieldNotesPanel";
import { notesPageCount } from "../../data/playerNotes";
import { getTesterNotes, setTesterNotes } from "../../engine/testerNotes";

export type NotesTab = "field" | "tester";

const TEXT_DIM = "#8a97a6";
const TAB_ACTIVE = "#facc15";
const TAB_INACTIVE = "#5a6472";
const CX = 537;

/**
 * Shows the combined notebook overlay. `initialTab` is which tab is up
 * when it opens: Battle's mid-mission ":notes" wants "field" (that's what
 * the command means there), Options' TESTER NOTES button wants "tester".
 * `onClose` fires after the panel is destroyed, same contract the two
 * retired panels used.
 */
export function showNotesOverlayPanel(scene: Phaser.Scene, initialTab: NotesTab, onClose: () => void): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(CX, 320, 900, 540, 0x0c0f12, 0.97).setStrokeStyle(2, 0x4a7a9a).setInteractive();
  const title = scene.add.text(CX, 66, "NOTEBOOK", { fontFamily: "monospace", fontSize: "14px", color: "#facc15" }).setOrigin(0.5);

  const tabLayer = scene.add.container(0, 0);
  const fieldListLayer = scene.add.container(0, 0);
  const fieldNavLayer = scene.add.container(0, 0);
  const closeLayer = scene.add.container(0, 0);
  const hoverTip = new HoverTip(scene);

  let tab: NotesTab = initialTab;
  let fieldPage = 0;

  const fieldSubtitle = scene.add
    .text(CX, 112, "Your own notebook. Written from the chat box with :notes <text>, aboard or mid-mission. Yours across every campaign.", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: TEXT_DIM,
      align: "center",
      wordWrap: { width: 820 },
    })
    .setOrigin(0.5);
  const testerSubtitle = scene.add
    .text(CX, 112, "Bugs, wishlist ideas, anything you'd want your crew to be able to do. Saved on this computer as you type.", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: TEXT_DIM,
      align: "center",
      wordWrap: { width: 820 },
    })
    .setOrigin(0.5);

  // Tester Notes' DOM textarea — created once, shown/hidden with the tab
  // rather than destroyed. Same "autosave on every keystroke" contract the
  // retired showNotesPanel used: no submit step to forget.
  const testerArea = scene.add.dom(CX, 322, "textarea", {
    width: "840px",
    height: "380px",
    background: "#0a0d10",
    color: "#e8e2d4",
    border: "1px solid #3a4552",
    font: "11px monospace",
    padding: "8px",
    resize: "none",
  }) as Phaser.GameObjects.DOMElement;
  const testerEl = testerArea.node as HTMLTextAreaElement;
  testerEl.value = getTesterNotes();
  testerEl.placeholder = "Start typing...";
  const onTesterInput = () => setTesterNotes(testerEl.value);
  testerEl.addEventListener("input", onTesterInput);

  const copyStatus = scene.add.text(CX, 522, "", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0.5);
  const testerCopyBtnLayer = scene.add.container(0, 0);

  const panel = scene.add.container(0, 0, [
    bg,
    title,
    tabLayer,
    fieldSubtitle,
    testerSubtitle,
    fieldListLayer,
    fieldNavLayer,
    testerArea,
    copyStatus,
    testerCopyBtnLayer,
    closeLayer,
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", onKeyDown);

  function close() {
    testerEl.removeEventListener("input", onTesterInput);
    document.removeEventListener("keydown", onKeyDown);
    panel.destroy(true);
    hoverTip.destroy();
    onClose();
  }

  // Best-effort clipboard copy, same try/tell-the-truth idiom as
  // CopyTextPanel/the retired showNotesPanel — never the only way to get
  // the text out, just a shortcut for pasting straight into feedback to
  // Maxime.
  const doCopy = () => {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
    try {
      const p = nav?.clipboard?.writeText?.(testerEl.value);
      if (p) {
        copyStatus.setText("Copied — paste it into the itch.io comments, the Discord, or a bug report.");
        p.catch(() => copyStatus.setText("Couldn't copy automatically — select the text above and copy it by hand (Ctrl+A, Ctrl+C)."));
      } else {
        copyStatus.setText("Couldn't copy automatically — select the text above and copy it by hand (Ctrl+A, Ctrl+C).");
      }
    } catch {
      copyStatus.setText("Couldn't copy automatically — select the text above and copy it by hand (Ctrl+A, Ctrl+C).");
    }
  };

  function drawTabs() {
    tabLayer.removeAll(true);
    const mk = (cx: number, label: string, which: NotesTab) => {
      const active = tab === which;
      const tabBg = scene.add
        .rectangle(cx, 92, 180, 26, active ? 0x24303c : 0x161b21, 1)
        .setStrokeStyle(1, active ? 0xe0b23c : 0x3a4552)
        .setInteractive({ useHandCursor: true });
      const tabLabel = scene.add.text(cx, 92, label, { fontFamily: "monospace", fontSize: "11px", color: active ? TAB_ACTIVE : TAB_INACTIVE }).setOrigin(0.5);
      tabBg.on("pointerdown", () => {
        if (tab === which) return;
        tab = which;
        redraw();
      });
      // Ship audit, 16 Sep 2026 — the one place the two notebooks sit side
      // by side, and nothing said what the difference was.
      const tip =
        which === "field"
          ? ["Field Notes", "", ...wrapTipText("Your own tactical notebook — lines you write with :notes, tagged and dated, kept across every campaign and every loss. For you.", 42)]
          : ["Feedback Notes", "", ...wrapTipText("A scratchpad for anything you'd want to tell the developer — bugs, ideas, what confused you. Stays on this computer until you copy it out.", 42)];
      tabBg
        .on("pointerover", (pointer: Phaser.Input.Pointer) => hoverTip.show(tip, pointer.x, pointer.y))
        .on("pointermove", (pointer: Phaser.Input.Pointer) => hoverTip.show(tip, pointer.x, pointer.y))
        .on("pointerout", () => hoverTip.hide());
      tabLayer.add([tabBg, tabLabel]);
    };
    mk(CX - 95, "FIELD NOTES", "field");
    mk(CX + 95, "FEEDBACK NOTES", "tester");
  }

  function redrawField() {
    fieldListLayer.removeAll(true);
    fieldNavLayer.removeAll(true);
    const rows = renderFieldNotesList({ scene, layer: fieldListLayer, hoverTip, x: 117, y: 130, w: 840, h: 380, page: fieldPage, onChanged: () => redrawField() });
    const pageCount = notesPageCount(rows);
    if (fieldPage > pageCount - 1) {
      fieldPage = Math.max(0, pageCount - 1);
      redrawField();
      return;
    }
    if (pageCount > 1) {
      const y = 522;
      makeShopButton(scene, fieldNavLayer, 780, y, 26, 22, "<", fieldPage > 0, () => { fieldPage--; redrawField(); }, ["Previous Page"], hoverTip);
      fieldNavLayer.add(scene.add.text(824, y, `PAGE ${fieldPage + 1} / ${pageCount}`, { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM }).setOrigin(0.5));
      makeShopButton(scene, fieldNavLayer, 868, y, 26, 22, ">", fieldPage < pageCount - 1, () => { fieldPage++; redrawField(); }, ["Next Page"], hoverTip);
    }
  }

  function redraw() {
    drawTabs();
    const onField = tab === "field";
    fieldSubtitle.setVisible(onField);
    fieldListLayer.setVisible(onField);
    fieldNavLayer.setVisible(onField);
    testerSubtitle.setVisible(!onField);
    testerArea.setVisible(!onField);
    copyStatus.setVisible(!onField);
    testerCopyBtnLayer.setVisible(!onField);
    if (onField) redrawField();
  }
  redraw();

  makeShopButton(
    scene,
    testerCopyBtnLayer,
    CX - 140,
    558,
    260,
    30,
    "COPY TO CLIPBOARD",
    true,
    doCopy,
    ["Copy to Clipboard", "", ...wrapTipText("Copies everything currently in the Feedback Notes box, exactly as typed.", 42)],
    hoverTip
  );
  makeShopButton(
    scene,
    closeLayer,
    CX + 160,
    558,
    220,
    30,
    "CLOSE (or press Esc)",
    true,
    close,
    ["Close", "", ...wrapTipText("Closes the notebook. Both tabs are already saved as you wrote them.", 42)],
    hoverTip
  );

  return panel;
}
