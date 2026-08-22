// src/data/abilities.ts
// Data Pack §6. Six for the slice. Everything referenced by an archetype
// exists here; nothing here is referenced by nothing.
import type { AbilityDef } from "./types";

export const ABILITIES: Record<string, AbilityDef> = {
  abil_overshield: {
    id: "abil_overshield",
    displayName: "Overshield",
    kind: "passive",
    // While this Tank is on the board and not downed, every adjacent
    // friendly unit gains +1 terrain defence star (10% damage reduction).
    // Does not stack with a second Tank. See engine/combat.ts overshieldBonus().
  },
  abil_repair: {
    id: "abil_repair",
    displayName: "Repair",
    kind: "active",
    // Instead of attacking, restore 30 HP to one adjacent friendly unit.
    // Once per turn. x1.25 if the Munti's mek has Fieldwright as primary.
  },
  abil_cockpit_evac: {
    id: "abil_cockpit_evac",
    displayName: "Cockpit Evac",
    kind: "active_reactive",
    // When an adjacent friendly unit would be reduced to 0 HP, the Munti
    // may instead pull it to an adjacent free tile at 1 HP. Once per
    // mission per Munti. Catches ordinary combat downings only — it must
    // never intercept a scripted remove_from_roster event (Data Pack §6,
    // the cockpit-evac/Mission-3-wipe box). The wipe is not a downing.
  },
  abil_charge: {
    id: "abil_charge",
    displayName: "Charge",
    kind: "passive",
    // Centauroid only. If the unit moved >=3 tiles in an unbroken
    // straight line over cost-1 terrain and attacks at the end of that
    // move, damage x1.25.
  },
  abil_sensor_sweep: {
    id: "abil_sensor_sweep",
    displayName: "Sensor Sweep",
    kind: "passive",
    // Vibrissal chassis only. Reveals burrowed hostile units anywhere
    // within this unit's vision radius. Revealed units stay revealed
    // until the end of the following enemy turn.
  },
  abil_severance: {
    id: "abil_severance",
    displayName: "Severance",
    kind: "party",
    // The Heirloom. See engine/combat.ts SEVERANCE and Data Pack §11.5.
    // Not attached to any archetype — it belongs to the Party.
  },
};

// Data Pack §11.5. The Heirloom's own mechanics — hits friend and foe
// alike, no exception, no falloff, no opt-out. This is not a stat block
// tuning knob; softening it is explicitly against the design.
export const SEVERANCE = {
  id: "abil_severance",
  shape: { kind: "line" as const, length: 8, width: 1 },
  damage: 80,
  ignoresTerrain: true,
  ignoresFullHpCap: true, // the only true value of this field in the game
  hitsFriendlies: true, // NOT configurable. Do not add a flag for it.
  vsBloom: "collapse_check" as const, // bypasses endurance entirely
  chargePerTenHpDealt: 1,
  chargePerTenHpTaken: 1,
  maxCharge: 100,
};
