/**
 * What a Mek specialty actually does, in one line (WePlaytestGames playtest,
 * 30 Sep 2026: "Primary rune master, armor, rune master and field — not sure
 * what this means"). Numbers and effects match data/meks.ts's
 * MEK_TRACK_EFFECTS primary rows; the Pad shows these on hover.
 */
import type { MekTrack } from "./types";

export const MEK_TRACK_PRIMER: Record<MekTrack, string> = {
  armorer: "Armorer: +8 attack, +8 defence, +10 HP.",
  runemaster: "Runemaster: +2 sight, its counter-attack lands before the enemy hit, stronger acid/knockback/stun, spots burrowed Bloom nearby.",
  fieldwright: "Fieldwright: the mech repairs itself when it stays put, and a Munti's Repair heals 25% more.",
  fabricator: "Fabricator: carries spare parts. A spare part revives this pilot through Beacon Control without spending a crate.",
  quartermaster: "Quartermaster: 25% off the Campaign Shop.",
};

export function mekPrimerLines(mekName: string | undefined, primary: MekTrack, secondary?: MekTrack): string[] {
  const out = [`${mekName ?? "This pilot's Mek"} is the mechanic who keeps this pilot's mech running. Their specialty changes the mech:`, "", MEK_TRACK_PRIMER[primary]];
  if (secondary) out.push(secondary === "quartermaster" ? `Secondary: ${MEK_TRACK_PRIMER[secondary]}` : `Secondary (weaker version): ${MEK_TRACK_PRIMER[secondary]}`);
  return out;
}
