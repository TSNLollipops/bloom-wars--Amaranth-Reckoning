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
import Phaser from "phaser";
import type { MekTrack, Path, Tier } from "../../data/types";
import { UNIT_ARCHETYPES } from "../../data/units";
import {
  purchaseTierUpgrade,
  purchaseMekSecondary,
  purchaseSpareParts,
  fabricatorMaxSpareParts,
  TIER_ORDER,
  TIER_UPGRADE_COST,
  MEK_SECONDARY_COST,
  SPARE_PART_COST,
} from "../../engine/campaignEconomy";
import { recruitDiscretionary, DISCRETIONARY_RECRUIT_COST, type CampaignState } from "../../engine/campaignState";

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
  | { type: "recruit" };

const ROW_H: Record<ShopEntry["type"], number> = {
  sectionHeader: 30,
  pilot: 96,
  mek: 54,
  info: 30,
  recruit: 136,
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
  bg.on("pointerover", () => bg.setFillStyle(0x3a6f92, 1));
  bg.on("pointerout", () => bg.setFillStyle(0x2e5c7a, 1));
  bg.on("pointerdown", onClick);
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
      return mek && fabricatorMaxSpareParts(mek) > 0;
    });
    if (fabricatorPilotIds.length === 0) {
      entries.push({ type: "info", label: "No mek currently carries a Fabricator track — nowhere to put spare parts yet." });
    } else {
      for (const pilotId of fabricatorPilotIds) entries.push({ type: "mek", pilotId });
    }

    entries.push({ type: "sectionHeader", label: "COMPANY — RECRUIT" });
    entries.push({ type: "recruit" });

    return entries;
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
      this.scene.add.text(SHOP_CARD_L + 14, top + 26, `${path ? capitalize(path) : "Unknown"} · Tier ${pilot.tier} · ${mek?.displayName ?? "no mek"}`, {
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
    const atMaxTier = idx === TIER_ORDER.length - 1;
    const tierCost = atMaxTier ? undefined : TIER_UPGRADE_COST[pilot.tier as Exclude<Tier, "A">];
    const tierLabel = atMaxTier ? "TIER MAXED" : `UPGRADE -> ${TIER_ORDER[idx + 1]} (${tierCost})`;
    const tierEnabled = !atMaxTier && tierCost !== undefined && entry.personalPoints >= tierCost;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_L + 84, top + 62, 148, 24, tierLabel, tierEnabled, () => {
      purchaseTierUpgrade(this.state, pilotId);
      this.render();
    });

    // Mek Secondary
    const secX = SHOP_CARD_L + 250;
    if (!mek) return;
    if (mek.secondary) {
      this.shopLayer.add(
        this.scene.add.text(secX, top + 58, `Secondary: ${capitalize(mek.secondary)}`, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
      );
      return;
    }
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

  private drawMekRow(pilotId: string, top: number, h: number): void {
    const entry = this.state.pilots[pilotId];
    if (!entry) return;
    const mek = this.state.meks[entry.pilot.mekId];
    if (!mek) return;
    const max = fabricatorMaxSpareParts(mek);
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
