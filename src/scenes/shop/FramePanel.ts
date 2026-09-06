// src/scenes/shop/FramePanel.ts
// The Frame Systems Layer's equip screen + systems shop, Tier 1 (6 Sep 2026,
// data/frameSystems.ts / engine/frameSystems.ts / engine/campaignEconomy.ts).
// One pilot at a time, as a modal overlay — the doc's own §10 scope line
// names "the equip screen" as its own piece, and ShopPanel's 148px pilot
// card has no room left in it (that file's own comments track three prior
// overlap fixes in the same footprint), so this is a separate surface
// reached from a [ FRAME ] button on that card, on the Transporter Pad's
// own pilot row, and from nowhere else.
//
// Same standalone-overlay shape as ShopPanel.ts's showSaveAsOverlay: one
// scroll-factor-0 container at a caller-chosen depth, an interactive
// backdrop that swallows clicks meant for whatever's underneath, rebuilt
// wholesale on every state change rather than patched in place. The caller
// passes `onChange` so it can re-render its own view (the shop card's
// mount/points readouts) and, in the Hub's case, save.
//
// What the player sees, top to bottom:
//   header   — pilot, tier, personal points, Draw used/budget, mounts used/max
//   MOUNTS   — every owned weapon branch as a MOUNT / UNMOUNT toggle (buying a
//              branch stays on the shop card; this is the equip half only)
//   SYSTEMS  — the catalog by family: BUY / INSTALL / INSTALLED (click to
//              remove) / LOCKED (salvage, with kill progress), never listing
//              a salvage system this campaign can't ever unlock (see
//              frameSystemAvailability's `hidden`)
//   REFIT    — the two path refits at tier A, or the one already bought
//
// Sized to fit inside the Hub's 838px main-camera viewport (ROOM_BOUNDS is
// 130..830 there — see ShopPanel.fitWidth's own header for the 4 Sep 2026
// clipping bug that taught this file to size for the NARROWEST host, not
// the widest). Debrief/Hangar's full-width cameras just get more margin.
import Phaser from "phaser";
import type { CampaignState } from "../../engine/campaignState";
import { UNIT_ARCHETYPES } from "../../data/units";
import {
  equipWeaponBranch,
  unequipWeaponBranch,
  purchaseFrameSystem,
  equipFrameSystem,
  unequipFrameSystem,
  purchaseFrameRefit,
  frameSystemAvailability,
} from "../../engine/campaignEconomy";
import {
  equippedWeaponBranchesOf,
  mountsFor,
  drawCapacityFor,
  frameDrawUsed,
  equippedFrameSystemsWithinDraw,
  ownedFrameSystemsOf,
  frameRefitOf,
} from "../../engine/frameSystems";
import { WEAPON_BRANCHES, type WeaponBranchId } from "../../data/weaponBranches";
import {
  FRAME_SYSTEMS,
  FRAME_SYSTEM_IDS,
  FRAME_SYSTEM_FAMILY_ORDER,
  FRAME_SYSTEM_FAMILY_LABELS,
  FRAME_REFITS,
  FRAME_REFITS_BY_PATH,
  FRAME_REFIT_COST,
  FRAME_REFIT_TIER_GATE,
  frameSystemDrawFor,
  type FrameSystemId,
} from "../../data/frameSystems";
import { makeShopButton } from "./ShopPanel";

const PANEL_L = 130;
const PANEL_R = 830;
const PANEL_W = PANEL_R - PANEL_L;
const PANEL_CX = (PANEL_L + PANEL_R) / 2;
const PANEL_TOP = 14;
const PANEL_H = 612;
const ROW_H = 20;
const FAMILY_H = 18;

const C_BG = 0x141a20;
const C_BORDER = 0x3a4552;
const C_TEXT = "#e8e2d4";
const C_DIM = "#6b7a8a";
const C_MID = "#8a97a6";
const C_POINTS = "#facc15";
const C_GOOD = "#4ade80";
const C_WARN = "#ef4444";
const C_LOCK = "#b45309";

export interface FrameOverlayOptions {
  /** Depth for the overlay's container — one above whatever it opened on top of (Hub's shop sits at 61). */
  depth?: number;
  /** Fired after every state-changing click, once the overlay has re-rendered — re-render your own view, save if your scene saves eagerly. */
  onChange?: () => void;
  /** Fired when the overlay closes. */
  onClose?: () => void;
}

/**
 * Open the Frame panel for one pilot. Returns a handle whose `close()` the
 * caller can use (the Hub's Esc handling, say); the overlay also closes
 * itself from its own button. Re-opening for another pilot is just calling
 * this again — there is no persistent instance to manage.
 */
export function showFrameOverlay(scene: Phaser.Scene, state: CampaignState, pilotId: string, opts: FrameOverlayOptions = {}): { close: () => void } {
  const depth = opts.depth ?? 70;
  // Two containers, not one, for the same reason MenuOverlay.ts's
  // showMenuOverlay grew a per-camera loop on 3 Sep 2026: the Hub runs a
  // second, static camera for its OVERHEARD dock (Hub.ts's DOCK_SPLIT_X),
  // and a scrollFactor-0 object is drawn once PER camera, each offset by
  // that camera's own viewport origin. The first live check of this panel
  // (tools/verify/checkFramePanel.mjs's Hub screenshot) showed exactly
  // that: a second copy of the whole panel rendering into the dock strip.
  // So: the backdrop is one rectangle per camera, sized to that camera and
  // shown only through it (every other camera ignores it) — together they
  // tile the screen with no seam — and the content container is shown
  // through the FIRST camera only. Ignoring the container once covers
  // every child render() ever adds to it (Phaser's per-camera check stops
  // at the container). Single-camera scenes (Hangar/Debrief/TransporterPad)
  // run the loop exactly once and get the plain single backdrop.
  const cams = scene.cameras.cameras;
  const backdropLayer = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  for (let i = 0; i < cams.length; i++) {
    const cam = cams[i];
    const backdrop = scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0.7).setInteractive().setScrollFactor(0);
    backdropLayer.add(backdrop);
    for (let j = 0; j < cams.length; j++) if (j !== i) cams[j].ignore(backdrop);
  }
  const layer = scene.add.container(0, 0).setDepth(depth + 1).setScrollFactor(0);
  for (const cam of cams.slice(1)) cam.ignore(layer);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    layer.destroy();
    backdropLayer.destroy();
    opts.onClose?.();
  };

  // Feedback line — the last refusal/success from the engine, shown under
  // the header rather than lost. Cleared on the next successful action.
  let message = "";
  let messageColor = C_DIM;

  const render = () => {
    layer.removeAll(true);
    const entry = state.pilots[pilotId];
    if (!entry) {
      close();
      return;
    }
    const pilot = entry.pilot;
    const mek = state.meks[pilot.mekId];
    const path = UNIT_ARCHETYPES[pilot.archetypeId]?.path;

    // Panel chrome. (The click-swallowing backdrop lives in backdropLayer,
    // built once above — it exists so a click outside the panel doesn't
    // fall through to the shop card underneath, the exact class of bug the
    // 5 Sep Convert-All collision was.)
    const panel = scene.add.rectangle(PANEL_CX, PANEL_TOP + PANEL_H / 2, PANEL_W, PANEL_H, C_BG, 1).setStrokeStyle(1, C_BORDER).setScrollFactor(0);
    layer.add(panel);

    const text = (x: number, y: number, s: string, size: number, color: string, originX = 0) =>
      layer.add(scene.add.text(x, y, s, { fontFamily: "monospace", fontSize: `${size}px`, color }).setOrigin(originX, 0).setScrollFactor(0));

    // ---- header ----
    let y = PANEL_TOP + 10;
    text(PANEL_L + 16, y, `FRAME — ${pilot.displayName}`, 15, C_TEXT);
    text(PANEL_R - 16, y, `${entry.personalPoints} pts`, 15, C_POINTS, 1);
    y += 20;
    const draw = frameDrawUsed(pilot, mek);
    const drawCap = drawCapacityFor(pilot);
    const mounts = equippedWeaponBranchesOf(pilot);
    const mountCap = mountsFor(pilot);
    text(
      PANEL_L + 16,
      y,
      `${path ? path[0].toUpperCase() + path.slice(1) : "?"} · Tier ${pilot.tier} · Draw ${draw}/${drawCap} · Mounts ${mounts.length}/${mountCap}${mek ? ` · ${mek.primary}${mek.secondary ? "/" + mek.secondary : ""} loadout` : ""}`,
      10,
      C_MID
    );
    const closeBtn = scene.add
      .text(PANEL_R - 16, y, "[ close ]", { fontFamily: "monospace", fontSize: "11px", color: C_DIM })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    closeBtn.on("pointerdown", close);
    layer.add(closeBtn);
    y += 16;
    if (message) text(PANEL_L + 16, y, message, 9, messageColor);
    y += 16;

    const act = (fn: () => { ok: boolean; reason?: string }, okMessage?: string) => {
      const r = fn();
      if (r.ok) {
        message = okMessage ?? "";
        messageColor = C_GOOD;
      } else {
        message = r.reason ?? "That didn't work.";
        messageColor = C_WARN;
      }
      render();
      opts.onChange?.();
    };

    // ---- MOUNTS ----
    text(PANEL_L + 16, y, `MOUNTS — ${mountCap === 1 ? "one weapon branch at a time until tier C" : "two weapon branches carried at once, both live"}`, 10, C_TEXT);
    y += FAMILY_H;
    const ownedBranches = (pilot.ownedWeaponBranches ?? []).filter((id): id is WeaponBranchId => id in WEAPON_BRANCHES);
    if (ownedBranches.length === 0) {
      text(PANEL_L + 28, y + 3, "No weapon branches owned yet — buy one on the shop card. The default weapon is always mounted.", 9, C_DIM);
      y += ROW_H;
    } else {
      let bx = PANEL_L + 28;
      for (const id of ownedBranches) {
        const def = WEAPON_BRANCHES[id];
        const idx = mounts.indexOf(id);
        const label = idx >= 0 ? `M${idx + 1}: ${def.displayName}` : `MOUNT ${def.displayName}`;
        const w = 150;
        makeShopButton(scene, layer, bx + w / 2, y + ROW_H / 2, w, 18, label, true, () => {
          if (idx >= 0) act(() => unequipWeaponBranch(state, pilotId, id), `${def.displayName} unmounted.`);
          else act(() => equipWeaponBranch(state, pilotId, id), `${def.displayName} mounted.`);
        });
        bx += w + 6;
        if (bx + w > PANEL_R - 16) {
          bx = PANEL_L + 28;
          y += ROW_H;
        }
      }
      y += ROW_H;
    }
    y += 4;

    // ---- SYSTEMS ----
    text(PANEL_L + 16, y, `SYSTEMS — own as many as you like; only what fits the frame's Draw goes into a mission`, 10, C_TEXT);
    y += FAMILY_H;
    const owned = new Set(ownedFrameSystemsOf(pilot));
    const installed = new Set(equippedFrameSystemsWithinDraw(pilot, mek));
    for (const family of FRAME_SYSTEM_FAMILY_ORDER) {
      const ids = FRAME_SYSTEM_IDS.filter((id) => FRAME_SYSTEMS[id].family === family);
      const visible = ids.filter((id) => !frameSystemAvailability(state, pilotId, id).hidden);
      if (visible.length === 0) continue;
      text(PANEL_L + 20, y + 2, FRAME_SYSTEM_FAMILY_LABELS[family].toUpperCase(), 9, C_DIM);
      y += FAMILY_H - 3;
      for (const id of visible) {
        drawSystemRow(id, y);
        y += ROW_H;
      }
    }

    function drawSystemRow(id: FrameSystemId, rowY: number) {
      const def = FRAME_SYSTEMS[id];
      const avail = frameSystemAvailability(state, pilotId, id);
      const effectiveDraw = frameSystemDrawFor(def, mek);
      const isInstalled = installed.has(id);
      const bw = 118;
      const bx = PANEL_L + 28 + bw / 2;
      let label: string;
      let enabled: boolean;
      let onClick: () => void;
      if (isInstalled) {
        label = "INSTALLED";
        enabled = true;
        onClick = () => act(() => unequipFrameSystem(state, pilotId, id), `${def.displayName} removed from the frame.`);
      } else if (owned.has(id)) {
        const free = drawCap - draw;
        label = `INSTALL (${effectiveDraw} Draw)`;
        enabled = effectiveDraw <= free;
        onClick = () => act(() => equipFrameSystem(state, pilotId, id), `${def.displayName} installed.`);
      } else if (avail.salvageLocked) {
        const l = avail.salvageLocked;
        label = `LOCKED ${l.have}/${l.needed}`;
        enabled = false;
        onClick = () => {};
      } else {
        label = `BUY (${avail.cost})`;
        enabled = avail.affordable;
        onClick = () => act(() => purchaseFrameSystem(state, pilotId, id), `${def.displayName} bought — install it when there's Draw to spare.`);
      }
      makeShopButton(scene, layer, bx, rowY + ROW_H / 2, bw, 18, label, enabled, onClick);
      const nameColor = isInstalled ? C_GOOD : owned.has(id) ? C_TEXT : avail.salvageLocked ? C_LOCK : C_MID;
      const drawNote = def.salvage && effectiveDraw !== def.draw ? `[${def.draw}+1 Draw]` : `[${def.draw} Draw]`;
      text(PANEL_L + 28 + bw + 10, rowY + 3, `${def.displayName} ${drawNote}`, 10, nameColor);
      const descX = PANEL_L + 28 + bw + 10 + 205;
      const desc = avail.salvageLocked && !owned.has(id) ? `Cut from the ${avail.salvageLocked.archetypeName} — ${avail.salvageLocked.needed} kill${avail.salvageLocked.needed === 1 ? "" : "s"} needed. ${def.description}` : def.description;
      layer.add(
        scene.add
          .text(descX, rowY + 4, desc, { fontFamily: "monospace", fontSize: "8px", color: C_DIM, wordWrap: { width: PANEL_R - 16 - descX } })
          .setScrollFactor(0)
      );
    }

    // ---- REFIT ----
    y += 6;
    const refit = frameRefitOf(pilot);
    const refitTierMet = FRAME_REFIT_TIER_GATE.includes(pilot.tier);
    if (refit) {
      text(PANEL_L + 16, y, `REFIT — ${refit.displayName} (permanent)`, 10, C_GOOD);
      y += FAMILY_H;
      text(PANEL_L + 28, y, refit.description, 9, C_DIM);
    } else if (!refitTierMet) {
      text(PANEL_L + 16, y, `REFIT — the frame's identity fork opens at tier A (${pilot.tier} now)`, 10, C_DIM);
      y += FAMILY_H;
      if (path) {
        // One line per refit, word-wrapped to the panel — a single joined
        // line ran to x=862 past the 830 edge on the first live check
        // (tools/verify/checkFramePanel.mjs), the exact clipping class the
        // file header warns about.
        for (const id of FRAME_REFITS_BY_PATH[path] ?? []) {
          layer.add(
            scene.add
              .text(PANEL_L + 28, y, `${FRAME_REFITS[id].displayName}: ${FRAME_REFITS[id].description}`, {
                fontFamily: "monospace",
                fontSize: "8px",
                color: C_DIM,
                wordWrap: { width: PANEL_R - 16 - (PANEL_L + 28) },
              })
              .setScrollFactor(0)
          );
          y += 12;
        }
      }
    } else {
      text(PANEL_L + 16, y, `REFIT — one permanent pick, ${FRAME_REFIT_COST} pts. No swap, no refund.`, 10, C_TEXT);
      y += FAMILY_H;
      let bx = PANEL_L + 28;
      for (const id of path ? FRAME_REFITS_BY_PATH[path] ?? [] : []) {
        const def = FRAME_REFITS[id];
        const w = 150;
        makeShopButton(scene, layer, bx + w / 2, y + ROW_H / 2, w, 20, `REFIT: ${def.displayName}`, entry.personalPoints >= FRAME_REFIT_COST, () => {
          act(() => purchaseFrameRefit(state, pilotId, id), `${def.displayName} — refit complete. Permanent.`);
        });
        layer.add(
          scene.add
            .text(bx + w + 8, y + 2, def.description, { fontFamily: "monospace", fontSize: "8px", color: C_DIM, wordWrap: { width: 170 } })
            .setScrollFactor(0)
        );
        bx += w + 8 + 178;
      }
    }
  };

  render();
  return { close };
}
