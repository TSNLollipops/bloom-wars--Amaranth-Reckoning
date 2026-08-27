> Mirrored from the Qiraki Files writing project ("qiraki files. book title: Enlightened") on 2026-08-25. Reference only — canonical source lives in that project; update there, not here. See `README_Qiraki_Canon_Bridge.md` in this folder for context.

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
  (doesn't move, spreads instead).
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
other detail gets decided.

## Open items

- Full numeric ranges for Endurance/Vitality/Durability, not yet built,
  same status as the tier system's open numeric breakdown.
- Whether named, recurring Bloom threats (a specific creature type that
  shows up across multiple chapters/books) get built as fixed templates
  outside this generator, likely yes eventually, not yet needed.
