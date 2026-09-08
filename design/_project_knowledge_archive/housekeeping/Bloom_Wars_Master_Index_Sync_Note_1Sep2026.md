# Master Index sync note — 1 September 2026

**What this is.** `claude_Bloom_Wars_Master_Index.md` is stale — last updated 29 Aug 2026, before three major chunks of work landed. This note is the fast-orientation patch the EA Launch Plan's own closing section asked for ("worth doing on the next pass... rather than a full rewrite, given its size and the risk of dropping something"). Read this note first, then the Master Index for deep history, rather than trusting the Master Index's own "READ THIS FIRST" section as current.

**Written during a "schooltime" unattended check-in** — no code or device changes made. Given the multiple documented cases this week of two concurrent Claude sessions colliding on the same repo (the `index.ts` overwrite, the mid-session `EA_Launch_Plan` edit, the Mission 21 count getting clobbered by a find/replace meant for Mission 25), and that another session appears to have been actively driving the House Amaranth build through this morning, this pass deliberately stayed in the Project docs only — no `device_stage_files`/`device_commit_files`, no sim runs, nothing touching `F:\The Bloom wars. Code project`. If you're a future session picking this up: same caution applies until Maxime confirms only one session is active.

## The real current-state trust order (supersedes the Master Index's own list for anything after 29 Aug)

1. **`claude/Bloom_Wars_EA_Launch_Plan_31Aug2026.md`** — the actual locked plan. EA ships **Warden Company only** (the campaign the Master Index still calls "The Amaranth Reckoning" — same 36-mission campaign, apparently now going by "Warden Company" in newer docs; worth a one-line confirm with Maxime that these are the same thing and not a fork). itch.io only, Electron-packaged download, 8-week plan, launch target 26 Oct 2026.
2. **`claude/Consolidated_Build_Plan_Progress.md`** — the execution log. This is where almost everything below is documented in full.
3. **The House Amaranth build-log addendums** (`claude/Bloom_Wars_Build_Log_Addendum_HouseAmaranth_Mission*_*.md`, 20 through 36) — mission-by-mission detail for the second campaign.

## What's actually true right now that the Master Index doesn't reflect

- **The EA scope call is locked (31 Aug):** Warden Company ships for Early Access; House Amaranth is explicitly deferred as the first post-launch content update. The Master Index has no mention of this decision at all.
- **House Amaranth's full 36-mission campaign (Acts I–III) is now built, mapped, and sim-tuned — as of this morning (1 Sep).** All 36 missions exist, validated through `maps_house_amaranth.py`, tuned to a **≤15% AI win-rate ceiling** (a stricter rule than Warden's own, set by Maxime 31 Aug, explicitly *not* retroactive to Missions 1–19). Test suite at 1192/1192.
- **Critical: none of Missions 22–36 have been committed to the device.** Per Maxime's own explicit instruction ("dont update the computer until I sai so"), that entire batch is sandbox-only in whatever session built it, staged for his review. **This is the next real decision waiting on him** — not an oversight, not something to push through on his behalf.
- **Still genuinely unbuilt for House Amaranth:** its own Hub (`HubHouseAmaranth.ts` doesn't exist — no estate room set, no roster NPCs, no shop economy, no seneschal), mission-select/Hub-entry wiring, and a proposed-but-not-approved Missions 1–11 enemy-variety reform (`claude/Bloom_Wars_HouseAmaranth_Act1_EnemyVariety_Reform_Plan_v1.md` — proposal only, per this project's own "audit-then-decide" discipline).
- **Player AI hardening continued past what the Master Index has on record:** defensive focus fire shipped (round 4, 31 Aug); a fourth commander-protection attempt (gang-up retreat) tried and reverted — four total reverted attempts now point at the same real constraint (anything that changes the commander's in-the-moment behavior trades one mission's win for another's loss; a change scoped to "which in-range target do I already shoot" composes cleanly, a change to movement/retreat doesn't).
- **A real Playwright verification harness now exists** (`tools/verify/`), used once so far on the Hub NPC roaming/door-cluster risk (confirmed clean over two live runs). Most of the "logic-traced, not click-tested" backlog from the earlier Hub/Battle passes is still open — see Consolidated_Build_Plan_Progress.md's own "Cross-cutting still-open item" section for the full list.
- **A new standing sitrep rule, 31 Aug:** report after every real checkpoint, *except* when Maxime says "schooltime" — same meaning as this project's established "going to sleep"/"going to school" precedent: work unattended, no per-action sitrep, review later. (This check-in is exactly that case.)

## One naming thing worth a direct confirm with Maxime

The Master Index still calls the completed 36-mission campaign "The Amaranth Reckoning." The 31 Aug/1 Sep docs call it "Warden Company." Everything reads as the same campaign under a later name, not two different things, but nobody has said so explicitly — worth a one-line check before the Master Index gets its real rewrite, so the rewrite doesn't accidentally merge two things that were actually meant to stay separate.

## Suggested next Master Index pass (not done here, flagged per this project's own scope-growth rule)

A real rewrite of the Master Index's "READ THIS FIRST" section is now overdue — it would need to fold in this note, the EA Launch Plan, and the House Amaranth campaign's existence as a second full campaign. Given the doc's size, that's worth doing as its own deliberate pass (ideally by whichever session Maxime is actively driving code with, so it can verify claims against the live repo state at the same time), not blindly from Project docs alone.
