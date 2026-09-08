# Bloom Wars — Build Log Addendum: The Houses Compare Notes (House Standing) — 2 Sep 2026

*Follows directly on `Bloom_Wars_Build_Log_Addendum_AristocratMinting_HeirloomNaming_02Sep2026.md`, later the same day. That doc closed with a flag rather than a build: the Heirloom recall happens in total silence. Offered a cheap version (one hot topic) and a nastier one (the house's reaction varying by how the pilot died), Maxime picked* **"nastier solution."** *Then, before anything was built, he corrected the premise of it in one line:* **"die only count if there no restock."**

## 0. The correction, and why it made the design better rather than smaller

The nastier version as pitched assumed three causes of death to key off — lost holding a line, lost on a botched extraction, left behind. Maxime's line killed all three, and checking the live engine confirmed he was simply right about his own game: `evaluatePermadeathCheck` (`engine/campaignState.ts`) has **exactly one** branch that returns a permanent loss, *"no living Munti remains on this side,"* and every other downing is a restock.

So cause of death is a **constant** in this game. It carries no information at all, and a system keyed to it would have been three flavors of the same fact.

What actually varies is **the arrangement the company had in place when it happened**. That turns out to be the better axis on two counts. It is composed entirely of player decisions rather than dice, which is the only kind of thing a grieving family could reasonably hold someone to account for. And every signal it needs was already sitting in the `Mission` object, unread.

**Four signals, all of them chosen by Maxime rather than picked from a recommendation:**

| Signal | Read from | Why a house cares |
|---|---|---|
| **You launched thin** | `muntisDeployed` at deploy | `canLaunchMission` floors the squad at one Munti, so one is legal — and the thinnest bet the rules allow. A house can read a manifest. |
| **What you got for it** | `mission.outcome` at Debrief | A company can lose someone and still take the objective. "Your company took the site" and "your company took nothing" are different letters. |
| **How long they were alone** | turn of the last Munti's fall vs theirs | One turn is a fight going wrong. Four is a company that kept pushing while somebody's heir was out there with nobody coming. |
| **They WERE the Munti** | `unit.path` at the downing | The Last Word is a Munti Heirloom. Charged only on top of a thin manifest — an aristocrat Munti with a second Munti on the board is a bad turn; the *only* Munti was made the company's whole lifeline before a shot was fired. |

Asked how hard it should bite, he took the hardest option offered: **full teeth, same pass.**

## 1. The one place this project deliberately stores instead of deriving

Worth recording as a principle rather than a footnote, because it looks like a violation of this repo's own strongest architectural habit and isn't.

The standing rule here is *derive, never store* — `isReturnedHome` asks the roster instead of keeping a flag, a Mek's retirement is read off its pilot's status, and both choices have already paid for themselves. The rule holds **when the source of truth outlives the question.**

Death context is the case where it doesn't. The `Mission` object that knows how the company was standing is torn down at the end of the debrief. Ask an hour later and there is nobody left to ask. So the general form of the rule is:

> **Derive when the source of truth outlives the question. Store when the event that answers it is the thing that destroys its own source.**

Written once, at one call site, never updated. Everything downstream — including every house's opinion — is derived off it as usual.

## 2. What shipped

**`Mission.permanentLosses` widened from `{ pilotId, reason }` to a real `PermanentLossRecord`** carrying `turn`, `turnsWithoutMunti`, `muntisDeployed` and `wasLastMunti`. No new plumbing: this array already crossed the mission/campaign boundary and was already applied at Debrief, so the carrier existed and only needed to carry more.

**`Mission.muntiCollapseTurn`** — latched the first time the player side has no living Munti and never moved after. Deliberately outside the `pilotId` guard and checked before the permadeath call, because by the time `handleDowned` runs `engine/combat.ts` has already set `unit.downed` — so a Munti's own downing is the moment that latches it, and a Munti who is also the last one correctly gets `turnsWithoutMunti: 0` and `wasLastMunti: true` on the same record. Pinned by its own test.

**The ordering problem I predicted before reading the code does not exist**, and that is worth stating plainly rather than quietly dropping. The worry was that permadeath resolves mid-mission while the outcome isn't known until the end. True — but `permanentLosses` is *consumed* at Debrief, where both are in hand. The engine was already shaped correctly for this.

**`applyMissionLosses` (`engine/campaignState.ts`), extracted out of `scenes/Debrief.ts`.** The status flip, the discarded personal points and the new stamp now live next to `PilotLossContext`'s own definition. Two reasons, both real: a Phaser scene is the one place in this repo nothing can unit-test, and this project's own rule is that a thing only counts once it has been run and passed. Four new tests reach it now.

**`engine/houseStanding.ts`** — a new pure module. Charges, weights, verdict. No state, no rolls, no side effects; a test pins that 50 identical calls give one answer. Verdicts are `honoured` / `aggrieved` / `estranged`.

**"No complaint" stays genuinely reachable.** A company that brought a spare Munti, won, and lost their aristocrat in the same volley that took the last medic scores zero. This is load-bearing: if every loss produced a grievance the system would be a flat tax on losing a pilot rather than a judgement about how, and one third of the content would never be seen.

**The teeth are aimed sideways, on purpose.** Houses are 1:1 with Heirlooms in this campaign, so the house whose child died has already taken back the only thing it had to take — punishing it further punishes nothing. A grievance can therefore only travel to the *other* houses, which is also the better story: the arrangement was never with one family, it was with a class, and the class compares notes.

- **aggrieved** pushes the next recruitment one rung up the 250/400/600 ladder.
- **estranged** pushes it two *and* withdraws a name from every future shortlist.
- Running off the end of the ladder is the **designed end state**, not an oversight — and it now refuses with a sentence a player should read, *"No house will put a name forward to Warden Company now,"* rather than the pre-existing developer's string *"no price is set for that pick."*

**`heirloomRecalled` hot topic** — 9 catalysts × 2 lines, plus a `{VERDICT_CLAUSE}` substitution carrying the house's temperature. Reuses `{KID_CLAUSE}`'s own established one-plain-replace-per-placeholder pattern rather than inventing a template engine, which is why three verdicts cost three clauses instead of 54 more lines. The clause text lives in `data/heirlooms.ts` with the houses; `data/hotTopics.ts` receives a plain resolved string and stays free of any campaign-state dependency, exactly as `childWithMek` is a plain boolean.

**`Hub.checkHeirloomRecall()`** — mirrors `checkMekRetirement()` exactly, one-shot, gated on a new `HubPilotSocialState.heirloomRecallAnnounced`. Driven off `heirloomHouseVerdicts` rather than `returnedHeirlooms`, which means a holder who left *without dying* produces no gossip and no grievance: a transfer is not something to blame a company for. That same skip quietly covers a save written before `lostContext` existed — missing data grants the benefit of the doubt rather than inventing anger.

## 3. Followed the change outward

Per the standing "check what's sitting immediately around it" rule, and it found one real break rather than none:

- **`telemetry.test.ts` constructed `permanentLosses` entries by hand** in two places and stopped compiling the moment the record widened. Fixed by giving both the four new facts, which is the honest fix — the fields are required precisely so every construction site has to say what happened.
- **`purchaseAbilityRank`'s recall gate** (the hole found and fixed in the morning's pass) still holds — an estranged house doesn't unfreeze the rest of the shelf.
- **`fieldHeirloom`'s house-named refusal** is unchanged and still correct.
- **Grief Catalyst** still runs its own second loop over `permanentLosses` after every flip, unaffected by the extraction.

## 4. Verification

Run against a full working copy of the repo, not by inspection.

- `npx tsc --noEmit` — clean
- `npx eslint src/` — clean
- `npx vitest run` — **71 files, 1536 tests**, up from 70 / 1511. **+25 new, zero regressions.** Baseline was captured and confirmed at 1511 *before* any edit, so the delta is real.
- `npm run sim`, `npm run sim:social`, `npm run sim:gate` — all clean
- Committed to the device with fresh mtime guards, **zero conflicts**, and confirmed afterward by a fresh directory listing showing genuinely new sizes and timestamps (`engine/mission.ts` 165,450 → 170,200; `engine/campaignState.ts` 87,484 → 91,912; `engine/heirlooms.ts` 25,074 → 30,609; `engine/houseStanding.ts` new at 4,770) rather than taking the tool's own success on faith.

**One verification honestly not done: the naming-lock lint.** `tools/lint-spoiler.mjs` still reads `BW_RESERVED_TERM` from a `.env.local` that does not exist on the machine — the finding from this morning's pass, unchanged. The new content was checked by hand and uses only house names, weapon names and ordinary field speech, but it could not be machine-checked, for exactly the reason already on record.

## 5. Honestly still open

**No UI, still, and this pass did not change that.** No Vault room, no shortlist cards, no recruit button. A player cannot recruit an Heirloom today, so they cannot lose one, so **nothing built here is reachable in play yet.** This was flagged before building and built anyway at Maxime's direction; it is second-floor work sitting above a missing staircase, and the staircase is still the single largest gap in this system.

**The lockout is real and deliberate.** One catastrophic loss early in Act II can end Heirloom recruiting for that run — the aristocrat, the company points, the weapon, the pick, *and* the remaining picks. Consistent with the campaign's own standing "im a xcom purist" line and with the "returned home" decision that preceded it. It is also the single most likely thing to want retuning after a real playtest, which is why every weight sits in named constants in `data/heirlooms.ts` rather than inline.

**Every weight is a placeholder in the same sense the 250/400/600 ladder is** — argued, not simulated. `HOUSE_CHARGE_WEIGHTS`, `HOUSE_ESTRANGED_AT`, `HOUSE_AGGRIEVED_AT`, `HOUSE_LEFT_ALONE_SEVERE_TURNS`, `HOUSE_VERDICT_COST_STEPS`, `HOUSE_VERDICT_SHORTLIST_PENALTY`. Worth a real pass once a player can reach any of it.

**House Amaranth is still unspent, and it is the sharpest thing on this board.** Nine houses are background flavor. Thessaly Amaranth's is a live campaign faction with a scripted turn in Mission 28 ("Marrow's Reckoning"). Her house reaching `estranged` is currently worth exactly what any other house's is — a cost step and a shortlist slot — when it could plausibly be worth something to that mission. Not built, not scoped, and genuinely larger than this pass: it couples a death to a scripted beat. Flagged rather than started.

## 6. Docs that need updating

1. **`Bloom_Wars_Build_Log_Addendum_AristocratMinting_HeirloomNaming_02Sep2026.md` §7** closes with "nothing surfaces the recall to the player… ~18 lines of content plus a Hub hook." That is now built, and built considerably larger than that estimate. Its closing paragraph should point here.
2. **`Bloom_Wars_Heirloom_Weapons_Plan_v1.md`** — the recruit cost ladder is no longer a pure function of picks made. It is now `picks + standing`, and it can run off the end.
3. **`Bloom_Wars_Master_Index.md`** — needs a House Standing entry, and its Heirloom section now understates what the recall does.
