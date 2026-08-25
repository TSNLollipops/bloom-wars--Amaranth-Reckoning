// src/data/mapRegistry.ts
// Combined map lookup — Team One's four maps (data/maps.ts's MAPS) plus
// Amaranth Act I's twelve maps (data/mapsAmaranth.ts's MAPS_AMARANTH, all of
// Act I as of the missions 9-12 pass, 25 Aug 2026).
// engine/mission.ts resolves mission.mapId through here instead of
// data/maps.ts directly, the same reasoning as data/pilotRegistry.ts.
import type { MapDefinition } from "./types";
import { MAPS } from "./maps";
import { MAPS_AMARANTH } from "./mapsAmaranth";

export const ALL_MAPS: Record<string, MapDefinition> = {
  ...MAPS,
  ...MAPS_AMARANTH,
};
