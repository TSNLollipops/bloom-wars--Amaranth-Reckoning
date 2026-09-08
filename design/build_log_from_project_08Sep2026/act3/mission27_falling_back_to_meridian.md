# Mission 27 — Falling Back to Meridian

**Objective:** hold_zone. **Map:** three trench lines, framed as a fighting withdrawal (flavor over one real hold_zone objective — a deliberate scope call, not a new multi-stage-hold type). **Enemy:** staged waves.

**A real bug that almost read as a clean pass — worth telling honestly.** First draft's far-edge spawn coordinates (24-27 tiles from the hold zone) produced 15/15 WIN, every single run, at exactly turn 10, with zero combat logged in any of them. Nearly accepted three-for-three green as "done" before pulling a full log and finding zero attack lines anywhere. Root cause: `reflexiveDecision`'s vision-gated hold-position behavior (correct, deliberate elsewhere) meant hostiles spawned that far out never once entered anyone's vision and simply never moved, all mission — this mission's own hand-picked far-edge coordinates broke the assumption every prior hold_zone mission had relied on by spawning off the `enemy_deploy` pool, which sits close by construction.

**Fix:** moved actual `spawnAt` coordinates closer (x=13 for the turn-1 wave, x=17 for turn 5/7 reinforcements), left the decorative far-edge tile markers alone since nothing reads them. Re-ran: still 15/15, but now with 57 real attack/downed lines in a sample run, four pilots downed in one run and still a win — the right shape for an entrenched, well-defended line. Locked in at 15/15 deliberately, not walked back further — matches the "the line that holds" fiction, and real losses inside a "win" are real stakes even when the outcome isn't in doubt.

Full narrative: archive, "batch 5 built — missions 25-28," Mission 27's own section.
