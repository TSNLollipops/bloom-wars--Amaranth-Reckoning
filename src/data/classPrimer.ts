/**
 * One-line class explanations, shown on the battle hover card and by the
 * first-time tips (WePlaytestGames playtest, 30 Sep 2026: "not sure exactly
 * what kind of units these are"; "What can a Munti do actually — how does it
 * work?"). Every number here is the one the Codex (scenes/Codex.ts) already
 * states: Meeps dodge 40%, Reeps range 2-4, Repair 30 HP adjacent, Munti
 * regen 8 HP/turn within 2 tiles. Triangle direction matches Codex's damage
 * table: Meeps > Reeps > Tank > Meeps.
 */
export type PathId = "meeps" | "tank" | "reeps" | "munti";

export const CLASS_PRIMER: Record<PathId, string> = {
  meeps: "Meeps (triangle): melee brawler, dodges 40% of hits. Strong vs Reeps.",
  tank: "Tank (square): melee, high HP, shields allies next to it. Strong vs Meeps.",
  reeps: "Reeps (diamond): ranged, 2-4 tiles, never counter-attacked. Strong vs Tank.",
  munti: "Munti (circle + bar): support. Repair heals an ally next to it for 30 HP (1 action). Also heals allies within 2 tiles 8 HP a turn, for free.",
};

export function classPrimer(path: string | undefined): string | undefined {
  return path && path in CLASS_PRIMER ? CLASS_PRIMER[path as PathId] : undefined;
}

/** The action-economy line for one of your units' hover card. */
export function actionsLine(actionsRemaining: number, max: number): string {
  if (actionsRemaining <= 0) return "Done for this turn.";
  return `Actions: ${actionsRemaining} of ${max} left. Move and Repair cost 1, Attack ends the turn.`;
}
