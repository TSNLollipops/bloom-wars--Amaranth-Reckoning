# Build Log Addendum — Heads/Berths Chat-Intent Aliases, 3 Sep 2026

Second item off the ship interior addendum's own "docs owed" list (first
was the MapSelect back-to-Hub button, same session): *"chatIntent.ts room
aliases for 'heads' / the lance berths."*

## What this actually is

Not a navigation command ("go to heads") — chatIntent.ts doesn't have
that concept anywhere. It's the Antfarm build-economy chat gate: a player
standing with the CO can type "build me a sensor array" and get a real
build; type "build me a rec room" and the CO honestly says it's already
standing, not silence or a fabricated build. Heads and the per-lance
berths existed as real rooms after the ship interior pass but weren't in
that recognized list at all — asking the CO to build either would have
silently fallen through to the generic "not sure what you mean" fallback,
same as asking for a swimming pool.

## What shipped

- **`src/data/chatIntent.ts`** — `KnownUnbuildableId` gains `"heads"` |
  `"berths"`; `UNBUILDABLE_KEYWORDS` gains their keyword buckets (`heads`,
  `bathroom(s)`, `shower(s)`, `toilet(s)` / `berths`, `berth`, `bunk room`,
  `bunks`, `crew quarters`). Checked by hand against every existing bucket
  in the file for a collision — none of the new words appear anywhere
  else, so the file's own "no keyword in two buckets" invariant holds.
- **`src/scenes/Hub.ts`** — `BUILD_UNAVAILABLE_LINES` (a `Record<
  KnownUnbuildableId, string[]>`, so the two new union members would have
  been a compile error left unhandled — caught by reading the type, not
  guessed past) gets matching CO lines for both, same "already standing,
  forward row, lower deck" register as the existing recRoom line.
- **`src/data/__tests__/chatIntent.test.ts`** — one new test, matching the
  existing recRoom/mekWorkshop test shape, covering all four new keyword
  variants across both rooms.

Deliberately one shared `berths` bucket, not per-lance — chatIntent has no
notion of which lance the speaking player belongs to, and `Hub.ts`'s own
`isBerths()` already treats all three lance berth rooms as one
interchangeable answer to "is this a bedroom," so this layer doesn't
pretend to be more specific than the room system underneath it actually
is.

## What this deliberately does NOT do

**No verification pass ran**, same limitation as the MapSelect addendum
earlier this session: no `device_bash` this session, so `tsc`/`eslint`/
`vitest` never ran anywhere. This one carries slightly more compile risk
than the MapSelect button did — it's a `Record` type gaining two required
keys, not a single new function call — but the `Record<KnownUnbuildableId,
string[]>` shape was read directly from `Hub.ts` before writing anything,
specifically to catch that exhaustiveness requirement rather than find it
at build time. Confidence is high; "verified" would require a real
`npm run typecheck && npm run lint && npm test` on the actual machine —
not claimed here.

## Status

Both concrete follow-ups the ship interior addendum flagged as chat/code
work are now closed (MapSelect back-to-Hub button, this). What's left
from that addendum's "docs owed" list is pure content/doc work, no code
risk: `Bloom_Wars_Antfarm_Grid_v1.md`, `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`
§11.1, codex entries for Heads/Engineering/Forward Bays/the lance berths,
and the `Bloom_Wars_EA_Launch_Plan_31Aug2026.md` note that none of this
week's Hub work was in the written 8-week schedule.
