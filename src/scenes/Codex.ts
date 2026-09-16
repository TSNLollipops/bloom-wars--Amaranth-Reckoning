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
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";
import { renderFieldNotesList } from "./ui/FieldNotesPanel";
import { buildNotesRows, loadPlayerNotes, notesPageCount } from "../data/playerNotes";


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
// Ship audit, 16 Sep 2026 (§1.6) — rewritten against the live Battle screen.
// The previous rows said "no hotkeys," put END TURN bottom-right and mission
// select top-right, and listed Team One tabs; none of it survived the 12 Sep
// HUD relayout. Every position and key below was checked against Battle.ts.
const CONTROLS: ControlRow[] = [
  { key: "Click a unit", desc: "Selects it. The board lights up around it: green tiles it can move to, red enemies it can hit, cyan allies a Munti can Repair instead of attacking. Hover anything — a unit, a tile, a button — for a tip." },
  { key: "Click green", desc: "Moves there. Costs 1 action, does not end your turn — the unit stays selected and its options recompute.", chip: "go" },
  { key: "Click red", desc: "Attacks. Costs every action the unit has left and ends its turn immediately, no matter how many actions were still in the bank.", chip: "danger" },
  { key: "Click cyan", desc: "Munti only — heals that ally instead of attacking. Costs 1 action, does not end the turn.", chip: "info" },
  { key: "Action bar", desc: "Bottom-left, above END TURN, once a unit is selected: Overwatch, Ambush and whatever else that unit carries. Click a slot or press its number (1-6). Hover a slot for exactly what it does and what it costs." },
  { key: "End Turn", desc: "Bottom-left button, or Space. If anyone can still act you get a prompt first — Space again ends the turn anyway, Esc keeps playing. Then the hostile phase plays out move by move, the environment step ticks (Bloom mat, deploy-pad healing, shields and regen), and the turn is yours." },
  { key: "Tab · Esc · R-click", desc: "Tab cycles through your units that can still act. Esc or right-click cancels whatever is open — a prompt, an aimed ability, then the selection itself." },
  { key: "[ and ]", desc: "Hide or show the left (briefing) and right (comms) columns to give a wide map the room." },
  { key: "T · :notes · :help", desc: "T opens the comms box — a selected pilot hears you, or name one with :t. Type :notes and a line to jot a Field Note mid-fight. :help lists every command." },
  { key: "< mission select", desc: "Top-left. Asks first, then scraps the attempt: nothing is saved mid-mission, nothing is lost or earned, and the mission is available again. HOW TO PLAY next to it opens this manual without leaving the fight." },
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
  { swatch: 0x2f4f4f, name: "Dock perimeter", cost: "1", def: "\u2605\u2605", desc: "The defended ring around a protect_asset objective. Two defence stars — and every hostile that ENDS its turn inside it costs the asset health." },
  { swatch: 0x151515, name: "Wall", cost: "∞", def: "—", desc: "Solid. Nothing gets through it, flyers included." },
];

interface AbilityRow {
  name: string;
  tag: string;
  desc: string;
}
const ABILITIES: AbilityRow[] = [
  { name: "Overshield", tag: "Tank, passive", desc: "While an Overshield Tank is alive on the board, every adjacent ally gets +1 terrain defence star (10% less damage taken). Doesn't stack with a second Tank." },
  { name: "Repair", tag: "Munti, active", desc: "Instead of attacking: heal one adjacent ally 30 HP (38 if the Munti's Mek runs Fieldwright as primary). Costs 1 action, doesn't end the turn." },
  { name: "Charge", tag: "Centauroid, passive", desc: "Move 3+ tiles in an unbroken straight line over cost-1 terrain, then attack at the end of it — +25% damage." },
  { name: "Sensor Sweep", tag: "Vibrissal, passive", desc: "Vibrissal-chassis pilots passively detect burrowed units within their own radius — a real mechanical edge against Undertow. A Runemaster-primary Mek extends that reach further." },
  { name: "Meeps Dodge", tag: "house rule", desc: "40% chance to take zero damage from any single hit — as the target, and again on the counter-hit a Meeps eats after attacking something that counters back. Two independent rolls." },
  { name: "Tank Shield", tag: "house rule", desc: "Overshield also grants a real 20-point shield (absorbs before HP) to the Tank and every adjacent ally. Regens 8/turn only if that unit took zero damage since the last tick." },
  { name: "Munti Regen", tag: "house rule", desc: "Every living Munti passively heals itself and same-side allies within 2 tiles for 8 HP/turn — free, stacks with active Repair, doesn't stack across multiple Muntis." },
  { name: "2 Actions / Turn", tag: "house rule", desc: "Move and Repair each cost 1 action and don't end your turn. Attack always burns every remaining action, whichever slot it's used in." },
  // Ejection capsules, 15 Sep 2026 — engine/mission.ts's EjectionCapsule header has the rules.
  { name: "Ejection Capsules", tag: "house rule", desc: "A downed mech leaves its pilot's capsule on the tile. A Munti next to it can recover it (1 action). Recovered pilots always come home. Anyone left out is saved on a win only if a Munti is still standing, and lost for good on a loss." },
  { name: "Prisoners", tag: "house rule", desc: "Enemy mechs eject too (named rivals are pulled out by their own side). Any unit next to an enemy capsule can take the pilot (1 action). Win the mission and Debrief asks: ransom them for points, or recruit them." },
];

interface ObjectiveRow {
  name: string;
  color: "go" | "danger";
  desc: string;
}
// Rewritten 7 Sep 2026. This documented three objective types; the game has
// shipped seven since Mission 22 (data/types.ts's own union). A player who
// hit protect_asset or contested_landing had no way to learn the win
// condition except by losing. "color" is the card's heading tint: go = the
// clock cannot beat you, danger = it can.
const OBJECTIVES: ObjectiveRow[] = [
  { name: "eliminate_all", color: "go", desc: "Kill every hostile. The turn number on the briefing is a bonus target, not a deadline — running past it costs you a reward, never the mission. Only losing your whole squad ends it early." },
  { name: "hold_zone", color: "danger", desc: "Get a unit onto the gold hold tiles and keep every hostile off them from the hold-turn on. Real deadline: hostiles holding the zone unopposed past turn 2 is an instant loss." },
  { name: "extract_unit", color: "danger", desc: "Get the named unit onto a green exit tile before the turn limit. Real deadline — the rescue-mission clock, kept on purpose." },
  { name: "clear_bloom", color: "go", desc: "Win when no bloom-mat tile is left on the board. The mat regrows each environment step, so clear it faster than it spreads. No timeout loss." },
  { name: "survive_n_turns", color: "go", desc: "Win the instant the turn count is reached with the squad still standing. Nothing else has to survive — a squad wipe already ends any mission." },
  { name: "contested_landing", color: "go", desc: "Mechanically the same as eliminate_all: kill everything, no timeout loss. The name is a warning about the opening, not a different rule — hostiles are already on top of your deploy pads at turn 1, with no grace period before contact." },
  { name: "protect_asset", color: "danger", desc: "Something off-board has its own health bar and a defended perimeter around it. It loses health once a turn for EVERY HOSTILE THAT ENDS ITS TURN INSIDE THE PERIMETER — not for every hostile that attacks. Pulling them out of the zone is the whole job. Reaching the turn limit with the asset alive is a win; the asset hitting zero is the loss." },
];

interface RosterRow {
  callsign: string;
  name: string;
  path: string;
  chassis: string;
  mek: string;
  role: string;
}
// Rewritten 7 Sep 2026. This was five hard-coded Warden pilots — wrong
// content for a House Amaranth save, and redundant since the Archive's
// Personnel shelf reads the live roster. A manual's job is the SYSTEM, so
// the rows below are the three things that decide what a mech does before
// it is handed a single piece of gear. Column headers reused as-is.
const ROSTER: RosterRow[] = [
  { callsign: "PATH", name: "Meeps · Reeps · Tank · Munti", path: "role", chassis: "sets the class triangle", mek: "—", role: "The combat role. Meeps beat Tank, Tank beats Reeps, Reeps beat Meeps. Munti sits outside it entirely and loses every column: it is not a fighting path and no matchup makes it one." },
  { callsign: "CHASSIS", name: "bipedal · centauroid · vibrissal", path: "species", chassis: "never changes", mek: "—", role: "Comes from the pilot's species and is fixed for life. Bipedal is the default. Centauroid can Charge. Vibrissal reads the ground close-in and finds what is buried in it." },
  { callsign: "MEK", name: "Fabricator · Armorer · Runemaster · Fieldwright · Quartermaster", path: "track", chassis: "the cradle", mek: "primary", role: "The person in the cradle. A Mek's PRIMARY track changes what that one pilot's frame actually does, which is why two identical mechs with different Meks are not identical mechs. Five tracks; a Mek can buy a secondary." },
  { callsign: "TIER", name: "G · F · E · D · C · B · A · S", path: "gear", chassis: "bought with points", mek: "—", role: "The gear ladder, climbed with that pilot's own personal points rather than time served. S is the Heirloom rung and nothing can be bought up to it." },
  { callsign: "ROSTER", name: "not fixed", path: "live", chassis: "recruit · assign · lose", mek: "—", role: "Pilots are recruited into lances, moved between them, and lost. Who is on yours right now is in the Archive's Personnel shelf, not in this manual." },
];

interface MissionRow {
  title: string;
  tags: string[];
  desc: string;
  tip: string;
}
// Rewritten 7 Sep 2026. This listed four missions from a build that had four
// missions in it; there are now 36 per campaign across two campaigns, and
// enumerating 72 does not belong in a manual. What DOES belong is how to
// read the briefing panel, because misreading the turn number is the most
// common way a squad loses a mission it was winning.
const MISSIONS: MissionRow[] = [
  {
    title: "The turn number means two different things",
    tags: ["read this one", "bonus target vs. deadline"],
    desc: "For eliminate_all, clear_bloom, contested_landing and protect_asset it is a BONUS TARGET — running past it costs a reward and nothing else. For hold_zone, extract_unit and survive_n_turns it IS the mission. Same number, same place on the panel, opposite meaning. Check the objective name first, every time.",
    tip: "If the objective is one of the four bonus-target kinds, you are never on a clock. Take the careful line.",
  },
  {
    title: "The briefing tells you what intelligence expected",
    tags: ["not a guarantee", "waves arrive on their own schedule"],
    desc: "The Transporter Pad and the left column in the fight carry the briefing and the objective. Waves arrive on their own timer and the briefing does not always know about the second one. Plan the fight you were given, then keep a unit uncommitted for the one you were not.",
    tip: "A squad that has spent every action by turn 3 has no answer to a wave that lands on turn 4.",
  },
  {
    title: "Read the ground on turn 1, before anyone moves",
    tags: ["Sec. 03", "bloom mat, ridge, structure"],
    desc: "Tile colour is rules data, not decoration. Bloom mat costs you for ending a move on it. Ridge and Structure are the two worth walking further to reach. Hover a tile for its cost and cover before you commit a move — the first turn is usually quiet enough to look.",
    tip: "Put the Tank in the doorway. There is almost always a doorway.",
  },
];

// Ship audit, 16 Sep 2026 — the rules a tester met on screen with nothing
// explaining them: fog of war (hostiles are only drawn while a unit of yours
// can see them, and nothing said so), commander down, the sortie clock,
// Ironman, points. Same card shape as MISSIONS; rendered by renderCards.
const RULES: MissionRow[] = [
  {
    title: "You only see what your squad can see",
    tags: ["fog of war", "read this one"],
    desc: "A hostile is drawn on the board only while one of your living units has it in sight (each unit's 'sees N' on its hover tip). Tiles nobody can see are dimmed. An empty-looking board on turn 1 is not an empty board — the first wave is usually already out there, past your sight. Sensor Sweep reveals through the fog for a turn; a vibrissal chassis also finds burrowed units close in.",
    tip: "Move in a line, not a spread — every unit that steps forward pushes the edge of what you can see.",
  },
  {
    title: "Commander down ends the attempt, not the campaign",
    tags: ["no losses", "no earnings", "try again"],
    desc: "If your commanding pilot goes down, the mission stops on the spot: nothing is lost, nothing is earned, no permadeath check, and the mission is available again from mission select. Everyone else who went down that attempt is fine too. It is the one way a fight ends without a Debrief.",
    tip: "Keep the commander one tile behind the Tank. She does not have to lead to be in charge.",
  },
  {
    title: "The sortie clock — twelve real hours",
    tags: ["real time", "Command recalls you"],
    desc: "BEAM DOWN starts a clock in real time. A sortie that is still open twelve hours later — a tab left open overnight, a laptop closed mid-fight — is recalled by Command the next time the game loads: nothing lost, no permadeath roll, the mission simply available again. Nothing is saved mid-mission, so a fight has to be finished in one sitting either way.",
    tip: "Abandon a sortie on purpose with < mission select rather than leaving it open; the clock stops and the crew stop worrying.",
  },
  {
    title: "Ironman is on by default",
    tags: ["one save", "no rewinds"],
    desc: "The IRONMAN box on the New Campaign screen is checked unless you uncheck it. Checked: one live save that overwrites itself, no manual slots, no LOAD GAME. Unchecked: SAVE... on the pause menu, the Campaign Shop or the Debrief writes one of three slots you can come back to. A pilot lost is lost either way — Ironman only decides whether you can rewind the campaign around it.",
    tip: "First run, uncheck it. The second run is when it means something.",
  },
  {
    title: "Two kinds of points",
    tags: ["personal", "company"],
    desc: "Every deployed pilot earns PERSONAL points after a mission (their own gear ladder: tier upgrades, a second Mek track, weapon branches — spent on the Debrief shop). The COMPANY pool is separate: completion, turns under the target, nobody downed, no spare parts spent, plus the CO's bonus. It pays for recruits, carrier bays and the bigger purchases in the Campaign Shop. A pilot can convert personal points to company at a loss.",
    tip: "The personal pool of a pilot you lose goes with them. Spend before you sortie.",
  },
  {
    title: "Stress, Morale and Favorability",
    tags: ["the crew", "why they refuse"],
    desc: "Every pilot carries Stress (0-100, up from losses and a bad night, down from rest, drinks and a good word) and Morale (the opposite). Stress past 70 with a worry on their mind risks a breakdown in the Hub. Favorability is how they feel about you — praise, gifts, a drink and a won fight raise it; insults and losses lower it. Some verbs refuse below a threshold (Flirt needs 40+). Hover a crew member aboard ship to read all three.",
    tip: "The Debrief's WHAT THEY TOOK FROM IT block is these numbers moving. Watch the one who took it 'shaken'.",
  },
];

// The Hub, transcribed from HOW_TO_PLAY.html §10 (which never shipped in
// the game's own manual) and checked against Hub.ts's controls strip.
const SHIP: MissionRow[] = [
  {
    title: "Getting around",
    tags: ["WASD / arrows", "E", "T"],
    desc: "Between missions you walk the ship. WASD or the arrow keys move you. E at a door, a console or a crew member interacts — clicking works too. T opens the chat box to type something real to whoever is nearest. H is your history, L the highlights reel, B the Rec Room standings board. Walk onto the BAY pad on the Hangar Deck and press E to muster and launch the next mission.",
    tip: "The controls strip along the top of the ship never goes away. When in doubt, read it.",
  },
  {
    title: "The decks",
    tags: ["four decks", "stairs and corridors"],
    desc: "LOWER: Rec Room (games, the standings board), the Hangar Deck (ROSTER & GEAR, recruiting, the muster BAY), Berths. GROTTO: the CO's post, the Workshop and the Meks, Engineering and the buildable bays. UPPER: the Vault (Heirlooms, house standing), CIC (the Archive's tactical table), the forward bays. Off the Rec Room: the Spar Room.",
    tip: "The Archive on the CIC's table is where the lore, the personnel files and the bestiary live — this manual is only the rules.",
  },
  {
    title: "The CO signs off before you fly again",
    tags: ["the Grotto", "check-in gate"],
    desc: "After your first mission ends, the BAY will not launch the next one until you have reported to the CO in the Grotto. Talk to him, ask him anything, or send a build request — any of the three clears it. Skip him and BEAM DOWN tells you why it is refusing.",
    tip: "'Build me a Generator' is the first useful thing to say to him. Most bays need it.",
  },
  {
    title: "Talking to the crew",
    tags: ["typed verbs", ":help"],
    desc: "Press T near someone and type. Plain phrases land as real verbs: 'hey' or 'any advice' (small talk), 'grab a drink' (Share a Drink), 'great job' (Praise), 'congrats' (Congratulate), 'sorry' (Apology), 'you're useless' (Insult — it escalates), 'here's a gift', 'ask her out', 'wish me luck' (Send-Off before a sortie), 'let's spar', 'how are you holding up' (a check-in), 'move it' (clears a doorway jam), 'peg' / 'poker' / 'darts' (the Rec Room games). Type :help for the full list, :notes for your notebook.",
    tip: "Everyone answers in their own voice. The [Green] / [Blooded] / [Command] tag over a head is their career stage — G-F tier, E-D-C, or B and up.",
  },
  {
    title: "Days pass while you play",
    tags: ["the calendar", "Day N"],
    desc: "The Day counter at the top of the ship is real time: about six minutes of play is a day, aboard or on a sortie, and finishing a mission costs two more. Some things the crew do take days of their own. Nothing here is a deadline — it is the campaign's clock, the one the crew's memories and the standings board are dated by.",
    tip: "THREAT at the top right is the Bloom's distance from the ship. In this release it stays DISTANT.",
  },
  {
    title: "Saving aboard ship",
    tags: ["MENU", "SAVE..."],
    desc: "The MENU button on the ship, the Campaign Shop and the Debrief opens Save (non-Ironman only), Options, this manual and Return to Main Menu. Returning to the main menu saves first. The live save is written every time something happens aboard — a mission result, a purchase, a conversation — so a closed tab costs you at most a few steps of walking.",
    tip: "Options has EXPORT SAVE. Paste the text somewhere safe before a big browser update — browser saves can be cleared by the browser.",
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
}
const SECTIONS: CodexSection[] = [
  { id: "controls", num: "01", title: "Controls", dek: "Click to do everything. A few keys make it faster: Space ends the turn, Tab cycles units, Esc cancels.", pageCount: 2 },
  { id: "units", num: "02", title: "Reading the Board", dek: "Every unit is a shape. Shape says class, fill says side, outline says chassis. Dimmed tiles are out of your sight.", pageCount: 1 },
  { id: "terrain", num: "03", title: "Terrain", dek: "Tile colour on the board is the actual rules data, not decoration. Fourteen types.", pageCount: 2 },
  { id: "bars", num: "04", title: "Health, Shield & Collapse", dek: "Every unit shows a small bar above it. What's stacked there depends on what kind of unit it is.", pageCount: 1 },
  { id: "triangle", num: "05", title: "The Class Triangle", dek: "Meeps > Reeps > Tank > Meeps. Munti sits outside the triangle entirely.", pageCount: 1 },
  { id: "abilities", num: "06", title: "Abilities & House Rules", dek: "Four that come with a chassis or a path, and six house rules this game made up for itself.", pageCount: 3 },
  { id: "objectives", num: "07", title: "Objectives", dek: "Seven objective types. Four cannot be lost on the clock. Three can.", pageCount: 2 },
  { id: "roster", num: "08", title: "Paths, Chassis and Mek Tracks", dek: "The three things that decide what a mech does before you buy it a single piece of gear.", pageCount: 1 },
  { id: "missions", num: "09", title: "Reading a Briefing", dek: "The briefing names the win condition. Read the turn number correctly.", pageCount: 2 },
  // Ship audit, 16 Sep 2026 — the two sections a tester needed and the
  // manual didn't have: what the board is hiding from you, and the ship.
  { id: "rules", num: "10", title: "Sight, Clocks & Losing", dek: "The rules nothing on the board explains by itself: fog of war, commander down, the twelve-hour sortie clock, Ironman, points, the crew's numbers.", pageCount: 3 },
  { id: "ship", num: "11", title: "The Ship", dek: "Between missions you walk the carrier. Where things are, who to talk to, what to type, and why the BAY sometimes says no.", pageCount: 3 },
  // Field Notes, 12 Sep 2026 (Mission Chat / Player Notes / Battle HUD
  // Relayout Plan v1, Workstream 1). The one section here that is player-
  // AUTHORED rather than transcribed from HOW_TO_PLAY.html — but it belongs
  // in this scene, not the Archive: the Archive is in-fiction lore and
  // personnel, and a field note is the player's own knowledge (it survives
  // permadeath and a lost campaign by design), which is exactly this
  // scene's "out-of-fiction, needs no save" register. pageCount is a
  // placeholder; renderSection sizes the real one from the notebook.
  { id: "notes", num: "12", title: "Field Notes", dek: "Your own notebook. Written from the chat box with :notes <text>, aboard or mid-mission, and kept across every campaign.", pageCount: 1 },
];

export class Codex extends Phaser.Scene {
  private returnScene = "MainMenu";
  // Ship audit, 16 Sep 2026 — opened as an OVERLAY from Battle and the
  // Transporter Pad (launch + pause, same idiom Archive uses over the Hub)
  // rather than by scene.start, which would have destroyed the live mission
  // underneath. When true, BACK stops this scene and resumes the caller
  // instead of starting it fresh.
  private launched = false;
  private sectionIndex = 0;
  private page = 0;
  private categoryLayer!: Phaser.GameObjects.Container;
  private contentLayer!: Phaser.GameObjects.Container;
  private navLayer!: Phaser.GameObjects.Container;
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // Plain scene class, no competing scene-wide hover system — same simple
  // shape as Options.ts/ShopPanel.ts, one shared instance for everything.
  private hoverTip!: HoverTip;


  private readonly contentX = 262;
  private readonly contentY = 96;
  private readonly contentW = 788;
  private readonly contentH = 504;

  constructor() {
    super("Codex");
  }

  // campaignState is still passed by MainMenu.ts and MenuOverlay.ts and is
  // deliberately ignored: as of 7 Sep 2026 nothing in this scene reads a
  // save. Every lore section that did moved to scenes/Archive.ts, which is
  // reached from the tactical table in the CIC and gets the live state from
  // the Hub. Left in the call signature rather than chased through two call
  // sites, so this can be re-typed rather than re-plumbed if it ever needs
  // the save again.
  init(data: { returnScene?: string; section?: string; launched?: boolean }) {
    this.returnScene = data.returnScene ?? "MainMenu";
    this.launched = data.launched === true;
    // ":notes" typed with no text (Hub.ts's submitChat) opens straight onto
    // FIELD NOTES; anything else, or nothing, lands on section 01 as before.
    const wanted = data.section ? SECTIONS.findIndex((sec) => sec.id === data.section) : -1;
    this.sectionIndex = wanted === -1 ? 0 : wanted;
    this.page = 0;
  }




  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    this.hoverTip = new HoverTip(this);
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
    this.add.text(ccx, 48, "HOW TO PLAY", { fontFamily: "monospace", fontSize: "24px", color: PAL.text }).setOrigin(0.5);
    this.add.text(24, 26, "OUT-OF-FICTION HELP — LORE LIVES AT THE ARCHIVE", { fontFamily: "monospace", fontSize: "9px", color: PAL.textFaint }).setOrigin(0, 0.5);
    this.add.rectangle(ccx, 74, this.cameras.main.width - 40, 1, PAL.cardBorder);

    this.add
      .rectangle(this.contentX + this.contentW / 2, this.contentY + this.contentH / 2, this.contentW, this.contentH, PAL.panel, 1)
      .setStrokeStyle(1, PAL.panelBorder);

    makeShopButton(
      this,
      this.add.container(0, 0),
      ccx,
      616,
      220,
      32,
      "BACK",
      true,
      () => {
        if (this.launched) {
          this.scene.stop();
          this.scene.resume(this.returnScene);
          return;
        }
        this.scene.start(this.returnScene);
      },
      ["Back", "", ...wrapTipText("Returns to wherever this manual was opened from. Nothing here is saved or changed by browsing it.", 42)],
      this.hoverTip
    );
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
      const secTip = [`${sec.num} — ${sec.title}`, "", ...wrapTipText(sec.dek, 42)];
      bg.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (i !== this.sectionIndex) bg.setFillStyle(0x22303c, 1);
        this.hoverTip.show(secTip, pointer.x, pointer.y);
      });
      bg.on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(secTip, pointer.x, pointer.y));
      bg.on("pointerout", () => {
        bg.setFillStyle(i === this.sectionIndex ? PAL.playerBlue : PAL.cardBg, 1);
        this.hoverTip.hide();
      });
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
    // FIELD NOTES' page count is the notebook's, not a static number — read
    // it fresh every render so a deletion re-sizes the nav (and clamps the
    // page) without any separate bookkeeping.
    const pageCount = sec.id === "notes" ? notesPageCount(buildNotesRows(loadPlayerNotes())) : sec.pageCount;
    if (this.page > pageCount - 1) this.page = pageCount - 1;
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
    const bodyBottom = this.contentY + this.contentH - (pageCount > 1 ? 34 : 14);
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
      case "rules": this.renderCards(RULES, bodyX, bodyTop, bodyW, bodyH); break;
      case "ship": this.renderCards(SHIP, bodyX, bodyTop, bodyW, bodyH); break;
      case "notes":
        renderFieldNotesList({
          scene: this,
          layer: this.contentLayer,
          hoverTip: this.hoverTip,
          x: bodyX,
          y: bodyTop,
          w: bodyW,
          h: bodyH,
          page: this.page,
          onChanged: () => this.renderSection(),
        });
        break;
    }

    // Every section left in this scene is out-of-fiction help with no save
    // requirement, so page nav is purely "does this one have more than one
    // page." The needsSave branch went with the lore sections.
    if (pageCount > 1) this.drawPageNav(pageCount);
  }


  private drawPageNav(pageCount: number) {
    const y = this.contentY + this.contentH - 18;
    const rx = this.contentX + this.contentW - 90;
    makeShopButton(
      this,
      this.navLayer,
      rx - 44,
      y,
      26,
      22,
      "<",
      this.page > 0,
      () => { this.page--; this.renderSection(); },
      ["Previous Page", "", ...wrapTipText("Back one page within this section.", 42)],
      this.hoverTip
    );
    const label = this.add.text(rx, y, `PAGE ${this.page + 1} / ${pageCount}`, { fontFamily: "monospace", fontSize: "10px", color: PAL.textMuted }).setOrigin(0.5);
    this.navLayer.add(label);
    makeShopButton(
      this,
      this.navLayer,
      rx + 44,
      y,
      26,
      22,
      ">",
      this.page < pageCount - 1,
      () => { this.page++; this.renderSection(); },
      ["Next Page", "", ...wrapTipText("Forward one page within this section.", 42)],
      this.hoverTip
    );
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
    // Five rows a page (16 Sep 2026 — ten rows on one page wrapped into
    // each other once the End Turn and Action bar entries grew).
    const perPage = 5;
    const rows = CONTROLS.slice(this.page * perPage, this.page * perPage + perPage);
    const rowH = Math.floor(h / perPage);
    const keyW = 170;
    rows.forEach((row, i) => {
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
      if (i < rows.length - 1) {
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

  // ---- SEC. 06 — Abilities & house rules (paged, 4/4/2) ----------------
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
    // Was three cards across one row, sized for exactly three objectives.
    // There are seven (data/types.ts), so this is renderAbilities' own 2x2
    // paged grid instead — the layout already proven on four longer cards.
    const perPage = 4;
    const items = OBJECTIVES.slice(this.page * perPage, this.page * perPage + perPage);
    const cardW = (w - 16) / 2;
    const cardH = (h - 16) / 2;
    items.forEach((o, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = x + col * (cardW + 16);
      const cy = y + row * (cardH + 16);
      this.drawCard(cx, cy, cardW, cardH, "");
      this.txt(cx + 12, cy + 10, o.name, { fontFamily: "monospace", fontSize: "12px", color: o.color === "go" ? PAL.go : PAL.danger });
      this.txt(cx + 12, cy + 28, o.color === "go" ? "NO TIMEOUT LOSS" : "REAL DEADLINE", { fontFamily: "monospace", fontSize: "8px", color: PAL.textFaint });
      this.txt(cx + 12, cy + 44, o.desc, {
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
    // Was a five-column table of five hard-coded Warden pilots. The rows are
    // now the three systems that decide what a mech is, whose text does not
    // fit a 145px column, so this renders as stacked cards instead. The live
    // roster moved to the Archive's Personnel shelf.
    const rowH = Math.floor(h / ROSTER.length);
    ROSTER.forEach((r, i) => {
      const ry = y + i * rowH;
      this.drawCard(x, ry, w, rowH - 6, "");
      this.txt(x + 12, ry + 8, r.callsign, { fontFamily: "monospace", fontSize: "11px", color: PAL.accent });
      this.txt(x + 96, ry + 9, r.name, { fontFamily: "monospace", fontSize: "9px", color: PAL.text, wordWrap: { width: w - 108 } });
      this.txt(x + 12, ry + 26, r.role, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PAL.textMuted,
        wordWrap: { width: w - 24 },
        lineSpacing: 2,
      });
    });
  }


  // ---- SEC. 09 — Mission briefings (paged, 2/2) ------------------------
  private renderMissions(x: number, y: number, w: number, h: number) {
    this.renderCards(MISSIONS, x, y, w, h);
  }

  /** Two cards per page — title, tag chips, body, TIP line. Shared by Reading a Briefing, Sight/Clocks/Losing and The Ship. */
  private renderCards(rows: MissionRow[], x: number, y: number, w: number, h: number) {
    const perPage = 2;
    const items = rows.slice(this.page * perPage, this.page * perPage + perPage);
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

}
