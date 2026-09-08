# Build Log Addendum — Beacon Control: Rourke-Only Rank Gate (6 Sep 2026)

## What changed

Beacon Control's ability-holder rule changed from "whichever deployed pilot holds the highest gear tier" (the original 4 Sep 2026 rule) to "Rourke only, gated by her own campaign rank — Captain or higher, locked out at 2nd Lieutenant."

This was Maxime's call, verbatim: *"beacon is rourke only as the major. or the one rank before who can deploy it. if it break the 6 button rule then we add more button. its all."* Clarified via a quick multiple-choice check — confirmed as "just Rourke, gated by her own rank," not a second, specific NPC — before writing any code.

## Why it changed

The tier-based rule surfaced a real problem during the Phase 1 audit: it let Beacon attach to whichever pilot happened to have the best gear that mission, which in practice meant an Heirloom wielder (a pilot who isn't Rourke) could end up holding it. That pushed that pilot's action bar to 7 verbs, one past the 6-slot ceiling `checkActionBarPaging.mjs` and `actionBarPaging.test.ts` both assume. Full finding in `Bloom_Wars_Audit_Phase1_GapLog_06Sep2026.md` and `Bloom_Wars_Build_Log_Addendum_AuditFixPass_06Sep2026.md`.

## What was built

- `engine/mission.ts` — `beaconHolderId()` rewritten: returns `null` while `rourkeRank === "2nd_lt"`, otherwise finds the live, non-downed unit whose `pilotId === "pilot_rourke"`. The old `BEACON_TIER_ORDER` constant and its gear-tier lookup are gone. `MissionOptions` gained `rourkeRank?: Rank`, snapshotted from `CampaignState.rourkeRank` the same way `beaconCratesRemaining`/`beaconChargesRemaining` already are — Mission has no live CampaignState reference and isn't meant to. Default `"2nd_lt"` is deliberate: it's the real rank every new campaign starts at, not a placeholder, so an old save or a call site that forgets to pass it gets Beacon honestly locked out rather than silently granted.
- `scenes/Battle.ts` — passes `rourkeRank: campaignForMission?.rourkeRank ?? "2nd_lt"` into the `Mission` options at construction, alongside everything else already snapshotted there. Updated the stale comment above the BEACON action-bar button to describe the new rule.
- `engine/__tests__/beaconControl.test.ts` — `quietMission()` helper now takes a `rourkeRank` param (defaults to `"maj"` so the other 35 tests, which are about bay/stock/range/cost gating and not rank, keep working unchanged). Rewrote the `Mission.beaconHolderId` describe block: eligible at Captain regardless of anyone else's gear, eligible at Major, null at 2nd Lieutenant, null while downed even at Major, ignores hostiles, null when everyone's downed. 41 tests total, all passing.

## Side effect: resolves the action-bar mismatch too

Because Beacon can now only ever attach to Rourke, the Heirloom-wielder-hits-7-verbs case can't happen anymore — Osric (or any other Heirloom pilot) never gets the Beacon button at all. Verified live with `checkActionBarPaging.mjs`: passes cleanly against the current build with no changes to the paging system itself.

Separately, confirmed the paging system Maxime's fallback line asked for ("if it break the 6 button rule then we add more button") already exists and already works: `engine/actionBarPaging.ts` pages any verb count correctly, verified live against an 8-verb build. Nothing needed to be built there — it was already general-purpose, not hardcoded to 6.

Rourke's own kit today is nowhere near the 6-slot ceiling, so this isn't a live risk even without the paging system, but the paging system is there as the correct long-term answer if that ever changes.

## Cross-campaign note (flagged, not silently absorbed)

House Amaranth (and any future non-Rourke campaign) has no `pilot_rourke` in its roster, so `beaconHolderId()` will always return `null` there — Beacon Control becomes permanently unusable in that campaign under the new rule. This is a real consequence of the design change, not a bug, and is called out explicitly in `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`'s new addendum and in `mission.ts`'s own doc comment. Worth deciding later whether House Amaranth needs its own holder rule or just doesn't get Beacon Control at all.

## Docs updated

- `Bloom_Wars_Beacon_Restock_Economy_v1.md` §2 — rewritten in place with the ownership change, original 4 Sep text preserved below it for the record.
- `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` — §11.2's Beacon Control row updated, plus a new closing addendum section.

## Verification

`npx tsc --noEmit` clean. `npx eslint .` clean. `npx vitest run` — 98 test files, 2298/2298 passing. `checkActionBarPaging.mjs` passes live against current build. All three touched files (`engine/mission.ts`, `scenes/Battle.ts`, `engine/__tests__/beaconControl.test.ts`) committed to the live repo.
