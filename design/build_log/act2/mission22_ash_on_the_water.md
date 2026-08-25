# Mission 22 — Ash on the Water

**Objective:** protect_asset (turn 14) — the objective type's debut. **Map:** dock across open water, 28×14 (rebuilt once). **Enemy:** originally 14 Crawlmass + 6 Splitfang (t1) + 8 Crawlmass (t5); retuned post-AI-fix to 5 Crawlmass + 2 Splitfang + 2 Crawlmass (5/2/2).

`MapDefinition.defendZone` derived the same way `holdZone`/`exitTiles` already are. `Mission.tickAssetDamage()` deducts flat HP per hostile ending its turn in the zone; win by clearing everyone OR outlasting the turn limit with the asset standing (house rule #5's shape extended here too).

**A real map-design bug, not a balance one, in the first draft:** v1 had enemy spawns on the same landmass as the dock — hostiles never had to cross either causeway, so Providence (the asset) died by turn 8 every run, 0/3. Rebuilt (v2): squad now deploys at the dock's own western edge, enemies spawn water-separated on the far shore, funneled through one of two causeways — the actual chokepoint fiction the briefing describes. That flipped the problem to "too easy" (4/4 wins, zero asset damage ever), so counts were bumped to 14/6/8.

**Superseded same day.** That fix wasn't the real story — see Mission 32's file and `engine_systems/ability_depth_and_targeting_ai.md`: the actual cause of "ship never takes damage" was a Player AI engine bug (reflexive/pack Bloom freezing solid with nothing visible), only found and fixed while working on Mission 32. Once fixed, this mission's own counts needed a full retune too (down to 5/2/2 — turned out to be a knife-edge, not a gradient: one unit's difference flips the result completely).

**Final result:** 35/40 (~87.5%) post-fix, damage visible in nearly every run, ship-destroyed loss in ~13%.

Full narrative: archive, "batch 4 built — missions 21-24" (original build) and "Batch 6 follow-up... the real Mission 32 fix... and its fallout on Mission 22" (the actual fix).
