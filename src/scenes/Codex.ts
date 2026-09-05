// src/scenes/Codex.ts
// Forgotten Plans Audit, 1 Sep 2026 — the Onboarding Tutorial's one missing
// piece (a pause-menu link to HOW_TO_PLAY.html) turned, on Maxime's own
// call, into something bigger: an in-game field-manual codex, Mass Effect
// styled — a category list on the left, a detail pane on the right —
// instead of a link out to the standalone HTML page. "Full visual parity,"
// per Maxime's own scope pick ("2. we are going full ham plus ultra on the
// game"): every section below recreates the manual's actual visual content
// (terrain color swatches, the four unit-shape icons — pulled from Battle.
// ts's own drawUnit geometry, not redrawn from guesswork, so a Meeps here
// looks exactly like a Meeps on the real board — the class-triangle matrix,
// tag chips) with real Phaser Graphics, not just its words.
//
// HOW_TO_PLAY.html itself is untouched and still exists standalone — this
// is a second, in-game presentation of the same source content, not a
// replacement for it. That file's own footer already carries the caveat
// that matters here too: if a number ever disagrees between the two, this
// codex's own data below (typed straight from the same section content)
// is what should get fixed to match the live ruleset, not treated as a
// second source of truth.
//
// Reachable from both MainMenu (title screen) and every in-play MenuOverlay
// (pause menu) — same `returnScene` init-data pattern Options.ts already
// uses, so BACK lands wherever this was actually opened from, not a
// hardcoded MainMenu.
//
// Paged, not scrolled, for the three content-heavy sections (Terrain,
// Abilities, Missions) — matches this codebase's own established shop-panel
// convention (ShopPanel.ts's own header comment: "same page-by-pixel-budget
// pagination... see that file's own history for why paged beats scrolled
// here") rather than inventing a new scroll idiom for one screen.
import Phaser from "phaser";
import { makeShopButton } from "./shop/ShopPanel";
import type { CampaignState, CampaignPilotEntry } from "../engine/campaignState";
import { highestWardenMissionIndexReached } from "../data/missionBriefing";
import {
  PERSONNEL,
  personnelStatusText,
  BESTIARY,
  isBestiaryEntryUnlocked,
  WORLD,
  latestUnlockedWorldRevision,
  SYSTEMS,
  RANKS,
  GLOSSARY,
  type LivePilotStatus,
} from "../data/codex";

// ---- Palette — the game's existing UI chrome colors (panel/card/border/
// text) plus HOW_TO_PLAY.html's own semantic colors for anything that's
// actually coded game data (go/danger/info/endurance/vitality), so this
// codex reads as the same game, not a re-skin. ------------------------
const PAL = {
  bg: 0x0a0d10,
  panel: 0x141a20,
  panelBorder: 0x3a4552,
  cardBg: 0x1a2028,
  cardBorder: 0x2a323b,
  cardBorderLight: 0x3a4552,
  text: "#e8e2d4",
  textMuted: "#8a97a6",
  textFaint: "#5a6472",
  accent: "#e0b23c",
  accentHex: 0xe0b23c,
  go: "#4ade80",
  goHex: 0x4ade80,
  danger: "#ef4444",
  dangerHex: 0xef4444,
  info: "#22d3ee",
  infoHex: 0x22d3ee,
  endurance: "#60a5fa",
  enduranceHex: 0x60a5fa,
  vitality: "#f87171",
  vitalityHex: 0xf87171,
  playerBlue: 0x2e5c7a,
  hostileTan: 0x7a6a55,
  bloomBlob: 0x7a2430,
};

type UnitIconKind = "meeps" | "tank" | "reeps" | "munti";

// Exact geometry pulled from Battle.ts's drawUnit (the real board-render
// code) — not a redraw of the HTML manual's own separate SVG icons, so this
// codex's icons match what a player actually sees mid-mission.
function drawUnitIcon(g: Phaser.GameObjects.Graphics, kind: UnitIconKind, cx: number, cy: number, r: number, color: number) {
  g.fillStyle(color, 1);
  g.lineStyle(1.5, 0xffffff, 0.95);
  if (kind === "meeps") {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy + r);
    g.lineTo(cx - r, cy + r);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else if (kind === "tank") {
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.strokeRect(cx - r, cy - r, r * 2, r * 2);
  } else if (kind === "reeps") {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r, cy);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else {
    g.fillCircle(cx, cy, r);
    g.strokeCircle(cx, cy, r);
    g.lineStyle(2, 0xffffff, 0.9);
    g.lineBetween(cx - r, cy, cx + r, cy);
  }
}

// ---- Static content, transcribed from HOW_TO_PLAY.html's own 9 sections
// (SEC. 01-09) — same words, same numbers, restructured for a two-pane
// codex instead of a scrolled single page. -----------------------------

interface ControlRow {
  key: string;
  desc: string;
  chip?: "go" | "danger" | "info";
}
const CONTROLS: ControlRow[] = [
  { key: "Click a unit", desc: "Selects it. The board lights up around it: green tiles it can move to, red enemies it can hit, cyan allies a Munti can Repair instead of attacking." },
  { key: "Click green", desc: "Moves there. Costs 1 action, does not end your turn — the unit stays selected and its options recompute.", chip: "go" },
  { key: "Click red", desc: "Attacks. Costs every action the unit has left and ends its turn immediately, no matter how many actions were still in the bank.", chip: "danger" },
  { key: "Click cyan", desc: "Munti only — heals that ally instead of attacking. Costs 1 action, does not end the turn.", chip: "info" },
  { key: "End Turn", desc: "Bottom-right button. Resolves the hostile AI's whole turn, then the environment step (acid tiles, deploy-pad healing, shield/regen ticks), then hands the turn back to you." },
  { key: "< mission select", desc: "Top-right, bails out to the mission list at any time — nothing is saved mid-mission, so this is a hard restart of the current fight." },
  { key: "Campaign tabs", desc: "Team One (the original 4-mission engine test) and Amaranth Act I — independent rosters, maps, same rules." },
];

interface TerrainRow {
  swatch: number;
  name: string;
  cost: string;
  def: string;
  desc: string;
}
const TERRAIN: TerrainRow[] = [
  { swatch: 0x3a4636, name: "Plain", cost: "1", def: "—", desc: "Open ground, no penalty or bonus." },
  { swatch: 0x5a5a5a, name: "Road", cost: "1", def: "—", desc: "Fast, but zero defence — you're exposed on it." },
  { swatch: 0x455233, name: "Scrub", cost: "1", def: "—", desc: "Open ground, no cover." },
  { swatch: 0x8a7a5f, name: "Rubble", cost: "2 (3 centauroid)", def: "++", desc: "Slows everyone, centauroids worst. Decent cover for the trouble." },
  { swatch: 0x55606b, name: "Structure", cost: "1 (2 centauroid)", def: "+++", desc: "Best cover short of a ridge; centauroid chassis pay extra to enter." },
  { swatch: 0x4a2e3a, name: "Bloom mat", cost: "2", def: "+", desc: "5 damage every turn you end your move standing on it." },
  { swatch: 0x6a5a4a, name: "Ridge", cost: "2 (3 centauroid)", def: "++++", desc: "Best cover in the game. Reeps get +1 attack range from here." },
  { swatch: 0x2a4a5a, name: "Sump (water)", cost: "∞", def: "—", desc: "Impassable to everyone but flyers." },
  { swatch: 0x2e5c7a, name: "Deploy pad", cost: "1", def: "+", desc: "Your landing zone — heals 20 HP a turn if you're standing on one." },
  { swatch: 0x7a2430, name: "Spawn seam", cost: "1", def: "—", desc: "Where hostiles enter the map. Yours to avoid loitering near." },
  { swatch: 0x3d8a4a, name: "Exit", cost: "1", def: "+", desc: "Extraction tile — the win condition on an extract_unit mission." },
  { swatch: 0x8a7a2a, name: "Hold zone", cost: "1", def: "++", desc: "The ground you're defending on a hold_zone mission." },
  { swatch: 0x151515, name: "Wall", cost: "∞", def: "—", desc: "Solid. Nothing gets through it, flyers included." },
];

interface AbilityRow {
  name: string;
  tag: string;
  desc: string;
}
const ABILITIES: AbilityRow[] = [
  { name: "Overshield", tag: "Tank, passive", desc: "While an Overshield Tank is alive on the board, every adjacent ally gets +1 terrain defence star (10% less damage taken). Doesn't stack with a second Tank." },
  { name: "Repair", tag: "Munti, active", desc: "Instead of attacking: heal one adjacent ally 30 HP (38 if the Munti's mek runs Fieldwright as primary). Costs 1 action, doesn't end the turn." },
  { name: "Charge", tag: "Centauroid, passive", desc: "Move 3+ tiles in an unbroken straight line over cost-1 terrain, then attack at the end of it — +25% damage." },
  { name: "Sensor Sweep", tag: "Vibrissal, passive", desc: "On the sheet for vibrissal-chassis pilots (Cpl. Anand). Honest flag: burrow-reveal isn't wired up in this build yet — treat it as flavour, not a mechanical edge against Undertow." },
  { name: "Meeps Dodge", tag: "house rule", desc: "40% chance to take zero damage from any single hit — as the target, and again on the counter-hit a Meeps eats after attacking something that counters back. Two independent rolls." },
  { name: "Tank Shield", tag: "house rule", desc: "Overshield also grants a real 20-point shield (absorbs before HP) to the Tank and every adjacent ally. Regens 8/turn only if that unit took zero damage since the last tick." },
  { name: "Munti Regen", tag: "house rule", desc: "Every living Munti passively heals itself and same-side allies within 2 tiles for 8 HP/turn — free, stacks with active Repair, doesn't stack across multiple Muntis." },
  { name: "2 Actions / Turn", tag: "house rule", desc: "Move and Repair each cost 1 action and don't end your turn. Attack always burns every remaining action, whichever slot it's used in." },
];

interface ObjectiveRow {
  name: string;
  color: "go" | "danger";
  desc: string;
}
const OBJECTIVES: ObjectiveRow[] = [
  { name: "eliminate_all", color: "go", desc: "Kill every hostile. No turn limit — the turn count shown is a future bonus-scoring target, not a deadline. Only losing every unit ends the mission early." },
  { name: "hold_zone", color: "danger", desc: "Get a unit onto the gold hold tiles and keep every hostile off them from the hold-turn on. Real deadline — hostiles controlling the zone unopposed past turn 2 is an instant loss." },
  { name: "extract_unit", color: "danger", desc: "Get the named unit onto a green exit tile before the turn limit. Real deadline — a deliberate rescue-mission clock, kept on purpose." },
];

interface RosterRow {
  callsign: string;
  name: string;
  path: string;
  chassis: string;
  mek: string;
  role: string;
}
const ROSTER: RosterRow[] = [
  { callsign: "Lark", name: "2nd Lt. Dessa Rourke", path: "Meeps", chassis: "Human / bipedal", mek: "Runemaster", role: "Squad lead. Aggressive, quick, still learning patience." },
  { callsign: "Anvil", name: "M.Sgt. Halvard Bosk", path: "Tank", chassis: "Human / bipedal", mek: "Armorer", role: "The mentor. Put him in the doorway." },
  { callsign: "Foxfire", name: "Pvt. Tegan Iyari", path: "Meeps", chassis: "Hiopi / centauroid", mek: "Armorer", role: "Second melee voice — can Charge." },
  { callsign: "Farsight", name: "Cpl. Priya Anand", path: "Reeps", chassis: "Osnian / vibrissal", mek: "Runemaster", role: "The squad's eyes. Keep her at range." },
  { callsign: "Patch", name: "Spec. Corin Lask", path: "Munti", chassis: "Human / bipedal", mek: "Fieldwright", role: "Keeps everyone standing. Protect him." },
];

interface MissionRow {
  title: string;
  tags: string[];
  desc: string;
  tip: string;
}
const MISSIONS: MissionRow[] = [
  {
    title: "I.1 — Muster",
    tags: ["eliminate_all", "6 Crawlmass", "bonus by turn 8"],
    desc: "First light on the Fallow Line. A tutorial fight, meant to be an easy clean win.",
    tip: "No clock to fail on — take your time, keep the squad together, let Bosk lead the way in.",
  },
  {
    title: "I.2 — Wire and Mud",
    tags: ["hold_zone", "6 Splitfang, staggered", "hold from turn 6, limit 10"],
    desc: "Hold the forward listening post until the survey detail clears.",
    tip: "There is exactly one doorway into the hold room. Park Bosk in it — everyone else spreads out on the gold tiles behind him.",
  },
  {
    title: "I.3 — The Low Ground",
    tags: ["eliminate_all", "8 Crawlmass + 2 Splitfang", "bonus by turn 12"],
    desc: "Bloom mat came up through the terraces overnight — a supply detail was caught crossing at first light.",
    tip: "The purple ground is bloom mat — 5 damage every turn you end a move on it (Sec. 03). Don't linger; kill and keep moving.",
  },
  {
    title: "I.4 — Tunnel Rats",
    tags: ["eliminate_all", "3 burrowed Undertow + 4 Crawlmass", "bonus by turn 12"],
    desc: "First burrower contact on the Line.",
    tip: "Burrowed units render faded but are already targetable at range — lead with Anand's Reeps rather than walking a melee unit in blind.",
  },
];

// Base damage, attacker (row) vs defender (column) — Meeps/Tank/Reeps/Munti
// order both ways, "self" cells (diagonal) and "high" cells (the triangle's
// own advantage matchups) flagged for coloring, same as the HTML manual's
// own <td class="self">/<td class="high">.
const TRIANGLE_COLS = ["Meeps", "Tank", "Reeps", "Munti"];
const TRIANGLE_ROWS: { name: string; cells: { v: number; kind: "self" | "high" | "" }[] }[] = [
  { name: "Meeps", cells: [{ v: 55, kind: "self" }, { v: 30, kind: "" }, { v: 75, kind: "high" }, { v: 70, kind: "" }] },
  { name: "Tank", cells: [{ v: 65, kind: "high" }, { v: 40, kind: "self" }, { v: 50, kind: "" }, { v: 60, kind: "" }] },
  { name: "Reeps", cells: [{ v: 45, kind: "" }, { v: 70, kind: "high" }, { v: 50, kind: "self" }, { v: 55, kind: "" }] },
  { name: "Munti", cells: [{ v: 30, kind: "" }, { v: 20, kind: "" }, { v: 35, kind: "" }, { v: 30, kind: "self" }] },
];

interface CodexSection {
  id: string;
  num: string;
  title: string;
  dek: string;
  pageCount: number;
  /**
   * Codex Rebuild & Live Briefing Plan v1, Part A — true for the three
   * categories that need a live Warden Company save to mean anything
   * (Personnel, Bloom Bestiary, World). Reached from the Main Menu with no
   * save loaded, or from a House Amaranth save's own pause menu (Hangar.ts
   * uses the same MenuOverlay Hub.ts does — see data/codex.ts's own header
   * for why these three are Warden-scoped), these render one honest
   * placeholder message instead of pagination. Systems, Ranks & Command,
   * and Glossary are flavor-only and always fully browsable — see that
   * same header's gate note #3 for why.
   */
  needsSave: boolean;
}
const SECTIONS: CodexSection[] = [
  { id: "controls", num: "01", title: "Controls", dek: "Everything happens by clicking the board. No drag, no hotkeys, no right-click menu.", pageCount: 1, needsSave: false },
  { id: "units", num: "02", title: "Reading the Board", dek: "No sprites yet — every unit is a shape. Shape says class, fill says side, outline says chassis.", pageCount: 1, needsSave: false },
  { id: "terrain", num: "03", title: "Terrain", dek: "Tile colour on the board is the actual rules data, not decoration.", pageCount: 2, needsSave: false },
  { id: "bars", num: "04", title: "Health, Shield & Collapse", dek: "Every unit shows a small bar above it. What's stacked there depends on what kind of unit it is.", pageCount: 1, needsSave: false },
  { id: "triangle", num: "05", title: "The Class Triangle", dek: "Meeps > Reeps > Tank > Meeps. Munti sits outside the triangle entirely.", pageCount: 1, needsSave: false },
  { id: "abilities", num: "06", title: "Abilities & House Rules", dek: "A few of these aren't in the original design docs — added during Maxime's own playtesting.", pageCount: 2, needsSave: false },
  { id: "objectives", num: "07", title: "Objectives", dek: "Three objective types across these four missions. Only one still has a hard clock.", pageCount: 1, needsSave: false },
  { id: "roster", num: "08", title: "Warden Company Roster", dek: "All five deploy on every Act I mission. All tier G, no Heirloom charge yet.", pageCount: 1, needsSave: false },
  { id: "missions", num: "09", title: "Mission Briefings — Act I", dek: "The four Amaranth missions currently in the build, with one tactical note each.", pageCount: 2, needsSave: false },
  { id: "personnel", num: "10", title: "Personnel", dek: "Warden Company's own roster — real bios, real Meks, and a live read of how each of them is actually doing in your save.", pageCount: Math.ceil(PERSONNEL.length / 2), needsSave: true },
  { id: "bestiary", num: "11", title: "Bloom Bestiary", dek: "The Bloom, catalogued the way a soldier would write it up. Unlocks as you actually meet each one.", pageCount: Math.ceil(BESTIARY.length / 3), needsSave: true },
  { id: "world", num: "12", title: "World", dek: "The Amaranth Reach, House Amaranth, Meridian, and the wider Coalition — updates as your campaign moves forward.", pageCount: Math.ceil(WORLD.length / 2), needsSave: true },
  { id: "systemsLore", num: "13", title: "Systems", dek: "How the war's own systems actually work, told straight rather than as a stat sheet.", pageCount: Math.ceil(SYSTEMS.length / 2), needsSave: false },
  { id: "ranksLore", num: "14", title: "Ranks & Command", dek: "How rank and command actually work in Warden Company. Paper only for now — nothing here changes a pilot's numbers yet.", pageCount: 1, needsSave: false },
  { id: "glossary", num: "15", title: "Glossary", dek: "Quick lookups for the jargon the game already uses on you from Mission 1.", pageCount: Math.ceil(GLOSSARY.length / 5), needsSave: false },
];

export class Codex extends Phaser.Scene {
  private returnScene = "MainMenu";
  private sectionIndex = 0;
  private page = 0;
  private categoryLayer!: Phaser.GameObjects.Container;
  private contentLayer!: Phaser.GameObjects.Container;
  private navLayer!: Phaser.GameObjects.Container;

  // Codex Rebuild & Live Briefing Plan v1, Part A — whatever save (if any)
  // this Codex was opened against. MainMenu.ts and MenuOverlay.ts both
  // already have a live `CampaignState | null` in scope at their own
  // Codex-launch call sites (loadCampaignState() / getState() respectively)
  // — see this file's own SECTIONS.needsSave comment for how it's used.
  private campaignState: CampaignState | null = null;

  private readonly contentX = 262;
  private readonly contentY = 96;
  private readonly contentW = 788;
  private readonly contentH = 504;

  constructor() {
    super("Codex");
  }

  init(data: { returnScene?: string; campaignState?: CampaignState | null }) {
    this.returnScene = data.returnScene ?? "MainMenu";
    this.campaignState = data.campaignState ?? null;
    this.sectionIndex = 0;
    this.page = 0;
  }

  // Personnel/Bestiary/World are Warden-scoped (data/codex.ts's own header)
  // — a Warden save is identified the same cheap way
  // engine/campaignState.ts's own baseSceneKeyFor does: pilot_rourke's
  // presence on the roster. False for no save at all (Main Menu, no
  // CONTINUE yet) and for a House Amaranth save (Hangar has no
  // pilot_rourke and never will — see missionBriefing.ts's own header).
  private get hasWardenSave(): boolean {
    return !!this.campaignState && "pilot_rourke" in this.campaignState.pilots;
  }

  private get highestMissionIndexReached(): number {
    return highestWardenMissionIndexReached(this.campaignState?.lastMissionEcho);
  }

  /**
   * The minimal LivePilotStatus data/codex.ts's own personnelStatusText
   * needs, extracted from the real CampaignPilotEntry — see codex.ts's own
   * header for why that extraction happens here rather than importing the
   * engine type into src/data. Undefined pilotId (shouldn't happen for any
   * of the four ordinary roster entries on a real Warden save — they're
   * seeded at creation) reads the same as "active" in personnelStatusText.
   */
  private liveStatusFor(pilotId: string): LivePilotStatus | undefined {
    const entry: CampaignPilotEntry | undefined = this.campaignState?.pilots[pilotId];
    if (!entry) return undefined;
    if (entry.status === "active") return { kind: "active" };
    if (entry.status === "reassigned") return { kind: "reassigned" };
    // status === "permanently_lost" from here down. lostContext is only
    // truly optional for a save from before that field existed, or a
    // status flip through the test-only applyPermadeathCheck path rather
    // than the real Debrief-driven applyMissionLosses (see that function's
    // own header) — "unknown"/turn 0 is a defensive fallback for a state
    // that shouldn't occur on any real save, not an expected case.
    if (entry.lostContext) return { kind: "permanently_lost", missionId: entry.lostContext.missionId, turn: entry.lostContext.turn };
    return { kind: "permanently_lost", missionId: "unknown", turn: 0 };
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    this.drawChrome();
    this.categoryLayer = this.add.container(0, 0);
    this.contentLayer = this.add.container(0, 0);
    this.navLayer = this.add.container(0, 0);
    this.drawCategoryList();
    this.renderSection();
  }

  private drawChrome() {
    const ccx = this.cameras.main.centerX;
    this.add.text(ccx, 26, "THE BLOOM WARS", { fontFamily: "monospace", fontSize: "11px", color: PAL.textFaint }).setOrigin(0.5);
    this.add.text(ccx, 48, "FIELD MANUAL", { fontFamily: "monospace", fontSize: "24px", color: PAL.text }).setOrigin(0.5);
    this.add.text(24, 26, "UNCLASSIFIED — WARDEN CO. INTERNAL USE", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint }).setOrigin(0, 0.5);
    this.add.rectangle(ccx, 74, this.cameras.main.width - 40, 1, PAL.cardBorder);

    this.add
      .rectangle(this.contentX + this.contentW / 2, this.contentY + this.contentH / 2, this.contentW, this.contentH, PAL.panel, 1)
      .setStrokeStyle(1, PAL.panelBorder);

    makeShopButton(this, this.add.container(0, 0), ccx, 616, 220, 32, "BACK", true, () => {
      this.scene.start(this.returnScene);
    });
  }

  private drawCategoryList() {
    this.categoryLayer.destroy();
    this.categoryLayer = this.add.container(0, 0);
    const cx = 135;
    const w = 204;
    // Codex Rebuild & Live Briefing Plan v1, Part A, 4 Sep 2026 — this list
    // grew from 9 sections to 15 the day this was written. At the original
    // fixed 50px row spacing starting from y=104, row 11 onward (World
    // through Glossary) lands below y=640 — off the bottom of the game's
    // own 1074x640 logical canvas (src/main.ts) — which doesn't scroll or
    // clip visibly, it just puts those four categories' own click targets
    // somewhere the player's mouse can never reach. Caught by this pass's
    // own Playwright verification, not by eye — a static 42px/50px layout
    // tuned for 9 rows silently stopped being enough the moment a tenth
    // one was added, with no error or visual sign that anything broke.
    // Spacing (and row height with it) now shrinks to fit however many
    // sections actually exist, capped at the original 50/42 so a shorter
    // list still looks exactly as it always did.
    const topY = 100;
    const bottomY = 600; // stays clear of the BACK button's own row at y=616
    const spacing = SECTIONS.length > 1 ? Math.min(50, (bottomY - topY) / (SECTIONS.length - 1)) : 50;
    const h = Math.min(42, spacing - 4);
    const fontSize = spacing < 45 ? "9px" : "10px";
    let y = topY;
    SECTIONS.forEach((sec, i) => {
      const active = i === this.sectionIndex;
      const bg = this.add
        .rectangle(cx, y, w, h, active ? PAL.playerBlue : PAL.cardBg, 1)
        .setStrokeStyle(1, active ? 0x4a7a9a : PAL.cardBorder)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(cx, y, `${sec.num}  ${sec.title.toUpperCase()}`, {
          fontFamily: "monospace",
          fontSize,
          color: active ? "#ffffff" : PAL.textMuted,
          align: "center",
          wordWrap: { width: w - 14 },
        })
        .setOrigin(0.5);
      this.categoryLayer.add([bg, txt]);
      bg.on("pointerover", () => { if (i !== this.sectionIndex) bg.setFillStyle(0x22303c, 1); });
      bg.on("pointerout", () => bg.setFillStyle(i === this.sectionIndex ? PAL.playerBlue : PAL.cardBg, 1));
      bg.on("pointerdown", () => {
        if (this.sectionIndex === i) return;
        this.sectionIndex = i;
        this.page = 0;
        this.drawCategoryList();
        this.renderSection();
      });
      y += spacing;
    });
  }

  private renderSection() {
    this.contentLayer.destroy();
    this.contentLayer = this.add.container(0, 0);
    this.navLayer.destroy();
    this.navLayer = this.add.container(0, 0);

    const sec = SECTIONS[this.sectionIndex];
    const titleTxt = this.add
      .text(this.contentX + 24, this.contentY + 16, `SEC. ${sec.num} — ${sec.title.toUpperCase()}`, { fontFamily: "monospace", fontSize: "15px", color: PAL.accent })
      .setOrigin(0, 0);
    const dekTxt = this.add
      .text(this.contentX + 24, this.contentY + 38, sec.dek, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PAL.textMuted,
        wordWrap: { width: this.contentW - 48 },
      })
      .setOrigin(0, 0);
    this.contentLayer.add([titleTxt, dekTxt]);

    const bodyTop = this.contentY + 64;
    const bodyBottom = this.contentY + this.contentH - (sec.pageCount > 1 ? 34 : 14);
    const bodyX = this.contentX + 24;
    const bodyW = this.contentW - 48;
    const bodyH = bodyBottom - bodyTop;

    switch (sec.id) {
      case "controls": this.renderControls(bodyX, bodyTop, bodyW, bodyH); break;
      case "units": this.renderUnits(bodyX, bodyTop, bodyW, bodyH); break;
      case "terrain": this.renderTerrain(bodyX, bodyTop, bodyW, bodyH); break;
      case "bars": this.renderBars(bodyX, bodyTop, bodyW, bodyH); break;
      case "triangle": this.renderTriangle(bodyX, bodyTop, bodyW, bodyH); break;
      case "abilities": this.renderAbilities(bodyX, bodyTop, bodyW, bodyH); break;
      case "objectives": this.renderObjectives(bodyX, bodyTop, bodyW, bodyH); break;
      case "roster": this.renderRoster(bodyX, bodyTop, bodyW, bodyH); break;
      case "missions": this.renderMissions(bodyX, bodyTop, bodyW, bodyH); break;
      case "personnel": this.renderPersonnel(bodyX, bodyTop, bodyW, bodyH); break;
      case "bestiary": this.renderBestiary(bodyX, bodyTop, bodyW, bodyH); break;
      case "world": this.renderWorld(bodyX, bodyTop, bodyW, bodyH); break;
      case "systemsLore": this.renderSystemsLore(bodyX, bodyTop, bodyW, bodyH); break;
      case "ranksLore": this.renderRanksLore(bodyX, bodyTop, bodyW, bodyH); break;
      case "glossary": this.renderGlossary(bodyX, bodyTop, bodyW, bodyH); break;
    }

    // A needsSave section with no usable save shows one honest placeholder
    // message (renderXxx itself draws it) instead of paginated content —
    // no page nav makes sense over a single static message, regardless of
    // that section's own nominal pageCount.
    const showPageNav = sec.pageCount > 1 && (!sec.needsSave || this.hasWardenSave);
    if (showPageNav) this.drawPageNav(sec.pageCount);
  }

  /** The shared "no save, or the wrong campaign" message for a needsSave section. */
  private renderNoSavePlaceholder(x: number, y: number, w: number, h: number, categoryLabel: string) {
    this.txt(x, y + h / 2 - 24, `${categoryLabel} is Warden Company's own record.`, { fontFamily: "monospace", fontSize: "12px", color: PAL.text, wordWrap: { width: w } });
    this.txt(x, y + h / 2, "Start or load a Warden Company campaign to see it — a House Amaranth save, or no save at all, doesn't have one yet.", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: PAL.textMuted,
      wordWrap: { width: w },
      lineSpacing: 3,
    });
  }

  private drawPageNav(pageCount: number) {
    const y = this.contentY + this.contentH - 18;
    const rx = this.contentX + this.contentW - 90;
    makeShopButton(this, this.navLayer, rx - 44, y, 26, 22, "<", this.page > 0, () => { this.page--; this.renderSection(); });
    const label = this.add.text(rx, y, `PAGE ${this.page + 1} / ${pageCount}`, { fontFamily: "monospace", fontSize: "10px", color: PAL.textMuted }).setOrigin(0.5);
    this.navLayer.add(label);
    makeShopButton(this, this.navLayer, rx + 44, y, 26, 22, ">", this.page < pageCount - 1, () => { this.page++; this.renderSection(); });
  }

  private swatch(x: number, y: number, size: number, color: number): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(x, y, size, size, color, 1).setStrokeStyle(1, 0xffffff, 0.25);
    this.contentLayer.add(r);
    return r;
  }

  private txt(x: number, y: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, style);
    this.contentLayer.add(t);
    return t;
  }

  // ---- SEC. 01 — Controls -------------------------------------------
  private renderControls(x: number, y: number, w: number, h: number) {
    const rowH = Math.floor(h / CONTROLS.length);
    const keyW = 150;
    CONTROLS.forEach((row, i) => {
      const ry = y + i * rowH + rowH / 2;
      if (row.chip) {
        const color = row.chip === "go" ? PAL.goHex : row.chip === "danger" ? PAL.dangerHex : PAL.infoHex;
        this.swatch(x + 6, ry - 5, 10, color);
      }
      this.txt(x + 20, ry - rowH / 2 + 4, row.key, { fontFamily: "monospace", fontSize: "12px", color: PAL.accent });
      this.txt(x + keyW, ry - rowH / 2 + 4, row.desc, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PAL.textMuted,
        wordWrap: { width: w - keyW },
      });
      if (i < CONTROLS.length - 1) {
        const line = this.add.rectangle(x + w / 2, y + (i + 1) * rowH, w, 1, PAL.cardBorder, 0.6);
        this.contentLayer.add(line);
      }
    });
  }

  // ---- SEC. 02 — Reading the board -----------------------------------
  private renderUnits(x: number, y: number, w: number, h: number) {
    const kinds: { kind: UnitIconKind; label: string; desc: string }[] = [
      { kind: "meeps", label: "Triangle — Meeps", desc: "Melee brawler. Dodges 40% of any hit it takes." },
      { kind: "tank", label: "Square — Tank", desc: "Melee, high HP, shield aura onto adjacent allies." },
      { kind: "reeps", label: "Diamond — Reeps", desc: "Ranged (2–4 tiles), never counterattacked." },
      { kind: "munti", label: "Circle + bar — Munti", desc: "Support. Weak in a fight; keeps others alive." },
    ];
    const colW = w / 2;
    const g = this.add.graphics();
    this.contentLayer.add(g);
    kinds.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = x + col * colW + 26;
      const cy = y + row * 92 + 24;
      drawUnitIcon(g, k.kind, cx, cy, 16, PAL.playerBlue);
      this.txt(x + col * colW + 52, y + row * 92 + 8, k.label, { fontFamily: "monospace", fontSize: "12px", color: PAL.text });
      this.txt(x + col * colW + 52, y + row * 92 + 26, k.desc, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PAL.textMuted,
        wordWrap: { width: colW - 60 },
      });
    });

    const fillY = y + 200;
    const fills: { color: number; round: boolean; label: string; desc: string }[] = [
      { color: PAL.playerBlue, round: false, label: "Blue fill", desc: "One of yours — Warden Company." },
      { color: PAL.hostileTan, round: false, label: "Tan fill", desc: "A hostile mech. The game never names these." },
      { color: PAL.bloomBlob, round: true, label: "Coloured blob", desc: "A Bloom creature — faded/translucent while burrowed." },
    ];
    const fw = w / 3;
    fills.forEach((f, i) => {
      const fx = x + i * fw;
      const swatchObj: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc = f.round
        ? this.add.circle(fx + 10, fillY + 8, 8, f.color, 1).setStrokeStyle(1, 0xffffff, 0.3)
        : this.add.rectangle(fx + 10, fillY + 8, 16, 16, f.color, 1).setStrokeStyle(1, 0xffffff, 0.3);
      this.contentLayer.add(swatchObj);
      this.txt(fx + 26, fillY, f.label, { fontFamily: "monospace", fontSize: "11px", color: PAL.text });
      this.txt(fx, fillY + 22, f.desc, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: fw - 10 } });
    });

    const fineY = Math.min(y + 270, y + h - 22);
    this.txt(x, fineY, "Thick white outline = centauroid chassis (can Charge). Thin outline = bipedal/vibrissal. Dimmed ≈ half-opacity = already acted this turn.", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: PAL.textFaint,
      wordWrap: { width: w },
    });
  }

  // ---- SEC. 03 — Terrain (paged, 7/6) --------------------------------
  private renderTerrain(x: number, y: number, w: number, h: number) {
    const perPage = 7;
    const rows = TERRAIN.slice(this.page * perPage, this.page * perPage + perPage);
    const rowH = Math.floor((h - 24) / perPage);
    const colSwatch = x;
    const colName = x + 26;
    const colCost = x + 190;
    const colDef = x + 290;
    const colDesc = x + 350;

    this.txt(colName, y, "TILE", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });
    this.txt(colCost, y, "MOVE", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });
    this.txt(colDef, y, "DEF", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });
    this.txt(colDesc, y, "NOTES", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });

    rows.forEach((row, i) => {
      const ry = y + 22 + i * rowH;
      this.swatch(colSwatch + 8, ry + rowH / 2 - 6, 14, row.swatch);
      this.txt(colName, ry, row.name, { fontFamily: "monospace", fontSize: "11px", color: PAL.text });
      this.txt(colCost, ry, row.cost, { fontFamily: "monospace", fontSize: "10px", color: PAL.textMuted });
      this.txt(colDef, ry, row.def, { fontFamily: "monospace", fontSize: "10px", color: PAL.accent });
      this.txt(colDesc, ry, row.desc, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PAL.textMuted,
        wordWrap: { width: x + w - colDesc },
      });
    });
  }

  // ---- SEC. 04 — Health, shield & Collapse ---------------------------
  private renderBars(x: number, y: number, w: number, h: number) {
    const cardW = (w - 16) / 2;
    const g = this.add.graphics();
    this.contentLayer.add(g);

    // Left card — HP bar demo
    this.drawCard(x, y, cardW, 130, "Your units & hostile mechs");
    this.txt(x + 12, y + 34, "HP  —  green > 50%  ·  yellow 25–50%  ·  red < 25%", { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: cardW - 24 } });
    this.drawBar(g, x + 12, y + 56, cardW - 24, 10, 0.62, PAL.goHex);
    this.txt(x + 12, y + 76, "A blue line above the HP bar = inside an active Tank's shield radius.", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint, wordWrap: { width: cardW - 24 } });

    // Right card — Bloom Endurance/Vitality
    const rx = x + cardW + 16;
    this.drawCard(rx, y, cardW, 130, "Bloom creatures");
    this.txt(rx + 12, y + 34, "Endurance — drains first", { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted });
    this.drawBar(g, rx + 12, y + 48, cardW - 24, 9, 0.45, PAL.enduranceHex);
    this.txt(rx + 12, y + 64, "Vitality — the real HP underneath", { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted });
    this.drawBar(g, rx + 12, y + 78, cardW - 24, 9, 0.8, PAL.vitalityHex);

    const ty = y + 148;
    this.drawCard(x, ty, w, y + h - ty, "How Collapse actually works");
    this.txt(x + 12, ty + 30, "Endurance soaks damage first, and overflow does NOT spill into Vitality — a single huge hit against high Endurance is partly wasted, so finishing blows beat overkill. While Endurance is above zero, the creature also hits softer as its shell wears down.", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: PAL.textMuted,
      wordWrap: { width: w - 24 },
      lineSpacing: 3,
    });
    this.txt(x + 12, ty + 96, "Once Endurance hits zero, it enters Collapse (a pulsing red ring): any single hit worth at least its remaining Vitality kills it outright — but its own attacks now land at FULL power. A dying Bloom creature is not a safe one.", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: PAL.danger,
      wordWrap: { width: w - 24 },
      lineSpacing: 3,
    });
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number) {
    g.fillStyle(0x0a0d10, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, PAL.cardBorderLight, 1);
    g.strokeRect(x, y, w, h);
    g.fillStyle(color, 1);
    g.fillRect(x, y, w * frac, h);
  }

  private drawCard(x: number, y: number, w: number, h: number, title: string) {
    const bg = this.add.rectangle(x + w / 2, y + h / 2, w, h, PAL.cardBg, 1).setStrokeStyle(1, PAL.cardBorder);
    this.contentLayer.add(bg);
    if (title) this.txt(x + 12, y + 10, title, { fontFamily: "monospace", fontSize: "11px", color: PAL.text });
  }

  // ---- SEC. 05 — The class triangle -----------------------------------
  private renderTriangle(x: number, y: number, w: number, h: number) {
    this.txt(x, y, "Base damage dealt, attacker (row) vs. defender (column) — before tier, terrain or ability modifiers.", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: PAL.textFaint,
      wordWrap: { width: w },
    });

    const tableY = y + 30;
    const labelW = 130;
    const colW = (w - labelW) / 4;
    const rowH = 44;
    const g = this.add.graphics();
    this.contentLayer.add(g);
    g.lineStyle(1, PAL.cardBorder, 1);
    g.strokeRect(x, tableY, w, rowH * 5);

    this.txt(x + 8, tableY + 14, "ATK ↓ / DEF →", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });
    TRIANGLE_COLS.forEach((c, i) => {
      this.txt(x + labelW + i * colW + colW / 2, tableY + 14, c, { fontFamily: "monospace", fontSize: "10px", color: PAL.textMuted }).setOrigin(0.5, 0);
    });

    TRIANGLE_ROWS.forEach((row, ri) => {
      const ry = tableY + rowH * (ri + 1);
      g.lineStyle(1, PAL.cardBorder, 1);
      g.lineBetween(x, ry, x + w, ry);
      this.txt(x + 8, ry + rowH / 2 - 7, row.name, { fontFamily: "monospace", fontSize: "10px", color: PAL.text });
      row.cells.forEach((cell, ci) => {
        const cx = x + labelW + ci * colW + colW / 2;
        const cy = ry + rowH / 2;
        const color = cell.kind === "high" ? PAL.go : cell.kind === "self" ? PAL.textFaint : PAL.text;
        this.txt(cx, cy - 7, String(cell.v), { fontFamily: "monospace", fontSize: "13px", color }).setOrigin(0.5, 0);
      });
    });

    const fineY = Math.min(tableY + rowH * 5 + 14, y + h - 20);
    this.txt(x, fineY, "The one rule that makes this work: a Reeps firing from range never eats a counterattack. Keep it at range 2–4 and it's a one-way exchange.", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: PAL.textFaint,
      wordWrap: { width: w },
    });
  }

  // ---- SEC. 06 — Abilities & house rules (paged, 4/4) ------------------
  private renderAbilities(x: number, y: number, w: number, h: number) {
    const perPage = 4;
    const items = ABILITIES.slice(this.page * perPage, this.page * perPage + perPage);
    const cardW = (w - 16) / 2;
    const cardH = (h - 16) / 2;

    items.forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = x + col * (cardW + 16);
      const cy = y + row * (cardH + 16);
      this.drawCard(cx, cy, cardW, cardH, "");
      this.txt(cx + 12, cy + 10, a.name, { fontFamily: "monospace", fontSize: "12px", color: PAL.text });
      this.txt(cx + 12, cy + 28, a.tag.toUpperCase(), { fontFamily: "monospace", fontSize: "8px", color: PAL.accent });
      this.txt(cx + 12, cy + 44, a.desc, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PAL.textMuted,
        wordWrap: { width: cardW - 24 },
        lineSpacing: 2,
      });
    });
  }

  // ---- SEC. 07 — Objectives -------------------------------------------
  private renderObjectives(x: number, y: number, w: number, h: number) {
    const cardW = (w - 32) / 3;
    const cardH = Math.min(190, h);
    OBJECTIVES.forEach((o, i) => {
      const cx = x + i * (cardW + 16);
      this.drawCard(cx, y, cardW, cardH, "");
      this.txt(cx + 12, y + 10, o.name, { fontFamily: "monospace", fontSize: "12px", color: o.color === "go" ? PAL.go : PAL.danger });
      this.txt(cx + 12, y + 32, o.desc, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PAL.textMuted,
        wordWrap: { width: cardW - 24 },
        lineSpacing: 2,
      });
    });
  }

  // ---- SEC. 08 — Roster --------------------------------------------
  private renderRoster(x: number, y: number, w: number, h: number) {
    const cols = [
      { key: "callsign", label: "CALLSIGN", w: 60 },
      { key: "name", label: "NAME", w: 145 },
      { key: "path", label: "PATH", w: 55 },
      { key: "chassis", label: "CHASSIS", w: 120 },
      { key: "mek", label: "MEK TRACK", w: 75 },
    ] as const;
    let cx = x;
    const colX: number[] = [];
    cols.forEach((c) => {
      colX.push(cx);
      this.txt(cx, y, c.label, { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });
      cx += c.w;
    });
    const roleX = cx;
    this.txt(roleX, y, "ROLE", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });

    const rowH = Math.min(60, Math.floor((h - 22) / ROSTER.length));
    ROSTER.forEach((r, i) => {
      const ry = y + 22 + i * rowH;
      this.txt(colX[0], ry, r.callsign, { fontFamily: "monospace", fontSize: "11px", color: PAL.accent });
      this.txt(colX[1], ry, r.name, { fontFamily: "monospace", fontSize: "10px", color: PAL.text, wordWrap: { width: cols[1].w - 6 } });
      this.txt(colX[2], ry, r.path, { fontFamily: "monospace", fontSize: "10px", color: PAL.textMuted });
      this.txt(colX[3], ry, r.chassis, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: cols[3].w - 6 } });
      this.txt(colX[4], ry, r.mek, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: cols[4].w - 6 } });
      this.txt(roleX, ry, r.role, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: x + w - roleX } });
      if (i < ROSTER.length - 1) {
        const line = this.add.rectangle(x + w / 2, y + 22 + (i + 1) * rowH - 10, w, 1, PAL.cardBorder, 0.6);
        this.contentLayer.add(line);
      }
    });
  }

  // ---- SEC. 09 — Mission briefings (paged, 2/2) ------------------------
  private renderMissions(x: number, y: number, w: number, h: number) {
    const perPage = 2;
    const items = MISSIONS.slice(this.page * perPage, this.page * perPage + perPage);
    const cardH = (h - 12) / 2;

    items.forEach((m, i) => {
      const cy = y + i * (cardH + 12);
      this.drawCard(x, cy, w, cardH, "");
      this.txt(x + 12, cy + 8, m.title, { fontFamily: "monospace", fontSize: "13px", color: PAL.text });

      let tagX = x + 12;
      const tagY = cy + 28;
      m.tags.forEach((tag) => {
        const tw = tag.length * 5.6 + 12;
        const chip = this.add.rectangle(tagX + tw / 2, tagY + 8, tw, 16, PAL.cardBg, 1).setStrokeStyle(1, PAL.cardBorderLight);
        this.contentLayer.add(chip);
        this.txt(tagX + 6, tagY + 3, tag, { fontFamily: "monospace", fontSize: "8px", color: PAL.textMuted });
        tagX += tw + 6;
      });

      this.txt(x + 12, cy + 50, m.desc, { fontFamily: "monospace", fontSize: "10px", color: PAL.textMuted, wordWrap: { width: w - 24 } });
      this.txt(x + 12, cy + cardH - 34, `TIP: ${m.tip}`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PAL.accent,
        wordWrap: { width: w - 24 },
        lineSpacing: 2,
      });
    });
  }

  // ---- SEC. 10 — Personnel (paged, 2/page) -----------------------------
  private renderPersonnel(x: number, y: number, w: number, h: number) {
    if (!this.hasWardenSave) { this.renderNoSavePlaceholder(x, y, w, h, "Personnel"); return; }
    const perPage = 2;
    const items = PERSONNEL.slice(this.page * perPage, this.page * perPage + perPage);
    const cardH = (h - 12) / perPage;

    items.forEach((p, i) => {
      const cy = y + i * (cardH + 12);
      this.drawCard(x, cy, w, cardH, "");
      this.txt(x + 12, cy + 8, p.displayName, { fontFamily: "monospace", fontSize: "13px", color: PAL.text });
      const status = personnelStatusText(p, this.liveStatusFor(p.id));
      this.txt(x + 12, cy + 28, status, { fontFamily: "monospace", fontSize: "9px", color: PAL.accent, wordWrap: { width: w - 24 }, lineSpacing: 2 });
      this.txt(x + 12, cy + 48, p.bio.join("\n\n"), {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PAL.textMuted,
        wordWrap: { width: w - 24 },
        lineSpacing: 3,
      });
      const tailY = cy + cardH - 40;
      if (p.mek) {
        this.txt(x + 12, tailY, `MEK — ${p.mek.idLine}`, { fontFamily: "monospace", fontSize: "8px", color: PAL.accent });
        this.txt(x + 12, tailY + 12, p.mek.bio, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: w - 24 }, lineSpacing: 2 });
      } else if (p.catalystLine) {
        this.txt(x + 12, tailY, "CATALYST", { fontFamily: "monospace", fontSize: "8px", color: PAL.accent });
        this.txt(x + 12, tailY + 12, p.catalystLine, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: w - 24 }, lineSpacing: 2 });
      }
    });
  }

  // ---- SEC. 11 — Bloom Bestiary (paged, 3/page) -------------------------
  private renderBestiary(x: number, y: number, w: number, h: number) {
    if (!this.hasWardenSave) { this.renderNoSavePlaceholder(x, y, w, h, "The Bloom Bestiary"); return; }
    const perPage = 3;
    const items = BESTIARY.slice(this.page * perPage, this.page * perPage + perPage);
    const cardH = (h - 24) / perPage;
    const highestIdx = this.highestMissionIndexReached;

    items.forEach((b, i) => {
      const cy = y + i * (cardH + 12);
      const unlocked = isBestiaryEntryUnlocked(b, highestIdx);
      this.drawCard(x, cy, w, cardH, "");
      this.txt(x + 12, cy + 8, unlocked ? b.displayName : "??? — not yet encountered", { fontFamily: "monospace", fontSize: "12px", color: unlocked ? PAL.text : PAL.textFaint });
      if (unlocked) {
        this.txt(x + 12, cy + 26, b.body, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: w - 24 }, lineSpacing: 3 });
      } else {
        this.txt(x + 12, cy + 26, "Scans haven't turned up anything matching this signature yet.", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint, wordWrap: { width: w - 24 } });
      }
    });
  }

  // ---- SEC. 12 — World (paged, 2/page) -----------------------------------
  private renderWorld(x: number, y: number, w: number, h: number) {
    if (!this.hasWardenSave) { this.renderNoSavePlaceholder(x, y, w, h, "World"); return; }
    const perPage = 2;
    const items = WORLD.slice(this.page * perPage, this.page * perPage + perPage);
    const cardH = (h - 12) / perPage;
    const highestIdx = this.highestMissionIndexReached;

    items.forEach((entry, i) => {
      const cy = y + i * (cardH + 12);
      const rev = latestUnlockedWorldRevision(entry, highestIdx);
      this.drawCard(x, cy, w, cardH, "");
      this.txt(x + 12, cy + 8, entry.title, { fontFamily: "monospace", fontSize: "13px", color: PAL.text });
      if (rev) {
        this.txt(x + 12, cy + 28, rev.text, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: w - 24 }, lineSpacing: 3 });
      } else {
        this.txt(x + 12, cy + 28, "Not yet encountered.", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint });
      }
    });
  }

  // ---- SEC. 13 — Systems (lore, paged 2/page) ----------------------------
  private renderSystemsLore(x: number, y: number, w: number, h: number) {
    const perPage = 2;
    const items = SYSTEMS.slice(this.page * perPage, this.page * perPage + perPage);
    const cardH = (h - 12) / perPage;
    items.forEach((s, i) => {
      const cy = y + i * (cardH + 12);
      this.drawCard(x, cy, w, cardH, "");
      this.txt(x + 12, cy + 8, s.title, { fontFamily: "monospace", fontSize: "13px", color: PAL.text });
      this.txt(x + 12, cy + 28, s.body.join("\n\n"), { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: w - 24 }, lineSpacing: 3 });
    });
  }

  // ---- SEC. 14 — Ranks & Command (single page) ---------------------------
  private renderRanksLore(x: number, y: number, w: number, h: number) {
    const cardH = (h - 12) / RANKS.length;
    RANKS.forEach((r, i) => {
      const cy = y + i * (cardH + 12);
      this.drawCard(x, cy, w, cardH, "");
      this.txt(x + 12, cy + 8, r.title, { fontFamily: "monospace", fontSize: "13px", color: PAL.text });
      this.txt(x + 12, cy + 28, r.body.join("\n\n"), { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: w - 24 }, lineSpacing: 3 });
    });
  }

  // ---- SEC. 15 — Glossary (paged, 5/page) --------------------------------
  private renderGlossary(x: number, y: number, w: number, h: number) {
    const perPage = 5;
    const items = GLOSSARY.slice(this.page * perPage, this.page * perPage + perPage);
    const rowH = Math.floor(h / perPage);
    items.forEach((g, i) => {
      const ry = y + i * rowH;
      this.txt(x, ry, g.term, { fontFamily: "monospace", fontSize: "11px", color: PAL.accent });
      this.txt(x + 150, ry, g.def, { fontFamily: "monospace", fontSize: "9px", color: PAL.textMuted, wordWrap: { width: w - 150 }, lineSpacing: 2 });
      if (i < items.length - 1) {
        const line = this.add.rectangle(x + w / 2, ry + rowH - 6, w, 1, PAL.cardBorder, 0.6);
        this.contentLayer.add(line);
      }
    });
  }
}
