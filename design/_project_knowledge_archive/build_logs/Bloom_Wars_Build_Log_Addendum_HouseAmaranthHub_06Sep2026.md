# Build Log Addendum — The House Amaranth Hub (the Greathouse), 6 Sep 2026

**Status: on Maxime's machine, sandbox-verified, not yet opened by Maxime.** Eighteen files committed to `F:\The Bloom wars. Code project\bloom-wars\bloom-wars` at 21:45 UTC (mtime-guarded — nothing on the device had changed since staging at 20:50). Plan doc: `Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md`. Design lock: `Bloom_Wars_House_Amaranth_Hub_Facility_Plan_v1.md` (4 Sep). Mockup: the artifact *The Greathouse Floor Plans* (also saved as `Bloom_Wars_Greathouse_Floor_Plans_Mockup_v1.html`).

## 0. How it was decided

Maxime's own gate, in order: *"we are building house amaranth hub. plan 1st gimme a mockup once ive aprouve ill allow you to built it"* → plan + mockup delivered → *"ive seen it. ask ur question in popop and then wait for me to say go"* → one AskUserQuestion round with the four calls that mattered → *"go."*

| Question | Answer |
|---|---|
| Q8 — one Hub scene reading a facility profile, or fork `Hub.ts`? | *"Your call, this is a dev answer."* → **facility profile** (the plan's own recommendation, §1). |
| Q1 — estate name | **"The Greathouse"** |
| Q2 — room display names | **Flavour names as drawn** |
| Q4 — Cultivar Works | **Three, one per lance** |

The popup tool caps at four questions, so Q3/Q5/Q6/Q7 were not asked; "go" was read as accepting the mockup's defaults for them, each flagged here for veto: **Q3** the Reliquary on the Deep Floor; **Q5** the Cellars and Records kept as decor-only rooms; **Q6** Verinis as *Brigadier*, name tag "Brig. Verinis Amaranth", the Seal-holder's empty chair behind his desk; **Q7** the floor chain Yard — RC — 1SS — 2SS with stairs at the corridor ends.

## 1. What shipped

**Architecture — `engine/facility.ts`.** A `FacilityProfile` is plain data describing one building: deck order, room titles/notes/decks, roamable rooms, lance berths and workshops, Mek cradles, the stair table, the six reserved bays, the landmark points, the CO, the MC, the seated regulars, bond and Mek seeds, and the campaign hooks (`missionsById`, `nextMission`, `createCampaignState`). `buildFacilityTables(profile)` turns it into the total-typed view `Hub.ts` reads (`roomDeck(r)` returns a `DeckId` or throws — never `undefined` — so the ~200 sites that used to index `Record<RoomId, DeckId>` keep their types). Plain-language version, same as the plan's: the recipe used to say "the oven in my kitchen"; now the kitchen is handed in when the scene is built.

**`scenes/Hub.ts` — parameterised, 10,283 → 10,030 lines.** Constructor is `constructor(facility = WARDEN_FACILITY) { super(facility.sceneKey); this.f = buildFacilityTables(facility); }`. Every Warden constant it declared or imported is gone: `ROOM_TITLES`, `ROOM_NOTES`, `ROOM_DECK`, `DECK_TITLES`, `ROAMABLE_ROOMS`, `LANCE_BERTHS`, `LANCE_WORKSHOP`, `ROOM_ZONE_BOUNDS`, `RESERVED_BAYS`, `DOORS`, `DECK_ORDER`, the fourteen landmark imports, `WARDEN_PILOTS`, `NPC_SEED`/`NPC_BOND_SEED`, `AMARANTH_MISSIONS_BY_ID`, `nextWardenMission`, `createWardenCampaignState`, the hand-built CO block, the five hand-placed `mekSeeds`, `MEK_CATALYST_OVERRIDES`, and 16 `"pilot_rourke"` literals. Seven module-level helpers that read those tables became private methods (`sameDeck`, `nextHopDoor`, `pickDoorLanding`, `pickDoorApproach`, `pickExploreTarget`, `berthRoomFor`, `workshopRoomFor`). The four named floor containers became `deckFloors: Partial<Record<DeckId, Container>>`. `drawDeckLayout` reads the new `DeckLayout.corridor` field instead of `deck === "lower" ? "lowerHall" : "upperHall"`. The header reads `profile.mc.headerLabel(state)`; the title bar reads `profile.displayName`; the HUD level line reads `profile.levelWord` ("DECK" / "FLOOR"). A reading key (old name → where it lives now) sits in the import comment, because ~100 historical comment mentions of the old names were left in place rather than rewritten. One deliberate instance-field decision explained in the code: Phaser constructs every registered scene at boot, so two `Hub` instances exist from the first frame — a module-level "current facility" would have been whichever was constructed last.

**`engine/hubLayoutKit.ts` (new) + `engine/hubLayout.ts` (split).** The facility-agnostic half of the old `hubLayout.ts` — types, palette, the room/wall/door assembler, every furniture piece, the collision math (`resolveAgainstLayout`, `circleHitsLayout`, `roomAtIn`) — moved to the kit; `hubLayout.ts` keeps Warden's four builders and landmark points and becomes the one registry: `DECK_LAYOUTS = { ...WARDEN_DECKS, ...HOUSE_AMARANTH_DECKS }`. `hubNav.ts` and the by-`DeckId` wrappers (`resolveAgainstSolids`, `circleHitsSolid`, `roomAt`, `layoutOf`, `roomCenter`) are unchanged in signature; `export *` from the kit keeps every existing import resolving. `DeckId` widened by `"rc" | "ss1" | "ss2" | "yard"`, `RoomId` by `"cellars" | "controlRoom" | "records" | "ss1Hall" | "ss2Hall"`. Import direction is one-way: estate → kit, `hubLayout.ts` → estate. No cycle.

**`engine/hubLayoutHouseAmaranth.ts` (new) — the Greathouse as data.** Four floors from the mockup, every Hub-keyed coordinate identical to Warden's on purpose (the plan's §0 argument — it is why every walk-up radius, stair landing and the reachability/no-trap-gaps sweeps pass without re-tuning). Estate-only furniture (casks, crates, pillars, shelves, the hearth, the long table, the boiler, the well, the command desk, the Seal's chair, the reading table, the wall map). **Eight placements from the mockup were nudged for the no-trap-gaps rule** (a slot between two solids must be 0 or ≥38px), each commented in the file: the Longhouse planters flushed to the hearth, the long table 2px down, the boiler flushed to two walls, the Cellars crates made contiguous, the stores shelves and casks flushed to the east wall, the Control Room console stack flushed and made contiguous, the Yard well 12px down. **Two mockup placements were wrong for play, not just for the test:** the Control Room's 700px terrace-feeds screen ran across both doorways (bodies would have walked out of the door into a solid) — split to the 360px between the doors; the Records console sat half in its doorway — moved west. The Seal's chair label moved from above the chair (where it drew on the command desk) to beside it.

**`engine/facilityWarden.ts` (new).** Warden's constants, moved with their history. Nothing new in it.

**`engine/facilityHouseAmaranth.ts` (new).** The estate's names, wiring and people. `HOUSE_AMARANTH_REGULARS` (Vondra, Meir, Bray seated; Orin roams — the mockup's own call) added to `data/npcSeedHouseAmaranth.ts`, whose header always said those rows would arrive with a scene to display them. `data/missionBriefing.ts` gains `HOUSE_AMARANTH_MISSION_ORDER` and `nextHouseAmaranthMission` — the "second, House-Amaranth-scoped order sitting alongside `WARDEN_MISSION_ORDER`" its header always said would come.

**Entry path.** `baseSceneKeyFor` returns `"Hub" | "HubHouseAmaranth" | "Hangar"` — a save with `pilot_rourke` → Warden's hub, with `pilot_marrow` → the Greathouse, with neither (archived Team One) → the Campaign Shop as before. `main.ts` registers `new Hub(HOUSE_AMARANTH_FACILITY)` alongside the bare `Hub` class (which Phaser instantiates with no arguments — Warden's default). `Hangar.ts`'s WALKABLE HUB button now shows for any save with a hub and goes to that side's; `MapSelect.ts`'s BACK TO HUB routes through `baseSceneKeyFor` instead of a hardcoded `"Hub"`.

**One generic fix found by the estate check.** The generic Mek-placing loop iterated `activePilotIds`, which excludes the MC on purpose; Warden's profile hand-places `mek_rourke` in `mekSeeds` so it never mattered — but a profile with no hand-placed Meks left the Colonel's own Mek off the floor while every other pilot's stood in the works. The MC's Mek now joins that loop's candidates (a no-op for Warden, `mek_rourke` is already named). Caught by `checkHubHouseAmaranth.mjs`'s cast count on its first run.

**One HUD safeguard.** `Hub.fitRoomTitle()`: the centred title shrinks 16 → 14 → 12 → 11px until it clears the `FLOOR:` readout on its left and the `Day` readout on its right. The estate's longest title, "THE GREATHOUSE — CULTIVAR WORKS — 2ND LANCE" (42 chars), is ~100px wider than Warden's longest and drew straight into the readout at 16px (seen in the ground-floor capture). Warden's titles all fit at 16px, so it never fires there. The three Cultivar Works titles land at 11px — legible, matched to the readouts, but no longer visually dominant. **Your call:** keep the approved names and the shrink, or Warden's own asymmetry ("CULTIVAR WORKS" / "2ND LANCE WORKS" / "3RD LANCE WORKS", the way Warden has "THE WORKSHOP" / "2ND LANCE WORKSHOP") which stays at 14px.

**Tests.** `engine/__tests__/facility.test.ts` (new, 64 tests): both profiles built against the layouts — every profile room exists on its claimed deck and every layout room is in the profile; roamable rooms are never a corridor and every non-corridor room is roamable; every empty room has a note; every stair hops exactly one step along `deckOrder`, has a partner going back, sits in the room it claims, and marker + landing are free floor; every landmark stands on free floor in the right room; the game table is a real solid; every lance workshop has five walkable cradles; all six reserved bays stand on free floor; the MC and every regular are pilots of that campaign and the save routes to that scene; Warden's header still reads "2nd Lt. Dessa Rourke…" and follows a rank change. `hubLayout.test.ts` needed no edit: its every-deck sweeps (geometry sanity, wall thickness, doorway width, reachability between every room pair, one connected floor, no trap gaps) now cover the four estate decks for free — and it is what caught the three trap slots.

**Verification harness.** `tools/verify/genHouseAmaranthSave.ts` + `checkHubHouseAmaranth.mjs` (new; README updated). `captureHubDecks.mjs` scoped to the live scene's own decks (`hub.f.deckOrder`) — it iterated all of `DECK_LAYOUTS`, which now holds both facilities'.

## 2. How it was verified — and the one honest caveat

The plan's gate for step 1 was "identical Warden behaviour, proven by the existing harness." Done properly, which took a false start: the first baseline run was tainted (the dev server was serving the half-edited tree), so a pristine copy of the tree as staged from Maxime's machine was set up beside the working copy and the six Warden Hub scripts were run against each in turn.

| Check | Pristine tree | Refactored tree |
|---|---|---|
| `checkHubDoorReachability` | 6/6, exit 0 | 6/6, exit 0 — **line-for-line identical output** |
| `checkHubNpcs` | 10 NPCs, none stuck, Arangement never moves | same roster, none stuck, Arangement never moves |
| `checkHubCameraScroll` | PASS, grotto re-clamp true | PASS, grotto re-clamp true |
| `checkHubInteractionAfterScroll` | PASS | PASS |
| `checkLanceWorkshops` | newRoomsAreReal true | true |
| `captureHubDecks` | none stuck, none in a wall | none stuck, none in a wall |
| `checkHubHouseAmaranth` | — | **42/42**, no page errors |

`tsc --noEmit`: the same 11 errors before and after, none in any touched file. `eslint`: clean on every touched file. `vitest`: 100 files / 2510 tests, 2499 pass, **11 fail — the same 11 on the pristine tree** (`mekTracks.test.ts`, `frameSystems.test.ts`, `muntiRegen.test.ts`).

**The caveat, said plainly:** those 11 failures and 11 type errors are not the hub's, but they are real and they are on Maxime's machine. `mission.ts` and `campaignEconomy.ts` use `movedThisTurn`, `sparePartsSpent` and `defenderStruckFirst`; `types.ts` and `mission.ts`'s own `Mission`/`BattleUnit`/`AttackOutcome` types don't declare them. The mtimes (`mission.ts` touched 40 minutes before staging, `types.ts` three hours before) read like a mid-edit snapshot of the mek-track work rather than a committed drift, but that's a guess — `npm run typecheck` on the device will say. `vite build` was not run this pass because its `tsc &&` step would fail on those regardless of anything the hub did.

**Estate screenshots** (sandbox Chromium, in `tools/verify/hub_ha_*.png`): the Longhouse with its hearth, long table and game table; the Cellars with pillars and the salvage cage outline over three Cultivar Works; the Reliquary, War Room and Signal Cellar over the Control Room with Verinis at "REPORT HERE", the command desk and the Seal's chair; the Yard's ring.

## 3. Placeholders that are Claude's, flagged for veto

- **Verinis's catalyst: shark.** `catalystProfile.ts` reads shark as ambition/drive/relentless; `CATALYST_CLASH_PAIRS` puts it against wolf (Meir) and rabbit (Orin). A CO whose read grates on two of the five is what "an asshole, plain and simple" sounds like in the one dial the ambient system has. Not in any doc; one line to change.
- **Verinis's colour: amaranth-rose (`0xb04a6a`)**, the House's own, not Arangement's brass.
- **The three regulars' starting favorability/stress/morale** (Vondra 30/25/78, Meir 10/55/65, Bray −5/45/60), shaped to the 31 Aug bond plan. Same "not a locked content decision" footing `NPC_SEED`'s carry.
- **Room notes** in Warden's register (e.g. the Motor Court's "Console for roster, gear and recruiting. The BAY pad at the terrace gate is where the lances muster to deploy."). The Control Room has none — Warden's grotto made the same call on 27 Aug for the same reason (the note drew through the CO's name tag; the estate check's capture showed exactly that).
- **The Seal's chair** as a prop with a label. Q6's default.
- **"BACK TO THE CAMPAIGN SHOP"** as the estate's footer button (Warden's says "BACK TO THE CARRIER").

## 4. What this build deliberately did not do (Build Plan §2 step 4 and §4)

- **Verinis's lines.** He speaks Arangement's check-in / brief / build-approval / advice / confide pools. Wrong in voice, not broken. Yours first, matching second batch after — the 4 Sep workflow.
- **Mek catalyst picks for the estate** (`mekSeeds: []`, `mekCatalysts: {}`): every Mek is placed by the generic loop in its own lance's Cultivar Works and takes `catalystForPilot`'s fallback. Warden's picks were a content pass on 1 Sep; the estate's should be too.
- **A rank field for Marrow.** The header reads her live record's `displayName` ("Col. Ysolde Marrow"). `campaignState.ts`'s own note stands: `rourkeRank` is never hers and never moves on this side.
- **The carrier-module strings.** The bench in Cultivar Works — 1st Lance opens the same panel Warden's does, titled "CARRIER UPGRADE MODULES". The estate's room note calls it "estate works"; the panel doesn't. Cosmetic, can wait (plan §3).
- **A `sweepUi` extension for the estate screens**, a `genSave.ts` House Amaranth fixture beyond the new standalone generator, and a Codex entry for the Greathouse.
- **The Antfarm placement economy**, a Frame Systems walk-up in the Cellars, a records terminal, the Seal-holder as a character, any change to House Amaranth's missions or numbers.

## 5. Docs this changes

- **`Bloom_Wars_Now_And_Next.md`** — rewritten in the same pass (eighth-pass note; "House Amaranth has no Hub" corrected in two places; verification gate; the Vault bullet under Needs verifying; the Roster Stress/Morale gap under On the table; the estate's strings under the lint item; Verinis's lines under Yours specifically).
- **`Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md`** — its status line ("plan + mockup, for approval, zero code") is now false; steps 1–3 and the harness half of 5 are done, step 4 is Maxime's. Not edited this pass; this addendum is the record.
- **`Bloom_Wars_House_Amaranth_Hub_Facility_Plan_v1.md`** — its open items (§5 rank, §7 the Vault's floor) are answered by Q6/Q3's defaults above. Not edited.
- **`Bloom_Wars_Walkable_Hub_Build_Plan_v1.md` / `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`** — any line saying the Hub *is* the Antfarm is now half the story. Not edited; flagged.
- **`data/missionBriefing.ts`'s test** (`missionBriefing.test.ts`) still covers Warden only; `nextHouseAmaranthMission` is covered indirectly by `facility.test.ts`'s "nextMission starts at this campaign's first mission" — a direct test would be cheap.
- **The GDD / Data Pack** say nothing about a second hub; nothing to correct there. The naming lock (`npm run lint` on Maxime's machine) has never seen any of the estate's strings or the seven new filenames — listed in Now_And_Next under "Yours specifically."

## 6. For Maxime, first time in

1. `npm run typecheck` — expect the 11 mek-track errors described above, nothing in `Hub.ts`/`engine/facility*`/`engine/hubLayout*`. If they're not there, the snapshot theory was right and a save was pending.
2. `npm run dev`, new campaign → House Amaranth → CONTINUE. You should land in **THE GREATHOUSE — THE LONGHOUSE** with "Col. Ysolde Marrow" top-left and "FLOOR: GROUND FLOOR". Vondra, Meir and Bray at the game table; Orin somewhere; Marrow's Mek and the other four in Cultivar Works — 1st Lance (down the west stair, aft of the passage).
3. West stair twice to the Deep Floor: Verinis at REPORT HERE in the Control Room, the empty chair behind the desk. Talk to him — he'll sound like Arangement. That's the content gap, not a bug.
4. East stair from the Gallery to the Yard and back.
5. Load a Warden save and confirm the Antfarm is exactly as you left it — that is the whole claim of step 1.
