# Bloom Wars — Build Log Addendum: Forward Battery, S Tier, Heirloom Foundation — 2 Sep 2026

Maxime, answering the two decisions flagged earlier the same day: **"1-b"** (Forward Battery = wider blast) and **"for the heirloom thing, yeah go for it. i'm taking advance from the plan."** — Heirlooms pulled forward from EA Launch Plan Week 2 (7–13 Sep).

The Heirloom plan doc was re-read in full against the live file before anything was built, per this project's own "verify against the actual current file" rule, rather than worked from the earlier session summary.

## 1. Forward Battery — the orphan, resolved

`Bloom_Wars_Weapons_Bay_And_Fabricator_Delivery_v1.md` had killed this module outright: its spec was *"reduce cooldown by 25%"* and Fire Support has no cooldown to cut — it's a flat 2-charge-per-mission pool — so that doc asked for *"a redesign conversation first, not just a costed follow-up."* Three options were put to Maxime; he chose **(b), the wider blast**.

**Shipped:** `FORWARD_BATTERY_FIRE_SUPPORT_RADIUS = 2` — Fire Support hits a 5×5 Chebyshev box instead of 3×3. Cost 200 company points, **gated behind the Weapons Bay** (the source design always framed it as bolted onto that bay; the gate is enforced in `purchaseCarrierModule`, not the data table, since it's a rule).

Radius over charges deliberately: charges are already the scarcity lever on this ability, so more of them only turns the same decision up louder. Area changes what the ability is *for* — a 5×5 reshapes which clusters are worth a strike, giving a second axis rather than a bigger number on the first.

`Mission` now reads `builtModules` through `MissionOptions` (not a fifth positional arg — `options` is the existing extension point, and threading a fifth positional through every `new Mission(...)` would touch far more code than this earns). The radius is a **single getter** both the real resolver and the hover forecast read, and `forwardBattery.test.ts` pins that they agree — the Build Brief's step 10 names preview-vs-actual desync as "the classic desync."

Also fixed in passing: `Battle.ts` called `loadCampaignState()` twice in one constructor. Now one read.

## 2. S tier — the trap was real, and there were three of them

The Heirloom plan flagged this in the abstract: *"every doc and every source file this session actually checked only shows tiers up to A… worth a real check before this becomes code."* That check found **three live call sites** that walk `TIER_ORDER` by index, each of which would have broken differently on an S-tier pilot, and **none of which would have crashed**:

| Site | What would have happened |
|---|---|
| `purchaseTierUpgrade` | `indexOf("S")` is `-1`, so the at-max check passes, the cost lookup returns `undefined`, and `TIER_ORDER[-1 + 1]` is `"G"` — an Heirloom pilot **silently demoted to G, for free** |
| `purchaseWeaponBranch` | `-1` is below every gate index, so an S-tier pilot is **refused every weapon branch in the game** and told they "need gear tier D+" while standing at S |
| `ShopPanel` | Both of the above again in the UI, offering an Heirloom pilot an **"UPGRADE → G"** button |

The fix is the one flagged in advance: **S is a member of the `Tier` type and deliberately NOT a member of `TIER_ORDER`.** `TIER_ORDER` *is* the purchase ladder, so excluding S from it is what makes S ungrantable-by-purchase. All three sites now check S explicitly rather than relying on index arithmetic, with the reasoning written at each.

Two more consequences found by following the change outward (the Cross-Project Writer Note's own "check what's sitting immediately around it" discipline):

- **`stageFromTier` returned `"blooded"` for S** — an Heirloom pilot, the most senior thing on the roster, would have spoken in a mid-career register. Silent drift, exactly what adding a rung to an enum causes. Fixed.
- **`tierPipCount` needed nothing.** It derives its order from `Object.keys(TIERS)`, and its own 23 Aug comment promised exactly this: *"a future tier added to TIERS can't silently drift out of sync with the pip count."* That design paid off — S got 7 pips for free. Worth recording as a case where the earlier author's caution was correct.

`TIERS.S = { attack: 149, defense: 140, hp: 140, move: 2 }` — **placeholder**, continuing the ladder's own step sizes (+9/+8/+10, one step past A's own increments) rather than inventing a jump. Move deliberately stays at 2; another +1 would put an Heirloom two full tiles ahead of every A-tier pilot, a bigger battlefield change than a tier bump should carry alone. **Not sim-validated, and this one genuinely wants a `combat_sim.py` pass** before any Heirloom ability reaches combat — unlike the economy placeholders, it's a direct player-power number.

## 3. Heirloom foundation

**`data/heirlooms.ts`** — all ten, transcribed from the plan doc: two aberrations (Requiem, The Stolen Seal — no aristocrat, no recruitment) and eight proper Heirlooms with their named pilots, houses, hooks, frame flavor, and all three abilities each with rank-1 text, rank-5 escalation and cooldown. Requiem deliberately keeps its **single** shared-meter ability rather than being retrofitted into three slots (plan §6.3 leans that way, and it's shipped sim-validated content this pass has no mandate to touch).

**`engine/heirlooms.ts`** — the rules, enforced in the engine rather than by whatever UI calls in:

- **Company points recruit; personal points rank up.** *"company, for heirloom."*
- **Three recruits per campaign, ever.** Escalating cost **250 / 400 / 600** — **placeholder**, and the doc's §6.2 explicitly leaves this open. Escalating rather than flat because company income grows over a campaign, so a flat price makes picks 2 and 3 strictly easier decisions than pick 1, quietly undoing the scarcity the 3-of-8 budget exists to create.
- **One fielded at a time**, enforced by *replacement* rather than refusal — swapping shouldn't require unfielding first. The benched id is returned so a caller can say what happened.
- **Act II onward**, read from `rourkeRank` rather than a mission counter: the rank ladder already *is* the act ladder (`integrateSecondLance` promotes at Mission 12, the Act I/II boundary), so the gate can't drift from the promotion that defines the act, and no new state needs migrating into old saves.
- **Shortlist** of 3, Fisher-Yates on a copy, deterministic under a seeded rng. Declined candidates resurface — confirmed directly in the doc, and tested by proving every candidate stays reachable across 300 rolls.
- Recruiting deliberately does **not** auto-field. Silently benching whatever was out isn't the player's decision to have made for them.

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint src/` — clean
- `npx vitest run` — **70 files, 1483 tests**, up from 68/1432, zero regressions
- `npm run build` — clean production build
- `npm run sim` — harness runs clean

**One pre-existing test failed honestly and was rewritten, not silenced.** `tierPipCount.test.ts` asserted *"A, the top tier, draws one pip per step above G"* against `Object.keys(TIERS).length - 1`. Both halves stopped being true the moment a rung was added above A. It was restated to protect what it was actually for — the top of the table, whatever that is, gets the most pips — rather than pinning `"A"` harder.

**A test of mine was also caught passing vacuously.** The first draft of the S-tier weapon-branch test used a made-up branch id, so *both* the A-tier and S-tier calls failed identically with "unknown branch" and the assertion that they matched proved nothing. Rewritten to use a real branch on the pilot's real path, and to assert the A-tier case genuinely **succeeds** — which is what stops the comparison being vacuous a second time.

Committed to the repo via the device bridge with fresh mtime guards.

**New:** `data/heirlooms.ts`, `engine/heirlooms.ts`, `engine/__tests__/heirlooms.test.ts`, `engine/__tests__/forwardBattery.test.ts`
**Modified:** `data/carrierModules.ts`, `data/types.ts`, `data/combatTables.ts`, `data/crewBanterSlots.ts`, `data/ambientLines.ts`, `engine/campaignEconomy.ts`, `engine/campaignState.ts`, `engine/mission.ts`, `scenes/Battle.ts`, `scenes/shop/ShopPanel.ts`, `engine/__tests__/tierPipCount.test.ts`

## Honest gaps — what "Heirlooms are in" does and does not mean

**The abilities are not implemented in combat.** Nothing in `engine/mission.ts` reads an Heirloom ability and no action bar offers one. That is deliberate and is the real state of this pass: ~30 distinct abilities, several needing genuinely new engine mechanics (burning tiles that damage both sides, a unit that cannot drop below 1 HP with deferred damage landing later, a move-through-and-strike line), are a separate build from the economy shipped here. Recording the kits as real typed data now means that build is transcription rather than re-derivation.

**No UI.** No Vault room, no shortlist cards, no ability-rank purchase screen, no three-cooldown readout. The engine functions exist and are tested; nothing calls them from a scene yet.

**No aristocrat pilots are generated.** `HeirloomCampaignState.assignedPilotId` exists and is unused — recruiting records the Heirloom, but doesn't yet mint the aristocrat as a `PilotRecord` on the roster at S tier. That's the natural next step and the first place the S-tier work above actually gets exercised end to end.

**Still open, from the plan's own §6 and unchanged by this pass:**

1. Shortlist cadence within Acts II–III (the doc's own proposal was never confirmed).
2. Recruitment cost — shipped as a flagged placeholder.
3. Whether Requiem eventually retrofits to three slots.
4. The Meeps 2 / Tank 1 / Reeps 2 / Munti 1 / Any 2 distribution leans light on Tank and Munti.
5. Whether the other seven proper Heirlooms get story hooks like Salt the Root's Mission 28 tie-in.

**Also unchanged:** the `Runic Integration Line` carrier module stays locked in the Workshop with reason "Waiting on Heirlooms" — its effect gates assigning a *salvaged* Heirloom, which needs the combat/assignment layer above, not just the pool.

## Docs this changes

- `Bloom_Wars_Heirloom_Weapons_Plan_v1.md` §1a's S-tier "verify before you build" flag is now **answered** — three real trap sites found and fixed; worth recording in that doc.
- The same doc's §6.2 (recruitment cost) now has a shipped placeholder rather than nothing.
- `Bloom_Wars_Weapons_Bay_And_Fabricator_Delivery_v1.md`'s open question 2 (Forward Battery: redesign, retire, or hold) is **closed** — redesigned as a radius widener.
- `Bloom_Wars_EA_Launch_Plan_31Aug2026.md` Week 2 assumed Heirlooms started from nothing; the foundation now exists ahead of schedule.
