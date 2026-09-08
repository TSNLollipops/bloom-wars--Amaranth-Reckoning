# Build Log Addendum — House Amaranth's Own Third Lance (6 Sep 2026)

**Updated same day**: this addendum originally documented a direct-add lance-integration design as final. It was reworked hours later — see "House Amaranth's lance-growth mechanic switches to match Warden's" at the end of this doc for the correction, including an error in this addendum's own original text that's owned rather than quietly edited away.

## What changed

House Amaranth's roster grows from 10 pilots to 15, closing the gap `campaignHouseAmaranth.ts` and `engine/campaignState.ts` have been flagging as "not yet built" since 31 Aug/1 Sep. This is one piece of a larger four-part request Maxime made the same session (separate hostile-mech ids per side — already true, nothing to build; both campaigns eventually fighting each other's full named roster as canon enemies; a "they remember you" rival-memory mechanic; upgrading in-mission hostile AI) — this addendum covers only the House Amaranth Third Lance piece, the first one actually built. The rest is sequenced as separate follow-up work (see `Bloom_Wars_Rival_Memory_And_Squad_AI_Backlog_v1.md` for the memory piece, and the pack-tier AI plan discussed in chat but not yet built).

## The five new pilots

Designed together in chat rather than generated, same discipline every other named pilot in this project got. Maxime's own explicit call: all five rank Private — distinct from House Amaranth's existing ten (Sgt/Cpl/S.Sgt/Spec, no Pvt at all) — read as the story beat it plainly is: House Amaranth's newest hands, thrown into a mech for the first time. Amsel's own background (a Ward-Crop Technician thirteen months ago — Missions 27/31 already establish that job title for this campaign's civilians) gives the whole lance a through-line: these are the people this war ran out of anyone else to send.

- **Pvt. Emeka Thorne — "Harrow"** — Tank, human/bipedal. Ex-terrace foreman.
- **Pvt. Liora Kastan — "Scarecrow"** — Meeps, Hiopi/centauroid.
- **Pvt. Bram Osei — "Silo"** — Reeps, Osnian/vibrissal.
- **Pvt. Sera Dunmore — "Chaffwind"** — Munti, Hiopi/centauroid. (Originally drafted as "Sera Voss" — renamed same day; see the ID-collision note below.)
- **Pvt. Teo Amsel — "Rootbind"** — Meeps, human/bipedal. Ward-Crop Technician thirteen months ago.

Species/path picked to round out the roster rather than repeat it: House Amaranth's first ten are Tank×2/Meeps×3/Reeps×3/Munti×2. This lance adds Tank×1/Meeps×2/Reeps×1/Munti×1, landing the full 15 at Tank×3/Meeps×5/Reeps×4/Munti×3 — not identical to Warden's own final spread (Tank×4/Meeps×4/Reeps×4/Munti×3 across its own three lances), deliberately: House Amaranth's roster has read differently from Warden's since Marrow's own Tank lead, no reason for the two campaigns to converge now.

Mek tracks: Thorne and Amsel get Armorer (matching the Tank-track and young/aggressive precedents already set by Marrow/Kessler and Meir/Iyari respectively), Kastan gets Runemaster (the lead-Meeps vision-track pick Vondra/Vantana/Rourke all carry), Dunmore gets Fieldwright (every Munti in either roster has it), and Osei gets Quartermaster — not yet used anywhere in House Amaranth's own roster, fitting "always has one more shot stashed" better than Fabricator would have.

## What was built (original pass)

- **`data/campaignHouseAmaranth.ts`** — `HOUSE_AMARANTH_THIRD_LANCE_PILOTS`/`HOUSE_AMARANTH_THIRD_LANCE_MEKS`/`HOUSE_AMARANTH_THIRD_LANCE_ROSTER_IDS`/`HOUSE_AMARANTH_ACT3_DEFAULT_SQUAD` (mirroring the Second Lance's own constants exactly). All 16 Act III missions (21-36) retuned from `HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD` onto the new constant; Mission 20 (the Act II finale, shared with Warden's own "Marrow's Line") deliberately left on the old 10-pilot constant, since the new lance hasn't joined yet at that point.
- **`engine/campaignState.ts`** — new `integrateHouseAmaranthThirdLance(state)`, gated in `scenes/Debrief.ts` on `mission_house_amaranth_20` win (this campaign's own Act II finale, the same "previous act's last mission, won" shape every other lance trigger in this file uses). `lanceOfPilot`/`lanceOfMek`/`lanceOfMekIn`/`derivedLanceCount` all updated to know about the new list.
- **`data/pilotRegistry.ts`** — merged into `PILOT_INDEX`/`MEK_INDEX`, the same lookup-gap fix Second/Third Lance both needed on the Warden side before it (confirmed live: `npx tsx src/sim/run.ts mission_house_amaranth_21` resolves and fights correctly with all five new pilots, no "Unknown pilot id" errors).
- **`scenes/TransporterPad.ts`** — `deployCapForMission`'s House Amaranth branch, which used to stop at two tiers (5 for Act I, 10 for Act II/III combined) because there was no Third Lance to need a third tier, now has three: 5/10/15, matching Warden's own "full roster, no bench" intent for Act III. Left at two tiers, Act III would have silently benched 5 of every player's own pilots, every mission — flagged and fixed rather than left for someone to notice in play.

## A real bug found and fixed along the way, not part of the original ask

`Debrief.ts`'s Second/Third Lance callout panels ("YOU HAVE BEEN GIVEN A SECOND LANCE — recruit it at the Hangar Deck / five berths, empty...") were rewritten 5 Sep 2026 for Warden's new empty-lance-plus-recruit flow, but were shared verbatim with House Amaranth's own Second Lance gate, which at the time hadn't moved to that flow. Every House Amaranth save that won Mission 12 had been shown a "five berths, empty, go recruit" screen that wasn't true yet. Fixed that day by branching the callout on campaign — and then, hours later, made true for real when House Amaranth actually adopted the recruit-pool flow (see below), which is why this callout now says the same thing again, just with House Amaranth's own screen name.

## Verification (original pass)

`npx tsc --noEmit` clean. `npx eslint .` clean. `npx vitest run` — 98 files, 2302/2302 passing, zero regressions. Live sim: `mission_house_amaranth_20` still fields the 10-pilot squad; `mission_house_amaranth_21` fields all 15, all five new pilots take real actions and land real damage. All five touched files (`data/campaignHouseAmaranth.ts`, `engine/campaignState.ts`, `data/pilotRegistry.ts`, `scenes/Debrief.ts`, `scenes/TransporterPad.ts`) committed to the live repo.

## House Amaranth's lance-growth mechanic switches to match Warden's (6 Sep 2026, same day)

This addendum originally said `integrateHouseAmaranthThirdLance` adds all five named pilots directly the moment Mission 20 is won, deliberately NOT mirroring Warden's own post-5-Sep `integrateThirdLance` (which grants an empty lance and recruits from a pool). The stated reasoning was two-fold: House Amaranth's existing Second Lance already used the direct-add shape, and — the part that turned out to be wrong — "the recruit-pool shape needs a recruiting screen to present the pool on, which House Amaranth doesn't have (`scenes/Hangar.ts` is still a placeholder — grep-confirmed before writing this, not assumed)."

That grep-confirmation claim was incorrect, and it's worth being direct about that rather than smoothing it into "we later decided to unify them": `scenes/Hangar.ts` was never a placeholder. It already instantiates `ShopPanel` — the exact same scene-agnostic shop/recruit class Warden's `Hub.ts` and House Amaranth's own `Debrief.ts` both use — full recruit UI, lance selector, candidate list, discretionary recruiting, all of it. House Amaranth has had a working recruiting screen since 25 Aug 2026, before the Third Lance was ever built. The claim wasn't a considered tradeoff that got revisited; it was an unverified assumption repeated as fact, caught only when Maxime asked "the two mission should recruit the same way" and, on clarification, confirmed he meant House Amaranth adopting Warden's system outright.

**What changed, mirroring Warden's own 5 Sep 2026 rework line for line:**

- `integrateHouseAmaranthSecondLance`/`integrateHouseAmaranthThirdLance` now call `grantLance(state)` and return `pilots: []`, exactly like `integrateSecondLance`/`integrateThirdLance` — no rank field set either way, since House Amaranth still has no Marrow-equivalent rank/promotion field.
- `recruitCandidates(state)` is now campaign-aware (branches on `baseSceneKeyFor(state) === "Hub"`, the established "does `pilot_rourke` exist" signal already used elsewhere in this file) — a House Amaranth save's pool is its own ten (Kessler, Vantana, Reyken, Solano, Marrin, Thorne, Kastan, Osei, Dunmore, Amsel), never Warden's.
- `recruitIntoLance`'s authored-Mek lookup merges all four lists unconditionally — safe because every mek id across both campaigns is globally unique.
- `Debrief.ts`'s callouts go back to "recruit it" wording for House Amaranth, naming its actual on-screen label ("the Campaign Shop") instead of inventing an in-fiction location it doesn't have.

**A separate, real bug caught in the same pass**: the original fifth pilot, "Sera Voss" (`pilot_voss`/`mek_voss`), collided id-for-id with Team One's own pre-existing pilot of the same id (`data/meks.ts`). `pilotRegistry.ts`'s flat `PILOT_INDEX`/`MEK_INDEX` merge would have silently let House Amaranth's entry overwrite Team One's real character — undetected by any existing test, since nothing checks for cross-roster id collisions. Renamed to "Sera Dunmore" before it ever shipped in a save file.

**Test coverage added**: House Amaranth now has its own full mirror of Warden's "B2 — recruiting into a lance" test block in `engine/__tests__/campaignState.test.ts`, including a pre-6-Sep-save backward-compatibility regression test (an old direct-add save keeps its roster and lance count intact on load) and a fix to one test whose own title ("House Amaranth tops out at two lances, having no third") had quietly gone stale the moment the Third Lance shipped.

**Verification**: `npx tsc --noEmit` clean, `npx eslint .` clean, `npx vitest run` — 98 files, 2306/2306 passing (4 new tests). Live standalone verification script confirms a fresh House Amaranth save grants empty lances, its recruit pool is correctly campaign-separate from Warden's, and recruiting Kessler/Thorne/Dunmore by name each correctly attaches their authored Mek.

## Docs updated

- `claude/build_log/engine_systems/squad_and_deploy_structure.md` — House Amaranth's own lance/deploy-cap history, including this same-day correction.
- This addendum.

## What's still open (this same four-part request, not yet built)

- Mirroring the *other* direction: giving Warden's own 15-pilot roster hostile-mech twins so House Amaranth can fight all of them by name (today only Rourke has one). Same treatment needed for House Amaranth's now-15 pilots to become Warden's own named enemies (today only Marrow has one) — 28 new hostile-mech archetypes total, per the scope breakdown given in chat.
- Deciding which missions across each 36-mission campaign these named encounters actually occur in — agreed to pick these together once the roster/hostile-mech data exists, not before.
- The "they remember you" rival-memory idea — flavor callback now, fuller escalation mechanic tagged post-EA. See the dedicated backlog doc.
- The pack-tier AI change discussed (letting named rival squads focus-fire as a group, reusing the engine's existing but currently Bloom-only `pack` intelligence tier) — designed in chat, not yet built.
