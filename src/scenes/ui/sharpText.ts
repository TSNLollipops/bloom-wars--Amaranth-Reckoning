// src/scenes/ui/sharpText.ts
//
// Sharp text at any window size. WePlaytestGames playtest, 30 Sep 2026:
// "This text is very blurry; this one is sharp but this one is hard to read."
//
// Why it was blurry: every scene is laid out on a 1074x640 canvas, and
// Scale.FIT (main.ts) stretches that canvas with CSS up to the player's
// display-scale cap. Phaser draws each Text object into its own small
// texture at 1 texture pixel per game pixel, so any stretch above 100%
// smears it, exactly like zooming a photo. Graphics (rectangles, rings)
// get the same stretch but have soft edges anyway; small text is where it
// shows. Some text looked sharper only because it was bigger or bolder.
//
// Fix: draw every Text object's texture at 2-3x (Phaser's per-text
// `resolution`). Layout is untouched: resolution changes texture pixels,
// not the object's size in game coordinates. Cost is texture memory (4-9x
// per text object), which is small next to the portraits.
//
// Done once, globally, by wrapping the `scene.add.text` factory, so all
// 130+ call sites (and any future one) get it without each passing a style
// key. A call that sets its own `resolution` in the style keeps it.
import Phaser from "phaser";

/** Texture resolution for Text: 2 on a normal monitor, 3 on high-DPI screens (laptops at 150%, 4K). Pure so it can be unit-tested without a DOM. */
export function textResolutionFor(devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(3, Math.max(2, Math.ceil(dpr * 1.5)));
}

let installed = false;

export function installSharpText(): void {
  if (installed) return;
  installed = true;
  const res = textResolutionFor(typeof window !== "undefined" ? window.devicePixelRatio : 1);
  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (this: Phaser.GameObjects.GameObjectFactory, ...args: unknown[]) => Phaser.GameObjects.Text;
  };
  const original = proto.text;
  proto.text = function (this: Phaser.GameObjects.GameObjectFactory, ...args: unknown[]) {
    const style = args[3] as { resolution?: number } | undefined;
    if (style && typeof style === "object" && style.resolution === undefined) {
      args[3] = { ...style, resolution: res };
    } else if (!style) {
      args[3] = { resolution: res };
    }
    return original.apply(this, args);
  };
}
