/**
 * The SYS line shown when you click a visible hostile your selected unit
 * can't hit (playtest 25 Sep 2026, fix E8). Pure: no Phaser, so it's
 * testable without a scene.
 */
export interface OutOfRangeAttacker {
  attackRange: [number, number];
  actionsRemaining: number;
}

export function outOfRangeLine(attacker: OutOfRangeAttacker, distance: number): string {
  const [minR, maxR] = attacker.attackRange;
  const range = minR === maxR ? `range ${minR}` : `range ${minR}-${maxR}`;
  if (distance < minR) return `Too close to fire (${range}, target is ${distance} away).`;
  if (distance > maxR) return `Out of range (${range}, target is ${distance} away).`;
  if (attacker.actionsRemaining <= 0) return "No actions left this turn.";
  return "Can't target that right now.";
}
