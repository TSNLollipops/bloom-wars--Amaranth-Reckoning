# Mission 11 — The Long Walk Back

**Objective:** extract_unit (Lask). **Map:** fighting withdrawal, river crossing, 34×13 — Undertow's intended reuse home (the water/sump crossing), though Undertow itself wasn't actually placed here (a flagged miss, corrected starting Batch 3). **Enemy:** staged waves (2+2+3 Crawlmass/Splitfang).

**A real deadlock, found stress-testing:** uniform 0/8, every run an identical turn-19 timeout with Lask (the extract target) stalled a few tiles short of the exit. Root cause: only the *named* extract target ever moved toward the exit — every other unit fell through to ordinary combat logic, which works fine mid-fight but leaves idle escorts standing still once combat ends, which then boxes the target in via the squad-cohesion cap (`MAX_LEAD_FROM_ALLIES`). Fixed with a new `escort_to_exit` fallback branch — last-resort priority, so a unit with a real job still does that job first.

**Result:** escort fix alone read as a clean 8/8 on a small first sample; a larger, later re-test (26 runs, run alongside the Mission 5 investigation) landed at ~73% (19/26) — real, still a major fix from the 0/8 deadlock, just not the clean sweep first reported. Lask being both the extract target and the squad's only healer is the suspected (not fully confirmed) reason for the gap between the two numbers.

Full narrative: archive, "missions 9-12... two real Player AI bugs" (Bug 1).
