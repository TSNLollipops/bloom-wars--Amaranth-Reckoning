// src/data/mapRegistry.ts
// Combined map lookup — Team One's four maps (data/maps.ts's MAPS), Warden
// Company's Amaranth maps (data/mapsAmaranth.ts's MAPS_AMARANTH), plus
// House Amaranth's own (data/mapsHouseAmaranth.ts's MAPS_HOUSE_AMARANTH,
// one map so far — 31 Aug 2026 scaffolding pass, see that file's header).
// engine/mission.ts resolves mission.mapId through here instead of
// data/maps.ts directly, the same reasoning as data/pilotRegistry.ts.
import type { MapDefinition } from "./types";
import { MAPS } from "./maps";
import { MAPS_AMARANTH } from "./mapsAmaranth";
import { MAPS_HOUSE_AMARANTH } from "./mapsHouseAmaranth";

export const ALL_MAPS: Record<string, MapDefinition> = {
  ...MAPS,
  ...MAPS_AMARANTH,
  ...MAPS_HOUSE_AMARANTH,
};
