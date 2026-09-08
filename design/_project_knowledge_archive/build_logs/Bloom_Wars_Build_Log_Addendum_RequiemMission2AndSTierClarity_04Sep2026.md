# Build Log Addendum — Requiem Mission-2 Early-Equip & S-Tier Clarity (4 Sep 2026)

Both fixes Maxime approved ("Yes, fix both now") are built, tested, and on his machine. Riot Drum and Maser Lance (the Tank weapon branches from the same chat note) are **not** part of this — deliberately deferred, per his own scoping, not started.

## 1. Bosk carries Requiem starting Mission 2

**New function:** `resolveRequiemEarlyEquip(state)` in `engine/heirlooms.ts`, right after `acquireAberration` (which it calls). One-shot in effect, but not via a new marker field — it checks `heirloomState(state).assignedPilotId.requiem` directly, so it's a no-op both on a repeat call AND after Requiem has since moved on to Rourke (Mission 12's Vault dedication).

**Wired into `scenes/Debrief.ts`**, alongside the existing Second/Third Lance one-shot blocks, on `mission.mission.id === "mission_amaranth_1"` — deliberately **not** gated on `win`. Verified first against `scenes/MapSelect.ts`: missions carry no won/locked gating at all — every mission in a campaign is always listed and launchable, in any order, any time. So Mission 1 can be replayed long after the fact, and gating this on a win would mean a save that only ever loses Mission 1 before moving on never gets Requiem — straight contradiction of "as soon as mission 2." Runs on every Mission-1 debrief instead, leaning entirely on the assignedPilotId check above to stay inert everywhere it should.

**Tests:** added a new `describe("resolveRequiemEarlyEquip...")` block to `engine/__tests__/heirlooms.test.ts` (6 cases) — plain grant, works pre-Act-II (confirming Gjallar's exception to the Act-II gate actually reaches this path), idempotent on repeat, does not claw the weapon back from Rourke after the Mission-12 transfer, the full sequence (equip → fall at 12 → transfer → replay Mission 1 → still Rourke's), and a no-throw/no-op if Bosk is somehow inactive when this runs.

**One thing this does NOT touch, worth flagging plainly:** GDD §10.3 (Mission 2 — The Real Fight) and Data Pack §11.5 both describe a `heirloomCharge: "locked" | "visible_capped" | "available"` mode meant to halve Requiem's charge rate specifically for Mission 2 ("meter becomes visible... introduced, not detonated"). That mode does not exist anywhere in `engine/mission.ts` — the charge accrual (`chargePerTenHpDealt`/`chargePerTenHpTaken`) has always been flat, with no per-mission throttle, before or after this fix. It was designed but never built. Practical consequence: from the moment this ships, Bosk's Requiem accrues and fires at full rate starting Mission 2, not the throttled "introduced, not detonated" GDD describes. This lines up with Maxime's own "usable from the start" framing, but nobody has actually confirmed that reading against the specific GDD line it contradicts — flagged back to him as its own open question, not assumed here.

## 2. Shop clarity: why S tier is greyed out

**`scenes/shop/ShopPanel.ts`**, the tier-upgrade button (`drawPilotRow`): a pilot capped at A with no Heirloom used to show the exact same "TIER MAXED" label a pilot at any tier shows when they can't afford the next rung yet — reading as "come back with more points" when the real reason is permanent (S is granted by an Heirloom, never purchasable, per `campaignEconomy.ts`'s own existing refusal text). Changed the label, for that specific case only, to `"MAXED - S COMES FROM AN HEIRLOOM"`.

**Real constraint worth being upfront about:** this card has zero free pixels anywhere near that button — two prior overlap bugs are already on record in this exact footprint (the branch-button clipping fix, the convert-button/label overlap fix). There was no room for a separate caption or a real hover tooltip without a small layout rework, which wasn't asked for and would have been its own scope call. The fix is the button's own label, wrapping to two lines via the existing `wordWrap` behavior `makeShopButton` already has — plain and short, not a rich explanation. If it still reads as too cryptic in play, a proper tooltip is a fair follow-up ask, distinct from this fix.

## Verification

`npx tsc --noEmit` clean. `npx eslint src` clean. `npx vitest run`: **90 test files / 2122 tests, all passing** (86 more tests than my own first baseline this session, because my sandbox mirror was missing `engine/__tests__/heirlooms.test.ts` entirely until I caught it mid-session via a full recursive listing diff against the real device — see the note below). No `npm run build` this pass: `tools/lint-spoiler.mjs`/`tools/lint-cast-collision.mjs` were never staged into this sandbox and the prebuild script depends on them; unrelated to this diff (no spoiler-adjacent or cast strings touched), so not chased down for a change this size.

**Process note, in the spirit of this project's own standing rule:** before committing anything, I ran a full recursive file listing of the real `src/` tree on Maxime's machine and diffed it byte-for-byte (filenames + sizes) against my local sandbox mirror. Found exactly one gap — the missing `heirlooms.test.ts` — nothing else. Fixed by staging that file for real and merging my new tests into it (matching its existing conventions and helper functions, e.g. `actTwoState()`) rather than leaving a duplicate, disconnected test file. This also resolves the "89 vs 90 test files" discrepancy flagged earlier this session — it was this missing file the whole time, not a real drift.

## Files changed

- `src/engine/heirlooms.ts` — new `resolveRequiemEarlyEquip` function.
- `src/scenes/Debrief.ts` — new import + one-shot call site.
- `src/scenes/shop/ShopPanel.ts` — tier-maxed label change.
- `src/engine/__tests__/heirlooms.test.ts` — new describe block, 6 tests.

All four committed to Maxime's machine and confirmed written with no conflicts.

## Open question for Maxime

Does "usable from the start" mean full charge rate from Mission 2 (what's now live, by default, since the GDD's own throttle was never built), or should the GDD's "halved" intro actually get built to match the doc? Either answer is small: leave it as-is and correct GDD §10.3's text to say so, or add the throttle for real. Not decided here.
