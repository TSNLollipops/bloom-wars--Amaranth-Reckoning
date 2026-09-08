# THE QIRAKI FILES — Bestiary & Stat Systems

*Part of the Qiraki files. Modular generator, mix parts to produce a
specific Bloom creature or mech loadout on demand rather than hand-
designing every encounter from scratch. Uses the same G-S tier scale
as Qiraki_Weapons_And_Progression.md.*

## Design principle

Same idiot-proof-legible logic as the mech stat system, a monster or
mech is a bundle of independently-rollable categories, not a fixed
template. Keeps a very long, multi-book project from running out of
distinct threats or reusing the same creature under a new name.

## Bloom creature categories

- **Weapons** — claws, spines, acid/enzyme spray, sonic disruption,
  concussive limbs, projectile biomass, energy discharge (rare, high
  tier only). Bloom weapons should read as improvised biology first,
  engineered second, per the established "more bullshit overpowered
  than the last thing" escalation rule, never neat or symmetrical.
- **Movement** — burrowing, swarm-crawling, flight (membrane or
  spore-jet), limbless propulsion (peristaltic/muscular), sessile
  (doesn't move, spreads instead — **not a neutral roll, see "Sessile
  — a special case" below**).
- **Perception** — compound-eye visual, heat/thermal, vibration/
  seismic, chemical/pheromone, none (blind, purely reactive).
- **Intelligence** — reflexive only (no coordination beyond individual
  reaction), pack-coordinated (local swarm logic, no central control),
  emergent (see Section 7 of Qiraki_Concept.md, coordination that
  accretes from scale, no true "mind" even here).
- **Endurance** — how much sustained damage/depletion before
  functional failure.
- **Vitality** — how much acute trauma before outright death, distinct
  from endurance, a creature can have high endurance and low vitality
  (wears down slowly but dies fast once actually breached) or the
  reverse.
- **Swarm type** — true/false. If true, generates a swarm-size number
  between 10 and 20 (individual units of that creature type present in
  the encounter). If false, single large specimen instead.

## Sessile — a special case, not a neutral roll (new, 22 Aug 2026)

Every other Movement value is a legitimate default pick with no hidden
weight behind it — burrowing, swarm-crawling, flight, limbless
propulsion are all genuinely interchangeable at generation time.
Sessile isn't. It already carries real, locked story stakes the flat
five-option list doesn't convey on its own, and this doc has been
flagged more than once (Qiraki_Book7_Chapter_Outline_v40.md, Qiraki_
Military_Era_Outline_v3.md) for only giving it one line. This section
is that pass.

**What's already locked, in-story.** Book 8 Mission 3 — "the sessile
tomb," the mission that ends Team One, merged with Qiraki_Concept_v4.md's
volcanic-grotto material — is the canonical example, and it should set
the bar for how any sessile gets treated from here on. A *small* sessile
organism in a cavern. Roots erupting from the grotto floor. Energy
shields draining out from under the squad as the ambush hits, not
damaged, drained — a different threat shape than anything else in the
Weapons list (see the open item below). Two of the five die to
extraction failure, the one condition the setting's own battlefield-
medicine rule allows to actually kill; restock never gets the chance.
The lone survivor gets out only because he sensed the thing's presence
before walking into its range — his squadmates didn't, and it killed
them. Qiraki_Concept_v4.md states the standing protocol directly:
*any* sessile-type engagement requires calling in a higher-ranked unit,
regardless of size. Size is explicitly not the variable that matters —
say so plainly here, because the generator's flat category list has no
other way to carry that fact.

**LOCKED design rule, 22 Aug 2026 — Maxime's own words: "sessile are
end game bosses. meet one too early and you die."** Not a suggestion,
a mandate. This is the plain-language version of everything the Mission
3 case above already demonstrates, stated as the standing rule for
every sessile the generator ever produces, not just the named ones:
sessile is the campaign's boss tier. An early-game or low-tier party
that stumbles into one shouldn't get a hard-but-fair fight — it should
get the Mission 3 outcome. Any future sessile encounter that's survivable
by an underleveled party at first contact is, by this rule, a bug in
the encounter's placement, not a valid difficulty choice.

**Why sessile is mechanically different, not just narratively scarier.**
Per Qiraki_Concept_v4.md's seams material (full descriptive and
biological treatment lives in Qiraki_Bioterror_Bank_v2.md's own Seams
section, not duplicated here): a spreading form actively obscures its
own seams through motion, defensive posturing, and sheer scale. Only a
sessile — having stopped moving — stops concealing its own structure,
which is the entire reason Mission 4's seam-scan needs a *live* sessile
to study rather than any amount of footage of a moving one. That makes
sessile the one Movement category that gates the critical-hit module.
Nothing else on this list does that. A sessile isn't just "the immobile
option" — it's the only place in the whole Bestiary where the Bloom's
core anatomical weakness is actually visible.

**Generator guidance.** Don't roll sessile as a flat one-in-five with
average numbers — per the locked rule above, it's never a neutral pick.
Treat it as the campaign's boss tier: the natural home for a set-piece
or endgame threat, never a minor encounter filler, never something a
party meets casually. (The game's own Heartwood archetype independently
landing on sessile, moveRange 0, 400 Endurance, and an explicit "Boss"
role in the GDD's own design table is a useful cross-check that this
instinct was already correct elsewhere in the project before this
section — or the locked rule above — existed.) Its Endurance and
Vitality should sit at the top of whatever numeric range eventually
gets built, not merely "the high end" — see Open items below.

**Open tension, flagged rather than resolved here — Gallcyst.** The
game's own pre-rolled seven (Bloom_Wars_GDD_v0.2.docx §5.4) already has
a second sessile archetype, Gallcyst, and it isn't written as boss tier
— its teaching line is "some things must be ground down… answered by
Reeps at range, patience," which reads as a mid-campaign attrition
fight a competent party is expected to handle, not a Mission-3-style
wipe. That's a real conflict with the rule above, not a rounding error:
either Gallcyst gets rebuilt as a lesser, non-endgame exception to
"sessile is always boss tier," or it's currently mis-scoped and needs
moving to wherever the campaign's actual late/end content lives. Neither
call gets made here — flagging it because it's the first concrete case
the new rule collides with, and it should get decided before Gallcyst
gets placed in any built mission (as of this pass, it isn't in one yet
— neither Team One's four missions nor Amaranth Act I's first four use
it, so there's no existing placement to fix, only a future one to get
right).

**Still open, flagged rather than invented here.** A sessile has zero
move range by definition, so it needs some way to actually reach a
target. Mission 3's ambush already establishes one, in-fiction: roots
erupting to ensnare and drain stored energy rather than deal direct
damage. That's a real, locked precedent — but it's a *delivery
mechanism*, not one of the seven Weapons entries, and generalizing a
single mission's specific beat into a reusable Bestiary category is a
real creative decision, not a transcription. Worth deciding whether root
engagement becomes its own documented category (a "how a rooted
organism reaches you" companion to the Weapons list) or stays folded
into whichever Weapons type a given sessile is rolled with case by
case. Not decided here, so it doesn't get invented twice, differently,
by two different future passes. (A first pass at the reusable version
of this beat is drafted in Qiraki_Bioterror_Bank_v2.md's new "Root
engagement" section, flagged there the same way, for whoever makes the
call.)

## Seams — mechanical summary (new, 22 Aug 2026)

Structural weak points where the spreading form's colonial components
are joined. Full biological grounding, why they're hard to find, why a
trained Synker can learn to sense one, and visual/craft notes all
already live in Qiraki_Bioterror_Bank_v2.md's own Seams section — not
duplicated here, this is only the stat-system-facing summary so the
Bestiary itself isn't silent on a concept that gates an actual game
system.

Mechanically: seams are what the critical-hit module targets. They're
detectable only on a sessile (see above) — a mobile spreading form's
whole survival strategy depends on its seams reading as continuous
tissue, so there's nothing to scan until it stops. Finding one is a
trained pilot's existing sense, surfaced by the module for everyone
else, not a new sense the module invents.

Not a Bestiary-generator category of its own, and not something to roll
— it's a consequence of rolling sessile, the same way "swarm-size
10-20" is a consequence of rolling Swarm type true rather than its own
independent pick.

**Note for whoever reads this next to Qiraki_Book7_Chapter_Outline_v40.md
or Qiraki_Military_Era_Outline_v3.md:** both flag seams as having "no
anatomy, appearance, or vocabulary anywhere in the Bestiary, Bioterror
Bank, or Technobabble Glossary." That flag predates Qiraki_Bioterror_
Bank_v2.md's own Seams section (dated 2026-08-20) and is stale as of
this pass — the descriptive/biological gap those flags describe is
closed. What was still genuinely true, and is what this pass actually
fixes, is the second half of the same flag: "the sessile form has one
line in the Bestiary." Worth updating those two flags to point here
instead of re-solving a problem that's already solved, next time either
doc gets touched.

## Mech/loadout categories (parallel structure)

- **Weapons** — kinetic, energy, disintegrator (Munti-specific, see
  progression doc), melee-integrated, deployable (drones, turrets).
- **Movement** — bipedal standard, treaded, thruster-assisted
  hover, multi-limb (Munti-adjacent utility frames).
- **Endurance** — sustained operational capacity before requiring
  Munti support.
- **Perception** — sensor suite tier, directly tied to symbiosis depth
  for a bonded pilot, see Qiraki_Technobabble_Glossary.md.
- **Durability** — armor/structural integrity before critical failure.
- **AI-grade** — the connective AI's own tier, G through S, see
  progression doc, distinct from the chassis's own tier.

## Usage note

Roll or hand-pick per category depending on whether a specific
encounter needs to feel randomly generated (early skirmishes, minor
threats) or deliberately authored (named set-piece threats, anything
tied to a major plot beat). Swarm-type true/false is the fastest way to
distinguish a "mission" chapter's threat shape at a glance before any
other detail gets decided. Sessile is never in the "randomly generated,
early skirmish" bucket at all — see above; it's boss tier by rule, full
stop, not just a category that happens to skew that way.

## Open items

- Full numeric ranges for Endurance/Vitality/Durability, not yet built,
  same status as the tier system's open numeric breakdown.
- **Sessile-specific numeric escalation (new, 22 Aug 2026).** Now that
  "sessile is boss tier, meet one too early and you die" is a locked
  rule rather than just a strong suggestion, the numeric-range gap above
  needs sessile broken out as its own top-of-scale band, not merely "the
  high end" of the general table — rolling a sessile on the same table
  as a swarm or mobile type would contradict the rule outright, not just
  undersell it.
- **Gallcyst vs. the new sessile rule (new, 22 Aug 2026).** See the
  "Open tension" callout above — Gallcyst's existing design (a
  mid-campaign, patience-check fight) doesn't match "sessile is always
  boss tier." Needs a decision before it's placed in any built mission.
- **Root/tendril engagement as a sessile-specific delivery mechanism
  (new, 22 Aug 2026).** Locked in Mission 3's ambush (roots erupting,
  shields/energy drained rather than damaged), but not formalized as a
  reusable mechanic. Flagged in the Sessile section above and drafted
  descriptively in the Bioterror Bank; needs a decision on whether it
  becomes its own category, not invented here.
- Whether named, recurring Bloom threats (a specific creature type that
  shows up across multiple chapters/books) get built as fixed templates
  outside this generator, likely yes eventually, not yet needed.
