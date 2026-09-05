// Heirloom house-name convention (3 Sep 2026).
//
// Every HeirloomDef.pilot.house value in data/heirlooms.ts spells the word
// itself — "House Dunmoor", not "Dunmoor". Two renderers in Hub.ts wrote
// `House ${...house}` on top of that and shipped "House House Dunmoor" on
// the Heirloom shortlist and "House House Voss" in the returned-home
// verdict line. Both were plainly visible on screen and nobody had read
// them; they surfaced in an automated UI sweep's own report text.
//
// The convention is pinned HERE, at the data end, rather than by asserting
// something about Hub.ts's source: the rule that matters is "the value is
// already a full house name," and any renderer that respects it is correct
// no matter how it is written.
import { describe, it, expect } from "vitest";
import { HEIRLOOMS } from "../heirlooms";

describe("Heirloom house names", () => {
  it("every house value is a complete name, already carrying the word House", () => {
    for (const def of Object.values(HEIRLOOMS)) {
      if (!def.pilot) continue; // aberrations have no aristocrat pilot
      expect(def.pilot.house, `${def.id}'s house`).toMatch(/^House \S/);
    }
  });

  it("no house value doubles the word — the bug this file exists for", () => {
    for (const def of Object.values(HEIRLOOMS)) {
      if (!def.pilot) continue;
      expect(def.pilot.house, `${def.id}'s house`).not.toMatch(/^House House/);
    }
  });
});
