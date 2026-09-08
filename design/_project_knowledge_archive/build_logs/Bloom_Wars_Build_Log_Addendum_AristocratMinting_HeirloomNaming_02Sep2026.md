# Bloom Wars — Build Log Addendum: Aristocrat Minting + the Heirloom Naming Pass — 2 Sep 2026

*Follows directly on `Bloom_Wars_Build_Log_Addendum_ForwardBattery_STier_HeirloomFoundation_02Sep2026.md`, earlier the same day. Maxime, opening the session: **"we are working on the next part of the heirloom weapons."** Asked which part, he picked **"Mint the aristocrat pilots"** over the Vault UI, combat abilities, and an S-tier sim pass. Two naming decisions landed mid-build: **"gjallar."** for Bosk's weapon, then **"same pass for the other weapon name."***

## 0. Why this piece first

The foundation pass shipped `HeirloomCampaignState.assignedPilotId` and never wrote to it. That one gap made the whole system unreachable rather than merely incomplete: with no pilot behind an Heirloom, nothing could be fielded, no ability rank could be bought against a real personal pool, and the carefully-built S-tier safety work — three genuine trap sites found and fixed that morning — was never exercised by an actual roster entry. Everything else on the Heirloom list (the Vault UI, the ~30 combat abilities) sits on top of a pilot existing.

## 1. What shipped

**`recruitHeirloom` now mints the aristocrat.** A real, active, deployable `PilotRecord` at tier **S**, under their own authored name, plus their own frame named after the Heirloom rather than after them — which is one of the two things the plan doc says recruitment actually grants. Recorded in `assignedPilotId`, so the roster and the Heirloom pool now agree on who holds what.

`mintAristocrat` deliberately mirrors `campaignState.ts`'s own `generatePilot` rather than inventing a second shape: same `state.pilots[id] = { pilot, status: "active", personalPoints: 0 }` storage, same mek-track table, same `arch_<path>_<chassis>` convention. The three things that differ are the three things actually different about an aristocrat — a real name instead of a rolled callsign, tier S instead of G, a named signature frame.

**Deterministic ids.** `pilot_heirloom_<id>` / `mek_heirloom_<id>`, not a counter. An Heirloom can only be recruited once, so these are unique by construction — which also means a save can be read by eye and `assignedPilotId` cross-checked against the roster without a lookup table.

**Not exempt from permadeath.** `exemptFromPermadeath` stays absent, same as every pilot but Rourke. An aristocrat can be lost like anyone else, and that is the point of spending a third of the campaign's Heirloom budget on one.

**Which path an "Any"-path Heirloom deploys as.** `path: null` means the Heirloom *suits* every path, not that its pilot has none — a deployed unit needs a real archetype. `recruitHeirloom` now takes `opts.path`, which is the design-true answer (the player picks at the shortlist); `HEIRLOOM_DEFAULT_PATH` is the fallback for a caller that doesn't ask, which today is every caller. Both fallbacks are argued rather than guessed, and flagged as placeholders: Delenda is an up-close anti-hive specialist whose signature is a multiplier on its own attacks, so meeps; Surtr is "a single oversized ordnance rack" laying hazard down the field, which is artillery, so reeps.

A path that **contradicts** a fixed-path Heirloom is **refused, not ignored** — quietly overriding what a caller explicitly asked for is how a UI bug becomes an unreproducible save-state bug.

**A refusal is free.** Everything that can refuse now refuses *before any state is touched*, including the two new ways it can fail (path resolution, the archetype guard). A failed recruitment never leaves company points spent on an Heirloom nobody carries.

**Vann Rethwick is centauroid, because the shipped text already said so.** Zanretsu's own `frameFlavor` reads "built low and long for a centauroid gait." Minting him bipedal would have contradicted text already in the repo, so `HeirloomPilot` gained a `chassis` field, set only where existing prose demands it.

**"Who is actually carrying this" is derived, never stored twice.** An aristocrat can die. When they do, `fielded` is deliberately left exactly as the player set it — the company still owns the artifact — and the new `fieldedHeirloom()` reads the roster's own live status to answer what is actually deployable. This is the same discipline `campaignState.ts` already argues for on Mek retirement, for the same reason: a second stored flag is one more thing that can disagree with the roster. It also avoids a real circular-import problem, since it means `campaignState.ts` never has to reach into Heirloom rules from the middle of a permadeath resolution.

`fieldHeirloom` now refuses an Heirloom whose wielder is gone, with a sentence rather than a silent no-op.

## 2. The naming pass

Ten Heirlooms, ten grand names in real languages, each chosen for what the weapon *does*: **Gjallar**, **Simulacrum**, **Skuld**, **Vindex**, **Ichigeki**, **Migawari**, **Delenda**, **Zanretsu**, **Surtr**, **Panoptes**. Full table, reasoning per name, and the rule that governs future ones: `Bloom_Wars_Heirloom_Naming_Update_2Sep2026.md` §3.

The structural half is what makes it hold together rather than turn into noise: the Heirloom and its **signature ability** share the grand name (the signature *is* the weapon firing), every **other ability stays in plain English field speech**, and the **old design-doc title is kept as an `epithet`** rather than thrown away. Four new tests pin exactly that, including one that would fail a rename which updated the weapon and forgot its signature.

## 3. Followed the change outward — and mostly found it already worked

Per this project's standing "check what's sitting immediately around it" rule, four downstream systems were checked against the live code rather than assumed. **Three needed nothing, and that's worth recording as a result rather than quietly not mentioning:**

- **Deploying an S-tier aristocrat works.** `Battle.resolveDeployRoster` already reads the live `CampaignState` and passes resolved pilot/mek records into `createPlayerUnit`'s `overrides`, specifically so a runtime-generated pilot that `pilotRegistry.findPilot()` can never see still deploys. An aristocrat rides that same path for free.
- **The Hub shows their real name.** `buildNpcs()` was fixed on 30 Aug to read `campaignState.pilots[id].pilot` directly rather than any static index — the fix for `"pilot_recruit_3"` rendering as a name tag. Same fix covers this.
- **They get a catalyst and the right dialogue register.** `catalystForPilot`'s deterministic hash fallback covers any pilot not hand-authored, and `stageFromTier("S")` was already corrected to `"command"` in the morning's pass — so an aristocrat speaks as senior, not mid-career.
- **`TransporterPad` picks them up automatically**, since it lists every `status === "active"` pilot.

## 4. Verification

- `npx tsc --noEmit` — clean
- `npx eslint src/` — clean
- `npx vitest run` — **70 files, 1504 tests**, up from 1483, zero regressions
- `npm run build` — clean production build
- `npm run sim`, `npm run sim:social`, `npm run sim:gate` — all run clean

**One pre-existing test failed honestly and was rewritten to what it was actually for.** `heirlooms.test.ts`'s "spends COMPANY points, not the pilot's personal pool" compared two positional arrays of `personalPoints`, and so incidentally pinned the roster **size** — which broke the moment recruiting started minting the pilot it is supposed to mint. Rewritten to check per-pilot by id, which is the thing it was testing, plus a new assertion that the pilot who *did* join starts with an empty pool of their own.

**21 new tests.** The strongest is the loop that recruits all eight proper Heirlooms and asserts each minted `archetypeId` actually exists in `UNIT_ARCHETYPES` — not every path × chassis pair is authored, and an unauthored combination would mint a pilot who cannot be built into a `BattleUnit`, a crash at deploy time a long way from its cause. A table-driven block also pins that all four refusal paths (Act I, no money, contradictory path, an aberration) leave points, roster, meks and `recruited` untouched.

**Committed** to the device repo with fresh mtime guards, zero conflicts, and confirmed afterward by a fresh device listing showing genuinely new sizes and timestamps (`engine/heirlooms.ts` 11,641 → 22,051 bytes) rather than taking the tool's own success on faith.

**Modified:** `data/heirlooms.ts`, `engine/heirlooms.ts`, `engine/campaignState.ts` (one constant exported, one comment), `engine/__tests__/heirlooms.test.ts`.

## 5. Findings — one real one, not introduced by this pass

**The naming-lock lint is currently enforcing nothing.** `tools/lint-spoiler.mjs` reads the reserved term from `BW_RESERVED_TERM`, expected in a git-ignored `.env.local`. **That file does not exist in the repo on Maxime's machine** — confirmed by directory listing, not assumed. So the lint prints "skipping the spoiler lock this run" and exits 0, and since it runs as `pretest` and `prebuild`, every `npm run build` and `npm run test` in recent memory has passed that gate vacuously.

Two things follow, both worth Maxime's own decision rather than a fix from here:

1. The Master Index describes the lock as *"enforced by a build-failing lint rule, not a convention, because conventions erode under prototype pressure and lint rules do not."* Today that is not true of the running build. Setting `BW_RESERVED_TERM` in `.env.local` and running `npm run lint` once would confirm the repo is actually clean — including this pass's ten new names, which could not be machine-checked from here for exactly this reason.
2. The lint checks **one** term. The project describes **two** reserved terms (the spoiler-locked one and the book's military-arc name), and the second has never been lint-enforced at all — which is notable given that a real slip on that exact term was caught by hand on 29 Aug and would not have been caught by this tool.

## 6. Honestly still open

**No UI, still.** No Vault room, no shortlist cards, no recruit button, no ability-rank purchase screen. Every engine function exists and is tested; nothing calls them from a scene. This is now the largest single gap, and it is what stands between "the system is real" and "a player can use it."

**The abilities still do nothing in combat.** Unchanged from the morning's pass. ~30 abilities, several needing genuinely new engine mechanics.

**Whether a dead aristocrat's Heirloom can be reassigned — ANSWERED THE SAME SESSION, see §7 below.**

**`TIERS.S` is still an unvalidated placeholder** (149/140/140, move 2). Flagged that morning as the one number here that is direct player power rather than economy, and genuinely wanting a `combat_sim.py` pass. It now has a real pilot standing on it, which makes the pass more urgent, not less — an S-tier unit is deployable today.

**Still placeholders, unchanged:** the 250/400/600 recruitment costs, the shortlist cadence within Acts II-III, and the two `HEIRLOOM_DEFAULT_PATH` fallbacks.

## 7. Returned home — decided and built, same session

Asked what happens to a recruited Heirloom when its aristocrat is lost, Maxime rejected all three options on the table with a better one: **"nah, recruite one are familly heirloom they get returned home."**

These are **family** heirlooms. The company never owned one — it borrowed one, through that family's own child, and when the child doesn't come back neither does the weapon. That reframes the whole arrangement: the houses are parties to a bargain, not a vending machine, and every recruitment is now a loan with a real counterparty.

**Asked separately whether the recruitment pick comes back with it, he took the hardest of three options: it does not.** Losing an aristocrat costs the pilot, the company points, the weapon, *and* one of only three chances the campaign will ever offer. Consistent with the campaign doc's own standing "im a xcom purist" line, and it's the version where fielding one actually frightens you. The known cost, accepted deliberately: lose one early in Act II and roughly a third of the Heirloom content goes unseen that run.

**Almost all of it was already true**, which is the useful part and the reason the derived-not-stored choice earlier in this pass paid for itself immediately:

- It can't be handed to a surviving pilot — nothing anywhere assigns an Heirloom to anyone but its own aristocrat at recruitment.
- It never resurfaces on a later shortlist — `rollHeirloomShortlist` excludes everything in `recruited`, which is a permanent record of picks made *ever*.
- The pick stays spent — `heirloomPicksRemaining` counts against that same permanent list, so nothing gives the slot back, and the escalating cost ladder doesn't rewind either.

So "has this gone home?" is asked, never stored: it is exactly "is the pilot who carried it still with the company," which the roster already answers. `isReturnedHome`, `heirloomsWithCompany` and `returnedHeirlooms` are the domain-language readers over that, and `isReturnedHome` deliberately distinguishes *gone home* from *was never here* — an Heirloom that was never recruited has no holder either, and should never show up in a returned list.

**One real hole the decision exposed, and it was mine.** `purchaseAbilityRank` gated only on `recruited.includes(...)` — a permanent record that still contains a recalled Heirloom. A player could have gone on spending real personal points buying rank 3 of a weapon that was no longer on the ship and could never be fielded again. Fixed, with a test, plus a companion test that a recall doesn't freeze the rest of the shelf.

`fieldHeirloom`'s refusal was also reworded to name the house rather than the absence — "House Voss recalled Skuld when Corin Ashby-Voss didn't come back," not "nobody to carry it." The company didn't misplace the weapon; it was taken back.

**Verification, re-run whole rather than assumed carried over:** tsc clean, eslint clean, **1511 tests** (up from 1504), production build clean. Committed to the device with fresh mtime guards, zero conflicts.

**Worth building next, flagged rather than started:** nothing surfaces the recall to the player. A house taking its heirloom home is a real event — arguably a more interesting one than the death that caused it, since it's the moment the arrangement shows its teeth — and right now it happens in total silence. The natural shape already exists in the codebase: a one-shot hot topic, exactly like `mekRetired` (`data/hotTopics.ts`, gated on a per-pilot announced flag in `Hub.ts`). That's ~18 lines of content plus a Hub hook, so it's real scope rather than a freebie, but it's the cheapest way to make this land as a story beat instead of a silently greyed-out button.
