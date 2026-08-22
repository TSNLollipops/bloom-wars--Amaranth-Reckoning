// src/data/mapRegistry.ts
// Combined map lookup — Team One's four maps (data/maps.ts's MAPS) plus
// Amaranth Act I's four maps (data/mapsAmaranth.ts's MAPS_AMARANTH).
// engine/mission.ts resolves mission.mapId through here instead of
// data/maps.ts directly, the same reasoning as data/pilotRegistry.ts.
import type { MapDefinition } from "./types";
import { MAPS } from "./maps";
import { MAPS_AMARANTH } from "./mapsAmaranth";

export const ALL_MAPS: Record<string, MapDefinition> = {
  ...MAPS,
  ...MAPS_AMARANTH,
};
