# Mek track effects wired — six dead fields, Stabilizer Struts, Gallcyst Graft, Crash Foam cut — 6 September 2026

Fourth Frame Systems pass of the day, and the one that turned into something else. Maxime, right after Tier 1 shipped: "build the missing thing for the weapons you said you didnt chose for me. ask question in popop." The "missing things" were the four items Tier 1's addendum had flagged as his call — Stabilizer Struts and Crash Foam Lining (unbuilt), Heartwood Graft (hidden), Runemaster burrow detection (unwired). Digging into why the first three were unbuildable found the real problem underneath: **six of the ten fields in `data/meks.ts`'s `MEK_TRACK_EFFECTS` were dead data.** GDD §6.2 and Data Pack §5 describe every one of them as shipped. Nothing in the engine read them. Three popup rounds later, all six are live, and two of the doc's systems changed shape on the way.

All 22 files are on Maxime's machine (committed with fresh mtime guards, none rejected).

## What was dead, verified against the code rather than the docs

| Field | Doc says | Reality before this pass |
| --- | --- | --- |
| `fieldwright.stationaryHeal` (15 / 8) | +15 HP at turn start if the pilot didn't move | Never read. Lask — Warden's starting Munti, Fieldwright-primary — had never been healed by it. |
| `runemaster.burrowDetection` | Sees burrowed Bloom anywhere in vision, primary only | Never read. Seismic Tap was the only passive detection, inverting the design doc's own "Tap is deliberately weaker" rule. |
| `runemaster.effectPotency` (1.5 / 1.25) | On-hit effects last longer / push further | Never read. |
| `runemaster.initiative` (1) | "Wins simultaneous-resolution ties, strikes first against an equal-move attacker" | Never read — and there is no simultaneous resolution in this engine to win ties in. |
| `fabricator.spareParts` (2 / 1) | Spend a part to redeploy a downed pilot next turn at 50% | Only the CAP was read. Parts were purchasable (40 company points) and consumed by nothing. |
| `quartermaster.shopDiscount` (0.25) | −25% on every gear-tier purchase | Never read — and a Quartermaster secondary has been purchasable (180 personal points) since 27 Aug. |

Only Armorer's four stats, Runemaster's vision, and Fieldwright's Munti-heal multiplier actually worked. The `purchaseTierUpgrade` comment even said the discount was skipped because "no mek in the current live roster carries Quartermaster anyway" — true of the starting roster, false of the shop.

**A correction to what I told Maxime in the first popup:** I named Nagori, Tourignie, Barasj and Voss as Lance A. They're Team One — the archived, dead-in-story slice in `data/meks.ts`. Warden's Lance A is Rourke (Meeps, Runemaster), Anand (Reeps, Runemaster), Lask (Munti, Fieldwright), Bosk and Iyari (Armorer). Nobody in Lance A has a Fabricator; Reyes in the recruit pool does. Re-asked with the right names before building the Runemaster half, since it changes the balance stakes from "two bench pilots" to "the commander, in every mission."

## Decisions, all Maxime's, all via popup

1. **Fieldwright stationary heal + Stabilizer Struts — build both.**
2. **Runemaster burrow detection — wire it as documented, anywhere in vision, and measure it.** Re-confirmed after the Lance A correction.
3. **Fabricator — "Its the beacon job to give in battle restock."** No mid-mission redeploy, ever. Spare parts re-pointed: **a Fabricator mek's spare part is its pilot's own Beacon crate.** When Beacon Control revives that pilot, it burns the part instead of a Restock Room crate (placement and charge rules unchanged). Crash Foam Lining, whose whole premise was the redeploy, **cut from the catalog.**
4. **Heartwood Graft → Gallcyst Graft.** Same +20 HP / −1 move, gated on Gallcyst kills. Gallcyst is the rarest Bloom that spawns in both campaigns and isn't claimed by one of the doc's future salvage systems.
5. **The three other dead fields — all three, including initiative.** Quartermaster's discount, Runemaster's potency, and an initiative rule for an engine that has no simultaneous resolution.

## What shipped

**Fieldwright stationary heal** (`engine/mission.ts`, `tickStationaryRepair`). +15 HP (primary) / +8 (secondary) at the end of each cycle for a pilot who did not move on their last turn, any tile, capped at maxHp. Runs in `environmentStep` alongside the Munti aura tick, before acid; the two stack (a stationary Fieldwright Munti in its own aura heals for both — nothing in either doc says otherwise, and the aura's "best single source" rule is about auras). `BattleUnit.movedThisTurn` (Battery Frame's boolean) became `tilesMovedThisTurn`, a count, so one field carries one fact for both rules. **Stabilizer Struts** (`support_stabilizer_struts`, 1 Draw) raises the "did not move" allowance from 0 to 1 tile; two 1-tile moves read as 2 and don't qualify. A pilot without a Fieldwright track gets nothing from Struts — the shop doesn't hide it, because buying a system your mek can't use is a legible mistake, same as Shredder Rounds on a Munti.

**Runemaster burrow detection** (`engine/units.ts` → `BattleUnit.detectsBurrowedRadius`). Primary only. Set to the unit's own vision, so Signal Booster extends it; where a pilot has Seismic Tap too, the larger wins. `engine/ai.ts`'s `isVisibleTo` didn't change — it already read the field Seismic Tap introduced.

**Runemaster effect potency** (`engine/turnManager.ts`, `scaleByPotency`). ×1.5 primary / ×1.25 secondary on the DURATION of a weapon branch's stun, pin or debuff and the DISTANCE of its knockback; never the magnitude. `Math.round`, and the consequence stated plainly because it is the whole practical effect: every shipped on-hit duration is 1 or 2 turns, so a Runemaster-primary Meeps with Shock Claws stuns for 2 turns instead of 1, Riot Drum pins for 2 and knocks back 2 tiles, Suppression's debuff runs 3; a secondary keeps every 1-turn effect at 1 and pushes the 2-turn debuff to 3 (2.5 rounds up). Flooring instead would have made +50% do nothing on three of the four shipped effects. `knockbackDestination` now walks tile by tile and stops at the last valid one, so a 2-tile push into a wall on the second step still lands the first — magnitude 1, every pre-existing knockback, is exactly the old check. Borrowed Authority's copied Bloom effect is deliberately NOT scaled (an Heirloom ability borrowing a Bloom's effect, not the pilot's own weapon) — flagged, not decided.

**Runemaster initiative** (`engine/combat.ts`, `defenderStrikesFirst`). READING, flagged as such in the code: this engine resolves sequentially — attacker's hit, then counter — so "strikes first" gets exactly one meaning. **A defender with initiative swings their counter BEFORE the incoming hit lands, whenever the attacker is not faster than them** (`defender.move + initiative > attacker.move + initiative`; the strict `>` with initiative on the defender's side is what makes an equal-move attacker lose the tie, per the doc). The counter is computed at the defender's untouched HP; if it downs the attacker, the attack never lands (damage 0, not "dodged," no cleave, no Grinder Claw heal); a surviving attacker swings at their reduced HP. Requires initiative > 0 on the defender — a faster defender with none still waits, so the whole roster without a Runemaster-primary mek is byte-identical. Reeps' "never countered at range ≥ 2" sits inside the same gate: initiative never gives the Tank reach. `resolveMechAttack` was restructured into two inner closures (primary swing, counter swing) so the pre-empt path reuses the exact formulas; the log line and the hover forecast both read in the order things happen ("the defender strikes first (initiative) for N, then hits for M" / "…the attack never lands"). Who this is live for, checked: Bloom attacks are never countered, so initiative only matters mech-vs-mech — hostile mechs in Warden, everything in PvP later. Rourke (Meeps + Runemaster) is the one Warden pilot it fires for; Anand and Solheim have the same mek but are Reeps, who never counter. House Amaranth's Vondra and Vantana (Meeps + Runemaster) get it too.

**Quartermaster discount** (`engine/campaignEconomy.ts`, `tierUpgradeCostFor`). −25% on every gear-tier purchase for a pilot whose mek carries the secondary, rounded (60→45, 90→68, 140→105, 210→158, 320→240, 500→375), read off the LIVE mek copy so a secondary bought mid-campaign counts from the next purchase. `purchaseTierUpgrade` charges it; the Shop shows the same number it will charge.

**Fabricator spare parts feed the Beacon** (`engine/mission.ts`, `beaconCrateSourceFor`). `useBeaconControl` tries the target's own spare part FIRST, then a company crate — the Fabricator pilot "brings their own crate," which keeps the company's crates for pilots who don't. With zero crates in stock the beacon still fires for a part-carrier (button lights up, target listed) and NOT for anyone else. `Mission.sparePartsSpent` tallies by mek id; `applySparePartsConsumption` decrements the campaign's live mek copies at Debrief (a decrement, not a write-back — a mek that stayed home keeps its parts). The Battle legend and the Codex's Fabricator entry and "Spare part" glossary line now say this instead of describing a redeploy that never existed. Also moved the Fieldwright Munti-heal multiplier onto the unit and off the static registry while in there — a secondary bought mid-campaign wasn't seen by `repairHealAmount` (no observable change today, since the secondary's multiplier is 1 either way; fixed for the shape).

**Gallcyst Graft** replaces Heartwood Graft in `data/frameSystems.ts` (`salvage_gallcyst_graft`, `bloom_gallcyst`, 1 kill). The hide rule for never-spawning donors stays, now with nothing shipped tripping it; `campaignCanSupplyArchetype` is exported so it stays tested.

## Balance — measured, not argued

The full 76-mission batch (`npm run sim:batch -- 100 --all-tiers --seed=5000`), before and after this pass, same seed, n=100 per cell, run on identical copies of the tree with only this pass's files differing:

| | Easy | Moderate | Hard |
| --- | --- | --- | --- |
| Warden, mean bot win rate | 18.3% → 21.7% | 46.0% → 50.0% | 79.7% → 81.8% |
| House Amaranth, mean | 41.6% → 45.2% | 52.4% → 56.1% | 67.1% → 68.4% |
| Aggregate (all 76) | 31% → 34% | 49% → 53% | 72% → 74% |

Read against Maxime's own rule (the bot isn't supposed to win; batches are to find cheesable missions): the game got a little easier across the board, about +3 to +4 points, and a handful of missions moved a lot. At n=100 a cell near 50% has a standard error around 5 points, so ±10 is noise-adjacent; ±20 and up is real.

The Undertow missions, where the Runemaster detection was expected to bite: `mission_amaranth_4` moderate **20% → 72%**, `_30` moderate 3% → 29%, `_29` hard 69% → 95%, `_26` easy 37% → 62%, `_9` easy 7% → 28%, `_7` easy/moderate +13/+11. The other three tiers-worth of Undertow cells barely moved (`_14`, `_19`, `_21` within ±7 everywhere). So the ambush mechanic is weaker where Rourke's 6-tile sight line covers the burrow, and unchanged where the map geometry never gave her the angle — it did not "die."

The bigger movers are NOT Undertow missions, which means they're the Fieldwright heal (Lask, every Warden mission; Orin/Marrin in House Amaranth) and initiative (Rourke and Vondra/Vantana against hostile mechs): `mission_house_amaranth_12` moderate **30% → 100%** and easy 54% → 80%; `mission_amaranth_18` moderate 44% → 75%; `mission_amaranth_3` easy 16% → 43%; `mission_house_amaranth_6` moderate 48% → 89%. Three cells went the other way by 20+ (`mission_amaranth_15` moderate 38% → 15%, `mission_house_amaranth_24` moderate 24% → 1%) — plausibly the bot's own positioning interacting with a pilot who now holds still to heal, or seed variance; not diagnosed. **House Amaranth 12 at 100% on moderate is a cheesable-mission flag by Maxime's own definition.** The full per-cell diff is in this session's scratch; the two raw batch outputs weren't committed.

## Verification

Full repo staged, same as Tier 1. `tsc --noEmit` clean, `eslint .` clean, `lint-cast-collision` clean, **99 test files / 2328 tests** (was 98 / 2298 — 30 new in `src/engine/__tests__/mekTracks.test.ts`: the data-to-unit mapping for all six fields, the live-mek-copy read, the heal with and without Struts including the two-1-tile-moves case, detection at the vision edge and not past it, initiative's tie rule / full-HP counter / attacker-downed-before-swinging / Reeps-never-countered / byte-identical-without-it, potency's rounding table and the stepwise knockback, the discount's price list and a real purchase, and five Beacon-with-parts cases including zero-crate stock and the Debrief decrement). `vite build` clean. `checkFramePanel.mjs` (Playwright, live Chromium) PASSED with its assertions updated for Gallcyst Graft (listed, LOCKED 0/1) and Stabilizer Struts (on the shelf).

**Six existing tests changed, each because a fixture pilot happened to carry a now-live track:** two sensor-sweep tests and one overwatch test strip the Runemaster detection off Anand/Tourignie so the sweep and the overwatch gate are what's under test; the tiers test strips it off Rourke so "nobody can see it" stays true; two Munti-regen tests now assert aura + Fieldwright heal as a sum for Barasj. Each carries a dated comment saying why.

**Not verified, plainly:** nobody has played any of this. The initiative forecast text and the Beacon legend text are string changes never seen on screen. `lint-spoiler` still needs Maxime's `.env.local` — new strings this pass: "Stabilizer Struts," "Gallcyst Graft," the initiative log/forecast lines, the Beacon legend, and the two Codex sentences.

## Flagged for Maxime

- **Initiative's reading is invented**, faithfully but invented — the GDD's "simultaneous-resolution ties" has nothing to attach to. If pre-emptive counters feel wrong in play, the whole rule is one function (`defenderStrikesFirst`).
- **Potency's rounding** doubles every 1-turn effect for a Runemaster primary. Flooring is the one-line alternative; it makes the primary's +50% meaningless on three of four shipped effects.
- **Borrowed Authority** (Simulacrum) is not scaled by potency. Should it be?
- **House Amaranth 12 moderate went to 100%.** Cheesable by your definition; the mission is yours to tune.
- **The Fieldwright heal makes Lask a self-sustaining Munti** in every Warden mission from Mission 1. That's the GDD as written, live for the first time. If Act I gets easier than you want, this is a bigger lever than the Undertow detection.
- **Spare parts now only matter if you build Beacon Control.** A Fabricator mek on a campaign that never builds the bay has a dead track again. Consistent with "it's the beacon's job," but worth knowing.
- **A Quartermaster secondary is still a 180-point purchase for a −25% discount on tier steps that sum to 1320** — bought at G it saves 330; bought at C (the last two steps, 820) it saves 205; bought at B (the last step alone, 500) it saves 125 and loses money. Pays for itself only while the pilot is still at C or below. Data, not a bug.

## Docs that need updating

- **GDD §6.2** — the Fabricator row (no redeploy; spare parts are the pilot's own Beacon crate), the Runemaster row (initiative's actual rule), and the Fieldwright row is now true. **Data Pack §5** — the same three rows. Both `.docx`, Maxime's hand; they join `Bloom_Wars_Docx_Pending_Edits_Status_28Aug2026.md`'s queue.
- **`Bloom_Wars_Beacon_Restock_Economy_v1.md` §3** — amended in place this pass (spare-part crate source).
- **`Bloom_Wars_Frame_Systems_Layer_v1.md`** — §5 status note, Crash Foam struck, Struts and Gallcyst updated, §14 items 15–17 closed, all this pass.
- **`Bloom_Wars_Mek_Workshop_And_Weapon_Progression_v1.md`** — wherever it describes the Fabricator redeploy. Not touched this pass; flagged.
- **`data/codex.ts`** — two Fabricator sentences rewritten in code, this pass.
