# THE BLOOM WARS — Early Access Launch Plan, 31 Aug → 26 Oct 2026

**Status: the plan, agreed with Maxime 31 Aug 2026.** Written after reconciling three sources that had drifted apart — the synced Claude.ai Project docs (current through 29 Aug), and two files sitting only in the device repo's `design/` folder that turned out to be more current: `Bloom_Wars_Hub_Early_Access_Readiness_Plan_v1.md` (30 Aug) and `Consolidated_Build_Plan_Progress.md` (31 Aug, the execution log against the 29 Aug Consolidated Build Plan). A day-by-day interactive tracker version of this plan was also published as an artifact for daily use; this doc is the canonical, indexable record of the same plan and the reasoning behind it.

## The three scope calls, made 31 Aug 2026

Asked directly, Maxime chose all three recommended options:

1. **EA ships Warden Company only.** House Amaranth — currently 19 of 36 missions built, its own Hub (`HubHouseAmaranth.ts`) not started at all — becomes the first big post-launch content update, built in the open, not squeezed into this window.
2. **Bandwidth:** evenings most nights (decisions/testing/steering) plus unattended Claude stretches (overnight, while away) kicked off with a clear backlog queued.
3. **Launch target: itch.io only.** Free browser demo + a paid Electron-packaged download, PayPal direct. Steam is explicitly deferred to after an art pass, per the existing Selling & Launch Plan's own recommendation.

## Ground truth at the start of this plan (31 Aug 2026)

Reconciled from the code and the two most-current device-only docs above, not from the synced Project docs alone, which were two days stale on several of these points:

- **Warden Company:** all 36 missions built, sim-tuned. Test suite: 1192/1192 passing.
- **The Hub:** far deeper than the original Phase-1 plan — 8 walkable rooms across 3 decks, the full verb framework (Talk, Ask Out, Share a Drink, 3 minigames, Anger Blowup, Breakdown), autonomous NPC roaming/cliques, rumor propagation, typed chat, Mek NPCs. Tiers 0–6 of the 29 Aug Consolidated Build Plan are all code-complete (Player AI class-triangle targeting, all 4 Hub collision/movement bugs, minigame room gating, roster-driven population, the Hangar panel, Ambush→stealth redesign, the enemy-variety pass). **Correction, 31 Aug 2026, from Maxime directly: he does click-test the game live as things get built** — several of the currently-open bugs (Hub NPC clustering, muster cross-deck routing) were found exactly that way, playing it himself. The real gap isn't "nothing gets tested" — it's that no single pass has yet run the full checklist together as one system, and a few of the newest slices (the concurrent session's Tier 0–2 fixes, the latest Player AI rounds) haven't specifically had his hands on them since they shipped. Worth remembering going forward so this doesn't get overstated again.
- **Still genuinely unbuilt on the Hub:** the Vault (Heirloom dedication scene, now also the Heirloom Pilot acquisition gate per Maxime's 30 Aug addition), CIC/Bridge (fire-support config, Energy allocation), the calendar/day-cost economy (a locked 25 Aug design decision that was never implemented), full Mek backstories/personality beyond a mechanical stub.
- **Art:** all 15 named pilot portraits + 4 splash images already generated and in the repo — ahead of schedule. Battle art stays placeholder geometric shapes for EA; that's an explicit, already-made decision (Stage 4 art is gated on having an artist, not on this launch).
- **Selling:** itch.io can't paywall a browser-embedded game — the real blocker is that the game has no downloadable form yet. Electron packaging is the unavoidable first step; it hasn't been started.
- **Known open bugs/balance items, not launch-blocking on their own:** Mission 10's low win rate (undiagnosed), Mission 5's tight turn limit, a dozen-plus `eliminate_all` missions pushed toward 0% by a newly-shipped enemy-roam fallback (mechanism accepted by Maxime, tuning not yet decided), Player AI commander-protection (4 attempts, Maxime's own call: "I'll do an AI pass later" — deferred).

## What ships 26 Oct

Warden Company's 36-mission campaign, hardened and verified live; the Hub as it stands today plus the Vault; HOW_TO_PLAY.html with a real Hub section; an Electron-packaged Windows download alongside the free browser demo; the itch.io page with PayPal Business connected and a price set inside Maxime's own $5–$20 ceiling; one outside playtesting round; a final naming-lock sweep.

## What's deliberately deferred, not forgotten

House Amaranth (missions 20–36 and its entire Hub); Steam; the calendar/day-cost economy (pending a Week 1 decision, recommendation: defer and record it, not build it); CIC/Bridge fire-support and Energy allocation; Mek backstories/personality past a names-only pass (also pending a Week 1 decision); the rest of the Social Sim Roadmap; a real battle-sprite art pass.

## The eight weeks

| Week | Dates | Theme |
|---|---|---|
| 1 | 31 Aug – 6 Sep | Ground Truth & Scope Lock — full whole-system verification pass, three open decisions locked (calendar economy, Vault/CIC cut line, Mek scope), cheap hardening (dev labels, Iyari collision, extract-mission briefing text) |
| 2 | 7–13 Sep | Build the Vault — dedication scene + Heirloom Pilot acquisition gate + 1-per-mission deploy cap |
| 3 | 14–20 Sep | Docs & tech debt — HOW_TO_PLAY.html Hub section, Hub.ts test coverage (stretch), balance triage (fix what's actually broken, log the rest) |
| 4 | 21–27 Sep | Electron packaging — the one step every sales path depends on; first time doing this, budget the whole week |
| 5 | 28 Sep – 4 Oct | itch.io page (copy, screenshots, trailer) + naming-lock sweep + a second full verification pass |
| 6 | 5–11 Oct | Outside playtesting round + PayPal Business setup + price lock |
| 7 | 12–18 Oct | Close out playtester feedback + first devlog post + scope freeze |
| 8 | 19–25 Oct | Final regression pass, final installer build, soft-launch on itch.io, draft the announcement |
| — | **26 Oct** | **Launch.** |

Full day-by-day task breakdown (with QUEUE/EVENING/DECISION/BUFFER tags and a checkbox tracker) lives in the published artifact — same content, meant for daily use rather than re-reading this doc every night.

## The two places this is most likely to slip

**Week 1's verification pass.** Not a "first ever" test — Maxime already click-tests as things get built. The real gap is a single pass that runs the full checklist together, plus the newest slices that haven't had his hands on them yet. If that surfaces more than expected, that's the week to re-plan around, not push through.

**Week 4's Electron packaging.** Genuinely new territory, and it's the one dependency every other selling step sits on. The weekend right after is buffer on purpose.

## Not yet done as part of this plan, worth a note for whoever picks this up next

The Master Index (`Bloom_Wars_Master_Index.md`) has not been updated to point at this plan or at the two device-only docs (`Bloom_Wars_Hub_Early_Access_Readiness_Plan_v1.md`, `Consolidated_Build_Plan_Progress.md`) that turned out to be more current than the synced Project — worth doing on the next pass through it, rather than as a full rewrite here, given its size and the risk of a full-document rewrite dropping something.
