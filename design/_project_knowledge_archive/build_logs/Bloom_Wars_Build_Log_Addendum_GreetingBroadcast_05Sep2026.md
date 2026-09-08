# Build Log Addendum — Greeting/Farewell Broadcast, 5 Sep 2026

Maxime, verbatim: "when I say hello. I want all my ant to hear it not just one."

## The bug

`Hub.ts`'s small-talk handler (`submitChat`, Chat Keyword Categories Plan v1) classified "hello"/"hi"/"hey"/etc. as `detectSmallTalk` → `"greeting"` (same for farewell keywords like "bye"), then called `nearestNpcInRange(APPROACH_RADIUS)` — the single closest ant within talk range — and showed the reaction bubble on that one ant only. Every other ant standing right there got nothing. Same single-target shape as worry-checkin/advice/banter, which is correct for those (they read as addressing one specific person) but wrong for a greeting/farewell, which reads as addressing the room.

## The fix

New `allNpcsInRange(radius)` (sibling of `nearestNpcInRange`, same `sameDeck`/radius scope, no "nearest" tracking — just collects every match). `submitChat`'s small-talk branch now special-cases `"greeting"` and `"farewell"`: it calls `allNpcsInRange(APPROACH_RADIUS)` instead of `nearestNpcInRange`, and loops `showBubble` over every ant returned, each getting their own line (`pickGreetingLine`/`pickCoGreetingLine`/`pickFarewellLine`/`pickCoFarewellLine`, same catalyst-aware picks as before, just no longer gated to one winner). Worry-checkin/advice/banter are untouched — still single-target via `nearestNpcInRange`.

No new plumbing needed: `showBubble`'s `bubbleUntil` already lives per-NPC (not a single scene-level "currently showing" flag), since ambient chatter and rumor-spread already required several NPCs bubbling independently. This was a targeting change, not a rendering one.

**Scope decision (Maxime's call):** broadcast radius is APPROACH_RADIUS (talk range), same distance the game already uses everywhere else to decide "close enough to talk" — not the whole deck, not ship-wide. Applies to both hello and bye.

## Verification

Full local `npm ci` + `typecheck`/`lint`/`test`/`build` run (not available in-chat before now — this session had real shell access, so ran all four instead of logic-tracing): `tsc --noEmit` clean, `eslint .` clean, cast-collision lint clean (33 reserved names, 11 exempted crossovers; spoiler lock itself skipped — no `BW_RESERVED_TERM` in this sandbox, expected), full suite 92/92 test files and 2196/2196 tests passing (baseline, before this edit, was identical: 92/92, 2196/2196 — confirming nothing else regressed), production build clean. No test exists yet for `allNpcsInRange`/the broadcast branch specifically — worth a real unit test if this area gets touched again.
