/**
 * Attack range in player language (WePlaytestGames playtest, 30 Sep 2026).
 *
 * The tester read "range 1-1" on the first Crawlmass he hovered and spent
 * most of Mission 1 asking what it meant; he only worked out "1-1 = melee"
 * near the end. The engine stores range as [min, max] tiles, which is the
 * right data, but "1-1" is notation, not information. Pure (no Phaser) so
 * it can be unit-tested and shared by Battle.ts's hover card, the
 * out-of-range SYS line, and anything else that prints a range.
 */
export function rangeLabel(range: readonly [number, number]): string {
  const [minR, maxR] = range;
  if (maxR <= 0) return "can't attack";
  if (minR <= 1 && maxR <= 1) return "range 1 (adjacent only)";
  if (minR <= 1) return `range 1-${maxR} tiles`;
  const span = minR === maxR ? `range ${minR}` : `range ${minR}-${maxR}`;
  if (minR === 2) return `${span} (can't hit adjacent)`;
  return `${span} (needs ${minR}+ tiles away)`;
}

/** Same label, sentence-start capital ("Range 1 (adjacent only)"). */
export function rangeLabelCap(range: readonly [number, number]): string {
  const s = rangeLabel(range);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
