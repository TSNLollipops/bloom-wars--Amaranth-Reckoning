// Carrier Upgrade Modules — the Workshop's second layer, 2 Sep 2026.
// Maxime: "finish the workshop add all the module from weapon and dev."
//
// Source design: claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md §3's own
// seven-module table, plus the pool rule from
// claude/Bloom_Wars_Weapon_Branch_Point_System_v1.md: "PERSONAL pool =
// pilot identity/skill... COMPANY pool = squad logistics/equipment (spare
// parts, modules, recruits)." Every module here is company-pool, spent
// from CampaignState.points, same as a bay build.
//
// WHY ONLY FOUR OF SEVEN ARE BUYABLE
//
// The design names seven. Three of them can't honestly be sold yet, and
// charging company points for a module that does nothing is worse than not
// shipping it — so they're listed with a real reason instead (see
// LOCKED_MODULES below, which the Workshop panel shows greyed). The four
// here are the ones whose effect is genuinely wired to something the
// engine already does, each pointed at its own call site:
//
//   fabricationBay  -> engine/campaignEconomy.ts fabricatorMaxSpareParts
//   combatMedic     -> engine/campaignState.ts   generatePilot
//   vitalSigns      -> scenes/Battle.ts          drawHud
//   forwardBattery  -> engine/mission.ts         fireSupportRadius
//
// forwardBattery joined them 2 Sep 2026, once Maxime resolved the redesign
// its own source doc had asked for — see
// FORWARD_BATTERY_FIRE_SUPPORT_RADIUS below.
//
// Every cost below is a PLACEHOLDER. The source doc gives each module a
// qualitative price ("moderate, one-time" / "heavy") and no numbers, and
// none of this has been through combat_sim.py — which is the right call
// rather than a gap: that harness validates Bloom archetype stats and
// maps, not company-pool pricing, exactly like the Antfarm bay costs and
// the Weapon Branch numbers already shipped as reasoned placeholders. They
// are anchored to real, shipped prices so they're at least in scale with
// each other: DISCRETIONARY_RECRUIT_COST and BAY_BUILD_COST's own range
// are the two comparables.

export type CarrierModuleId = "fabricationBay" | "combatMedic" | "vitalSigns" | "forwardBattery";

export interface CarrierModuleDef {
  id: CarrierModuleId;
  /** Player-facing name, from the source doc's own table. */
  displayName: string;
  /** One line, plain words, describing what buying it actually does. */
  effect: string;
  cost: number;
}

/** Extra spare-part capacity a Fabricator mek gains from fabricationBay. */
export const FABRICATION_BAY_CAP_BONUS = 2;

/**
 * Fire Support blast radius once Forward Battery is installed, replacing
 * combatTables' own FIRE_SUPPORT_RADIUS of 1 (a 3x3 Chebyshev box) with a
 * 5x5 one.
 *
 * Maxime's call, 2 Sep 2026, picking option (b) from three offered. This
 * module was ORPHANED by its own source design:
 * Bloom_Wars_Weapons_Bay_And_Fabricator_Delivery_v1.md killed the original
 * spec ("reduce cooldown by 25%") outright, because Fire Support has no
 * cooldown to cut — it's a flat 2-charge-per-mission pool — and asked for
 * "a redesign conversation first, not just a costed follow-up." This is
 * that redesign, resolved.
 *
 * Radius over charges deliberately: charges are ALREADY the scarcity lever
 * on this ability (the baseline pool, plus the Weapons Bay's own gated
 * bonus charge), so adding more of them would only turn the same decision
 * up louder. Area changes what the ability is FOR — a 5x5 reshapes which
 * clusters are worth calling a strike on, and gives the player a second
 * axis to think about rather than a bigger number on the first one.
 */
export const FORWARD_BATTERY_FIRE_SUPPORT_RADIUS = 2;

export const CARRIER_MODULES: Record<CarrierModuleId, CarrierModuleDef> = {
  fabricationBay: {
    id: "fabricationBay",
    displayName: "Fabrication Bay Expansion",
    // Doc: "Raises every Fabricator mek's spare-part cap campaign-wide."
    // Priced highest of the three because it's the only one whose value
    // keeps compounding for the rest of the campaign rather than paying
    // out once.
    effect: `Every Fabricator mek carries +${FABRICATION_BAY_CAP_BONUS} more spare parts, campaign-wide.`,
    cost: 160,
  },
  combatMedic: {
    id: "combatMedic",
    displayName: "Combat Medic Cadre",
    // Doc: "Discretionary Munti recruits enter at F-tier instead of G."
    // Worth real points because the G->F upgrade has a real published
    // price (TIER_UPGRADE_COST) that this skips on every future Munti,
    // but it only pays off if you actually recruit more Munti.
    effect: "Discretionary Munti recruits arrive at F tier instead of G.",
    cost: 120,
  },
  forwardBattery: {
    id: "forwardBattery",
    displayName: "Forward Battery",
    // Priced highest of the four: it's the only module that changes what
    // happens on the battlefield rather than what you bring to it, and the
    // source doc always framed it as "heavy, gated behind Weapons Bay."
    // The Weapons Bay gate is enforced in purchaseCarrierModule rather
    // than here — this table is data, not rules.
    effect: `Fire Support blasts a ${FORWARD_BATTERY_FIRE_SUPPORT_RADIUS * 2 + 1}x${FORWARD_BATTERY_FIRE_SUPPORT_RADIUS * 2 + 1} area instead of 3x3. Requires the Weapons Bay.`,
    cost: 200,
  },
  vitalSigns: {
    id: "vitalSigns",
    displayName: "Vital Signs Uplink",
    // Doc: "HUD early-warning when a side's last living Munti drops below
    // an HP threshold." Cheapest of the three: it changes what you KNOW,
    // never what your units can do.
    effect: "Battle HUD warns you when your last living Munti drops low.",
    cost: 90,
  },
};

/** HP fraction at or below which the Vital Signs Uplink raises its warning. */
export const VITAL_SIGNS_WARN_FRACTION = 0.4;

/**
 * The four designed modules that are deliberately NOT for sale, and the
 * honest reason for each — shown in the Workshop panel so the room reads
 * as "four of these need something first" rather than hiding the design.
 *
 * Kept as data next to the real ones on purpose: when one of these gets
 * unblocked it moves up into CARRIER_MODULES rather than being remembered
 * from a doc.
 */
export const LOCKED_MODULES: readonly { displayName: string; reason: string }[] = [
  {
    displayName: "Runic Integration Line",
    // Its whole effect is gating whether a salvaged Heirloom can be
    // assigned. No Heirloom exists in code yet.
    reason: "Waiting on Heirlooms.",
  },
  {
    displayName: "Auxiliary Berths",
    // Doc: pulls deploy slots in early, at a permanent Providence DEF
    // penalty for the rest of the act. Both halves are real systems that
    // don't exist yet — the deploy-slot schedule is author-controlled and
    // Providence has no modelled defence stat.
    reason: "Needs the deploy-slot schedule and a Providence stat first.",
  },
  {
    displayName: "Reserve Muster",
    // Doc: a discretionary recruit arrives immediately instead of at the
    // next debrief. recruitDiscretionary already returns its pilot
    // immediately, so as written this module would buy nothing.
    reason: "Recruits already arrive immediately — nothing to buy yet.",
  },
];
