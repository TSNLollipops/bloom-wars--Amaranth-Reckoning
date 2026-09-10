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
// This file imports nothing — src/data stays pure, hand-editable data.

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

export const RECRUIT_FIRST_NAMES: readonly string[] = [
  "Vera", "Idris", "Noor", "Cassian", "Mira", "Tobias", "Saoirse", "Selin",
  "Runa", "Alaric", "Zaine", "Ngozi", "Kwame", "Ilse", "Renzo", "Ayla",
  "Dmitri", "Neve", "Osman", "Thea", "Bastien", "Junia", "Marek", "Sena",
];

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

/** A recruit's plain rank-and-name identity, with no callsign — that gets earned. */
export function generateRecruitName(rng: () => number = Math.random): string {
  return `${randomFrom(RECRUIT_RANKS, rng)} ${randomFrom(RECRUIT_FIRST_NAMES, rng)} ${randomFrom(RECRUIT_SURNAMES, rng)}`;
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
