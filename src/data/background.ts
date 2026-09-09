// src/data/background.ts
// The Catalyst Gauntlet — reviving
// Bloom_Wars_Catalyst_Gauntlet_v2_ThirdLance_Verinis_Recruits.md §5 ("go"
// given by Maxime 7 Sep 2026; actually built 9 Sep 2026, "go build stuff").
// Pure data + two pure functions, per this file's own house rule (Build
// Brief §5.2, enforced by eslint.config.js's "src/data may only import
// from ./types" restriction) — no engine, no scenes, no Phaser, nothing
// here reads or writes a CampaignState.
//
// Three tables, chained, exactly as Background_Zones_v1 §6 and
// NPC_Catalyst_Formula_Closing_And_Roster_Assignments_v1 §2 lock them:
//
//   Sector --(ZONE_BY_SECTOR)--> Zone
//   Academy x Texture --(PRESSURE_TABLE)--> Pressure
//   Zone x Pressure --(PLANET12_BY_ZONE_PRESSURE)--> a Planet-12 position
//   Planet-12 position --(CATALYST_BY_CELL)--> Catalyst
//
// Every value in every table below is copied verbatim from those two
// documents (Background Zones §2/§6, NPC Catalyst Formula §2, Catalyst
// Gauntlet v2 §2/§3) — nothing here is a fresh design decision EXCEPT
// rollBackground's own weighting, flagged as mine down at TEXTURE_WEIGHTS'
// own comment, since no doc ever pinned exact numbers for it
// (Catalyst_Gauntlet_v2 §5 item 2 only asks for "the sector's own academy
// favoured, Line-trained common on the Frontier, textures not
// flat-uniform" — a shape, not numbers).
import type { Academy, BirthplaceTexture, Planet, PilotBackground, Sector } from "./types";
import type { Catalyst } from "./ambientLines";

/** Core/Mid-Rim/Frontier — a sector's own zone tier, Background Zones §2. Kept internal: nothing outside this file's own derivation needs to name a Zone directly. */
type Zone = "Core" | "Mid-Rim" | "Frontier";

/** How early and how hard real stakes landed on a pilot before they reached a cockpit — Background Zones §6, a function of Academy x Birthplace Texture. */
type Pressure = "Sheltered" | "Tested" | "Forged";

/** The hidden Planet-12 diagram position, Background Zones §6 / NPC Catalyst Formula §2. Never shown to a player — kept internal to this module's own derivation, same discipline Character Editor v1 §2 already sets for the diagram this rides on top of. */
type Planet12 = "Earth" | "Uranus" | "Neptune" | "Saturn" | "Mars" | "Jupiter" | "Mercury" | "Venus" | "Spider";

/** Background Zones §2 / Catalyst Gauntlet v2 §2 (Amaranth Reach, added 7 Sep 2026). */
export const ZONE_BY_SECTOR: Record<Sector, Zone> = {
  "Cordage Belt": "Mid-Rim",
  "Long Marches": "Frontier",
  "Glasswater Reach": "Core",
  "The Understrand": "Mid-Rim",
  "Emberfall Drift": "Frontier",
  "Amaranth Reach": "Frontier",
};

/** The two planets per sector, in the order Background Zones §2 / Catalyst Gauntlet v2 §2 name them. */
export const SECTOR_PLANETS: Record<Sector, [Planet, Planet]> = {
  "Cordage Belt": ["Tallowmere", "Skeinreach"],
  "Long Marches": ["Harrow's Table", "Cutbank"],
  "Glasswater Reach": ["Glasswater", "Pale Cistern"],
  "The Understrand": ["Cistgate", "Loomvale"],
  "Emberfall Drift": ["Emberfall", "Greywatch"],
  "Amaranth Reach": ["Meridian", "Aerius"],
};

/**
 * The academy most naturally associated with a sector's own local pipeline
 * — used only to bias rollBackground toward "the sector's own academy
 * favoured" (Catalyst_Gauntlet_v2 §5 item 2). The Amaranth Reach
 * deliberately has none: it's the newest sector, and its two named
 * residents so far (Thorne, Amsel — Catalyst_Gauntlet_v2 §4.1) are both
 * Line-trained, not graduates of a Reach academy that doesn't exist yet.
 * A Reach-born recruit CAN still roll any of the five named academies
 * (Verinis himself, in the "cat" reading, is Aerius-born and Conservatory-
 * trained) — there's just no local favourite to lean the roll toward.
 */
export const SECTOR_LOCAL_ACADEMY: Partial<Record<Sector, Academy>> = {
  "Cordage Belt": "Tallowmere Fitting Yards",
  "Long Marches": "Cutbank Muster School",
  "Glasswater Reach": "Glasswater Conservatory of Arms",
  "The Understrand": "The Cistgate Ledgerworks",
  "Emberfall Drift": "The Greywatch Muster",
};

/**
 * Academy x Birthplace Texture -> Pressure, the full 48-cell table
 * Background Zones §6 defines but never writes down and Catalyst_Gauntlet_v2
 * §3 completes. Bold cells there are LOCKED (an existing named pilot or
 * Mek's catalyst already depends on them); plain cells are that document's
 * own proposal. Both kinds are load-bearing now — background.test.ts pins
 * every cell, not just the locked ones, per that document's own
 * instruction ("a generator needs all forty-eight").
 */
export const PRESSURE_TABLE: Record<Academy, Record<BirthplaceTexture, Pressure>> = {
  "Tallowmere Fitting Yards": {
    "Dockside": "Tested",
    "Terrace Farmstead": "Sheltered",
    "Arcology Stack": "Tested",
    "Garrison Quarter": "Forged",
    "Drift Colony": "Forged",
    "Company Housing": "Sheltered",
    "Preserve-Adjacent": "Tested",
    "Academy Ward": "Sheltered",
  },
  "Cutbank Muster School": {
    "Dockside": "Tested",
    "Terrace Farmstead": "Tested",
    "Arcology Stack": "Tested",
    "Garrison Quarter": "Forged",
    "Drift Colony": "Tested",
    "Company Housing": "Sheltered",
    "Preserve-Adjacent": "Forged",
    "Academy Ward": "Sheltered",
  },
  "Glasswater Conservatory of Arms": {
    "Dockside": "Tested",
    "Terrace Farmstead": "Forged",
    "Arcology Stack": "Tested",
    "Garrison Quarter": "Tested",
    "Drift Colony": "Tested",
    "Company Housing": "Sheltered",
    "Preserve-Adjacent": "Forged",
    "Academy Ward": "Forged",
  },
  "The Cistgate Ledgerworks": {
    "Dockside": "Tested",
    "Terrace Farmstead": "Forged",
    "Arcology Stack": "Tested",
    "Garrison Quarter": "Forged",
    "Drift Colony": "Forged",
    "Company Housing": "Sheltered",
    "Preserve-Adjacent": "Forged",
    "Academy Ward": "Sheltered",
  },
  "The Greywatch Muster": {
    "Dockside": "Tested",
    "Terrace Farmstead": "Tested",
    "Arcology Stack": "Tested",
    "Garrison Quarter": "Tested",
    "Drift Colony": "Tested",
    "Company Housing": "Sheltered",
    "Preserve-Adjacent": "Tested",
    "Academy Ward": "Sheltered",
  },
  "Line-trained": {
    "Dockside": "Tested",
    "Terrace Farmstead": "Tested",
    "Arcology Stack": "Tested",
    "Garrison Quarter": "Forged",
    "Drift Colony": "Tested",
    "Company Housing": "Tested",
    "Preserve-Adjacent": "Forged",
    "Academy Ward": "Sheltered",
  },
};

/** Zone x Pressure -> Planet-12 position, locked design intent — Background Zones §6, Maxime-approved 1 Sep 2026 ("the pressure thing look good to me. it fit the pilar way of explaining itself"). */
export const PLANET12_BY_ZONE_PRESSURE: Record<Zone, Record<Pressure, Planet12>> = {
  "Core": { "Sheltered": "Earth", "Tested": "Uranus", "Forged": "Neptune" },
  "Mid-Rim": { "Sheltered": "Saturn", "Tested": "Mars", "Forged": "Jupiter" },
  "Frontier": { "Sheltered": "Mercury", "Tested": "Venus", "Forged": "Spider" },
};

/** Planet-12 -> Catalyst, a bijection locked 1 Sep 2026 — NPC Catalyst Formula §2. Reassigning any single row would break every reverse-fit entry in npcSeed.ts's BACKGROUND_CATALYST_ASSIGNMENTS — don't. */
export const CATALYST_BY_CELL: Record<Planet12, Catalyst> = {
  "Earth": "dog",
  "Uranus": "raven",
  "Neptune": "rabbit",
  "Saturn": "wolf",
  "Mars": "shark",
  "Jupiter": "bear",
  "Mercury": "fox",
  "Venus": "crow",
  "Spider": "cat",
};

/** Runs a background through all three locked tables. Pure — the same background always derives the same catalyst, forever (no rng anywhere in this path). */
export function deriveCatalyst(background: PilotBackground): Catalyst {
  const zone = ZONE_BY_SECTOR[background.sector];
  const pressure = PRESSURE_TABLE[background.academy][background.texture];
  const planet = PLANET12_BY_ZONE_PRESSURE[zone][pressure];
  return CATALYST_BY_CELL[planet];
}

const ALL_SECTORS: Sector[] = ["Cordage Belt", "Long Marches", "Glasswater Reach", "The Understrand", "Emberfall Drift", "Amaranth Reach"];
const ALL_ACADEMIES: Academy[] = [
  "Tallowmere Fitting Yards",
  "Cutbank Muster School",
  "Glasswater Conservatory of Arms",
  "The Cistgate Ledgerworks",
  "The Greywatch Muster",
  "Line-trained",
];

/**
 * MY OWN CALL, not locked anywhere — Background Zones §7 and
 * Catalyst_Gauntlet_v2 §5 item 2 both ask for non-flat weighting ("the
 * sector's own academy favoured, Line-trained common on the Frontier,
 * textures not flat-uniform") but neither ever pins actual numbers, the
 * same gap Background Zones §10 names for the (still-unbuilt) pillar
 * weights. These weights are a defensible first pass, not a locked design
 * decision — worth a real tuning pass once there's enough generated-
 * recruit content to judge the texture/academy mix by eye, the same way
 * NPC_SEED's own catalyst picks are flagged "placeholder... worth a real
 * pass."
 *
 * Textures: Dockside/Terrace Farmstead/Arcology Stack read as the three
 * most "ordinary" upbringings across a whole population and get the
 * highest weight; Garrison Quarter and Company Housing are real but less
 * universal; Drift Colony (void-born), Preserve-Adjacent (Background Zones
 * §4's own "handled carefully" texture), and Academy Ward (a staff kid —
 * not many families work at one) are all genuinely uncommon and share the
 * lowest weight.
 */
const TEXTURE_WEIGHTS: [BirthplaceTexture, number][] = [
  ["Dockside", 3],
  ["Terrace Farmstead", 3],
  ["Arcology Stack", 3],
  ["Garrison Quarter", 2],
  ["Company Housing", 2],
  ["Drift Colony", 1],
  ["Preserve-Adjacent", 1],
  ["Academy Ward", 1],
];

function weightedPick<T>(rng: () => number, weights: readonly (readonly [T, number])[]): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of weights) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return weights[weights.length - 1][0]; // rounding-error fallback only
}

/**
 * A sector's local academy is favoured (weight 4 against every other real
 * academy's 1); Line-trained gets its own weight, high on a Frontier
 * sector and low elsewhere — both my own numbers, see TEXTURE_WEIGHTS'
 * comment above for the same caveat. A sector with no local academy of its
 * own (Amaranth Reach today) simply has nothing to favour: every named
 * academy sits at the same weight 1, so a Reach-born roll can still land
 * on any of them, just without a thumb on the scale.
 */
function rollAcademy(rng: () => number, sector: Sector): Academy {
  const zone = ZONE_BY_SECTOR[sector];
  const local = SECTOR_LOCAL_ACADEMY[sector];
  const weights: [Academy, number][] = [];
  for (const academy of ALL_ACADEMIES) {
    if (academy === "Line-trained") continue;
    weights.push([academy, academy === local ? 4 : 1]);
  }
  weights.push(["Line-trained", zone === "Frontier" ? 5 : 1]);
  return weightedPick(rng, weights);
}

export interface RollBackgroundOptions {
  /**
   * Exclude this sector from the roll. `generatePilot`
   * (engine/campaignState.ts) uses this to give a pilot's Mek "a second,
   * contrasting" background (Catalyst_Gauntlet_v2 §5 item 3: "a different
   * sector, at least") rather than risking the same one twice.
   */
  excludeSector?: Sector;
}

/**
 * Rolls a brand-new, internally-consistent background. `rng` defaults to
 * Math.random — same convention as this file's own sibling
 * data/npcBonds.ts (pointNear) — pass a seeded/mocked one for a
 * deterministic test.
 */
export function rollBackground(rng: () => number = Math.random, opts: RollBackgroundOptions = {}): PilotBackground {
  const sectorChoices = opts.excludeSector ? ALL_SECTORS.filter((s) => s !== opts.excludeSector) : ALL_SECTORS;
  const sector = sectorChoices[Math.floor(rng() * sectorChoices.length)];
  const [planetA, planetB] = SECTOR_PLANETS[sector];
  const planet = rng() < 0.5 ? planetA : planetB;
  const texture = weightedPick(rng, TEXTURE_WEIGHTS);
  const academy = rollAcademy(rng, sector);
  return { sector, planet, texture, academy };
}
