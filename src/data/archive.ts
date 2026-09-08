// ---------------------------------------------------------------------
// THE ARCHIVE — the reworked Codex's content layer.
//
// Replaces the flat fifteen-tab Codex (scenes/Codex.ts + data/codex.ts) with
// five shelves of thirteen sections, one entry at a time in a real reader.
// Written 7 Sep 2026 from the approved sandbox mockup ("Bloom Wars Archive
// Sandbox" v1.14) — see Bloom_Wars_Codex_Rework_Plan_v1.md for the decisions
// behind every field here, and Bloom_Wars_Verinis_Voice_Bank_v1.md 12b-12d
// for the register split ("synker" in official documents, "pilot" everywhere
// else) that decides which noun each entry uses.
//
// PURE DATA. This module imports only from sibling data/ modules, never from
// engine/ — the same rule every other file in data/ follows. The live per-
// pilot dossier block (rank, stress, morale, standing, service record) is
// NOT here: it is derived from CampaignState in engine/archiveDossier.ts,
// because it needs the save. Nothing in this file is authored per pilot.
//
// data/codex.ts is deliberately still standing. It keeps the shipped Codex
// scene alive until scenes/Archive.ts replaces it, so this file can land,
// typecheck and be tested without breaking a screen that currently works.
// ---------------------------------------------------------------------

import { STRESS_PANIC_THRESHOLD, MORALE_PANIC_THRESHOLD } from "./ambientLines";
import {
  RELATIONSHIP_DATING_FAVORABILITY,
  RELATIONSHIP_COMMITTED_FAVORABILITY,
} from "./relationshipStage";

/** Which campaign's console the archive is being read on. */
export type ArchiveFacility = "warden" | "amaranth";

/**
 * What kind of document an entry is. Rendered as the KIND label above the
 * title, and the reason the archive can carry a research paper that is wrong
 * in-fiction without the game itself lying to the player: the paper is filed
 * as a Paper, with an author and a reliability mark, and the reader decides.
 */
export type ArchiveKind = "Field note" | "Dossier" | "Brief" | "Paper" | "Record" | "Reference";

/**
 * Mission number that must be RESOLVED (won or lost) for an entry to unlock.
 * A plain number gates both consoles at the same mission; the object form
 * gates each campaign at its own, because the two campaigns meet the same
 * things at different points. null is ungated.
 */
export type ArchiveGate = number | { warden: number; amaranth: number } | null;

/** A per-facility string, for entries whose source differs by campaign. */
export type ArchiveByFacility<T> = T | { warden: T; amaranth: T };

export interface ArchiveProvenance {
  /** Who wrote it. */
  source: ArchiveByFacility<string>;
  /** What kind of document it was filed as, in its own words. */
  filedAs: string;
  /** 3 reviewed, 2 working, 1 unreviewed or partisan. */
  reliability: 1 | 2 | 3;
  /** One line on how far to trust it. Never says a document is false. */
  note: string;
}

/** An entry that grows as the campaign moves. The latest unlocked one wins. */
export interface ArchiveRevision {
  after: ArchiveGate;
  body: string[];
}

/** A trailing labelled block under the main body (dossiers use it for Meks). */
export interface ArchiveTail {
  heading: string;
  body: string;
}

/**
 * Which live status line a personnel dossier ends on. The text itself comes
 * from engine/archiveDossier.ts against the save, never from here.
 */
export type ArchiveStatusMode = "rourke" | "co" | "roster" | "mc";

export interface ArchiveEntry {
  id: string;
  section: ArchiveSectionId;
  kind: ArchiveKind;
  title: string;
  gate: ArchiveGate;
  /** Absent = shown on both consoles. */
  fac?: ArchiveFacility;
  prov?: ArchiveProvenance;
  /** Single-version body. Mutually exclusive with `revisions`. */
  body?: string[];
  tail?: ArchiveTail;
  /** Multi-version body; the latest unlocked revision is what renders. */
  revisions?: ArchiveRevision[];
  statusMode?: ArchiveStatusMode;
}

export interface ArchiveSection {
  id: ArchiveSectionId;
  label: string;
}

export interface ArchiveShelf {
  id: string;
  /** Shelf names differ by console: Warden has a Company, the House has a House. */
  label: ArchiveByFacility<string>;
  sections: ArchiveSection[];
}

export type ArchiveSectionId =

  | "personnel"
  | "ranks"
  | "bestiary"
  | "research"
  | "history"
  | "leadership"
  | "species"
  | "civilian"
  | "tech"
  | "world"
  | "systems"
  | "glossary"
  | "manual";


// ---------------------------------------------------------------------
// Shelves. Fifteen flat tabs became five shelves; nothing is scoped to one
// campaign at the SHELF level any more, because both consoles now have
// content on every section. What differs is which entries sit on it.
// ---------------------------------------------------------------------
export const ARCHIVE_SHELVES: ArchiveShelf[] = [
  {
    id: "company",
    label: { warden: "The Company", amaranth: "The House" },
    sections: [
      { id: "personnel", label: "Personnel" },
      { id: "ranks", label: "Ranks & Command" },
    ],
  },
  {
    id: "bloom",
    label: { warden: "The Bloom", amaranth: "The Bloom" },
    sections: [
      { id: "bestiary", label: "Bestiary" },
      { id: "research", label: "Research" },
    ],
  },
  {
    id: "coalition",
    label: { warden: "The Coalition", amaranth: "The Coalition" },
    sections: [
      { id: "history", label: "History" },
      { id: "leadership", label: "Leadership" },
      { id: "species", label: "Member Species" },
      { id: "civilian", label: "Civilian Life" },
      { id: "tech", label: "Technology" },
    ],
  },
  {
    id: "reach",
    label: { warden: "The Reach", amaranth: "The Reach" },
    sections: [
      { id: "world", label: "The Amaranth Reach" },
    ],
  },
  {
    id: "reference",
    label: { warden: "Reference", amaranth: "Reference" },
    sections: [
      { id: "systems", label: "Systems" },
      { id: "glossary", label: "Glossary" },
      { id: "manual", label: "Field Manual" },
    ],
  },
];


// ---------------------------------------------------------------------
// Entries. Order inside a section is the order they render.
// ---------------------------------------------------------------------
export const ARCHIVE_ENTRIES: ArchiveEntry[] = [

  // ---- personnel -----------------------------------------------------
  // Personnel — the roster, one dossier per person. The live block that
// opens each of these is derived from the save, not written here.
  {
    id: "pilot_rourke",
    section: "personnel",
    kind: "Dossier",
    title: "2nd Lt. Dessa Rourke — \"Lark\"",
    gate: null,
    fac: "warden",
    statusMode: "rourke",
    body: [
      "Meeps. Human. Green when this started, and it showed — quick, aggressive, not yet a commander. Still leading from the front. The unit under her now carries the opposite of her own callsign.",
      "By Mission 12 she's carrying Capt.'s bars, and Maj.'s by Mission 24 — Company Commander over the whole force, both times. Neither promotion pulls her out of Lance A. She's still its Lead in person, still the same lance she's run since Mission 1, just with more of Warden Company answering to her on top of it.",
    ],
    tail: { heading: "MEK — mek_rourke, catalyst Raven", body: "Grew up on a working dock on Glasswater itself, close enough to the sector capital's real labor to know exactly what keeps a comfortable world running underneath it. That's the same instinct that makes a good Mek: quietly making sure Rourke's own rig is right before she ever has to ask." },
  },
  {
    id: "pilot_bosk",
    section: "personnel",
    kind: "Dossier",
    title: "M.Sgt. Halvard Bosk — \"Anvil\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Tank. Human. Came up through House Amaranth's own regulars before Warden Company folded him in. Raised in a garrison quarter on Glasswater itself — comfortable enough by any Reach standard, but a garrison childhood shows you exactly what that comfort actually costs to keep, and Bosk came out the other side of it not cynical, just exact. He explains a thing once, correctly, and expects you to have heard him. That's the instinct every newer pilot in the company leans on without being told to.",
    ],
    tail: { heading: "MEK — mek_bosk, catalyst Bear", body: "A different upbringing entirely from his own pilot's — Tallowmere's smoky industrial anchor world, hit hard and early, learned to keep its own counsel and just work. The steady, self-contained presence at Bosk's back that never needs him to check on it." },
  },
  {
    id: "pilot_iyari",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Tegan Iyari — \"Foxfire\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Meeps. Hiopi — centauroid frame. Grew up on Emberfall, a refinery world the Bloom had already reached, close enough to an unmarked preserve boundary nobody in her family ever fully explained. Real frontier hardship the whole way through, and she met it by finding something to laugh about anyway, every time — not a habit she picked up later, the same thing that makes her the one already cracking a joke before anyone else has finished processing what just happened.",
    ],
    tail: { heading: "MEK — mek_iyari, catalyst Fox", body: "Raised on money that never quite matched the plateau world around it, tested into a prestige Core academy despite frontier roots — still finding its own footing, quick and adaptable because nothing's forced it to be anything else yet. A fast, improvising presence that suits a Meeps pilot who moves the same way." },
  },
  {
    id: "pilot_anand",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Priya Anand — \"Farsight\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Reeps. Osnian — the first of her kind Warden Company's ever fielded. Raised in Skeinreach's weave-mill housing, one remove from anything that could honestly be called danger, trained locally alongside people she'd go on to actually serve beside. Nothing about her read is a standout, and that's the point — steady, exactly where the formation needs her, holding a Reeps line rather than chasing a kill count.",
    ],
    tail: { heading: "MEK — mek_anand, catalyst Dog", body: "A comfortable, home-centered upbringing on Glasswater itself — the kind of loyalty that never had to be tested to become real. Distinct from Anand's own busier read: the Mek's job is simple devotion, not vigilance." },
  },
  {
    id: "pilot_lask",
    section: "personnel",
    kind: "Dossier",
    title: "Spec. Corin Lask — \"Patch\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Munti. Human. Grew up on a fiber farm in Skeinreach, where a blight or a scrape isn't an emergency, it's Tuesday — quiet, unglamorous upkeep that just has to happen, every day, so everything else keeps working. That's the job now too, just with a squad instead of a field. He's not who anyone talks about after a mission goes well. He's the reason there's a squad left to talk about it.",
    ],
    tail: { heading: "MEK — mek_lask, catalyst Rabbit", body: "Raised transient, ferried between Glasswater Reach's own barge routes rather than settled anywhere solid, and lost something real despite all that institutional shelter. Came out of it protective, specifically — the exact temperament for a Mek partnered with the one person in the company whose entire job is protecting everyone else." },
  },
  {
    id: "co",
    section: "personnel",
    kind: "Dossier",
    title: "the CO — the ship's Commanding Officer",
    gate: null,
    fac: "warden",
    statusMode: "co",
    body: [
      "Carabil. He is not aboard Providence. He is Providence — grown into the hull the way his kind are grown into every ship they take, and the hull is one of the last ever built for the arena, laid down for a touring company and put into service the year the sport ended and the war did not. Academy-grown all the same: years of training to stand apart from the rest of his kind before a sprout is allowed a ship at all, and the institution's habits never left him.",
      "He has been alive, and in command, since the war began. That makes him one of the most experienced commanding officers in the fleet, and the only one Warden Company has ever had. Steady, duty-bound, unremarkable in exactly the way that eventually puts someone in charge of an entire complement's worth of people — not despite it.",
    ],
    tail: { heading: "CATALYST", body: "Wolf — team-first, formation-minded, the same read that makes him command staff rather than a line officer." },
  },
  {
    id: "company_ship",
    section: "personnel",
    kind: "Brief",
    title: "Providence",
    gate: null,
    fac: "warden",
    revisions: [
      {
        after: null,
        body: [
          "Warden Company's carrier, and its rear support since before anyone currently serving came aboard. The hull is older than the war: one of the last built for the arena, laid down for a touring company that needed a home between venues, and put into service the year the sport ended. Its commander has been part of it since it was launched. The berths, the workshop, the hangar deck, the grotto — the company has cut most of that into a hull that was never meant to hold a war.",
          "It does not fight. It sits behind the Line and keeps the lances fed, and it has done that for long enough that the crew think of the ship less as a place they live than as the thing that is still there when they come back.",
        ],
      },
      {
        after: 14,
        body: [
          "Providence has guns. Everyone aboard knew that, in the way you know a thing about a building. Steel Rain was the first time anyone on the ground heard them, and the first time the company's own ship reached down onto a field and changed what was happening there. It does not do it often, and it does not do it for free, and the crew have stopped talking about the ship as the thing that stays behind.",
        ],
      },
      {
        after: 22,
        body: [
          "It took real damage on the water. Not the kind a yard patches over a week — the kind the company has been living inside since, with a corridor closed and a deck that lists a degree when the ship comes about. Providence is still Warden Company's rear, still the thing that is there when the lances come back. It is just no longer the thing that nothing has ever reached.",
        ],
      },
    ],
  },
  {
    id: "company_registry",
    section: "personnel",
    kind: "Record",
    title: "Fleet Registry Extract — WARDEN COMPANY",
    gate: 36,
    fac: "warden",
    prov: {
      source: "Coalition Fleet Registry",
      filedAs: "Extract, pulled by the relief fleet on contact",
      reliability: 3,
      note: "Official. It's all true, and it's three years old.",
    },
    body: [
      "WARDEN COMPANY. Formation type: chartered private, sport lineage. Owner of record: Warden Holdings — seat lost to Bloom overgrowth; no successor entity registered. Charter: lapsed with the owner. Warrant: vacant since the loss; no reassignment on file. Hand: field-appointed, unregistered. Station: Amaranth Reach, the Fallow Line. Carrier: PROVIDENCE, arena-class hull, commissioned. Status: ACTIVE. Never struck.",
      "Clerk's note, appended on retrieval: by the letter of the charter this formation dissolved the day its owner's seat was overrun, and has been fighting under a dead name since. It has filed no return in three years and no return was requested. The manifest shows it active because nobody entered anything else. Recommend the Warrant be reassigned or the formation struck, at the Fleet's convenience.",
    ],
  },

  // ---- ranks ---------------------------------------------------------
  // Ranks & Command. The one shipped shelf the register split converts:
// a rank table is the service's own paperwork, so it says synker.
  {
    id: "rank_personal",
    section: "ranks",
    kind: "Reference",
    title: "Personal Rank",
    gate: null,
    body: [
      "Every synker climbs the same ladder, earned through gear rather than time served — showing up and training isn't separately rewarded here, only real capability is. Pvt. at the bottom, then Pfc., Cpl., Sgt., Staff Sgt., M.Sgt., and at the very top of what an enlisted synker can reach without a command posting, Sgt. Maj.",
      "Munti synkers often carry a different title at the same rungs — Spec. in place of Cpl. or Sgt. — the same old habit real militaries have of marking support and technical roles apart from the line, not a separate ladder, just a different name painted on the same climb.",
    ],
  },
  {
    id: "rank_command",
    section: "ranks",
    kind: "Reference",
    title: "Command Position",
    gate: null,
    body: [
      "A role, not a rung — layered on top of personal rank rather than replacing it. Lance Lead runs one five-synker lance day to day, carrying the title 2nd Lt. Company Commander sits above that, running the whole force, carrying Capt. and later Maj. as the company grows.",
      "The two aren't a hand-off. When a Lance Lead gets promoted to Company Commander, they don't step back from the lance they were already running — they keep leading it in person, on top of everything else now answering to them. Rourke's own record is the clearest example: still Lance A's Lead, the exact same lance she's led since her very first mission, and Company Commander over the whole of Warden Company besides.",
    ],
  },

  // ---- bestiary ------------------------------------------------------
  // Bestiary — field notes, written by the people who fought the thing.
  {
    id: "bloom_crawlmass",
    section: "bestiary",
    kind: "Field note",
    title: "Crawlmass",
    gate: { warden: 1, amaranth: 1 },
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "The first thing most soldiers ever see of the Bloom, and the least dangerous — alone. A Crawlmass folds almost the instant it's hit. The danger was never any single one of them; it's that they never show up alone, and every one you're fighting is a turn you're not spending on something worse.",
    ],
  },
  {
    id: "bloom_splitfang",
    section: "bestiary",
    kind: "Field note",
    title: "Splitfang",
    gate: { warden: 2, amaranth: 2 },
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "A Crawlmass drift with something coordinating it. Nothing changes about how any one of them looks or moves — until one spots you, and the rest turn like they heard it happen. They don't share a mind. They share a target, the instant one of them finds it, and three or four of them converging on the same mech in the same turn is the fastest way anyone's squad has folded on open ground. Kill the one that saw you first, if you can tell which it was. Otherwise, kill fast, and don't be standing wherever they all decided to look.",
    ],
  },
  {
    id: "bloom_undertow",
    section: "bestiary",
    kind: "Field note",
    title: "Undertow",
    gate: { warden: 4, amaranth: 12 },
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "You will not see this thing until it wants you to, or until something with a sharper sensor does. It waits under the ground, motionless, right up until it surfaces to strike — and the strike lands harder for the wait. After that, it's just a target like anything else. The wait is the entire fight.",
    ],
  },
  {
    id: "bloom_sporethrower",
    section: "bestiary",
    kind: "Field note",
    title: "Sporethrower",
    gate: { warden: 7, amaranth: 6 },
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "Slow, low to the ground, and it never has to be anywhere near you to hurt you. It plants itself at range and spits, and nothing you do at melee reach touches it back — no counter, no retaliation, just the shot landing and the next one already loading. It's not fast and it's not smart. It doesn't have to be either, from that far away. Close the distance or go around it. Standing where it can already see you is the one thing that doesn't work.",
    ],
  },
  {
    id: "bloom_choir",
    section: "bestiary",
    kind: "Field note",
    title: "The Choir",
    gate: { warden: 8, amaranth: 10 },
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "Whatever the flying ones usually are, this isn't one of them alone — it's several, and they don't hunt like several. They call and answer, mid-fight, in real time, closing from different angles on the same signal like it was planned before the fight started. Maybe it was. Nobody's found anything that looks like a leader among them, which is its own kind of unsettling — coordination this clean, and apparently nobody in charge of it. Whatever's screaming, it's screaming together.",
    ],
  },
  {
    id: "bloom_gallcyst",
    section: "bestiary",
    kind: "Field note",
    title: "Gallcyst",
    gate: { warden: 9, amaranth: 13 },
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "It doesn't move, doesn't need to — plant it somewhere with a line of sight and it holds that ground better than almost anything else the Bloom fields. Whatever's actually alive inside that shell is small. Getting through to it is the entire fight, and for most of that fight it does not look like it's working. Then it does, all at once, and whatever's left underneath goes just as fast as it looked slow a moment ago. The acid it spits in the meantime doesn't wash off clean, and neither does the ground it lands on.",
    ],
  },
  {
    id: "bloom_sirenmaw",
    section: "bestiary",
    kind: "Field note",
    title: "Sirenmaw",
    gate: { warden: 12, amaranth: 12 },
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "The first thing that flies. Ground, rubble, open water — none of it slows this thing down or gets in its way, and nothing on the field can wall it out. It doesn't hit hardest of anything you'll fight. What it does is scream, close enough and loud enough that everyone near the mech it's screaming at fights a little worse for a while — not just the one it caught. Take it down first if you can reach it, or plan the fight assuming your own aim is a little off for as long as it's still in the air.",
    ],
  },
  {
    id: "bloom_wellroot",
    section: "bestiary",
    kind: "Field note",
    title: "The Wellroot",
    gate: 21,
    fac: "warden",
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "Solheim found the root structure two weeks before anyone found what's actually growing out of it — \"too regular to be natural,\" she called it, and she wasn't wrong. It doesn't move, doesn't have to: it's already dug in past anywhere you'd want to reach it, and it calls up burrowers of its own the longer the fight runs. The wound it leaves isn't the kind that closes clean. Whatever's feeding it, it isn't hungry — it's patient.",
    ],
  },
  {
    id: "bloom_unnamed",
    section: "bestiary",
    kind: "Field note",
    title: "The Unnamed",
    gate: 35,
    fac: "warden",
    prov: {
      source: { warden: "Warden Co. field log", amaranth: "House Amaranth battlegroup, field log" },
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it.",
    },
    body: [
      "Nobody who's fought this thing has ever called it anything else, and nobody's tried very hard to fix that. It's not that no name fits — it's that naming it feels like agreeing it's one thing, singular, when everything about how it fights says otherwise. It doesn't move because it's already everywhere it needs to be. It doesn't panic when the shell finally gives, because nothing about what's underneath was ever waiting to be found — it was already there the whole time, under everything you thought you were fighting instead. Whatever it is you actually beat, if you beat it, you won't get a name for that either. You'll get to still be standing, and Meridian still standing under you. Some fights, that's the whole prize.",
    ],
  },

  // ---- research ------------------------------------------------------
  // Research — papers. Allowed to be wrong; the reliability mark says so.
  {
    id: "paper_ballistics",
    section: "research",
    kind: "Paper",
    title: "Field Ballistics Against Spreading Forms",
    gate: { warden: 1, amaranth: 1 },
    prov: {
      source: "Coalition Ordnance Board",
      filedAs: "Reviewed circular, issued to line units",
      reliability: 3,
      note: "Matches what the line has seen. Read it.",
    },
    body: [
      "Every spreading form recovered to date carries two distinct load paths: an outer casing that absorbs and dissipates impact, and an inner mass the casing exists to protect. The casing does not transmit overflow. A round that exceeds the casing's remaining capacity spends the excess on nothing — the casing fails, and the inner mass is untouched until the next round. Field crews have been drawing the wrong lesson from this for years. It is not that heavy ordnance is wasted against the Bloom. It is that the first heavy round is.",
      "Once the casing has failed the form enters what crews call Collapse, and the relationship inverts: the inner mass is small, and any round at least as heavy as what remains of it is fatal.",
      "Two findings the Board would like circulated to every line unit. First, a form in Collapse does not weaken. Its own strikes land at full force until it is dead; the casing was never what it fought with. Second, a form with a heavy casing and a light interior — the sessile types especially — should be planned as two engagements, not one, and the second is shorter than it looks.",
    ],
  },
  {
    id: "paper_terrace",
    section: "research",
    kind: "Paper",
    title: "Spore Vectors on the Terrace: A Note on Mat Propagation",
    gate: { warden: 3, amaranth: 3 },
    prov: {
      source: "Amaranth Reach Agronomy Office",
      filedAs: "Working note, unreviewed",
      reliability: 2,
      note: "The Office knows the terraces. It does not know why its own maps are wrong.",
    },
    body: [
      "The mat does not spread the way a blight spreads. A blight follows the crop; the mat follows the water. Every outbreak the Office has walked on the lower terraces since the spring surveys sits on a drainage line — a cut channel, a failed retaining wall, a field that was letting run-off pool where it shouldn't. The mat comes up through saturated ground overnight and it does not come up through dry ground at all, which is the one reliable thing the Office can say about it.",
      "What it cannot say is why the pattern is so clean. Terraces that should have taken it first, by every drainage map the Office holds, are untouched. Terraces that should have been safe are not. The working assumption is that our maps are wrong.",
      "Recommendation: any unit holding ground on the terraces should treat standing water as the enemy's road, not its own obstacle, and should not end a night on a field the mat has already reached. It burns through a boot, and it burns through a mech's foot the same way — a little at a time.",
    ],
  },
  {
    id: "paper_runoff",
    section: "research",
    kind: "Paper",
    title: "On the Runoff Hypothesis",
    gate: { warden: 8, amaranth: 10 },
    prov: {
      source: "Greywatch Muster, faculty circular",
      filedAs: "Unreviewed. Circulated for discussion.",
      reliability: 1,
      note: "The Muster does not endorse it.",
    },
    body: [
      "Nobody who has fought the Bloom for long believes it wants anything, and this paper's argument is that this is not a failure of imagination but the plain reading of the evidence. It does not take ground and hold it. It does not concentrate where we are weak. It does not retreat. It arrives where it arrives, in the numbers it arrives in, and it consumes whatever is there with a thoroughness that has no relationship to what was there.",
      "The author's word for it is runoff: the overflow of something happening somewhere else, at a scale we are not seeing, that reaches us the way flood water reaches a low field — not aimed, just downhill.",
      "The paper's weakness is the one every reader has named. The forms that scream and answer each other across a battlefield are coordinating, and runoff does not coordinate. The author's reply is that a flood has currents too.",
    ],
  },
  {
    id: "paper_burrowers",
    section: "research",
    kind: "Paper",
    title: "On Burrowers",
    gate: { warden: 4, amaranth: 12 },
    prov: {
      source: "Fallow Line Survey Detachment",
      filedAs: "Field circular, reviewed by the line",
      reliability: 3,
      note: "Short because the detachment that wrote it lost two mechs learning it.",
    },
    body: [
      "A burrower does not hide. Hiding implies it is somewhere and would rather you didn't know; a burrower is under the ground the way a stone is under the ground, motionless, giving off nothing, and it will stay that way until something walks over it or until it decides the moment has come. There is no difference to you between those two cases. The strike, when it comes, is worse than the same form's strike on open ground — every crew that has measured it agrees, and none of them agree on why.",
      "Two things find them. The first is a sensor built for close contact rather than sight — the whisker arrays an Osnian pilot carries at the faceplate read the ground the way a hand does, and a burrower under a whisker array is a burrower that has already lost its one advantage. The second is a Mek who has taught a pilot's rig to look for the wrong kind of stillness.",
      "The detachment's recommendation is not clever. Lead with the pilot who can see them. Fire at range at anything that looks like disturbed ground. Never walk a mech into a field you have not been told is clear by someone equipped to say so.",
    ],
  },
  {
    id: "paper_screaming",
    section: "research",
    kind: "Paper",
    title: "A Note on Screaming",
    gate: { warden: 12, amaranth: 12 },
    prov: {
      source: "Tallowmere Fitting Yards, acoustics faculty",
      filedAs: "Working paper",
      reliability: 2,
      note: "Careful measurements. Unsupported conclusions.",
    },
    body: [
      "The flying forms scream, and synkers near the mech they scream at fight worse for a while afterward. That much every after-action report agrees on and this paper takes as given. What the faculty set out to measure was the scream itself, on plating recovered from mechs that had been close to one, and the finding is narrow and strange: the plating rings. Struck afterward with a calibrated hammer, a panel that has been screamed at carries a resonance at a frequency the Yards did not put there and cannot reproduce, and the resonance fades over days.",
      "The faculty's reading is that the scream is not, or not only, a sound. It is something a mech's frame takes on and holds — the way a struck bell holds a note — and a synker wired into that frame feels it as a shake in the aim, a half-beat of hesitation that is not theirs.",
      "The forms that scream in chorus present a second question the faculty declines to answer: a scream is one thing, but call-and-answer across a battlefield is a conversation, and the Yards do not study conversation.",
    ],
  },
  {
    id: "paper_fusion",
    section: "research",
    kind: "Paper",
    title: "Colonial Fusion in Spreading Forms: a Hypothesis",
    gate: { warden: 17, amaranth: 17 },
    prov: {
      source: "Meridian Institute",
      filedAs: "Preprint, not yet reviewed",
      reliability: 1,
      note: "Nobody has seen what it predicts.",
    },
    body: [
      "The paper's claim is that a spreading form is not one animal. Every recovered body the Institute has sectioned shows tissue types that do not grade into one another — feeding structures, propulsive structures, the casing, the inner mass — joined along boundaries that are cleaner than any boundary inside a single organism has a right to be. The drift-colonies of the Glasswater tide-flats show the same thing at a smaller scale: many specialised bodies fused into one that moves, eats, and defends as a unit, none of them able to survive alone.",
      "If that is what a spreading form is, then the boundaries are the weak points — fusion seams, structurally real, where separately-grown components were joined rather than grown continuous. The paper predicts they exist on every form. It does not claim to have found one. A moving form conceals its own structure in motion and in scale, and nobody has yet stood close enough to a rooted one, for long enough, with instruments, to look.",
      "The Institute circulates this as a hypothesis with one practical consequence, if it holds: the thing to study is not the form that is coming at you. It is the one that has stopped.",
    ],
  },

  // ---- history -------------------------------------------------------
  // History and charter text.
  {
    id: "hist_gladiator",
    section: "history",
    kind: "Record",
    title: "The Gladiator Days",
    gate: null,
    prov: {
      source: "Meridian Institute, popular history",
      filedAs: "Excerpt, third edition",
      reliability: 2,
      note: "Good on the shape. Loose on the dates.",
    },
    body: [
      "Before the Bloom, the mech was a sport. Not a metaphor for one — a sport, with arenas built for it, seasons, standings, and squads of five who fought for glory and for whoever was paying that year's purse. Command was a courtesy the squad extended to its own lead and to nobody else. An owner in a box above the sand could not direct a match in progress, and the culture treated any attempt as an insult to the synkers on the floor.",
      "When the war came, those squads were the only people alive who knew how to fight in a mech, and the Coalition took them whole: the five-synker lance, the lead who runs it, and the rule that once a lance is on the ground, no rank that is not standing on that ground with it gets to say how it fights. That last one is charter law now. Every officer who has ever tried to override it from a distance has learned exactly how old it is.",
      "The rest of the sport's grammar is still in the language. A full group of lances is a Company, because the arena groups were companies, owned outright by whoever's name was on the gate, and a company travelled — a carrier was its home between venues, and the last of those hulls were put into service the year the sport ended. Some of the companies still carry those names. So do some of the hulls.",
      "One piece of the language runs the other way. Synkers were synkers long before anyone built an arena to put them in, and the frames are older than the arenas by a margin this book is not going to pretend it can date. The sport did not invent the mech. It inherited one, dressed it, and sold tickets — and it gave the language the other word for the job, because a gate needs a name people already own and nobody was ever going to sell seats to watch synchronisation.",
    ],
  },
  {
    id: "hist_outline",
    section: "history",
    kind: "Record",
    title: "The Coalition, in Outline",
    gate: null,
    prov: {
      source: "Standing Service",
      filedAs: "Primer, fourth printing, issued to every registered formation",
      reliability: 3,
      note: "Official. Which is not the same as complete.",
    },
    body: [
      "The Coalition of Enlightened is the association of worlds and species that holds the settled galaxy against the Bloom. It is administered in three rings: the Core, where the founding worlds and the oldest infrastructure sit; the Mid-Rim, where most of the population lives and most of the academies are; and the Frontier, where the war is fought.",
      "Five standing blocs argue over how the war is paid for — the Hearth Bloc, the Ledger, the Frontier Compact, the Standing Service, and the Cradle Circle — and the argument is older than the war.",
      "Military formations are held under a Warrant, which is political ownership, and run by a Hand, which is whoever is actually in command of them day to day. The two are not the same office and are not expected to be the same person. A Warrant that is not exercised remains a Warrant.",
    ],
  },
  {
    id: "hist_thirty",
    section: "history",
    kind: "Record",
    title: "Thirty Years of the Bloom",
    gate: null,
    prov: {
      source: "Coalition Survey Bureau",
      filedAs: "Chronology, abridged for general issue",
      reliability: 2,
      note: "Official chronologies are tidy. This one was written by the people who filed the first report late.",
    },
    body: [
      "The Bureau's count begins from the first report anyone bothered to file, not the first thing anyone saw, and the Bureau would like that understood. By its count: thirty-one years.",
      "The first entries are survey notes. A drift of something on an outer Frontier world, logged as a curiosity because from orbit it looked like one — a spread of colour across a valley floor that had not been there the season before, which is where the name came from and why it stuck. For most of a decade it stayed a curiosity. Quarantine lines were drawn and redrawn. A survey office was funded, then two. Nobody called it a war because nothing about it looked like one: it did not take ground and hold it, it did not come for anyone in particular, and the worlds it reached were worlds the Core had never had much reason to think about.",
      "The first world lost is the entry where the register changes. The Coalition called it a war in the ninth year, once it had reached a sector with a name the Core recognised, and it has been the Frontier's war since — fought outward from the Mid-Rim by people who had mostly never seen the Core, on worlds that had mostly never seen the Coalition. The Emberfall Drift was hit early enough that its own memory of before is thin. The Cordage Belt's yards have laid carrier keels for the whole of it. The Amaranth Reach's terraces, this chronology notes without further comment, were among the first places anyone got a close, sustained look at what the Bloom does to living tissue.",
    ],
  },

  // ---- leadership ----------------------------------------------------
  // Leadership — who actually holds what.
  {
    id: "lead_seal",
    section: "leadership",
    kind: "Record",
    title: "The Seal and the Sword",
    gate: { warden: 6, amaranth: 5 },
    prov: {
      source: "Charter of House Amaranth",
      filedAs: "Article Nine, as read at the investiture of every Sword",
      reliability: 3,
      note: "It's the law, not a claim.",
    },
    body: [
      "A chartered battlegroup is held by the House and led by the field.",
      "The Seal is the House's. Whichever member of the founding line holds it speaks for the House in all matters of the battlegroup's standing, its charter, its levies, and its name.",
      "The Sword is the field's. Whichever officer holds it commands the battlegroup in every matter of how it fights, and no Seal, and no rank the House confers upon itself, may direct the Sword in the field.",
      "The two shall not be one person.",
    ],
  },
  {
    id: "lead_mission_command",
    section: "leadership",
    kind: "Record",
    title: "Mission Command",
    gate: null,
    prov: {
      source: "Coalition Staff",
      filedAs: "Field doctrine, excerpt",
      reliability: 3,
      note: "This is why nobody radios you mid-mission.",
    },
    body: [
      "A commander gives an officer the objective and the reasons for it. A commander does not give the method. The officer on the ground has the picture the commander does not, and will have it for the whole of the engagement, and a decision made from a distance on an old picture is worse than no decision at all.",
      "A mission runs from the moment of deployment to automatic recall, twelve hours later, or to extraction, whichever comes first. There is no arrangement under which a distant commander directs a deployed unit in real time, and Staff does not intend to build one. An officer who cannot be trusted with an objective once it has been given should not have been given it.",
      "This doctrine is older than the war. It was written for a fleet that could not talk to its own ships across a gate, and it has held because nothing about the Bloom has made a distant opinion worth more than a present one.",
    ],
  },
  {
    id: "lead_blocs",
    section: "leadership",
    kind: "Record",
    title: "The Five Blocs",
    gate: null,
    prov: {
      source: "Cistgate Ledgerworks",
      filedAs: "Civics module, cadet issue",
      reliability: 3,
      note: "Written by the Standing Service about itself and four rivals. Fair, mostly.",
    },
    body: [
      "The Coalition is not governed by a party. It is argued over by five standing blocs, each older than the war, and the argument is about the same thing it has always been about: who pays.",
      "The Hearth Bloc is the old worlds — the money that was there before the Coalition was, the families whose standing and whose shoreline are the same fact. It believes in stewardship and mostly practices it. The Ledger is margin and stability: a war is a line in an account, and the Ledger's whole position is that the account has to balance. The Frontier Compact is the worlds that fight the war, filing for a better deal for longer than anyone currently serving has been alive, and getting one slowly. The Standing Service is the administration — the registries, the fleet manifests, the primers — competent, respectable, and capped, and correct more often than anyone above it likes.",
      "The Cradle Circle runs the academies and the pipeline that feeds them. It makes soldiers out of whoever the war has left with nothing better to do, and it has been doing so since long before the Bloom gave it a reason.",
    ],
  },

  // ---- species -------------------------------------------------------
  // Member species.
  {
    id: "sp_human",
    section: "species",
    kind: "Record",
    title: "Human",
    gate: null,
    prov: {
      source: "Coalition Survey Bureau",
      filedAs: "Species primer, general issue",
      reliability: 3,
      note: "Dry, and accurate as far as it goes.",
    },
    body: [
      "The pipeline species. First to space among the Coalition's founders, most numerous, spread thinnest. A human raised on a Core world and a human raised on the Frontier have less in common with each other than either has with the Osnian neighbour they grew up beside, and the Coalition's academies exist in part to manufacture one soldier out of both.",
      "Standard bipedal frame. No penalties, no tricks, and a little more baseline toughness than the frame strictly needs.",
    ],
  },
  {
    id: "sp_osnian",
    section: "species",
    kind: "Record",
    title: "Osnian",
    gate: null,
    prov: {
      source: "Coalition Survey Bureau",
      filedAs: "Species primer, general issue",
      reliability: 3,
      note: "Dry, and accurate as far as it goes.",
    },
    body: [
      "Humanoid, heavy-set, closer to a bear than to anything else in a human's frame of reference, and the closest species to human in the Coalition by temperament as well as shape. Osnians are born in litters of three to five and raised by the household rather than by a pair of parents, and the duty-first, community-first character every other species remarks on comes out of that. An Osnian grows up owed to a lot of people.",
      "Males are overrepresented in the Coalition's front-line service by a wide margin, and a female Osnian serving with a fleet is treated — informally, never officially — as a bad omen. The kind of thing sailors say, that nobody can show is true and nobody stops saying.",
      "Osnian pilots fly the standard bipedal frame with one modification that is theirs alone: whisker arrays at the faceplate, sensing contact and near-contact where a camera sees nothing. A thing brushing the mech's face registers before it is seen. Against anything that lives under the ground, that is not decoration.",
    ],
  },
  {
    id: "sp_hiopi",
    section: "species",
    kind: "Record",
    title: "Hiopi",
    gate: null,
    prov: {
      source: "Coalition Survey Bureau",
      filedAs: "Species primer, general issue",
      reliability: 3,
      note: "Dry, and accurate as far as it goes.",
    },
    body: [
      "Quadrupedal, centaur-built, a frog's skin and a lizard's patience. The Hiopi reproduce fast and they reproduce by contest: once a year, every Hiopi city holds a fight, and one male leaves it with that year's mating rights for the whole city. It is not a ceremony. Purpose-built arenas exist so the rest of the Coalition does not have to see it, and a standing minority of other-species opinion still writes in each year asking that it happen somewhere further away, which the Hiopi find funny in the way a solved problem is funny.",
      "It used to be one fight per world. Those never ended — some ran the length of a year with no winner — so the contest was scaled down to the city, which is the size of a fight that finishes. A Hiopi carrier, by the same rule, counts as a city.",
      "In a mech the Hiopi pilot a centauroid frame rather than the standard bipedal one. Four legs hold a charge line the way two cannot, and the lance — the running straight-line strike — survives as live doctrine among Hiopi pilots for that reason and no sentimental one. They are slower through rubble and worse in a tight structure. They know it, and they route around it.",
    ],
  },
  {
    id: "sp_carabil",
    section: "species",
    kind: "Record",
    title: "Carabil",
    gate: null,
    prov: {
      source: "Coalition Survey Bureau",
      filedAs: "Species primer, general issue",
      reliability: 3,
      note: "Dry, and accurate as far as it goes.",
    },
    body: [
      "Lithoid — a mineral physiology, semi-transparent, lit from inside by a slow movement of internal glitter that is the closest thing a Carabil has to a face. No two look alike. Colour is a personal choice and it changes over decades, the way a person redecorates. There is no expression to read; tone lives in how fast the glitter moves, and in a voice that arrives as if from slightly inside a large empty room, even outdoors.",
      "A Carabil is not a pilot who boards a ship. A Carabil is grown into a ship from the start, and feels the hull the way you feel your own hand — not pain when it is damaged, but a diminishment, a being-less. When a carrier launches its full mech complement its commander feels an emptiness first, then their own senses reaching out along every deployed mech's sensors at once.",
      "Their word for their own cognition is Longsight, and it is collective. Taking a ship means learning, over years, to stand a little apart from the rest of their kind — a bounded solitude most often chosen by the young, whom they call sprouts. They do not take personal names. They take a phrase that names what they do.",
    ],
  },

  // ---- civilian ------------------------------------------------------
  // Civilian life.
  {
    id: "civ_cost",
    section: "civilian",
    kind: "Record",
    title: "What the War Costs at Home",
    gate: { warden: 5, amaranth: 9 },
    prov: {
      source: "Frontier Compact",
      filedAs: "Pamphlet, general distribution",
      reliability: 1,
      note: "Partisan. Not wrong about the supply lines.",
    },
    body: [
      "The Frontier fights the war. The Core watches it. That is the Compact's whole argument and it does not need a second sentence, but here are some anyway.",
      "Every recruiting office on the Long Marches and the Emberfall Drift meets its quota. Every one on Glasswater fills its posts with volunteers who chose it. The supply lines run outward, and they run thin by the time they reach anyone standing in front of the Bloom. The feeds run inward, and they never run thin at all — there is not a terrace estate in the Core that cannot watch a Frontier company hold a line, in real time, in comfort, and there are households that make an evening of it.",
      "The Compact does not say the Core does not care. The Compact says the Core has never had to. Ask your quartermaster what the last resupply cost. Then ask when it came.",
    ],
  },
  {
    id: "civ_live",
    section: "civilian",
    kind: "Record",
    title: "Where People Live",
    gate: null,
    prov: {
      source: "Coalition Survey Bureau",
      filedAs: "Settlement survey, general issue",
      reliability: 3,
      note: "Counts people well. Says nothing about what they think.",
    },
    body: [
      "Most of the Coalition lives in one of a small number of ways, and the way tells you more about a person than the world does.",
      "Docksides: a working port, ships and tonnage as the ordinary rhythm of a childhood — the Cordage Belt is mostly this. Terrace farmsteads: generational land, a family that measures time in growing seasons, the Amaranth Reach's own shape and Glasswater's. Arcology stacks: city built on city, where whose window sees daylight is not a small fact — the Understrand's Cistgate is the Coalition's model of it. Garrison quarters: a soldier's kid before they were ever a soldier, on or against a base, the Emberfall Drift's Greywatch above all. Drift colonies: void-born or near enough, a long-haul convoy or a mobile habitat rather than a fixed world.",
      "Three more the survey counts separately because they are less about where than about whose. Company housing: a charter-house labour family, the money at one remove, never the seat. Academy wards: faculty and staff children, half-raised by an institution. And the preserve-adjacent — those who grew up near a boundary the Coalition maintains around a population it observes and does not develop, close enough to have questions the family never answered.",
    ],
  },
  {
    id: "civ_preserves",
    section: "civilian",
    kind: "Record",
    title: "The Preserves",
    gate: null,
    prov: {
      source: "Cradle Circle",
      filedAs: "Public information, general distribution",
      reliability: 1,
      note: "The official account. Read the settlement survey beside it.",
    },
    body: [
      "The Coalition does not conquer. When a survey finds a people who have not yet reached their own sky, the Coalition draws a line around their world and holds it — no contact, no development, no trade, and no war. Inside the line, a people go on becoming whatever they were becoming. Outside it, the Coalition keeps the Bloom off them, which is more than anyone kept off us.",
      "That is a preserve. There are more of them than most citizens could name, and the Circle maintains every boundary, staffs every observation post, and funds every survey office at the line. A preserve is not a colony. It is not a protectorate. It has no seat, no bloc, and no Warrant. It is, in the Coalition's own phrase, a people kept.",
      "The settlements at a boundary are ordinary Frontier towns with a treaty line at the edge of them. They supply the posts, they raise their children within sight of a world they will never visit, and they are asked, in every survey, whether the line is respected. The Circle's records show that it is.",
    ],
  },
  {
    id: "civ_academies",
    section: "civilian",
    kind: "Record",
    title: "The Academies",
    gate: null,
    prov: {
      source: "Coalition Academy Board",
      filedAs: "Prospectus",
      reliability: 2,
      note: "A prospectus. Every line is true and every line is selling something.",
    },
    body: [
      "Five academies feed the Frontier, and a sixth path that is not an academy at all.",
      "The Tallowmere Fitting Yards began as a trade school and still runs like one: apprenticeship pace, real engineering, no ceremony, and a graduate who can keep a hull and a chassis alive at once. The Cutbank Muster School was a militia drill-ground until the war widened and made it a feeder — minimal ceremony, maximal survival, and a preference for the close, fast fight. The Glasswater Conservatory of Arms is the Coalition's nearest thing to a finishing school with live-fire electives; it teaches range, control, patience, and how to lose gracefully to someone with more money. The Cistgate Ledgerworks is a Standing Service training ground first and an academy second, and produces cadets who read a battlefield the way a clerk reads a form. The Greywatch Muster is garrison-attached and honour-bound in the Osnian manner: it holds a line because holding is the whole point.",
      "And there is line-trained. Never went through any of it. Learned everything in the field, under people who had learned it the same way. The Board lists it here because a prospectus that pretended those synkers did not exist would be lying to the sectors that supply most of them.",
    ],
  },

  // ---- tech ----------------------------------------------------------
  // Technology.
  {
    id: "tech_grades",
    section: "tech",
    kind: "Record",
    title: "Grades of Gear: What Money Buys",
    gate: null,
    prov: {
      source: "The Ledger",
      filedAs: "Trade circular",
      reliability: 2,
      note: "Right about the ladder. Has opinions about the top of it.",
    },
    body: [
      "Everything a line synker will ever hold was bought with points, and points are earned. That is the earned ladder — seven grades from a Stocklance to a Stormblade — and the Ledger's position, stated plainly, is that it works. A synker who is good gets better gear, and the Coalition gets a better synker for its money.",
      "Above the earned ladder sits gear that is not for sale. Heirloom-grade equipment is held by families, not units. It comes down a bloodline or it does not come at all, and no amount of points moves it.",
      "Above that sits Sovereign-grade, which belongs to the ruling houses and does not appear on a battlefield, because its flagship use is not a weapon. It is time — a life extended far past the baseline. A charter house rich enough to field Heirloom-grade arms is rich enough to have a patriarch who remembers the war starting.",
      "The Ledger notes, without further comment, that the top rung of the earned ladder is called A, and that the rung above it has a letter too.",
    ],
  },
  {
    id: "tech_everyday",
    section: "tech",
    kind: "Record",
    title: "The Everyday Hardware",
    gate: null,
    prov: {
      source: "Tallowmere Fitting Yards",
      filedAs: "Apprentice primer, first year",
      reliability: 3,
      note: "What a first-year needs to know before touching any of it.",
    },
    body: [
      "A ship goes where a gate is. That is the whole of the Coalition's reach in one sentence: the gate network is the map, and a world without a gate is a world the war arrives at slowly, if at all. Between gates a ship is on its own, and doctrine is written for that.",
      "The carrier is the unit of the war. A hull that carries lances — five at full complement, each five mechs and their Meks — with the yards, the berths, the workshop, and the fabricator to keep them fighting for a season without seeing a port. It travels with escorts, and it travels with a commander who is not so much aboard the ship as part of it. The mech is the unit of the fight: a frame, a synker wired into it, and a Mek in the cradle who knows the frame better than the synker does. The word is the job — a synker is synchronised to the frame, and a first-year who says pilot will be corrected exactly once. Everything the Yards build ends up on one of those two things.",
      "And on every wrist, the Holoband — comm, ledger, and identity in one band, issued at enlistment and rarely removed. A synker's Holoband is the last thing a crew looks for on a field and the first thing a Mek checks in the morning.",
    ],
  },
  {
    id: "tech_beacon",
    section: "tech",
    kind: "Record",
    title: "Beacon Control and the Restock Crate",
    gate: null,
    prov: {
      source: "Warden Co. quartermaster",
      filedAs: "Standing note, posted in the Restock Room",
      reliability: 3,
      note: "How the shelf works. Read it before you need it.",
    },
    body: [
      "A beacon is a place on the field where a downed synker can be pulled back into the fight that is still going on around them. Not the next mission — this one. Whoever holds the beacon places it inside their own sight and reach, and it does one thing: it spends what is on the shelf to put a synker back on their feet.",
      "The shelf is two things, bought ahead of time and drawn down one revive at a time. A crate is the physical part of it — parts, fluid, the plate that took the hit. A charge is the permission: pre-paid, counted, and gone the moment it is used. A Fabricator Mek keeps a crate of their own synker's spares in the cradle, so that synker never draws down the company's shelf; everyone else does.",
      "One rule above the rest. A living Munti on the field at the moment the beacon is used waives the charge entirely. The beacon works without one. It just costs the company more, every time, in the only currency the Restock Room keeps.",
    ],
  },

  // ---- history -------------------------------------------------------
  // History and charter text.
  {
    id: "world_coalition",
    section: "history",
    kind: "Brief",
    title: "The Coalition",
    gate: null,
    fac: "warden",
    revisions: [
      {
        after: null,
        body: [
          "The Amaranth Reach is one frontier sector among more than Warden Company will ever see the edge of. Out past it, the war against the Bloom is fought by an alliance of worlds and species stretching further than any one unit's own maps show — the Reach answers, on paper, up a chain of command most of the company has never met and mostly doesn't think about.",
          "Doctrine, wherever it actually comes from, is simple: you're given the objective, and you're trusted to reach it. Nobody's radioed Rourke a change of orders in longer than anyone currently serving can remember. A company this far out, still carrying a corporate name nobody ever bothered to change, doesn't get many occasions to ask whether that's how the chain of command is supposed to work, or just how it's worked out here.",
        ],
      },
      {
        after: 20,
        body: [
          "Colonel Marrow said it plainly, once the duel was over and there was nothing left on the field to prove by pretending otherwise: nobody's actually held Warden Company's own paperwork in years. Said it like an insult, and meant it like one — a House officer's easy contempt for a unit that answers to no one because no one's bothered to ask in longer than anyone still serving can remember.",
          "She didn't explain further, and nobody chased her for it. Whether she was right, or just cruel, or both, is the kind of question the war doesn't leave much room to sit with — not until somebody official says so out loud, on the record, instead of an enemy throwing it out as one last word before disengaging.",
        ],
      },
      {
        after: 36,
        body: [
          "The relief fleet that reached the Reach was the first time anyone in Warden Company heard their own chain of command's full name spoken out loud, formally, the way an institution states itself on first contact: the Coalition of Enlightened. Nobody in the company has said it that way since. It's \"the Coalition,\" same as it always was — the short form was never a mystery, just never confirmed.",
          "What the fleet's own officers made clear, without quite saying it plainly: out past the Reach, the war runs on a real shape — worlds and species administered in overlapping rings the Coalition itself calls Core, Mid-Rim, and Frontier, and threaded through with old political houses (the Hearth Bloc, the Ledger, the Frontier Compact, Standing Service, the Cradle Circle) that have been arguing over the war's cost longer than Warden Company has existed. A unit like Warden's is nominally held under something the Coalition calls a Warrant — political ownership, separate from whoever's actually running a unit day to day, the Hand in their own terms. Whichever officer holds Warden's Warrant, nobody currently serving has ever met them — and the fleet's own records, checked without much ceremony, turned up exactly what a House Amaranth colonel had already said for free, sixteen missions and a war ago: there's nobody left to check.",
        ],
      },
    ],
  },

  // ---- world ---------------------------------------------------------
  // The Amaranth Reach.
  {
    id: "world_reach",
    section: "world",
    kind: "Brief",
    title: "The Amaranth Reach",
    gate: null,
    fac: "warden",
    revisions: [
      {
        after: null,
        body: [
          "A frontier cluster on the edge of core-administered space, held nominally by a sector governor-general who's never once had to actually worry about it. Its wealth and its name both come from the same source — House Amaranth, the founding charter dynasty, generations deep in the sector's richest agricultural terraces. Warden Company holds a stretch of border line here, the Fallow Line, alongside House Amaranth's own chartered battlegroup. Meridian, the Reach's capital, gets its own entry.",
        ],
      },
      {
        after: 36,
        body: [
          "After the siege, the name doesn't get used much anymore. Nobody's issued an order about it. It just isn't, the way people stop calling a street by a landlord's name once everyone remembers what that landlord actually did.",
        ],
      },
    ],
  },
  {
    id: "world_house",
    section: "world",
    kind: "Brief",
    title: "House Amaranth",
    gate: 6,
    fac: "warden",
    revisions: [
      {
        after: 6,
        body: [
          "A charter house, generations old, holding the Reach's richest terraces. Fields its own chartered battlegroup alongside the Reach's loyalist regulars — Colonel Ysolde Marrow runs it day to day. Officially allied with Warden Company. That alliance has been tense since a checkpoint dispute neither side has fully let go of.",
        ],
      },
      {
        after: 10,
        body: [
          "Whatever's actually kept this alliance strained, it broke outright once. House Amaranth pulled off a position everyone was supposed to be holding together — no warning given, no explanation offered since.",
        ],
      },
      {
        after: 17,
        body: [
          "Something about how the Bloom grows on House Amaranth's own terraces doesn't read as accident anymore. Too regular, too directed, too calm about it on House Amaranth's side for something that's supposed to be everyone's shared enemy. Nobody's said the word \"deliberate\" out loud yet. It's getting harder not to.",
        ],
      },
      {
        after: 23,
        body: [
          "It was deliberate the whole time. House Amaranth's own research — decades of it, reaching back to the war's earliest years — got turned into a bargain: divert the Bloom's growth away from House lands, and call the redirected mess stewardship instead of what it actually is. It worked long enough to look like wisdom. Nobody who signed off on it thought it would still be paying out this way.",
        ],
      },
      {
        after: 28,
        body: [
          "Whatever debt put Colonel Marrow in that seat, she's stopped paying it. She turned on Halcyon Amaranth herself, mid-battle, at real cost — the kind of choice that doesn't undo anything already done, and isn't made to undo anything either. Warden Company doesn't know yet whether it changes the war they're actually fighting. It's not clear it does.",
        ],
      },
    ],
  },
  {
    id: "world_fallow",
    section: "world",
    kind: "Brief",
    title: "The Fallow Line",
    gate: null,
    fac: "warden",
    revisions: [
      {
        after: null,
        body: [
          "The border Warden Company holds. Not a wall — a line of positions, trenches and listening posts and ground that has been fought over enough times to have names, strung along the edge of the terraces where the Reach's fields stop and the Bloom's don't. It is called fallow because that is what the Reach did with it: pulled the crops back a season's width and left the ground bare, on the theory that the mat has less to cross where there is nothing growing to cross on.",
          "It works about as well as anyone expected. The Line holds because people hold it, one post at a time, and the company has been on it long enough that nobody remembers it being anywhere else.",
        ],
      },
      {
        after: 12,
        body: [
          "The company came off the Line at the end of the season. What it held for, it held — long enough for what was behind it to get out — and then it withdrew, in order, under fire, the way a withdrawal is supposed to go and mostly doesn't. The Line is behind Warden Company now. Nobody has said the word abandoned, and nobody has said the word lost, and the Reach's maps still draw it where it was.",
        ],
      },
    ],
  },
  {
    id: "world_meridian",
    section: "world",
    kind: "Brief",
    title: "Meridian",
    gate: null,
    fac: "warden",
    revisions: [
      {
        after: null,
        body: [
          "The Amaranth Reach's capital world. Shipyards, an orbital elevator, more people than the rest of the sector combined. Everyone out on the Fallow Line has family there, or knows someone who does. It's the place this whole war is nominally protecting, whether or not it ever feels like it from a trench on the border.",
        ],
      },
      {
        after: 25,
        body: [
          "Whatever's been quietly accelerating out on the terraces has found a new gear entirely, and it's coming this way faster than anyone accounted for. Meridian's own orbital defense grid — Meridian's Oath — just went from a name on a briefing slide to something Warden Company is actually calling in mid-fight.",
        ],
      },
      {
        after: 29,
        body: [
          "Falling back ring by ring around a capital that isn't supposed to fall changes what a fight even means. The outer ring went by design, not by failure — buying time, not holding ground. What's left gets smaller every time Warden Company checks, and closer to the people the whole war was supposed to be keeping safe.",
        ],
      },
      {
        after: 36,
        body: [
          "It held. Changed for good — the name that used to belong to the whole reach around it doesn't get said much anymore, and Meridian itself remembers exactly how close that margin actually was, even if the official histories round it up to a clean victory.",
        ],
      },
    ],
  },

  // ---- personnel -----------------------------------------------------
  // Personnel — the roster, one dossier per person. The live block that
// opens each of these is derived from the save, not written here.
  {
    id: "pilot_okafor",
    section: "personnel",
    kind: "Dossier",
    title: "Sgt. Wren Okafor — \"Ledger\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Tank. Human. An arcology-stack garrison quarter on Cistgate, in the Understrand, and something hit him there early — bigger than he was ready for, the kind of thing the Ledgerworks' procedural training arrived too late to shield him from and so taught him to account for instead. He holds a line the way Bosk does, reached from a harder direction: not because someone told him to, because he has already seen what happens when nobody does.",
    ],
    tail: { heading: "MEK — mek_okafor, catalyst Bear", body: "Same arcology, a different street: a childhood in the shadow of a preserve boundary nobody explained, then hit hard, then watchful. Two self-contained people in one cradle, and it works because neither of them needs the other to talk." },
  },
  {
    id: "pilot_solheim",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Nadia Solheim — \"Static\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Reeps. Human. Dockside on Loomvale, the Understrand's registry world — one remove from real security, close enough to watch it. The Ledgerworks sharpened that into the thing the callsign already says: she reads a target the way a clerk reads a form, and she does not miss the line that matters. Competitive about it. Keeps count.",
    ],
    tail: { heading: "MEK — mek_solheim, catalyst Dog", body: "Company housing on Pale Cistern, comfortable, structured by a procedural academy rather than the Conservatory — plain devotion, arrived at by a different institutional road than Anand's Mek's. The rig is never the reason she missed." },
  },
  {
    id: "pilot_tarrant",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Yusuf Tarrant — \"Kestrel\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Meeps. Hiopi — centauroid frame. Half-raised on the Cutbank Muster School's own grounds on Harrow's Table before he was ever a cadet there, which is why he moves like someone who has been in a mech since he could climb into one and fights like someone who has never actually been hit. Fast, adaptable, still forming. The uniform suggests more than the record does yet.",
    ],
    tail: { heading: "MEK — mek_tarrant, catalyst Crow", body: "A salvage-adjacent farming family on Cutbank's Bloom-scarred canyons — real, ordinary hardship, met with a deliberate lightness that keeps a green pilot's cradle from becoming a nervous place." },
  },
  {
    id: "pilot_vashti",
    section: "personnel",
    kind: "Dossier",
    title: "Spec. Elin Vashti — \"Driftwood\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Munti. Osnian — vibrissal frame. Raised aboard convoy habitats drifting between the Emberfall Drift's garrison routes, never rooted anywhere long enough to call it home, and the Greywatch Muster took her in the way it takes everyone: by making her hold something. She keeps a squad alive the way she kept herself steady on a convoy — by finding, deliberately, the thing worth staying for wherever she has washed up next. The callsign was not her idea. She has stopped arguing with it.",
    ],
    tail: { heading: "MEK — mek_vashti, catalyst Rabbit", body: "One of the Reach's smaller cultivated plots on Pale Cistern, and the Ledgerworks training her in procedure rather than soil — real comfort, and a real early loss it could not prevent. Fiercely protective since, which is the right temperament for the person behind the second Munti." },
  },
  {
    id: "pilot_reyes",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Damon Reyes — \"Hardpan\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Reeps. Hiopi — centauroid frame. Grew up scavenging the canyon edges of Cutbank after the Bloom had already scarred them, with no pipeline at all — no academy, no muster, line-trained by people who had learned it the same way. He reads a downed transport as a resource before he asks whose it was, and the company has learned to let him. There is an interior there that nobody, possibly including Reyes, has fully mapped.",
    ],
    tail: { heading: "MEK — mek_reyes, catalyst Cat", body: "A garrison-adjacent childhood on Emberfall, refinery world, no institution anywhere in it. The most self-contained pairing on the roster: two people who trust the rig more than they trust anyone, and keep it running for that reason." },
  },
  {
    id: "pilot_kova",
    section: "personnel",
    kind: "Dossier",
    title: "Sgt. Mireille Kova — \"Bastion\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Tank. Osnian — vibrissal frame. An orderly registry-world childhood on Loomvale with an unexplained preserve boundary at the edge of it, and then, during her Ledgerworks training, something bigger than she was ready for. She did not talk about it. She became a wall instead, and the callsign is the whole of that sentence. Holds ground. Does not move. Does not ask you to come back for her.",
    ],
    tail: { heading: "MEK — mek_kova, catalyst Wolf", body: "An academy ward's upbringing on Skeinreach's fiber farms, steady and dutiful and team-first — the one person in the cradle who will say what Kova won't, which is that a wall is part of a formation and not a substitute for one." },
  },
  {
    id: "pilot_ness",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Aurelio Ness — \"Rampart\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Tank. Hiopi — centauroid frame. Company housing on Tallowmere, a dock-adjacent labour family comfortable enough by the Belt's standards, trained at the Fitting Yards alongside people he would later hold a line for. That is the whole read: he holds the line because the people behind him are the point, and a Hiopi frame on a Tank chassis holds it wider than most. Kova's opposite, and they know it.",
    ],
    tail: { heading: "MEK — mek_ness, catalyst Bear", body: "A preserve boundary on Loomvale and no institution at all — line-trained, hit hard, and the most withdrawn of the company's Meks. Ness talks enough for both of them, which is how the pairing was made and why it holds." },
  },
  {
    id: "pilot_onwuka",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Sable Onwuka — \"Whiplash\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Meeps. Osnian — vibrissal frame. A preserve-boundary childhood on Tallowmere, the Belt's industrial anchor — the ordinary, specific unease of growing up next to a line nobody would explain, and the Fitting Yards' hands-on training turning that into a Meeps' drive to advance through every fight at arm's length. Fast, aggressive, and the whiskers at the faceplate mean the thing under the ground is her problem before it is anyone else's.",
    ],
    tail: { heading: "MEK — mek_onwuka, catalyst Crow", body: "A farming pocket on Greywatch, garrison world, honour culture — real hardship met with a chosen, restless lightness. Keeps a hard-charging pilot's cradle from being a grim one." },
  },
  {
    id: "pilot_delgado",
    section: "personnel",
    kind: "Dossier",
    title: "Spec. Rasha Delgado — \"Longshot\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Reeps. Human. Dockside on Pale Cistern — close enough to Glasswater's money to see the gap between the estate world's comfort and what a deployment actually costs, and she turned that gap into structure. The first pilot in the company to run a Quartermaster's track, which is not an accident: she is the one who always knows what is left on the shelf, and she does not wait to be asked.",
    ],
    tail: { heading: "MEK — mek_delgado, catalyst Fox", body: "Raised on the Greywatch Muster's own grounds, a rare sheltered case on a hard frontier — quick, adaptable, not yet tested. The improvising half of a pairing whose other half counts everything twice." },
  },
  {
    id: "pilot_yeun",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Faro Yeun — \"Splint\"",
    gate: null,
    fac: "warden",
    statusMode: "roster",
    body: [
      "Munti. Hiopi — centauroid frame. An academy ward inside the Conservatory's own grounds on Glasswater, every comfort available, until a real early loss the institution could not shield him from. He came out of it fiercely protective of everyone within reach, which is the whole reason a squad with Yeun in it stays a squad. The callsign was given, not chosen, and it fits.",
    ],
    tail: { heading: "MEK — mek_yeun, catalyst Rabbit", body: "A cultivated pocket among Glasswater's tide-terraces, real institutional comfort, and the same shape of early loss reached by a different road. Two people who protect for the same reason, in one cradle." },
  },
  {
    id: "pilot_marrow",
    section: "personnel",
    kind: "Dossier",
    title: "Col. Ysolde Marrow",
    gate: null,
    fac: "amaranth",
    statusMode: "mc",
    body: [
      "Tank. Human. Common-born, career, and brilliant, in an army where the first two are supposed to cancel the third. She came up through the House's regulars on merit and got the Sword the way a professional gets it — because a Seal was needed elsewhere and someone had to actually run the battlegroup. She holds ground. That is her path and it is also her whole method: she proves herself by not moving, and by still being there when the people who doubted her have stopped looking.",
      "Confirmed in permanent command of the lances at the end of the first season, Seal-holder's blessing or not. Since then, Lance A's lead in person on every field, on top of everything else that answers to her.",
    ],
    tail: { heading: "MEK — mek_marrow, catalyst Shark", body: "Dockside on Tallowmere, one remove from real security in the Belt's yards, and it came out as pure advancement-hunger: the rig is kept sharp because falling behind was never acceptable. The opposite of her own loyalty read, and the reason her frame is never the thing that was not ready." },
  },
  {
    id: "co_amaranth",
    section: "personnel",
    kind: "Dossier",
    title: "Brig. Verinis Amaranth — field commander",
    gate: null,
    fac: "amaranth",
    statusMode: "co",
    body: [
      "Human. Blood of the House, and he lets you know it. Brigadier is a House rank, conferred by the House on itself, and in the field it entitles him to exactly what the charter says it does: the battlegroup's disposition, its levies, its supply, its readiness, and not one word to a lance once that lance is on the ground. He knows the line. He resents it in the particular way of a man who has never once been on the wrong side of it.",
      "He is not the Seal. The Seal is on Osnius, where the House's politics are done, and Verinis is what is left of the House at the front: the field commander, the one who signs for the terraces' defence, the one Marrow answers to in every matter but how she fights. He is, in the plain description of everyone who has served under him, an asshole. He is also the reason the estate still has power, walls, and a roster.",
    ],
    tail: { heading: "CATALYST", body: "Cat — self-preservation as the only stance left standing; the interior nobody has mapped, possibly including him. Approves what gets built and what does not. Available in the Control Room. Will hear you out, in the sense that he will let you finish." },
  },
  {
    id: "pilot_vondra",
    section: "personnel",
    kind: "Dossier",
    title: "Sgt. Petra Vondra — \"Ironrow\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Meeps. Hiopi — centauroid frame. Raised mostly aboard the pleasure-barges that keep Pale Cistern's economy running rather than on any fixed ground, close enough to real barge-crew risk to see the gap between Glasswater's comfort and the labour underneath it, and the Conservatory structured that into what she is now: the sergeant who runs the room. She explains once. She expects it heard. Meir is hers to bring up and everyone in the Longhouse knows it, including Meir.",
    ],
    tail: { heading: "MEK — mek_vondra, catalyst Fox", body: "A comfortable ranch-family upbringing on Harrow's Table, trained on the Muster School's grounds without ever really being tested by them — quick, improvising, the foil to Vondra's own careful structure. She says he is the only person allowed to surprise her." },
  },
  {
    id: "pilot_meir",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Jonas Meir — \"Sparrow\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Meeps. Hiopi — centauroid frame. An academy ward on Cistgate, the Understrand's dense arcology world — institutional, orderly, dutiful, nothing dramatic in it. He is young, and he is aggressive by conviction rather than by temperament: he has decided what a Meeps is for and he intends to be it. The carrying stress is real and it is the stress of someone being brought up in public by a sergeant who is right. Bray gets on his nerves. The feeling is mutual and neither of them has said why.",
    ],
    tail: { heading: "MEK — mek_meir, catalyst Crow", body: "Real garrison-world hardship on Greywatch, met with a restless lightness his own pilot never allows himself. The one person who can make Meir laugh in the cradle, and he does it on purpose." },
  },
  {
    id: "pilot_bray",
    section: "personnel",
    kind: "Dossier",
    title: "S.Sgt. Callum Bray — \"Deadfall\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Reeps. Human. A convoy-transient childhood running cargo between Tallowmere's orbital yards, and a yard accident early enough that he saw what a body looks like after one before the Fitting Yards ever took him in. Watchful since. Self-reliant since. The marksman of the House's first lance and the least talkative person in it — he does not hold a grudge against Meir so much as a position, and he will hold it until someone moves him.",
    ],
    tail: { heading: "MEK — mek_bray, catalyst Dog", body: "Company housing on Glasswater, comfortable, structured by the Ledgerworks — plain devotion. The steady constant that keeps a withdrawn sharpshooter's rig reliable, and the only person on the estate Bray will actually let stand behind him." },
  },
  {
    id: "pilot_orin",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Nessa Orin — \"Quill\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Munti. Osnian — vibrissal frame. Comfortable in theory, on Glasswater itself, close enough to the Reach's own quiet preserve boundary to have grown up with questions nobody would answer — and then a real early loss the Conservatory's polish could not prevent. Fiercely protective ever since, in the way of someone who decided very young that it would not happen again on her watch. The youngest of the five. Cannot sit still. Roams the Longhouse while the others sit.",
    ],
    tail: { heading: "MEK — mek_orin, catalyst Wolf", body: "An ordinary, comfortable arcology upbringing on Cistgate, nothing like Orin's own loss — keeps the formation's gear running on plain, dutiful teamwork, and is the one person in the Longhouse who can make her sit down." },
  },
  {
    id: "pilot_kessler",
    section: "personnel",
    kind: "Dossier",
    title: "Sgt. Rutger Kessler — \"Tallgrass\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Tank. Human. An agrarian pocket on Tallowmere, steady growing-season rhythm inside the Belt's yard noise, and the local Fitting Yards alongside people who became crewmates. The same duty-bound read Marrow's own track carries, reached from a gentler direction: he holds because that is what the season asks, and he has never needed a harder reason.",
    ],
    tail: { heading: "MEK — mek_kessler, catalyst Fox", body: "Raised around the Cutbank Muster School's grounds despite the salvage economy outside them — a rare sheltered case, quick and improvising beside Kessler's steady work." },
  },
  {
    id: "pilot_vantana",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Imara Vantana — \"Windbreak\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Meeps. Osnian — vibrissal frame. Dockside on Glasswater, the Reach's own capital, close enough to working risk to see the gap between the estate world's comfort and what it costs — and she metabolised that into the clear, teachable structure a Runemaster's track needs. The lance's vision. Tells you what she sees in the order you need to hear it.",
    ],
    tail: { heading: "MEK — mek_vantana, catalyst Bear", body: "Hit early by something bigger than a Skeinreach mill childhood prepares anyone for, and turned inward. A quiet, watchful presence in the cradle beside a pilot who does the talking." },
  },
  {
    id: "pilot_reyken",
    section: "personnel",
    kind: "Dossier",
    title: "Spec. Toma Reyken — \"Longshadow\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Reeps. Hiopi — centauroid frame. A refinery world the Bloom reached early, a treaty line close enough to carry questions, and no pipeline at all — line-trained. Reads a downed transport as a resource before he asks whose it was, same as Warden's own scavenger, and trusts the rig more than the roster. The House took him because he was good. He has not yet decided whether that was mutual.",
    ],
    tail: { heading: "MEK — mek_reyken, catalyst Rabbit", body: "Real early loss despite genuine shelter on Pale Cistern — and where Reyken learned to trust no one, his Mek came out of the same shape of blow protective of everyone. The pairing works because it is a disagreement neither of them has to win." },
  },
  {
    id: "pilot_solano",
    section: "personnel",
    kind: "Dossier",
    title: "Cpl. Adaeze Solano — \"Backfurrow\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Reeps. Human. Skeinreach's weave-mill fields with a military family layered on top, and something early and bigger than a fibre-farm childhood prepares anyone for. The same watchful precision Bray carries, reached by a different road; the lance's second marksman, and the one who talks to the first.",
    ],
    tail: { heading: "MEK — mek_solano, catalyst Cat", body: "The hardest-hit case on the estate, no institutional buffer at all — pure guarded self-containment keeping a precise rig precise." },
  },
  {
    id: "pilot_marrin",
    section: "personnel",
    kind: "Dossier",
    title: "Sgt. Ondine Marrin — \"Greenhand\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Munti. Hiopi — centauroid frame. A ranching family on Harrow's Table, a knife's-edge growing season, real frontier hardship — and she kept finding reasons to tend to things anyway, which is the whole of what a Munti is. Brightness on purpose. The second healer the House ever fielded, and the one who names the plants.",
    ],
    tail: { heading: "MEK — mek_marrin, catalyst Dog", body: "A comfortable, home-centred upbringing on Pale Cistern, nothing like Marrin's own toughness — the plain, loyal constant under a restless Fieldwright." },
  },
  {
    id: "pilot_thorne",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Emeka Thorne — \"Harrow\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Tank. Human. Born on the terraces of Aerius, a farmstead family that measured time in growing seasons with the drift at the edge of every one of them, and he ran a harvest line as foreman for years before anyone put him in a uniform. Never trained. Line-taught, thirteen months ago, by people who had learned it the same way. Holds ground the way he held pickers: by being the one who does not go home first. Thirty years of colour at the edge of the field and he kept planting anyway.",
    ],
    tail: { heading: "MEK — mek_thorne, catalyst Wolf", body: "Raised on the Fitting Yards' own floor on Tallowmere, steady and dutiful — the formation-minded constant under a foreman who is still learning that a lance is not a picking crew." },
  },
  {
    id: "pilot_kastan",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Liora Kastan — \"Scarecrow\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Meeps. Hiopi — centauroid frame. Eleven levels down in Cistgate's stacks, where up was a direction other people took for granted, and no academy would have her. The House's levy would. She is in a mech to get out of the stack for good and she does not pretend otherwise; the callsign is the crew's, for the way she stands in a field and things stay off it.",
    ],
    tail: { heading: "MEK — mek_kastan, catalyst Raven", body: "Garrison quarter on Pale Cistern, close enough to Glasswater's comfort to see the gap, the Conservatory turning it into instruction — the one voice that slows her down long enough to aim." },
  },
  {
    id: "pilot_osei",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Bram Osei — \"Silo\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Reeps. Osnian — vibrissal frame. A Greywatch Muster staff kid who never enrolled: raised in the quartermaster's stores, learned every shelf in the cage before he learned to shoot, and walked out with the habit the callsign names — there is always one more shot stashed somewhere only he knows. Quick, improvising, and not yet tested by anything that could not be solved from the shelf.",
    ],
    tail: { heading: "MEK — mek_osei, catalyst Shark", body: "A Cistgate stack kid who tested into the Ledgerworks and never looked down again — ambition beside a scrounger's trickery. Between them nothing in the cage is ever unaccounted for." },
  },
  {
    id: "pilot_dunmore",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Sera Dunmore — \"Chaffwind\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Munti. Hiopi — centauroid frame. A registry-colony labour family on Loomvale, the charter house's paper handled by her parents and never theirs; no pipeline, the levy instead. A healer who advances by being the person nobody can do without, and who knows to the mission how many times she has been. Kastan and she will have noticed they want the same thing.",
    ],
    tail: { heading: "MEK — mek_dunmore, catalyst Crow", body: "A farming pocket on Emberfall, refinery world, hardship met with chosen lightness — the joke in the cradle beside a Munti who advances by never needing one." },
  },
  {
    id: "pilot_amsel",
    section: "personnel",
    kind: "Dossier",
    title: "Pvt. Teo Amsel — \"Rootbind\"",
    gate: null,
    fac: "amaranth",
    statusMode: "roster",
    body: [
      "Meeps. Human. A House labour family on Aerius, the money at one remove, and the job in the growth zones from the day he could carry a rig — a Ward-Crop Technician until thirteen months ago, when the program ran out of people to put between it and the drift. He replanted the line the drift crossed every season, for years, and kept doing it. Knows the ground better than anyone who outranks him. Private.",
    ],
    tail: { heading: "MEK — mek_amsel, catalyst Rabbit", body: "A cultivated plot on Pale Cistern, real shelter, and a real early loss the Conservatory could not prevent — fiercely protective of a pilot who has already lost one crew to the zones." },
  },
  {
    id: "house_estate",
    section: "personnel",
    kind: "Brief",
    title: "The Greathouse",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: null,
        body: [
          "The seat of the House on the terraces, and the battlegroup's home for as long as there has been a battlegroup. A fortified estate, not a ship: the Longhouse where the lances eat and sit, the Motor Court where the frames stand, the Cultivar Works where the House's own tech is kept and made, the Reliquary on the deep floor, the Control Room where the field commander keeps the Seal's empty chair behind his desk. The walls are older than the war. The rooms were cut for a household and hold a company.",
          "It does not move, and that is the point of it. Everything Warden Company does from a hull that goes where the gates are, the House does from a place that has been here since before the Reach had a name.",
        ],
      },
      {
        after: 24,
        body: [
          "The seizure order named the estate by its charter title and the loyalists who came to serve it did not get past the yard. The Greathouse is a House seat with the House's own troops on the walls, and after Seizure Order nobody on either side pretends that is a formality. The Control Room's empty chair has not been mentioned since.",
        ],
      },
      {
        after: 33,
        body: [
          "The innermost terrace is the estate's own ground. When the perimeter fell back to it, the Greathouse stopped being where the battlegroup lives and became what the battlegroup is holding. There is nothing behind it.",
        ],
      },
    ],
  },
  {
    id: "house_charter_extract",
    section: "personnel",
    kind: "Record",
    title: "Charter Register Extract — HOUSE AMARANTH, chartered battlegroup",
    gate: 36,
    fac: "amaranth",
    prov: {
      source: "Coalition Fleet Registry",
      filedAs: "Extract, as filed by the House",
      reliability: 3,
      note: "Official. Filed by the party it describes.",
    },
    body: [
      "HOUSE AMARANTH, CHARTERED BATTLEGROUP. Formation type: charter house levy. Seal: held, House Amaranth, in absentia (Osnius). Sword: Brig. V. Amaranth, House-conferred; lance command Col. Y. Marrow, field-confirmed. Station: Amaranth Reach, the terraces. Seat: the Greathouse. Status: ACTIVE. Standing: under audit — see sector governor-general's office, orders 14, 22, 24, 29, all unresolved.",
      "Clerk's note: this formation has filed a return every season of the war, on time, and every return has been accepted. The audits listed above concern the program the formation defends, not the formation. The Registry does not adjudicate programs.",
    ],
  },

  // ---- bestiary ------------------------------------------------------
  // Bestiary — field notes, written by the people who fought the thing.
  {
    id: "bloom_wellroot_house",
    section: "bestiary",
    kind: "Field note",
    title: "The Wellroot",
    gate: 23,
    fac: "amaranth",
    prov: {
      source: "House Amaranth battlegroup, field log",
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written by the people who fought it. They had been tending it for two seasons.",
    },
    body: [
      "It has a name in the Cultivar Works' books and a different one in the lance's, and this is the lance's. It does not move; it was never meant to. It was meant to be where it is — that is the entire program, a target zone the relays steer the drift into, and this is what a target zone becomes when it has been fed for long enough. It calls up burrowers of its own the longer a fight runs, and the ground around it has not been ground for a season.",
      "The Root Answers Back was the first time it pushed against the containment instead of sitting inside it. Nobody on the line thinks it escaped. It was talking, in the only language it has, and it was not asking.",
    ],
  },
  {
    id: "bloom_bramble",
    section: "bestiary",
    kind: "Field note",
    title: "The Bramble",
    gate: 26,
    fac: "amaranth",
    prov: {
      source: "House Amaranth battlegroup, field log",
      filedAs: "Field note, line unit",
      reliability: 3,
      note: "Written the week it appeared. Read as such.",
    },
    body: [
      "Fast. That is the first thing, and for a lot of people it was the last: nothing the program is built around moves like this. The drift the relays steer is slow and dull and goes where it is put, and the Bramble is what that same drift becomes when it stops going. It comes in packs of four to six, it closes across open ground in a turn, and it hits at the reach of a claw with the weight of something that has been growing on the terraces' own feed for two seasons.",
      "It does not respond to the relays. That is the finding, and the Works can dress it up however they like — a strain, a rejection, a failure of doctrine. The lance's version is shorter. The garden stopped being tended, and this is the weed.",
    ],
  },

  // ---- research ------------------------------------------------------
  // Research — papers. Allowed to be wrong; the reliability mark says so.
  {
    id: "paper_wardcrop",
    section: "research",
    kind: "Paper",
    title: "Principles of Redirection: the Ward-Crop Program",
    gate: null,
    fac: "amaranth",
    prov: {
      source: "The Cultivar Works, House Amaranth",
      filedAs: "Program primer, internal, issued to every officer of the battlegroup",
      reliability: 2,
      note: "The House's own account of the House's own program. Correct in every particular it measures.",
    },
    body: [
      "The drift is not an enemy. That is the first principle, and every officer of the battlegroup is asked to read the sentence twice before objecting to it. An enemy is fought; a blight is managed. The Reach's terraces were the first ground anywhere to get a close, sustained look at what the drift does to living tissue, and what the first generation of the program found was that it behaves like a blight — it follows water, it prefers saturated ground, it spreads along lines that can be predicted and, with the right fields in the right places, chosen.",
      "The second principle follows: a drift that can be predicted can be steered. The ward-crop is a cultivar bred, over three decades, to be more attractive to the drift than anything growing beside it. Plant it on the ground you can spare and the drift goes there and not to the ground you cannot. The relay is what makes the ward-crop's pull reach further than a field — it is a signal, not a fence.",
      "The third principle is the one the program's critics never quote: the redirected drift is still drift. It is not gone. It is somewhere the House chose, being watched by people the House pays, on ground the House has written off. The program calls this stewardship. It is a fair word for it as long as the watching continues.",
    ],
  },
  {
    id: "paper_relay",
    section: "research",
    kind: "Paper",
    title: "The Diversion Relay: Operating Note",
    gate: 2,
    fac: "amaranth",
    prov: {
      source: "The Cultivar Works",
      filedAs: "Operating note, issued with each relay",
      reliability: 3,
      note: "It's a manual. It's right.",
    },
    body: [
      "A relay does one thing: it makes a target zone read, to the drift, as a field of ward-crop many times its size. Under load — a drift heavier than the zone was rated for — the relay does not fail gracefully. It keeps pulling until the zone is oversubscribed, and then it pulls a drift onto ground that cannot hold it, and the ground fails before the relay does.",
      "Hold the relay. A relay lost under load does not release the drift it has already called; it strands it, and a stranded drift goes where a drift goes when nothing is telling it otherwise, which is toward whatever is nearest and alive.",
    ],
  },
  {
    id: "paper_tolerance",
    section: "research",
    kind: "Paper",
    title: "Drift Tolerance: Working Tables",
    gate: null,
    fac: "amaranth",
    prov: {
      source: "The Cultivar Works",
      filedAs: "Working tables, revised by season",
      reliability: 2,
      note: "The House's numbers. Trust the direction, not the digits.",
    },
    revisions: [
      {
        after: 8,
        body: [
          "The tables state, for each terrace tier, the drift load a target zone can absorb per season before the ward-crop's pull saturates. They are the program's arithmetic and every relay's rating is read off them. As of this printing every zone on the terraces is inside tolerance, with the lower tiers carrying the most margin.",
          "The Quiet Growth is noted as an observation, not a revision: a target zone on the eighth terrace showed growth outside its rated footprint for three nights. The Works' reading is a survey error. The tables are unchanged.",
        ],
      },
      {
        after: 15,
        body: [
          "Revised. The Rootbound zone's growth is not a survey error and the tables did not predict it. The Works' reading is that the zone's ward-crop has been feeding the drift as well as calling it, and that a fed drift grows faster than a called one. A correction factor has been added to every table. Every zone on the terraces is inside the corrected tolerance.",
        ],
      },
      {
        after: 23,
        body: [
          "Withdrawn. The tables are no longer issued. The zone the program was built around — the one the lances call the Root — has exceeded every tolerance the Works can write, and pushed back against containment for the first time. The Works does not have a number for a zone that answers. It is working on one.",
        ],
      },
    ],
  },
  {
    id: "paper_after_action_12",
    section: "research",
    kind: "Paper",
    title: "Relay Failure Under Load: After-Action",
    gate: 12,
    fac: "amaranth",
    prov: {
      source: "Battlegroup staff, House Amaranth",
      filedAs: "After-action, reviewed by the line",
      reliability: 3,
      note: "Written by the people who held it.",
    },
    body: [
      "The relay failed at the load the operating note said it would, which is the finding nobody wanted: the note was right and the tables were wrong. The zone was oversubscribed for eleven days before the failure and the Works' own figures showed it inside tolerance for all eleven.",
      "The line held long enough for the fix. It held because one lance held it alone, and because the officer running that lance did not wait for permission she had not been given. The staff records this without comment on the paperwork that followed, except to note that the paperwork followed.",
    ],
  },
  {
    id: "paper_bramble",
    section: "research",
    kind: "Paper",
    title: "On the Bramble: a Preliminary Note",
    gate: 26,
    fac: "amaranth",
    prov: {
      source: "The Cultivar Works",
      filedAs: "Preliminary, unreviewed, circulated to the battlegroup at its request",
      reliability: 1,
      note: "The Works does not know. This is the Works saying so.",
    },
    body: [
      "The strain does not respond to the relays. Every test the Works can run from behind the line agrees: a Bramble pack walks past a rated target zone without turning, and walks into the nearest lance instead. The ward-crop's pull, which has steered every drift on the terraces for three decades, does nothing to it.",
      "The Works' best reading is that it is not a new arrival. It is the program's own drift — fed, called, and held in one place for long enough that a part of it stopped answering. The Works declines to say whether that means the doctrine can be repaired or has been answered. It notes only that the Root and the Bramble have not yet been seen to move together, and that the day they do, this note will need a second edition.",
    ],
  },

  // ---- history -------------------------------------------------------
  // History and charter text.
  {
    id: "hist_house_charter",
    section: "history",
    kind: "Record",
    title: "House Amaranth: the Charter",
    gate: null,
    fac: "amaranth",
    prov: {
      source: "Charter of House Amaranth",
      filedAs: "Preamble and Articles One to Three, as displayed in the Gallery",
      reliability: 3,
      note: "It is the founding document. It is also a family telling you who it is.",
    },
    body: [
      "The House holds the terraces by charter of the Coalition, granted to the founding line for the settling of the Reach and the feeding of its worlds, and holds them still. The charter names the terraces, the seat, the Seal, and the levy — the House's right to raise and hold a battlegroup of its own in the Reach's defence, under its own Seal, beside the sector's own regulars and not beneath them.",
      "The founding line is generations deep in the ground it holds. The Reach's wealth is the terraces' wealth and the Reach's name is the House's name, and every survey the Coalition has ever taken of the sector begins at the Greathouse's gate because that is where the sector's records were kept before there was a sector to keep them for.",
      "The charter has been read at the investiture of every Sword the House has ever conferred. It has never been amended. Article Nine, which divides the Seal from the Sword, is displayed in the Control Room and not the Gallery, for reasons the House considers self-evident.",
    ],
  },
  {
    id: "hist_program",
    section: "history",
    kind: "Record",
    title: "The Ward-Crop Program: a House History",
    gate: null,
    fac: "amaranth",
    prov: {
      source: "House Amaranth, the Gallery",
      filedAs: "Exhibit text",
      reliability: 1,
      note: "A family history, written by the family.",
    },
    body: [
      "In the first decade of the drift, when the Coalition's survey offices were still calling it a curiosity, the Lady of the House walked the lower terraces every morning and wrote down where the colour had reached overnight. She did what a farmer does with blight. She studied it. She bred against it. She found, in the third year, that a cultivar could be made that the drift preferred, and that a drift with a preference could be led.",
      "Her daughter inherited the notebooks, the cultivar, and the conviction. Halcyon Amaranth has held the Seal through the whole of the war's worst years on the Reach and has held the program with it, and when the war turned hard enough on her watch that the terraces themselves were in question, she did what three decades of the family's work had been for: she led the drift away from the House's lands, and called it stewardship, and it was.",
      "The program is the reason the terraces still feed the Reach. That is the whole of the exhibit and the House does not think it needs a second sentence.",
    ],
  },

  // ---- leadership ----------------------------------------------------
  // Leadership — who actually holds what.
  {
    id: "lead_halcyon",
    section: "leadership",
    kind: "Record",
    title: "The Head of the House",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: 5,
        body: [
          "Halcyon Amaranth. Head of the founding line, holder of the Seal, and the program's owner in every sense the charter recognises. She is not on the terraces. She is where the Reach's politics are done, and the officer who came for the muster carried her Seal the way a courier carries a letter — it spoke for her, and the battlegroup made it look easy because that is what the Seal was there to see.",
        ],
      },
      {
        after: 19,
        body: [
          "She came to the front. Once, at the Weight of the Seal, and she stood where the relays could be heard while the numbers were explained to her, live, under fire, by the officer who runs her lances. She listened. She asked what the numbers would say next season. Nobody on the staff had an answer, and she left with that.",
        ],
      },
      {
        after: 24,
        body: [
          "The sector moved to take the program from her by force, and the battlegroup got her out ahead of the loyalist troops. Whether the House still has a Seal in any sense the Registry recognises is a question the staff has stopped asking out loud. She is somewhere the sector cannot reach. She has not been reached.",
        ],
      },
      {
        after: 34,
        body: [
          "No word. The last confirmation that the House still had political cover of any kind came before the Bramble, and there has been nothing since. The battlegroup holds the terraces under a Seal it cannot see, for a program its owner may no longer be alive to own. It holds them anyway.",
        ],
      },
    ],
  },
  {
    id: "lead_sealholder",
    section: "leadership",
    kind: "Record",
    title: "The Seal in Absentia",
    gate: 5,
    fac: "amaranth",
    prov: {
      source: "Battlegroup staff, House Amaranth",
      filedAs: "Standing note, Control Room",
      reliability: 3,
      note: "The chain of command, as it actually runs.",
    },
    body: [
      "The Seal is held. It is held on Osnius, by a member of the founding line whose name does not appear in the battlegroup's orders because the battlegroup's orders do not come from the Seal. The Seal speaks for the House in its standing, its charter, its levies, and its name; it does not speak to a lance, and it has not been on the terraces since the war began.",
      "In the field the House is Brig. Amaranth, and the lances are Col. Marrow, and between the two of them sits Article Nine and an empty chair. Every officer new to the estate is walked past the chair on their first day. Nobody explains it. That is the explanation.",
    ],
  },
  {
    id: "lead_governor",
    section: "leadership",
    kind: "Record",
    title: "The Sector Governor-General's Office",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: 9,
        body: [
          "The Reach is held, nominally, by a sector governor-general who answers to a Core that has never once been in danger from anything that happens here. The office fields the Reach's own regulars — the loyalists, in the House's vocabulary, which is not a compliment — and it audits the charter houses' levies on a schedule the houses consider theirs to ignore.",
          "Loyalist Eyes was an audit. An auditor from the office toured the program for a day and watched the battlegroup hold a clean, boring line for an audience that had come hoping for a mess. The auditor's report is not on this console. The staff assumes it was disappointed.",
        ],
      },
      {
        after: 14,
        body: [
          "The office sent a liaison, and the liaison saw too much, and the battlegroup escorted him out before he could see the rest. What he took back to the office is not known. What the office has done since — more audits, closer, with regulars attached — is.",
        ],
      },
      {
        after: 24,
        body: [
          "A seizure order. The office moved to take the program by force, on the grounds that it is either a lie or a liability and the sector cannot afford to find out which. The House's read is that the office has finally noticed that the terraces are the only ground in the Reach the drift is not eating, and would like to own the reason.",
        ],
      },
      {
        after: 29,
        body: [
          "The seizure force landed. It cost the House a whole outer terrace to hold it off, and the office's regulars are on that terrace now, holding it against the same drift the House was holding it against, with none of the program to help them. The staff notes that this is what the office asked for.",
        ],
      },
    ],
  },

  // ---- civilian ------------------------------------------------------
  // Civilian life.
  {
    id: "civ_terraces",
    section: "civilian",
    kind: "Record",
    title: "The People on the Terraces",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: 11,
        body: [
          "The program is not run by the battlegroup. It is run by ward-crop technicians — rigs, seals, survey — who walk the target zones on foot, read the relays, and replant the cultivar where the drift has thinned it. They are House people in the old sense: company housing, generational, the money at one remove and the seat never. Most of them grew up on the terrace they now tend. Most of them have never been off it.",
          "A technician went missing inside a growth zone this season. The program's ledger records a replanting delayed. The battlegroup's records the extraction. Nobody's records the name, because the program does not log its casualties and the battlegroup was not there when it happened.",
        ],
      },
      {
        after: 27,
        body: [
          "Salvage the Season pulled a whole terrace's technicians out ahead of a Bramble breach. The lances did it in one night and the program's ledger records a season lost. The technicians record it differently. Several of them have asked for a uniform.",
        ],
      },
      {
        after: 31,
        body: [
          "Not everyone got out. What the Program Costs was the evacuation of the House's own workers ahead of the breach, and the battlegroup did it under fire, and the ledger has a number now that it did not have before. The staff is told the number is small. The staff has stopped reading the ledger.",
        ],
      },
    ],
  },

  // ---- tech ----------------------------------------------------------
  // Technology.
  {
    id: "tech_relay",
    section: "tech",
    kind: "Record",
    title: "The Diversion Relay",
    gate: 2,
    fac: "amaranth",
    prov: {
      source: "The Cultivar Works",
      filedAs: "Apprentice primer, House engineering",
      reliability: 3,
      note: "What a first-year needs to know before standing near one.",
    },
    body: [
      "A mast, a field coil, and a bed of ward-crop at the base of it, sized to a terrace tier. The coil does not broadcast anything a mech's sensors will read; it carries the cultivar's own signal — whatever it is the drift prefers about it — further than the plants themselves could. The Works has bred the cultivar for three decades and does not fully know what the signal is. It knows the drift turns toward it, and it knows how far.",
      "A relay is rated for a load. Under it, the target zone thickens on schedule and the surrounding ground stays clean. Over it, the zone outgrows the footprint and the relay keeps pulling anyway, because a relay does not know what a footprint is. The rating is written on the mast. Read it before the fight, not during.",
    ],
  },
  {
    id: "tech_array",
    section: "tech",
    kind: "Record",
    title: "The Containment Array",
    gate: 18,
    fac: "amaranth",
    prov: {
      source: "The Cultivar Works",
      filedAs: "Field note, issued with the first array",
      reliability: 2,
      note: "New this season. Nobody has seen one hold through a whole one.",
    },
    body: [
      "A ring of relays wired to pull inward instead of outward — not a fence, the Works insists, a fold: a zone that is more attractive from the inside than from the edge, so that a drift already in it stays in it. The first was deployed onto contested ground at the Cultivator's Gambit, directly onto a zone that was still hot, because there was no cold ground left to put it on.",
      "It held. The Works is careful about the tense.",
    ],
  },

  // ---- world ---------------------------------------------------------
  // The Amaranth Reach.
  {
    id: "hworld_reach",
    section: "world",
    kind: "Brief",
    title: "The Amaranth Reach",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: null,
        body: [
          "The House's sector, by the House's own account: a frontier cluster the founding line settled, fed, and named, held nominally by a sector governor-general whose office is on Meridian and whose attention is elsewhere. The terraces are the Reach's wealth. The battlegroup is the terraces' defence. The drift is the terraces' problem before it is anyone else's, and the House has been solving it, quietly, since before the Coalition called this a war.",
        ],
      },
      {
        after: 24,
        body: [
          "The sector has moved against the House. Whatever the Reach was — the House's sector, in every way that mattered on the ground — it is a contested one now, with loyalist regulars on House terraces and a seizure order that names the program by its charter title. The staff has stopped saying 'the Reach' and started saying 'the terraces'. Smaller. More accurate.",
        ],
      },
      {
        after: 36,
        body: [
          "The Stalling Season ended with the terraces still the House's and the drift still where the House put it. At the House's own scale, the program held. Nobody on the staff is claiming more than that, and nobody has to.",
        ],
      },
    ],
  },
  {
    id: "hworld_warden",
    section: "world",
    kind: "Brief",
    title: "Warden Company",
    gate: 4,
    fac: "amaranth",
    revisions: [
      {
        after: 4,
        body: [
          "A chartered private formation holding the border line beside the House's own, under a corporate name and a carrier older than the war. Good Neighbors was the first contact on the shared border: wary, correct, unfriendly, on both sides. They fight the drift as an enemy, which the House considers a limitation, and they fight it well, which the House considers inconvenient.",
        ],
      },
      {
        after: 6,
        body: [
          "House Colors will be remembered on their side as the House abandoning a position. On this side it was a withdrawal ordered by the Seal, mandated by the bargain, executed by an officer who hated every step of it and said so on the record. Both accounts are true. Neither side has read the other's.",
        ],
      },
      {
        after: 20,
        body: [
          "Marrow's Line. Their lieutenant and the House's colonel on one field, and the House's objective was never to win it — it was to prove the battlegroup could disengage on its own terms, in order, under fire, and it did. Marrow told their lieutenant something on the way out about her own company's paperwork. She has not repeated it here, and she was not asked to.",
        ],
      },
    ],
  },
  {
    id: "hworld_terraces",
    section: "world",
    kind: "Brief",
    title: "The Terraces",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: null,
        body: [
          "Tiered ground, cut into the Reach's hills generations ago for the crops that feed the sector, and now cut a second time — into the fields the House farms and the zones the House feeds to the drift. From the Greathouse's gate the lower terraces read as a patchwork: green where the cultivar is thin, the drift's own colour where the relays have called it, and a line of bare ground between the two that the technicians replant every season and the drift crosses every season anyway.",
        ],
      },
      {
        after: 8,
        body: [
          "A zone on the eighth terrace grew outside its footprint for three nights, and a night watch that should not have needed this much watching needed it. The Works calls it a survey error. The lance that stood the watch calls it the first time the terraces did something the tables did not say.",
        ],
      },
      {
        after: 26,
        body: [
          "The Bramble changed what the terraces are. A zone was a place the drift was kept; now a zone is a place the Bramble comes from, and the bare line between the fields and the zones is a line the lances hold rather than a line the technicians replant. The lower terraces are not green anywhere.",
        ],
      },
      {
        after: 36,
        body: [
          "Held. The drift is where the House put it and the Bramble is not anywhere, and the technicians are replanting the line. It is not what the terraces were. It is the House's, and it is fed, and for the House that has always been the same sentence.",
        ],
      },
    ],
  },
  {
    id: "hworld_root",
    section: "world",
    kind: "Brief",
    title: "The Root",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: 15,
        body: [
          "A target zone — the program's oldest, the one the whole method was built around — growing faster than it is told to. Rootbound was the first time a relay's zone outran its rating with the relay intact, and the lances held the line around it while the Works decided whether to be worried. The staff has started calling it the Root. The Works has not.",
        ],
      },
      {
        after: 17,
        body: [
          "The House's own survey team went in under the terraces and found what is growing under the zone. They reported, against Col. Marrow's instinct and over her objection, that it is still within tolerance. The report is on file at the Works. Her objection is on file here.",
        ],
      },
      {
        after: 23,
        body: [
          "It answered. Not an escape — a push, against the containment, in the only language it has. The battlegroup held it, and it stopped, and nobody on the line believes it stopped because it was beaten. The Works has withdrawn its tables. The staff has stopped asking the Works.",
        ],
      },
      {
        after: 35,
        body: [
          "The Root and the Bramble moved together. The thing the House has been feeding for two seasons and the thing that stopped answering the relays are not two things, and the last of the program's own doctrine that assumed they were is gone.",
        ],
      },
      {
        after: 36,
        body: [
          "Held, at the Root, until the doctrine closed the loop — the array, the relays, the whole of three decades, brought to bear on the one zone it was all for. It is pacified. The House's word. The lances have not found a better one, and have stopped looking.",
        ],
      },
    ],
  },
  {
    id: "hworld_meridian",
    section: "world",
    kind: "Brief",
    title: "Meridian",
    gate: null,
    fac: "amaranth",
    revisions: [
      {
        after: null,
        body: [
          "The Reach's capital world and the governor-general's seat: shipyards, the elevator, more people than the rest of the sector together. The House has a residence there it does not use. The terraces feed it, and it has never once had to think about how.",
        ],
      },
      {
        after: 24,
        body: [
          "The seizure order came from Meridian. The House's residence there is closed. What the capital is doing about the drift that is not on the terraces is not the House's business, and the House has stopped asking to be told.",
        ],
      },
    ],
  },

  // ---- glossary ------------------------------------------------------
  // Glossary — short lookups, always browsable, never gated.
  {
    id: "gloss_wardcrop",
    section: "glossary",
    kind: "Reference",
    title: "Ward-crop",
    gate: null,
    body: [
      "A cultivar bred by House Amaranth to draw the drift — the crop the Bloom prefers, planted where the House wants the Bloom to go.",
    ],
  },
  {
    id: "gloss_relay",
    section: "glossary",
    kind: "Reference",
    title: "Diversion relay",
    gate: null,
    body: [
      "A mast that carries the ward-crop's pull further than the plants themselves can. The bargain's machinery. Rated for a load; not to be trusted past it.",
    ],
  },
  {
    id: "gloss_seal_sword",
    section: "glossary",
    kind: "Reference",
    title: "The Seal / the Sword",
    gate: null,
    body: [
      "A charter house's battlegroup is held by whoever holds the Seal and led by whoever holds the Sword. Not the same person, by law. See Leadership.",
    ],
  },
  {
    id: "gloss_beacon",
    section: "glossary",
    kind: "Reference",
    title: "Beacon",
    gate: null,
    body: [
      "Field revival. A beacon placed inside your own sight and reach spends one crate and one charge to put a downed pilot back on their feet in the fight that is still going on around them — not the next one. Both are bought ahead of time and both run out. A Fabricator Mek's own pilot draws on that Mek's spares instead of the company shelf.",
    ],
  },
  {
    id: "gloss_stress",
    section: "glossary",
    kind: "Reference",
    title: "Stress",
    gate: null,
    body: [
      "What a pilot is carrying, nought to a hundred. It goes up on hard missions and comes down with rest and decent company. At 70 they are near the line, and past it the game starts making some of their decisions for you.",
    ],
  },
  {
    id: "gloss_morale",
    section: "glossary",
    kind: "Reference",
    title: "Morale",
    gate: null,
    body: [
      "How a pilot feels about being here, nought to a hundred. At or below 25 it is flagging, and a flagging pilot is one bad mission away from refusing a deployment outright.",
    ],
  },
  {
    id: "gloss_standing",
    section: "glossary",
    kind: "Reference",
    title: "Standing",
    gate: null,
    body: [
      "What one person aboard thinks of another, or of you. It moves on what you actually do rather than what you say, it decides who will talk to you about what, and at 50 it is the floor a relationship can start from.",
    ],
  },
  {
    id: "gloss_points",
    section: "glossary",
    kind: "Reference",
    title: "Personal points",
    gate: null,
    body: [
      "A pilot's own ledger, earned by that pilot and spent on that pilot — it is what buys their way up the gear tiers. The company's money is a separate ledger and the two never pour into each other.",
    ],
  },
  {
    id: "gloss_framesystem",
    section: "glossary",
    kind: "Reference",
    title: "Frame system",
    gate: null,
    body: [
      "A module bolted into the frame rather than carried in its hands — plating, drive, sensors, generator. Bought once, fitted once, and it changes what the mech can do rather than how hard it hits.",
    ],
  },
  {
    id: "gloss_catalyst",
    section: "glossary",
    kind: "Reference",
    title: "Catalyst",
    gate: null,
    body: [
      "The one formative thing in a person's past, filed by the service as a temperament. It is not a stat and it does not touch a single number in a fight. It decides who gets on with whom, and which two people never will.",
    ],
  },
  {
    id: "gloss_chassis",
    section: "glossary",
    kind: "Reference",
    title: "Chassis",
    gate: null,
    body: [
      "The frame's body plan, set by the pilot's species and never changed. Bipedal is the default. Centauroid can Charge. Vibrissal reads the ground close-in and finds what is buried in it.",
    ],
  },
  {
    id: "gloss_synker",
    section: "glossary",
    kind: "Reference",
    title: "Synker",
    gate: null,
    body: [
      "The word for the job, and the older of the two: a synker is synchronised to the frame, and there have been synkers for as long as there have been frames to sync to. Official paper says synker because it is correct. Pilot is the borrowed word — a vehicle word, put on mechs by people selling tickets — and it is what the line, this manual, and most of the field notes in this archive actually say.",
      "Collective in service usage: an officer says \"one of my synker\" the way he would say one of my personnel. Counted like anything else outside it — two synkers, the synkers in Lance B.",
    ],
  },

  // ---- systems -------------------------------------------------------
  // Systems — how the war's own machinery works, told straight.
  {
    id: "system_class_triangle",
    section: "systems",
    kind: "Reference",
    title: "The Three Paths",
    gate: null,
    body: [
      "Every pilot flies one of three combat paths, and the three beat each other in a loop: Meeps beats Reeps, Reeps beats Tank, Tank beats Meeps. No path is strongest overall — which one wins a fight depends entirely on who's fighting whom.",
      "A Meeps is fast and fragile — six tiles of movement, one-tile reach, built to close distance before anything can react. It doesn't out-fight a Tank; it goes around one, because a Tank's whole threat is standing next to you, and a Meeps' whole plan is never giving it the chance.",
      "A Tank stands its ground — short movement, high defense, an overshield that protects everyone standing near it. It punishes anything that comes adjacent. It has no answer to anything that doesn't.",
      "A Reeps fights from range — two to four tiles out, never in melee, never countered for it. It chips away at a Tank's raised defense from a distance the Tank can't close, and it dies in two hits if a Meeps ever actually reaches it.",
      "A fourth path, Munti, sits outside the triangle entirely. It doesn't win fights — it keeps everyone else alive. Every mission is quietly a mission to protect it.",
    ],
  },
  {
    id: "system_chassis",
    section: "systems",
    kind: "Reference",
    title: "Chassis and Species",
    gate: null,
    body: [
      "Every pilot's body shapes how they move and fight, independent of which of the three paths they've chosen — a Hiopi Meeps and a human Meeps are both Meeps, they just get there differently.",
      "Human pilots use the standard bipedal frame — no terrain penalties, no special tricks, a slightly higher baseline toughness to make up for it.",
      "Hiopi pilots use a centauroid frame — full speed across open ground, slower through rubble and tight structures, and a real reward for committing to it: charging three tiles or more in a straight line before striking hits harder.",
      "Osnian pilots use a modified bipedal frame with a longer sensor suite — wider vision, and the ability to see burrowed threats other pilots can only find by walking into them.",
    ],
  },
  {
    id: "system_mek",
    section: "systems",
    kind: "Reference",
    title: "Meks",
    gate: null,
    body: [
      "Every pilot has exactly one Mek — never on the board, never a target, never lost to anything that happens in a fight. A Mek doesn't fight. It's the reason the pilot fights a little better, all the time, without anyone having to think about it mid-mission.",
      "Four real specialties, and a Mek carries one, sometimes two. A Fabricator keeps spare parts in reserve — a downed pilot's own restock crate, so when Beacon Control pulls them back into the fight it costs the company nothing from the Restock Room shelf. An Armorer simply makes the whole unit hit harder and shrug off more. A Runemaster sharpens awareness and reaction across the board — sees further, reacts first, and makes whatever the pilot's own weapon does on a hit last longer and bite harder. A Fieldwright rewards holding position: heals the pilot who stays put, and if that pilot is a Munti, makes their own healing hit harder too.",
      "One specialty exists only as a Mek's second skill, never its first — a Mek that's purely good at stretching the company's points further, cheaper gear for the rest of the campaign, nothing sharper in a fight. Not every pilot wants that trade. Some do, and it adds up.",
    ],
  },
  {
    id: "system_gear",
    section: "systems",
    kind: "Reference",
    title: "Gear Tiers",
    gate: null,
    body: [
      "Every pilot starts on standard issue and earns better with points spent, not levels grinded — a straight climb from G up to A, seven rungs, each one a real but modest step rather than a leap that makes everything below it obsolete. The company doesn't hand out gear that turns a fight into a stat check. It hands out gear that turns a close fight into a winnable one.",
      "What it's actually called changes with what a pilot flies. A Meeps climbs from a Stocklance through Heavylance, Twinlance, and Pairblade, on to an Arcblade, a Flareblade, and — for the very few who get there — a Stormblade. A Tank goes Blockshield to Wallpanel to Skinshield to Groupshield, then Maserline, Tachlance, Bastion. A Reeps runs a Popgun up through Burstrifle, Twinburst, Longeye, Farmark, Twinmark, to a Skyline. A Munti's kit goes from a Quickfix kit to a Longarm, a Farfix, a Lifebox, a Quickbox, a Widefix, and at the very top, an Overcharge.",
      "D-tier is the first rung that earns a real ability. B-tier earns a second. A-tier is as far as the standard ladder goes — and past it, there's nothing left to buy. What's past it isn't for sale at all.",
    ],
  },
  {
    id: "system_collapse",
    section: "systems",
    kind: "Reference",
    title: "How the Bloom Dies: the Collapse Rule",
    gate: null,
    body: [
      "A Bloom creature's health isn't one bar — it's two: Endurance, the shell, and Vitality, the thing living underneath it. Damage empties Endurance first, and a hit that overflows past zero Endurance does not carry into Vitality — the shell simply breaks. Once Endurance hits zero, the creature enters Collapse: any hit at least as hard as its remaining Vitality kills it outright, and — this is the part worth watching for — a creature in Collapse hits back at full strength, not weaker. The moment it looks like it's dying is the moment it's most dangerous. That's not a bug in how it reads. That's the whole point.",
    ],
  },
  {
    id: "system_heirloom",
    section: "systems",
    kind: "Reference",
    title: "Heirlooms",
    gate: null,
    body: [
      "An Heirloom is not a weapon a pilot earns. It is a mech and a pilot together: a frame built generations ago for one family's use, and the son or daughter of that family who climbs into it. The frame sits at S, a rung above the top of the earned ladder, and no amount of points moves anyone onto it. No house sends one of its own to a company that has not first proved it can hold.",
      "Recruiting one costs the company, not the pilot. Growing the kit afterward costs the pilot, the way any pilot grows. An Heirloom carries three abilities, each on its own timer, and the frame's name is the name of the thing it does best. Only one takes the field at a time. The rest wait on the ship.",
      "They are family property. The company never owns one — it borrows one, through that family's child, and if the child does not come home, neither does the frame. The house takes it back, and nobody argues.",
      "Not everything aboard at S was issued by a house. What Warden Company holds that no family will claim has its own entry.",
    ],
  },
  {
    id: "system_requiem",
    section: "systems",
    kind: "Reference",
    title: "The Requiem System",
    gate: 1,
    revisions: [
      {
        after: 1,
        body: [
          "One charge, shared by the whole company — filled by every hit landed and every hit taken, by anyone on the field, and spent all at once by whoever is holding the weapon when it is full. Aim it in a straight line, eight tiles long, and it fires.",
          "It doesn't ask what's standing in that line. Ally, enemy, doesn't matter — it hits everything the same, at the same fixed, ugly number, no gear bonus, no defence stat softening it, nothing. Every other hit in this war respects one limit: nothing can drop a mech from full health in a single shot. This doesn't know that rule exists. And against anything the Bloom fields with a shell worth grinding down — the kind of thing that shrugs off everything smaller — it doesn't grind. It goes straight through the shell to whatever's actually alive underneath, and if that's not much, that's the whole fight, over, in one line drawn across the map.",
          "The one weapon that runs it is called Gjallar. It was not inherited. Bosk carries it, and how he came to is not a thing he explains.",
          "Charging it is free. Firing it never is.",
        ],
      },
      {
        after: 12,
        body: [
          "Gjallar is Rourke's now. The company's charge fills for her hand the same as it filled for his — every hit landed, every hit taken, by anyone — and spends the same way: one straight line, eight tiles, no exceptions for what's standing in it. Nothing about the weapon changed. Everything about who's holding it did.",
          "Charging it is free. Firing it never is.",
        ],
      },
    ],
  },
  {
    id: "system_weapons_bay",
    section: "systems",
    kind: "Reference",
    title: "The Weapons Bay",
    gate: null,
    body: [
      "Providence has guns. Whether they can reach a given field is a matter for the mission and where the ship is sitting, not for anyone on the ground — but when they can, a pilot with the ship on the line can call them down on any ground that pilot can see. The strike lands flat. Everything hostile standing near the mark takes it, cover doesn't soften it, and nothing shoots back at a gun that isn't on the field. It costs the pilot who called it their whole turn, and it costs the company one of two calls a mission. A strike on empty ground still spends the call.",
      "The Weapons Bay is the reserve line. Build it and the ship keeps one more round ready past the two — usable only once those are gone, and slow to reload between calls. The Forward Battery, fitted in the Workshop on top of the bay, widens what a strike covers from a tight box around the mark to a broad one. More ground per call. Not more calls.",
    ],
  },
  {
    id: "system_sensor_array",
    section: "systems",
    kind: "Reference",
    title: "The Sensor Array",
    gate: null,
    body: [
      "A carrier's own sensors reach further than any mech's. Built and powered, the Long-Range Sensor Array puts what the ship can see onto every pilot's board: no hostile on open ground is hidden from the lance because it happens to be out of one pilot's sight, on any field, for the rest of the campaign.",
      "What it does not do is see under the ground or through a cloak. A burrower is still a burrower, and a thing lying in ambush is still lying there. The array finds what's standing up. Finding the rest is still the pilot's job.",
      "It draws real power. The Generator comes first.",
    ],
  },

  // ---- glossary ------------------------------------------------------
  // Glossary — short lookups, always browsable, never gated.
  {
    id: "gloss_0",
    section: "glossary",
    kind: "Reference",
    title: "Meeps",
    gate: null,
    body: [
      "Fast, fragile combat path. Six tiles of movement, one-tile reach. Beats Tank, loses to Reeps.",
    ],
  },
  {
    id: "gloss_1",
    section: "glossary",
    kind: "Reference",
    title: "Reeps",
    gate: null,
    body: [
      "Ranged combat path. Fights from two to four tiles out, never in melee. Beats Tank at range, loses badly if a Meeps ever closes the distance.",
    ],
  },
  {
    id: "gloss_2",
    section: "glossary",
    kind: "Reference",
    title: "Tank",
    gate: null,
    body: [
      "Defensive combat path. Short movement, high defense, an overshield that protects nearby allies. Beats Meeps, loses to Reeps.",
    ],
  },
  {
    id: "gloss_3",
    section: "glossary",
    kind: "Reference",
    title: "Munti",
    gate: null,
    body: [
      "Support path. Outside the triangle entirely — doesn't fight to win, keeps everyone else alive. Every mission is quietly a mission to protect it.",
    ],
  },
  {
    id: "gloss_4",
    section: "glossary",
    kind: "Reference",
    title: "Endurance",
    gate: null,
    body: [
      "A Bloom creature's outer health value. Depletes first; a hit that overflows past zero doesn't carry through to Vitality underneath.",
    ],
  },
  {
    id: "gloss_5",
    section: "glossary",
    kind: "Reference",
    title: "Vitality",
    gate: null,
    body: [
      "What's actually alive underneath a Bloom creature's Endurance. Once Endurance hits zero, any hit at least this large kills outright.",
    ],
  },
  {
    id: "gloss_6",
    section: "glossary",
    kind: "Reference",
    title: "Collapse",
    gate: null,
    body: [
      "The state a Bloom creature enters the instant its Endurance hits zero. Fights back at full strength while in it — not weaker.",
    ],
  },
  {
    id: "gloss_7",
    section: "glossary",
    kind: "Reference",
    title: "Restock",
    gate: null,
    body: [
      "A downed pilot returns to the field at full strength next mission, rather than being lost for good — provided a Munti was alive on the field at the moment they went down. No Munti on the field, no restock.",
    ],
  },
  {
    id: "gloss_8",
    section: "glossary",
    kind: "Reference",
    title: "Mek",
    gate: null,
    body: [
      "A pilot's personal support partner. Never deployed, never a target, never lost to anything that happens in a fight.",
    ],
  },
  {
    id: "gloss_9",
    section: "glossary",
    kind: "Reference",
    title: "Bloom-mat",
    gate: null,
    body: [
      "Ground the Bloom leaves behind. Deals acid damage over time to anything standing on it.",
    ],
  },
  {
    id: "gloss_10",
    section: "glossary",
    kind: "Reference",
    title: "Spare part",
    gate: null,
    body: [
      "A Fabricator Mek's own restock crate. When Beacon Control revives that Mek's pilot mid-mission, the beacon burns one of these instead of a crate from the Restock Room.",
    ],
  },
  {
    id: "gloss_11",
    section: "glossary",
    kind: "Reference",
    title: "Lance",
    gate: null,
    body: [
      "A five-pilot squad; the basic organizational unit Warden Company is built from.",
    ],
  },
  {
    id: "gloss_12",
    section: "glossary",
    kind: "Reference",
    title: "Gear tier",
    gate: null,
    body: [
      "A pilot's own equipment ladder, G up through A, climbed with points rather than time served. An Heirloom pilot sits above it entirely, at S — a rung nothing can be bought up to.",
    ],
  },
  {
    id: "gloss_requiem",
    section: "glossary",
    kind: "Reference",
    title: "The Requiem system",
    gate: null,
    body: [
      "Warden Company's own company-wide charge mechanic. One charge, shared by the whole unit, spent by whoever's holding the weapon: a line of damage eight tiles long that doesn't check sides, and doesn't stop for a full shell of Endurance either. The one weapon that runs it is called Gjallar.",
    ],
  },
  {
    id: "gloss_heirloom",
    section: "glossary",
    kind: "Reference",
    title: "Heirloom",
    gate: null,
    body: [
      "A family's own mech, generations old, at S tier — and the family's own son or daughter piloting it. Lent to a company that has proved it can hold, one on the field at a time. Returned to the house if the pilot doesn't come home.",
    ],
  },

  // ---- manual --------------------------------------------------------
  // Field Manual — out-of-fiction help. Reached mid-mission as HOW TO PLAY.
// Rewritten 7 Sep 2026 against the actual game files; see the plan doc 8.
  {
    id: "man_0",
    section: "manual",
    kind: "Reference",
    title: "Controls",
    gate: null,
    body: [
      "Everything happens by clicking the board. No drag, no hotkeys, no right-click menu.",
      "Click a unit — selects it. Click green — moves there, costs 1 action, doesn't end your turn. Click red — attacks, burns every remaining action and ends the unit's turn. Click cyan — Munti only, heals that ally instead of attacking. End Turn resolves the hostile AI's whole turn, then the environment step: bloom-mat burn, mat regrowth, shield regen, Munti regen, and any asset the mission is making you protect.",
    ],
  },
  {
    id: "man_1",
    section: "manual",
    kind: "Reference",
    title: "Reading the Board",
    gate: null,
    body: [
      "No sprites yet — every unit is a shape. Shape says class, fill says side, outline says chassis.",
      "Triangle — Meeps. Square — Tank. Diamond — Reeps. Circle with a bar — Munti. Blue fill is yours, tan is a hostile mech, a coloured blob is a Bloom creature. Thick white outline is a centauroid chassis. A burrowed Bloom renders faded and is already targetable at range — it is hiding from your eyes, not from your guns.",
    ],
  },
  {
    id: "man_2",
    section: "manual",
    kind: "Reference",
    title: "Terrain",
    gate: null,
    body: [
      "Tile colour on the board is the actual rules data, not decoration.",
      "Fourteen tile types with their move cost and defence stars — Plain, Road, Scrub, Rubble, Structure, Bloom mat, Ridge, Sump, Deploy pad, Spawn seam, Exit, Hold zone, Dock, Wall. Drawn with the real swatches in the game. Bloom mat is the one that costs you for standing still on it; Ridge and Structure are the two worth walking further to reach.",
    ],
  },
  {
    id: "man_3",
    section: "manual",
    kind: "Reference",
    title: "Health, Shield & Collapse",
    gate: null,
    body: [
      "Every unit shows a small bar above it. What's stacked there depends on what kind of unit it is.",
      "HP bar for your mechs and hostile mechs, with a blue line above it for anything inside a Tank's shield radius. Bloom creatures show Endurance over Vitality instead, and those two are not one long health bar: damage that overflows past Endurance is spent, not carried through. The creature enters Collapse the moment Endurance reaches zero, and it fights at full strength the whole way down. See Systems for the rule, and plan the second half of the fight as its own engagement.",
    ],
  },
  {
    id: "man_4",
    section: "manual",
    kind: "Reference",
    title: "The Class Triangle",
    gate: null,
    body: [
      "Meeps > Reeps > Tank > Meeps. Munti sits outside the triangle entirely.",
      "The base-damage matrix, attacker vs. defender, drawn with the real numbers in the game. Munti is on it for completeness and loses every column — it is not a fighting path and no matchup makes it one.",
    ],
  },
  {
    id: "man_5",
    section: "manual",
    kind: "Reference",
    title: "Abilities & House Rules",
    gate: null,
    body: [
      "Four abilities that come with a chassis or a path, and four rules that are this game's own.",
      "Overshield (Tank, passive), Repair (Munti, active), Charge (centauroid, passive), Sensor Sweep (vibrissal, passive — burrow detection is live, and a Runemaster-primary Mek extends its reach). Then the house rules: Meeps Dodge, 40% on two independent rolls; Tank Shield, a real 20-point pool that regenerates 8 a turn if that unit took nothing since the last tick; Munti Regen, 8 a turn inside 2 tiles, free and always on; and 2 Actions per Turn, where moving and repairing each cost one and attacking burns whatever is left.",
    ],
  },
  {
    id: "man_6",
    section: "manual",
    kind: "Reference",
    title: "Objectives",
    gate: null,
    body: [
      "Seven objective types. Four of them cannot be lost on the clock, and three can.",
      "eliminate_all — kill every hostile; the turn number on the briefing is a bonus target, not a deadline. hold_zone — get a unit onto the gold tiles and keep hostiles off them from the hold turn on; a real deadline. extract_unit — the named unit onto a green exit tile before the limit; a real deadline, and the one kept on purpose. clear_bloom — win when no bloom-mat tile is left on the board; the mat regrows, so clear it faster than it spreads. survive_n_turns — win the instant the turn count is reached with the squad still standing. contested_landing — the same win and loss as eliminate_all; what the name warns you about is the opening, because the hostiles are already on top of your deploy pads at turn 1. protect_asset — something off-board with its own health bar sits inside a defended perimeter, and it loses health once a turn for every hostile that ENDS its turn inside that perimeter. Not for every hostile that attacks. Pulling them out of the zone is the whole job; reaching the turn limit with the asset alive is a win.",
    ],
  },
  {
    id: "man_7",
    section: "manual",
    kind: "Reference",
    title: "Paths, Chassis and Mek Tracks",
    gate: null,
    body: [
      "The three things that decide what a mech does before you buy it a single piece of gear.",
      "PATH is the combat role — Meeps, Reeps, Tank, Munti — and it is what the class triangle reads. CHASSIS comes from the pilot's species and never changes: bipedal is the default, centauroid can Charge, and bipedal_vibrissal reads the ground close-in and finds burrowers. MEK TRACK is the person in the cradle, and there are five — Fabricator, Armorer, Runemaster, Fieldwright, Quartermaster. A Mek's primary track changes what that one pilot's frame actually does, which is why two identical mechs with different Meks are not identical mechs. Your roster is not fixed: pilots are recruited, assigned to lances, and lost. Who is currently on it is in Personnel, not here.",
    ],
  },
  {
    id: "man_8",
    section: "manual",
    kind: "Reference",
    title: "Reading a Briefing",
    gate: null,
    body: [
      "The briefing panel before a mission is the only place that tells you the win condition. Read the turn number correctly.",
      "The panel names the objective, the threat you have been told to expect, and a turn number. That number means two different things depending on the objective, and getting it wrong is the most common way a good squad loses a mission it was winning. For eliminate_all, clear_bloom, contested_landing and protect_asset it is a bonus target — running past it costs you a reward, never the mission. For hold_zone, extract_unit and survive_n_turns it is the mission. The threat list is what intelligence expected, not a guarantee; waves arrive on their own schedule and the briefing does not always know about the second one.",
    ],
  },
];


// ---------------------------------------------------------------------
// Pure lookups and gate maths. No save, no engine — everything here answers
// "what does this console show at this mission number."
// ---------------------------------------------------------------------

/** Resolve a per-facility value for one console. */
export function forFacility<T>(v: ArchiveByFacility<T>, fac: ArchiveFacility): T {
  return typeof v === "object" && v !== null && "warden" in (v as object)
    ? (v as { warden: T; amaranth: T })[fac]
    : (v as T);
}

/** The mission this gate resolves to on one console, or null for ungated. */
export function gateValue(gate: ArchiveGate, fac: ArchiveFacility): number | null {
  if (gate === null || gate === undefined) return null;
  if (typeof gate === "number") return gate;
  return gate[fac] ?? null;
}

/** Latest revision unlocked at `resolved`, or null if none is yet. */
export function latestRevision(
  entry: ArchiveEntry,
  fac: ArchiveFacility,
  resolved: number,
): ArchiveRevision | null {
  if (!entry.revisions) return null;
  let found: ArchiveRevision | null = null;
  for (const rev of entry.revisions) {
    const g = gateValue(rev.after, fac);
    if (g === null || g <= resolved) found = rev;
  }
  return found;
}

/**
 * Has this entry unlocked? A revisioned entry is unlocked once its FIRST
 * revision is — the entry does not appear at all before that.
 */
export function isEntryUnlocked(entry: ArchiveEntry, fac: ArchiveFacility, resolved: number): boolean {
  if (entry.revisions) return latestRevision(entry, fac, resolved) !== null;
  const g = gateValue(entry.gate, fac);
  return g === null || g <= resolved;
}

/** Is this entry on this console at all? */
export function isEntryOnFacility(entry: ArchiveEntry, fac: ArchiveFacility): boolean {
  return !entry.fac || entry.fac === fac;
}

/** The body that renders right now — the latest revision, or the plain body. */
export function bodyFor(entry: ArchiveEntry, fac: ArchiveFacility, resolved: number): string[] {
  const rev = latestRevision(entry, fac, resolved);
  return rev ? rev.body : (entry.body ?? []);
}

/** Which revision of how many, for the "REV 2/3" mark. 0/0 if not revisioned. */
export function revisionCount(
  entry: ArchiveEntry,
  fac: ArchiveFacility,
  resolved: number,
): { shown: number; total: number } {
  if (!entry.revisions) return { shown: 0, total: 0 };
  let shown = 0;
  for (const rev of entry.revisions) {
    const g = gateValue(rev.after, fac);
    if (g === null || g <= resolved) shown++;
  }
  return { shown, total: entry.revisions.length };
}

/** Every entry on one section of one console, unlocked or not. */
export function entriesInSection(section: ArchiveSectionId, fac: ArchiveFacility): ArchiveEntry[] {
  return ARCHIVE_ENTRIES.filter((e) => e.section === section && isEntryOnFacility(e, fac));
}

export function archiveEntryById(id: string): ArchiveEntry | undefined {
  return ARCHIVE_ENTRIES.find((e) => e.id === id);
}

// ---------------------------------------------------------------------
// Bands. The archive shows a word AND the number (decided 7 Sep, Q5) — the
// word does the reading, the number lets two people be compared. The
// cut-points are imported rather than copied so they can never drift from
// the thresholds the rest of the game actually panics on.
// ---------------------------------------------------------------------

/** Stress band. STRESS_PANIC_THRESHOLD (70) is where the engine takes over. */
export function stressBand(n: number): string {
  if (n >= STRESS_PANIC_THRESHOLD) return "near the line";
  if (n >= 50) return "strained";
  if (n >= 30) return "carrying it";
  return "settled";
}

/** Morale band. MORALE_PANIC_THRESHOLD (25) is the engine's own low-morale line. */
export function moraleBand(n: number): string {
  if (n >= 70) return "high";
  if (n >= 40) return "steady";
  if (n > MORALE_PANIC_THRESHOLD) return "low";
  return "flagging";
}

/**
 * The archive's word for a relationship stage. Same thresholds
 * deriveRelationshipStage uses, so the archive can never disagree with the
 * Hub about whether two people are together.
 */
export function relationshipWord(favorability: number): string {
  if (favorability >= RELATIONSHIP_COMMITTED_FAVORABILITY) return "committed";
  if (favorability >= RELATIONSHIP_DATING_FAVORABILITY) return "dating";
  return "flirting";
}

/** How the archive refers to the player. Never "you" (decided 7 Sep, Q6). */
export function playerTitle(fac: ArchiveFacility): string {
  return fac === "warden" ? "the Commander" : "the Colonel";
}
