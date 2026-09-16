// src/scenes/TransporterPad.ts
// Sits between mission-select and the battle itself — the squad-review-
// and-launch screen (the XCOM "choose your squad, board the dropship"
// beat, reimagined for this game's own fiction: Warden Company doesn't
// board anything, pilots step onto a transporter pad and get beamed to
// the mission site). This is explicitly the Tier-0, unbranded version of
// that room per claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md's own build-
// cost plan (§9) — that doc's Hangar Deck gets a name, a location (the
// Antfarm/Providence), and crew banter starting Act II. None of that
// exists yet and none of it belongs here: no Providence references, no
// crew banter, no narrative dressing. Purely functional.
//
// Placeholder portraits per GDD §12.2 ("no artist for Sunrider-style
// hand-painted portraits... a coloured circle with two initials. Real
// portraits are a later drop-in against the same field.") — this is the
// first scene in the codebase to actually draw that convention. Nothing
// under engine/ or scenes/ had built it yet (the Carrier Hub doc's own
// §7 just cites the rule, doesn't implement it), so PATH_COLORS and
// pilotInitials() below are new, not a copy of an existing helper — kept
// in the same muted blue-grey palette family as the rest of the game
// (MapSelect's card colours) rather than inventing a new one.
//
// Deploy-cap / squad-selection pass (22 Aug 2026): this scene used to
// always deploy the mission's full static pilot list with no picker,
// because Act I's roster size and deploy count were both exactly 5 — there
// was never anything to choose between. That assumption broke the moment
// engine/campaignState.ts's recruit-phase system (recruitDiscretionary /
// the emergency Munti replacement, same day) let campaign roster size grow
// past 5 even during Act I. ACT1_DEPLOY_CAP and the toggleable-pad picker
// below are what makes a real bench actually mean something: below the
// cap, nothing changes (see the branch comment in create()); above it, the
// player picks.
import Phaser from "phaser";
import type { CampaignMission, MekArchetype, Path, PilotRecord } from "../data/types";
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { UNIT_ARCHETYPES } from "../data/units";
import { findPilot, findMek } from "../data/pilotRegistry";
import {
  canLaunchMission,
  companyNameOf,
  createWardenCampaignState,
  lanceDisplayName,
  lanceRoster,
  activeLanceIds,
  loadCampaignState,
  saveCampaignState,
  type CampaignState,
} from "../engine/campaignState";
import { equipWeaponBranch } from "../engine/campaignEconomy";
import { WEAPON_BRANCHES, type WeaponBranchId } from "../data/weaponBranches";
import { equippedWeaponBranchesOf, mountsFor, frameDrawUsed, drawCapacityFor } from "../engine/frameSystems";
import { showFrameOverlay } from "./shop/FramePanel";
import { makeShopButton } from "./shop/ShopPanel";
import { portraitAssetFor } from "../engine/portraits";
import { describeObjective } from "../data/missionBriefing";
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";

// One muted, distinct hue per Path so a squad row scans quickly — new to
// this file (see header comment: no portrait colour scheme existed
// anywhere yet), chosen from the same blue-grey family as MapSelect's
// card palette rather than Battle's board colours, which encode side
// (player/hostile), not class.
// Exported 25 Aug 2026 so scenes/Hub.ts can draw the same placeholder-
// portrait convention (coloured circle + initials, GDD §12.2) for its own
// NPCs instead of re-deriving it — same colours, same initials logic,
// still no real art pipeline behind either.
export const PATH_COLORS: Record<Path, number> = {
  meeps: 0x4a7a9a,
  tank: 0x8a7a5f,
  reeps: 0x5c8a5a,
  munti: 0x3a8a8a,
};

/**
 * Shape-by-Path pass, 12 Sep 2026 (Maxime: "the circle with the npc name
 * that move, can we change their shape to match the individual npc combat
 * specialty, so its easy to see. thats my tank guy, thats a meeps thats a
 * reeps"). Colour alone stopped being enough once a whole crowd of NPCs is
 * walking around Hub.ts's floor at once — this is the second, silhouette-
 * level cue layered on top of PATH_COLORS above, same "read a squad row at
 * a glance" goal that file's own header describes for colour.
 */
export type AvatarShape = "circle" | "square" | "diamond" | "triangle" | "hexagon";

// First-pass mapping, not a locked design decision — square (tank) for
// something blunt and blocky, matching the melee/interdict-pin "wall" role
// (data/units.ts's own header); diamond (reeps) reading as a reticle for
// the ranged/sensor role; triangle (meeps) as a forward-pointing arrow for
// the melee/ambush role; hexagon (munti) as the deliberate odd-shape-out,
// since Munti is the one Path here that isn't a combat role at all
// (support/medic). Swap any of these freely if one misreads once it's
// actually on screen — nothing downstream cares which shape means which
// Path, only that drawAvatarShape (below) can draw whatever this says.
export const PATH_SHAPES: Record<Path, AvatarShape> = {
  tank: "square",
  reeps: "diamond",
  meeps: "triangle",
  munti: "hexagon",
};

/**
 * Act I's fixed deploy cap — a placeholder, not a tuned balance number.
 * The campaign doc's own §10 squad-scaling table lists "typical deploy: 5"
 * for Act I specifically; Act II moves to a real 5-8 variable range tied
 * to roster size (same table) — not built this pass, explicitly out of
 * scope here. Hardcoded rather than derived from anything else so the two
 * concepts stay distinct: this is Act I's whole-act constant, independent
 * of any one mission's own playerPilotIds length, which today happens to
 * equal it (roster == deploy count, so no mission has ever needed a
 * picker) but stops being the same number the moment a recruit joins the
 * bench.
 */
export const ACT1_DEPLOY_CAP = 5;

/**
 * Act II's own deploy cap (25 Aug 2026, batch 2 / Mission 13 "New Colors,
 * Old Wounds"; raised 26 Aug 2026 from 8 to 10 — Maxime's original intent,
 * clarified in chat, was a full 10-pilot Act II deploy, not an 8-of-10
 * composition choice. That means the Transporter Pad picker no longer
 * appears at all in Act II (showPicker needs activePilotIds.length >
 * deployCap, and roster size now equals the cap) — same "no real choice
 * yet" shape Act I has always had. No enforced minimum — nothing in this
 * screen or canLaunchMission checks for "at least 5"; the only hard floor
 * is the existing "at least one active, living Munti" gate, same as Act I.
 * Deploying fewer than the max is a real, allowed choice (a smaller squad
 * for a smaller fight), not a mistake this screen blocks — kept simple on
 * purpose rather than inventing a second validation rule nothing has asked
 * for yet.
 */
export const ACT2_DEPLOY_CAP = 10;

/**
 * Act III's own deploy cap (25 Aug 2026, same-day correction, batch 5, set
 * to 12; raised 26 Aug 2026 to 15 — same correction as ACT2_DEPLOY_CAP
 * above, Maxime's original intent was the full 15-pilot roster deploying,
 * not a 12-of-15 composition choice). Same picker-disappears consequence
 * as Act II: with the cap equal to the full roster, showPicker never fires
 * for Act III either. One live wrinkle this doesn't touch: Mission 26
 * (The Cradle Beneath) keeps its own smaller hardcoded squad in
 * campaignAmaranth.ts because its map corridor gridlocks 12+ units — but
 * this cap is what the Transporter Pad itself enforces for a real player,
 * and it was already 12 (above that mission's safe size) before this
 * change; raising it to 15 makes an over-large Mission 26 deploy easier
 * for a player to accidentally pick, not something this pass newly causes.
 * Worth a per-mission cap override if that turns out to matter in practice.
 */
export const ACT3_DEPLOY_CAP = 15;

/**
 * Resolves which deploy cap applies to a given mission id. Team One's own
 * missions (`mission_1a`, `mission_2`, ...) and anything that doesn't match
 * either the `mission_amaranth_N` or `mission_house_amaranth_N` shape fall
 * back to ACT1_DEPLOY_CAP, same behavior as before this function existed —
 * this only changes anything for Amaranth missions 13 and up.
 *
 * Bug found and fixed 1 Sep 2026, during House Amaranth's own Mission
 * Select wiring pass: the original regex only matched
 * `mission_amaranth_N`, so every `mission_house_amaranth_N` id (a
 * DIFFERENT string — the extra "house_" doesn't match) silently fell
 * through to the "doesn't match" branch and got ACT1_DEPLOY_CAP (5)
 * regardless of act — meaning House Amaranth's own 10-pilot Act II/III
 * squad (HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD, missions 13-36) would have
 * been capped at deploying only 5 of the 10 pilots actually available,
 * the moment a player reached Mission 13.
 *
 * Second bug found and fixed 6 Sep 2026, same shape: House Amaranth's own
 * tiering used to stop at two (no Third Lance existed, so Act II and III
 * shared ACT2_DEPLOY_CAP). Now that HOUSE_AMARANTH_THIRD_LANCE_PILOTS
 * exists and HOUSE_AMARANTH_ACT3_DEFAULT_SQUAD (campaignHouseAmaranth.ts)
 * carries 15 ids into Missions 21-36, leaving this at two tiers would have
 * silently benched 5 of every Act III player's own pilots every mission —
 * the exact same class of bug as the one above, just one tier short this
 * time instead of two. Three tiers now, matching Warden's own act
 * boundaries in shape (not in number — House Amaranth's own Act II starts
 * at 13 and Act III at 21, not 25) and the same "full roster, no bench"
 * intent ACT3_DEPLOY_CAP's own doc comment above already states for
 * Warden.
 */
export function deployCapForMission(missionId: string): number {
  const houseAmaranthMatch = missionId.match(/^mission_house_amaranth_(\d+)$/);
  if (houseAmaranthMatch) {
    const hn = Number(houseAmaranthMatch[1]);
    if (hn <= 12) return ACT1_DEPLOY_CAP;
    if (hn <= 20) return ACT2_DEPLOY_CAP;
    return ACT3_DEPLOY_CAP;
  }
  const match = missionId.match(/^mission_amaranth_(\d+)$/);
  if (!match) return ACT1_DEPLOY_CAP;
  const n = Number(match[1]);
  if (n <= 12) return ACT1_DEPLOY_CAP;
  if (n <= 24) return ACT2_DEPLOY_CAP;
  return ACT3_DEPLOY_CAP;
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * "A coloured circle with two initials" (GDD §12.2) — derives a two-
 * letter monogram from a PilotRecord.displayName. Named Warden pilots
 * follow the "<rank> <First> <Last> — "<Callsign>"" shape (see
 * data/campaignAmaranth.ts): split off the callsign after the em dash,
 * drop rank tokens (anything containing a digit or a period — "2nd",
 * "Lt.", "M.Sgt." all fall out that way), and take the first letter of
 * the first and last remaining word ("2nd Lt. Dessa Rourke" -> "DR").
 * Falls back gracefully for anything that doesn't fit that shape (a
 * generated recruit's `Recruit "Callsign"`, or a single bare word).
 */
export function pilotInitials(displayName: string): string {
  const namePart = displayName.split("—")[0].trim();
  const words = namePart
    .split(/\s+/)
    .map((w) => w.replace(/["“”]/g, ""))
    .filter((w) => /^[A-Za-z']+$/.test(w));
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Returned by drawPilotAvatar — see that function's own header. */
export interface PilotAvatar {
  /** Add/position this — holds everything (hit circle plus portrait image or initials text). */
  container: Phaser.GameObjects.Container;
  /**
   * The real underlying shape. Always created (even when a portrait
   * covers it — its fill is alpha 0 in that case, its stroke ring stays
   * visible on top of the image). Exists so a caller that needs a real
   * interactive hit-target (Hub's NPCs — see Hub.ts's own npc.circle
   * .setInteractive()/.disableInteractive() call sites) has one, exactly
   * as before this pass, rather than trying to make a Container itself
   * interactive (Containers need an explicit hit area; a Shape already
   * has the right one built in).
   *
   * Widened from Arc to the shared Shape base, 12 Sep 2026 (shape-by-Path
   * pass) — Hub.ts's own NPCs are the one caller that now passes a `shape`
   * argument (PATH_SHAPES above) instead of taking the default circle, so
   * this can be a Rectangle/Triangle/Polygon just as easily as an Arc.
   * Checked by hand against every hitCircle/npc.circle call site in the
   * codebase before this change: none of them ever call anything but the
   * common Shape/GameObject API (.setInteractive, .disableInteractive,
   * .setStrokeStyle) on this field, so the widening is a pure no-op for
   * every existing caller — Transporter Pad, RosterPanel, MemorialPanel,
   * Debrief all keep getting a plain circle, byte-for-byte, unchanged.
   */
  hitCircle: Phaser.GameObjects.Shape;
}

/**
 * B4 (portrait wiring), 5 Sep 2026 — the one place every scene draws a
 * pilot avatar, real portrait or placeholder. Exported for the same
 * reason PATH_COLORS/pilotInitials already were (see this file's header):
 * every scene that used to draw its own "coloured circle with two
 * initials" now calls this instead of re-deriving it.
 *
 * Draws a real portrait (engine/portraits.ts) when the texture is already
 * in Phaser's cache — which, after Preloader (scenes/Preloader.ts) runs
 * once at boot, is every pilot portraits.ts knows about. Falls back to
 * the original GDD §12.2 placeholder — filled circle + initials — for
 * everyone else (Team One's own roster, an authored-but-unassigned 2nd/
 * 3rd Lance pilot): see portraits.ts's own header for why that's a
 * permanent case, not a temporary gap.
 *
 * The portrait image itself is square, not circle-masked: a Phaser
 * GeometryMask has to be repositioned by hand every frame to track
 * whatever it's masking, and Hub's NPCs move every frame. The stroked
 * hitCircle ring drawn on top hides the square corners well enough at
 * every size this is called at (16-46px radius) without that per-frame
 * tracking risk — not worth introducing into Hub.ts's already-large
 * per-frame NPC update loop for a handful of corner pixels.
 *
 * Hub Floor Portrait Revert, 6 Sep 2026 (Maxime: "notes, to remove
 * portrait on the pin of the ant and player. its kinda a waste if we dont
 * have enough for everyone"). Only Lance A's five pilots have finished
 * portrait art (October Art Plan) — everywhere else this already falls
 * back to the placeholder on its own via the hasPortrait check just
 * below, EXCEPT the Hub floor's roaming avatars, the one screen where a
 * handful of real faces sit right next to a majority of placeholders at
 * the same time (every other screen — Transporter Pad, Roster, Memorial,
 * Debrief — shows one pilot in isolation or a short curated list, where
 * that mix never reads as inconsistent). forcePlaceholder is Hub.ts's own
 * override for exactly that floor, not a change to the fallback logic
 * itself. Defaults false, so every existing call site (Transporter Pad,
 * RosterPanel, MemorialPanel, Debrief) is byte-for-byte unaffected — this
 * is a pure no-op for all of them.
 *
 * `shape`, 12 Sep 2026 (shape-by-Path pass) — same deal, defaults to
 * "circle" so every existing call site draws exactly what it always drew.
 * Hub.ts's own NPC loop is the only caller that passes PATH_SHAPES[path]
 * instead, and only ever combined with forcePlaceholder: true, so the
 * hasPortrait branch below never actually sees a non-circle shape today —
 * still built to do the right thing if that ever changes (a shaped ring
 * drawn on top of a square portrait image, alpha-0 fill, same as the
 * circle case always has).
 */
export function drawPilotAvatar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  pilotId: string,
  displayName: string,
  fallbackColor: number,
  stroke: { color: number; width: number; alpha: number } = { color: 0xffffff, width: 2, alpha: 0.25 },
  forcePlaceholder = false,
  shape: AvatarShape = "circle"
): PilotAvatar {
  const asset = portraitAssetFor(pilotId);
  const hasPortrait = !forcePlaceholder && !!asset && scene.textures.exists(asset.key);

  const hitCircle = drawAvatarShape(scene, shape, radius, fallbackColor, hasPortrait ? 0 : 1).setStrokeStyle(stroke.width, stroke.color, stroke.alpha);

  const children: Phaser.GameObjects.GameObject[] = [];
  if (hasPortrait) {
    const img = scene.add.image(0, 0, asset!.key).setDisplaySize(radius * 2, radius * 2);
    children.push(img, hitCircle); // image first (bottom), ring on top of it
  } else {
    const text = scene.add
      .text(0, 0, pilotInitials(displayName), { fontFamily: "monospace", fontSize: `${Math.max(9, Math.round(radius * 0.75))}px`, color: "#ffffff" })
      .setOrigin(0.5);
    children.push(hitCircle, text);
  }
  const container = scene.add.container(x, y, children);
  return { container, hitCircle };
}

/**
 * Split out of drawPilotAvatar itself, 12 Sep 2026 (shape-by-Path pass) —
 * one factory call per shape, every one of them sized and centred the
 * same way the original plain circle always was: a bounding box ~2*radius
 * square, centred on this container's own local (0,0). That's what keeps
 * swapping the shape from silently shifting anything else drawn around it
 * in the caller (the initials text, the stroke ring, the portrait image on
 * the one caller that could combine shape with a real portrait — none
 * does today, see drawPilotAvatar's own header). Points for the polygon-
 * based shapes (diamond, hexagon) are hand-computed to be symmetric about
 * (0,0) on both axes for the same reason — Phaser centres a Shape's
 * bounding box on its position, not its point-set's centroid, and for an
 * asymmetric point-set those two aren't the same spot.
 */
function drawAvatarShape(scene: Phaser.Scene, shape: AvatarShape, radius: number, fillColor: number, fillAlpha: number): Phaser.GameObjects.Shape {
  switch (shape) {
    case "square":
      return scene.add.rectangle(0, 0, radius * 2, radius * 2, fillColor, fillAlpha);
    case "diamond":
      return scene.add.polygon(0, 0, [0, -radius, radius, 0, 0, radius, -radius, 0], fillColor, fillAlpha);
    case "triangle":
      // Apex up, base corners at the same distance from centre as the
      // apex on both axes (bbox exactly [-radius, radius] x [-radius,
      // radius]) rather than a "true" equilateral triangle's own vertex
      // spacing — an equilateral triangle's bounding-box centre and its
      // centroid aren't the same point, and it's the bounding-box centre
      // Phaser actually centres on this shape's (0,0), not the centroid.
      return scene.add.triangle(0, 0, 0, -radius, -radius, radius, radius, radius, fillColor, fillAlpha);
    case "hexagon": {
      const points: number[] = [];
      for (let k = 0; k < 6; k++) {
        const angle = (Math.PI / 3) * k;
        points.push(radius * Math.cos(angle), radius * Math.sin(angle));
      }
      return scene.add.polygon(0, 0, points, fillColor, fillAlpha);
    }
    case "circle":
    default:
      return scene.add.circle(0, 0, radius, fillColor, fillAlpha);
  }
}

/**
 * Deploy-list geometry, and the floor under it (3 Sep 2026).
 *
 * THE BUG. This list used to space its cards at
 * `Math.floor((PAD_LIST_BOTTOM - PAD_LIST_TOP) / rosterSize)` with no
 * minimum, and set each card's height to `pitch - 14`. That is fine while
 * the roster is small. At Act I's five pilots the pitch is 86 and each card
 * gets 72px, which comfortably holds its three lines: the pad name at 14px,
 * the path/tier/mek line at 11px, and the loadout line at 10px.
 *
 * At sixteen pilots — three lances, which is simply what a mid-campaign
 * Warden Company IS — the pitch collapses to 27 and the card height to 13.
 * The three lines are positioned at `y - cardH/2 + 8`, `y - 2` and
 * `y + cardH/2 - 18`, which at cardH 13 puts them at y+1.5, y-2 and y-11.5:
 * three lines of 17px, 14px and 13px type stacked inside 13 pixels. They
 * drew through each other AND through the cards above and below. The screen
 * was not tight or ugly, it was unreadable — and it is the screen the player
 * passes through before every single mission.
 *
 * WHY IT SURVIVED THIS LONG. Nothing failed. The arithmetic is correct, the
 * types are right, every unit test passes, and no console error is emitted.
 * A fresh save is five pilots, so anyone opening this screen to check a
 * change sees it looking perfectly fine. It only breaks after the player
 * has earned two more lances — the worst possible time to find out.
 *
 * THE FLOOR. PAD_MIN_PITCH is the smallest spacing that still fits those
 * three lines with air between them. Once the roster needs more room than
 * the list has, the list pages instead of shrinking. Paging rather than
 * scrolling is a deliberate, reversible choice: the shop panel already
 * pages (scenes/shop/ShopPanel.ts) so the control is one a player has met,
 * and it needs no scrollbar, no wheel handling and no mask. Scrolling would
 * show the whole roster at once and is the better answer if this ever feels
 * cramped — flagged rather than assumed, since which one is right is a
 * design call, not an engineering one.
 */
const PAD_LIST_TOP = 118;
const PAD_LIST_BOTTOM = 552;
const PAD_MIN_PITCH = 70; // cardH 56 — the 51px three-line block plus margin
/**
 * Vertical strip the pager reserves out of the list when it is showing.
 * Reserved unconditionally when computing rows-per-page (so the row count
 * cannot depend on whether paging is on, which would be circular), but only
 * actually subtracted from the list's height when a pager is drawn — so an
 * unpaginated five-pilot roster keeps every pixel it had before.
 *
 * 30 rather than the pager's own 24px button height: BEAM DOWN's top edge
 * is at 568 (centre 590, 44 tall), and the first version of this put the
 * pager's counter text at 566, running it straight under that button. The
 * fix for a layout collision that leaves six pixels of margin is not a fix.
 */
const PAD_PAGER_ROW_H = 30;

export class TransporterPad extends Phaser.Scene {
  private missionId!: string;
  private missionDef!: CampaignMission;
  private state!: CampaignState;

  // Squad-selection state. When showPicker is false, rosterIds/selected
  // both just mirror the campaign's own active roster (see the 25 Aug 2026
  // fix note below on why that's activePilotIds and not the mission's
  // static playerPilotIds) — so currentDeployIds() always returns the
  // right thing without any caller needing to branch on showPicker itself.
  private rosterIds: string[] = [];
  private selected: Set<string> = new Set();
  private showPicker = false;
  private capWarning = false;
  // Set in create() from deployCapForMission(this.missionId) — Act I gets
  // ACT1_DEPLOY_CAP, Act II gets ACT2_DEPLOY_CAP, Act III gets
  // ACT3_DEPLOY_CAP. See that function's own comment above.
  private deployCap = ACT1_DEPLOY_CAP;

  private squadLayer!: Phaser.GameObjects.Container;
  /** Which page of the deploy list is showing. Only meaningful once the roster outgrows one page — see PAD_MIN_PITCH. */
  private padPage = 0;
  private launchLayer!: Phaser.GameObjects.Container;
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // Plain scene class, no competing scene-wide hover system — one shared
  // instance covers the header link, every pad row, the pager, the lance
  // quick-pick, and BEAM DOWN.
  private hoverTip!: HoverTip;

  constructor() {
    super("TransporterPad");
  }

  init(data: { missionId: string }) {
    this.missionId = data.missionId;
    this.missionDef = MISSIONS_BY_ID[data.missionId] ?? Object.values(MISSIONS_BY_ID)[0];
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c0f12");
    this.hoverTip = new HoverTip(this);

    // State loads BEFORE the header now (5 Sep 2026, B6) — the header reads
    // the company's name out of it, so the old order (header first, state at
    // the bottom of this block) would have drawn against an unset field.
    // Moved rather than duplicated: this is the same single load the rest of
    // create() already depended on, just hoisted above the first thing that
    // needs it. See the fallback reasoning in its original comment, kept
    // verbatim below.
    //
    // Prefer the live, campaign-persistent copy of each pilot/mek (gear
    // tier purchases, mek secondary specializations, recruit-phase
    // additions) when a save exists; fall back to a fresh Warden state
    // otherwise. Same fallback shape engine/campaignState.ts documents for
    // its own CampaignPilotEntry.
    this.state = loadCampaignState() ?? createWardenCampaignState();

    // B6 — was the hardcoded literal "TRANSPORTER PAD — WARDEN COMPANY".
    // Uppercased to match this header's existing visual register whatever
    // the player typed, and it quietly fixes a real pre-existing wrong-side
    // bug on the way past: a House Amaranth campaign has always been shown
    // "WARDEN COMPANY" here, because the string never knew which side it was.
    this.add
      .text(480, 44, `TRANSPORTER PAD — ${companyNameOf(this.state).toUpperCase()}`, { fontFamily: "monospace", fontSize: "30px", color: "#e8e2d4" })
      .setOrigin(0.5);
    this.add
      .text(480, 72, `deploying to: ${this.missionDef.displayName}`, { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    // Ship audit, 16 Sep 2026 (§2) — this screen said where the squad was
    // going and never what for. The objective text (data/missionBriefing.ts's
    // describeObjective, the same line the CO's `brief` reads out aboard
    // ship) now sits under the destination, so BEAM DOWN is never a blind
    // click. Kept to the 40px band above PAD_LIST_TOP; the longest variant
    // (hold_zone) wraps to two 10px lines and still clears the first card.
    this.add
      .text(480, 88, `OBJECTIVE — ${describeObjective(this.missionDef)}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e0b23c",
        align: "center",
        wordWrap: { width: 860 },
      })
      .setOrigin(0.5, 0);

    // Ship audit, 16 Sep 2026 (§2) — the manual, reachable from here too,
    // as an overlay (launch + pause, see Battle.ts's requestHelp for why not
    // scene.start: this scene needs its missionId to rebuild).
    const helpLayer = this.add.container(0, 0);
    makeShopButton(this, helpLayer, 125, 20, 200, 26, "HOW TO PLAY", true, () => {
      this.hoverTip.hide();
      this.scene.pause();
      this.scene.launch("Codex", { returnScene: "TransporterPad", launched: true });
      this.scene.bringToTop("Codex");
    }, ["How To Play", "", ...wrapTipText("Opens the rules manual over this screen. BACK brings you straight back here, nothing lost.", 42)], this.hoverTip);

    const missionSelectTip = [
      "< Mission Select",
      "",
      ...wrapTipText(
        "Bails out to the mission list. Nothing on this screen is saved until BEAM DOWN — any weapon-branch cycle or Frame panel change you've made here is lost if you leave this way.",
        42
      ),
    ];
    this.add
      .rectangle(835, 20, 200, 26, 0x1a2028)
      .setStrokeStyle(1, 0x3a4552)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MapSelect"))
      .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(missionSelectTip, pointer.x, pointer.y))
      .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(missionSelectTip, pointer.x, pointer.y))
      .on("pointerout", () => this.hoverTip.hide());
    this.add.text(835, 20, "< mission select", { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6" }).setOrigin(0.5);

    // (The campaign state load that used to sit here was hoisted to the top
    // of create() on 5 Sep 2026 — see its comment there for why.)

    // `&& !entry.social?.refusesDeployment` added 2 Sep 2026 — the Insult
    // Tier-3 standoff (Praise/Insult/Apology Proposal §3a, Maxime: "wont
    // fly with you"). This is the immediate half of that lock: the flag
    // flips the instant Tier 3 is crossed (scenes/Hub.ts's insultNpc), no
    // CO conversation required to START being blocked, only to resolve it
    // (see engine/campaignState.ts's PilotStatus "reassigned" for the
    // permanent half, set only via a deliberate CO chat). A pilot who's
    // reassigned already fails the `status === "active"` check on its own;
    // this covers the window between the standoff starting and the player
    // actually going to ask the CO about it.
    const activePilotIds = Object.entries(this.state.pilots)
      .filter(([, entry]) => entry.status === "active" && !entry.social?.refusesDeployment)
      .map(([id]) => id);

    // ---- The actual behavior fork this whole pass is about -------------
    // At or under the cap: nothing to CHOOSE (no picker UI), but this is
    // still the campaign's own active roster, not the mission's static
    // playerPilotIds — those are two different lists the instant a named
    // pilot is permanently lost or a recruit joins, even while the total
    // count stays at or under the cap.
    //
    // Fix, 25 Aug 2026 (Maxime: "I need a new munties, mine died and I got
    // no replacement" — photographed the actual bug: Lask's pad still
    // showing, full brightness, after she was permanently lost, with BEAM
    // DOWN blocked and no sign of the free replacement Munti the Debrief
    // screen's own Munti guarantee had already generated). Root cause: this
    // branch used to read `this.missionDef.playerPilotIds` — every Act I
    // mission's hardcoded five-Warden list, which never changes no matter
    // what happens to the campaign roster. So a lost pilot always kept
    // showing up here (this loop draws whatever pilot id it's handed,
    // never checking CampaignPilotEntry.status), and any replacement
    // recruit was invisible — not deployable, not even on screen — unless
    // the active roster happened to climb OVER the cap and force picker
    // mode on, which is not something a player can infer from anything
    // this screen shows them. Fixed by using `activePilotIds` here too:
    // in the untouched common case (no losses, no recruits) it's the exact
    // same five ids in the exact same order as WARDEN_ROSTER_IDS (both
    // ultimately derive from WARDEN_PILOTS' own array order), so nothing
    // changes for a player who's never lost anyone — this only changes
    // behavior once the roster composition actually has, which is exactly
    // the case it was silently getting wrong before.
    this.deployCap = deployCapForMission(this.missionId);
    this.showPicker = activePilotIds.length > this.deployCap;

    if (this.showPicker) {
      this.rosterIds = activePilotIds;
      // Default selection: the first `deployCap` active pilots in roster
      // order. For a fresh Act I campaign that's the original five
      // Wardens (Munti included), so the gate starts cleared and a player
      // who never touches the picker still deploys exactly the squad they
      // always did. Bench slots (recruits, or the Second Lance once it
      // joins) start excluded, not auto-included — swapping a proven pilot
      // for someone new is the player's call to make, not a default this
      // screen makes for them.
      this.selected = new Set(activePilotIds.slice(0, this.deployCap));
      this.drawLanceQuickPick();
      this.add
        .text(
          480,
          100,
          `select up to ${this.deployCap} — click a pad to toggle. bench pilots earn no personal points while sitting out.`,
          { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }
        )
        .setOrigin(0.5);
    } else {
      this.rosterIds = activePilotIds;
      this.selected = new Set(this.rosterIds);
    }

    this.squadLayer = this.add.container(0, 0);
    this.launchLayer = this.add.container(0, 0);

    this.redrawSquadList();
    this.redrawLaunchSection();
  }

  /** The ids that would actually beam down right now. */
  private currentDeployIds(): string[] {
    return this.showPicker ? this.rosterIds.filter((id) => this.selected.has(id)) : this.rosterIds;
  }

  /**
   * Weapon Branch Point System (27 Aug 2026) — cycles pilotId's equipped
   * branch through: none -> owned[0] -> owned[1] -> ... -> none. Mutates
   * this.state in place via equipWeaponBranch (same in-memory-only
   * convention as toggle()/ShopPanel above — persisted whenever this
   * screen's own launch/return action next calls saveCampaignState, not
   * here) and redraws so the click is felt immediately.
   */
  private cycleWeaponBranch(pilotId: string): void {
    const entry = this.state.pilots[pilotId];
    if (!entry) return;
    const owned = (entry.pilot.ownedWeaponBranches ?? []) as WeaponBranchId[];
    if (owned.length === 0) return;
    // Frame Systems Layer, second mount (6 Sep 2026): cycling one slot only
    // makes sense on a one-mount frame. From tier C the click opens the
    // Frame panel instead — two mounts need a real picker, not a wheel.
    if (mountsFor(entry.pilot) > 1) {
      this.openFramePanel(pilotId);
      return;
    }
    const current = equippedWeaponBranchesOf(entry.pilot)[0];
    const currentIdx = current ? owned.indexOf(current) : -1;
    const next: WeaponBranchId | null = currentIdx + 1 < owned.length ? owned[currentIdx + 1] : null;
    equipWeaponBranch(this.state, pilotId, next);
    this.redrawSquadList();
  }

  /** The per-pilot Frame panel (scenes/shop/FramePanel.ts) — mounts, systems, refit — opened from the pilot's own row. Same in-memory-only convention as cycleWeaponBranch: persisted by this screen's own launch/return save. */
  private openFramePanel(pilotId: string): void {
    showFrameOverlay(this, this.state, pilotId, {
      depth: 50,
      onChange: () => this.redrawSquadList(),
    });
  }

  private toggle(pilotId: string) {
    if (this.selected.has(pilotId)) {
      this.selected.delete(pilotId);
      this.capWarning = false;
    } else if (this.selected.size >= this.deployCap) {
      // Over the cap is blocked, not silently ignored — redrawLaunchSection
      // below surfaces this as the reason line until the next successful
      // toggle clears it.
      this.capWarning = true;
    } else {
      this.selected.add(pilotId);
      this.capWarning = false;
    }
    this.redrawSquadList();
    this.redrawLaunchSection();
  }

  /**
   * The deploy list's page controls. Drawn into squadLayer so it is cleared
   * and rebuilt with the list itself, and sits between the last card
   * (PAD_LIST_BOTTOM) and BEAM DOWN at y=590.
   *
   * Selection is stored by pilot id, not by row, so paging never disturbs
   * who is deployed — a pilot toggled in on page 1 stays in while the
   * player reads page 3, and the BEAM DOWN gate keeps counting them.
   */
  private drawSquadPager(pageCount: number, rowsPerPage: number, cardLeft: number, cardW: number, usableBottom: number) {
    const y = usableBottom + PAD_PAGER_ROW_H / 2;
    const mk = (x: number, label: string, enabled: boolean, onClick: () => void, tooltip: string[]) => {
      const btn = this.add
        .rectangle(x, y, 90, 24, enabled ? 0x2e5c7a : 0x1a2028, 1)
        .setStrokeStyle(1, enabled ? 0x4a7a9a : 0x3a4552);
      this.squadLayer.add(btn);
      this.squadLayer.add(
        this.add
          .text(x, y, label, { fontFamily: "monospace", fontSize: "11px", color: enabled ? "#ffffff" : "#5a6472" })
          .setOrigin(0.5),
      );
      // Hover wired regardless of enabled state — "why can't I click this"
      // (already on the first/last page) is exactly the moment a tooltip
      // earns its keep, same reasoning as every disabled control this pass
      // has covered elsewhere.
      btn
        .setInteractive({ useHandCursor: enabled })
        .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(tooltip, pointer.x, pointer.y))
        .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(tooltip, pointer.x, pointer.y))
        .on("pointerout", () => this.hoverTip.hide());
      if (enabled) btn.on("pointerdown", onClick);
    };
    mk(
      cardLeft + 80,
      "< PREV",
      this.padPage > 0,
      () => {
        this.padPage -= 1;
        this.redrawSquadList();
      },
      ["Previous Page", "", ...wrapTipText("Shows the previous page of the roster. Selections aren't affected by which page is showing.", 42)]
    );
    mk(
      cardLeft + cardW - 80,
      "NEXT >",
      this.padPage < pageCount - 1,
      () => {
        this.padPage += 1;
        this.redrawSquadList();
      },
      ["Next Page", "", ...wrapTipText("Shows the next page of the roster. Selections aren't affected by which page is showing.", 42)]
    );
    // The count of who is deployed belongs here, not only under BEAM DOWN:
    // once the roster pages, the player can be looking at a page where none
    // of their picks are visible, and "5/5 selected" three hundred pixels
    // away is not an answer to "did I already pick someone."
    const first = this.padPage * rowsPerPage + 1;
    const last = Math.min(this.rosterIds.length, (this.padPage + 1) * rowsPerPage);
    this.squadLayer.add(
      this.add
        .text(480, y, `${first}–${last} of ${this.rosterIds.length}  ·  page ${this.padPage + 1}/${pageCount}  ·  ${this.currentDeployIds().length} deploying`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#6b7a8a",
        })
        .setOrigin(0.5),
    );
  }

  // ---- Deploying squad --------------------------------------------------
  private redrawSquadList() {
    this.squadLayer.removeAll(true);

    const listTop = PAD_LIST_TOP;
    const listBottom = PAD_LIST_BOTTOM;

    // PAGINATION, 3 Sep 2026 — see PAD_MIN_PITCH's own header for the bug.
    // Short version: pitch used to be (available height / roster size) with
    // no floor, so a 16-pilot roster got 27px per card and the three text
    // lines drew straight through each other and through their neighbours.
    // A roster that fits still takes exactly the old path, pager and all
    // absent, so a five-pilot Act I deploy screen is unchanged.
    const rowsPerPage = Math.max(1, Math.floor((listBottom - PAD_PAGER_ROW_H - listTop) / PAD_MIN_PITCH));
    const pageCount = Math.max(1, Math.ceil(this.rosterIds.length / rowsPerPage));
    this.padPage = Math.min(Math.max(0, this.padPage), pageCount - 1);
    const paged = pageCount > 1;
    const pageIds = paged
      ? this.rosterIds.slice(this.padPage * rowsPerPage, this.padPage * rowsPerPage + rowsPerPage)
      : this.rosterIds;
    const indexOffset = paged ? this.padPage * rowsPerPage : 0;

    // Only a paged list gives up the pager's strip; an unpaginated one uses
    // the full height exactly as it always did.
    const usableBottom = paged ? listBottom - PAD_PAGER_ROW_H : listBottom;
    const pitch = Math.min(92, Math.floor((usableBottom - listTop) / Math.max(1, pageIds.length)));
    const cardH = Math.min(74, pitch - 14);
    const cardW = 860;
    // The three text lines used to be anchored three DIFFERENT ways — the
    // name from the card's top, the path/tier line from its centre, the
    // loadout line from its bottom. At the old 72px card height that
    // happened to look fine, which is the only reason it survived. It means
    // the gaps between the lines change size as cardH changes, and at any
    // smaller card they close and then cross. Anchoring all three from one
    // origin with fixed spacing makes the block a fixed 51px tall that
    // either fits or doesn't, instead of one that silently degrades — and
    // PAD_MIN_PITCH guarantees it fits. Centred in whatever height the card
    // has, so a roomy card still looks centred rather than top-heavy.
    const LINE_BLOCK_H = 51;
    const lineTop = -cardH / 2 + Math.max(4, (cardH - LINE_BLOCK_H) / 2);
    const NAME_DY = lineTop;
    const INFO_DY = lineTop + 18;
    const TRACK_DY = lineTop + 34;
    const cardLeft = 480 - cardW / 2;
    const padCenterX = cardLeft + 60;

    if (paged) this.drawSquadPager(pageCount, rowsPerPage, cardLeft, cardW, usableBottom);

    pageIds.forEach((pilotId, row) => {
      // The pad NUMBER is the pilot's place in the whole roster, not on this
      // page — "PAD 07" has to stay PAD 07 on page 2, or the number stops
      // meaning anything the moment the list is long enough to paginate.
      const i = indexOffset + row;
      const entry = this.state.pilots[pilotId];
      const pilot: PilotRecord | undefined = entry?.pilot ?? findPilot(pilotId);
      if (!pilot) return; // defensive — shouldn't happen for a well-formed roster
      const mek: MekArchetype | undefined = this.state.meks[pilot.mekId] ?? findMek(pilot.mekId);
      const path = UNIT_ARCHETYPES[pilot.archetypeId]?.path;
      const y = listTop + pitch * row + pitch / 2;

      // Only meaningful when showPicker — otherwise everyone's "in," same
      // as before this pass, and dimming/toggling never applies.
      const isIn = !this.showPicker || this.selected.has(pilotId);
      const rowAlpha = isIn ? 1 : 0.55;
      const ringColor = this.showPicker && !isIn ? 0x3a4552 : 0x4a7a9a;

      const card = this.add
        .rectangle(480, y, cardW, cardH, 0x1a2028, 1)
        .setStrokeStyle(1, isIn ? 0x3a4552 : 0x2a323c)
        .setAlpha(rowAlpha);
      this.squadLayer.add(card);
      if (this.showPicker) {
        const padTip = [
          `PAD ${String(i + 1).padStart(2, "0")} — ${pilot.displayName}`,
          "",
          ...wrapTipText(isIn ? "In the deploying squad. Click to bench this pilot." : "On the bench. Click to add to the deploying squad, if there's room under the cap.", 42),
        ];
        card
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.toggle(pilotId))
          .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(padTip, pointer.x, pointer.y))
          .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(padTip, pointer.x, pointer.y))
          .on("pointerout", () => this.hoverTip.hide());
      }

      // Pad glyph: a stroked ring with four short tick marks (a landing
      // platform, not a chair) plus the placeholder portrait standing on
      // it — everything here is Phaser Graphics primitives, no image
      // assets (GDD §12.2). One Graphics object per row (not shared across
      // the whole list) so it can be individually alpha-dimmed for a
      // toggled-off pilot without touching every other row's ring.
      const gfx = this.add.graphics().setAlpha(rowAlpha);
      this.squadLayer.add(gfx);
      const ringR = Math.min(30, cardH / 2 - 4);
      gfx.lineStyle(2, ringColor, 1);
      gfx.strokeCircle(padCenterX, y, ringR);
      gfx.lineStyle(1, 0x2e5c7a, 0.8);
      gfx.lineBetween(padCenterX, y - ringR - 2, padCenterX, y - ringR - 7);
      gfx.lineBetween(padCenterX, y + ringR + 2, padCenterX, y + ringR + 7);
      gfx.lineBetween(padCenterX - ringR - 2, y, padCenterX - ringR - 7, y);
      gfx.lineBetween(padCenterX + ringR + 2, y, padCenterX + ringR + 7, y);

      // B4, 5 Sep 2026 — real portrait when one exists, same placeholder
      // circle+initials otherwise (drawPilotAvatar, this file). Used to be
      // drawn straight into `gfx` above (fillCircle/strokeCircle) since it
      // was Graphics-only either way; now a real portrait needs an Image,
      // so it's its own Container instead, alpha-dimmed the same way every
      // other row element already is.
      const portraitR = ringR * 0.62;
      const avatar = drawPilotAvatar(this, padCenterX, y, portraitR, pilotId, pilot.displayName, path ? PATH_COLORS[path] : 0x555555, {
        color: 0xffffff,
        width: 1.5,
        alpha: 0.9,
      });
      avatar.container.setAlpha(rowAlpha);
      this.squadLayer.add(avatar.container);

      const textX = padCenterX + ringR + 30;
      // [X]/[ ] prefix carries the same "in the deploying squad" signal as
      // the ring color, but as text — never color-only — so it reads in a
      // screenshot or for anyone not distinguishing the two blues at a
      // glance. Blank prefix (unchanged layout) when there's no picker.
      const tag = this.showPicker ? (isIn ? "[X] " : "[ ] ") : "";
      const nameText = this.add
        .text(textX, y + NAME_DY, `${tag}PAD ${String(i + 1).padStart(2, "0")} — ${pilot.displayName}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#e8e2d4",
        })
        .setAlpha(rowAlpha);
      this.squadLayer.add(nameText);

      const pathLabel = path ? capitalize(path) : "Unknown";
      const infoText = this.add
        .text(textX, y + INFO_DY, `${pathLabel} · Tier ${pilot.tier}${mek ? ` · ${mek.displayName}` : ""}`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#8a97a6",
        })
        .setAlpha(rowAlpha);
      this.squadLayer.add(infoText);

      if (mek) {
        const trackBase = mek.secondary
          ? `Primary: ${capitalize(mek.primary)}  ·  Secondary: ${capitalize(mek.secondary)}`
          : `Primary: ${capitalize(mek.primary)}`;
        // Weapon Branch Point System (27 Aug 2026) — appended onto the same
        // line rather than a new one, since this card's height is already
        // squeezed by the roster-size-driven pitch above. Only shown/
        // clickable once a pilot owns at least one branch — nothing to
        // cycle through otherwise. Clicking cycles equipped -> next owned
        // branch -> ... -> none (default weapon) -> first owned again.
        const owned = (pilot.ownedWeaponBranches ?? []) as WeaponBranchId[];
        // Second mount (6 Sep 2026): every live branch, joined — "A + B" from
        // tier C. equippedWeaponBranchesOf is the one read path.
        const equippedIds = equippedWeaponBranchesOf(pilot);
        const weaponLabel = equippedIds.length ? equippedIds.map((id) => WEAPON_BRANCHES[id]?.displayName ?? id).join(" + ") : "None (default)";
        const trackLine = owned.length > 0 ? `${trackBase}  ·  Weapon: ${weaponLabel}` : trackBase;
        const trackText = this.add
          .text(textX, y + TRACK_DY, trackLine, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
          .setAlpha(rowAlpha);
        this.squadLayer.add(trackText);
        if (owned.length > 0) {
          const weaponTip = [
            "Cycle Weapon",
            "",
            ...wrapTipText(
              mountsFor(pilot) > 1
                ? "Opens the full Frame panel instead — a two-mount frame needs a real picker, not a wheel."
                : "Cycles this pilot's equipped weapon branch: none → first owned → next owned → ... → none again.",
              42
            ),
          ];
          trackText
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.cycleWeaponBranch(pilotId))
            .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(weaponTip, pointer.x, pointer.y))
            .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(weaponTip, pointer.x, pointer.y))
            .on("pointerout", () => this.hoverTip.hide());
        }
        // Frame Systems Layer (6 Sep 2026) — the door into the Frame panel
        // from the pad, appended after the track line the same way the
        // weapon label itself was. Only for a real campaign entry (a
        // static-registry fallback pilot has no personal points to spend).
        if (entry) {
          const frameMek = this.state.meks[pilot.mekId];
          const frameLink = this.add
            .text(textX + trackText.width + 10, y + TRACK_DY, `[ frame · Draw ${frameDrawUsed(pilot, frameMek)}/${drawCapacityFor(pilot)} ]`, {
              fontFamily: "monospace",
              fontSize: "10px",
              color: "#7dd3fc",
            })
            .setAlpha(rowAlpha)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.openFramePanel(pilotId))
            .on("pointerover", (pointer: Phaser.Input.Pointer) =>
              this.hoverTip.show(
                ["Frame Panel", "", ...wrapTipText("Mounts, systems, and refit for this pilot. Every change applies immediately — nothing here needs a separate save.", 42)],
                pointer.x,
                pointer.y
              )
            )
            .on("pointermove", (pointer: Phaser.Input.Pointer) =>
              this.hoverTip.show(
                ["Frame Panel", "", ...wrapTipText("Mounts, systems, and refit for this pilot. Every change applies immediately — nothing here needs a separate save.", 42)],
                pointer.x,
                pointer.y
              )
            )
            .on("pointerout", () => this.hoverTip.hide());
          this.squadLayer.add(frameLink);
        }
      }

      // Personal points readout — engine/campaignEconomy.ts's actual
      // payoff for rotation, put right on the card next to the info a
      // player already reads to judge a pilot (path/tier/mek), not tucked
      // behind a debrief/shop screen that doesn't exist yet (out of scope
      // this pass). CampaignPilotEntry.personalPoints
      // (engine/campaignState.ts) — 0 for a pilot with no campaign entry at
      // all (a static-only fallback via findPilot above), same convention
      // as everywhere else personalPoints is read.
      const points = entry?.personalPoints ?? 0;
      const ptsText = this.add
        .text(cardLeft + cardW - 20, y - 8, `${points} pts`, { fontFamily: "monospace", fontSize: "13px", color: "#facc15" })
        .setOrigin(1, 0.5)
        .setAlpha(rowAlpha);
      this.squadLayer.add(ptsText);
      const ptsLabel = this.add
        .text(cardLeft + cardW - 20, y + 10, "PERSONAL", { fontFamily: "monospace", fontSize: "8px", color: "#6b7a8a" })
        .setOrigin(1, 0.5)
        .setAlpha(rowAlpha);
      this.squadLayer.add(ptsLabel);
    });
  }

  // ---- The Munti deploy gate, wired in for real, kept live against the
  // current selection --------------------------------------------------
  //
  // canLaunchMission was only ever "correct but unreachable" before this
  // pass (see its own doc comment in engine/campaignState.ts) because Act
  // I's deploy count always equaled its full roster count. The picker
  // above makes it genuinely reachable: canLaunchMission is re-run against
  // currentDeployIds() every single toggle, so the gate reacts immediately
  // — greying BEAM DOWN out the instant the sole Munti is toggled off, and
  // clearing it the instant one is toggled back in.
  /**
   * B2 — fill the deploy slots from a lance (Maxime's call: "lance
   * pre-selects, but you can override"). Deliberately a CONVENIENCE, not a
   * constraint: it sets the selection and then gets out of the way, so
   * every pad stays individually toggleable exactly as before and nothing
   * about mission balance or the deploy gate changes. A player who never
   * touches these buttons gets precisely the old behavior.
   *
   * Top-left, clear of the pad list which starts around y=130 — see this
   * scene's own header layout notes.
   */
  private drawLanceQuickPick() {
    this.add.text(20, 20, "fill from:", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0, 0.5);
    let x = 84;
    for (const lance of activeLanceIds(this.state)) {
      const members = lanceRoster(this.state, lance);
      const label = this.add
        .text(x, 20, `[ ${lanceDisplayName(lance)} ]`, { fontFamily: "monospace", fontSize: "10px", color: members.length ? "#c8b273" : "#3a4552" })
        .setOrigin(0, 0.5);
      if (members.length) {
        const lanceTip = [
          `Fill from ${lanceDisplayName(lance)}`,
          "",
          ...wrapTipText(`Sets the deploy squad to ${lanceDisplayName(lance)}'s current roster (capped at ${this.deployCap}). You can still toggle individual pads afterward.`, 42),
        ];
        label.setInteractive({ useHandCursor: true });
        label.on("pointerdown", () => {
          // Cap at deployCap rather than assuming the lance fits: a lance is
          // capped at MAX_LANCE_SIZE, which matches deployCap today, but this
          // screen shouldn't silently break if either ever changes.
          this.selected = new Set(members.slice(0, this.deployCap).map((e) => e.pilot.id));
          this.redrawSquadList();
          this.redrawLaunchSection();
        });
        label.on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(lanceTip, pointer.x, pointer.y));
        label.on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(lanceTip, pointer.x, pointer.y));
        label.on("pointerout", () => this.hoverTip.hide());
      }
      x += label.width + 8;
    }
  }

  private redrawLaunchSection() {
    this.launchLayer.removeAll(true);

    const deployIds = this.currentDeployIds();
    const launchCheck = canLaunchMission(deployIds, this.state);

    const btnY = 590;
    const btn = this.add
      .rectangle(480, btnY, 260, 44, launchCheck.ok ? 0x2e5c7a : 0x1a2028, 1)
      .setStrokeStyle(1, launchCheck.ok ? 0x4a7a9a : 0x3a4552);
    this.launchLayer.add(btn);
    const label = this.add
      .text(480, btnY, "BEAM DOWN", { fontFamily: "monospace", fontSize: "15px", color: launchCheck.ok ? "#ffffff" : "#5a6472" })
      .setOrigin(0.5);
    this.launchLayer.add(label);

    if (launchCheck.ok) {
      // No separate disabled-state tooltip below — the always-visible
      // reasonText under this button already states the live, specific
      // block reason (cap warning or launchCheck.reason) plainly; a static
      // hover tooltip here would just duplicate it. Same "already
      // self-explanatory via an always-visible line" exemption this pass's
      // own doc already uses for Hub.ts's Rec Room dismiss backgrounds.
      const launchTip = [
        "Beam Down",
        "",
        ...wrapTipText(
          "Launches the mission with this squad. Starts the mission's own attempt clock the instant you click, saved immediately — there's no resuming a mission left mid-fight.",
          42
        ),
      ];
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        btn.setFillStyle(0x3a6f92, 1);
        this.hoverTip.show(launchTip, pointer.x, pointer.y);
      });
      btn.on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(launchTip, pointer.x, pointer.y));
      btn.on("pointerout", () => {
        btn.setFillStyle(0x2e5c7a, 1);
        this.hoverTip.hide();
      });
      // Threads the player's real selection through — see scenes/Battle.ts's
      // resolveDeployRoster() for how selectedPilotIds becomes the actual
      // DeployRosterEntry[] Mission deploys.
      //
      // Mission real-time clock (25 Aug 2026) — this is the one moment a
      // real playthrough actually starts a mission attempt, so it's the one
      // place that starts the clock: stamps activeMissionAttempt with this
      // exact instant and saves immediately, not deferred to some later
      // "return to base" click the way earnings/roster changes are
      // elsewhere in this codebase — if the clock isn't on disk before the
      // Battle scene even loads, closing the tab one second later would
      // lose it same as before this pass existed. Always overwrites
      // whatever was there: there's no mid-mission resume in this engine
      // (a previous, abandoned attempt already lost whatever it was
      // tracking the moment the player left it), so a fresh BEAM DOWN — on
      // this mission or any other — is always a genuinely fresh attempt.
      btn.on("pointerdown", () => {
        this.state.activeMissionAttempt = { missionId: this.missionId, startedAt: Date.now() };
        saveCampaignState(this.state);
        this.scene.start("Battle", { missionId: this.missionId, selectedPilotIds: deployIds });
      });
    }

    let reason: string;
    let color: string;
    if (this.capWarning) {
      reason = `deploy cap reached — this mission allows at most ${this.deployCap} at once. Deselect a pilot to add another.`;
      color = "#ef4444";
    } else if (launchCheck.ok) {
      reason = this.showPicker ? `${deployIds.length}/${this.deployCap} selected — squad cleared for deployment` : "squad cleared for deployment";
      color = "#6b7a8a";
    } else {
      reason = launchCheck.reason ?? "deploy blocked";
      color = "#ef4444";
    }

    const reasonText = this.add
      .text(480, btnY + 32, reason, {
        fontFamily: "monospace",
        fontSize: "10px",
        color,
        align: "center",
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5, 0);
    this.launchLayer.add(reasonText);
  }
}
