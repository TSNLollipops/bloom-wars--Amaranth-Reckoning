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
export function showCopyTextPanel(scene: Phaser.Scene, blob: string, onClose: () => void): Phaser.GameObjects.Container {
  // Tries the clipboard first (works in Electron and on any https page that
  // allows it). See this file's header for why `copied` is only ever a
  // best-guess, and why the textarea below is unconditional.
  const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
  let copied = false;
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

  const bg = scene.add.rectangle(480, 320, 880, 520, 0x0c0f12, 0.97).setStrokeStyle(2, 0x4a7a9a).setInteractive();
  const title = scene.add
    .text(480, 84, copied ? "Copied to clipboard — or select all in the box and copy it yourself" : "Select all in the box (Ctrl+A) and copy (Ctrl+C)", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#facc15",
    })
    .setOrigin(0.5);
  const area = scene.add.dom(480, 320, "textarea", {
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
  el.readOnly = true;
  el.addEventListener("focus", () => el.select());
  el.focus();
  el.select();

  const closeLayer = scene.add.container(0, 0);
  const panel = scene.add.container(0, 0, [bg, title, area, closeLayer]);

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
    onClose();
  }

  makeShopButton(scene, closeLayer, 480, 556, 200, 30, "CLOSE (or press Esc)", true, close);
  return panel;
}
