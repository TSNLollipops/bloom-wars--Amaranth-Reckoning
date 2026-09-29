/**
 * Short label for a Mission Select campaign tab (playtest 25 Sep 2026, fix
 * E5). The full names ("The Amaranth Reckoning — Act I: The Fallow Line")
 * overflowed the 40px-tall tab boxes once wrapped. The tab only needs the
 * part after the dash; the full name stays in the tab's hover tip.
 */
export function campaignTabLabel(fullName: string): string {
  const i = fullName.lastIndexOf(" — ");
  return i === -1 ? fullName : fullName.slice(i + 3);
}
