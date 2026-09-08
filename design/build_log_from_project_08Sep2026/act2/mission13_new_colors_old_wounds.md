# Mission 13 — New Colors, Old Wounds

**Objective:** eliminate_all (turn 12). **Map:** open muster ground, 26×14. **Enemy:** 12 Crawlmass + 3 Splitfang.

First mission of Act II — the Second Lance's real debut in the field. A real bug found before this mission could even sim-run: `pilotRegistry.ts`'s static merge (the lookup any no-campaign-save launch resolves through) had never picked up the Second Lance roster, even though `campaignState.ts`'s own `integrateSecondLance()` was correct — same shape of gap as the original Warden Company merge and the `ALL_HOSTILE_MECHS` merge before it. Fixed by adding both arrays to `PILOT_INDEX`/`MEK_INDEX`.

Tuning took two passes: a first guess scaled roughly off Mission 1's own doubling (14 Crawlmass + 6 Splitfang) was a hard 0/8, full wipes. Cut back to the shipped 12+3 and it's clean.

**Result:** 14/14 across two batches.

Full narrative: archive, "batch 2 built — missions 13-16."
