// src/scenes/MenuOverlay.ts
// Main Menu / Save / Ironman UI Plan v1 §2, 28 Aug 2026 — the shared in-play
// "MENU" corner control. Four scenes (MapSelect, Hub, Hangar, Debrief) each
// need a way to reach Save/Options/Main-Menu without a mission or shop flow
// in the way; per this plan doc's own §8 "extract before duplicating" note
// (the same discipline ShopPanel.ts's own extraction history already set —
// see that file's header), this is one shared module instead of four
// near-identical copies of the same overlay.
//
// Visual pattern matches MainMenu.ts's own confirmation modal exactly
// (full-screen interactive backdrop + centered panel + makeShopButton rows),
// but built and torn down fresh each open/close rather than a persistent
// hidden layer — MainMenu owns one confirm modal for its own lifetime;
// this is opened from four different host scenes, so a create/destroy
// idiom (same one showSaveAsOverlay already uses in ShopPanel.ts) is the
// simpler fit here.
import Phaser from "phaser";
import { saveCampaignState, type CampaignState } from "../engine/campaignState";
import { makeShopButton, showSaveAsOverlay } from "./shop/ShopPanel";

/**
 * Adds a small "MENU" corner button to `scene` at (cx, cy), sized (w, h).
 * `getState` is called fresh on every press (not captured once at wiring
 * time) so the overlay always reflects whatever the host scene's own
 * CampaignState field holds at the moment the player actually opens it.
 */
export function addMenuOverlayButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  getState: () => CampaignState | null
): void {
  const layer = scene.add.container(0, 0);
  makeShopButton(scene, layer, cx, cy, w, h, "MENU", true, () => {
    showMenuOverlay(scene, getState);
  });
}

function showMenuOverlay(scene: Phaser.Scene, getState: () => CampaignState | null): void {
  const state = getState();
  const layer = scene.add.container(0, 0).setDepth(15);
  // Tier 6 hotfix, 30 Aug 2026 — main.ts's canvas grew (Hub.ts's chat
  // window). This backdrop is shared across 4 scenes (Hub, MapSelect,
  // Hangar, Debrief), so it reads the live camera size/center instead of a
  // hardcoded 960x640/480,320 — a hardcoded width here would either leave
  // the new strip of canvas undimmed on the right or, if just resized
  // without recentering, cover the wrong half of the screen entirely.
  const backdrop = scene.add
    .rectangle(scene.cameras.main.centerX, scene.cameras.main.centerY, scene.cameras.main.width, scene.cameras.main.height, 0x000000, 0.75)
    .setInteractive();
  const panel = scene.add.rectangle(480, 300, 380, 320, 0x141a20, 1).setStrokeStyle(1, 0x3a4552);
  const title = scene.add.text(480, 180, "MENU", { fontFamily: "monospace", fontSize: "20px", color: "#e8e2d4" }).setOrigin(0.5);
  layer.add([backdrop, panel, title]);

  let y = 230;
  const rowGap = 55;

  // SAVE... — only offered for a non-Ironman campaign, same gate Hangar.ts
  // and Debrief.ts's own SAVE AS buttons already use (an Ironman save has
  // no manual slots to write to at all — §6/§7's own rule).
  if (state && state.ironman === false) {
    makeShopButton(scene, layer, 480, y, 260, 36, "SAVE...", true, () => {
      layer.destroy();
      // showSaveAsOverlay draws its own full-screen backdrop+panel — no
      // double-backdrop risk, but this overlay's own layer is torn down
      // first so nothing stale is left listening underneath it.
      showSaveAsOverlay(scene, state);
    });
    y += rowGap;
  }

  makeShopButton(scene, layer, 480, y, 260, 36, "OPTIONS", true, () => {
    layer.destroy();
    scene.scene.start("Options", { returnScene: scene.scene.key });
  });
  y += rowGap;

  makeShopButton(scene, layer, 480, y, 260, 36, "RETURN TO MAIN MENU", true, () => {
    // Persist whatever the host scene's live state holds before leaving —
    // the same "save at the transition point" discipline Hangar.ts's own
    // BACK TO MISSION SELECT button already uses, not continuous
    // autosave-on-mutation.
    if (state) saveCampaignState(state);
    layer.destroy();
    scene.scene.start("MainMenu");
  });
  y += rowGap;

  makeShopButton(scene, layer, 480, y, 260, 36, "CLOSE", true, () => {
    layer.destroy();
  });
}
