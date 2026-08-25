# Mission 17 — The Wellroot Uncovered

**Objective:** extract_unit (Solheim). **Map:** terraced ridge steps, 28×15. **Enemy:** 6 Crawlmass + 1 Splitfang + 1 Sporethrower (originally 3+3). **Bonus:** clear_bloom_patch.

Sporethrower's first reuse since its own Mission 7 debut — a direct, named correction of an earlier promise ("I'll pull Undertow/Sporethrower back into rotation starting with batch 2") that Batch 2 itself didn't actually keep. Named plainly as a promise not kept, then kept here.

**The tuning story that mattered most in the whole batch.** First guess (6 Crawlmass + 3 Splitfang + 3 Sporethrower) was 0/8, every run lost at turn 5 — because `extract_unit`'s loss condition is "the named target goes down, period," not a squad wipe, and Solheim (no dodge bonus) was walking into a ranged crossfire that only needed to kill *her*, not the squad. Isolating variables found the real dominant cause: Splitfang alone at 1 charge (Crawlmass still at 5) went 10/10 clean — the double-attack burst, not overall count, was the actual threat to a single soft target. Landed on 6 Crawlmass + 1 Splitfang + 1 Sporethrower, turnLimit 14→16.

**Structural lesson, worth carrying to any future extract_unit mission:** this objective type's "comfortable win rate" is far more sensitive to any single enemy's damage-per-turn than `eliminate_all`'s is — the same raw numbers landed at 14/14 clean on Mission 18's first guess.

**Result:** 12/12 after the full tuning pass.

Full narrative: archive, "batch 3 built — missions 17-20," Mission 17's own section.
