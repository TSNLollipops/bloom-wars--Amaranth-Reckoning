# Bloom Wars — Build Log Addendum: EA Launch Plan Week 1 Hardening (1 Sep 2026)

Continuing `Bloom_Wars_EA_Launch_Plan_31Aug2026.md`'s Week 1 ("Ground Truth & Scope Lock"), picked up right after Maxime confirmed the House Amaranth 36-mission campaign was synced to the device ("sync done. 36 mission done.") and chose, via direct question, to keep going on the EA Launch Plan rather than the House Amaranth build-out. The authoritative Week 1 task breakdown is the device-only doc `design/Bloom_Wars_Hub_Early_Access_Readiness_Plan_v1.md` (not synced to the claude.ai Project). This pass also picked up the two real findings the same-day Day-1 verification addendum (`claude/Bloom_Wars_Build_Log_Addendum_EALaunchPlan_Day1_Verification_01Sep2026.md`) had left open, plus the cheap-hardening items that pass explicitly left untouched.

## What shipped

**Dev-only UI cleanup (`src/scenes/Hub.ts`).** Stripped the `(PROTOTYPE)` suffix from the room title text (two call sites — initial creation and `refreshRoomVisibility()`) and the `(demo)` suffix from `favorabilityLabel()`'s returned string. Removed the "M = muster call (debug), R = test rumor (debug)" clause from the on-screen control legend. Gated the `M`/`R` debug keybinds themselves behind `import.meta.env.DEV` (Vite's standard dev/prod flag, already used elsewhere in this codebase for `main.ts`'s `window.__bwGame` hook) — a production build no longer registers them at all, and `addCapture()` only claims `M,R` in dev builds. None of this touches gameplay logic, only what ships visibly/functionally in a production build vs. a dev server.

**Iyari seat/bay-path collision — verified fixed, no code change needed.** The Day-1 addendum flagged this as "still open, untouched this pass," contradicting the Master Index's own claim that the Antfarm Grid rework (27 Aug) already fixed it incidentally. Rather than trust either doc, checked live `Hub.ts` geometry directly: Iyari's seat (`positions[2]`, resolved via `NPC_SEED.indexOf` against `NPC_SEED[2] = pilot_iyari`) sits at `(340, 462)`, roughly 140px clear of the spawn-to-bay vertical line (`(480,330)` → `(480,502)`) — well past the ~31px combined collision radius. The Master Index was right; the Day-1 addendum's claim was stale and wasn't re-verified against current geometry before being written down. **No fix shipped because none was needed** — recorded here so the Master Index doesn't get "fixed" a second time on a phantom bug.

**`builtBays`/`ReservedBayId` doc drift — identified, not a bug.** The Day-1 addendum also flagged `campaignState.builtBays` showing `"fabricator"`, which looked like a mismatch against the Master Index's claim of 4 reserved bays. Checked `engine/campaignState.ts` directly: `ReservedBayId` has had 6 values (`sensorArray`, `beaconControl`, `generator`, `restockRoom`, `weaponsBay`, `fabricator`) since a 28 Aug second slice — `fabricator` and `weaponsBay` are real, intentional, already-shipped additions, not a code bug. **The Master Index is stale on this point and needs updating** (see "Docs that need updating" below) — no code was touched.

**extract_unit briefing/dialogue mismatch (Readiness Plan §3.6) — mechanical fix, not a prose rewrite.** The 31 Aug engine fix (`tagExtractionTarget()`'s fallback-to-a-different-unit logic) solved the mechanical bug but left hand-authored briefing/dialogue text still naming the originally-configured pilot even when the objective silently transferred to someone else, across 11 missions (House Amaranth 3/5/7/11/14/17, Warden's Anand/Iyari/Lask/Solheim/Okafor missions). Rather than rewrite briefing prose across 11 missions in Maxime's own authorial voice without his input, added a one-time acknowledgment line to the mission log itself when a fallback actually occurs: `` `${originalName} wasn't in the field this run — the extraction falls to ${unit.displayName} instead.` `` (`engine/mission.ts`, inside `tagExtractionTarget()`). Two new tests added to `src/engine/__tests__/extractUnitFallback.test.ts`: one confirms the line fires and names both pilots correctly when a fallback occurs, one confirms it stays silent when the named pilot IS the one carrying the objective (no false-positive log noise). This is a deliberately low-risk stand-in for a full prose pass — flagged, not silently treated as the final word on this UX gap.

**Two of the three Week 1 decisions locked; the third flagged back to Maxime, not guessed.**
- *Calendar economy*: deferred, per the EA Launch Plan's own existing scope (Warden-only EA, House Amaranth's economy is explicitly post-launch content) — no new decision needed, just confirmed the plan already answers this.
- *Vault/CIC cut line*: Vault only ships in EA, per the same existing plan precedent.
- *Mek scope*: **left open, needs Maxime directly.** Unlike the two above, there's no existing precedent in the agreed plan to point to, and real sub-questions are unresolved: roster scope for the Mek cast, whether the Character Editor gates on it, and naming-lock sensitivity around any authored Mek names. Building this unilaterally risked exactly the kind of scope growth this project's own custom instructions say to flag before building.

## Full verification pass

No `device_bash` tool exists in this session, so the whole `src/`, `tools/`, `public/`, and root-config tree (104 additional files beyond the 3 already staged/edited — 147 total) was staged file-by-file into the cloud sandbox, installed fresh there, and run there, matching the exact methodology the same-day Day-1 pass used:

```
npm install        → clean, 148 packages, 0 vulnerabilities
npx tsc --noEmit    → clean
npx eslint .        → clean
node tools/lint-spoiler.mjs
                    → no-ops: BW_RESERVED_TERM lives in a git-ignored .env.local
                      never staged into this sandbox by design — this half of the
                      naming lock is NOT confirmed by this pass; needs a real
                      `npm run lint` on Maxime's own machine before anything ships
npx vitest run      → 58 files, 1194/1194 passing (1192 baseline + 2 new
                      extractUnitFallback.test.ts cases)
npm run build       → clean (tsc && vite build); only the pre-existing
                      >500kB chunk-size warning, unrelated to this pass
```

Three modified files (`src/scenes/Hub.ts`, `src/engine/mission.ts`, `src/engine/__tests__/extractUnitFallback.test.ts`) committed back to the device after a fresh mtime-drift check confirmed zero concurrent edits since they were staged — no rejections.

## Docs that need updating

Per this project's own "don't let the docs quietly drift" rule: `claude/Bloom_Wars_Master_Index.md` has two stale claims surfaced this pass —
1. Hub's reserved/buildable bay count (says 4, code has shipped 6 since 28 Aug: sensorArray/beaconControl/generator/restockRoom/weaponsBay/fabricator).
2. The Iyari seat/bay-path collision note, if it's phrased as still-open anywhere — it isn't; the Antfarm Grid rework already fixed it, confirmed against live geometry this pass.

Neither was edited this pass — the Master Index is large enough that a targeted, deliberate edit pass (not a drive-by fix bundled into an unrelated addendum) is the safer way to touch it, per this project's own standing caution around that document's size.

## Still open

- **Mek scope** — needs Maxime's direct call before any building starts (see above).
- **MapSelect has no button back to the Hub** — a real Day-1 finding; Maxime's own call was "we're doing this one this weekend," so deliberately not touched this pass.
- **Naming-lock (spoiler) lint** — this sandbox structurally cannot confirm it (the reserved term lives only in a git-ignored local file). A real `npm run lint` on Maxime's own machine is the only way to fully close this out before anything ships outside the sandbox.
