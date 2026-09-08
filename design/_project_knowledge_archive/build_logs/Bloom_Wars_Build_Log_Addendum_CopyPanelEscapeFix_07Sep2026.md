# Build Log Addendum — Copy Panel Stuck-Screen Fix, 7 Sep 2026

**Status: built, committed to the device, live-verified against the actual running dev build. Toolchain (`tsc`/`vitest`/`vite build`) not run this session — see "Not verified" below.**

Maxime, mid-conversation, verbatim: *"ohh right, I'm stuck on the copy mission log screen, I cant go back."*

## 1. What happened, and the immediate unstick

He'd clicked COPY MISSION LOG on a real Debrief screen and the CLOSE button was unreachable — no visible error, just stuck. Gave him a console command to run right then (`Debrief` scene's `missionLogPanel.destroy(true)` plus clearing the field), which is the exact same cleanup the CLOSE button itself calls, just triggered directly since the button was unclickable. That's a live workaround, not the fix — the fix below is what stops it happening again.

## 2. Reproducing it without waiting on a real mission

`COPY MISSION LOG` (Debrief.ts) and `COPY STATS + BUG REPORT` (Options.ts) share one component, `scenes/ui/CopyTextPanel.ts` — so the bug was reproducible through Options without needing to finish a mission first. Confirmed live, via Claude in Chrome against Maxime's own running dev server:

- At his actual saved **Display Size setting (125%** — `engine/displayScale.ts`'s own `DEFAULT_DISPLAY_SCALE` is **150%**, so this isn't a rare setting, it's closer to what a first-time player sees by default): opening the panel renders the textarea's real on-screen footprint large enough to sit in front of the CLOSE button. A real HTML `<textarea>` (this panel uses Phaser's DOM Element feature, `scene.add.dom`) always paints in front of anything Phaser draws on the canvas underneath it, so the click never lands on the button no matter how precisely you click it — it's not a small hitbox problem, the button is genuinely covered.
- At **Display Size 100%**, the same panel opens clean and CLOSE works fine.

**Root cause not fully pinned down.** Direct DOM measurement (via `window.__bwGame`, the dev-only Phaser instance handle already exposed for the Playwright harness) showed the textarea's rendered size DOES scale roughly in step with the canvas at 125% — so this isn't simply "the DOM element ignores the scale entirely," which was my first guess. There's a real but smaller vertical-position discrepancy in the numbers (on the order of tens of logical pixels) that I didn't chase to a precise explanation — Phaser's DOM Element positioning under a custom parent-cap scale system like `displayScale.ts`'s isn't a combination I could fully verify remotely in the time this took. Worth a proper look together if you want the CLOSE button itself pixel-correct at every Display Size, but see the fix below for why that's not blocking.

## 3. The actual fix — doesn't depend on solving the CSS puzzle

Rather than chase the exact scaling math, `CopyTextPanel.ts` now closes on **Escape**, independent of any canvas-vs-DOM layering issue:

```ts
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") { e.preventDefault(); close(); }
};
document.addEventListener("keydown", onKeyDown);

function close() {
  document.removeEventListener("keydown", onKeyDown);
  panel.destroy(true);
  onClose();
}
```

The CLOSE button now reads **"CLOSE (or press Esc)"** so a player who does see it knows the escape hatch exists even if the button itself is ever partly obscured again. Both call sites (`Debrief.ts`'s COPY MISSION LOG, `Options.ts`'s COPY STATS + BUG REPORT) get this for free since they share the one component — one fix, not two.

## 4. Verified, and not verified

**Verified live, same session:** opened the panel at his real 125% setting via `scene.openExportPanel()` (Options), confirmed both `scene.exportPanel` and the DOM `<textarea>` existed; dispatched a real `Escape` keydown at the document level (same event a real keypress produces); confirmed both were gone immediately after — panel destroyed, field cleared, no console errors before or after. That's the actual shipped code running for real, not a reimplementation.

**Not verified:** `tsc --noEmit`, `eslint` (though the standing `npm run lint` pass you ran earlier today covers the rest of the backlog, this file wasn't part of that run since it's a fresh edit after), and `vitest` haven't run — no `device_bash` this session. Neither has a production `vite build`. And the underlying "why does the textarea's footprint grow enough to cover the button at 125%+" question from section 2 is still genuinely open — Escape makes it a non-issue for getting stuck, but the visual bug itself (CLOSE button potentially half-covered) isn't fixed, just made irrelevant.

## 5. Not investigated this pass

Whether other DOM-element-based UI in the game (the Hub's typed-chat input is the only other `scene.add.dom` user, per `main.ts`'s own comment) has a related issue at non-100% Display Size. Chat input is a single-line text box near the bottom of the screen, structurally less likely to grow into anything else — not treated as urgent, not checked.
