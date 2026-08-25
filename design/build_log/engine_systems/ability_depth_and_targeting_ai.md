# Ability Depth (Ambush/Interdict/Screen/Sensor Sweep) and Hostile Targeting AI

## Per-path ability depth (23 Aug 2026)

Every unit had exactly one verb (Attack, plus Repair on a Munti) before this — a turn was never a real decision. One new verb per path: Reeps get Sensor Sweep (later moved from a cooldown to `SENSOR_SWEEP_CHARGES_PER_MISSION = 2`, a hard per-mission budget), Meeps get Ambush (overwatch + drop out of hostile sight until their next turn), Tank gets Interdict (zero the action budget of any hostile that finishes a move adjacent to a braced Tank it can see), Munti gets Screen (extend concealment to nearby allies, once per mission).

**Screen's one real usage attempt** (25 Aug): a narrow heuristic — fire when a Munti is in a clear-bloom-relevant position, charge unspent, and a hostile can currently see it. Shipped, tested, correct — but in practice it almost never fires on Mission 3, because by the time a Munti gets spotted she's usually already moved past the position that satisfies both conditions at once. Honest null result, not a bug: the mechanism works as designed, the conditions just rarely coincide in that mission's actual flow.

## Hostile-mech Munti priority (25 Aug 2026)

Maxime: "in a mech to mech battle its kill the munties 1st." Bloom's emergent tier (Heartwood) already had board-omniscient Munti-priority; ordinary hostile mechs (House Amaranth Line Troopers, Marrow) didn't — they were always plain reflexive-tier, nearest-target-then-best-damage. New `mechReflexiveDecision`, vision-gated (unlike Heartwood's own omniscience — a mech only prioritizes a Munti it can actually see): attack a visible Munti in range immediately; move-and-attack if reachable; otherwise fall through to unmodified reflexive behavior. Bloom's own reflexive tier is deliberately untouched (no dialogue/insult capacity — only a human-piloted hostile gets this).

## The protect_asset defendZone fallback (25 Aug 2026, Batch 6 follow-up)

**The real bug, found late:** `reflexiveDecision` had always held position with nothing visible — correct, deliberate behavior for every other objective type, but on `protect_asset` maps it meant a Bloom wave that never got within vision range of a player unit just froze at spawn forever, no matter how many were added. Two mission-tuning attempts on Mission 32 (scaling counts up, adding an "undefended" flank wave) both failed to produce any ship damage at all, because the frozen units weren't the problem — nothing was moving.

**The fix:** `reflexiveDecision` and `packDecision` (both, per Maxime's call when asked) now fall back to walking toward the nearest `MapDefinition.defendZone` tile when nothing's visible, but *only* on maps that actually have one — every other objective type is unaffected. This changed Mission 32's whole pressure curve (a Bloom that kills its target now re-engages toward the dock instead of going idle) and, checked afterward, turned out to affect Mission 22 (the *first* protect_asset mission) far more dramatically — it had been quietly softlocked (ships never dying) the same way, just never caught until this fix exposed it. Both missions needed full retuning after; see their own files. New finding: protect_asset tuning is a knife-edge, not a gradient, once the AI behaves correctly.

Full narrative: archive, "mission-length pass" (23 Aug), "hostile-mech Munti priority" and "Screen gets a first, deliberately narrow heuristic" (both 25 Aug), and "Batch 6 follow-up... the real Mission 32 fix."
