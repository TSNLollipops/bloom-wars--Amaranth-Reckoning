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
import type { MekTrack, Path } from "../../data/types";
import { UNIT_ARCHETYPES } from "../../data/units";
import { showCharacterCreatorOverlay } from "./CharacterCreatorOverlay";
import {
  purchaseTierUpgrade,
  purchaseMekSecondary,
  purchaseSpareParts,
  fabricatorMaxSpareParts,
  purchaseWeaponBranch,
  equipWeaponBranch,
  unequipWeaponBranch,
  convertPersonalToCompany,
  CONVERSION_RATE,
  TIER_ORDER,
  tierUpgradeCostFor,
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
  recruitIntoLance,
  recruitCandidates,
  lanceRoster,
  lanceDisplayName,
  activeLanceIds,
  MAX_LANCE_SIZE,
  type LanceId,
  DISCRETIONARY_RECRUIT_COST,
  dischargePilot,
  saveManualSlot,
  listManualSlots,
  MANUAL_SAVE_SLOT_COUNT,
  type CampaignState,
} from "../../engine/campaignState";
import { WEAPON_BRANCHES, WEAPON_BRANCHES_BY_PATH, WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE, type WeaponBranchId } from "../../data/weaponBranches";
// Tier-upgrade tooltip, 11 Sep 2026 (Maxime: "rank upgrade will need a
// tooltip about what it mean") — TIERS is the actual stat table
// engine/units.ts applies (base -> tier -> mek -> branch), so the delta
// shown is the real number this purchase grants, not a guess.
import { TIERS } from "../../data/combatTables";
import { equippedWeaponBranchesOf, mountsFor, drawCapacityFor, frameDrawUsed } from "../../engine/frameSystems";
import { showFrameOverlay } from "./FramePanel";
import { playSfx } from "../audio/AudioManager";
// Item-purchase tooltip pass, 11 Sep 2026 (playtest note: "no way to know
// what an item does before buying it" — Bloom_Wars_Playtest_Log.md's
// General/UX section). Reuses the exact same HoverTip box Hub.ts and
// Battle.ts already draw for NPC/unit hover — see scenes/ui/HoverTip.ts's
// own header for why this is a shared class rather than a third
// hand-rolled floating panel. wrapTipText is the same word-wrap
// hoverTipLayout.ts's own measureTipBox expects its input pre-wrapped
// with, so a long weapon-branch description doesn't run off toward
// whichever screen edge the button happens to sit near.
import { HoverTip } from "../ui/HoverTip";
import { wrapTipText } from "../../engine/hoverTipLayout";
// UI Prettiness Pass v1, 10 Sep 2026 — Roster & Gear is the fourth screen
// this pass touches, and the one with the narrowest scope, on purpose: this
// file's own comment history (ROW_H's pilot-row comment, the Weapon Branch
// row's two documented overlap fixes, the 9 Sep candidate-list collision)
// is a record of small, well-intentioned layout changes here breaking a
// neighbor. So this pass is additive-only — a left accent bar per card and
// the shared palette on top of the existing pixel-exact layout — nothing
// that moves a button, a row height, or anything computed from a text
// object's own .width. See the plan doc (Bloom_Wars_UI_Prettiness_Pass_
// Plan_v1) for why Workshop/Vault/Mission Select got a fuller pass and this
// one deliberately didn't.
import { PANEL_BG, PANEL_CARD_BORDER, PANEL_ACCENT, TEXT_MAIN, TEXT_DIM, TEXT_ACCENT } from "../ui/Panel";

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
// Secondary-track tooltips, 11 Sep 2026 (Maxime: "we need those tooltips
// too. the fabricator and stuff") — these five buttons only ever add a
// SECONDARY specialization (the primary is fixed at character creation;
// see this section's own `if (!mek.secondary)` guard above it), so every
// number below is that track's `secondary` row in data/meks.ts's
// MEK_TRACK_EFFECTS, not its (stronger) primary row. Transcribed straight
// off that table, nothing derived or guessed — same discipline as the
// weapon-branch tooltips just above.
const SECONDARY_TRACK_TOOLTIPS: Record<MekTrack, string> = {
  fabricator: "+1 spare part. Beacon Control burns a spare part instead of a Restock Room crate when reviving this pilot.",
  armorer: "+4 attack, +4 defense, +5 max HP for this pilot's mek.",
  runemaster: "+1 vision. Any on-hit effect this pilot's mek inflicts through a weapon branch (acid, knockback, stun) lasts or reaches ×1.25 further.",
  fieldwright: "+8 HP/turn self-repair whenever this pilot's mek stands still instead of moving.",
  quartermaster: "25% off every shop purchase this pilot makes. Secondary only — there's no primary version of this track.",
};
const ALL_TRACKS: MekTrack[] = ["fabricator", "armorer", "runemaster", "fieldwright", "quartermaster"];
const ALL_CLASSES: Path[] = ["meeps", "tank", "reeps", "munti"];
// Recruit class-picker tooltips, 11 Sep 2026 — Tooltip Coverage Standing
// Rule checklist's "Recruit section (class picker...)" row. Verified
// straight off each archetype's own attackRange/abilities in data/units.ts
// (all three chassis per class share the same range and path abilities),
// not written from flavor memory: meeps/tank are both range [1,1] melee,
// reeps is [2,4] ranged, munti is [1,2] with the repair/evac/screen kit.
const CLASS_ROLE_TOOLTIPS: Record<Path, string> = {
  meeps: "Melee striker, range 1. Ambush lets them go unseen and hold their shot until an enemy walks into range.",
  tank: "Melee frontline, range 1. Interdict pins anything that walks into their zone; Overshield adds a damage buffer.",
  reeps: "Ranged attacker, range 2-4 tiles. Stay out of melee range to use this class well.",
  munti: "Support and combat medic, range 1-2. Repairs allies, evacuates a downed cockpit, and screens the squad from detection. Every lance needs one to deploy.",
};

// ---- Shop layout: a flat, height-budgeted list of rows (unchanged from
// Debrief.ts's original version — see that file's own history for why
// paged rather than scrolled) ----------------------------------------
type ShopEntry =
  | { type: "sectionHeader"; label: string }
  | { type: "pilot"; pilotId: string }
  | { type: "mek"; pilotId: string }
  | { type: "info"; label: string; color?: string }
  | { type: "recruit" }
  | { type: "beaconStock" };

const ROW_H: Record<ShopEntry["type"], number> = {
  sectionHeader: 30,
  // grown from 96 (25 Aug 2026) to fit the Weapon Branch button row added
  // 27 Aug 2026; grown again 9 Sep 2026 (Maxime's own screenshot: a pilot
  // card's "needs tier X+" line and the next pilot's own header reading as
  // overlapping) for headroom — same recurring footprint two earlier
  // comments in drawPilotRow already flag as having been patched before.
  // Not pinned to one exact overflowing line (the screenshot was too
  // blurry to read pixel-for-pixel); this is a safety margin, not a
  // measured fix — flag it again if a card still crowds its neighbour
  // after this.
  pilot: 164,
  mek: 54,
  info: 30,
  // grown 5 Sep 2026 for the lance selector + candidate list, grown again
  // 9 Sep 2026 (Maxime's own screenshot: the sign-on message printing on
  // top of the candidate list) to give messageY — see drawRecruitRow —
  // room below a full 4-candidate list plus a wrapped two-line message.
  recruit: 240,
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
  onClick: () => void,
  // Item-purchase tooltip pass, 11 Sep 2026 — both optional and both trail
  // every existing positional argument, so every call site across the game
  // that doesn't pass them (Options, MainMenu, every other Hub overlay)
  // keeps compiling and behaving exactly as before. `hoverTip` is the
  // caller's own HoverTip instance (this function has no scene-lifetime
  // state of its own to own one) — pass both or neither; `tooltip` alone
  // with no `hoverTip` is silently a no-op rather than a crash.
  tooltip?: string[],
  hoverTip?: HoverTip
): void {
  const bg = scene.add
    .rectangle(cx, cy, w, h, enabled ? 0x2e5c7a : 0x1a2028, 1)
    .setStrokeStyle(1, enabled ? 0x4a7a9a : 0x3a4552);
  const txt = scene.add
    .text(cx, cy, label, { fontFamily: "monospace", fontSize: "10px", color: enabled ? "#ffffff" : "#5a6472", align: "center", wordWrap: { width: w - 6 } })
    .setOrigin(0.5);
  layer.add([bg, txt]);
  // Wired before the `if (!enabled) return` below on purpose: "why is this
  // greyed out" (can't afford it yet, needs a higher tier) is exactly the
  // moment a tooltip earns its keep, so a disabled button still shows one
  // if it's given tooltip lines — it just never gets a click handler.
  if (tooltip && tooltip.length && hoverTip) {
    bg.setInteractive();
    bg.setScrollFactor(layer.scrollFactorX, layer.scrollFactorY);
    bg.on("pointerover", (pointer: Phaser.Input.Pointer) => hoverTip.show(tooltip, pointer.x, pointer.y));
    bg.on("pointermove", (pointer: Phaser.Input.Pointer) => hoverTip.show(tooltip, pointer.x, pointer.y));
    bg.on("pointerout", () => hoverTip.hide());
  }
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
  // Audio, "enough for EA" scope (A6, 9 Sep 2026) — the UI-click sting.
  // Wired here rather than at each of this function's many call sites
  // across the whole game (Options, every shop screen, every Hub overlay,
  // Debrief, MainMenu...) since makeShopButton is already the one shared
  // button primitive all of them go through — one line here covers all of
  // them for free. Battle.ts's own hand-rolled board buttons (END TURN,
  // the action bar) don't run through this function and are wired
  // separately, at their own call sites.
  bg.on("pointerdown", () => {
    playSfx(scene, "click");
    onClick();
  });
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
 * Discharge confirmation modal (11 Sep 2026 — Maxime: "the dismiss synker
 * button in red on the rooster ui is still hidden halfway into the upgrade
 * button. better make sure those are not close to ceach other so player
 * dont dimiss accidentlay. also it need a confirm popop when u dismiss a
 * unit"). Replaces the old in-place "[ discharge ]" -> "[ CONFIRM
 * DISCHARGE ]" / "[ cancel ]" text-swap (5 Sep 2026) with a real modal,
 * same showSaveAsOverlay pattern just above (dimmed backdrop, centered
 * panel, two makeShopButton calls) rather than inventing a second overlay
 * style.
 *
 * The old flow's actual bug wasn't that it lacked a confirm step — it
 * always had one, arm-then-reclick — it's that "confirm" was just a
 * longer, redder piece of TEXT sitting at the exact same coordinates
 * (SHOP_CARD_L+14, top+44) every render, one row above a real BUTTON
 * (the tier-upgrade makeShopButton, centered at top+62, spanning roughly
 * y:[50,74] — see drawPilotRow) that a 9px line of text has no business
 * being that close to. A modal fixes this at the root: the discharge
 * link drawn on the card itself is now always the same short, constant-
 * width "[ discharge ]" string (nothing ever grows into "[ CONFIRM
 * DISCHARGE ]" in place), and the actual confirmation happens on a
 * dimmed full-screen layer where nothing behind it is clickable at all.
 * drawPilotRow's own tier-button position also moves down slightly in
 * this same pass, for real measured clearance from that now-constant
 * link rather than relying on the modal alone to paper over cramped
 * geometry — see that call site's own comment.
 */
export function showDischargeConfirmOverlay(
  scene: Phaser.Scene,
  state: CampaignState,
  pilotId: string,
  depth: number,
  onResolved: (message: string, color: string) => void
): { close: () => void } {
  const pilot = state.pilots[pilotId]?.pilot;
  const pilotName = pilot?.displayName ?? "This pilot";
  const layer = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  const backdrop = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0.75).setInteractive().setScrollFactor(0);
  const panel = scene.add.rectangle(480, 320, 460, 220, 0x141a20, 1).setStrokeStyle(1, 0x3a4552);
  const title = scene.add
    .text(480, 236, `DISCHARGE ${pilotName.toUpperCase()}?`, {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#ef4444",
      align: "center",
      wordWrap: { width: 420 },
    })
    .setOrigin(0.5);
  // 52-char wrap at this dialog's 11px body font: same 6.6px/char advance
  // scenes/ui/HoverTip.ts's own CHAR_W constant uses at 11px, so 52 chars
  // lands around 343px — comfortably inside the 460px panel with margin
  // on both sides, not a guessed number.
  const bodyLines = wrapTipText(
    `Permanently removes ${pilotName} from the active roster. Their mek, loadout, and gear go with them. This can't be undone.`,
    52
  );
  const body = scene.add
    .text(480, 288, bodyLines.join("\n"), {
      fontFamily: "monospace",
      fontSize: "11px",
      color: TEXT_DIM,
      align: "center",
      lineSpacing: 2,
    })
    .setOrigin(0.5);
  layer.add([backdrop, panel, title, body]);

  const close = () => layer.destroy();
  makeShopButton(scene, layer, 400, 368, 190, 32, "DISCHARGE", true, () => {
    const result = dischargePilot(state, pilotId);
    close();
    if (result.ok) {
      onResolved(
        result.muntiReplacement
          ? `${pilotName} discharged. They were the roster's last Munti — ${result.muntiReplacement.displayName} was brought in to cover the gap.`
          : `${pilotName} discharged from the active roster.`,
        "#4ade80"
      );
    } else {
      onResolved(result.reason ?? "Discharge failed.", "#ef4444");
    }
  });
  makeShopButton(scene, layer, 570, 368, 150, 32, "CANCEL", true, close);

  return { close };
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
  // Set after a hire so render() can keep the recruit card under the
  // player's cursor (5 Sep 2026, found by the recruit verification): every
  // hire adds a 148px pilot row to this same list, which repaginates and
  // shoves the recruit card onto a later page. Without this, signing your
  // five-pilot lance means hunting for the card again after almost every
  // click.
  private keepRecruitVisible = false;
  /** Exposed for the headless verify scripts, which page to the recruit card without clicking through. */
  goToPage(n: number): void {
    this.shopPage = n;
    this.render();
  }
  private recruitClass: Path = "meeps";
  /** Which lance a hire goes into (5 Sep 2026). Defaults to the first lance with room. */
  private recruitLance: LanceId | null = null;
  private recruitMessage = "";
  private recruitMessageColor = "#8a97a6";
  // Pilot Discharge (5 Sep 2026; reworked 11 Sep 2026 into a real modal —
  // see showDischargeConfirmOverlay's own header for why). dischargeOverlay
  // is this panel's own copy of the frameOverlay pattern a few fields
  // down: a standalone top-level container, not a child of shopLayer, so
  // it survives render()'s removeAll(true) while it's open and gets torn
  // down the same way setVisible(false) already tears down frameOverlay.
  // dischargeMessage/dischargeMessageColor are unchanged from 5 Sep — the
  // post-discharge feedback line buildEntries() surfaces as an "info" row
  // once the discharged pilot's own row is gone.
  private dischargeOverlay: { close: () => void } | null = null;
  private dischargeMessage = "";
  private dischargeMessageColor = "#8a97a6";
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
  // "[ move lance ]" jump, 11 Sep 2026 — optional, since only the Hub's
  // Roster & Gear console (this file's own crew, lances are a Hub-only
  // concept) wires it; Debrief.ts's own use of this panel leaves it
  // undefined and the link just doesn't render. See drawPilotRow's own
  // comment on why this jumps to RosterPanel instead of building a second
  // lance-picker inside this already-dense card.
  private onMoveLance?: (pilotId: string) => void;
  // Item-purchase tooltip pass, 11 Sep 2026 — one HoverTip per panel
  // instance, same lifetime discipline Hub.ts/Battle.ts already use for
  // their own (created once, shown/hidden repeatedly by render() calls
  // that rebuild everything else in shopLayer). Its container sits at
  // HoverTip's own fixed depth of 10,000, so it draws above this panel
  // regardless of what depth the host scene gave shopLayer/navLayer.
  private hoverTip: HoverTip;

  constructor(scene: Phaser.Scene, state: CampaignState, top: number, bottom: number, onRender?: () => void, onMoveLance?: (pilotId: string) => void) {
    this.scene = scene;
    this.state = state;
    this.top = top;
    this.bottom = bottom;
    this.onRender = onRender;
    this.onMoveLance = onMoveLance;
    this.shopLayer = scene.add.container(0, 0);
    this.navLayer = scene.add.container(0, 0);
    this.hoverTip = new HoverTip(scene);
  }

  private buildEntries(): ShopEntry[] {
    const entries: ShopEntry[] = [];
    const activePilotIds = Object.entries(this.state.pilots)
      .filter(([, e]) => e.status === "active")
      .map(([id]) => id);

    entries.push({ type: "sectionHeader", label: "PILOTS — PERSONAL SHOP" });
    // Discharge feedback (5 Sep 2026) — the discharged pilot's own row is
    // gone by the time this message would matter (buildEntries only ever
    // lists status === "active" pilots, and a discharge just flipped one
    // out of that set), so it can't live on that row the way recruitMessage
    // lives inside drawRecruitRow. Surfaced here instead, same "info" entry
    // type the Spare Parts section below already uses for its own "nothing
    // to show here" note — no new row-height constant needed.
    if (this.dischargeMessage) entries.push({ type: "info", label: this.dischargeMessage, color: this.dischargeMessageColor });
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
    // Frame Systems Layer (6 Sep 2026) — the Frame overlay this panel can
    // open is its own top-level container, so hiding this panel (Hub's
    // close-on-Esc path) would otherwise leave it floating on top of the
    // ship. Closed here with the panel; Debrief/Hangar never call this and
    // tear the whole scene down instead.
    if (!visible) this.frameOverlay?.close();
    // Same reasoning again, 11 Sep 2026, for the discharge confirm modal —
    // its own top-level container, not a child of shopLayer.
    if (!visible) this.dischargeOverlay?.close();
    // Same reasoning, 11 Sep 2026, for the tooltip box: it's a fixed-depth,
    // screen-pinned container of its own, not a child of shopLayer, so
    // hiding the panel without this would leave a stale tooltip floating
    // over whatever Hub shows next if the pointer happened to be sitting on
    // a button the instant Esc closed this panel.
    if (!visible) this.hoverTip.hide();
  }
  private frameOverlay: { close: () => void } | null = null;

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
    this.depth = depth;
    this.shopLayer.setDepth(depth);
    this.navLayer.setDepth(depth);
  }
  // Frame Systems Layer (6 Sep 2026) — remembered so the [ FRAME ] overlay
  // this panel opens can sit above whatever this panel itself sits on
  // (Hub's 61; Debrief/Hangar's default 0). See showFrameOverlay.
  private depth = 0;

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
    if (this.keepRecruitVisible) {
      const idx = pages.findIndex((pg) => pg.some((e) => e.type === "recruit"));
      if (idx >= 0) this.shopPage = idx;
      this.keepRecruitVisible = false;
    }

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
      // Page-nav tooltips, 11 Sep 2026 — Tooltip Coverage Standing Rule
      // checklist's last open row in this file. Arguably borderline against
      // the rule's own "self-explanatory from a live number" exemption
      // (the "page X/Y" readout between them already says where you are),
      // but cheap, harmless, and consistent with "every clickable gets
      // one" rather than a judgment call worth relitigating per button.
      makeShopButton(this.scene, this.navLayer, 400, navY, 80, 24, "< PREV", prevEnabled, () => {
        this.shopPage -= 1;
        this.render();
      }, ["< PREV", "", "Show the previous page of this list."], this.hoverTip);
      this.navLayer.add(
        this.scene.add
          .text(480, navY, `page ${this.shopPage + 1}/${pages.length}`, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
          .setOrigin(0.5)
      );
      makeShopButton(this.scene, this.navLayer, 560, navY, 80, 24, "NEXT >", nextEnabled, () => {
        this.shopPage += 1;
        this.render();
      }, ["NEXT >", "", "Show the next page of this list."], this.hoverTip);
    }

    this.onRender?.();
  }

  /**
   * A slim gold accent bar on a card's left edge — 10 Sep 2026, UI
   * Prettiness Pass v1. Purely additive: one more rectangle laid over the
   * card background this row already draws, at the card's own existing
   * bounds (cx/cardH match the caller's own rectangle exactly). Doesn't
   * move or resize anything else on the card, so it can't reopen any of
   * this file's own documented overlap history. Same PANEL_ACCENT gold
   * Panel.ts's corner brackets and MapSelect.ts's own card accent use, so
   * Roster & Gear reads as the same game as the other three screens this
   * pass touched.
   */
  private drawCardAccent(cy: number, cardH: number): void {
    this.shopLayer.add(this.scene.add.rectangle(SHOP_CARD_L + 2, cy, 4, cardH - 2, PANEL_ACCENT, 0.85));
  }

  private drawEntry(entry: ShopEntry, top: number): number {
    const h = ROW_H[entry.type];
    switch (entry.type) {
      case "sectionHeader":
        // Section headers now carry the shared gold accent (10 Sep 2026,
        // UI Prettiness Pass v1) instead of plain dim grey — a pure color/
        // letterSpacing change on a text object nothing else measures, the
        // lowest-risk kind of typography improvement this file allows.
        this.shopLayer.add(
          this.scene.add
            .text(480, top + 6, entry.label, { fontFamily: "monospace", fontSize: "12px", color: TEXT_ACCENT, letterSpacing: 0.5 })
            .setOrigin(0.5, 0)
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
          this.scene.add.text(SHOP_CARD_L + 16, top + 8, entry.label, { fontFamily: "monospace", fontSize: "10px", color: entry.color ?? "#6b7a8a" })
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

    // PANEL_CARD_BORDER — Codex's own card-stroke color, a subtler, darker
    // shade than its outer panel frame. Codex UI match, 11 Sep 2026.
    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, PANEL_BG, 1).setStrokeStyle(1, PANEL_CARD_BORDER));
    this.drawCardAccent(cy, cardH);
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 8, pilot.displayName, { fontFamily: "monospace", fontSize: "13px", color: TEXT_MAIN, letterSpacing: 0.5 })
    );
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, top + 26, `${path ? capitalize(path) : "Unknown"} · Tier ${pilot.tier} · ${mek?.displayName ?? "no loadout"}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: TEXT_DIM,
      })
    );
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_R - 14, top + 8, `${entry.personalPoints} pts`, { fontFamily: "monospace", fontSize: "13px", color: "#facc15" }).setOrigin(1, 0)
    );
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_R - 14, top + 24, "PERSONAL", { fontFamily: "monospace", fontSize: "8px", color: "#6b7a8a" }).setOrigin(1, 0)
    );

    // Pilot Discharge (5 Sep 2026 — Pilot Discharge & Roster Pressure,
    // shape decided 28 Aug 2026 per Maxime's own delegation; reworked 11
    // Sep 2026 into a real confirm modal — see showDischargeConfirmOverlay's
    // own header for the full reasoning, including why the old arm-then-
    // reclick text swap wasn't actually the fix it looked like). Lives
    // right on this pilot's own card, in the one strip this card had left
    // empty (below the name/subline, above the tier-upgrade button) —
    // deliberately NOT a new section-list next to Discretionary Recruiting
    // the way the proposal's own phrasing first suggested, because that
    // list would need to hold a variable, roster-sized number of rows
    // (up to 10 pilots by Act II) inside this panel's fixed-per-entry-type
    // ROW_H/pagination system, the exact kind of unpaged, growing list the
    // Recruit section's own candidate list deliberately caps at 4 to avoid.
    // One pilot's own row is a fixed, known size regardless of roster size.
    //
    // One constant-width text object now, not the old armed/confirm/cancel
    // trio — this link's label and footprint never change on click, so
    // there's nothing left here to grow into the tier-upgrade button's own
    // space the way "[ CONFIRM DISCHARGE ]" used to (see that button's own
    // comment for the matching half of this fix). The actual confirm step
    // now happens entirely on showDischargeConfirmOverlay's modal.
    //
    // Never drawn for the commander (PilotRecord.exemptFromPermadeath) —
    // dischargePilot refuses them anyway, but there's no reason to show a
    // control that can only ever fail.
    if (!pilot.exemptFromPermadeath) {
      // "Clickable = tooltip," 11 Sep 2026 (Maxime: "honestly, if its
      // clickable at some poijnt it need a tooltips" — adopted as a
      // standing rule tonight, see claude/Bloom_Wars_Tooltip_Coverage_
      // Standing_Rule_And_Checklist_v1_11Sep2026.md for the full-game
      // checklist this is one row of). Same content as the confirm
      // modal's own warning text, shown before the click this time —
      // the point isn't new copy, it's not making the player click
      // through to the popup just to find out what the link does.
      const dischargeTooltip = [
        "Discharge",
        "",
        ...wrapTipText(
          "Permanently removes this pilot from the active roster — their mek, loadout, and gear go with them. Opens a confirm step before anything happens. Can't be undone.",
          42
        ),
      ];
      this.shopLayer.add(
        this.scene.add
          .text(SHOP_CARD_L + 14, top + 44, "[ discharge ]", { fontFamily: "monospace", fontSize: "9px", color: "#b45309" })
          .setInteractive({ useHandCursor: true })
          .setScrollFactor(this.shopLayer.scrollFactorX, this.shopLayer.scrollFactorY)
          .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(dischargeTooltip, pointer.x, pointer.y))
          .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(dischargeTooltip, pointer.x, pointer.y))
          .on("pointerout", () => this.hoverTip.hide())
          .on("pointerdown", () => {
            this.dischargeOverlay?.close();
            this.dischargeOverlay = showDischargeConfirmOverlay(this.scene, this.state, pilotId, this.depth + 10, (message, color) => {
              this.dischargeMessage = message;
              this.dischargeMessageColor = color;
              this.render();
            });
          })
      );
    }

    // Frame Systems Layer (6 Sep 2026, data/frameSystems.ts) — the one door
    // into the per-pilot Frame panel (scenes/shop/FramePanel.ts): mounts,
    // Draw-budgeted systems, the A-tier refit. A text link, not a
    // makeShopButton, in the one strip this card still had free (the right
    // half of the discharge row — see the Discharge comment above for why
    // the left half is spoken for). The Draw readout is the live number, so
    // a glance at the card says whether there's budget left to install.
    {
      const frameMek = this.state.meks[pilot.mekId];
      const frameLabel = `[ FRAME · Draw ${frameDrawUsed(pilot, frameMek)}/${drawCapacityFor(pilot)} · mounts ${equippedWeaponBranchesOf(pilot).length}/${mountsFor(pilot)} ]`;
      // "Clickable = tooltip," 11 Sep 2026 — see the Discharge tooltip's own
      // comment just above for the standing rule this is one row of.
      const frameTooltip = [
        "Frame",
        "",
        ...wrapTipText(
          "Opens this pilot's Frame panel — install Draw-budgeted systems and weapon mounts, and (at tier A) the frame refit. Draw/mounts here are the live totals in use right now.",
          42
        ),
      ];
      this.shopLayer.add(
        this.scene.add
          .text(SHOP_CARD_R - 14, top + 44, frameLabel, { fontFamily: "monospace", fontSize: "9px", color: "#7dd3fc" })
          .setOrigin(1, 0)
          .setInteractive({ useHandCursor: true })
          .setScrollFactor(this.shopLayer.scrollFactorX, this.shopLayer.scrollFactorY)
          .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(frameTooltip, pointer.x, pointer.y))
          .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(frameTooltip, pointer.x, pointer.y))
          .on("pointerout", () => this.hoverTip.hide())
          .on("pointerdown", () => {
            this.frameOverlay?.close();
            this.frameOverlay = showFrameOverlay(this.scene, this.state, pilotId, {
              depth: this.depth + 10,
              onChange: () => this.render(),
              onClose: () => {
                this.frameOverlay = null;
              },
            });
          })
      );
    }

    // "[ move lance ]" jump, 11 Sep 2026 (Maxime: "rooster and gear should
    // have a easy way for me to move my npc from lance to lance. An
    // obvious one.") — placed in the one gap this card had free, measured
    // rather than guessed: FRAME sits at top+44 (origin 1,0, so it clears
    // by top+44 plus its own ~16px line height) and "Convert to company"
    // starts at top+92 — nothing else in this card touches the right-hand
    // column between those two rows. Reuses RosterPanel's own click-to-
    // carry (see the Hub.ts call site this callback comes from) rather
    // than a second picker built here — see that comment for the full
    // reasoning on why, not just where.
    if (this.onMoveLance) {
      // "Clickable = tooltip," 11 Sep 2026 — same standing rule as Discharge/
      // Frame just above.
      const moveLanceTooltip = ["Move Lance", "", ...wrapTipText("Jumps to Crew Records so you can drag this pilot into a different lance.", 42)];
      this.shopLayer.add(
        this.scene.add
          .text(SHOP_CARD_R - 14, top + 66, "[ move lance → crew records ]", { fontFamily: "monospace", fontSize: "10px", color: TEXT_ACCENT })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true })
          .setScrollFactor(this.shopLayer.scrollFactorX, this.shopLayer.scrollFactorY)
          .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(moveLanceTooltip, pointer.x, pointer.y))
          .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(moveLanceTooltip, pointer.x, pointer.y))
          .on("pointerout", () => this.hoverTip.hide())
          .on("pointerdown", () => this.onMoveLance?.(pilotId))
      );
    }

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
    // tierUpgradeCostFor (6 Sep 2026) — the same number purchaseTierUpgrade
    // will actually charge, Quartermaster discount included, rather than
    // the flat table; the two used to agree only because the discount was
    // never applied anywhere.
    const tierCost = atMaxTier ? undefined : tierUpgradeCostFor(this.state, pilotId);
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
    // Tier-upgrade tooltip, 11 Sep 2026 (Maxime: "rank upgrade will need a
    // tooltip about what it mean") — three cases, same "show it even
    // disabled" reasoning as every other tooltip on this card:
    //   - a real next step: the exact stat delta this purchase buys,
    //     read straight off TIERS (the table engine/units.ts actually
    //     applies), plus the standing fact that gear tier is also what
    //     gates weapon-branch purchases (D/C/B/A -> 2nd/3rd/4th/5th).
    //   - maxed at A: says what's left above it and why it's unreachable
    //     by purchase, rather than leaving "MAXED" to speak for itself.
    //   - Heirloom (S): same, for the other unreachable-by-purchase case.
    const tierTooltip = isHeirloomTier
      ? ["Heirloom Tier (S)", "", ...wrapTipText("The strongest gear tier in the game. Granted automatically by this pilot's Heirloom weapon — never purchasable, at any price.", 42)]
      : atMaxTier
        ? ["Tier A (maxed)", "", ...wrapTipText("The top of the purchase ladder. S tier exists above it but is only granted by an Heirloom weapon, never bought.", 42)]
        : (() => {
            const nextTier = TIER_ORDER[idx + 1];
            const cur = TIERS[pilot.tier];
            const next = TIERS[nextTier];
            const dMove = next.move - cur.move;
            const body = `+${next.attack - cur.attack} attack, +${next.defense - cur.defense} defense, +${next.hp - cur.hp} max HP${dMove > 0 ? `, +${dMove} move` : ""}. Gear tier also gates weapon-branch purchases — D/C/B/A unlock the 2nd/3rd/4th/5th branch.`;
            return [`Tier ${pilot.tier} -> ${nextTier}`, "", ...wrapTipText(body, 42)];
          })();
    // Y-position moved top+62 -> top+76, 11 Sep 2026 (Maxime: "the dismiss
    // synker button in red on the rooster ui is still hidden halfway into
    // the upgrade button... make sure those are not close to ceach
    // other"). Real, measured overlap, not a vague complaint: this button
    // is 24px tall centered at top+62, so it span[ped] y:[50,74] and
    // x:[SHOP_CARD_L+10, SHOP_CARD_L+158] — and the discharge link sits at
    // (SHOP_CARD_L+14, top+44), a 9px line whose own bottom edge lands
    // around y=55-56, which is INSIDE that button's old top edge (50).
    // Centering here at top+76 instead moves the button's span to roughly
    // y:[64,88] — about 8px of real clearance above the discharge link's
    // bottom edge, and still 4px clear of the "Weapon Branch:"/"Convert to
    // company" labels at top+92 below (a text label, not a button, so a
    // tighter gap there carries none of the misclick risk the discharge
    // link/button pair had). Nothing else on this card shares this
    // button's x-range at this y (the secondary-track buttons start at
    // secX = SHOP_CARD_L+250, well clear horizontally) — checked against
    // the rest of drawPilotRow before moving this, per this file's own
    // repeated "a fix here breaks a neighbor" history.
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_L + 84, top + 76, 148, 24, tierLabel, tierEnabled, () => {
      purchaseTierUpgrade(this.state, pilotId);
      this.render();
    }, tierTooltip, this.hoverTip);

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
          // Secondary-track tooltips, 11 Sep 2026 (Maxime: "we need those
          // tooltips too. the fabricator and stuff") — same treatment as
          // the weapon-branch buttons above: shown even when disabled
          // (can't afford it, or it's already this pilot's primary), since
          // "what does this actually do" matters most exactly when you're
          // deciding whether it's worth saving up for.
          const trackTooltip = [capitalize(track), "", ...wrapTipText(SECONDARY_TRACK_TOOLTIPS[track], 42)];
          if (track === mek.primary) trackTooltip.push("", "already this pilot's primary track");
          makeShopButton(this.scene, this.shopLayer, tx, top + 74, 66, 20, TRACK_LABELS[track], !disabled, () => {
            purchaseMekSecondary(this.state, pilotId, track);
            this.render();
          }, trackTooltip, this.hoverTip);
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
    // "Clickable = tooltip," 11 Sep 2026 — same standing rule as Discharge/
    // Frame/Move Lance above. Verified against convertPersonalToCompany's
    // own doc comment (engine/campaignEconomy.ts) rather than guessed:
    // one-way, floor-rounded, no inverse function exists.
    const convertTooltip = [
      "Convert to Company",
      "",
      ...wrapTipText(
        `Moves this pilot's personal points into the shared company pool at half value, rounded down (CONVERSION_RATE=${CONVERSION_RATE}). One-way — there's no converting company points back to personal.`,
        42
      ),
    ];
    // top + 114 (was 112) and the label at top + 92 (was 96): the 22px
    // button used to overlap its own 9px label — same overlap the Weapon
    // Branch row below had, fixed together 1 Sep 2026.
    makeShopButton(this.scene, this.shopLayer, convertX, top + 114, 170, 22, convertLabel, entry.personalPoints > 0, () => {
      convertPersonalToCompany(this.state, pilotId, entry.personalPoints);
      this.render();
    }, convertTooltip, this.hoverTip);

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
    // Frame Systems Layer, second mount (6 Sep 2026): "equipped" is now a
    // LIST (engine/frameSystems.ts's equippedWeaponBranchesOf — the one read
    // path, which also understands a pre-6-Sep save's single field), and
    // the frame has 1 mount below tier C or 2 from C. The buttons below
    // read that: an equipped branch shows its mount number and unequips on
    // click; an unequipped one mounts into a free slot, or — when every
    // mount is full and there are two of them — reads MOUNTS FULL rather
    // than guessing which live branch to drop (equipWeaponBranch's own
    // rule; a one-mount frame keeps the old one-click swap exactly).
    const mounted = equippedWeaponBranchesOf(pilot);
    const mountCap = mountsFor(pilot);
    // Layout fix, 1 Sep 2026 (caught in a Debrief screenshot during the
    // telemetry pass): makeShopButton takes a CENTER x, but this row was
    // passing the card's left edge — every branch button rendered half off
    // the card's left side, its label clipped, since the day it shipped.
    // `bx` is the button's left edge; `bx + BRANCH_BTN_W / 2` is its centre.
    //
    // Second layout fix, 5 Sep 2026 (caught live in Chrome, checking Combat
    // Medic's own Shop row right after it shipped as Munti's 4th branch —
    // the "nobody's watched this render" gap the build addendum flagged).
    // A FIXED 210px width / 216px pitch was fine for every class that
    // topped out at 3 branches: 3*216+210 = 858px always landed left of
    // Convert-to-company (fixed at SHOP_CARD_R-104, its own left edge
    // around x=741). Combat Medic made Munti the first 4-branch class, and
    // 4 buttons at the old pitch run to x=902 — deep into Convert-to-
    // company's footprint. Two distinct failures came out of that, both
    // reproduced live, not just spotted on screen: an OWNED 4th-slot
    // button is always interactive (see the literal `true` a few lines
    // down), so it permanently eats every click meant for Convert-to-
    // company once a Munti owns all 4 branches — that pilot's convert
    // button becomes unreachable for good; an UNOWNED, unaffordable
    // 4th-slot button has no interactive zone at all (makeShopButton
    // returns before setInteractive when `enabled` is false), so the click
    // falls THROUGH it onto Convert-to-company underneath instead — which
    // is exactly what happened testing this build: clicking "BUY Combat
    // Medic" on a personal-points-short pilot silently ran Convert All
    // instead and spent the points on nothing.
    //
    // Fix: size the row to fit whatever's actually being drawn, capped at
    // the original 210px so every 1-3-branch class (everyone else, today)
    // renders pixel-identical to before this fix. Only a class with a real
    // 4th branch — just Munti, until Meeps/Tank's own 4th-slot question
    // gets answered — ever computes a narrower width.
    const BRANCH_ROW_GAP = 6;
    const BRANCH_ROW_SAFETY_MARGIN = 20; // breathing room before Convert-to-company's own left edge
    const branchRowRightBound = convertX - 85 - BRANCH_ROW_SAFETY_MARGIN;
    const branchRowAvailW = branchRowRightBound - (SHOP_CARD_L + 14);
    const fitWidth = Math.floor((branchRowAvailW - BRANCH_ROW_GAP * (buildable.length - 1)) / buildable.length);
    const BRANCH_BTN_W = Math.min(210, fitWidth);
    const BRANCH_BTN_PITCH = BRANCH_BTN_W + BRANCH_ROW_GAP;
    let bx = SHOP_CARD_L + 14;
    for (const branchId of buildable) {
      const cx = bx + BRANCH_BTN_W / 2;
      const branch = WEAPON_BRANCHES[branchId];
      const isOwned = owned.includes(branchId as WeaponBranchId);
      const mountIdx = mounted.indexOf(branchId);
      const isEquipped = mountIdx >= 0;
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
        // Item-purchase tooltip, 11 Sep 2026 — branch.description already
        // exists in data/weaponBranches.ts for every branch (it's what
        // FramePanel.ts's own systems/refits print inline); this button
        // was the one place in the shop that never showed it. Shown on the
        // button whether or not it's currently affordable/tier-gated — a
        // player weighing whether to save up for it needs to know what
        // it DOES, not just what it costs.
        const branchTooltip = [branch.displayName, "", ...wrapTipText(branch.description, 42)];
        if (cost !== undefined && !tierMet) branchTooltip.push("", `needs tier ${requiredTier}+`);
        makeShopButton(this.scene, this.shopLayer, cx, top + 114, BRANCH_BTN_W, 22, label, cost !== undefined && tierMet && affordable, () => {
          purchaseWeaponBranch(this.state, pilotId, branchId);
          this.render();
        }, branchTooltip, this.hoverTip);
        if (cost !== undefined && !tierMet) {
          this.shopLayer.add(
            this.scene.add
              .text(cx, top + 126, `needs tier ${requiredTier}+`, { fontFamily: "monospace", fontSize: "8px", color: "#6b7a8a" })
              .setOrigin(0.5, 0)
          );
        }
      } else {
        const mountsFull = mounted.length >= mountCap && mountCap > 1;
        const label = isEquipped
          ? `${branch.displayName} [M${mountIdx + 1}]`
          : mountsFull
            ? `${branch.displayName} (MOUNTS FULL)`
            : `${mountCap > 1 ? "MOUNT" : "EQUIP"} ${branch.displayName}`;
        const ownedTooltip = [branch.displayName, "", ...wrapTipText(branch.description, 42)];
        makeShopButton(this.scene, this.shopLayer, cx, top + 114, BRANCH_BTN_W, 22, label, isEquipped || !mountsFull, () => {
          if (isEquipped) unequipWeaponBranch(this.state, pilotId, branchId);
          else equipWeaponBranch(this.state, pilotId, branchId);
          this.render();
        }, ownedTooltip, this.hoverTip);
      }
      bx += BRANCH_BTN_PITCH;
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

    // PANEL_CARD_BORDER — Codex's own card-stroke color, a subtler, darker
    // shade than its outer panel frame. Codex UI match, 11 Sep 2026.
    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, PANEL_BG, 1).setStrokeStyle(1, PANEL_CARD_BORDER));
    this.drawCardAccent(cy, cardH);
    this.shopLayer.add(
      this.scene.add.text(SHOP_CARD_L + 14, cy, `${mek.displayName} (${entry.pilot.displayName}) — Spare Parts: ${mek.spareParts}/${max}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#e8e2d4",
      }).setOrigin(0, 0.5)
    );
    const atMax = mek.spareParts >= max;
    const enabled = !atMax && this.state.points >= SPARE_PART_COST;
    // Spare Parts tooltip, 11 Sep 2026 — verified against
    // engine/campaignEconomy.ts's own purchaseSpareParts/fabricatorMaxSpareParts:
    // COMPANY pool (not personal), capped at this mek's Fabricator-track max,
    // and its actual job in play is Beacon Control (a Fabricator mek's own
    // spare part is tried before a company-wide crate on revive — see the
    // Beacon Control tooltip just below).
    const sparePartTooltip = [
      "Spare Part",
      "",
      ...wrapTipText(
        `Adds one spare part to ${mek.displayName}'s Fabricator stockpile, from the company pool (${SPARE_PART_COST} pts) — not this pilot's personal points. Capped at their Fabricator track's max (${max} for this mek). Beacon Control burns this pilot's own spare part instead of a company crate when reviving them mid-mission.`,
        42
      ),
    ];
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_R - 90, cy, 160, 26, atMax ? "AT MAX" : `BUY PART (${SPARE_PART_COST})`, enabled, () => {
      purchaseSpareParts(this.state, mek.id);
      this.render();
    }, sparePartTooltip, this.hoverTip);
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

    // PANEL_CARD_BORDER — Codex's own card-stroke color, a subtler, darker
    // shade than its outer panel frame. Codex UI match, 11 Sep 2026.
    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, PANEL_BG, 1).setStrokeStyle(1, PANEL_CARD_BORDER));
    this.drawCardAccent(cy, cardH);
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

    // Beacon Control tooltips, 11 Sep 2026 — verified against
    // Bloom_Wars_Beacon_Restock_Economy_v1.md §3/§5: a mid-mission revive
    // spends 15% of that mission's completion bonus, ONE of these two
    // stockpiles, AND a Restock Room charge is separately required (waived
    // free if a living Munti is on the field) — a crate and a charge are
    // not the same resource, so each gets its own accurate line rather than
    // one shared blurb.
    const crateTooltip = [
      "Fabricator Crate",
      "",
      ...wrapTipText(
        `Company-pool stockpile (${crateCost} pts${fabricatorBuilt ? ", halved by the Fabricator bay" : ""}). Beacon Control spends one of these to revive a downed pilot who has no Fabricator spare part of their own left.`,
        42
      ),
    ];
    const chargeTooltip = [
      "Restock Room Charge",
      "",
      ...wrapTipText(
        `Company-pool stockpile (${chargeCost} pts${fabricatorBuilt ? ", halved by the Fabricator bay" : ""}). Beacon Control always spends one of these per revive too, alongside the crate/part — free (0 charges) if a living Munti is on the field when the beacon is used.`,
        42
      ),
    ];
    const crateEnabled = this.state.points >= crateCost;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_L + 190, top + 44, 170, 22, `BUY CRATE (${crateCost})`, crateEnabled, () => {
      purchaseBeaconCrate(this.state);
      this.render();
    }, crateTooltip, this.hoverTip);
    const chargeEnabled = this.state.points >= chargeCost;
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_R - 190, top + 44, 170, 22, `BUY CHARGE (${chargeCost})`, chargeEnabled, () => {
      purchaseBeaconCharge(this.state);
      this.render();
    }, chargeTooltip, this.hoverTip);
  }

  private drawRecruitRow(top: number, h: number): void {
    const cardH = h - 6;
    const cy = top + cardH / 2;
    // PANEL_CARD_BORDER — Codex's own card-stroke color, a subtler, darker
    // shade than its outer panel frame. Codex UI match, 11 Sep 2026.
    this.shopLayer.add(this.scene.add.rectangle(480, cy, SHOP_CARD_W, cardH, PANEL_BG, 1).setStrokeStyle(1, PANEL_CARD_BORDER));
    this.drawCardAccent(cy, cardH);
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
      const classTooltip = [capitalize(cls), "", ...wrapTipText(CLASS_ROLE_TOOLTIPS[cls], 42)];
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
        .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(classTooltip, pointer.x, pointer.y))
        .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(classTooltip, pointer.x, pointer.y))
        .on("pointerout", () => this.hoverTip.hide())
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

    // ---- Lance selector (5 Sep 2026) -----------------------------------
    // Recruiting now fills a specific lance, because lances arrive empty for
    // the player to build (Maxime: "player should recruit their lance
    // teamate not have a team be creste for them"). Only lances with an
    // opening are pickable — a full one has nowhere to put anybody.
    const openLances = activeLanceIds(this.state).filter((id) => lanceRoster(this.state, id).length < MAX_LANCE_SIZE);
    if (this.recruitLance === null || !openLances.includes(this.recruitLance)) {
      this.recruitLance = openLances[0] ?? null;
    }
    let lx = SHOP_CARD_L + 14;
    for (const id of activeLanceIds(this.state)) {
      const count = lanceRoster(this.state, id).length;
      const open = count < MAX_LANCE_SIZE;
      const picked = this.recruitLance === id;
      // Lance-selector tooltip, 11 Sep 2026 — same row the checklist flagged.
      // A full lance's own greyed-out state is exactly the "why can't I
      // click this" moment the standing rule calls out, so it gets hover
      // wired below regardless of `open`, not just the pickable ones.
      const lanceTooltip = open
        ? [lanceDisplayName(id), "", ...wrapTipText(`A new hire signs into this lance. ${MAX_LANCE_SIZE - count} of ${MAX_LANCE_SIZE} slots open.`, 42)]
        : [lanceDisplayName(id), "", ...wrapTipText(`Full at ${MAX_LANCE_SIZE}/${MAX_LANCE_SIZE}. Move someone out on the Roster panel to open a slot here.`, 42)];
      const lbg = this.scene.add
        .rectangle(lx + 70, top + 96, 138, 24, picked ? 0x2e5c7a : 0x1a2028, 1)
        .setStrokeStyle(1, picked ? 0x4a7a9a : 0x3a4552)
        .setScrollFactor(this.shopLayer.scrollFactorX, this.shopLayer.scrollFactorY)
        .setInteractive()
        .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(lanceTooltip, pointer.x, pointer.y))
        .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(lanceTooltip, pointer.x, pointer.y))
        .on("pointerout", () => this.hoverTip.hide());
      if (open) {
        lbg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
          this.recruitLance = id;
          this.recruitMessage = "";
          this.render();
        });
      }
      this.shopLayer.add(lbg);
      this.shopLayer.add(
        this.scene.add
          .text(lx + 70, top + 96, `${lanceDisplayName(id)} ${count}/${MAX_LANCE_SIZE}`, {
            fontFamily: "monospace",
            fontSize: "10px",
            color: picked ? "#ffffff" : open ? "#8a97a6" : "#5a6472",
          })
          .setOrigin(0.5)
      );
      lx += 146;
    }

    if (this.recruitLance === null) {
      this.shopLayer.add(
        this.scene.add.text(SHOP_CARD_L + 14, top + 126, "Every lance is full. Nowhere to put a new hire.", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#8a97a6",
        })
      );
      return;
    }

    // ---- Candidates ------------------------------------------------------
    // The ten authored 2nd/3rd Lance pilots are the candidate pool — real
    // written characters you choose between, rather than ten people handed
    // over as a finished squad. Once they're all spoken for, the generic
    // class buttons above hire a generated pilot instead.
    const candidates = recruitCandidates(this.state).slice(0, 4);
    const canAfford = this.state.points >= DISCRETIONARY_RECRUIT_COST;
    const lance = this.recruitLance;
    // messageY (9 Sep 2026, Maxime's own screenshot: the sign-on confirmation
    // text landing printed right on top of the candidate list) tracks where
    // the candidate list / empty-state line actually ends, so the
    // recruitMessage drawn at the bottom of this method can sit below it
    // instead of at the hardcoded `top + 190` that assumed at most ~3
    // candidates. With 4 candidates shown (recruitCandidates().slice(0, 4)'s
    // own ceiling), the list's last row alone reaches top + 188 — inside the
    // old fixed offset. Same class of bug as the Weapon Branch row's own
    // overlap history a few methods up in this file; fixed the same way,
    // by measuring instead of assuming.
    let messageY = top + 184; // clears the HIRE button (top + 150, 26 tall) with margin

    if (candidates.length) {
      this.shopLayer.add(
        this.scene.add.text(SHOP_CARD_L + 14, top + 118, "CANDIDATES — click to sign into the selected lance", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#8a97a6",
        })
      );
      let cyc = top + 140;
      for (const cand of candidates) {
        const candPath = UNIT_ARCHETYPES[cand.archetypeId]?.path;
        const label = `${cand.displayName}  ·  ${candPath ?? "?"}`;
        // Candidate sign-on tooltip, 11 Sep 2026 — the checklist's
        // "sign-on candidates" row. Adds the cost/lance-target info the
        // label itself doesn't show; falls back to the affordability
        // reason when greyed out, same "disabled still explains itself"
        // rule as everywhere else in this pass.
        const candTooltip = canAfford
          ? [
              cand.displayName,
              "",
              ...wrapTipText(
                `${candPath ? CLASS_ROLE_TOOLTIPS[candPath] : ""} Signs into ${lanceDisplayName(lance)} for ${DISCRETIONARY_RECRUIT_COST} pts.`.trim(),
                42
              ),
            ]
          : [cand.displayName, "", ...wrapTipText(`Not enough company points — signing costs ${DISCRETIONARY_RECRUIT_COST}, company has ${this.state.points}.`, 42)];
        const t = this.scene.add
          .text(SHOP_CARD_L + 22, cyc, `[ sign ] ${label}`, {
            fontFamily: "monospace",
            fontSize: "10px",
            color: canAfford ? "#c8b273" : "#5a6472",
          })
          .setScrollFactor(this.shopLayer.scrollFactorX, this.shopLayer.scrollFactorY)
          .setInteractive()
          .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(candTooltip, pointer.x, pointer.y))
          .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(candTooltip, pointer.x, pointer.y))
          .on("pointerout", () => this.hoverTip.hide());
        if (canAfford) {
          t.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
            const result = recruitIntoLance(this.state, lance, cand.id);
            if (result.ok) {
              this.state.points -= DISCRETIONARY_RECRUIT_COST;
              this.recruitMessage = `${result.pilot.displayName} signs on with ${lanceDisplayName(lance)}.`;
              this.recruitMessageColor = "#4ade80";
              this.keepRecruitVisible = true;
              this.onRender?.();
            } else {
              this.recruitMessage = result.reason;
              this.recruitMessageColor = "#ef4444";
            }
            this.render();
          });
        }
        this.shopLayer.add(t);
        cyc += 16;
      }
      messageY = Math.max(messageY, cyc + 6);
    } else {
      this.shopLayer.add(
        this.scene.add.text(SHOP_CARD_L + 14, top + 118, "No named candidates left — hiring draws from the general pool.", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#8a97a6",
        })
      );
    }

    // The generic hire, for when you want a class rather than a name — and
    // the only route once the authored candidates are all signed.
    //
    // Character Creator overlay, 9 Sep 2026 (Maxime: "a true character
    // creator that act as the toggle for all the new npc player receive") —
    // recruitDiscretionary already rolls this recruit's species now (see
    // that function's own header), so this is the moment the player
    // actually sees the roll and can rename/re-roll or pick a different
    // species before walking away. The success message itself waits for
    // the overlay to close (the overlay's onDone) so it reports the
    // FINAL name if the player renamed them, not the one that was rolled.
    const hireTooltip = [
      `Hire ${capitalize(this.recruitClass)}`,
      "",
      ...wrapTipText(
        `${CLASS_ROLE_TOOLTIPS[this.recruitClass]} A generated recruit — species rolled, name and species both editable next screen. Signs into ${lanceDisplayName(lance)} for ${DISCRETIONARY_RECRUIT_COST} pts.`,
        42
      ),
    ];
    makeShopButton(this.scene, this.shopLayer, SHOP_CARD_R - 110, top + 150, 180, 26, `HIRE ${capitalize(this.recruitClass).toUpperCase()} (${DISCRETIONARY_RECRUIT_COST})`, canAfford, () => {
      const result = recruitDiscretionary(this.state, this.recruitClass);
      if (result.ok && result.pilot) {
        // recruitDiscretionary already charged the points and added the
        // pilot; it has no concept of lances, so place them in the selected
        // one rather than letting them default into 1st Lance's slot.
        const entry = this.state.pilots[result.pilot.id];
        if (entry) entry.lance = lance;
        this.keepRecruitVisible = true;
        this.onRender?.();
        this.render();
        const pilotId = result.pilot.id;
        showCharacterCreatorOverlay(this.scene, this.state, pilotId, () => {
          const finalName = this.state.pilots[pilotId]?.pilot.displayName ?? "";
          this.recruitMessage = `${finalName} signs on with ${lanceDisplayName(lance)}.`;
          this.recruitMessageColor = "#4ade80";
          this.onRender?.();
          this.render();
        });
      } else {
        this.recruitMessage = result.reason ?? "recruit failed";
        this.recruitMessageColor = "#ef4444";
        this.render();
      }
    }, hireTooltip, this.hoverTip);

    if (this.recruitMessage) {
      this.shopLayer.add(
        this.scene.add.text(SHOP_CARD_L + 14, messageY, this.recruitMessage, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: this.recruitMessageColor,
          wordWrap: { width: 500 },
        })
      );
    }
  }
}
