// The cursor-following hover tip, 2 Sep 2026. Maxime: "add a small popup
// window next to the mouse giving you basic info on what you mouse over."
//
// This is the drawing half only — every placement decision it makes comes
// from engine/hoverTipLayout.ts, which is Phaser-free and unit-tested (see
// that file's header for why the split exists). Nothing in here computes a
// coordinate on its own.
//
// Why a shared class rather than per-scene code: Battle already had this
// exact content (unit stats, forecast, on-hit effects) rendering into the
// right-hand HUD panel, and the Hub needs its own version for NPCs. Two
// scenes drawing their own floating panel would be two sets of the same
// corner-flip bugs. Scenes supply the LINES; this owns the box.
import Phaser from "phaser";
import { layoutHoverTip, measureTipBox } from "../../engine/hoverTipLayout";

/** Monospace advance width at 11px, measured against this game's own font stack. */
const CHAR_W = 6.6;
const LINE_H = 14;
const PADDING = 7;
const FONT_SIZE = "11px";

const BG_COLOR = 0x14181d;
const BG_ALPHA = 0.96;
const BORDER_COLOR = 0x5a6a7a;
const TEXT_COLOR = "#d8d2c4";
/** Above every board element, HUD line and overlay this game draws. */
const TIP_DEPTH = 10_000;

/**
 * A floating info box that follows the pointer.
 *
 * Created once per scene in `create()`, fed lines from that scene's own
 * hover logic, and hidden whenever there's nothing under the cursor. Cheap
 * to call every frame: identical content short-circuits before touching a
 * single Phaser object, so a stationary pointer costs one string compare.
 */
export class HoverTip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private lastKey = "";
  private lastX = -1;
  private lastY = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.rectangle(0, 0, 10, 10, BG_COLOR, BG_ALPHA).setOrigin(0, 0).setStrokeStyle(1, BORDER_COLOR);
    this.text = scene.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: FONT_SIZE, color: TEXT_COLOR, lineSpacing: 2 })
      .setOrigin(0, 0);
    // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — Hub.ts's own camera
    // now scrolls per deck (Battle.ts's own camera still doesn't move).
    // show() below positions this container using screen-space pointerX/Y
    // handed to it by the host scene (layoutHoverTip works in scene.scale.
    // width/height, not camera-relative), so it needs scrollFactor(0) to
    // keep those screen coordinates from being reinterpreted as world
    // coordinates the moment Hub's camera pans. A no-op for Battle.ts.
    this.container = scene.add.container(0, 0, [this.bg, this.text]).setDepth(TIP_DEPTH).setVisible(false).setScrollFactor(0);
  }

  /**
   * Show `lines` next to (`pointerX`, `pointerY`), or hide the tip entirely
   * if there's nothing to say.
   *
   * Leading blank lines are dropped: the scenes feeding this reuse the same
   * line builders that write into a HUD panel, where a leading "" is a
   * deliberate spacer between blocks. In a standalone box it's just a gap
   * at the top.
   */
  show(lines: string[], pointerX: number, pointerY: number): void {
    const trimmed = [...lines];
    while (trimmed.length && trimmed[0] === "") trimmed.shift();
    while (trimmed.length && trimmed[trimmed.length - 1] === "") trimmed.pop();
    if (trimmed.length === 0) {
      this.hide();
      return;
    }

    const key = trimmed.join("\n");
    const moved = pointerX !== this.lastX || pointerY !== this.lastY;
    if (key === this.lastKey && !moved && this.container.visible) return;

    if (key !== this.lastKey) {
      this.text.setText(key);
      const { w, h } = measureTipBox(trimmed, CHAR_W, LINE_H, PADDING);
      this.bg.setSize(w, h);
      this.text.setPosition(PADDING, PADDING);
      this.lastKey = key;
    }

    const pos = layoutHoverTip(
      pointerX,
      pointerY,
      this.bg.width,
      this.bg.height,
      this.scene.scale.width,
      this.scene.scale.height,
    );
    this.container.setPosition(pos.x, pos.y).setVisible(true);
    this.lastX = pointerX;
    this.lastY = pointerY;
  }

  hide(): void {
    if (this.container.visible) this.container.setVisible(false);
    this.lastX = -1;
    this.lastY = -1;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
