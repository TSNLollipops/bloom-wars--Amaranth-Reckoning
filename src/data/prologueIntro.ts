// src/data/prologueIntro.ts
// Universe Intro Plan v1, 17 Sep 2026 — beat content for the new pre-
// Mission-1 sequence (see claude/Bloom_Wars_Universe_Intro_Plan_v1_
// 17Sep2026.md for the design and claude/Bloom_Wars_Universe_Intro_
// Mockup_v1_17Sep2026.html for the approved pacing/shape). Warden Company
// only — House Amaranth's own intro stays deferred to its post-EA reveal,
// per Maxime's locked scope call that night.
//
// Narrator/record register, Maxime's own call (AskUserQuestion, 17 Sep
// 2026): this is Claude's copy to draft and his to edit, not the line-
// bank/CO-dialogue material that stays his alone. It follows the Qiraki
// Master Style Guide's craft-rule subset Foundation.md already borrows
// for Archive prose — zero em dashes, zero semicolons, no paragraph-
// ending morals or stated thesis, no symmetrical sentence construction,
// minimize "thing"/"stuff"/"true"/"plain" — extended here on Maxime's
// explicit ask ("make sure you use the master guide for writing").
//
// Sourcing, Claude's own judgment call, flagged per the project's
// attribution rule: beats 1, 2 and 4 are trimmed from archive.ts's own
// gate: null World Codex entries (world_coalition, world_reach,
// world_fallow, and the Providence personnel Brief) rather than invented
// fresh, since that's material already written, already in the shipped
// voice, and already clear of the craft rules above. Beat 4 deliberately
// does NOT draw on the Fleet Registry Extract (archive.ts's "WARDEN
// COMPANY" entry, id: fleet_warden-ish, gate: 36) — that entry's "owner
// lost to Bloom overgrowth, warrant vacant" reveal is a Mission-36 payoff,
// and dropping it into the opening crawl would spoil thirty-plus missions
// of pacing for a line of flavor text. Only the gate: null "corporate name
// nobody's bothered to change" detail (from world_coalition) made it in.
// Beat 3 has no existing entry to trim from — the Bloom has no gate: null
// "what is it" Brief anywhere in archive.ts, only gated bestiary field
// notes (Crawlmass at gate 1, the Choir at gate 8/10, the Wellroot at 21,
// the Unnamed at 35) — so it's written fresh here, deliberately vague
// about anything those later reveals would spoil.

export interface PrologueBeat {
  title: string;
  body: string[];
}

/**
 * Stands in for the campaign's own company name at render time — never
 * baked in at authoring time. CampaignSetup.ts's own company-name field
 * promises "whatever you call them is what the roster, the pad, and the
 * record will call them," and this screen is reached from that same
 * BEGIN CAMPAIGN click, right after the name is resolved. See
 * resolvePrologueBeats below for the substitution, and Prologue.ts's own
 * init() for the fallback used if this screen is ever reached with no
 * name at all (shouldn't happen from the real flow, but a scene that
 * trusts its caller for a required field is how "undefined" ends up on
 * screen — see this project's own save-failure-toast precedent).
 */
const COMPANY_TOKEN = "{{COMPANY}}";

export const PROLOGUE_BEATS_WARDEN: PrologueBeat[] = [
  {
    title: "THE COALITION",
    body: [
      "The Amaranth Reach is one frontier sector among more than {{COMPANY}} will ever see the edge of. Out past it, the war against the Bloom is fought by an alliance of worlds and species stretching further than any one unit's own maps show.",
      "Doctrine, wherever it actually comes from, is simple: you're given the objective, and you're trusted to reach it.",
    ],
  },
  {
    title: "THE AMARANTH REACH",
    body: [
      "A frontier cluster on the edge of core-administered space, held nominally by a sector governor-general who's never once had to actually worry about it. Its wealth and its name both come from the same source: House Amaranth, the founding charter dynasty, generations deep in the sector's richest agricultural terraces.",
      "{{COMPANY}} holds a stretch of it: the Fallow Line. Not a wall. A line of positions, trenches and listening posts and ground that has been fought over enough times to have names, strung along the edge where the Reach's fields stop and the Bloom's don't.",
    ],
  },
  {
    title: "THE BLOOM",
    body: [
      "Nobody agrees on where it started. What's not in question is what it does: it grows, through soil, through hulls, through anything that stops moving long enough.",
      "No command's ever been confirmed anywhere inside it. Every attempt to reach it and get an answer back has ended the same way: nothing back, and more ground gone by morning.",
    ],
  },
  {
    title: "{{COMPANY}}",
    body: [
      "{{COMPANY}}. A corporate name nobody's bothered to change, chartered private, holding a stretch of the Fallow Line.",
      "Providence is the company's carrier, and has been its rear since before anyone currently serving came aboard. It does not fight. It sits behind the Line and keeps the lances fed.",
    ],
  },
  {
    title: "LANCE A",
    body: [
      "Whatever's still called a war out here runs on people who show up anyway.",
      "Lance A is yours.",
    ],
  },
];

/**
 * Substitutes the resolved company name into every {{COMPANY}} token
 * (titles included — Prologue.ts renders every title through the same
 * .toUpperCase() TransporterPad's own header already uses for
 * companyNameOf(), so a beat title with no token in it is unaffected and
 * one that's just the token becomes the same all-caps company name that
 * screen shows). Pure string work, no Phaser and no engine/** import —
 * src/data/** never imports src/engine/**, so the caller (a scene, which
 * can) is responsible for resolving the real name first.
 */
export function resolvePrologueBeats(companyName: string): PrologueBeat[] {
  return PROLOGUE_BEATS_WARDEN.map((beat) => ({
    title: beat.title.split(COMPANY_TOKEN).join(companyName),
    body: beat.body.map((line) => line.split(COMPANY_TOKEN).join(companyName)),
  }));
}
