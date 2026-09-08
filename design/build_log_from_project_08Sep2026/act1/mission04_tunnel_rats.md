# Mission 4 — Tunnel Rats

**Objective:** eliminate_all (turn 12 = bonus target). **Map:** rubble-walled ruin, originally 18×11, enlarged to 24×15 then again to 30×19 (+58%) across two passes. **Enemy:** 3 burrowed Undertow (fixed spawn coordinates — burrowers never use the shared `enemy_deploy` pool) + 4 Crawlmass.

First mission to field Undertow — its surface-ambush burst (`UNDERTOW_SURFACE_DAMAGE_MULT`, 1.5× on the surfacing turn) is the mission's own core teaching moment; the briefing explicitly hints at scanning for it. Maxime deliberately skipped scanning on one playthrough to see the ambush do its real job: "almost poped one of my meeps in a single hit" — checked against the formula and it landed almost exactly as designed (~82 damage vs. a Meeps' 100 HP).

Cpl. Anand's Sensor Sweep was specifically tuned around this mission — originally a flat cooldown, later converted to `SENSOR_SWEEP_CHARGES_PER_MISSION = 2` per Maxime's explicit answer ("I see double scan as two charge each mission, every mission... yes"). The sweep-radius-too-generous concern raised earlier (a radius-9 sweep reading as "turns fog of war off" on Mission 1, which has no Undertow to actually justify it) was deliberately held open until this mission — the first one with a real burrower to sweep for — rather than tuned twice.

Second map enlargement kept the ring/rubble/gaps/spawns byte-for-byte identical, shifted +2 rows uniformly — deploy-to-nearest-seam distance re-measured unchanged at 9 move points.

**Playtested positively:** "nice, simplistic mission but it isnt complicated... my team eat the bloom" with good positioning — same easy-with-good-play pattern noted elsewhere, not acted on.

Full narrative: archive, "black-screen crash fix, plus Mission 4 (Tunnel Rats) playtest" and the Sensor Sweep charges section of "the real Mission 2 fix" addendum.
