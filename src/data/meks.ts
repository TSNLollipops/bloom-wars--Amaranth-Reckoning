// src/data/meks.ts
// Team One pilots + meks, transcribed from Data Pack §4.2 with the Canon
// Pass v1 §A correction applied: Fracrals Thyns is Hiopi/centauroid, not
// human/bipedal (Data Pack shipped the neutral-default placeholder before
// the Qiraki source files were cross-checked). All five confirmed against
// Qiraki_Military_Era_Outline_v3.md Part B, Qiraki_Session_Locks_Addendum.md,
// and Qiraki_Character_Sheets_v5.md.
import type { PilotRecord, MekArchetype } from "./types";

export const PILOTS: PilotRecord[] = [
  {
    id: "pilot_thyns",
    gender: "male",
    displayName: "Fracrals Thyns",
    archetypeId: "arch_tank_centauroid", // Canon Pass §A.2
    mekId: "mek_thyns",
    tier: "G",
  },
  {
    id: "pilot_barasj",
    gender: "male",
    displayName: "Derek Barasj",
    archetypeId: "arch_munti_bipedal",
    mekId: "mek_barasj",
    tier: "G",
  },
  {
    id: "pilot_nagori",
    gender: "male",
    displayName: "Hiro Nagori",
    archetypeId: "arch_meeps_bipedal",
    mekId: "mek_nagori",
    tier: "G",
  },
  {
    id: "pilot_tourignie",
    gender: "female",
    displayName: "Yren Tourignie",
    archetypeId: "arch_reeps_bipedal",
    mekId: "mek_tourignie",
    tier: "G",
  },
  {
    id: "pilot_voss",
    gender: "male",
    displayName: "Marcus Voss",
    archetypeId: "arch_meeps_bipedal",
    mekId: "mek_voss",
    tier: "G",
  },
];

export const MEKS: Record<string, MekArchetype> = {
  mek_thyns: {
    id: "mek_thyns",
    displayName: "Thyns' Mek",
    primary: "armorer",
    secondary: null,
    spareParts: 0,
  },
  mek_barasj: {
    id: "mek_barasj",
    displayName: "Barasj' Mek",
    primary: "fieldwright",
    secondary: null,
    spareParts: 0,
  },
  mek_nagori: {
    id: "mek_nagori",
    displayName: "Nagori's Mek",
    primary: "runemaster",
    secondary: null,
    spareParts: 0,
  },
  mek_tourignie: {
    id: "mek_tourignie",
    displayName: "Tourignie's Mek",
    primary: "runemaster",
    secondary: "quartermaster",
    spareParts: 0,
  },
  mek_voss: {
    id: "mek_voss",
    displayName: "Voss' Mek",
    primary: "fabricator",
    secondary: "armorer",
    spareParts: 2,
  },
};

// Roster depth for Act 1's back half (Canon Pass §H). Not wired into any
// of the four slice missions' playerPilotIds — kept here so the campaign
// layer can grow into it without another data-entry pass.
export const ROSTER_DEPTH_PILOTS: PilotRecord[] = [
  { id: "pilot_solvig", displayName: "Bram Solvig", gender: "male", archetypeId: "arch_munti_vibrissal", mekId: "mek_solvig", tier: "G" },
  { id: "pilot_green", displayName: "Frida Green", gender: "female", archetypeId: "arch_munti_bipedal", mekId: "mek_green", tier: "G" },
  { id: "pilot_hyrs", displayName: "Trahsin Hyrs", gender: "female", archetypeId: "arch_tank_centauroid", mekId: "mek_hyrs", tier: "G" },
  { id: "pilot_dufours", displayName: "Elodie Dufours", gender: "female", archetypeId: "arch_reeps_bipedal", mekId: "mek_dufours", tier: "G" },
  { id: "pilot_castell", displayName: "Naomi Castell", gender: "female", archetypeId: "arch_reeps_bipedal", mekId: "mek_castell", tier: "G" },
  { id: "pilot_arnesen", displayName: "Suki Arnesen", gender: "female", archetypeId: "arch_reeps_bipedal", mekId: "mek_arnesen", tier: "G" },
];

export const ROSTER_DEPTH_MEKS: Record<string, MekArchetype> = {
  mek_solvig: { id: "mek_solvig", displayName: "Solvig's Mek", primary: "fieldwright", secondary: "quartermaster", spareParts: 0 },
  mek_green: { id: "mek_green", displayName: "Green's Mek", primary: "fabricator", secondary: "armorer", spareParts: 2 },
  mek_hyrs: { id: "mek_hyrs", displayName: "Hyrs' Mek", primary: "armorer", secondary: "fieldwright", spareParts: 0 },
  mek_dufours: { id: "mek_dufours", displayName: "Dufours' Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_castell: { id: "mek_castell", displayName: "Castell's Mek", primary: "runemaster", secondary: "fieldwright", spareParts: 0 },
  mek_arnesen: { id: "mek_arnesen", displayName: "Arnesen's Mek", primary: "armorer", secondary: null, spareParts: 0 },
};

// Data Pack §5 — track effects, applied to the paired pilot only.
//
// Status of each field, 6 Sep 2026 (second Frame Systems pass), verified
// against live code rather than the docs — because until that evening three
// of these were DEAD DATA the docs described as shipped:
//   - armorer.*                   read by engine/units.ts's mekStatBonus (always was)
//   - runemaster.vision           same
//   - runemaster.effectPotency    read by engine/turnManager.ts (on-hit potency)
//   - runemaster.initiative       read by engine/combat.ts (tie-breaks)
//   - runemaster.burrowDetection  WIRED 6 Sep 2026 — engine/units.ts bakes it
//                                 onto BattleUnit.detectsBurrowedRadius; was
//                                 unread since the field was added.
//   - fieldwright.stationaryHeal  WIRED 6 Sep 2026 — engine/units.ts bakes it
//                                 onto BattleUnit.stationaryHeal, engine/
//                                 mission.ts's tickStationaryRepair applies it;
//                                 was unread since the field was added.
//   - fieldwright.muntiHealOutputMult  read by engine/mission.ts's repairHealAmount (always was)
//   - fabricator.spareParts       the CAP, read by engine/campaignEconomy.ts's
//                                 fabricatorMaxSpareParts; the parts themselves
//                                 were purchasable and consumed by NOTHING until
//                                 6 Sep 2026. Now consumed by Beacon Control.
//   - quartermaster.shopDiscount  read by engine/campaignEconomy.ts (always was)
export const MEK_TRACK_EFFECTS = {
  fabricator: {
    // MEANING CHANGED 6 Sep 2026, Maxime's call ("its the beacon job to give
    // in battle restock"): NOT the GDD §6.2 mid-mission self-redeploy, which
    // was never built and now never will be. A spare part is the paired
    // pilot's own Beacon crate — when Beacon Control (engine/mission.ts's
    // useBeaconControl) revives THIS mek's pilot, it burns one of these
    // instead of a Restock Room crate. Placement and charge rules unchanged.
    // Consumption reaches the campaign copy at Debrief via
    // engine/campaignEconomy.ts's applySparePartsConsumption. GDD §6.2 and
    // Data Pack §5's Fabricator rows need rewriting to say this — flagged.
    primary: { spareParts: 2 },
    secondary: { spareParts: 1 },
  },
  armorer: {
    primary: { attack: 8, defense: 8, hp: 10 },
    secondary: { attack: 4, defense: 4, hp: 5 },
  },
  runemaster: {
    primary: { vision: 2, initiative: 1, effectPotency: 1.5, burrowDetection: true },
    secondary: { vision: 1, initiative: 0, effectPotency: 1.25, burrowDetection: false },
  },
  fieldwright: {
    primary: { stationaryHeal: 15, muntiHealOutputMult: 1.25 },
    secondary: { stationaryHeal: 8, muntiHealOutputMult: 1 },
  },
  quartermaster: {
    // Secondary only — Data Pack §5 table: "Not available as a primary."
    secondary: { shopDiscount: 0.25 },
  },
} as const;
