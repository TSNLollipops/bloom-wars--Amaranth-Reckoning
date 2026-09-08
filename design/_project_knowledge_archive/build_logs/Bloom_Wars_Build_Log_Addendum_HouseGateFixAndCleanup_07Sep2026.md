# Build Log Addendum — House Amaranth gate fix + Codex cleanup (7 Sep 2026, late)

**Status: shipped to `F:\The Bloom wars. Code project`.**

## 1. The Archive was permanently locked on House Amaranth saves — my bug, shipped tonight

`scenes/Archive.ts` computed campaign progress with `highestWardenMissionIndexReached`. That helper searches `WARDEN_MISSION_ORDER` only. Warden ids are `mission_amaranth_N`; House ids are `mission_house_amaranth_N`, which appear nowhere in that list — so it hit its own unrecognized-id branch and returned **-1 for every House mission, at every point in the campaign**.

Read as progress, that is a House archive with nothing ever unlocked. Thirty-eight House-only entries and every dual gate, shut for the whole game. No crash, no error, no warning — the console just looked like a very early save forever.

`data/missionBriefing.ts`'s own file header warned about exactly this, in 1 Sep's own words: *"wardenMissionIndex / the codex gating stay Warden-scoped."* That was true and fine when the codex only carried Warden lore. I reused the helper anyway, hours after shipping a codex that gates both campaigns.

**The lesson is not "read comments."** It is that a helper with a scope named in it — `warden`, right there in the function name — is telling you what it will not do, and the moment your feature covers a second case, that name is a bug report addressed to you.

**Fix:** `highestMissionIndexReached(facility, echo)` in `data/missionBriefing.ts`, reading `HOUSE_AMARANTH_MISSION_ORDER` (which already existed for `nextHouseAmaranthMission`) or `WARDEN_MISSION_ORDER`. Same under-unlock-on-unknown-id behaviour as before. The Warden-only version stays for its existing callers.

**Verified live** on a House save 20 missions in: rose tint, `HOUSE AMARANTH — RECORDS`, `MISSIONS RESOLVED — 20`, Research showing 10 entries including the House-only ward-crop papers, Drift Tolerance at revision 2/3, Relay Failure correctly still sealed until mission 26.

**11 new tests** in `data/__tests__/archiveGatingBothCampaigns.test.ts`, including the one that pins the bug itself (`highestWardenMissionIndexReached` returns -1 for a House id while the new helper returns 20) and one asserting the two campaigns' mission ids are disjoint, which is *why* it matters. Plus, per console: a finished campaign unlocks everything on that console; progress opens strictly more than a fresh save; no gate sits past its own campaign's last mission.

## 2. The dead Codex renderers are gone

The cleanup deferred at the end of the last pass, done as its own change with the suite run either side of it. Baseline before: 2569 tests passing. After: 2569 tests passing.

Removed from `scenes/Codex.ts`: six switch cases, six unreachable render methods, `renderNoSavePlaceholder`, `liveStatusFor`, `hasWardenSave`, the `highestMissionIndexReached` getter, nine imports from `data/codex.ts`, the `CampaignState`/`CampaignPilotEntry` imports, the unused `campaignState` field, and `SECTIONS.needsSave` — which every remaining row set to `false` and nothing read any more.

**966 lines → 770.** The compiler drove the whole thing: delete the methods, and `noUnusedLocals` names the next twelve things that just died. That is what a strict TypeScript config is for — it turns "is this still needed?" from a judgement call into a build error.

`init()` still accepts `campaignState` and ignores it, with a comment saying so, rather than chasing the parameter through two call sites for nothing.

**Verified with no save loaded at all** — the exact case the deleted placeholder used to serve. Nine sections, 27 renders walked (every section × three page indices), zero console errors.

## 3. Bray's "Deadfall" — the collision is real, and it is Maxime's call

Checked properly rather than assumed. Findings:

- The Heirloom's `displayName` is **"Ichigeki"**. Every `deadfall_strike` / `canDeadfallStrike` is a code identifier, invisible to players.
- **But** `data/heirlooms.ts:662` gives it `epithet: "Deadfall"`, and `scenes/Hub.ts:4486` renders `` `${displayName}, ${epithet}` `` — so the Vault shows **"Ichigeki, Deadfall"**.
- `deadfall` is `track: "proper"`, so it is in `RECRUITABLE_HEIRLOOM_IDS` and any campaign's shortlist can offer it.
- Bray is `S.Sgt. Callum Bray — "Deadfall"` on the House Amaranth roster.

So a House player can have a pilot callsigned Deadfall and an Heirloom titled "Ichigeki, Deadfall" in the same save. Low severity, real.

**Not changed — this is a naming call, not a code one.** Costs, for whichever way it goes:

- Renaming **Bray's callsign**: two strings, `data/campaignHouseAmaranth.ts:79` and `data/archive.ts:1270`. Cheapest.
- Renaming **the epithet**: one string, but "Ichigeki" (一撃, *a single blow*) paired with an English epithet is clearly a deliberate construction.
- **Leaving it**: defensible. A person's callsign and a weapon's epithet are different registers, and real militaries reuse words constantly. The two never appear in the same panel.

## Gate

**Typecheck clean · eslint clean · cast-collision lint clean · 105 files / 2569 tests passing · `vite build` succeeds.**

`lint-spoiler.mjs` still skips here (`BW_RESERVED_TERM` is in a git-ignored `.env.local`). Run `npm run lint` locally.

## Still open

- Verinis voice bank slot 9 (Debrief / Campaign Shop callouts) has no lines — **content, needs Maxime's own voice, will not be written for him**
- Arangement of Content has no bespoke voice bank at all, same rule
- `data/codex.ts`'s `PERSONNEL` / `BESTIARY` / `WORLD` / `SYSTEMS` / `GLOSSARY` are now read only by their own tests. Retiring them means retiring `data/__tests__/codex.test.ts` with them; worth doing, not urgent
- Content flags still awaiting a yes: `hist_gladiator`'s optional Hiopi aside, "Warden Holdings" as a proper noun, the Osnian "bad omen" line, the Screaming paper's invented resonance
