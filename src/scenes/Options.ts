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
//
// Tester Notes, 10 Sep 2026 (claude/Bloom_Wars_Spitball_Ideas_Addendum_ReassuranceVerbAndTesterNotepad_08Sep2026.md
// §2, built for the first outside-friend alpha share): a fourth control, a
// local scratchpad reusing the exact same "everything stays on this
// computer, copy it yourself" rule the STATISTICS & BUG REPORTS block
// above already established. See src/engine/testerNotes.ts for the full
// design reasoning and src/scenes/ui/NotesPanel.ts for the panel itself.
// Every row below AUDIO shifted down 28px to make room — same "compact
// everything a little rather than scroll" call the 9 Sep audio rows
// already made (see this file's own note above them).
import Phaser from "phaser";
import { hasSeenTutorial, resetTutorialSeen, areTutorialHintsEnabled, setTutorialHintsEnabled, resetHubHintsSeen } from "../engine/campaignState";
import { clearStats, exportStatsJson, listMissionSummaries } from "../engine/statsStore";
import { currentGameVersion } from "../engine/telemetry";
import { applyDisplayScale, DISPLAY_SCALE_OPTIONS, getDisplayScaleOption, getStoredDisplayScaleId, setStoredDisplayScaleId } from "../engine/displayScale";
import { getTesterNotes } from "../engine/testerNotes";
import { makeShopButton } from "./shop/ShopPanel";
import { showCopyTextPanel } from "./ui/CopyTextPanel";
import { showNotesPanel } from "./ui/NotesPanel";
import { getMusicVolume, setMusicVolume, getSfxVolume, setSfxVolume } from "../engine/audioSettings";
import { playAmbient, stopAmbient, applyMusicVolumeLive, playSfx } from "./audio/AudioManager";
// "Clickable = tooltip," 11 Sep 2026 standing rule (claude/Bloom_Wars_
// Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md) — this
// screen's own row. Same HoverTip/wrapTipText pattern ShopPanel.ts/Hub.ts
// already use; Options has no competing scene-wide hover system the way
// Hub.ts did, so it needs only the plain three-listener wiring, not an
// arbitration flag.
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";

export class Options extends Phaser.Scene {
  private returnScene = "MainMenu";
  private statusText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private exportPanel: Phaser.GameObjects.Container | null = null;
  // Tester Notes, 10 Sep 2026 — same "panel open? don't stack a second one"
  // guard as exportPanel above, plus a status line under the button that
  // reflects how much is currently saved (mirrors statsText's own shape).
  private notesPanel: Phaser.GameObjects.Container | null = null;
  private notesStatusText!: Phaser.GameObjects.Text;
  // DISPLAY SIZE row rebuilds itself on every click (same "destroy and
  // redraw" shape as exportPanel above) — makeShopButton has no built-in
  // "selected" visual state, so the active option is shown by bracketing
  // its own label instead, the same idiom ShopPanel.ts already uses for
  // states like "AT MAX" rather than a separate highlight color.
  private displayScaleLayer: Phaser.GameObjects.Container | null = null;
  // Tutorial hints ON/OFF toggle, 8 Sep 2026 — same rebuild-on-click shape
  // as displayScaleLayer above, same bracket-the-active-option idiom.
  private tutorialToggleLayer: Phaser.GameObjects.Container | null = null;
  // Audio, "enough for EA" scope (A6, 9 Sep 2026) — same rebuild-on-click,
  // bracket-the-active-value shape as displayScaleLayer above. Discrete
  // 0/25/50/75/100 steps rather than a free-drag handle: this screen has no
  // existing drag-slider control to build on, and every other Options row
  // is this exact same "row of buttons, active one bracketed" idiom
  // (DISPLAY SIZE, TUTORIAL HINTS) — matching it was simpler and more
  // consistent than introducing a new interaction pattern for two rows.
  private musicVolumeLayer: Phaser.GameObjects.Container | null = null;
  private sfxVolumeLayer: Phaser.GameObjects.Container | null = null;
  // "Clickable = tooltip," 11 Sep 2026 — one instance for the whole screen,
  // same lifetime pattern ShopPanel.ts/Battle.ts already use.
  private hoverTip!: HoverTip;

  constructor() {
    super("Options");
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data.returnScene ?? "MainMenu";
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    this.exportPanel = null;
    this.notesPanel = null;
    this.displayScaleLayer = null;
    this.tutorialToggleLayer = null;
    this.musicVolumeLayer = null;
    this.sfxVolumeLayer = null;
    this.hoverTip = new HoverTip(this);
    this.add.text(480, 50, "OPTIONS", { fontFamily: "monospace", fontSize: "26px", color: "#e8e2d4" }).setOrigin(0.5);

    // Audio (A6, 9 Sep 2026) — this screen's own preview loop, so the MUSIC
    // slider has something live to demo against regardless of which scene
    // Options was opened from (Hub/Battle each stop their own ambient on
    // the way here — see AudioManager.ts's own header for why). Stopped on
    // this scene's SHUTDOWN like every other per-scene ambient owner.
    playAmbient(this, "hub");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopAmbient());

    // Vertical rhythm below is deliberately tight (compacted 9 Sep 2026 to
    // fit the two new AUDIO rows into the same 640px-tall screen without a
    // scrolling container, compacted again 10 Sep 2026 for TESTER NOTES) —
    // every row shrank a little rather than one row getting pushed off the
    // bottom.
    this.add
      .text(480, 110, "TUTORIAL HINTS", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(480, 130, "", { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a" })
      .setOrigin(0.5);
    this.refreshStatus();
    this.refreshTutorialToggleRow();

    const layer = this.add.container(0, 0);
    makeShopButton(
      this,
      layer,
      480,
      192,
      320,
      32,
      "RESET TUTORIAL HINTS",
      true,
      () => {
        resetTutorialSeen();
        // Hub Hints & Orientation, 11 Sep 2026 — this button's own label says
        // "tutorial hints," not "Mission 1 tutorial hints," so a player
        // pressing it reasonably expects EVERY hint sequence to reset, not
        // just the combat one. Bundled here rather than a second, separate
        // "reset Hub hints" control.
        resetHubHintsSeen();
        this.refreshStatus();
      },
      [
        "Reset Tutorial Hints",
        "",
        ...wrapTipText(
          "Clears every hint's own \"already seen\" flag — Mission 1's combat hints and the Hub orientation hints (Roster & Gear, crew talk, the Vault, Archive, Rec Room, the Bay) all play again from scratch. Doesn't touch the ON/OFF switch above — switched off, they still won't show even after this.",
          42
        ),
      ],
      this.hoverTip
    );

    this.add
      .text(480, 232, "STATISTICS & BUG REPORTS", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.statsText = this.add
      .text(480, 252, "", { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a", align: "center", wordWrap: { width: 720 } })
      .setOrigin(0.5);
    this.refreshStats();
    makeShopButton(
      this,
      layer,
      480,
      284,
      420,
      30,
      "COPY STATS + BUG REPORT TO CLIPBOARD",
      true,
      () => this.openExportPanel(),
      [
        "Copy Stats + Bug Report",
        "",
        ...wrapTipText(
          "Copies the game version, every mission recorded on this computer, and your install id to the clipboard as JSON, prefixed with a spot to describe what happened. If the clipboard write is silently blocked (some site embeds refuse it), the same text still opens in a selectable box you can copy by hand. Nothing is sent anywhere until you paste it yourself.",
          42
        ),
      ],
      this.hoverTip
    );
    makeShopButton(
      this,
      layer,
      480,
      318,
      320,
      28,
      "DELETE MY STATISTICS",
      true,
      () => {
        clearStats();
        this.refreshStats();
      },
      ["Delete My Statistics", "", ...wrapTipText("Permanently erases every mission record on this computer, including the install id. Can't be undone.", 42)],
      this.hoverTip
    );
    this.add
      .text(480, 344, "Everything stays on this computer. Nothing is sent anywhere unless you paste it somewhere yourself.", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4a5563",
      })
      .setOrigin(0.5);

    // Tester Notes, 10 Sep 2026 — same local-only rule as the block above,
    // reused rather than restated at length; see testerNotes.ts's own
    // header for the full reasoning (local-only, global not per-save,
    // scoped to closed testing).
    makeShopButton(
      this,
      layer,
      480,
      370,
      320,
      28,
      "TESTER NOTES",
      true,
      () => this.openNotesPanel(),
      ["Tester Notes", "", ...wrapTipText("Opens a local scratchpad for jotting down bugs or feedback as you play. Same local-only rule as the stats above — stays on this computer until you copy it out yourself.", 42)],
      this.hoverTip
    );
    this.notesStatusText = this.add
      .text(480, 394, "", { fontFamily: "monospace", fontSize: "10px", color: "#4a5563" })
      .setOrigin(0.5);
    this.refreshNotesStatus();

    this.add
      .text(480, 414, "AUDIO", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.refreshMusicVolumeRow();
    this.refreshSfxVolumeRow();

    this.add
      .text(480, 502, "DISPLAY SIZE", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.refreshDisplayScaleRow();

    makeShopButton(this, this.add.container(0, 0), 480, 606, 260, 32, "BACK", true, () => {
      this.scene.start(this.returnScene);
    }, ["Back", "", ...wrapTipText("Returns to where you opened Options from. Everything above is already saved as you set it.", 42)], this.hoverTip);
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
      .text(480, 524, `Caps how big Scale.FIT can stretch the game on a bigger monitor — current: ${current.shortLabel}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6b7a8a",
      })
      .setOrigin(0.5);
    row.add(status);

    DISPLAY_SCALE_OPTIONS.forEach((option, i) => {
      const cx = 480 + (i - 2) * 104;
      const label = option.id === current.id ? `[${option.shortLabel}]` : option.shortLabel;
      // "Clickable = tooltip," 11 Sep 2026 — option.label is this option's
      // own existing fuller description (engine/displayScale.ts), not new
      // copy invented for the tooltip.
      const scaleTooltip = [option.shortLabel, "", ...wrapTipText(option.label, 42)];
      makeShopButton(this, row, cx, 554, 96, 24, label, true, () => {
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
      }, scaleTooltip, this.hoverTip);
    });
  }

  /**
   * Shared builder for the two volume rows below — same "label left,
   * five bracket-buttons right, all on one line" layout for both, so
   * MUSIC and SFX read as a matched pair rather than two differently
   * shaped controls. `onPreview` fires AFTER the value is saved, so a
   * caller can give the player something to hear the new level with —
   * MUSIC updates the always-on preview loop live, SFX fires one short
   * sample sound.
   */
  private buildVolumeRow(row: Phaser.GameObjects.Container, y: number, label: string, current: number, onSet: (percent: number) => void, onPreview: () => void) {
    const labelText = this.add
      .text(300, y, `${label} ${current}%`, { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6" })
      .setOrigin(0, 0.5);
    row.add(labelText); // folded into the row so it's destroyed/rebuilt on every refresh, not left orphaned
    const steps = [0, 25, 50, 75, 100];
    // "Clickable = tooltip," 11 Sep 2026 — one shared line covers both
    // callers (MUSIC/SFX): each's own onPreview already plays something at
    // the new level the instant it's clicked, so "previews immediately" is
    // accurate for both without needing per-caller text.
    const volumeTooltip = [`${label} Volume`, "", ...wrapTipText(`Sets ${label.toLowerCase()} volume to this level and previews it immediately.`, 42)];
    steps.forEach((pct, i) => {
      const cx = 560 + i * 62;
      const on = pct === current;
      makeShopButton(this, row, cx, y, 54, 24, on ? `[${pct}]` : `${pct}`, true, () => {
        onSet(pct);
        onPreview();
      }, volumeTooltip, this.hoverTip);
    });
  }

  /** MUSIC volume — the Hub/battle ambient loop. See buildVolumeRow's own comment for the shared shape. */
  private refreshMusicVolumeRow() {
    this.musicVolumeLayer?.destroy(true);
    const row = this.add.container(0, 0);
    this.musicVolumeLayer = row;
    this.buildVolumeRow(row, 440, "MUSIC", getMusicVolume(), setMusicVolume, () => {
      // Live-updates the preview loop this screen's own create() started
      // (playAmbient(this, "hub") above) — no need to restart it, just
      // re-read the slider AudioManager's own applyMusicVolumeLive() does.
      applyMusicVolumeLive(this);
      this.refreshMusicVolumeRow();
    });
  }

  /** SFX volume — every one-shot sting. See buildVolumeRow's own comment for the shared shape. */
  private refreshSfxVolumeRow() {
    this.sfxVolumeLayer?.destroy(true);
    const row = this.add.container(0, 0);
    this.sfxVolumeLayer = row;
    this.buildVolumeRow(row, 468, "SFX", getSfxVolume(), setSfxVolume, () => {
      // A one-shot sample at the NEW level — playSfx reads the just-saved
      // volume itself, so this plays at whatever the player just picked.
      playSfx(this, "click");
      this.refreshSfxVolumeRow();
    });
  }

  /**
   * ON/OFF row for whether Mission 1 shows tutorial hints at all, 8 Sep
   * 2026 — Maxime's own call, a simple Options toggle rather than a bigger
   * separate tutorial-mission system. Same rebuild-on-click shape as
   * refreshDisplayScaleRow above, same bracket-the-active-option idiom.
   * Independent of RESET TUTORIAL HINTS below it: that button clears the
   * "already seen" flag so the sequence plays again; this switch controls
   * whether it's ever allowed to play at all, seen or not.
   */
  private refreshTutorialToggleRow() {
    this.tutorialToggleLayer?.destroy(true);
    const row = this.add.container(0, 0);
    this.tutorialToggleLayer = row;
    const enabled = areTutorialHintsEnabled();
    // "Clickable = tooltip," 11 Sep 2026 standing rule — both buttons shown
    // hovering either state, since this row is a toggle, not a one-way
    // action: clicking the button you're already on is a no-op the tooltip
    // should make obvious rather than silently doing nothing.
    const onTooltip = ["Tutorial Hints: ON", "", ...wrapTipText("Mission 1's combat hints and every Hub orientation hint are allowed to play. Independent of RESET TUTORIAL HINTS above — that only clears the \"already seen\" flag, this decides whether they're allowed to show at all.", 42)];
    const offTooltip = ["Tutorial Hints: OFF", "", ...wrapTipText("Mission 1's combat hints and every Hub orientation hint stay hidden, even ones never seen before. Flip back to ON to let them show again.", 42)];
    makeShopButton(this, row, 440, 158, 80, 26, enabled ? "[ON]" : "ON", true, () => {
      setTutorialHintsEnabled(true);
      this.refreshTutorialToggleRow();
      this.refreshStatus();
    }, onTooltip, this.hoverTip);
    makeShopButton(this, row, 524, 158, 80, 26, enabled ? "OFF" : "[OFF]", true, () => {
      setTutorialHintsEnabled(false);
      this.refreshTutorialToggleRow();
      this.refreshStatus();
    }, offTooltip, this.hoverTip);
  }

  private refreshStatus() {
    if (!areTutorialHintsEnabled()) {
      this.statusText.setText("turned off — Mission 1 won't show hints, even on a browser that's never seen them");
      return;
    }
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

  /** Mirrors refreshStats()'s own shape — a short one-line summary of what's currently saved. */
  private refreshNotesStatus() {
    const notes = getTesterNotes();
    this.notesStatusText.setText(notes.trim().length === 0 ? "nothing saved yet — local scratchpad, copy it yourself when you want to send it" : `${notes.length} characters saved — local scratchpad, copy it yourself when you want to send it`);
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
    // The panel body moved to scenes/ui/CopyTextPanel.ts on 5 Sep 2026, when
    // Debrief's COPY MISSION LOG (B7) needed the same thing — behavior here
    // is unchanged, including the always-show-the-textarea rule that exists
    // because itch.io's iframe can refuse a clipboard write silently. See
    // that file's header.
    this.exportPanel = showCopyTextPanel(this, blob, () => {
      this.exportPanel = null;
    });
  }

  /**
   * The Tester Notes scratchpad — an editable panel, unlike
   * openExportPanel's read-only one above. See scenes/ui/NotesPanel.ts's
   * own header for why it's a separate component rather than a second mode
   * on showCopyTextPanel.
   */
  private openNotesPanel() {
    if (this.notesPanel) return;
    this.notesPanel = showNotesPanel(this, () => {
      this.notesPanel = null;
      this.refreshNotesStatus();
    });
  }
}
