// src/data/bloom.ts
// The seven pre-rolled Bloom creatures, transcribed from Data Pack §8.
// colorPalette values use the real Bioterror Bank families from Canon
// Pass v1 §E (the Data Pack shipped placeholder hex before that pass).
//
// Vision was only given explicitly in the Data Pack for Crawlmass,
// Undertow and Heartwood. The other four are first-pass design values
// inferred from their Perception category (GDD §5.1) — not source, cheap
// to retune, flagged the same way the project flags everything designed-
// but-not-simulated.
import type { BloomArchetype } from "./types";

export const BLOOM: Record<string, BloomArchetype> = {
  bloom_crawlmass: {
    id: "bloom_crawlmass",
    displayName: "Crawlmass",
    weaponType: "claws",
    movementType: "swarm",
    perception: "chemical",
    intelligence: "reflexive",
    endurance: 40,
    vitality: 60,
    moveRange: 4,
    attackRange: [1, 1],
    attackPower: 22,
    vision: 3,
    swarmSize: [8, 14],
    colorPalette: ["#B7B4AE", "#DCD9D2", "#7A2430"],
    spriteKey: "bloom_blob_small",
  },
  bloom_splitfang: {
    id: "bloom_splitfang",
    displayName: "Splitfang",
    weaponType: "claws",
    movementType: "swarm",
    perception: "compound",
    intelligence: "pack",
    endurance: 70,
    vitality: 70,
    moveRange: 5,
    attackRange: [1, 1],
    attackPower: 38,
    vision: 4, // not source-specified — first-pass value, see file header
    swarmSize: [3, 5],
    colorPalette: ["#3DDCFF", "#F2E63D", "#8A4A2A"],
    spriteKey: "bloom_pack_medium",
  },
  bloom_undertow: {
    id: "bloom_undertow",
    displayName: "Undertow",
    weaponType: "spines",
    movementType: "burrow",
    perception: "seismic",
    intelligence: "reflexive",
    endurance: 60,
    vitality: 50,
    moveRange: 4,
    attackRange: [1, 1],
    attackPower: 55,
    vision: 3,
    onHit: "fx_none",
    colorPalette: ["#1A1A24", "#3A2E4A", "#A97C4F"],
    spriteKey: "bloom_spike_burrow",
  },
  bloom_sporethrower: {
    id: "bloom_sporethrower",
    displayName: "Sporethrower",
    weaponType: "projectile",
    movementType: "limbless",
    perception: "compound",
    intelligence: "reflexive",
    endurance: 50,
    vitality: 80,
    moveRange: 2,
    attackRange: [2, 3],
    attackPower: 34,
    vision: 5, // not source-specified — first-pass value, see file header
    colorPalette: ["#8A867E", "#DCD9D2", "#C24D63"],
    spriteKey: "bloom_launcher_limbless",
  },
  bloom_gallcyst: {
    id: "bloom_gallcyst",
    displayName: "Gallcyst",
    weaponType: "acid",
    movementType: "sessile",
    perception: "chemical",
    intelligence: "reflexive",
    endurance: 140,
    vitality: 20,
    moveRange: 0,
    attackRange: [1, 3],
    attackPower: 30,
    vision: 3, // not source-specified — first-pass value, see file header
    onHit: "fx_acid_dot",
    colorPalette: ["#6B4358", "#4A2E3A", "#B4FF3D"],
    spriteKey: "bloom_turret_sessile",
  },
  bloom_sirenmaw: {
    id: "bloom_sirenmaw",
    displayName: "Sirenmaw",
    weaponType: "sonic",
    movementType: "flight_membrane",
    perception: "thermal",
    intelligence: "pack",
    endurance: 80,
    vitality: 70,
    moveRange: 6,
    attackRange: [1, 2],
    attackPower: 25,
    vision: 5, // not source-specified — first-pass value, see file header
    onHit: "fx_debuff_attack",
    colorPalette: ["#D9CBB0", "#A97C4F", "#3DDCFF"],
    spriteKey: "bloom_flyer_membrane",
  },
  bloom_heartwood: {
    id: "bloom_heartwood",
    displayName: "The Heartwood",
    weaponType: "concussive",
    movementType: "sessile",
    perception: "seismic",
    intelligence: "emergent",
    endurance: 400,
    vitality: 60,
    moveRange: 0,
    attackRange: [1, 4],
    attackPower: 60,
    vision: 8,
    onHit: "fx_knockback_1",
    colorPalette: ["#1A1A24", "#5C4A78", "#6B4358"],
    spriteKey: "bloom_mass_large",
  },
};

// Data Pack §8.1 — on-hit effects and special rules, as engine-consumable
// parameters. DoT/debuff ticking lives in engine/turnManager.ts.
export const BLOOM_ON_HIT_EFFECTS: Record<
  string,
  { kind: "acid_dot" | "debuff_attack" | "knockback" | "none"; magnitude: number; duration: number }
> = {
  fx_none: { kind: "none", magnitude: 0, duration: 0 },
  fx_acid_dot: { kind: "acid_dot", magnitude: 8, duration: 2 }, // 8 dmg/turn for 2 turns; converts target tile to bloom_mat
  fx_debuff_attack: { kind: "debuff_attack", magnitude: 0.2, duration: 2 }, // -20% ATK, target + friendlies within 2 tiles; does not stack, longest duration wins
  fx_knockback_1: { kind: "knockback", magnitude: 1, duration: 0 },
};

// Data Pack §8.1 special rules not captured by the stat block:
//   - Undertow: burrowed on spawn, not drawn/targetable. Surfaces when any
//     unit ends its move adjacent, or is revealed by burrow detection
//     (vibrissal chassis or Runemaster-primary mek, within vision).
//     An attack on the turn it surfaces deals x1.5.
//   - Splitfang: pack AI — any Splitfang within 3 tiles of another shares
//     its target.
//   - Sporethrower: cannot counterattack and cannot be counterattacked at
//     range — mirrors the player Reeps rule exactly.
//   - Gallcyst: move 0. Runemaster potency scales the ATTACKER's effects,
//     not the defender's — a Runemaster-equipped pilot hit by Gallcyst
//     acid takes the same duration.
//   - Sirenmaw: flying — ignores all terrain movement cost, cannot be
//     blocked by units or terrain.
//   - Heartwood: move 0, emergent AI. Every 2 turns from turn 3, spawns 2
//     Undertow burrowed at the map's spawn seams (see data/campaign.ts).
//     Prioritises the Munti above all other targets.
export const UNDERTOW_SURFACE_DAMAGE_MULT = 1.5;
export const SPLITFANG_PACK_RADIUS = 3;
