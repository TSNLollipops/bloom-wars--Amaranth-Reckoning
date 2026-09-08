# THE BLOOM WARS — Forgotten/Unbuilt Plans Audit, 1 September 2026

**Written 1 Sep 2026, at Maxime's own request right after the CO Check-in Gate shipped: "yeah.also look for other thing I might have forgotten. i made lots of plan."** A full pass over the project's ~225 documents, cross-checking every plan/proposal/roadmap doc's own claimed status against the actual current source files (not the docs' own claims — this project's own standing "verify against the actual current file" rule, applied here at doc-collection scale rather than to one file at a time). This is a status check, not a build — nothing here was built as part of this audit.

## Not built at all (grep-confirmed zero code)

**Character Editor** (`Bloom_Wars_Character_Editor_v1.md`) — zero code. `pilot_creator.html` is still the disconnected sandbox prototype it's always been, never wired into the real game. This is also the standing blocker on Maxime's own 27 Aug "Option B, with a path to C" decision on letting a player build a Carabil and swap them in as CO — that decision has nowhere to live in-game until the editor exists.

**Frame Systems Layer** — Option A was decided 27 Aug (see the Weapon Branch Point System's own plan doc), gated behind the not-yet-built economy sim harness. Zero code since.

**Worries System** — several open questions were resolved 28 Aug, but not even the cheapest slice has shipped. (Mission Worry, the existing shared-flag system, is a different, already-built thing — see the Hub ambient-line content section of the Master Index.)

**Calendar System** — direction locked 28 Aug as part of the shared-universe cross-project policy (see the Master Index's "Cross-project references" section). Confirmed never implemented as of the 31 Aug EA Launch Plan. **Update, 2 Sep 2026:** this shipped that evening as the real-time calendar economy (`engine/calendarClock.ts`), including named landmark days — see the Master Index's calendar section and that day's build-log addenda.

**Gladiator Mode** — scoped to a v1/v2 split, filed as a post-launch wish-list item in the Early Access triage. No logging infrastructure, no code of any kind.

**Amaranth Reckoning: The Other Side** — House Amaranth's parallel first-person storyline concept, distinct from the House Amaranth *mission campaign* (which is fully built, Acts I–III, 30 Aug–1 Sep 2026). This narrative-side companion piece is paper only, unchanged since 25 Aug.

## Partially built or parked mid-way

**Stress & Morale Trigger Proposal** — the doc's own actual named triggers (Share a Drink, minigame win/loss, Ask Out outcome, getting drunk) are still 100% unbuilt. A separate system, the Needs Counter, ended up being the real Stress/Morale writer instead — worth a look at whether the original triggers are still wanted alongside it or have been superseded in practice.

**Weapon Branch Expansion Plan** — at the time this audit was run, only 5 of the roughly 13–15 intended weapon branches had shipped (27 Aug: Impact Lance, Grinder Claw, Missiles, Rail Lance, Rapid Response). **Correction, same evening:** a concurrent session picked this exact item up and shipped Aegis Ward and Field Doctor for the Munti (`claude/Bloom_Wars_Build_Log_Addendum_AegisWard_FieldDoctorScope_01Sep2026.md`, 1204/1204 tests), so the count is now 7 shipped, with Shock Claws, Scattershot, Riot Drum, Maser Lance, Suppression Autocannon and Combat Medic still open per `claude/Bloom_Wars_Weapon_Branch_Expansion_Plan_v1.md`. One thing that audit turned up that's still true: the Missiles branch grants an ability (`abil_missile`) that `Battle.ts` never offers in its action bar — the engine verb exists and is tested, but no human can fire it. Separately, this line first said the Mission 21 (Wellroot) number was still pending at a validated `20` — that's stale: `bloom_wellroot.attackPower` shipped at 50 on 28 Aug after a full sweep (see the Master Index's priority queue). Whether the Weapon Branch Expansion Plan's own Mission 21 note refers to anything beyond that wasn't re-checked here; treat it as closed unless that doc says otherwise.

**Player AI Ability & Objective Plan** — Phases 1-2 (architecture, objective-awareness) shipped 25 Aug. Ability usage — Ambush, Interdict, Screen, Sensor Sweep, Taunt — was never automated for the test/batch AI. This is a test-harness gap, not a shipped-game gap, but it means batch validation numbers for missions where these abilities matter are incomplete.

**Antfarm Grid's real player-placement economy** (§3b/§3d/§3e/§6) — only the fixed 3-deck open floor plan and the four reserved bays (now buildable through the CO, 27 Aug) have shipped. The actual "build your own ship" pitch — tile/bay costs, footprint upgrades, starting from an empty ship, the tutorial that teaches it — is still entirely Maxime's own design call in progress, not started.

**Pilot Discharge & Roster Pressure** — a confirmed shape exists somewhere in this project's docs, but grep-confirmed zero code anywhere in the repo.

## Lower-stakes, quick mentions

**Onboarding Tutorial** — shipped fully (27 Aug). ~~except one planned piece: a pause-menu link to `HOW_TO_PLAY.html`, which doesn't exist yet~~ **Update, 1 Sep 2026 (same night this audit was written):** rather than just wiring that link, Maxime called for a full in-game Codex instead ("we are going full ham plus ultra on the game") — shipped as `src/scenes/Codex.ts`, reachable via a CODEX button on both the main menu and the in-play pause menu (`MenuOverlay.ts`). `HOW_TO_PLAY.html` still exists standalone as the source content; the Codex is a hand-typed second presentation of it, not a live read, so the two can drift if the manual's content changes without a matching Codex update. See `claude/Bloom_Wars_Build_Log_Addendum_Codex_ForgottenPlansPass1_01Sep2026.md`.

**Selling & Launch Plan's Electron packaging step** — hadn't started as of the 31 Aug EA Launch Plan. Likely tracked under that plan's own Week 4 slot, but worth confirming it's actually on someone's radar as the 26 Oct EA date approaches.

**NPC Reaction Engine** — its full formula is still design-only outside the already-shipped Gate 0 slice. Probably moot: the Worries System above (still unbuilt) is meant to supersede it, so this may not need separate attention.

**The four docx-pending edits** — GDD §6.4, GDD §12.1, Data Pack §12, Data Pack §6's `abil_repair` row — all still blocked on Maxime's own hand, unchanged since `claude/Bloom_Wars_Docx_Pending_Edits_Status_28Aug2026.md` last tracked them. Now a fifth is queued alongside them: the CO Check-in Gate's own GDD §3 mission-loop line (see the Master Index's "CO Check-In Gate" section).

## What this audit doesn't cover

This is a pass over plan/proposal/roadmap-shaped documents specifically — it doesn't re-litigate anything already tracked as "honestly still open" inside a shipped feature's own Master Index section (there are many of those, and they're already visible in place). It also doesn't second-guess anything in the Early Access triage's own "After Early Access — ongoing, no end date" bucket, since that bucket is explicitly meant to stay a living backlog rather than a punch list to clear.

## Next steps

All of this is Maxime's call on priority, not a recommendation to build any particular item next. Relayed to him in chat the same day this audit was run.
