// src/scenes/shop/ShopPanel.ts
// Extracted 25 Aug 2026 (Maxime: "make me a little box for the ui I would
// see in the antfarm. so I can buy stuff and upgrade between mission" —
// followed up, when asked, with "I want to be able to see it from the
// mission menu" and "actually working in the game", not a mockup). Every
// line of the actual buy/upgrade/recruit UI below is unchanged in effect
// from what scenes/Debrief.ts already built and shipped (22-24 Aug 2026,
// the "CAMPAIGN SHOP" section of that screen) — this is that code moved
// out to a shared, scene-agnostic panel so scenes/Hangar.ts (the new
// standalone version, reachable straight from MapSelect, no mission
// required first) and Debrief.ts (still shown right after a mission,
// still carrying that mission's own earnings/Munti/bonus panels above
// this one) can both drive it against the same live CampaignState without
// two copies of the same shop drifting apart over time — the exact
// failure this project has hit before with un-merged registries/tables
// (see the pilotRegistry.ts and ALL_HOSTILE_MECHS precedents in the build
// log). Nothing about what the shop DOES changed in this pass: same
// costs, same three purchase kinds (gear tier, mek secondary, spare
// parts), same discretionary recruit flow, same page-by-pixel-budget
// pagination. Only where the code lives changed.
//
// Deliberately does NOT own "leaving" (saving + navigating away) — that
// differs slightly by caller (Debrief's footer button reads "RETURN TO
// BASE" and is the tail end of a mission; Hangar's reads "BACK TO
// MISSION SELECT" and has no mission behind it) and is cheap enough
// that duplicating ~10 lines of footer-drawing per scene is safer than
// forcing a shared abstraction onto a difference that's mostly copy.
//
// Mek NPC Introduction Plan v1 §1, 29 Aug 2026 — every player-facing "Mek"
// string this panel used to show for the machine's loadout/support-track
// system (fabricator/armorer/runemaster/fieldwright/quartermaster, spare
// parts, secondary specialization) is now "Loadout" instead — "Mek" is
// reserved for the person, full stop, everywhere the player can read it
// (see Hub.ts's new walkable Mek NPCs). Internal identifiers below
// (MekTrack, purchaseMekSecondary, MEK_SECONDARY_COST, the "mek"/"pilot"
// ShopEntry type tags) are untouched on purpose — the plan's own call,
// invisible to the player either way. mek.displayName itself (e.g.
// "Rourke's Mek") is correct as-is and needed no change — that already was
// the person's name.
import Phaser from "phaser";
import type { MekTrack, Path, Tier } from "../../data/types";
import { UNIT_ARCHETYPES } from "../../data/units";
import {
  purchaseTierUpgrade,
  purchaseMekSecondary,
  purchaseSpareParts,
  fabricatorMaxSpareParts,
  purchaseWeaponBranch,
  equipWeaponBranch,
  convertPersonalToCompany,
  CONVERSION_RATE,
  TIER_ORDER,
  TIER_UPGRADE_COST,
  MEK_SECONDARY_COST,
  SPARE_PART_COST,
  purchaseBeaconCrate,
  purchaseBeaconCharge,
  BEACON_CRATE_COST,
  BEACON_CRATE_COST_DISCOUNTED,
  BEACON_CHARGE_COST,
  BEACON_CHARGE_COST_DISCOUNTED,
} from "../../engine/campaignEconomy";
import {
  recruitDiscretionary,
  DISCRETIONARY_RECRUIT_COST,
  saveManualSlot,
  listManualSlots,
  MANUAL_SAVE_SLOT_COUNT,
  type CampaignState,
} from "../../engine/campaignState";
import { WEAPON_BRANCHES, WEAPON_BRANCHES_BY_PATH, WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE, type WeaponBranchId } from "../../data/weaponBranches";

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

const TRACK_LABELS: Record<MekTrack, string> = {
  fabricator: "Fabr",
  armorer: "Armor",
  runemaster: "Rune",
  fieldwright: "Field",
  quartermaster: "Qtrm",
};
const ALL_TRACKS: MekTrack[] = ["fabricator", "armorer", "runemaster", "fieldwright", "quartermaster"];
const ALL_CLASSES: Path[] = ["meeps", "tank", "reeps", "munti"];

// ---- Shop layout: a flat, height-budgeted list of rows (unchanged from
// Debrief.ts's original version — see that file's own history for why
// paged rather than scrolled) ----------------------------------------
type ShopEntry =
  | { type: "sectionHeader"; label: string }
  | { type: "pilot"; pilotId: string }
  | { type: "mek"; pilotId: string }
  | { type: "info"; label: string }
  | { type: "recruit" }
  | { type: "beaconStock" };

const ROW_H: Record<ShopEntry["type"], number> = {
  sectionHeader: 30,
  pilot: 148, // grown from 96 (25 Aug 2026) to fit the Weapon Branch button row added 27 Aug 2026
  mek: 54,
  info: 30,
  recruit: 136,
  // Beacon Control's crate/charge stockpile (built 4 Sep 2026) — one row,
  // two buy buttons side by side, same rough footprint as drawMekRow's own
  // 54 but a hair taller since it carries two stock counts instead of one.
  beaconStock: 60,
};

function computePages(entries: ShopEntry[], budget: number): ShopEntry[][] {
  const pages: ShopEntry[][] = [[]];
  let used = 0;
  for (const e of entries) {
    const h = ROW_H[e.type];
    if (used + h > budget && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(e);
    used += h;
  }
  return pages;
}

export const SHOP_CARD_W = 900;
export const SHOP_CARD_L = 480 - SHOP_CARD_W / 2;
export const SHOP_CARD_R = 480 + SHOP_CARD_W / 2;

/**
 * Shared button styling/behavior, exported standalone (not just a private
 * method) so a caller's own footer button — "RETURN TO BASE" / "BACK TO
 * MISSION SELECT", outside this panel's own render loop — looks and
 * behaves identically without duplicating the styling by hand.
 */
export function makeShopButton(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  enabled: boolean,
  onClick: () => void
): void {
  const bg = scene.add
    .rectangle(cx, cy, w, h, enabled ? 0x2e5c7a : 0x1a2028, 1)
    .setStrokeStyle(1, enabled ? 0x4a7a9a : 0x3a4552);
  const txt = scene.add
    .text(cx, cy, label, { fontFamily: "monospace", fontSize: "10px", color: enabled ? "#ffffff" : "#5a6472", align: "center", wordWrap: { width: w - 6 } })
    .setOrigin(0.5);
  layer.add([bg, txt]);
  if (!enabled) return;
  bg.setInteractive({ useHandCursor: true });
  // Carrier Scale-Up Plan v1 Phase 1 follow-on, 3 Sep 2026 — inherit the
  // host layer's scroll factor, which matters the moment any caller's
  // camera actually moves (Hub.ts's now does; MapSelect/Hangar/Debrief's
  // don't, where this is a no-op).
  //
  // Why it has to be set on the BUTTON and not just its parent container:
  // Phaser renders a container's children using the CONTAINER's scroll
  // factor (multiplied by the child's own — see ContainerWebGLRenderer),
  // but hit-tests each child using only the CHILD's own (InputManager.
  // hitTest's `px = worldX + csx * gameObject.scrollFactorX - csx`). A
  // button inside a scrollFactor(0) container that still has its own
  // default factor of 1 therefore DRAWS pinned to the screen and is
  // CLICKABLE somewhere else entirely — off by exactly the camera's scroll,
  // so it looks perfect in a screenshot and silently ignores every click.
  // Caught by a live Playwright check (tools/verify/
  // checkHubInteractionAfterScroll.mjs), not by tsc/lint/tests, all of
  // which passed clean while the MENU button was unclickable.
  bg.setScrollFactor(layer.scrollFactorX, layer.scrollFactorY);
  bg.on("pointerover", () => bg.setFillStyle(0x3a6f92, 1));
  bg.on("pointerout", () => bg.setFillStyle(0x2e5c7a, 1));
  bg.on("pointerdown", onClick);
}

/**
 * "Save As..." (Main Menu / Save / Ironman UI Plan v1 §6/§7/§8) — a small
 * slot-picker overlay, exported standalone rather than duplicated per caller
 * so Hangar.ts and Debrief.ts's own SAVE AS buttons share one implementation,
 * per the plan doc's own "extract before duplicating" note (§8) — the same
 * reasoning that made this whole file a shared class instead of copy-pasted
 * shop code in the first place. Auto-named/timestamped slots for this first
 * pass (§10's own "proposed auto-named for a first pass, nameable is a
 * cheap follow-on" — no numeric-entry UI convention exists anywhere in this
 * codebase yet to build a real "name this save" text field against).
 */
export function showSaveAsOverlay(scene: Phaser.Scene, state: CampaignState, onSaved?: (slot: number) => void): void {
  // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — this overlay is reached
  // from Hub.ts too (via MenuOverlay.ts's own SAVE... button), whose camera
  // now scrolls per deck. Pinned to the screen so it doesn't drift off
  // wherever the camera happened to be looking when SAVE... was pressed —
  // MapSelect/Hangar/Debrief's own static cameras make this a no-op for
  // them.
  const layer = scene.add.container(0, 0).setDepth(20).setScrollFactor(0);
  // .setScrollFactor(0) for the same render-vs-hit-test reason makeShopButton
  // above documents: this backdrop is interactive (it's what swallows clicks
  // meant for the game underneath), so it needs its own factor, not just its
  // parent layer's.
  const backdrop = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0.75).setInteractive().setScrollFactor(0);
  const panel = scene.add.rectangle(480, 320, 460, 300, 0x141a20, 1).setStrokeStyle(1, 0x3a4552);
  const title = scene.add.text(480, 210, "SAVE AS...", { fontFamily: "monospace", fontSize: "18px", color: "#e8e2d4" }).setOrigin(0.5);
  layer.add([backdrop, panel, title]);

  const slots = listManualSlots();
  let y = 254;
  for (let i = 0; i < MANUAL_SAVE_SLOT_COUNT; i++) {
    const meta = slots[i];
    const label = meta ? `SLOT ${i + 1} — overwrite (${new Date(meta.savedAt).toLocaleDateString()})` : `SLOT ${i + 1} — empty`;
    makeShopButton(scene, layer, 480, y, 380, 34, label, true, () => {
      saveManualSlot(i, state);
      layer.destroy();
      onSaved?.(i);
    });
    y += 44;
  }
  makeShopButton(scene, layer, 480, y + 10, 200, 32, "CANCEL", true, () => layer.destroy());
}

/**
 * The buy/upgrade/recruit panel itself. Owns its own page state and two
 * Phaser containers (shop rows + prev/next nav), both created against
 * whatever scene it's handed. Call render() once after construction and
 * again after anything else on screen might have changed the viewport
 * (callers don't need to — this panel's own top/bottom are fixed for its
 * lifetime; a caller that needs a resize just makes a new ShopPanel).
 */
export class ShopPanel {
  private shopPage = 0;
  private recruitClass: Path = "meeps";
  private recruitMessage = "";
  private recruitMessageColor = "#8a97a6";
  private shopLayer: Phaser.GameObjects.Container;
  private navLayer: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private state: CampaignState;
  private top: number;
  private bottom: number;
  // Fired at the end of every render() — including the ones triggered
  // internally by a purchase/recruit click, not just the first one — so
  // a caller whose own footer shows a live "Company Points" total (both
  // Debrief.ts and Hangar.ts do) can keep it in sync without this panel
  // needing to know anything about what a footer is.
  private onRender?: () => void;

  constructor(scene: Phaser.Scene, state: CampaignState, top: number, bottom: number, onRender?: () => void) {
    this.scene = scene;
    this.state = state;
    this.top = top;
    this.bottom = bottom;
    this.onRender = onRender;
    this.shopLayer = scene.add.container(0, 0);
    this.navLayer = scene.add.container(0, 0);
  }

  private buildEntries(): ShopEntry[] {
    const entries: ShopEntry[] = [];
    const activePilotIds = Object.entries(this.state.pilots)
      .filter(([, e]) => e.status === "active")
      .map(([id]) => id);

    entries.push({ type: "sectionHeader", label: "PILOTS — PERSONAL SHOP" });
    for (const pilotId of activePilotIds) entries.push({ type: "pilot", pilotId });

    entries.push({ type: "sectionHeader", label: "COMPANY — SPARE PARTS" });
    const fabricatorPilotIds = activePilotIds.filter((id) => {
      const mek = this.state.meks[this.state.pilots[id].pilot.mekId];
      return mek && fabricatorMaxSpareParts(mek, this.state.builtBays ?? []) > 0;
    });
    if (fabricatorPilotIds.length === 0) {
      entries.push({ type: "info", label: "No loadout currently carries a Fabricator track — nowhere to put spare parts yet." });
    } else {
      for (const pilotId of fabricatorPilotIds) entries.push({ type: "mek", pilotId });
    }

    // Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md, built
    // 4 Sep 2026) — always shown, same "buy ahead of the bay" reasoning
    // purchaseBeaconCrate/Charge's own comment gives: nothing stops a
    // player stockpiling before Beacon Control/Restock Room/Generator are
    // actually built, so this section isn't gated on builtBays either.
    entries.push({ type: "sectionHeader", label: "COMPANY — BEACON CONTROL STOCK" });
    entries.push({ type: "beaconStock" });

    entries.push({ type: "sectionHeader", label: "COMPANY — RECRUIT" });
    entries.push({ type: "recruit" });

    return entries;
  }

  // Tier 4, 30 Aug 2026 (Consolidated Build Plan — Hangar Deck roster/
  // stats panel, scenes/Hub.ts's own HANGAR_SHOP_POINT) — this panel's two
  // existing callers (Debrief.ts, Hangar.ts) each dedicate their WHOLE
  // scene to it, so neither has ever needed to hide it once built. Hub.ts
  // is different: it's a persistent scene where this needs to be an
  // occasional overlay, shown while the player's at the Hangar Deck
  // terminal and hidden otherwise, alongside everything else the Hub
  // already draws. Added as a small, additive method rather than a second
  // panel implementation — shopLayer/navLayer stay private; this is the
  // one new way to reach them from outside. A no-op for every existing
  // caller, since neither calls it.
  setVisible(visible: boolean): void {
    this.shopLayer.setVisible(visible);
    this.navLayer.setVisible(visible);
  }

  // Hangar Deck washed-out-panel hotfix (30 Aug 2026, Maxime's own
  // screenshot: text barely legible, whole panel looking faded). Same
  // reasoning as setVisible() just above — shopLayer/navLayer are created
  // with no explicit depth (default 0), which is invisible to Debrief.ts
  // and Hangar.ts (each dedicates its whole scene to this panel, so
  // nothing else is competing for depth), but Hub.ts is not: its own
  // hangarShopOverlay container (the title/border/close-button chrome
  // built in Hub.ts's buildHangarShopOverlay) sits at depth 60 with a
  // near-opaque (0.97 alpha) background rectangle. With shopLayer/navLayer
  // left at depth 0, that background painted on top of them almost
  // entirely — every actual roster row, stat, and button was rendering
  // BEHIND a near-opaque veil, showing through only as a faint ghost. This
  // is the actual mechanism behind the screenshot, and a separate bug from
  // the earlier click-passthrough fix (that one was about which handler
  // received a click; this one is about what actually painted on screen).
  // A no-op for every existing caller, since neither calls it — same
  // caveat as setVisible().
  setDepth(depth: number): void {
    this.shopLayer.setDepth(depth);
    this.navLayer.setDepth(depth);
  }

  // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — Hub.ts's own camera now
  // scrolls (see that file's startFollow/deckCameraBounds), and shopLayer/
  // navLayer are created with no explicit scroll factor (default 1, i.e.
  // world-space) — exactly correct for Debrief.ts/Hangar.ts, whose cameras
  // never move, but wrong for Hub's own hangarShopOverlay use, which needs
  // to stay pinned to the screen like every other overlay regardless of
  // where the camera is looking. Same additive-method shape as setVisible/
  // setDepth above: a no-op for Debrief.ts/Hangar.ts, since neither calls
  // it, and the one new way for Hub.ts to reach shopLayer/navLayer's own
  // scroll factor from outside.
  setScrollFactor(scrollFactor: number): void {
    // `true` = also update the children that exist right now. Everything
    // this panel builds from here on inherits the layer's factor at
    // creation instead (makeShopButton and the recruit-class buttons both
    // do), so this third argument only matters for anything already built
    // when a caller changes the factor — but leaving it out would make the
    // method quietly order-dependent, which is the kind of thing that
    // works until someone moves one line.
    this.shopLayer.setScrollFactor(scrollFactor, scrollFactor, true);
    this.navLayer.setScrollFactor(scrollFactor, scrollFactor, true);
  }

  // Hangar Deck sidebar-shop clipping bug, 4 Sep 2026 (caught from Maxime's
  // own phone photo of his live game, not by the UI sweep — see that
  // sweep's own build-log addendum for why: it checks against the 1074px
  // CANVAS, and this panel never left the canvas, it left the narrower
  // 838px MAIN-CAMERA VIEWPORT Hub.ts's dock split gives the room). This
  // panel's cards were built SHOP_CARD_W=900 wide (x=30..930), which is
  // exactly right for Debrief.ts and Hangar.ts, whose cameras really are
  // 1074 wide with nothing else sharing the screen. Hub.ts's own dock
  // (DOCK_SPLIT_X, that file's own header) narrowed its main camera to
  // 0..838 on 2-3 Sep, after this panel was already wired into Hub on 30
  // Aug — every OTHER Hub overlay was sized to ROOM_BOUNDS (830) from the
  // start and never noticed, this one was 100px too wide and nobody
  // caught it, because a screenshot taken WITHOUT opening this exact
  // overlay can't show it. The personal-points readout and the whole
  // Convert-to-company button sat past x=838 — drawn by the main camera,
  // which simply stops rendering there, with Hub's own chat dock sitting
  // in that same screen region on its own camera. Looked exactly like an
  // overlap because, in a sense, it was one: two cameras' content sharing
  // a boundary nobody told this panel about.
  //
  // Fix is a uniform shrink, not a reflow — SHOP_CARD_L/R/W stay exactly
  // as Debrief.ts/Hangar.ts already rely on; only Hub's two layers get
  // scaled down after construction. anchorX (480, this panel's own
  // horizontal center — every card background is centered there) and
  // anchorY (`top`, this panel's own top edge) are the one screen point
  // each axis holds still, so the shrink reads as "the same panel,
  // slightly smaller" rather than sliding toward a corner. Call once,
  // right after construction — the scale/position live on the container
  // itself, so they survive every future render() clearing and rebuilding
  // the children inside it.
  //
  // Trade-off, stated plainly rather than buried: pulling a 900-wide panel
  // in to fit a 700-wide room is a ~22% shrink (scale ends up 350/450 —
  // see the math below), not a cosmetic nudge. An 8px label renders at
  // roughly 6px. If that reads as too small on a real screen, the heavier
  // fix — give this panel a real narrow layout (its own SHOP_CARD_W,
  // chosen by the caller) instead of scaling a wide one down — is still
  // on the table; this method exists to make that an easy A/B to look at
  // rather than the only option committed to.
  fitWidth(maxRight: number): void {
    const anchorX = 480; // this panel's own horizontal center — see header
    // Scale is solved from the anchor, not a plain maxRight/SHOP_CARD_R
    // ratio: since setPosition below re-centers on anchorX, the fraction
    // that actually has to shrink is the HALF-WIDTH beyond the anchor
    // (SHOP_CARD_R - anchorX), not the full card width from screen zero.
    // Using the plain ratio here was this fix's own first-draft bug — it
    // under-shrank by exactly the anchor offset, and still clipped.
    const scale = Math.min(1, (maxRight - anchorX) / (SHOP_CARD_R - anchorX));
    if (scale >= 1) return;
    const anchorY = this.top;
    for (const layer of [this.shopLayer, this.navLayer]) {
      layer.setScale(scale);
      layer.setPosition(anchorX * (1 - scale), anchorY * (1 - scale));
    }
  }

  render(): void {
    const entries = this.buildEntries();
    const budget = this.bottom - this.top;
    const pages = computePages(entries, budget);
    this.shopPage = Math.min(this.shopPage, Math.max(0, pages.length - 1));

    this.shopLayer.removeAll(true);
    this.navLayer.removeAll(true);

    let y = this.top;
    for (const entry of pages[this.shopPage] ?? []) {
      y = this.drawEntry(entry, y);
    }

    if (pages.length > 1) {
      const navY = this.bottom + 8;
      const prevEnabled = this.shopPage > 0;
      const nextEnabled = this.shopPage < pages.length - 1;
      makeShopButton(this.scene, this.navLayer, 400, navY, 80, 24, "< PREV", prevEnabled, () => {
        this.shopPage -= 1;
        this.render();
      });
      this.navLayer.add(
        this.scene.add
          .text(480, navY, `page ${this.shopPage + 1}/${pages.length}`, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
          .setOrigin(0.5)
      );
      makeShopButton(this.scene, this.navLayer, 560, navY, 80, 24, "NEXT >", nextEnabled, () => {
        this.shopPage += 1;
        this.render();
      });
    }

    this.onRender?.();
  }

  private drawEntry(entry: ShopEntry, top: number): number {
    const h = ROW_H[entry.type];
    switch (entry.type) {
      case "sectionHeader":
        this.shopLayer.add(
          this.scene.add.text(480, top + 6, entry.label, { fontFamily: "monospace", fontSize: "12px", color: "#8a97a6" }).setOrigin(0.5, 0)
        );
        break;
      case "pilot":
        this.drawPilotRow(entry.pilotId, top, h);
        break;
      case "mek":
        this.drawMekRow(entry.pilotId, top, h);
        break;
      case "info":
        this.shopLayer.add(
          this.scene.add.text(SHOP_CARD_L + 16, top + 8, entry.label, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
        );
        break;
      case "recruit":
        this.drawRecruitRow(top, h);
        break;
      case "beaconStock":
        this.drawBeaconStockRow(top, h);
        break;
    }
    return top + h;
  }

  private drawPilotRow(pilotId: string, top: number, h: number): void {
    const entry = this.state.pilots[pilotId];
    if (!entry) return;
    const pilot = entry.pilot;
    const mek = this.state.meks[pilot.mekId];
    const path = UNIT_ARCHETYPES[pilot.archetypeId]?.path;
    const cardH = h - 6;
    const cy = top + cardH / 2;

    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552));
    this.shopLayer.add(this.scene.add.text(SHOP_CARD_L + 14, top + 8, pilot.displayName, { fontFamily: "monospace", fontSize: "13px", color: "#e8e2d4" }));
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 26, `${path ? capitalize(path) : "Unknown"} · Tier ${pilot.tier} · ${mek?.displayName ?? "no loadout"}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a97a6",
      })
    );
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_R - 14, top + 8, `${entry.personalPoints} pts`, { fontFamily: "monospace", fontSize: "13px", color: "#facc15" }).setOrigin(1, 0)
    );
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_R - 14, top + 24, "PERSONAL", { fontFamily: "monospace", fontSize: "8px", color: "#6b7a8a" }).setOrigin(1, 0)
    );

    // Upgrade Tier
    const idx = TIER_ORDER.indexOf(pilot.tier);
    // S-tier (2 Sep 2026, Heirlooms) is off the purchase ladder entirely,
    // so it isn't in TIER_ORDER and indexOf returns -1 for it. Checked
    // explicitly rather than left to the arithmetic: with idx === -1,
    // `atMaxTier` below would read false and `TIER_ORDER[idx + 1]` would
    // resolve to TIER_ORDER[0], so this panel would have cheerfully
    // offered an Heirloom pilot an "UPGRADE -> G" button. Same latent bug
    // purchaseTierUpgrade needed guarding against; see TIER_ORDER's own
    // comment.
    const isHeirloomTier = pilot.tier === "S";
    const atMaxTier = isHeirloomTier || idx === TIER_ORDER.length - 1;
    const tierCost = atMaxTier ? undefined : TIER_UPGRADE_COST[pilot.tier as Exclude<Tier, "A" | "S">];
    // S-tier clarity fix, 4 Sep 2026 (Maxime: "I thought I could use my
    // heirloom in my last nission... S grade is greyed out. I dont even
    // know."). A pilot capped at A with no Heirloom used to hit this same
    // "TIER MAXED" label a pilot at any other tier gets on affordability
    // grounds — reading identically to "you can't afford this yet," when
    // the real reason is the one campaignEconomy.ts's own
    // purchaseTierUpgrade refusal already states: S is granted by an
    // Heirloom, not purchasable at any price. Put on the button itself
    // rather than a separate caption — this card has no free pixels left
    // near it (drawPilotRow's own comments track two prior overlap fixes
    // in this exact footprint), so wordWrap breaking this across two lines
    // in place is the fix, not a new label element.
    const tierLabel = isHeirloomTier
      ? "HEIRLOOM (S)"
      : atMaxTier
        ? "MAXED - S COMES FROM AN HEIRLOOM"
        : `UPGRADE -> ${TIER_ORDER[idx + 1]} (${tierCost})`;
    const tierEnabled = !atMaxTier && tierCost !== undefined && entry.personalPoints >= tierCost;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_L + 84, top + 62, 148, 24, tierLabel, tierEnabled, () => {
      purchaseTierUpgrade(this.state, pilotId);
      this.render();
    });

    // Loadout secondary specialization (renamed from "Mek Secondary" 29 Aug
    // 2026 — Mek NPC Introduction Plan v1 §1: "Mek" is reserved for the
    // person from here on, this UI is the machine's loadout/support-track
    // system. Internal identifiers (MekTrack, purchaseMekSecondary,
    // MEK_SECONDARY_COST) are untouched per that plan — copy-only change.
    const secX = SHOP_CARD_L + 250;
    if (mek) {
      if (mek.secondary) {
        this.shopLayer.add(
          this.scene.add.text(secX, top + 58, `Secondary: ${capitalize(mek.secondary)}`, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
        );
      } else {
        this.shopLayer.add(
          this.scene.add.text(secX, top + 50, `Add secondary (${MEK_SECONDARY_COST}):`, { fontFamily: "monospace", fontSize: "9px", color: "#6b7a8a" })
        );
        let tx = secX;
        for (const track of ALL_TRACKS) {
          const disabled = track === mek.primary || entry.personalPoints < MEK_SECONDARY_COST;
          makeShopButton(this.scene, this.shopLayer, tx, top + 74, 66, 20, TRACK_LABELS[track], !disabled, () => {
            purchaseMekSecondary(this.state, pilotId, track);
            this.render();
          });
          tx += 72;
        }
      }
    }

    // Personal -> company conversion valve (same design doc, §5, decided
    // 27 Aug 2026 — a universal release valve, not tied to weapon branches
    // specifically, so it renders unconditionally here rather than behind
    // the `if (!path) return` guard just below). One button, converts
    // everything this pilot is currently holding at once — no partial-
    // amount picker, since neither the source doc nor this scene has a
    // numeric-entry UI convention yet, and "convert what you're not about
    // to spend" (idle points, or a hedge before a mission you're worried
    // about) is the actual use case the doc describes, not a precise
    // partial cash-out.
    const convertX = SHOP_CARD_R - 104;
    this.shopLayer.add(
      this.scene.add
        .text(convertX, top + 92, "Convert to company:", { fontFamily: "monospace", fontSize: "9px", color: "#6b7a8a" })
        .setOrigin(0.5, 0)
    );
    const convertGain = Math.floor(entry.personalPoints / CONVERSION_RATE);
    const convertLabel = entry.personalPoints > 0 ? `CONVERT ALL (${entry.personalPoints} -> ${convertGain})` : "NOTHING TO CONVERT";
    // top + 114 (was 112) and the label at top + 92 (was 96): the 22px
    // button used to overlap its own 9px label — same overlap the Weapon
    // Branch row below had, fixed together 1 Sep 2026.
    makeShopButton(this.scene, this.shopLayer, convertX, top + 114, 170, 22, convertLabel, entry.personalPoints > 0, () => {
      convertPersonalToCompany(this.state, pilotId, entry.personalPoints);
      this.render();
    });

    // Weapon Branch Point System (claude/Bloom_Wars_Weapon_Branch_Point_System_v1.md,
    // 27 Aug 2026) — one row of buttons per branch buildable on this
    // pilot's path (usually 1, Reeps gets 2). Unowned = a BUY button
    // priced/gated by purchase order; owned-but-not-equipped = an EQUIP
    // button (free, per the doc's own "collect-and-swap"); owned-and-
    // equipped shows as an active toggle that unequips back to default.
    if (!path) return;
    const buildable = WEAPON_BRANCHES_BY_PATH[path] ?? [];
    if (buildable.length === 0) return;
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 92, "Weapon Branch:", { fontFamily: "monospace", fontSize: "9px", color: "#6b7a8a" })
    );
    const owned = pilot.ownedWeaponBranches ?? [];
    // Layout fix, 1 Sep 2026 (caught in a Debrief screenshot during the
    // telemetry pass): makeShopButton takes a CENTER x, but this row was
    // passing the card's left edge — every branch button rendered half off
    // the card's left side, its label clipped, since the day it shipped.
    // `bx` is the button's left edge; `bx + BRANCH_BTN_W / 2` is its centre.
    const BRANCH_BTN_W = 210;
    let bx = SHOP_CARD_L + 14;
    for (const branchId of buildable) {
      const cx = bx + BRANCH_BTN_W / 2;
      const branch = WEAPON_BRANCHES[branchId];
      const isOwned = owned.includes(branchId as WeaponBranchId);
      const isEquipped = pilot.equippedWeaponBranch === branchId;
      if (!isOwned) {
        const purchaseIndex = owned.length;
        const cost = WEAPON_BRANCH_COSTS[purchaseIndex];
        const requiredTier = WEAPON_BRANCH_TIER_GATE[purchaseIndex];
        // S is above every gate but absent from TIER_ORDER, so indexOf
        // gives -1 and would fail every comparison — see
        // purchaseWeaponBranch, which this button must agree with exactly
        // or the UI disables a purchase the engine would allow.
        const pilotTierIdx = pilot.tier === "S" ? TIER_ORDER.length : TIER_ORDER.indexOf(pilot.tier);
        const tierMet = pilotTierIdx >= TIER_ORDER.indexOf(requiredTier);
        const affordable = cost !== undefined && entry.personalPoints >= cost;
        const label = cost === undefined ? `${branch.displayName} (maxed)` : `BUY ${branch.displayName} (${cost})`;
        makeShopButton(this.scene, this.shopLayer, cx, top + 114, BRANCH_BTN_W, 22, label, cost !== undefined && tierMet && affordable, () => {
          purchaseWeaponBranch(this.state, pilotId, branchId);
          this.render();
        });
        if (cost !== undefined && !tierMet) {
          this.shopLayer.add(
            this.scene.add
              .text(cx, top + 126, `needs tier ${requiredTier}+`, { fontFamily: "monospace", fontSize: "8px", color: "#6b7a8a" })
              .setOrigin(0.5, 0)
          );
        }
      } else {
        const label = isEquipped ? `${branch.displayName} [EQUIPPED]` : `EQUIP ${branch.displayName}`;
        makeShopButton(this.scene, this.shopLayer, cx, top + 114, BRANCH_BTN_W, 22, label, true, () => {
          equipWeaponBranch(this.state, pilotId, isEquipped ? null : branchId);
          this.render();
        });
      }
      bx += 216;
    }
  }

  private drawMekRow(pilotId: string, top: number, h: number): void {
    const entry = this.state.pilots[pilotId];
    if (!entry) return;
    const mek = this.state.meks[entry.pilot.mekId];
    if (!mek) return;
    const max = fabricatorMaxSpareParts(mek, this.state.builtBays ?? []);
    const cardH = h - 6;
    const cy = top + cardH / 2;

    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552));
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, cy, `${mek.displayName} (${entry.pilot.displayName}) — Spare Parts: ${mek.spareParts}/${max}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#e8e2d4",
      }).setOrigin(0, 0.5)
    );
    const atMax = mek.spareParts >= max;
    const enabled = !atMax && this.state.points >= SPARE_PART_COST;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_R - 90, cy, 160, 26, atMax ? "AT MAX" : `BUY PART (${SPARE_PART_COST})`, enabled, () => {
      purchaseSpareParts(this.state, mek.id);
      this.render();
    });
  }

  /**
   * Beacon Control's crate/charge stockpile (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md,
   * built 4 Sep 2026) — one company-wide row, not per-pilot/per-mek like
   * drawMekRow above: this is squad logistics, not any one loadout's own
   * cap. Two buy buttons side by side, same "BUY PART" shape as drawMekRow's
   * own button, showing the live discounted price once the Fabricator bay
   * is built (purchaseBeaconCrate/Charge apply that discount themselves —
   * this only needs to LABEL it correctly, same "ask the engine, never
   * guess" discipline the highlight-source methods in engine/mission.ts
   * already follow for targeting).
   */
  private drawBeaconStockRow(top: number, h: number): void {
    const cardH = h - 6;
    const cy = top + cardH / 2;
    const fabricatorBuilt = (this.state.builtBays ?? []).includes("fabricator");
    const crateCost = fabricatorBuilt ? BEACON_CRATE_COST_DISCOUNTED : BEACON_CRATE_COST;
    const chargeCost = fabricatorBuilt ? BEACON_CHARGE_COST_DISCOUNTED : BEACON_CHARGE_COST;
    const crates = this.state.beaconCrates ?? 0;
    const charges = this.state.beaconCharges ?? 0;

    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552));
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 8, `Fabricator crates: ${crates}  ·  Restock Room charges: ${charges}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#e8e2d4",
      })
    );
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 26, "Spent mid-mission by Beacon Control to revive a downed ally — see the CO about the bay.", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#6b7a8a",
      })
    );

    const crateEnabled = this.state.points >= crateCost;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_L + 190, top + 44, 170, 22, `BUY CRATE (${crateCost})`, crateEnabled, () => {
      purchaseBeaconCrate(this.state);
      this.render();
    });
    const chargeEnabled = this.state.points >= chargeCost;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_R - 190, top + 44, 170, 22, `BUY CHARGE (${chargeCost})`, chargeEnabled, () => {
      purchaseBeaconCharge(this.state);
      this.render();
    });
  }

  private drawRecruitRow(top: number, h: number): void {
    const cardH = h - 6;
    const cy = top + cardH / 2;
    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552));
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 8, "RECRUIT A NEW PILOT", { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4" })
    );
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 26, `Company pool: ${this.state.points} pts · cost: ${DISCRETIONARY_RECRUIT_COST} pts`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a97a6",
      })
    );

    let cx = SHOP_CARD_L + 14;
    for (const cls of ALL_CLASSES) {
      const selected = this.recruitClass === cls;
      const bg = this.scene.add
        .rectangle(cx + 60, top + 62, 118, 26, selected ? 0x2e5c7a : 0x1a2028, 1)
        .setStrokeStyle(1, selected ? 0x4a7a9a : 0x3a4552)
        .setInteractive({ useHandCursor: true })
        // Same inherit-the-layer's-scroll-factor rule as makeShopButton
        // above (see its comment for the full Phaser render-vs-hit-test
        // mismatch). This one is rebuilt on every render(), so it inherits
        // from shopLayer at creation rather than relying on any one-time
        // pass over the container.
        .setScrollFactor(this.shopLayer.scrollFactorX, this.shopLayer.scrollFactorY)
        .on("pointerdown", () => {
          this.recruitClass = cls;
          this.recruitMessage = "";
          this.render();
        });
      this.shopLayer.add(bg);
      this.shopLayer.add(
        this.scene.add
          .text(cx + 60, top + 62, capitalize(cls), { fontFamily: "monospace", fontSize: "11px", color: selected ? "#ffffff" : "#8a97a6" })
          .setOrigin(0.5)
      );
      cx += 126;
    }

    const canAfford = this.state.points >= DISCRETIONARY_RECRUIT_COST;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_L + 84, top + 100, 148, 28, `RECRUIT (${DISCRETIONARY_RECRUIT_COST})`, canAfford, () => {
      const result = recruitDiscretionary(this.state, this.recruitClass);
      if (result.ok && result.pilot) {
        this.recruitMessage = `Recruited ${result.pilot.displayName}.`;
        this.recruitMessageColor = "#4ade80";
      } else {
        this.recruitMessage = result.reason ?? "recruit failed";
        this.recruitMessageColor = "#ef4444";
      }
      this.render();
    });
    if (this.recruitMessage) {
      this.shopLayer.add(
        this.scene.add.text(SHOP_CARD_L + 250, top + 106, this.recruitMessage, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: this.recruitMessageColor,
          wordWrap: { width: 500 },
        })
      );
    }
  }
}
