# Build Log Addendum — Mek Workshop Confinement, Rec Room Table, Boredom, Spar (30 Aug 2026)

Maxime, live, two related asks from the same batch:

> "mek need to stay in the workshop unless they are sleeping or eating."
>
> "ther eshould be a table in the rec room they can go around. assign sport
> around the table, if full the ant gonna find something else to do.
> boredom should trigger spar."

## Mek Workshop confinement

**Found a real bug while scoping this.** The generic-Mek `buildNpcs` loop's
own comment already claimed Meks "don't otherwise roam the whole ship on
their own errands" — but every Mek (named and generic) had `nextRoamAt`
etc. set exactly like any deployable pilot, and `updateNpcRoaming`'s explore
branch had no per-NPC-type restriction at all. The comment was aspirational,
not actual: a Mek could already wander to any of the ship's other five
rooms before this pass.

New `HubNpc.homeRoom?: RoomId` field, set to `"workshop"` for every Mek
(both `buildNpcs` loops). In `updateNpcRoaming`, a confined NPC skips the
ordinary uniform-random `pickExploreTarget` roll entirely and instead:

- Away from home with the need that sent them out now satisfied → walks
  straight back to the Workshop.
- At home with a real need outstanding → walks straight to that need's
  room (Rec Room for hunger/thirst, Berths for sleep) — never a random trip
  to the Hangar Deck, Vault, CIC, Spar Room, or Grotto.
- Neither case: falls through to the ordinary same-room mingle logic
  unchanged, so a Mek still chats/games with whoever's actually standing
  next to them, at home or wherever a need took them.

Deliberately excludes the new `boredom` meter (below) from this branch's
own `worstNeed` call — a bored Mek stays put; "unless they are sleeping or
eating" names exactly two exceptions, not three.

## Rec Room table

New `RECROOM_TABLE` point + `RECROOM_TABLE_RADIUS` (46px) +
`RECROOM_TABLE_SEATS` (4, placeholder) — a real landmark other systems key
off of, same role `MUSTER_POINT` already plays one deck over. Drawn as a
dashed circle (`drawRecroomTable`) so it reads as something you gather
AROUND rather than another rectangular pad you stand on.

`updateNpcRoaming`'s mingle branch (clique-approach and the random-mingle
fallback, never the rival-avoid branch — fleeing someone shouldn't detour
through a table) now redirects an already-decided "walk toward company"
destination to the table instead, but only while a real seat is open
(fewer than `RECROOM_TABLE_SEATS` roommates currently within the radius). A
full table falls straight through to the destination already computed —
still mingling with that same roommate, just wherever they actually are,
not queued at a full table. That's the literal "if full the ant gonna find
something else to do."

## Boredom

New fourth `NeedKind` (`data/needsCounter.ts`), same
decay/restore/threshold machinery as hunger/thirst/sleep, added as an
**optional fourth parameter** to `worstNeed` rather than a required one —
existing 3-argument call sites (the Mek `homeRoom` branch above, and
`pickNeedsFlavorLine`'s own flavor-line pick, extended separately once the
type required it — see below) keep working unchanged; only the ordinary
pilot's own explore-bias call site passes it.

One real difference from the other three: boredom's restore condition is
NOT a room. It's relieved by actually being in a live encounter bubble
(`now < npc.bubbleUntil`) — real company relieves boredom, standing in a
room alone doesn't. `NEED_ROOM.boredom = "sparRoom"` — a bored, idle pilot
gets biased to roam toward the Spar Room once boredom is their worst need,
same mechanism as any other need.

`NEEDS_FLAVOR_BANK` needed a `boredom` entry once the `NeedKind` union grew
(the `Record<NeedKind, ...>` type requires all four) — used the "anger"
echo rather than fear/sadness like the other three, since this meter is
about restless, pent-up energy, not a low-energy register. Once that entry
existed, wired it into `pickNeedsFlavorLine` too for consistency, so a
bored pilot's own ambient line surfaces the same way a hungry/thirsty/tired
one already does.

## Spar

New `EncounterKind: "spar"` (`engine/socialSim.ts`) with its own
`resolveSparEncounter` — same abstracted "no real move-by-move session"
shape as `resolveAbstractedMinigameEncounter`'s poker/fletchers branch, same
+6 "decisive session" bond magnitude. Deliberately **not** added to
`KIND_WEIGHTS` — it never fires from the ordinary weighted roll any
same-room pair gets. Also deliberately distinct from the existing Breakdown
system's own "spar" resolution flavor (`data/breakdown.ts`) — that one is a
Stress+Worried CRISIS caught in the Spar Room; this is an everyday,
boredom-driven event. Same room, same flavor of outcome, two separate
triggers and code paths.

New `Hub.tryBoredomSpar`/`runBoredomSpar`, same "checked ahead of, instead
of, the ordinary encounter roll" shape `tryAngerBlowup` already uses.
Eligible only when both NPCs are actually in the Spar Room and at least one
side's boredom is genuinely low, gated by a new `SPAR_CHANCE` (0.5,
placeholder) chance roll — deliberately set higher than
`ANGER_BLOWUP_CHANCE` (0.35): a blowup should read as rare, but a pilot who
walked all the way to the Spar Room specifically looking for a bout should
usually find one, not whiff most of the time. New `VerbId: "spar"` added
(`data/verbs.ts`) so social-log entries and the Highlights reel's "First
Spar" milestone come for free, same reasoning `angerBlowup`/`breakdown`
already used.

## Verification

- `npm run typecheck` / `npm run lint` / `npm test` all clean — 1174/1174
  tests, including new coverage:
  - `engine/__tests__/socialSim.test.ts` — `resolveSparEncounter`'s winner
    resolution and bond delta; `pickEncounterKind` confirmed to never
    return `"spar"` across 500 real-random draws.
  - `data/__tests__/needsCounter.test.ts` — `worstNeed`'s new optional
    boredom parameter (omitted behaves exactly as before; a low boredom
    competes on magnitude with the other three, not picked just because
    it's passed; the strict-below-threshold rule holds); `NEED_ROOM`/
    `NEEDS_FLAVOR_BANK` round-trip for all four `NeedKind`s now.
- Not verified: the Rec Room table's actual visual clustering, Mek
  confinement, and the boredom→spar behavior in a real running Hub scene —
  same standing "logic-traced, not click-tested" gap every Hub.ts pass this
  session has carried, no Playwright/browser automation available here.
