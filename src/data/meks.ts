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
    displayName: "Fracrals Thyns",
    archetypeId: "arch_tank_centauroid", // Canon Pass §A.2
    mekId: "mek_thyns",
    tier: "G",
  },
  {
    id: "pilot_barasj",
    displayName: "Derek Barasj",
    archetypeId: "arch_munti_bipedal",
    mekId: "mek_barasj",
    tier: "G",
  },
  {
    id: "pilot_nagori",
    displayName: "Hiro Nagori",
    archetypeId: "arch_meeps_bipedal",
    mekId: "mek_nagori",
    tier: "G",
  },
  {
    id: "pilot_tourignie",
    displayName: "Yren Tourignie",
    archetypeId: "arch_reeps_bipedal",
    mekId: "mek_tourignie",
    tier: "G",
  },
  {
    id: "pilot_trav",
    displayName: "Trav",
    archetypeId: "arch_meeps_bipedal",
    mekId: "mek_trav",
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
  mek_trav: {
    id: "mek_trav",
    displayName: "Trav's Mek",
    primary: "fabricator",
    secondary: "armorer",
    spareParts: 2,
  },
};

// Roster depth for Act 1's back half (Canon Pass §H). Not wired into any
// of the four slice missions' playerPilotIds — kept here so the campaign
// layer can grow into it without another data-entry pass.
export const ROSTER_DEPTH_PILOTS: PilotRecord[] = [
  { id: "pilot_solvig", displayName: "Bram Solvig", archetypeId: "arch_munti_vibrissal", mekId: "mek_solvig", tier: "G" },
  { id: "pilot_green", displayName: "Frida Green", archetypeId: "arch_munti_bipedal", mekId: "mek_green", tier: "G" },
  { id: "pilot_hyrs", displayName: "Trahsin Hyrs", archetypeId: "arch_tank_centauroid", mekId: "mek_hyrs", tier: "G" },
  { id: "pilot_dufours", displayName: "Elodie Dufours", archetypeId: "arch_reeps_bipedal", mekId: "mek_dufours", tier: "G" },
  { id: "pilot_castell", displayName: "Naomi Castell", archetypeId: "arch_reeps_bipedal", mekId: "mek_castell", tier: "G" },
  { id: "pilot_arnesen", displayName: "Suki Arnesen", archetypeId: "arch_reeps_bipedal", mekId: "mek_arnesen", tier: "G" },
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
export const MEK_TRACK_EFFECTS = {
  fabricator: {
    primary: { spareParts: 2 }, // redeploy at 50% HP on your next turn's deploy pad
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
