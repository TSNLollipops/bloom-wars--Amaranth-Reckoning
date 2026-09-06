// src/engine/portraits.ts
// B4 (portrait wiring), 5 Sep 2026 — the pure lookup half of the game's
// first-ever image pipeline. Kept Phaser-free per this file's own folder
// convention (src/engine/ imports data, never Phaser) so it's trivially
// unit-testable and so the cache-key/pool-assignment logic isn't tangled
// up with any particular scene's rendering code.
//
// Two portrait sources exist, and this module is the ONLY place that
// knows how a pilot id maps to either of them:
//
//  1. The 15 named Warden Company pilots (G-tier, `pilot_<surname>`) each
//     have a hand-picked, hand-cropped portrait — see
//     assets/portraits/<surname>_portrait.png (originals) and
//     public/portraits/<surname>_portrait.png (the shipped 192x192 crop).
//  2. Every OTHER pilot in the game — the ten authored 2nd/3rd Lance
//     pilots, Team One's own roster, and every procedurally generated
//     recruit (`pilot_recruit_<n>`, engine/campaignState.ts's
//     generatePilot()) — has no individual art and never will; there's no
//     way to hand-author a portrait for a pilot that doesn't exist until
//     a save generates one. These draw from a 12-portrait generic pool
//     (public/portraits/recruit_generic_01.png..12.png) via a stable
//     `n`-based assignment, so the SAME recruit always gets the SAME
//     generic face for the life of a campaign (n is that pilot's own
//     nextGeneratedId at creation — never reassigned). Named pilots
//     outside the 15 (Team One, unrecruited 2nd/3rd Lance) fall through
//     to null — see the module doc below on why that's not "every pilot
//     ever added must get one of these pools."
//
// A pilot this module returns null for (Team One's own roster, an
// authored-but-not-yet-recruited 2nd/3rd Lance pilot before they're ever
// assigned a recruit-style id) is not a bug or a gap to fill — it's the
// existing coloured-circle-with-initials placeholder's job, unchanged.
// The gap report's own B4 write-up recommended keeping that placeholder
// as the fallback rather than inventing a new one, precisely because a
// pilot with no art is a first-class, permanent case here (generated
// recruits), not a temporary hole waiting to be patched.

const NAMED_PORTRAIT_SURNAMES = [
  "rourke",
  "bosk",
  "iyari",
  "anand",
  "lask",
  "okafor",
  "solheim",
  "tarrant",
  "vashti",
  "reyes",
  "kova",
  "ness",
  "onwuka",
  "delgado",
  "yeun",
] as const;

// Must match the count of public/portraits/recruit_generic_NN.png files
// on disk exactly — see the B4 build log for how these were generated
// (Gemini, matched to the named portraits' own art style).
const GENERIC_RECRUIT_POOL_SIZE = 12;

export interface PortraitAsset {
  /** Phaser texture-cache key — what this.load.image() and this.add.image() both use. */
  key: string;
  /** Root-relative path under public/, e.g. "portraits/rourke_portrait.png". */
  path: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function namedPortrait(surname: string): PortraitAsset {
  return { key: `portrait_${surname}`, path: `portraits/${surname}_portrait.png` };
}

function genericPortrait(poolIndex1Based: number): PortraitAsset {
  const idx = pad2(poolIndex1Based);
  return { key: `portrait_recruit_generic_${idx}`, path: `portraits/recruit_generic_${idx}.png` };
}

/**
 * Resolves a pilot id to the portrait Phaser should draw, or null if this
 * pilot has none — the signal for callers to fall back to the existing
 * coloured-circle-with-initials placeholder (TransporterPad.ts's
 * PATH_COLORS + pilotInitials).
 */
export function portraitAssetFor(pilotId: string): PortraitAsset | null {
  const namedSurname = NAMED_PORTRAIT_SURNAMES.find((s) => pilotId === `pilot_${s}`);
  if (namedSurname) return namedPortrait(namedSurname);

  // generatePilot() (engine/campaignState.ts) mints ids as
  // `pilot_recruit_${n}` where n = state.nextGeneratedId, incrementing
  // and never reused within a campaign — so n % POOL_SIZE is a stable,
  // deterministic pool assignment for that pilot's whole life (and after
  // permadeath, for however MemorialPanel.ts wants to show them lost).
  const recruitMatch = /^pilot_recruit_(\d+)$/.exec(pilotId);
  if (recruitMatch) {
    const n = Number(recruitMatch[1]);
    const idx = (((n - 1) % GENERIC_RECRUIT_POOL_SIZE) + GENERIC_RECRUIT_POOL_SIZE) % GENERIC_RECRUIT_POOL_SIZE;
    return genericPortrait(idx + 1);
  }

  return null;
}

/** Every portrait the Preloader needs to load, once, at boot. */
export function allPortraitAssets(): PortraitAsset[] {
  const named = NAMED_PORTRAIT_SURNAMES.map(namedPortrait);
  const generic = Array.from({ length: GENERIC_RECRUIT_POOL_SIZE }, (_, i) => genericPortrait(i + 1));
  return [...named, ...generic];
}

export const SPLASH_ASSETS: readonly PortraitAsset[] = [
  { key: "splash_intro_title", path: "splash/intro_title_screen.jpg" },
  { key: "splash_loading", path: "splash/loading_screen.jpg" },
  { key: "splash_victory", path: "splash/victory_screen.jpg" },
  { key: "splash_defeat", path: "splash/defeat_screen.jpg" },
];
