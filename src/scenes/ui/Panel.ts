// src/scenes/ui/Panel.ts
// The shared chrome every "owns the screen until Esc" overlay in this game
// draws from, pulled out 10 Sep 2026 (UI Prettiness Pass v1) rather than
// reskinned in place, nine separate times. Before this file:
// StandingsPanel.ts, MissionBriefingPanel.ts, and Hub.ts's own
// buildWorkshopOverlay/buildVaultOverlay each hand-built the identical
// container + background rectangle + "[ close — Esc ]" button from
// scratch, with the same palette constants (PANEL_BG/PANEL_BORDER/
// TEXT_MAIN/TEXT_DIM) copy-pasted into each file rather than declared
// once. Bloom_Wars_UI_Prettiness_Pass_Plan_v1 named this the real reason
// the Workshop/Vault overlays read as flat: not neglect, nine separately
// hand-drawn boxes that never shared a visual identity. This is that
// shared identity, extracted once.
//
// Deliberately narrow: this owns CHROME (background, corner framing, a
// title bar, the close control, and — opt-in — a masked, wheel-scrollable
// content well). It does not own what goes inside, and it does not
// replace StandingsPanel/MissionBriefingPanel's own row-building logic or
// Hub.ts's renderWorkshop/renderVault — those still decide what their own
// panel shows; this only decides what the box around it looks like.
// Maxime's own call (AskUserQuestion, 10 Sep 2026): extract the shared
// component before reskinning Workshop/Vault, so the fix lands once
// instead of nine times as the rest of Hub.ts's overlays eventually get
// the same treatment.
//
// Visual direction below is Claude's own call, not Maxime's — flagged per
// the project's attribution rule. He asked for color/contrast and
// typography/spacing specifically (AskUserQuestion, 10 Sep 2026), not
// motion or a framing rework, and approved a mockup (published artifact,
// "Carrier Deck Readout") built on a from-scratch teal/dark-ink palette
// with real web fonts (Chakra Petch/JetBrains Mono) — that mockup was
// direction-setting only, not a spec (its own doc says so). Two reasons
// this file doesn't copy it pixel-for-pixel: introducing new font
// families would mean adding font-loading infrastructure this project
// doesn't have yet (index.html loads no webfont today, and Phaser draws
// text into a texture at CREATE time — text built before a font finishes
// loading silently bakes in the fallback face and never updates, a real,
// separate piece of scope, not a styling tweak); and a wholesale palette
// swap on only four screens would leave two visual languages in one game,
// since History/Highlights/Peg Board/Poker/Darts/Standings/Mission
// Briefing aren't part of this pass. So this keeps the existing monospace
// face and the existing dark-slate/warm-gold family (already shared,
// just copy-pasted, across StandingsPanel/MissionBriefingPanel/Hub's
// other overlays) and pushed on CONTRAST (a visible corner-bracket frame
// instead of a plain stroked rectangle) and TYPOGRAPHY (one fixed
// size/color scale instead of every overlay picking its own 10-vs-11-vs-
// 12px by feel) within it.
//
// UPDATE, 11 Sep 2026 — the "real palette overhaul" this comment flagged
// above as a future decision got asked for directly: "make the ui of all
// of them like the codex ui." Codex.ts already has an established look
// (its own PAL object) that RosterPanel.ts's own Codex-styled cards (9
// Sep, Maxime's own ask that time too) already pull from — a real,
// existing in-game reference, not a new invention, so this converges on
// it exactly rather than approximating: PANEL_ACCENT/TEXT_ACCENT corrected
// from a close-but-not-equal 0xc8b273 to Codex's actual 0xe0b23c, a new
// PANEL_CARD_BORDER added for Codex's two-tier border (a subtler stroke
// on individual cards than on the outer panel frame — see ShopPanel.ts/
// MapSelect.ts for where that now applies), and the corner-bracket frame
// below — Claude's own decorative addition, not Maxime's ask, flagged as
// such above when it shipped — removed, since Codex has no such motif on
// anything. Still the existing monospace face and dark-slate family, now
// pinned to Codex's own numbers instead of merely "close to" them.
import Phaser from "phaser";
import { wrapTipText } from "../../engine/hoverTipLayout";

// Matches the value StandingsPanel.ts, MissionBriefingPanel.ts, and every
// overlay in Hub.ts already use for their own hand-declared PANEL_BG/0.96 —
// deliberately NOT FramePanel.ts's slightly darker 0x141a20 (a fifth,
// narrower-scoped overlay with its own different palette), so background
// darkness doesn't shift on the four screens this pass touches relative to
// the ones it doesn't.
export const PANEL_BG = 0x1a2028;
export const PANEL_BG_ALPHA = 0.96;
// Codex UI match, 11 Sep 2026 (Maxime: "make the ui of all of them like the
// codex ui") — pulled directly from Codex.ts's own PAL object rather than
// re-guessed, since that's the concrete "the codex UI" he's pointing at.
// Codex actually runs a two-tier border: PANEL_BORDER (== PAL.panelBorder /
// PAL.cardBorderLight) frames the outer panel, PANEL_CARD_BORDER (==
// PAL.cardBorder, one step darker/subtler) frames individual cards inside
// it — outer edges read, inner rows don't compete with them. This file
// used one flat border for both before this pass; ShopPanel.ts/MapSelect.ts
// still need their own card-stroke lines switched to PANEL_CARD_BORDER to
// pick this up (see each file's own 11 Sep note).
export const PANEL_BORDER = 0x3a4552;
export const PANEL_CARD_BORDER = 0x2a323b;
// Was 0xc8b273 — a close but NOT identical gold to Codex's own PAL.accent
// (0xe0b23c/#e0b23c), which is what every other card-based UI in this game
// (RosterPanel's Codex-styled cards, Codex.ts itself) actually renders.
// Corrected to match exactly rather than "close enough."
export const PANEL_ACCENT = 0xe0b23c;
export const TEXT_MAIN = "#e8e2d4";
export const TEXT_DIM = "#8a97a6";
export const TEXT_ACCENT = "#e0b23c";
// "Can't afford yet / not implemented" — already the third color every
// shop-style panel in this game converges on by hand (ShopPanel's
// unaffordable rows, Workshop's greyed-out modules, Vault's locked
// abilities all land within a few hex digits of this on their own).
export const TEXT_MUTED = "#5a6572";

export const PANEL_TITLE_SIZE = "13px";
export const PANEL_SECTION_SIZE = "11px";
export const PANEL_BODY_SIZE = "11px";
export const PANEL_META_SIZE = "9px";

export interface PanelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PanelOptions {
  /** Depth for the whole panel; every existing overlay in this game already opens at 60. */
  depth?: number;
  /** Fixed title text drawn top-left of the header row. Omit for a panel with no title of its own. */
  title?: string;
  /** When true, `content` is masked to the body area and offset by scrollBy() — see setContentExtent(). Off by default: most panels don't need it yet. */
  scrollable?: boolean;
  /** Extra controls in the header row, alongside the title and the close button — e.g. the Vault's own "[ the roll — pilots lost ]" link. */
  extraHeader?: (bounds: PanelBounds, add: (obj: Phaser.GameObjects.GameObject) => void) => void;
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // Every current caller of this class (Hub.ts's Workshop and Vault panels)
  // draws straight into Hub's own scene, over its own competing scene-wide
  // hover system — same reason RosterPanel.ts/MemorialPanel.ts/
  // StandingsPanel.ts/MissionBriefingPanel.ts all take Hub's wireHoverTip as
  // a callback instead of owning a HoverTip. Panel.ts is shared chrome, so
  // it takes the same callback here, generically, for whatever control of
  // its own it draws — today just the close button.
  showTooltip?: (obj: Phaser.GameObjects.GameObject, lines: string[]) => void;
  /**
   * Body text for the close button's tooltip. Deliberately a caller-supplied
   * string, not something Panel guesses: "closing" means something different
   * on a read-only overlay than on one that saves as you go, and Panel.ts
   * itself has no idea which its caller is. No tooltip is shown on the close
   * button at all if this is omitted, even when showTooltip is present — a
   * confident-sounding generic guess would be worse than staying silent.
   */
  closeTooltipBody?: string;
}

/**
 * One popup that owns the screen until Esc, built the same way everywhere.
 * Callers still own WHAT they draw (`content` is a plain container to add
 * to, `add()`/`clearContent()` are the only bookkeeping this class does for
 * them) and still own their own open/close state, exactly the way Hub.ts's
 * own workshopOpen/vaultOpen flags already do — this only replaces the box.
 */
export class Panel {
  readonly frame: Phaser.GameObjects.Container;
  readonly content: Phaser.GameObjects.Container;
  readonly bounds: PanelBounds;
  private scrollMinY = 0;
  private readonly scrollable: boolean;

  constructor(scene: Phaser.Scene, bounds: PanelBounds, onClose: () => void, options: PanelOptions = {}) {
    this.bounds = bounds;
    this.scrollable = options.scrollable ?? false;
    const depth = options.depth ?? 60;
    const cx = (bounds.left + bounds.right) / 2;
    const cy = (bounds.top + bounds.bottom) / 2;

    this.frame = scene.add.container(0, 0).setDepth(depth).setVisible(false).setScrollFactor(0);

    const bg = scene.add
      .rectangle(cx, cy, bounds.right - bounds.left, bounds.bottom - bounds.top, PANEL_BG, PANEL_BG_ALPHA)
      .setStrokeStyle(1, PANEL_BORDER)
      .setScrollFactor(0);
    this.frame.add(bg);

    // Corner-bracket framing REMOVED, 11 Sep 2026 (Codex UI match — Maxime:
    // "make the ui of all of them like the codex ui"). This was flagged in
    // this file's own header, the first time it shipped, as "the one purely
    // decorative addition this pass makes" — Claude's own call, not
    // Maxime's ask, ported from the approved mockup's CSS corner-bracket
    // motif. Codex.ts itself has no such motif anywhere (checked directly —
    // every panel/card edge there is a plain 1px stroked rectangle), so
    // keeping it would mean matching Codex's colors while keeping a framing
    // idea Codex never had. Reversed rather than kept: a plain stroked
    // rectangle (bg, just above) is now this panel's entire frame, same as
    // every panel in Codex.ts.
    //
    // Bug caught live, 10 Sep 2026 (Maxime, screenshot off his own build): the
    // Vault's extraHeader (its "[ the roll — pilots lost ]" link) was drawn
    // at the SAME row as the title — both sitting at bounds.top+20, just 2px
    // apart on x — so the two texts rendered on top of each other, letters
    // interleaved into a garbled mess. A title-only panel (Workshop) never
    // hit this; only a panel that combines `title` AND `extraHeader` does.
    // Fix: when extraHeader is present, reserve a second row for it below
    // the title, and push the rule + content well down to make room — the
    // caller (buildVaultOverlay) then draws its extraHeader into that row
    // instead of the title's own row. headerExtra is 0 (no change at all)
    // for every panel that doesn't use extraHeader, Workshop included.
    const headerExtra = options.extraHeader ? 16 : 0;
    if (options.title) {
      const title = scene.add
        .text(bounds.left + 18, bounds.top + 20, options.title, {
          fontFamily: "monospace",
          fontSize: PANEL_TITLE_SIZE,
          color: TEXT_MAIN,
          letterSpacing: 1,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0);
      this.frame.add(title);
      const rule = scene.add.rectangle(cx, bounds.top + 36 + headerExtra, bounds.right - bounds.left - 24, 1, PANEL_BORDER, 0.8).setScrollFactor(0);
      this.frame.add(rule);
    }

    const closeBtn = scene.add
      .text(bounds.right - 18, bounds.top + 20, "[ close — Esc ]", { fontFamily: "monospace", fontSize: PANEL_META_SIZE, color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    closeBtn.on("pointerover", () => closeBtn.setColor(TEXT_MAIN));
    closeBtn.on("pointerout", () => closeBtn.setColor(TEXT_DIM));
    closeBtn.on("pointerdown", onClose);
    if (options.showTooltip && options.closeTooltipBody) {
      options.showTooltip(closeBtn, ["Close", "", ...wrapTipText(options.closeTooltipBody, 42)]);
    }
    this.frame.add(closeBtn);

    if (options.extraHeader) {
      options.extraHeader(bounds, (obj) => this.frame.add(obj));
    }

    // Content well — one container below the header rule (or the top edge,
    // on a titleless panel). Scrollable panels mask this to the body and
    // let the caller offset it via scrollBy()/setContentExtent(); a
    // non-scrollable panel leaves it exactly as a plain container, same as
    // StandingsPanel/MissionBriefingPanel today.
    this.content = scene.add.container(0, 0);
    this.frame.add(this.content);
    if (this.scrollable) {
      const contentTop = options.title ? bounds.top + 46 : bounds.top + 8;
      const maskShape = scene.make.graphics({});
      maskShape.setScrollFactor(0);
      maskShape.fillRect(bounds.left, contentTop, bounds.right - bounds.left, bounds.bottom - contentTop - 8);
      this.content.setMask(maskShape.createGeometryMask());
    }
  }

  open(): void {
    this.frame.setVisible(true);
    if (this.scrollable) this.content.y = 0;
  }

  close(): void {
    this.frame.setVisible(false);
  }

  get visible(): boolean {
    return this.frame.visible;
  }

  /**
   * Destroy every child added since the last clear — the "rebuild wholesale
   * on every render, don't patch in place" discipline every panel in this
   * game already follows (renderWorkshop/renderVault/StandingsPanel.render).
   * Keeps the frame (background, corners, title, close button) untouched.
   */
  clearContent(): void {
    this.content.removeAll(true);
  }

  /**
   * Add one built row/object to the content well — the same bookkeeping
   * Hub.ts's own workshopRows.push/vaultRows.push did by hand, kept here so
   * a caller doesn't need its own array just to satisfy clearContent().
   */
  add(obj: Phaser.GameObjects.GameObject): void {
    this.content.add(obj);
  }

  /**
   * Scrollable panels only — call after a render with the Y just past the
   * last row drawn. Same "however far past the panel's own bottom edge the
   * content landed is how far it's allowed to scroll, floored at 0" math
   * Hub.ts's own Vault scroll fix and MapSelect.ts's mission list already
   * use by hand. A no-op on a non-scrollable panel.
   */
  setContentExtent(bottomY: number): void {
    if (!this.scrollable) return;
    this.scrollMinY = -Math.max(0, bottomY + 16 - this.bounds.bottom);
    this.content.y = Phaser.Math.Clamp(this.content.y, this.scrollMinY, 0);
  }

  /**
   * Wire this to the scene's own wheel handler — mirrors the Vault's own
   * guarded, reset-not-stacked listener (Hub.ts re-runs create() on every
   * visit, so that listener resets with `this.input.off("wheel")` first;
   * Panel doesn't register input itself, on purpose, so a caller keeps
   * owning exactly one wheel listener per scene, the discipline Hub.ts's
   * own comments already insist on).
   */
  scrollBy(dy: number): void {
    if (!this.scrollable) return;
    this.content.y = Phaser.Math.Clamp(this.content.y - dy * 0.5, this.scrollMinY, 0);
  }

  destroy(): void {
    this.frame.destroy(true);
  }
}
