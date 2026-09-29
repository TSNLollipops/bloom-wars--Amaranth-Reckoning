// src/data/deployPads.ts
// How many player deploy pads a mission's map actually has, and a clamp so
// the Transporter Pad never lets a squad bigger than that launch.
//
// Why (26 Sep 2026, customer playtest + Bloom_Wars_Playtest_Fixes_Plan_v1):
// Mission.deployPlayerUnits() places pilot i on pads[i % pads.length]. When
// the squad was bigger than the map's pad count, the extra pilots were
// placed ON TOP of earlier ones -- the commander was seen hidden under
// another pilot on turn 1 of Mission 17. The Warden maps were fixed at the
// source (design/maps_amaranth_grids.py now gives every map at least its
// Act's deploy cap in pads, and deployPads.test.ts keeps it that way). This
// clamp is the guard rail for any map that doesn't: House Amaranth's maps
// (hidden until its update) still have fewer pads than their caps on 20
// missions, and a future map could too. A clamped squad benches pilots,
// which is visible and honest; a stacked squad is a silent bug.
//
// Pure data lookup: no engine imports (src/data/** never imports engine).
import { ALL_MISSIONS_BY_ID } from "./allCampaigns";
import { ALL_MAPS } from "./mapRegistry";

/** Player deploy pads on this mission's map, or null if the mission or map is unknown. */
export function deployPadCount(missionId: string): number | null {
  const mission = ALL_MISSIONS_BY_ID[missionId];
  if (!mission) return null;
  const map = ALL_MAPS[mission.mapId];
  if (!map) return null;
  return map.deployZones.player.length;
}

/**
 * The act's deploy cap, lowered to the map's pad count when the map has
 * fewer pads. Unknown mission/map, or a map with zero pads, leaves the cap
 * untouched (Mission's own fallback handles those; clamping to 0 would
 * block BEAM DOWN entirely).
 */
export function clampDeployCapToPads(cap: number, missionId: string): number {
  const pads = deployPadCount(missionId);
  if (pads === null || pads <= 0) return cap;
  return Math.min(cap, pads);
}
