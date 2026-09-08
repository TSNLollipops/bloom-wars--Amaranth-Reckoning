# Bloom Wars — Build Log Addendum: Cursor Tooltip, Keybindings, The Workshop — 2 Sep 2026

Maxime's ask, verbatim: *"lets keep working on warden hub. give each room a fonction, finish the workshop add all the module from weapon and dev. add some natural keybinding for the majority of action, add a small popup window next to the mouse giving you basic info on what you mouse over. coding weapon battery and heirloom. and adding those to the combat twctic part"* — then, after the scope flag below was relayed: *"go"*.

Five asks. Three built this pass, two flagged back as decisions rather than code. This addendum covers all five honestly, including the two that weren't built and why.

## Naming lock — checked first, cleared

"Heirloom" was checked against the naming lock before anything else, since the ask names it directly. It was never a locked term. Per `claude/Bloom_Wars_Naming_Lock_Policy_Update_2Sep2026.md`, the branding half of the lock was repealed the same day ("we are going full crossover. old rule is stale."), and the one term still held back is the novel's true-name reveal, which this pass never approaches. `Sovereign` remains book-side only — no Bloom Wars doc gives it game meaning, so it was left alone rather than invented into the game.

## Shipped

### 1. Cursor-following hover tip

`engine/hoverTipLayout.ts` (new, Phaser-free) + `scenes/ui/HoverTip.ts` (new, the drawing half), wired into both `Battle.ts` and `Hub.ts`.

The split follows `engine/hubGeometry.ts`'s own precedent and for the same stated reason: scene files import Phaser at module scope, which throws outside a browser, so anything living in a scene can't be unit-tested. Placement is four corners, two independent flip axes, and a box-bigger-than-screen fallback — exactly the kind of math this project's own rules say deserves a test rather than a browser eyeball. 17 tests cover it, including a full-canvas pointer sweep asserting the tip never leaves the margins from any position.

**A correction worth recording:** hover-to-inspect was already built (1 Sep, feature-gap C4) — it rendered into the right-hand HUD panel. The 1 Sep pass built C4's first half only. So this pass did two things rather than one: moved the existing content to the cursor, and built C4's never-built second half (*"Hover a tile: terrain name and defence stars"*), which now also reports turn-start burn, the Reeps ridge range bonus, and impassable ground. Terrain was skipped in the panel for a good reason — a readout for every idle mouse position would have competed with the log — and that reason disappears at the cursor.

The hover block was **removed** from the HUD panel rather than duplicated. Showing the same text twice is worse UI than either alone, and it retires the `fitLines` contention the old arrangement caused (both blocks competing for one panel budget, caught in the 1 Sep headless smoke test) instead of working around it. The mission briefing now simply shows whenever no unit is selected.

Hub side shows a crew card on an NPC (path, favor, stress and morale **worded against their real thresholds**, drunk/worried/relationship/walking) and the room's name and function otherwise. Everything shown was already being computed; nothing new was derived, so it can't drift from what the sim thinks.

### 2. Keybindings

- **Battle: `1`–`6` fire the six action-bar slots.** Same `runActionSlot()` the buttons call, so a key can never do something a click can't, and every existing guard still applies.
- **Discoverability** — the digit is drawn *on* each button as its own pinned label. Not prefixed onto the existing label: those buttons are 70px and "OVERWATCH" at 10px already crowds them (the file's own comment says so), so a `"1 "` prefix would have pushed the longest labels past the edge. Same loop index drives digit, label and handler.
- The standing legend widened from `[tab] next mech` to `[tab] next  [1-6] action  [esc] cancel`.
- **Hub: `H` = history, `L` = highlights.** These two panels were previously reachable *only* by opening the chat box and typing a phrase the intent detector happened to match — three steps for a read-only panel, and no way to discover either existed. The chat path is untouched; this is a direct route alongside it. Both go through the same `nearestNpcInRange` the chat handlers use.

**A real bug caught and fixed along the way.** This scene had the key-capture list written out as three separate string literals (`create`'s addCapture, `openChat`'s removeCapture, `closeChat`'s addCapture) and they had **already drifted** — the latter two listed `M`/`R` unconditionally while `create()` only binds them in dev builds. Adding `H`/`L` would have drifted it further in a way a player would actually feel: `create()` would capture them, `openChat`'s literal wouldn't release them, and both letters would have been `preventDefault`'d straight out of the chat input. Typing "hello" would have produced "ello". Now one `hubCaptureKeys()` helper, three call sites, no way for the release to disagree with the capture.

### 3. The Workshop — Carrier Upgrade Modules

`data/carrierModules.ts` (new), `purchaseCarrierModule` in `campaignEconomy.ts`, `CampaignState.builtModules`, and a real walk-up bench console in the Workshop (`WORKSHOP_BENCH_POINT`, `buildWorkshopOverlay`).

**Which layer this room got, and why not both.** The source design (`Antfarm_Carrier_Hub_v1.md` §3) gives the Workshop two layers. Layer one — gear tiers, spare parts, mek secondaries — is the Campaign Shop, and it is *already* reachable in this scene from the Hangar Deck's ROSTER & GEAR console. A second door to the same panel in a second room is two entrances to one screen, not a finished room. So the bench owns layer two, the Carrier Upgrade Modules, which had never had a home anywhere in the game. The room note now points at the Hangar Deck for the other half rather than apologising.

**Three of seven ship buyable, and each one's effect is genuinely wired:**

| Module | Cost | Effect | Wired to |
|---|---|---|---|
| Fabrication Bay Expansion | 160 | +2 spare-part cap for every Fabricator mek | `fabricatorMaxSpareParts` |
| Combat Medic Cadre | 120 | Discretionary Munti recruits arrive at F, not G | `generatePilot` |
| Vital Signs Uplink | 90 | Battle HUD warns when your last Munti drops below 40% | `Battle.ts` `drawHud` |

Fabrication Bay **stacks** with the Fabricator bay rather than replacing it (both were paid for, from the same pool, at separate prices), and is deliberately *not* gated on the bay being built first — nothing in the design says so, and a silent dependency that eats 160 points is what a player would rightly call a bug. Combat Medic is Munti-only, exactly as worded; widening it to every class would quietly make it the strongest module in the game.

**The other four are shown in the panel, greyed, each with its real reason** — not hidden, so the room reads as "four of these are waiting on something" rather than pretending the design is three modules long:

- **Forward Battery** — needs a redesign; Fire Support has no cooldown to cut (see below).
- **Runic Integration Line** — waiting on Heirlooms.
- **Auxiliary Berths** — needs the deploy-slot schedule and a modelled Providence defence stat.
- **Reserve Muster** — `recruitDiscretionary` already returns its pilot immediately, so as written this module would buy nothing.

Charging company points for a module that does nothing is worse than not shipping it. Costs are **placeholders**, anchored to `DISCRETIONARY_RECRUIT_COST` and the bay-build range so they're at least in scale with each other — same flagged footing as every other shipped social/economy number, and the same reasoning: `combat_sim.py` validates Bloom archetype stats and maps, not company-pool pricing.

## Flagged back, not built

### Weapon Battery — a decision, not a coding job

Forward Battery was specced as *"reduce cooldown by 25%"*, but Fire Support has no cooldown — it's a flat 2-charges-per-mission pool. `Bloom_Wars_Weapons_Bay_And_Fabricator_Delivery_v1.md` already caught this: it *"doesn't have anything to attach to under this implementation"* and needs a redesign conversation. Three options were put to Maxime: **(a)** +1 baseline charge, **(b)** blast radius 1 → 2 (recommended — charges are already the scarcity lever, this adds a second axis), **(c)** cut the Weapons Bay bonus charge's real 3-turn cooldown to 1. **Awaiting his call.**

### Heirloom — week-scale, already booked, and one real trap

Not built. It's 10 Heirlooms, 8 with named aristocrat pilots, a 3-from-8 recruitment shortlist, and 3 ability slots each rankable 1–5 — a build, not a feature — and the EA plan already books it for Week 2 (7–13 Sep).

**The S-tier risk the Heirloom plan flagged was investigated, and it is real.** `Tier` is `"G" | "F" | "E" | "D" | "C" | "B" | "A"` in `data/types.ts`, and ~5 places key off it. The trap is `TIER_ORDER` in `campaignEconomy.ts`: it drives the **purchase ladder**, and the shop's at-max-tier check is literally `index === TIER_ORDER.length - 1`. Append `"S"` naively and **every pilot in the game can buy their way to S-tier with points**, detonating the "aristocrat mech, 3 per campaign, 1 fielded at a time" exclusivity the whole design rests on. S must be **granted, never purchasable** — a separate constant from the ladder. Also worth catching in the same pass: `ambientLines.ts` returns the "command" register only for tiers `B`/`A`, so an S-tier pilot would silently fall through to the wrong voice.

Cheap to do right up front, expensive to discover after the content exists.

## Verification

All four checks clean in the cloud sandbox (no `device_bash` this session, so on a staged mirror):

- `npx tsc --noEmit` — clean
- `npx eslint src/` — clean
- `npx vitest run` — **68 files, 1432 tests passed**, up from 66/1396, zero regressions
- `npm run build` — clean production build, 83 modules

**One thing the test run did not catch and the build did:** `carrierModules.test.ts` initially used `"engineer"` as a `MekTrack`, which isn't one. Vitest passed it (it doesn't typecheck); `npm run build`'s own `tsc` pass failed it. Worth remembering — a green vitest run is not a typecheck, and running the build is what closes that gap.

All 9 changed/new files committed to the repo via the device bridge with fresh mtime guards, confirmed afterward by a second listing (including the new `src/scenes/ui/` folder).

**New:** `engine/hoverTipLayout.ts`, `scenes/ui/HoverTip.ts`, `data/carrierModules.ts`, `engine/__tests__/hoverTipLayout.test.ts`, `engine/__tests__/carrierModules.test.ts`
**Modified:** `scenes/Battle.ts`, `scenes/Hub.ts`, `engine/campaignState.ts`, `engine/campaignEconomy.ts`

## Honest gaps

- **No live-browser check.** No dev server reachable from this sandbox. Four green checks is strong evidence, not a playtest. The tip's monospace `CHAR_W = 6.6` in particular is a measured constant, not a rendered measurement — if a tip box looks a few pixels too wide or narrow, that's the number to adjust.
- **The three module costs are unvalidated placeholders**, flagged in the file itself.
- **`Battle.ts` and `Hub.ts` remain untestable** in this suite (Phaser at module scope). Everything wired into them this pass was verified by reading; the extractable math went into `hoverTipLayout.ts` specifically so it wouldn't have to be.
- **"Give each room a function" is partly done, not done.** The Workshop got one. Berths and the Spar Room turned out to already *have* theirs (recruitment/romance and breakdown resolution respectively — both shipped, see the Social Sim Roadmap). That leaves **the Vault** (Heirloom dedication — blocked on Heirlooms, and already booked for EA Week 2) and **CIC** (fire-support config + Energy allocation — explicitly cut from EA, and its "fire-support configuration" job is a named slot with no design behind it: **no doc anywhere says what is being configured**). Neither was built, and neither should be until the decisions above land.

## Docs this changes

- `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §3's seven-module table is now partly implemented — worth a status line noting three are live, one is orphaned, three are blocked.
- The Master Index's Hub section still describes the Workshop as a stub.
- `Bloom_Wars_First_Game_Dev_Feature_Gap_Report_1Sep2026.md` C4 can be closed (both halves now built). **C9 ("controller / key rebinding — absent, defer") is unchanged and still correct** — this pass added bindings, not a rebinding UI.
