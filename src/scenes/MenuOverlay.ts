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
 *
 * Returns the button's own container so a caller with more than one camera
 * (only Hub, since its OVERHEARD/chat UI-camera dock pass — see Hub.ts's
 * own DOCK_SPLIT_X header) can register it against whichever camera should
 * actually render it. The other three callers (MapSelect/Hangar/Debrief,
 * each a single static camera) can freely ignore the return value — nothing
 * about their own behavior changes.
 */
export function addMenuOverlayButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  getState: () => CampaignState | null
): Phaser.GameObjects.Container {
  // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — this button is shared
  // across MapSelect/Hub/Hangar/Debrief; Hub's own camera now scrolls, so
  // without this the corner button would drift off screen with everything
  // else once the player wandered into the new open floor. A no-op for the
  // other three scenes, whose cameras never move.
  const layer = scene.add.container(0, 0).setScrollFactor(0);
  makeShopButton(scene, layer, cx, cy, w, h, "MENU", true, () => {
    showMenuOverlay(scene, getState);
  });
  return layer;
}

function showMenuOverlay(scene: Phaser.Scene, getState: () => CampaignState | null): void {
  const state = getState();
  // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — same reasoning as
  // addMenuOverlayButton's own layer above: pinned so this full-screen menu
  // stays centered on the actual screen regardless of where Hub's camera
  // has scrolled to when MENU gets pressed.
  const layer = scene.add.container(0, 0).setDepth(15).setScrollFactor(0);
  // Tier 6 hotfix, 30 Aug 2026 — main.ts's canvas grew (Hub.ts's chat
  // window). This backdrop is shared across 4 scenes (Hub, MapSelect,
  // Hangar, Debrief), so it reads the live camera size/center instead of a
  // hardcoded 960x640/480,320 — a hardcoded width here would either leave
  // the new strip of canvas undimmed on the right or, if just resized
  // without recentering, cover the wrong half of the screen entirely.
  //
  // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — centerX/centerY swapped
  // for width/2, height/2. camera.centerX/Y is a WORLD-space midpoint (it
  // bakes in scrollX/scrollY), which happened to equal plain screen center
  // only because nothing in this codebase moved a camera before this pass.
  // Now that layer above is pinned via setScrollFactor(0), its children's
  // x/y ARE screen pixels directly — using centerX/Y here would silently
  // double-count Hub's own scroll offset (still harmless for MapSelect/
  // Hangar/Debrief, whose cameras never move, which is exactly why this
  // went unnoticed until a scrolling camera existed anywhere to expose it).
  // .setScrollFactor(0) on the backdrop ITSELF, not just on `layer` above:
  // Phaser renders container children with the container's scroll factor but
  // hit-tests them with each child's own, so an interactive child left at the
  // default factor of 1 inside a pinned container draws in one place and
  // takes clicks in another. See makeShopButton's own comment in
  // ShopPanel.ts for the full mechanism and how it was caught.
  //
  // Carrier Scale-Up Plan v1, Phase 2 (OVERHEARD/UI-camera dock), 3 Sep
  // 2026 — Hub now runs TWO cameras (its own narrowed main/world camera
  // plus a second, static UI camera for the dock strip — see Hub.ts's own
  // DOCK_SPLIT_X header for the full mechanism). A single scrollFactor(0)
  // rectangle can only ever visually cover ONE camera's own viewport: each
  // camera offsets a pinned object's x/y by its OWN viewport origin (its
  // `camera.matrix` bakes in `camera.x`/`camera.y`), so one rectangle sized
  // to `cameras.main`'s now-narrower width would leave the dock strip
  // undimmed and clickable straight through the open pause menu — the same
  // "wrong half of the screen" failure this hotfix's own comment above
  // already fixed once for a single camera, now needing the multi-camera
  // form. Fixed generically rather than special-cased to Hub: one backdrop
  // rectangle PER camera the scene actually has, each sized to exactly
  // that camera's own viewport and shown ONLY through it (every OTHER
  // camera in the scene is told to ignore it) — together they still tile
  // the whole screen with no gap or seam. For MapSelect/Hangar/Debrief
  // (one camera each) this loop runs exactly once and produces the exact
  // same single backdrop as before; nothing about their behavior changes.
  const cams = scene.cameras.cameras;
  const backdrops: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < cams.length; i++) {
    const cam = cams[i];
    const backdrop = scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0.75).setInteractive().setScrollFactor(0);
    layer.add(backdrop);
    backdrops.push(backdrop);
    for (let j = 0; j < cams.length; j++) {
      if (j !== i) cams[j].ignore(backdrop);
    }
  }
  // Forgotten Plans Audit, 1 Sep 2026 — grown from 320 to 380 tall (center
  // shifted 300->310) to fit the new CODEX row below without crowding
  // CLOSE against the panel's own bottom edge.
  const panel = scene.add.rectangle(480, 310, 380, 380, 0x141a20, 1).setStrokeStyle(1, 0x3a4552);
  const title = scene.add.text(480, 180, "MENU", { fontFamily: "monospace", fontSize: "20px", color: "#e8e2d4" }).setOrigin(0.5);
  layer.add([panel, title]);
  // panel/title, and every button makeShopButton adds to `layer` below, are
  // authored in cams[0]'s (scene.cameras.main's) coordinate space and only
  // ever meant to render through it — see the ignore sweep at the very end
  // of this function, after the last button exists to sweep up.

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

  // Forgotten Plans Audit, 1 Sep 2026 — the field-manual codex, reachable
  // from the pause menu (this was the audit's original ask — a link to
  // HOW_TO_PLAY.html — built out as an in-game codex instead per Maxime's
  // own call). Codex Rebuild & Live Briefing Plan v1, Part A, 4 Sep 2026 —
  // now also passes this overlay's own `state` through, so an in-play
  // Codex opens with real, live Personnel/Bestiary/World content gated on
  // wherever this actual save has gotten to. `state` is whatever the host
  // scene's own getState() returns — null for a House Amaranth save
  // (Hangar has no CampaignState shaped like this), which Codex.ts's own
  // hasWardenSave check already treats as "no save."
  makeShopButton(scene, layer, 480, y, 260, 36, "HOW TO PLAY", true, () => {
    layer.destroy();
    scene.scene.start("Codex", { returnScene: scene.scene.key, campaignState: state });
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

  // Same reasoning as the panel/title ignore-call above, swept once at the
  // end for every button makeShopButton just added (SAVE.../OPTIONS/CODEX/
  // RETURN/CLOSE — it doesn't hand back references to bg/txt, so this reads
  // them straight off `layer` itself rather than threading each one
  // through). Excludes the per-camera backdrops built at the top, which
  // must stay visible only through their OWN camera, not cams[0] alone.
  const backdropSet = new Set<Phaser.GameObjects.GameObject>(backdrops);
  const content = layer.list.filter((obj) => !backdropSet.has(obj));
  for (const cam of cams.slice(1)) cam.ignore(content);
}
