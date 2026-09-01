# Build Log Addendum — House Amaranth: Mission Select + Roster Wiring (1 Sep 2026)

Maxime, after confirming all 36 House Amaranth missions were sim-tuned and committed but not actually reachable in the game: *"yeah. plz. ill do the hub some other day."* — approved the minimum wiring to make House Amaranth actually playable (Mission Select tab + roster seeding), explicitly deferring a House Amaranth Hub to later.

## What shipped

- **`src/data/allCampaigns.ts`** — House Amaranth added to the `CAMPAIGNS` array as three act-scoped `CampaignDef` entries (matching Warden Company's own act-split pattern), so it now renders as real tabs on the Mission Select screen. Titles ("The Amaranth Bargain," "Harvest Ground" / "The Bargain Holds" / "The Stalling Season") are the ones already in use throughout every House Amaranth mission's own build-time comment in `campaignHouseAmaranth.ts` — not a new naming decision, just surfacing the one already established.
- **`src/engine/campaignState.ts`** — `createHouseAmaranthCampaignState()` (mirrors `createWardenCampaignState`, generic factory already built "on purpose" for a second roster per its own doc comment) and `integrateHouseAmaranthSecondLance()` (mirrors `integrateSecondLance`, fires on a Mission 12 win). Deliberately reuses the shared `CampaignState` type/save system rather than building a separate module — see the in-code comment on why that doesn't contradict the campaign plan doc's own "confirm before building a separate module" note (that note was about the bigger, not-yet-approved Hub-integration build).
- **`src/scenes/Debrief.ts`** — wires `integrateHouseAmaranthSecondLance` to the same Mission-12-win trigger shape Warden's own Second Lance uses.
- **`src/scenes/CampaignSetup.ts`** — the "SIDE" selector (previously a pre-selected, non-interactive placeholder) is now a real two-way toggle; BEGIN CAMPAIGN branches to the right roster factory and opening mission.

## Two real bugs found and fixed along the way — not part of the original minimal ask, but required for "actually playable"

**1. Deploy cap silently wrong for every House Amaranth Act II/III mission.** `scenes/TransporterPad.ts`'s `deployCapForMission` matched only `^mission_amaranth_(\d+)$` — a different string than `mission_house_amaranth_(\d+)$` (the extra `house_`). Every House Amaranth mission ID fell through to the "doesn't match" fallback and got capped at 5 deployable pilots regardless of act, even though Missions 13-36 field a 10-pilot squad (`HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD`). Fixed with a House Amaranth-specific branch ahead of the existing one; House Amaranth only needs two tiers (5 for 1-12, 10 for 13-36) since it has no Third Lance.

**2. Every "return to base" button in the game unconditionally routed to Warden's Hub.** `scenes/MainMenu.ts`'s CONTINUE, `scenes/Debrief.ts`'s RETURN TO BASE, and `scenes/Boot.ts`'s recall-notice RETURN TO BASE all hardcoded `this.scene.start("Hub")`. `scenes/Hub.ts` is built entirely around `WARDEN_PILOTS`/`SECOND_LANCE`/`THIRD_LANCE` — handed a House Amaranth `CampaignState`, it has no record of any of those pilot ids. A House Amaranth player finishing any mission would have landed in a Hub built for a roster they don't have. New `baseSceneKeyFor(state)` (engine/campaignState.ts) checks for `pilot_rourke`'s presence — the cheapest reliable "is this a Warden save" signal without adding a new field — and routes to `Hangar` (the existing, already roster-agnostic "CAMPAIGN SHOP" screen built 25 Aug as Act I's own pre-Hub meta-screen) for anything else. Also gates `scenes/Hangar.ts`'s "WALKABLE HUB (PROTOTYPE)" button behind the same check, so a House Amaranth save is never offered a button that would walk it into the same problem.

Left deliberately unfixed, flagged rather than silently patched: `scenes/Boot.ts`'s recall-notice text ("Warden Company, this is Command...") stays Warden-flavored for a House Amaranth save that hits it — a real but rare edge case (a mid-flight mission abandoned 12+ hours) and writing House Amaranth-specific recall copy wasn't part of what this pass was asked to build.

## Known, accepted simplifications (flagged, not hidden)

- **Cross-campaign tab visibility.** Adding House Amaranth to `CAMPAIGNS` means a Warden save can browse into a House Amaranth tab (and vice versa) and see missions it has no matching roster for — the exact same permissiveness `allCampaigns.ts`'s own header already documents between Warden's own three acts (nothing stops starting Act II before finishing Act I either). Not a new gap this pass introduces; real campaign-scoping in `MapSelect` would be a new system, not wiring an existing one.
- **`rourkeRank`/CO bonus stays at its default for House Amaranth.** `integrateHouseAmaranthSecondLance` deliberately doesn't touch it — there's no Marrow-equivalent rank field or promotion schedule designed yet. The bonus still applies, it just never increases for this side. A missing nice-to-have, not a bug.
- **One Ironman save at a time, either side.** Same behavior Warden alone already had (single `STORAGE_KEY`) — not a new limitation. Two campaigns running side by side needs Ironman off and the existing manual-save-slot system, same as it always has.
- **No tutorial gate for House Amaranth Mission 1** (`scenes/Battle.ts`'s tutorial trigger is hardcoded to `mission_amaranth_1`) — left alone, not part of this pass's scope.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
npm run build          → clean (tsc + vite build), only the pre-existing >500kB chunk-size warning
```

Plus a real end-to-end smoke check (not part of the shipped test suite — Phaser's own scene files need a browser DOM this repo's test config deliberately doesn't shim, same reasoning already on record elsewhere in this codebase) covering: `CAMPAIGNS` has the 3 House Amaranth entries with the right mission counts (12/8/16, 36 total), every mission id resolves through `ALL_MISSIONS_BY_ID`, a fresh House Amaranth `CampaignState` has the right 5 pilots (Marrow correctly exempt from permadeath), `deployCapForMission` returns 5 for Mission 1/12 and 10 for Mission 13/36, a fresh 5-pilot squad and the full 10-pilot squad both pass `canLaunchMission` (the Munti guarantee — Orin covers it from the start), Second Lance integration adds exactly 5 pilots and is idempotent on a second call, and `baseSceneKeyFor` correctly resolves to `"Hangar"` for a House Amaranth state and `"Hub"` for a Warden one.

## What's still not built

House Amaranth's own Hub (`HubHouseAmaranth.ts` — estate rooms, roster walking around in it, Talk/ambient lines, Shop/Weapon Branch economy, the seneschal NPC) — explicitly deferred by Maxime ("I'll do the hub some other day"). Missions 1-11's enemy-variety reform. Maxime's own planned n=500 whole-campaign retune pass. House Amaranth-flavored recall-notice text for the rare mid-flight-timeout edge case. A Marrow-equivalent rank/promotion field, if ever wanted.
