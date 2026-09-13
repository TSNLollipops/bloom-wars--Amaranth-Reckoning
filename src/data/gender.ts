// src/data/gender.ts — a pilot's gender, and the pronouns that read off it.
//
// New, 13 Sep 2026. Maxime, asked how Verinis's grief callout should
// resolve the "she/he" in his own written line ("I'm going to miss
// \"...\"'s snark when she/he got angry"): "Assign gender based on name and
// species. As for other created npc. We gotta add gender to the character
// creator The gender is chosen before name. So it match."
//
// That answer is bigger than the one line that prompted it, and it was
// flagged as scope growth before anything got built (ground rule #2 in
// claude_Bloom_Wars_Placeholder_Session_TODO.md). His call, in a second
// popup: build the whole system in one pass. His three design answers,
// also from that popup, are what this file and its callers implement:
//   - Male / Female only. No third value. If that ever changes, this file
//     is the one place the union widens, and every switch below goes red
//     until it's handled, which is the point of keeping them exhaustive.
//   - The character creator picks gender BEFORE the name, so a rerolled
//     name matches (data/names.ts's split pools, and the GENDER row above
//     the NAME row in scenes/shop/CharacterCreatorOverlay.ts).
//   - The 36 hand-authored pilots get gender assigned by hand, from their
//     own written names and species, drafted for his veto rather than
//     guessed at silently. That list landed directly in the three roster
//     files (campaignAmaranth.ts, campaignHouseAmaranth.ts, meks.ts).
//
// This file imports nothing outside src/data — same purity rule as every
// other data module (src/data/** must never import from src/engine/**).

import type { Gender, PilotRecord } from "./types";

// Re-exported so a caller that only cares about gender can take both the
// type and its helpers from one import. The union itself is declared in
// types.ts beside Species, so this module can import types the same
// direction every other data module does.
export type { Gender };

export const ALL_GENDERS: readonly Gender[] = ["male", "female"];

/** What a player reads on the character creator's own GENDER row. */
export const GENDER_LABELS: Record<Gender, string> = {
  male: "MALE",
  female: "FEMALE",
};

// ---------------------------------------------------------------------
// Pronouns. Five forms, because English needs five and picking the wrong
// one reads as a bug even when the gender itself is right. Kept as plain
// functions rather than a lookup object at every call site so a caller
// can't accidentally index the wrong column ("her" is both the object and
// the possessive-determiner form, which is exactly the trap).
// ---------------------------------------------------------------------

/** "he" / "she" — the one doing the verb. "...when she got angry." */
export function subjectPronoun(gender: Gender): string {
  return gender === "male" ? "he" : "she";
}

/** "him" / "her" — the one the verb happens to. "I told her." */
export function objectPronoun(gender: Gender): string {
  return gender === "male" ? "him" : "her";
}

/** "his" / "her" — attached to a noun. "her Mek", "his lance." */
export function possessiveDeterminer(gender: Gender): string {
  return gender === "male" ? "his" : "her";
}

/** "his" / "hers" — standing alone. "That frame is hers." */
export function possessivePronoun(gender: Gender): string {
  return gender === "male" ? "his" : "hers";
}

/** "himself" / "herself". */
export function reflexivePronoun(gender: Gender): string {
  return gender === "male" ? "himself" : "herself";
}

// ---------------------------------------------------------------------
// Reading a gender off a pilot.
// ---------------------------------------------------------------------

/**
 * A stable male/female pick derived from a string, with no randomness in
 * it at all. FNV-1a, 32-bit, then low bit. Deterministic on purpose: the
 * same pilot id resolves to the same gender on every load, every session,
 * every machine, so a pilot who has no explicit gender never appears to
 * change one between two readings of the same save.
 *
 * This is a fallback, not a feature. See genderOf below for when it fires.
 */
function derivedGender(seed: string): Gender {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    // 32-bit FNV prime multiply, written out as shifts because a plain
    // `* 16777619` overflows past Number's exact-integer range and starts
    // losing low bits, which is the half of the value this function reads.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return (hash & 1) === 0 ? "female" : "male";
}

/**
 * The ONE read path for a pilot's gender. Never read `pilot.gender`
 * directly for display or logic — go through here, so the fallback below
 * is impossible to forget.
 *
 * `PilotRecord.gender` is optional, following this codebase's own standing
 * shape for every field added after saves already existed (see
 * `ownedWeaponBranches`, `builtBays`, `npcSocialStates` and their `?? []` /
 * `?? {}` reads): a save written before tonight simply has no gender on
 * its pilot records, and nothing needs a migration step to keep working.
 *
 * Every one of the 36 hand-authored pilots now carries an explicit gender,
 * and every newly generated recruit is minted with one, so in a campaign
 * started from today this fallback never fires. It exists for exactly one
 * case: a save file that predates this pass. There, a named character can
 * come back with the wrong pronoun on one Verinis line until that campaign
 * is restarted. That is a real, accepted cost rather than a hidden one —
 * the alternative was a save-migration pass nobody asked for, on a game
 * that has not shipped yet and whose only saves are Maxime's own dev runs.
 * If that turns out to be annoying in practice, the fix is a migration
 * that patches state.pilots from the authored rosters on load, and this
 * comment is the note saying so.
 */
export function genderOf(pilot: Pick<PilotRecord, "id" | "gender">): Gender {
  return pilot.gender ?? derivedGender(pilot.id);
}

/** Exported for the tests that pin the fallback's determinism. Not for game logic — use genderOf. */
export const _derivedGenderForTests = derivedGender;
