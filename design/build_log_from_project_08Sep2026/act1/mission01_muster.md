# Mission 1 — Muster

**Objective:** eliminate_all (turn 8 = bonus target, house rule #5 — no fail line). **Map:** open border-post ground, originally 14×9. **Enemy:** originally 6 Crawlmass, doubled to 12 per Maxime's "mission 1 twice as many enemy" tuning request.

The tutorial mission. Cleared by Maxime early and enjoyed — first mission the Field Manual (`HOW_TO_PLAY.html`) was built to support while playing without art. Confirmed working exactly as intended stat-wise before any content additions: gear-tier upgrades scale attack/defense/HP/move together (checked directly against `TIERS` when Maxime asked).

**Real bugs/fixes along the way:** none specific to this mission's own data — it rode the Mission 2 engagement-vision fix, the `findFreeAdjacent` wall-awareness fix, and every squad-cohesion/terrain Player AI pass, same as every other mission.

**Tuning history:** Crawlmass 6→12 was a clean data change with no map/invariant impact, but flipped the bot's own win rate hard — this mission is genuinely noisy under the bot (~30-40% across large samples, one early read of "5-of-8" turned out to be the high end of a wide binomial spread, not the true rate). A separate spot-check late in the campaign (after Batch 2 changes elsewhere) found the bot occasionally as low as 0-10% on isolated runs — confirmed via diff that nothing touches Mission 1's own data, so this is inherent noise/an old unrevisited balance pass (the 6→12 doubling was validated against Maxime's own human play at the time, never rechecked against later bot stress-testing) rather than a regression. Not retuned — flagged, not fixed.

**Still open:** whether this mission's win rate needs a real balance pass, given it was validated against human play (not stress numbers) at the time of the 6→12 change.

Full narrative: archive, "22 Aug" opening entry, "missions 1, 2, 4 tuning pass," and the Mission-1 spot-check notes in later batches.
