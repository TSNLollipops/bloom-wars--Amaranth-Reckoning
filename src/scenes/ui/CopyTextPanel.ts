// src/scenes/ui/CopyTextPanel.ts
//
// "Here is a blob of text, take it with you" — the shared panel behind
// Options' COPY STATS + BUG REPORT and Debrief's COPY MISSION LOG (B7,
// First Game Dev Feature Gap Report §B7: "testers will paste them into bug
// reports without being asked").
//
// Extracted 5 Sep 2026 (Claude) when B7 needed the second copy of it. The
// logic itself is Options.ts's, unchanged and moved rather than rewritten —
// including the one non-obvious thing it knows, which is worth restating
// here so it doesn't get "simplified" away by someone who only sees the
// clipboard call:
//
//   The textarea is NOT a fallback that only appears when the clipboard
//   fails. It is ALWAYS shown, because navigator.clipboard.writeText can be
//   silently refused inside an embed — itch.io's iframe being the one that
//   matters for this game's actual distribution — in a way that resolves
//   without throwing and without copying anything. A player who trusted a
//   "Copied!" message there would paste nothing. So: try the clipboard,
//   tell the truth about whether it looks like it worked, and always leave
//   selectable text on screen either way.
import Phaser from "phaser";
import { makeShopButton } from "../shop/ShopPanel";
import { HoverTip } from "./HoverTip";
import { wrapTipText } from "../../engine/hoverTipLayout";

/**
 * Shows the copy panel over the current scene.
 *
 * `onClose` fires after the panel is destroyed, so a caller that keeps a
 * "panel is open" field (Options does) can clear it without also having to
 * own the teardown.
 *
 * Returns the container so a caller can destroy it itself if it needs to
 * (a scene shutting down mid-panel, say).
 */
/**
 * Ship audit, 16 Sep 2026 — an editable mode for IMPORT SAVE (Options.ts).
 * `onSubmit` gets the textarea's text and returns an error string to show
 * (panel stays open) or null on success (panel closes). The clipboard copy
 * is skipped in this mode: the player is pasting IN, not copying out.
 */
export interface CopyTextPanelOptions {
  editable?: boolean;
  title?: string;
  submitLabel?: string;
  onSubmit?: (text: string) => string | null;
}

export function showCopyTextPanel(scene: Phaser.Scene, blob: string, onClose: () => void, opts: CopyTextPanelOptions = {}): Phaser.GameObjects.Container {
  const editable = opts.editable === true;
  // Tries the clipboard first (works in Electron and on any https page that
  // allows it). See this file's header for why `copied` is only ever a
  // best-guess, and why the textarea below is unconditional.
  const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
  let copied = false;
  if (!editable) {
    try {
      const p = nav?.clipboard?.writeText?.(blob);
      if (p) {
        copied = true;
        p.catch(() => {
          /* refused — the textarea below is the fallback */
        });
      }
    } catch {
      copied = false;
    }
  }

  // 16 Sep 2026 — the menu scenes now scroll their camera to centre a
  // 960-wide layout (ui/legacyCenter.ts); this panel is pinned to the
  // screen (scrollFactor 0, below), so it centres itself on the real
  // canvas instead of on world x=480. Zero shift on a scene that doesn't
  // scroll (Debrief), so nothing moves there. A full-screen dim behind the
  // panel swallows clicks meant for whatever the panel doesn't cover.
  const cx = 480 - Math.round(scene.cameras.main.scrollX);
  const dim = scene.add.rectangle(scene.cameras.main.width / 2, scene.cameras.main.height / 2, scene.cameras.main.width, scene.cameras.main.height, 0x000000, 0.55).setInteractive();
  const bg = scene.add.rectangle(cx, 320, 880, 520, 0x0c0f12, 0.97).setStrokeStyle(2, 0x4a7a9a).setInteractive();
  const titleText =
    opts.title ?? (copied ? "Copied to clipboard — or select all in the box and copy it yourself" : "Select all in the box (Ctrl+A) and copy (Ctrl+C)");
  const title = scene.add
    .text(cx, 84, titleText, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#facc15",
      align: "center",
      wordWrap: { width: 840 },
    })
    .setOrigin(0.5);
  const area = scene.add.dom(cx, 320, "textarea", {
    width: "840px",
    height: "400px",
    background: "#0a0d10",
    color: "#e8e2d4",
    border: "1px solid #3a4552",
    font: "11px monospace",
    padding: "8px",
    resize: "none",
  }) as Phaser.GameObjects.DOMElement;
  const el = area.node as HTMLTextAreaElement;
  el.value = blob;
  el.readOnly = !editable;
  if (!editable) el.addEventListener("focus", () => el.select());
  // Keys typed into the box are the box's business — the host scene's own
  // hotkeys (Space, arrows, Escape-cancel) must not fire from a paste.
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") e.stopPropagation();
  });
  el.focus();
  if (!editable) el.select();
  el.scrollTop = 0; // select() scrolls a long blob to its end; the reader wants the top

  const closeLayer = scene.add.container(0, 0);
  const panel = scene.add.container(0, 0, [dim, bg, title, area, closeLayer]);
  // Debrief Scroll Fix, 15 Sep 2026 — Debrief.ts's own camera can now
  // scroll (COPY MISSION LOG is reachable from its pinned footer at any
  // scroll position), and this panel had no scroll-factor pinning of its
  // own, unlike every other full-screen overlay in this game
  // (showSaveAsOverlay, showCharacterCreatorOverlay, ShopPanel's discharge
  // confirm — all pinned from day one). The `true` third argument cascades
  // down to closeLayer too, which matters: makeShopButton below reads
  // closeLayer's own scrollFactor at the moment it's called, so this has to
  // land before that call, not after. Every other existing caller of this
  // panel (Options' own COPY STATS/BUG REPORT) has a camera that never
  // moves, so this is a no-op there — same "additive, harmless where
  // nothing scrolls" shape ShopPanel.ts's own setScrollFactor method
  // already documents for itself.
  panel.setScrollFactor(0, 0, true);
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // Same shape as NotesPanel.ts's own (its editable sibling, see this
  // file's header): a standalone function with one close() every exit path
  // already runs through, so one HoverTip, destroyed there.
  const hoverTip = new HoverTip(scene);

  // 7 Sep 2026 — Maxime got stuck on this exact panel (Debrief's COPY
  // MISSION LOG) with no way out: at any Display Size other than 100%
  // (engine/displayScale.ts — 150% is the DEFAULT every new player gets),
  // this textarea's real on-screen footprint grows enough to sit over the
  // CLOSE button below it, and a real HTML <textarea> always paints in
  // front of anything Phaser draws on the canvas, so the click never
  // reached the button. Root cause not fully pinned down remotely (the
  // DOM element scales roughly in step with the canvas, so it isn't a
  // simple missing-multiplier bug — worth a proper look with Maxime
  // actually driving at his own resolution rather than guessed further
  // from here), but the FIX that matters doesn't depend on nailing that:
  // give the panel a way to close that never depends on a canvas-drawn
  // button being reachable at all. Escape now always works, whatever the
  // Display Size setting and whatever's covering what on screen.
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

  if (editable && opts.onSubmit) {
    const onSubmit = opts.onSubmit;
    const status = scene.add.text(cx, 596, "", { fontFamily: "monospace", fontSize: "10px", color: "#fca5a5", align: "center", wordWrap: { width: 840 } }).setOrigin(0.5);
    panel.add(status);
    makeShopButton(
      scene,
      closeLayer,
      cx - 110,
      556,
      220,
      30,
      opts.submitLabel ?? "SUBMIT",
      true,
      () => {
        const err = onSubmit(el.value);
        if (err) {
          status.setText(err);
          return;
        }
        close();
      },
      [opts.submitLabel ?? "Submit", "", ...wrapTipText("Checks the text in the box first. Nothing changes unless it's a valid save.", 42)],
      hoverTip
    );
    makeShopButton(
      scene,
      closeLayer,
      cx + 120,
      556,
      200,
      30,
      "CANCEL (or press Esc)",
      true,
      close,
      ["Cancel", "", ...wrapTipText("Closes without importing anything.", 42)],
      hoverTip
    );
    return panel;
  }

  makeShopButton(
    scene,
    closeLayer,
    cx,
    556,
    200,
    30,
    "CLOSE (or press Esc)",
    true,
    close,
    ["Close", "", ...wrapTipText("Closes this panel. The text is already on the clipboard (or selected above) — closing doesn't lose it.", 42)],
    hoverTip
  );
  return panel;
}
