// src/data/names.ts — every name the game mints on its own, in one place.
//
// 9 Sep 2026, Maxime: "we should also make a name generator for the
// character generator." Until today the recruit pools lived inline in
// engine/campaignState.ts beside generatePilot, and their own comment
// already said where they belonged: "Ultimately this belongs to the
// character creator/editor... these pools are the interim, and are
// deliberately plain lists so that editor can replace them without
// touching any logic." This file is that move. The Character Editor
// (pilot_creator.html, still a disconnected prototype) imports from here
// when it is rebuilt, instead of growing a second copy of the lists.
//
// Two kinds of name, deliberately different in shape
// (Bloom_Wars_Mek_NPC_Introduction_Plan_v1.md §10, decided 8 Sep 2026):
//   - A PILOT joins as "Cpl. Vera Okonkwo" — rank, given name, surname —
//     and earns a callsign later (awardCallsign). They are in a command
//     structure and their name says so.
//   - A MEK has a single given name and nothing else — the way the book
//     series names its own Meks. No rank, no surname, no callsign. A Mek
//     is chosen family, not a roster line, and the register is meant to
//     read differently on sight.
//     Before this file a generated recruit's Mek had no name at all —
//     generatePilot wrote "<Surname>'s Mek", the same possessive label
//     the hand-authored Meks still carry until their own names are picked.
//
// Collision discipline — enforced by data/__tests__/names.test.ts, not by
// hope: no name in any pool below may match a given name, surname, or
// callsign of any hand-authored pilot on either campaign, any archived
// Team One/Two pilot, either CO, or any character in the book series'
// named cast (tools/qiraki_named_cast.json); the three pools are disjoint
// from each other; and no first-name/surname pair in the pilot pools can
// assemble into a book character's full name. Three surnames and two
// first names left the 5 Sep pools for exactly those reasons — two of the
// surnames are authored House Amaranth pilots (Kessler, Osei), both first
// names are too (Sgt. Petra Vondra, Pvt. Emeka Thorne), and the third
// surname paired with one of those first names spelled a book character
// outright. "Marrow" left the callsign pool for the same reason: it is
// the House's own Colonel. A fourth surname (Ekwueme) left 9 Sep 2026,
// same reason: the book's own current character sheets (Maxime's upload)
// promoted a background character to a full sheet whose surname matched
// this pool's own token exactly — see that character's reserved entry in
// tools/qiraki_named_cast.json for the citation (the full name isn't
// repeated here on purpose, so this comment doesn't trip its own
// collision lint). Replacements keep every pool the same size.
//
// This file imports one type and nothing else — src/data stays pure,
// hand-editable data. (It imported literally nothing until 13 Sep 2026,
// when the gendered name split below needed the Gender union. That is a
// type-only import from a sibling data module, erased at compile time,
// and it does not touch the rule that actually matters here: src/data/**
// must never import from src/engine/**.)
import type { Gender } from "./types";

/** Pick one element at random. `rng` is injectable so a test can be deterministic. */
export function randomFrom<T>(list: readonly T[], rng: () => number = Math.random): T {
  return list[Math.floor(rng() * list.length)];
}

// ---------------------------------------------------------------------
// Pilots (synkers). Moved verbatim from engine/campaignState.ts, 5 Sep
// 2026's pools, except for the collision fixes noted in the header.
// ---------------------------------------------------------------------

/** The rank a fresh recruit carries. Deliberately junior — they are new, and the authored cast's ranks are earned. */
export const RECRUIT_RANKS = ["Pvt.", "Spec.", "Cpl."] as const;

// Split by gender 13 Sep 2026 (Maxime: "The gender is chosen before name.
// So it match"), so the character creator can reroll a name that agrees
// with the gender the player just picked.
//
// Worth being exact about what this split did and did not do: it is a
// PARTITION of the same 24 names that were already here, not a rewrite.
// Nothing was added, nothing was removed, nothing was renamed. That was
// deliberate — every name in this file has already been cleared against
// the hand-authored cast on both campaigns, the archived Team One/Two
// roster, both COs, and the book series' own named cast
// (tools/qiraki_named_cast.json), and adding even one new name would have
// meant re-opening that whole check for no reason tonight's task asked
// for. The cost is that each pool is now roughly half the size it was, so
// a long campaign repeats a first name sooner than it used to. Flagged
// rather than fixed: expanding either pool is a real content pass with a
// real collision check attached, and Maxime's own eyes on the new names.
//
// One judgment call inside the partition, called out rather than buried:
// "Noor" is genuinely used for men and women both, and it went to the
// female pool. Moving it is a one-line edit if he'd rather.
export const RECRUIT_FIRST_NAMES_MALE: readonly string[] = [
  "Idris", "Cassian", "Tobias", "Alaric", "Zaine", "Kwame",
  "Renzo", "Dmitri", "Osman", "Bastien", "Marek",
];

export const RECRUIT_FIRST_NAMES_FEMALE: readonly string[] = [
  "Vera", "Noor", "Mira", "Saoirse", "Selin", "Runa", "Ngozi",
  "Ilse", "Ayla", "Neve", "Thea", "Junia", "Sena",
];

/**
 * Both pools as one list. Kept because the collision discipline this
 * file's header describes is about the SET of names the game can mint,
 * not about which pool a name sits in — data/__tests__/names.test.ts
 * checks this union, so a name can never be smuggled past that check by
 * living in only one of the two pools.
 */
export const RECRUIT_FIRST_NAMES: readonly string[] = [...RECRUIT_FIRST_NAMES_MALE, ...RECRUIT_FIRST_NAMES_FEMALE];

/** The first-name pool that matches a gender. The one mapping — never index the two pools by hand at a call site. */
export function firstNamePoolFor(gender: Gender): readonly string[] {
  return gender === "male" ? RECRUIT_FIRST_NAMES_MALE : RECRUIT_FIRST_NAMES_FEMALE;
}

/**
 * How often a generated recruit rolls male. Not 0.5, and the reason is
 * canon rather than taste: data/archive.ts's own `sp_osnian` entry states
 * outright that "males are overrepresented in the Coalition's front-line
 * service by a wide margin." A flat coin-flip would have quietly
 * contradicted a line the player can go and read in the Archive.
 *
 * 0.65 is a judgment call inside the space that line allows — enough of a
 * skew to be visible across a twenty-pilot roster, not so much that a
 * player stops seeing women in their own lance. It is one number, in one
 * place, on purpose: change this line and every recruit path follows.
 */
export const RECRUIT_MALE_WEIGHT = 0.65;

/** One weighted roll for a generated recruit's gender. See RECRUIT_MALE_WEIGHT for why it isn't a coin flip. */
export function randomGender(rng: () => number = Math.random): Gender {
  return rng() < RECRUIT_MALE_WEIGHT ? "male" : "female";
}

export const RECRUIT_SURNAMES: readonly string[] = [
  "Okonkwo", "Valdis", "Brennan", "Nakamura", "Oyelaran", "Ferrow", "Halden", "Sarkis",
  "Mbeki", "Cortez", "Ashgrove", "Vantry", "Delacroix", "Okorie", "Lindahl", "Rahal",
  "Petrov", "Quilliam", "Adeyemi", "Sandoval", "Novak", "Fairweather", "Duarte", "Marchetti",
];

/**
 * Earned callsigns, in the order they are handed out. Cycled by
 * generateCallsign with a generation number once it wraps, so a small pool
 * never repeats itself exactly.
 */
export const RECRUIT_CALLSIGNS: readonly string[] = [
  "Sprocket", "Halfmoon", "Thistle", "Coldsnap", "Tinder", "Windup", "Juniper", "Rattler", "Fenwick", "Hollow",
];

/**
 * A recruit's plain rank-and-name identity, with no callsign — that gets
 * earned. Takes the gender FIRST, both in the parameter list and in the
 * order the caller is expected to decide things, because that is the
 * actual sequencing Maxime asked for: the gender is picked, then a name
 * that matches it is drawn. Surnames are not gendered and draw from the
 * one shared pool.
 *
 * Still exactly three rng draws, in the same order as before the split
 * (rank, first name, surname), so a seeded caller's sequence is unchanged.
 */
export function generateRecruitName(gender: Gender, rng: () => number = Math.random): string {
  return `${randomFrom(RECRUIT_RANKS, rng)} ${randomFrom(firstNamePoolFor(gender), rng)} ${randomFrom(RECRUIT_SURNAMES, rng)}`;
}

/**
 * The nth callsign ever awarded on a save. Cycles the pool, appending a
 * generation number once it wraps ("Sprocket", ... "Hollow", "Sprocket 2",
 * ...) so every earned callsign stays unique without an ever-growing list.
 * Deterministic in n on purpose — the caller passes its own counter.
 */
export function generateCallsign(n: number): string {
  const base = RECRUIT_CALLSIGNS[(n - 1) % RECRUIT_CALLSIGNS.length];
  const cycle = Math.floor((n - 1) / RECRUIT_CALLSIGNS.length);
  return cycle === 0 ? base : `${base} ${cycle + 1}`;
}

// ---------------------------------------------------------------------
// Meks. Single given names, plain and cross-cultural on purpose: a Mek's
// name is not meant to signal a home sector the way a pilot's surname can
// (their dossier's intake line does that job). Nothing here is one of the
// thirty hand-authored Meks' own names — those are Maxime's pick, still
// open as of this file, and will land in the campaign data files, not
// here. This pool is only ever drawn from for a Mek nobody wrote by hand.
// ---------------------------------------------------------------------

export const MEK_GIVEN_NAMES: readonly string[] = [
  "Amos", "Cleo", "Dagny", "Dov", "Efi", "Elke", "Nuno", "Esme",
  "Freya", "Gus", "Hux", "Ida", "Iris", "Jens", "Kai", "Kasimir",
  "Lucan", "Lux", "Mattis", "Moss", "Nell", "Nico", "Noa", "Orla",
  "Otis", "Pell", "Silje", "Thom", "Tove", "Ulla", "Uma", "Vidar",
  "Wil", "Yara", "Zed", "Zora", "Aki", "Cyd", "Edie", "Fife",
  "Gerd", "Huw", "Inka", "Kell", "Lars", "Malo", "Nia", "Poe",
];

/**
 * A given name for a Mek nobody hand-authored. Skips any name already in
 * use on this save (`taken` — normally every displayName in
 * CampaignState.meks, so two Meks aboard never share a name), and only
 * falls back to the full pool if every name is spoken for, which a
 * forty-eight-name pool against a twenty-pilot roster ceiling should
 * never reach. Case-insensitive so "hale" and "Hale" count as the same.
 */
export function generateMekName(taken: Iterable<string> = [], rng: () => number = Math.random): string {
  const used = new Set<string>();
  for (const t of taken) used.add(t.trim().toLowerCase());
  const free = MEK_GIVEN_NAMES.filter((n) => !used.has(n.toLowerCase()));
  return randomFrom(free.length > 0 ? free : MEK_GIVEN_NAMES, rng);
}
