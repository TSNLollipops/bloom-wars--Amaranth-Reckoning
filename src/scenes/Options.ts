// src/scenes/Options.ts
// Main Menu / Save / Ironman UI Plan v1 §7, 28 Aug 2026 — deliberately thin.
// The plan doc's own scope note for this screen: nothing here beyond a
// "reset tutorial hints" toggle for a first pass — no audio/graphics
// settings exist anywhere in this codebase yet to put on a real options
// screen, and stubbing controls for systems that don't exist would be
// exactly the kind of unflagged scope growth the project's own build rules
// warn against. Reachable from two places (MainMenu's own OPTIONS button,
// and every in-play MenuOverlay's OPTIONS row) — both pass a `returnScene`
// so BACK lands wherever this was actually opened from, not a hardcoded
// MainMenu.
//
// Telemetry pass, 1 Sep 2026 (claude/Bloom_Wars_Player_Telemetry_Plan_v1.md
// §5.1, feature-gap report A7): two more controls — "copy stats + bug
// report" (the blob a tester pastes into the itch thread: version, every
// stored mission record, and the install id) and "delete my statistics."
// Nothing here uploads anything; the store is local-only by design.
//
// Screen Resolution Plan v1, 2 Sep 2026 — a third control, DISPLAY SIZE:
// caps how far main.ts's Phaser.Scale.FIT is allowed to stretch the game on
// a bigger monitor (Maxime's own "the UI gotten too big" report). See
// src/engine/displayScale.ts and claude/Bloom_Wars_Screen_Resolution_Plan_v1.md.
import Phaser from "phaser";
import { hasSeenTutorial, resetTutorialSeen } from "../engine/campaignState";
import { clearStats, exportStatsJson, listMissionSummaries } from "../engine/statsStore";
import { currentGameVersion } from "../engine/telemetry";
import { applyDisplayScale, DISPLAY_SCALE_OPTIONS, getDisplayScaleOption, getStoredDisplayScaleId, setStoredDisplayScaleId } from "../engine/displayScale";
import { makeShopButton } from "./shop/ShopPanel";

export class Options extends Phaser.Scene {
  private returnScene = "MainMenu";
  private statusText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private exportPanel: Phaser.GameObjects.Container | null = null;
  // DISPLAY SIZE row rebuilds itself on every click (same "destroy and
  // redraw" shape as exportPanel above) — makeShopButton has no built-in
  // "selected" visual state, so the active option is shown by bracketing
  // its own label instead, the same idiom ShopPanel.ts already uses for
  // states like "AT MAX" rather than a separate highlight color.
  private displayScaleLayer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("Options");
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data.returnScene ?? "MainMenu";
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    this.exportPanel = null;
    this.displayScaleLayer = null;
    this.add.text(480, 50, "OPTIONS", { fontFamily: "monospace", fontSize: "26px", color: "#e8e2d4" }).setOrigin(0.5);

    this.add
      .text(480, 150, "TUTORIAL HINTS", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(480, 174, "", { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a" })
      .setOrigin(0.5);
    this.refreshStatus();

    const layer = this.add.container(0, 0);
    makeShopButton(this, layer, 480, 216, 320, 36, "RESET TUTORIAL HINTS", true, () => {
      resetTutorialSeen();
      this.refreshStatus();
    });

    this.add
      .text(480, 300, "STATISTICS & BUG REPORTS", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.statsText = this.add
      .text(480, 324, "", { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a", align: "center", wordWrap: { width: 720 } })
      .setOrigin(0.5);
    this.refreshStats();
    makeShopButton(this, layer, 480, 372, 420, 36, "COPY STATS + BUG REPORT TO CLIPBOARD", true, () => this.openExportPanel());
    makeShopButton(this, layer, 480, 416, 320, 32, "DELETE MY STATISTICS", true, () => {
      clearStats();
      this.refreshStats();
    });
    this.add
      .text(480, 448, "Everything stays on this computer. Nothing is sent anywhere unless you paste it somewhere yourself.", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4a5563",
      })
      .setOrigin(0.5);

    this.add
      .text(480, 478, "DISPLAY SIZE", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.refreshDisplayScaleRow();

    makeShopButton(this, this.add.container(0, 0), 480, 590, 260, 34, "BACK", true, () => {
      this.scene.start(this.returnScene);
    });
  }

  /**
   * Rebuilds the DISPLAY SIZE status line + button row from scratch — the
   * whole row is thrown away and redrawn on every click rather than mutated
   * in place, same shape as refreshStatus()/refreshStats() above but for
   * game objects instead of just text, since the currently-active option's
   * bracketed label has to move to whichever button was just clicked.
   */
  private refreshDisplayScaleRow() {
    this.displayScaleLayer?.destroy(true);
    const row = this.add.container(0, 0);
    this.displayScaleLayer = row;

    const current = getDisplayScaleOption(getStoredDisplayScaleId());
    const status = this.add
      .text(480, 500, `Caps how big Scale.FIT can stretch the game on a bigger monitor — current: ${current.shortLabel}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6b7a8a",
      })
      .setOrigin(0.5);
    row.add(status);

    DISPLAY_SCALE_OPTIONS.forEach((option, i) => {
      const cx = 480 + (i - 2) * 104;
      const label = option.id === current.id ? `[${option.shortLabel}]` : option.shortLabel;
      makeShopButton(this, row, cx, 534, 96, 26, label, true, () => {
        setStoredDisplayScaleId(option.id);
        applyDisplayScale(option.id);
        // Changing #app's own CSS max-width/max-height doesn't fire a
        // resize event on its own, and ScaleManager.refresh() alone isn't
        // enough either — it recomputes from ScaleManager's own CACHED
        // parentSize, which is only ever refreshed by getParentBounds()
        // (normally called once per frame from the game's own step loop,
        // so relying on that alone would apply the new cap one frame late
        // — harmless at 60fps, but this makes it deterministic). Calling
        // getParentBounds() first forces a fresh, synchronous read of
        // #app's real DOM size — post-CSS-change — before refresh() uses
        // it, so the new cap takes visible effect on this exact click, no
        // reload and no next-frame wait needed. (Verified via Playwright:
        // without the getParentBounds() call, boundingBox() measurements
        // consistently lagged one click behind the button actually
        // clicked — see claude/Bloom_Wars_Screen_Resolution_Plan_v1.md.)
        this.scale.getParentBounds();
        this.scale.refresh();
        this.refreshDisplayScaleRow();
      });
    });
  }

  private refreshStatus() {
    this.statusText.setText(
      hasSeenTutorial() ? "already shown on this browser — reset to see them again on your next Mission 1" : "not shown yet — nothing to reset"
    );
  }

  private refreshStats() {
    const records = listMissionSummaries();
    const wins = records.filter((r) => r.outcome === "win").length;
    this.statsText.setText(
      records.length === 0
        ? "no missions recorded on this computer yet"
        : `${records.length} mission${records.length === 1 ? "" : "s"} recorded on this computer (${wins} won) — v${currentGameVersion()}`
    );
  }

  /**
   * The export: tries the clipboard first (works in Electron and on any
   * https page that allows it), and ALWAYS shows the blob in a selectable
   * textarea too, since the clipboard call is silently refused inside some
   * embeds (itch.io's iframe among them) — the player can select-all and
   * copy by hand either way. Prefixed with the version and the date so a
   * pasted report is self-identifying.
   */
  private openExportPanel() {
    if (this.exportPanel) return;
    const header = `The Bloom Wars — bug report / statistics\nversion: v${currentGameVersion()}\nexported: ${new Date().toISOString()}\nwhat happened (fill in): \n\n`;
    const blob = header + exportStatsJson();
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
    const bg = this.add.rectangle(480, 320, 880, 520, 0x0c0f12, 0.97).setStrokeStyle(2, 0x4a7a9a).setInteractive();
    const title = this.add
      .text(480, 84, copied ? "Copied to clipboard — or select all in the box and copy it yourself" : "Select all in the box (Ctrl+A) and copy (Ctrl+C)", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#facc15",
      })
      .setOrigin(0.5);
    const area = this.add.dom(480, 320, "textarea", {
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
    const closeLayer = this.add.container(0, 0);
    makeShopButton(this, closeLayer, 480, 556, 200, 30, "CLOSE", true, () => {
      this.exportPanel?.destroy(true);
      this.exportPanel = null;
    });
    this.exportPanel = this.add.container(0, 0, [bg, title, area, closeLayer]);
  }
}
