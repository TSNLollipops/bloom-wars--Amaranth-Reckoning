// src/scenes/ui/NotesPanel.ts
//
// The editable sibling of CopyTextPanel.ts — same DOM-textarea-over-canvas
// shell, same unconditional-textarea-plus-best-effort-clipboard idiom, same
// Escape-always-closes fix (see CopyTextPanel.ts's own header for why that
// last one exists: a real HTML element always paints in front of anything
// Phaser draws under it, so a canvas-drawn CLOSE button can end up
// unreachable at some Display Size settings — 7 Sep 2026, fixed there by
// making Escape a close path that never depends on hitting a button).
//
// Built 10 Sep 2026 for the Tester Notes scratchpad (engine/testerNotes.ts
// — see that file's header for the full design reasoning). Kept as its own
// file rather than folded into CopyTextPanel.ts: that panel's whole
// contract is "read-only, pre-filled, here's what's already true" (stats,
// a mission log); this one is "empty or previously-written, the player
// types into it, and every keystroke is saved" — different enough behavior
// (readOnly, autosave-on-input, no auto-select-all, its own COPY button)
// that sharing one function would mean branching it internally for not
// much real reuse.
import Phaser from "phaser";
import { makeShopButton } from "../shop/ShopPanel";
import { getTesterNotes, setTesterNotes } from "../../engine/testerNotes";

/**
 * Shows the editable Tester Notes panel over the current scene.
 *
 * Autosaves on every keystroke (an `input` listener calling setTesterNotes
 * directly) rather than requiring an explicit save action — the whole
 * point is a scratchpad testers can dump a thought into and walk away
 * from, not a form with a submit step to forget.
 *
 * `onClose` fires after the panel is destroyed, same contract as
 * CopyTextPanel's own showCopyTextPanel.
 */
export function showNotesPanel(scene: Phaser.Scene, onClose: () => void): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(480, 320, 880, 520, 0x0c0f12, 0.97).setStrokeStyle(2, 0x4a7a9a).setInteractive();
  const title = scene.add.text(480, 76, "TESTER NOTES", { fontFamily: "monospace", fontSize: "14px", color: "#facc15" }).setOrigin(0.5);
  const subtitle = scene.add
    .text(480, 96, "Bugs, wishlist ideas, anything you'd want your ant to be able to do. Saved on this computer as you type.", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#8a97a6",
      align: "center",
      wordWrap: { width: 780 },
    })
    .setOrigin(0.5);

  const area = scene.add.dom(480, 320, "textarea", {
    width: "840px",
    height: "380px",
    background: "#0a0d10",
    color: "#e8e2d4",
    border: "1px solid #3a4552",
    font: "11px monospace",
    padding: "8px",
    resize: "none",
  }) as Phaser.GameObjects.DOMElement;
  const el = area.node as HTMLTextAreaElement;
  el.value = getTesterNotes();
  el.readOnly = false;
  el.placeholder = "Start typing...";
  const onInput = () => setTesterNotes(el.value);
  el.addEventListener("input", onInput);
  el.focus();
  // Cursor at the end, not a select-all — this box is meant to be typed
  // into and appended to across sessions, unlike CopyTextPanel's own
  // read-only blob where select-all-then-copy is the entire point.
  el.setSelectionRange(el.value.length, el.value.length);

  const copyStatus = scene.add.text(480, 526, "", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0.5);

  const closeLayer = scene.add.container(0, 0);
  const panel = scene.add.container(0, 0, [bg, title, subtitle, area, copyStatus, closeLayer]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", onKeyDown);

  function close() {
    el.removeEventListener("input", onInput);
    document.removeEventListener("keydown", onKeyDown);
    panel.destroy(true);
    onClose();
  }

  // Best-effort clipboard copy of the current text, same try/tell-the-truth
  // idiom as CopyTextPanel — never the only way to get the text out (it's
  // still sitting right there, selectable, in the textarea above), just a
  // shortcut for a player who wants to paste it straight into a message to
  // Maxime.
  const doCopy = () => {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
    try {
      const p = nav?.clipboard?.writeText?.(el.value);
      if (p) {
        copyStatus.setText("Copied — paste it wherever you send Maxime feedback.");
        p.catch(() => copyStatus.setText("Couldn't copy automatically — select the text above and copy it by hand (Ctrl+A, Ctrl+C)."));
      } else {
        copyStatus.setText("Couldn't copy automatically — select the text above and copy it by hand (Ctrl+A, Ctrl+C).");
      }
    } catch {
      copyStatus.setText("Couldn't copy automatically — select the text above and copy it by hand (Ctrl+A, Ctrl+C).");
    }
  };

  makeShopButton(scene, closeLayer, 350, 556, 260, 30, "COPY TO CLIPBOARD", true, doCopy);
  makeShopButton(scene, closeLayer, 630, 556, 220, 30, "CLOSE (or press Esc)", true, close);
  return panel;
}
