# House Amaranth — Personalized Line Plan v1 (31 Aug 2026)

Maxime: *"make a plan for personalized line and add it to design. then start on the build."* — picking up right after confirming the four-pilot supporting cast draft (Sgt. Petra Vondra "Ironrow," Cpl. Jonas Meir "Sparrow," S.Sgt. Callum Bray "Deadfall," Cpl. Nessa Orin "Quill," alongside Col. Ysolde Marrow).

## What "personalized line" already means in this codebase

Not a new system — the game already has exactly this for Warden Company, and it's smaller and cleaner than it might sound. Three pieces, all in `src/data/`:

1. **A hand-picked `Catalyst`** (`ambientLines.ts`) per named pilot — one of nine animal archetypes, each with a locked trait identity (`catalystProfile.ts`'s own header): wolf=teamwork, dog=loyalty, cat=selfishness, crow=indulgence, raven=instruction, bear=isolation, fox=trickery, rabbit=nurturing, shark=ambition. This one pick is what makes a pilot's idle/drunk/panic/low-morale Hub lines, chat responses, and grief reactions all read as *them* instead of a generic voice — it selects which of `LINE_BANK`'s pre-written variants they draw from. `npcSeed.ts`'s `NPC_SEED` is where Warden's three hand-picked ones live today (Bosk=raven/mentor, Anand=wolf/watches-the-pack, Iyari=crow/restless) — every OTHER Warden pilot, Rourke included, falls through to a deterministic hash-based pick, explicitly flagged in that file as a gap, not a decision. So House Amaranth having all five of its own pilots hand-picked from day one is actually more complete than Warden's own roster is right now.
2. **A pairwise bond seed** (`NPC_BOND_SEED`, same file) — one number per pair of named pilots, read by `npcBonds.ts`'s clique/rivalry logic. Not a flat neutral grid: Warden's own three seed a real mentor pair (Bosk/Anand, 40) and a real friction pair (Anand/Iyari, -25) alongside one untested-mild pair, "to demonstrate, not three identical values" (that file's own comment).
3. **Everything downstream is already automatic.** Sub-animals (instinct/thought/action, `catalystProfile.ts`) are deterministically derived from `pilotId` — no authoring needed once a primary catalyst exists. Grief reactions (`engine/griefCatalyst.ts`), the background social sim (`src/sim/runSocialSim.ts`), and any future Hub scene all read through `catalystForPilot()`/`NPC_BOND_SEED` generically — one hand-picked catalyst and one set of bond numbers is the entire authoring cost per pilot.

## Proposed catalyst picks — for you to react to, same as the roster draft

| Pilot | Catalyst | Why |
|---|---|---|
| Col. Ysolde Marrow | **dog** (loyalty) | Her whole arc, per the campaign plan's own §4, is a loyalty test — "she chooses to back Halcyon fully... it's that full commitment... that makes the stalling solution work." Loyalty isn't a side trait for her, it's the plot. |
| Sgt. Petra Vondra — "Ironrow" | **raven** (instruction) | "The one who actually runs the room" — same read Bosk's own raven pick already carries in Warden ("the mentor, holds the line"). |
| Cpl. Jonas Meir — "Sparrow" | **wolf** (teamwork) | Genuinely believes in the bargain, believes in the squad and the mission as one thing — the friction the plan calls for is that this hasn't cracked yet, not that he's a lone operator. |
| S.Sgt. Callum Bray — "Deadfall" | **bear** (isolation) | Signed up for the shooting, tolerates the politics, doesn't need the room. Isolation reads as competence on him, not withdrawal. |
| Cpl. Nessa Orin — "Quill" | **rabbit** (nurturing) | The medic who keeps the squad's conscience without being asked — about as direct a match to the trait table as this cast gets. |

## Proposed bond seed — one real clique, one real friction pair, not six identical numbers

Four pilots means six pairs (Marrow isn't bonded to her own squad in this system, same as Rourke isn't bonded to Warden's three — `NPC_BOND_SEED` only ever tracks NPC-to-NPC, never NPC-to-MC):

| Pair | Value | Read |
|---|---|---|
| Vondra ↔ Meir | **+35** | Real mentor/mentee — Ironrow is the one actually training Sparrow's idealism into something that survives contact, same shape as Bosk/Anand. |
| Meir ↔ Orin | **+20** | She worries about him; he trusts her plainly. |
| Vondra ↔ Orin | **+15** | Professional respect — Quill's the one person who checks on Ironrow without being told to. |
| Bray ↔ Orin | **+10** | Bray tolerates her more than most; medics don't ask questions he'd have to answer. |
| Vondra ↔ Bray | **+10** | Mutual professional respect, nothing warmer — neither one is in the business of getting close. |
| Meir ↔ Bray | **-20** | The real friction pair — Sparrow's conviction grates on Deadfall's cynicism, same shape as Anand/Iyari. |

Clean clique (Vondra/Meir, above `CLIQUE_THRESHOLD = 20`) and one real rivalry (Meir/Bray, at `RIVAL_THRESHOLD = -20`) — same "demonstrate it, don't flatten it" bar Warden's own seed set.

## What this build pass actually touches, and what it deliberately doesn't

**Builds:** a new `src/data/npcSeedHouseAmaranth.ts` (mirrors `npcSeed.ts`'s shape: `HOUSE_AMARANTH_NPC_SEED` for the five catalyst picks, `HOUSE_AMARANTH_NPC_BOND_SEED` for the six bond values) and extends `catalystForPilot()` in `npcSeed.ts` to check it — additive, generic, doesn't touch Warden's own data. Also expands `HOUSE_AMARANTH_PILOTS`/`HOUSE_AMARANTH_MEKS` (`campaignHouseAmaranth.ts`) with the four new named pilots' real `PilotRecord`/`MekArchetype` entries, and grows Mission 1 ("First Harvest") from Marrow-solo to the full five-pilot lance — re-tuned and batch-sim-verified for the new squad size, the same discipline last night's solo tuning used.

**Deliberately does NOT touch:** Warden's own `NPC_SEED`/`NPC_BOND_SEED` arrays, or `scenes/Hub.ts` at all. Those two constants aren't purely generic data — Hub.ts's `buildNpcs()` specifically walks `NPC_SEED` to seed the three hand-placed Rec Room regulars' Hub *positions*, and merging House Amaranth's pilots into that same array risks bleeding into Warden's own live Hub in ways that have nothing to do with tonight's ask. There's no `HubHouseAmaranth.ts` yet for these five pilots to walk around in — that's the still-open "full Hub parity" scope item from the campaign plan's own §3c, a separate and much bigger build. Tonight's catalyst/bond data is real, consumed today by `catalystForPilot()`/grief/social-sim wherever House Amaranth pilots show up (deployed-squad grief lines during a mission, for instance), and it's exactly what a future House Amaranth Hub scene will read from the moment it exists — not placeholder work that gets thrown away.

**Also not touched:** stress/morale/drunk/favorability, the other four fields on Warden's `NPC_SEED` rows — those are live Hub-UI seed values with no meaning until a House Amaranth Hub scene exists to display them, so `HOUSE_AMARANTH_NPC_SEED`'s rows carry only `pilotId`/`catalyst`, the two fields `catalystForPilot()` actually needs.
