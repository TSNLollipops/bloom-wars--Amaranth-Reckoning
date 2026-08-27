# The Bloom Wars — Spitball Ideas

A running list of "I wish this was in the game." Pre-canon — nothing here is
locked until it graduates into the GDD / Data Pack / Canon Pass. Throw stuff
in anytime; we'll sort it and build from here. Started 22 Aug 2026, during
engine-test-pass playtesting.

## Already built (in the test-pass engine, not yet canon)

These exist in code right now (the `bloom-wars` repo — see its README's
"House rules" section for exact numbers) but haven't been written back into
the Data Pack yet. Say the word when one should become real canon instead of
staying test-build-only.

- **Meeps: 40% dodge** on any hit they could take — as the primary target of
  a mech or Bloom attack, and independently on the counter-damage they eat
  after attacking something that counters back.
- **Tank ignores that dodge, House rule #1b, built 23 Aug 2026.** Maxime,
  after mission 1-3 playtesting: "and ignore the 40% didge of meeps. the
  dofge isnt balance for tank rn." A Meeps can't dodge a hit whose SOURCE is
  a Tank, in either direction — Tank attacking an adjacent Meeps directly,
  or Tank countering a Meeps that dove in. Deliberately narrow: doesn't
  touch attackRange, damage, or the class triangle. A companion idea in the
  same message — giving Tank a 3-tile ranged option — was checked against
  the GDD first and explicitly set aside, since it would have softened
  §4.1's own "do not soften" line on Reeps beating Tank; full reasoning
  in the resolved-discussion entry below. `data/combatTables.ts`,
  `engine/mission.ts`'s `rollMeepsDodge()`, three new cases in
  `dodge.test.ts`. Verified: typecheck/lint/299 tests (up from 296) clean,
  build succeeds, `mission_amaranth_1`/`mission_1a` sims run clean.
- **Tank: shield pool** (20 points, XCOM/Overwatch style) shared with the
  Tank itself and every adjacent ally. Absorbs damage before HP. Regens
  8/turn only if that unit took zero damage that cycle. Drops to 0
  immediately outside the Tank's radius — borrowed from its presence, not a
  personal stat.
- **Munti (Derek Barasj): Repair**, wired into the Battle scene — 30 HP to
  one adjacent ally instead of attacking; 38 HP if the Munti's mek has
  Fieldwright as primary.
- **Munti: passive AoE regen**, on top of Repair, not instead of it. Every
  living Munti heals itself + same-side allies within 2 tiles for 8 HP a
  turn, free, no action cost, stacks with whatever Repair does the same
  turn. Flat amount for now (doesn't scale with Fieldwright the way Repair
  does) — Repair is the "big single-target burst," this is the "constant
  trickle nearby." Decided 22 Aug 2026.
- **Two actions per turn, XCOM-style**, replacing the old one-move-plus-
  one-act model. Built 22 Aug 2026, specifically because Maxime said "id
  build munties like medics in xcom." Verified against XCOM 2's actual
  Medikit rule before building rather than assumed from memory: Move and
  Repair each cost 1 action and do **not** end the turn, so a unit can move
  twice, Repair twice — on two different allies, which is the actual point,
  Derek Barasj can now patch up two wounded allies in one turn instead of
  one — or move then Repair in either order. Attack always spends every
  action the unit has left and ends its turn outright, regardless of which
  slot it's used in, so it's still heal-then-heal, never
  heal-then-shoot-then-heal-again, matching an XCOM Specialist exactly. As
  a direct consequence of this (not separately requested — flagging it):
  Repair's old once-per-turn cap is gone entirely; the action-point budget
  is now the only limit. Worth confirming in play that this feels like the
  right amount of Munti power rather than too strong. Sunrider's
  alternative — a continuous Energy budget shared between movement and
  attacks — was seriously considered and explicitly set aside for the
  ground-combat layer (see the resolved discussion below); it stays parked
  for a possible future ship layer instead.

## Resolved discussion — kept for the reasoning, not just the answer

- **The game is Amaranth now. Team One's book-canon slice is archived,
  RESOLVED, 22 Aug 2026.** Maxime, after the Gallcyst/sessile-boss
  discussion below surfaced a real conflict in Team One's Mission 1b:
  "yeah. we should scrap those mission. the bloom wars is gonna be all
  about amaranth." Followed immediately by the actual build priority:
  "lets mske the gsmeplay loop hsrd and rewarding like xcoms. before we
  add the social part of the game." Two decisions, not one:
  1. **Scope.** The Amaranth Reckoning becomes the game — not a second
     campaign alongside the book-canon 4-mission vertical slice, the only
     one. Team One's slice (`src/data/campaign.ts` — Trav's squad, missions
     1a/1b/2/3, the Mission 3 wipe) is **archived, not deleted**, per
     Maxime's own words: "archive the old mission. we might reuse them
     later." Done the same day: `src/data/allCampaigns.ts` no longer lists
     it (comment marks why), `MapSelect.ts`'s campaign-tab switcher only
     renders when there's more than one campaign to switch between, so it
     quietly disappears now that there's just Amaranth. The data, the
     roster, the Mission 3 wipe event, and every test that exercises them
     directly are untouched — `npm run sim -- mission_1a` (etc.) and the
     full 140-test suite still work from the CLI, same as before. Only the
     player-facing front door changed. This also makes the Gallcyst/
     sessile-boss-tier tension flagged in `Qiraki_Bestiary.md` moot for
     now — Mission 1b (the mission that used solo Gallcyst as a
     mid-campaign teaching fight) isn't reachable in the shipped game
     anymore. Still worth a decision eventually if Team One's slice ever
     gets unarchived, just no longer urgent.
  2. **Sequencing.** Build order is: nail the hard, punishing tactical
     loop first — everything below this bullet — before touching the
     Antfarm Carrier Hub's narrative/social layer
     (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md`, already designed but not
     started). "Before we add the social part of the game" is a direct
     standing instruction, not a preference — don't start hub/banter/social
     work until the core loop below is real and playtested.
- **Real permadeath, gated on the Munti — the XCOM/canon reconciliation,
  RESOLVED, 22 Aug 2026.** The problem this solves: the GDD's locked
  "Restock, not death" rule (§3.1) is a book-canon-driven choice — it
  exists because the Qiraki novels' battlefield-medicine rule makes death
  rare and Team One's Mission 3 wipe is the one deliberate, scripted
  exception. Amaranth is non-canon and Maxime wants real XCOM stakes:
  "im a xcom purist." Those two facts were in direct tension the moment
  Team One's slice (and its book-continuity obligation) left the picture —
  this is the resolution, arrived at in conversation rather than handed
  down as a spec, so the reasoning is kept in full:
  - **The core rule, Maxime's own words: "if there a muntie there is
    restock. no munties no restock."** Not a one-way switch that flips
    permanently the moment a Munti first dies — a live check, evaluated
    fresh every time a unit is reduced to 0 HP. Is at least one Munti
    currently alive and on the field, right now? Yes → standard restock,
    exactly like today (removed from the board for the rest of the
    mission, back at full strength next mission). No → that loss does not
    restock. It's permanent — gone from the roster for good. This is
    dynamic on purpose: a Fabricator redeploy that gets a medic back on
    the field mid-mission re-arms the safety net for whoever goes down
    after that. A mission doesn't become unrecoverable the instant a Munti
    first falls; it becomes exactly as dangerous as the board actually is
    at that moment, which is the correct feeling.
  - **Fabricator's spare-parts redeploy stays completely separate from
    this — confirmed explicitly.** Maxime: "for fabricator. as long as
    you got pilot in the bank you can send them on field for spare parts.
    but if there no munties on the field losing them is permanent."
    Spending a spare part gets a downed pilot back onto the board so they
    can keep fighting this mission — full stop, nothing to do with
    whether losing them *again* is reversible. Whether that's permanent is
    decided purely by the live Munti-presence check above, every time,
    even for someone Fabricator just put back on the board. If Fabricator
    quietly granted permanence too, a Fabricator-heavy build would make
    the Munti optional, which defeats the entire point — the two systems
    have to stay orthogonal for either one to matter. Practical corollary,
    not separately stated but follows directly: a squad running two Muntis
    (Act II's roster, per the squad-scaling table) is buying real
    insurance against exactly this failure state, not just double healing
    — worth being deliberate that that's what a second Munti is *for*
    once Act II's composition choice becomes real. Sharper edge, also
    following directly from the rule as stated rather than separately
    decided: a squad with exactly one Munti and no backup has no one to
    save the medic when the killing hit against *it* lands — the Munti's
    own death is instantly permanent under the same check, same as
    anyone else's.
  - **No plot armor except the protagonist — Maxime: "im a xcom purist,"**
    confirmed specifically for Bosk's scripted Act 1 finale death when
    asked directly: "for bosk and the scripted death. yeah." The
    Independent Campaign doc's Mission 12 currently reads "Bosk covers the
    gate and doesn't make it out" as a fixed, named-character beat. Under
    this rule it isn't protected from the mechanical permadeath check
    above — if Bosk (or Iyari, or Anand, or Lask, or any later recruit) is
    lost earlier to bad play, that's what happens, and the story has to be
    written flexibly enough to route around whoever's actually left rather
    than assuming its named cast survives to their assigned beat. Flagged
    in `Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md` itself
    (new §6a) as the real authorial cost of this choice — real work for
    whoever writes each mission's actual text, not solved here.
  - **The one exception, Maxime: "the only character that is safe is the
    mc."** Dessa Rourke ("Lark") is mechanically exempt from the permadeath
    check — the sole unkillable unit in the roster. Everyone else,
    named-cast or player-created, plays for keeps. Worth noting this
    already lines up cleanly with one piece of existing design rather than
    creating a new conflict: Requiem's inheritance chain (Bosk → Rourke on
    his death, §9) already routes the flagship Heirloom to the one pilot
    who can't be lost, so that specific piece of continuity survives no
    matter how the roster around her turns over. **Sharpened, 25 Aug 2026
    — see `Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md` §6a's
    own later update: this "exemption" is now understood as a mission-fail
    condition (she going down ends the mission attempt and sends the
    player back to briefing to retry), not a flag that quietly redirects a
    death roll onto someone else. Full reasoning there, not duplicated
    here.**
  - **Rotating cast + player character creation — the deploy gate, and the
    recruit-phase mechanic itself, RESOLVED, 22 Aug 2026, worked out in a
    dedicated follow-up conversation.** Maxime: "we should have a rotating
    cast and a character's creation part so player can make their own
    squads. natural balance." This is necessary infrastructure for the
    permadeath rule above to be survivable across a 36-mission campaign,
    not just a nice-to-have — a fixed 5-to-20-name roster with real
    permanent losses and no way to backfill them means a bad run can run
    out of Muntis (or just run out of pilots) with two-thirds of the
    campaign still to go. "Natural balance" reads as: a generated/
    player-made pilot's stats follow the same tier/chassis/mek-track rules
    every named pilot already follows (§4.3's chassis modifiers, §5's mek
    tracks, the G→A tier ladder) rather than being hand-tuned per
    character — consistent with how the engine already treats archetypes
    as data (Build Brief §2.3), so this is closer to "expose pilot
    creation as a UI over rules that already exist" than a new balance
    model.

    **The deploy gate, Maxime's own framing: "cant go into mission without
    a munties. Munties are essentially vip that fight back and heal."** A
    mission cannot be launched unless the deploying squad includes at
    least one living Munti, enforced at the same deploy screen that
    already caps squad size (5 in Act I, 5–8 in Act II, 8–12 in Act III).
    Every mission is implicitly a protect-the-asset mission underneath
    whatever its stated objective is, except the asset can fight and heal
    rather than being a helpless escort. This gate is also *why* a
    guaranteed recruit path isn't optional: without one, a roster that
    hits zero living Muntis can never launch another mission again, ever —
    a spreadsheet problem ending the campaign, not a story beat.

    **The recruit-phase mechanic that prevents that, Maxime's own
    requirement: "make sure if player lose munties they can get
    replacement next mission."** Two separate tracks, not one.
    **Emergency Munti replacement** delivers the actual guarantee: the
    moment a player's living Munti count hits zero at a debrief screen, a
    fresh recruit is offered automatically, no points spent, cannot be
    skipped in a way that leaves the roster unable to launch the next
    mission — this has to be unconditional, not something a broke player
    might fail to afford, or the deploy gate above could brick a save
    file. **Discretionary recruiting** — buying an *extra* pilot of any
    class, including a second Munti as proactive insurance, before you're
    actually down to zero — stays a normal points-shop purchase,
    competing with gear-tier upgrades same as everything else already in
    the shop. That split is what keeps a guaranteed safety net from also
    being a free pass: the emergency replacement guarantees the campaign
    can't dead-end, but it doesn't undo the loss — a lost Munti's tier and
    mek investment are locked to that specific pilot under the existing
    "points spent on a mek are points spent on that specific person"
    rule, so the replacement starts back at G-tier, stock gear, a rookie,
    same as Corin Lask on day one. The sting is losing the investment, not
    losing the ability to keep playing. Emergency replacements are real,
    nameable, customizable recruits, not placeholders — matching the
    character-creation ask directly, at minimum name/portrait/chassis
    choice at the moment they're assigned.

    **Confirmed tactical payoff neither of us had spelled out going in,
    Maxime: "that work, safety net and tactic, upgrading your 2cd munties
    become something usefull especially since you act 2 give you up to 8
    character on screen."** A second Munti bought proactively through the
    discretionary track isn't just bench insurance sitting off-screen —
    it's a real 7th or 8th deploy slot once Act II's composition choice
    opens up (5–8 deploy out of a 10-pilot roster, §10's squad-scaling
    table), so investing in a backup medic has a genuine on-field payoff
    at that scale, not only a safety function.

    Still open, deliberately not designed here: the discretionary track's
    actual points cost (a balance number, not a design question), and how
    much of a full character-creation UI exists beyond identity/cosmetics
    — "natural balance" already rules out custom stat allocation, so
    there may not be much more to design there than portrait/name/
    chassis/class selection, but worth confirming once someone's actually
    building the screen. Real overlap remains with the already-parked
    "Character mod kit + map editor" idea below — worth designing this
    with half an eye on that rather than building the same capability
    twice.
  - **Sunrider-style social layer — confirmed as the deliberate "later,"
    not dropped.** Maxime, immediately after listing the above and
    catching himself: "or maybe im going too big... i want both the xcom
    feeling and a sunrider style social between mission cooldown. to
    manage your cast[s] fear and motivation faced the bloom and the
    endless war." This is exactly the sequencing already locked at the top
    of this entry — the hub/banter/social layer is designed in
    `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` already, but a mechanical
    "fear and motivation" system (a morale/stress/will axis that
    responds to losses, mission difficulty, and rest, the way XCOM 2's
    Will or Darkest Dungeon's Stress does) does not exist anywhere in that
    doc yet — it's genuinely new design work, not a gap in an existing
    spec. Belongs fully in the "after the hard loop is proven" bucket, not
    designed here. **Update, 23 Aug 2026 — no longer entirely true.** The
    "fear and motivation" axis now has a name and a shape: Stress,
    `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.4, added earlier the same
    day this update was written. Still shape-not-numbers, still not built,
    still behind the hard-loop-first rule two paragraphs up — but no
    longer purely hypothetical. The fuller update right below is what
    landed on top of that shape the same day.

    **Update, 23 Aug 2026 — the social layer gets real texture.** Maxime,
    unprompted, laying out what he actually pictures rather than leaving
    "social layer" as a category label: "I want the hub to be the social
    spot like the Normandy was. in it player should be allowed to talk to
    the crew, the co once that open up and help alleviate stress, romance
    other pilot, eat shit because you let someone thst got romance die.
    get drunk at the rec room. stuff like that." Still explicitly "later"
    per the sequencing rule at the top of this entry — this doesn't move
    the build order, it gives the eventual build something real to build
    *toward* instead of an empty placeholder marked "social stuff." Five
    distinct pieces, most of which already have a room or a mechanic to
    hang off rather than needing one invented from nothing:

    - **Talk to the crew, Mass Effect: Normandy style.** A real gap
      against what's currently speced: the Antfarm doc's §7 `HubScene` is
      fire-once and trigger-based (`after_mission` / `heirloom_unlock` /
      `roster_change`), explicitly "no branching dialogue in v1." "Talk to
      the crew" in the Normandy sense is a different shape — walk up to a
      squadmate more or less any time you're in the hub and get
      *something*, not a scene that fires once and is gone. Doesn't have
      to mean branching dialogue is back on the table (that exclusion
      still holds) — could be as cheap as a small rotating bank of
      ambient lines per pilot, keyed to their current state (recent
      mission, Stress level, wounded, grieving) rather than a real
      conversation tree. Worth designing as its own small data shape
      (an ambient-line pool, maybe) alongside `HubScene` rather than
      stretching `HubScene` to cover a job it wasn't built for.
    - **The CO, once the grotto opens, as a stress-relief lever.** Ties
      directly into two things already on record: the grotto
      (Antfarm doc §11.3, rank-gated per that doc's own new §12 — not a
      Mission 1 room) and Stress (§11.4), whose own "still genuinely
      open" list already asked "whether it decays on its own or needs
      the Rec Room actively" — this adds a second lever, CO conversation,
      alongside Rec Room rather than instead of it. Worth keeping
      distinct from the grotto's existing half-joke about a Dragon-Age-
      style CO approval/"love bar" meter (§11.3) — that was floated as a
      relationship-standing system that might gate things later; this is
      specifically the CO functioning as a mentor/counselor managing a
      pilot's Stress, closer to a support NPC than a romance option. Two
      ideas, one room, kept separate on purpose, so "can I date my CO"
      doesn't quietly become the answer to "does my CO help me cope."
    - **Romance between pilots.** New mechanic, no existing home — Berths
      is the obvious room (§2 of the Antfarm doc already describes its
      narrative job as "one-on-one pilot scenes... quarters, rest, the
      people rather than the war"). Real open questions before this is
      buildable, none answered here: which pilots are romanceable (all,
      or a curated subset — cross-species pairings are their own
      worldbuilding question, given Osnian/Hiopi/human chassis all sit in
      one roster); whether it's exclusive (one bond at a time) or open;
      what it actually does mechanically once formed (a Stress-reduction
      bonus for the bonded pair, a small in-combat synergy buff when both
      are deployed together, or purely narrative with no stat effect at
      all) — "stuff like that" is the ask, not a spec.

      **Resolved, 23 Aug 2026 — who's romanceable.** Maxime: "romance able?
      for the mc? anything but hiopi and carabil. those get close friend,
      bromance rating. meaning they get friendliest and will tell you
      compliment. on your work. grief with you when someone dies. etc."
      For Rourke specifically (the MC — and, per the permadeath entry
      above, the one pilot who's mechanically unkillable, which is
      probably not incidental to being the one whose romance options got
      answered first), romance is open to any pilot except Hiopi and
      Carabil. Those two species instead cap at a separate top tier —
      platonic, not romantic: "close friend / bromance." Not a consolation
      prize, a real distinct ceiling — at max standing it reads as the
      single friendliest relationship available, gives unprompted
      compliments on the player's performance, and includes a shared-grief
      beat when another pilot is lost (open to anyone at that tier, and
      worth keeping distinct from the grief entry two bullets below, which
      is specifically the cost of losing a *romanced* partner — this is a
      close friend's general reaction to any loss, not that).

      Worth noting why this reads as sound rather than an arbitrary
      carve-out, without claiming this was Maxime's stated reasoning:
      Hiopi's whole mating culture (`Qiraki_Concept_v4.md`,
      `Qiraki_Bible_Skeleton.md`) is a violent, once-a-year, winner-take-
      all city-wide contest — about as far from anything a human MC could
      read as courtship as a species gets. Carabil aren't humanoid at all
      (`Qiraki_Character_Sheets_v5.md`, `Qiraki_Bible_Skeleton.md`):
      lithoid, grown into their carrier from the start instead of piloting
      a separate body, "no face, nothing that reads as an expression in
      any human sense." Neither reads as a species a human MC would
      plausibly have a romance option with; a close, deep, platonic bond
      reads truer to both than forcing a romance track onto either.

      Also worth flagging as new rather than assuming it's already
      settled: this is the first time Carabil specifically has entered a
      Bloom Wars doc — Hiopi's already canon here (Iyari, Hyrs), Carabil
      hasn't shown up outside Qiraki material until now. Not a naming-lock
      concern — species names are already established as fair one-way
      inspiration (Canon Pass, `Bloom_Wars_Master_Index.md`'s own cross-
      project-references section), and the one reserved term that lock
      actually protects is unrelated to either species name.

      Still open, not answered by this: whether "anything but Hiopi and
      Carabil" means every other roster slot is romanceable by default, or
      still a curated subset within that — "anything but" reads like the
      former but hasn't been confirmed against an actual roster. Also
      worth flagging, not deciding: the Antfarm doc's carrier CO (§11.3,
      "Arangement of Content") still has no species locked, and Qiraki's
      own carrier-CO archetype (Coherence of Process) is Carabil — if the
      Bloom Wars CO ends up Carabil too, that would retroactively explain
      this exclusion mechanically (the CO structurally can't be a romance
      option) rather than only thematically. Not proposing that as
      decided, just flagging the connection since it's sitting right
      there.
    - **A real grief cost when a romanced pilot dies.** The sharpest new
      idea here, because it's the one that actually interacts with a
      system already locked elsewhere in this same doc: permadeath, right
      above. Maxime's own words for the feeling: "eat shit because you
      let someone thst got romance die." A romanced pilot's permanent
      loss should hit differently from an ordinary one — the natural
      lever is Stress (a much larger spike than a normal loss, plausibly
      scoped to the surviving partner specifically rather than the whole
      company), possibly paired with a one-off grief scene in Berths,
      structurally similar to the Vault's Heirloom-dedication beat
      (Antfarm doc §4/§8 — "the campaign's heaviest room, used sparingly
      on purpose") but *not the same scene* — Vault's trigger is
      specifically the A-tier Heirloom unlock, and a romance death is a
      different trigger with nothing to do with gear tier. Keeping the
      two griefs mechanically separate, even though they're tonally
      close, so the Vault doesn't end up carrying two unrelated jobs.
    - **Rec Room, specifically drinking, as the room's actual activity.**
      The Antfarm doc's §11.2 Rec Room already exists as "reduces pilot
      stress" with no fictional texture attached — this gives it one.
      Open question worth flagging rather than assuming: is getting
      drunk pure flavor riding on the existing stress-relief number, or
      does it carry its own small mechanical texture (a temporary malus
      the next mission if overdone, say) the way Darkest Dungeon ties its
      own stress-relief activities to real trade-offs? Either is
      defensible; "stuff like that" doesn't commit to one.

      **Resolved, 23 Aug 2026 — it's a real trade-off, now with real
      numbers.** Maxime, in the same breath as laying out the
      Favorability system below: "(dont get drunk, you'll lose 29%, hit
      chsnce.)" — a typo, corrected in the same follow-up conversation to
      "something like 20% for a few turn. of less able to hit things."
      Locked reading: −20% hit chance for a few turns (exact turn count
      still open). Confirms the malus reading over the flavor-only one.
      **Doesn't need the universal hit/miss system below to exist** — see
      Antfarm doc §13.4: that system got proposed the same day and then
      explicitly parked, but the drunk debuff survives as its own narrow,
      scoped effect rather than depending on it. Full reasoning and the
      rest of the system this landed inside of — Favorability, a
      DAO-style rep bar per NPC — is in
      `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13, not duplicated here.

      **Update, 23 Aug 2026 — Favorability likely subsumes this whole
      bullet, not just drinking.** The same conversation generalized
      "romance between pilots" into a bigger system: a Dragon-Age-style
      favorability bar per NPC (crew, mek techs, the CO), farmed by
      missions together, Rec Room minigames (poker, a game called
      "fletchers," and a peg game Maxime invented for this world, details
      pending), and shared drinks — giving a favored pilot a dodge bonus,
      a hit-chance bonus, and Stress relief. Antfarm doc §13.3 flags the
      live question this raises for the bullet above: is romance its own
      track, or is it Favorability at high standing plus a flag/scene on
      top of the same number the Hiopi/Carabil "close friend" ceiling
      already caps out at? Not resolved here — full detail in §13.

    Still holds, unchanged: none of this starts getting built before the
    hard tactical loop is proven, per the standing sequencing rule this
    whole bullet opens with. What changes today is that "the social part
    of the game" now has actual shape on record — five concrete pieces,
    three of them (CO/grotto, Rec Room, permadeath's grief hook) hanging
    off systems that already exist elsewhere in the project rather than
    needing to be invented from nothing — instead of staying the single
    vague line it was when this bullet was first written.
  - **What's actually left to build for "the hard loop," concretely, so
    this doesn't stay only a conversation:** the live Munti-presence check
    wired into the engine's downing/restock logic (`engine/mission.ts` is
    the likely home, alongside the existing restock and cockpit-evac
    rules); campaign-state tracking for permanent roster loss (today's
    restock model doesn't need to remember anything between missions,
    permanent loss does); the deploy-screen gate requiring a living Munti
    in the selected squad before launch is enabled; the two-track recruit
    system specced above — a debrief-screen trigger for the free emergency
    replacement, and a points-shop UI addition for discretionary
    recruiting; and some UI telegraphing so a player can actually see "no
    Munti on the field" as the danger state it now is, the same way
    Collapse has to be loud per GDD §5.2's own UI-implication note. None
    of this is started yet.
- **Sessile Bloom are the campaign's boss tier — RESOLVED, 22 Aug 2026.**
  Maxime, plain and final: "sessile are end game bosses. meet one too
  early and you die." This closes the open question the entry below
  raises about Gallcyst/Heartwood's numbers — it's not "worth checking if
  they're dangerous enough," it's now a standing rule: any sessile a party
  meets before it's ready should read as a wipe, not a hard fight, matching
  Book 8 Mission 3's "the sessile tomb" exactly (a *small* sessile ends
  Team One). Written into `Qiraki_Bestiary.md`'s Sessile section as a
  locked design rule, quoted verbatim. **One real conflict this surfaces,
  not resolved here either:** Gallcyst, one of the game's existing seven
  pre-rolled Bloom archetypes, is written in the locked GDD as a
  mid-campaign "grind it down, patience" teaching fight, not boss tier —
  that's now in direct tension with the new rule, flagged as an open item
  in the Bestiary doc rather than quietly patched over. **Update, same
  day:** the specific mission this collided with (Team One's Mission 1b)
  is now archived out of the shipped game per the entry above, so this
  tension is no longer urgent — still worth a real decision if Team One's
  slice, or Gallcyst itself, ever gets built into Amaranth. Heartwood, by
  contrast, already matches the new rule with zero changes needed — it's
  already the GDD's explicit slice boss, already at 400 Endurance against
  everything else's double digits to low hundreds.
- **Tank vs. Meeps dodge, and a ranged-Tank option that got checked against
  the GDD and set aside — RESOLVED, 23 Aug 2026.** Maxime, after mission 1-3
  playtesting: "tank should be able to hit 3 case out(turning the tank
  weapon range unless we make tsnk wespon be able tk chose between melee and
  range option. a melee tank hit very hsrd close and a range lne hit hard at
  3 case rnge. and ignore the 40% didge of meeps. the dofge isnt balance for
  tank rn." Two asks, checked separately against the locked GDD before
  either got built:
  - **The dodge complaint is real and matches the GDD's own stated intent.**
    §4.1 defines Tank's whole job as "punishes anything that comes
    adjacent... helpless against something that never does" — but Meeps'
    40% dodge (above) applies to the counter-damage Meeps eats after
    attacking something that counters back, which meant a diving Meeps
    could shrug off the exact punishment Tank is designed to deal 40% of
    the time, and the reverse held too when Tank attacked an adjacent Meeps
    directly. Confirmed as the fix: a Meeps cannot dodge a hit whose SOURCE
    is a Tank, either direction. Built the same day — see "Already built,"
    above, for the shipped version and file list.
  - **The 3-tile ranged option was checked against §4.1 and explicitly
    rejected, not just quietly dropped.** The GDD is emphatic that Reeps
    beats Tank *because* Tank has zero reach — "it is the entire mechanical
    reason Reeps beats Tank. Do not soften it" (§4.1's own power-matrix
    note). A ranged Tank mode reaching 3 tiles would let Tank threaten Reeps
    directly, undoing exactly the relationship that line locks. Asked
    directly rather than assumed either way; Maxime's call: "Just the dodge
    fix, drop ranged." Tank stays melee-only, range 1-1, Data Pack §3's
    Tank rows untouched, GDD §4.1/§4.2 untouched. Recorded here specifically
    so this doesn't get re-proposed later without the context for why it
    was set aside once already.

## Open questions — waiting on a decision before building further

- **In-mission social resolution (talk / fight / ambush) — checked, and
  it's recurring, not one-off, 25 Aug 2026.** Maxime, floating House
  Colors (Mission 6): "house color might be cool with a social interraction
  betwen the mc and the lead guard. with 3 way to acheive sucess, talking
  it out, fighting it out, ambush," then, once flagged as a real new
  system rather than a data tweak: "I always wanted social in my game...
  so finind mission where it can be done would be cool can u check if its
  something just done once because its convenient or if we gonna have more
  opportunity for it later." Checked directly against
  `Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md`'s full
  36-mission list rather than guessing.

  **It recurs.** House Amaranth is a real, named political faction
  (Colonel Marrow specifically) that shows up as a combatant/political
  actor across all three acts, not just Mission 6: Mission 6 (House
  Colors, the checkpoint dispute, first Marrow sighting), Mission 9 (Cut
  Off, House Amaranth's sabotage, unrevealed at that point), Mission 10
  (The Amaranth Betrayal, they abandon a shared position), Mission 16
  (Collaborators — House Amaranth conscripts, **already flagged in the
  campaign doc as having an undesigned "moral-complexity bonus
  objective"** — this is the sharpest existing hook for this idea,
  arguably a better first build target than House Colors itself since the
  doc already calls for moral nuance there), Mission 18 (joint Bloom/House
  Amaranth pincer), Mission 20 (Marrow's first named mech duel), Mission
  23 (confirms the Bloom bargain), Mission 24 (their regulars broken,
  Marrow escapes), and Mission 28 (Marrow turns on Halcyon Amaranth
  mid-battle). Marrow's own arc (distant sighting → named duel → her real
  turn) is already a three-beat character relationship the campaign means
  to develop — a talk/fight/ambush layer would sit directly on top of
  that, not invent a new thread.

  **It's specifically a House-Amaranth thing, not a general mission
  mechanic.** Nothing in this project's own Bloom Wars canon gives the
  Bloom itself any capacity for dialogue — its AI tiers (reflexive/pack/
  emergent, `engine/ai.ts`) are instinct-only, no exception anywhere in
  the Bestiary or Data Pack. A resolution-choice system only has
  somewhere to attach on missions with a human/political opponent —
  House Amaranth (and by extension Marrow) is the only faction that
  currently qualifies.

  **Adjacent context, not a conflict, worth holding in view together.**
  Two other things already on record pull on the same underlying
  question — how much dialogue/branching-choice tech this project wants
  to build — without actually being the same system: the Antfarm Hub doc
  (§7) already locks "no branching dialogue in v1" for the ship's own
  `HubScene`, deliberately scoped down to ambient lines instead of a real
  conversation tree; and the "game is Amaranth now" resolved entry above
  locks a standing sequencing rule, hard tactical loop before "the social
  part of the game." An in-mission resolution-choice mechanic is a
  different subsystem from either (it's story/mission structure, not hub
  banter or the Favorability/romance layer), so it doesn't strictly
  collide with either call — but both were explicit, deliberate scope-downs
  around dialogue investment, so it's worth deciding this with those in
  view rather than in isolation, whenever it's actually designed.

  Not scoped, not started — Maxime's own framing was "I just want to have
  the option open when we get to it," so this stays a checked, confirmed-
  recurring opportunity on record, not a build in progress.

  **Update, 25 Aug 2026 — this connects to an existing system, not a new
  one from scratch.** Maxime, pushing past the "seduction" framing to what
  he actually means: "well seduction is asimplification, but there going
  to be a asocial system like DAO or baldur gate in it, a moral system
  where you keep your troop confident and happy." Worth naming directly
  what's already sitting in this project under different labels:
  Favorability (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13, a DAO-style
  rep bar per NPC, dodge/hit-chance/Stress-relief payoff) and Stress
  (§11.4) are already, unnamed, the mechanical spine of "keep your troop
  confident and happy" — a moral/approval system doesn't need inventing
  from zero, it needs these two tied together on purpose and given a
  third input: choices, made in missions like this one, that ping them.

  **DAO-style, not BG3-style — a real architecture choice, not just a
  reference pick.** Two different ways an approval system like this gets
  built. BG3's is bespoke: nearly every companion reacts to nearly every
  choice with its own hand-written line and its own approval delta, which
  is part of why that game shipped with a small, tightly-authored cast and
  years of writing behind it. DAO's is a trait matrix: companions hold a
  handful of values (aggression, mercy, honesty, pragmatism, whatever the
  game's own axes end up being), a choice pings those values generically,
  and one rule engine runs for the whole roster — a new companion plugs
  into the existing axes instead of needing its own bespoke reaction tree.
  At Bloom Wars' own scale — 36 missions, up to 20 pilots by Act III
  (`Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md` §10's
  squad-scaling table) — BG3-style is very likely not viable without a
  dedicated writing team; DAO-style scales the way the engine's existing
  data-first philosophy already scales (Build Brief §2.3), and could
  plausibly reuse whatever trait/axis shape the recruit-creation system
  (see the permadeath entry above) ends up wanting anyway.

  **Updates the "no branching dialogue in v1" framing above, doesn't
  overturn it.** The Antfarm Hub doc's §7 lock stays exactly as written —
  no branching dialogue in the *hub* for v1. But read next to this
  thread, it's now clearly a sequencing call, not a permanent no: a
  DAO-style moral system needs *some* choice surface to ping companion
  values against, and an in-mission resolution mechanic (talk/fight/
  ambush, above) would be a small, contained way to build and prove that
  choice → value → approval pipeline before ever touching the hub's own
  dialogue system — one build serving two future needs instead of
  building the same capability twice, later, from scratch.

  Not scoped, not started — this is a synthesis of three things already
  separately on record (Favorability, Stress, the in-mission-resolution
  question above), not a fourth new system. Worth a real design pass
  whenever the in-mission resolution mechanic actually gets scoped, since
  that's the piece all three would hang off of.

  **Update, 25 Aug 2026 — the actual reaction formula is now decided, not
  just the architecture.** Full formula, definitions, and the deliberate
  simplifications made from Maxime's own source reference are in the new
  `claude/Bloom_Wars_NPC_Reaction_Engine_v1.md`, not duplicated here — that
  doc is the mechanism underneath Favorability, Stress, and this
  in-mission-resolution idea all at once. Still design only, still gated
  behind the hard-loop-first rule at the top of this doc.
- **Bloom's real creative lineage: Zerg + Cthulhu + Tyranid, not just
  StarCraft** (new, 22 Aug 2026, reframes the two items below). Maxime,
  after the Defiler/Queen/Lurker riff: "im using starcaft as exemple
  because thats what I know best. but bloom are zerg, ctulu tyranid in
  idea. we can borrow from tropes and meme." Worth keeping as an explicit
  north star rather than quietly narrowing to whichever single reference
  is easiest to cite: StarCraft is shared vocabulary, not the target — the
  actual synthesis is swarm/hive-mind biological horror (Zerg) + cosmic
  unknowability and dread (Cthulhu) + a biological-weapons arms race with
  its own internal logic (Tyranid), and that synthesis already matches
  what's independently locked elsewhere in the project (the Qiraki
  Bioterror Bank's own anchor points: "no symmetry, ever," "landscape-level
  wrongness," "more bullshit overpowered than the last thing" as a
  deliberate escalation rule — none of that reads as StarCraft, all of it
  reads as this triangle). Two Tyranid-specific tropes worth flagging
  because they land closer to what's already being discussed than the SC
  references did:
  - **The Lictor is the precise version of "burrower gets behind you,"**
    more specific than a generic Lurker comparison. A Lictor's whole
    identity is ambush-and-infiltration — camouflaged, appears behind
    enemy lines ahead of the main swarm, softens up a position before the
    rest of the invasion arrives. That's a sharper flavor identity than
    "Lurker" for whichever Bloom creature ends up doing the
    wall-ignoring/flanking thing discussed above, and gives it a *reason*
    within the fiction (a scout/vanguard role) rather than just being a
    mechanic bolted onto Undertow.
  - **Synapse creatures are a real precedent for tying Bloom intelligence
    tiers to a specific, killable creature**, which the engine already has
    half the infrastructure for. Tyranid lesser swarm units only fight with
    coordination and purpose while within a Synapse creature's control
    radius; cut off from Synapse, they revert to dumb instinctive behavior
    (feed, flee, act erratically). The Bestiary's existing
    reflexive/pack/emergent tiers (`engine/ai.ts`) are most of the way
    there already — pack tier already shares targeting only with nearby
    pack-tier allies (`packAllies`, `SPLITFANG_PACK_RADIUS`). A Synapse-
    style creature would push this one step further: certain Bloom project
    coordination onto *other* Bloom archetypes near them (not just their
    own kind), and killing that specific creature visibly downgrades
    everything nearby — pack drops to reflexive, maybe emergent drops to
    pack — which would read as a real, satisfying "kill the commander"
    tactic rather than a stat check, and gives the Heartwood's whole
    "prioritise the Munti, spawn Undertow adds" kit an obvious sibling
    mechanic if a non-boss Synapse-equivalent creature ever gets rolled.
  Same holding pattern as the two items above — not scoped, not started,
  Maxime's already said this waits for the fuller Bloom-variety pass. This
  entry exists so the reframing (and these two sharper trope matches)
  isn't lost by the time that pass actually happens.
- **Sessile/caster Bloom — StarCraft Zerg caster inspiration (Defiler,
  Queen, Lurker)** (new, 22 Aug 2026, same thread as the item above).
  Maxime, unprompted follow-up: "because some bloom get special effect
  like defiler or queens in starcraft. or lurker. sessile bloom have
  biological aoe effect even psionic at times." Checked against
  `Qiraki_Bestiary.md` and the Data Pack's Bloom archetype table before
  writing this down, so the reference points land on something real
  rather than staying abstract:
  - **Lurker** (burrowed-only ranged AoE line attack; can't fight
    unburrowed at all) is close kin to Undertow's *existing* identity, but
    a different shape than what's built. Right now Undertow surfaces to
    strike — gets a ×1.5 bonus, then is exposed and targetable afterward.
    A Lurker never fully surfaces to attack. Worth deciding as its own
    question rather than assuming: does Undertow stay "ambush striker
    that surfaces" (current spec), or is there room for a second
    burrow-type creature later that fights *from* burrow instead and
    never truly exposes itself? (See the Lictor note above too — a
    flanking burrower and a fight-from-burrow Lurker-type are two
    different creatures/roles, worth not collapsing into one.)
  - **Defiler** (Dark Swarm / Plague / Consume) and **Queen** (Ensnare /
    Parasite / Spawn Broodling) are both *mobile* casters in SC, not
    sessile — but Maxime's phrasing specifically pairs the *sessile*
    movement category with AoE/psionic effects. That lines up better with
    Gallcyst (already sessile, already has an on-hit AoE-adjacent effect —
    acid DoT plus converting the target's tile to bloom_mat) and the
    Heartwood (sessile boss, already spawns adds) than with either SC unit
    directly. Reads as: push the *sessile* movement category further into
    "battlefield-altering caster," rather than necessarily adding new
    mobile-caster creatures — sessile's own Bestiary definition is
    literally "doesn't move, spreads instead" (`Qiraki_Bestiary.md`),
    which is exactly the shape of a Dark-Swarm/creep-style area effect.
    Tyranid Zoanthrope/Neurothrope (dedicated psychic-blast caster, part
    of the hive mind's ranged nuke tier) is the closer analog for a
    "psionic sessile" creature than anything in the Zerg roster, if
    "psionic" ends up a real category — see below.
  - **"Psionic" is new territory, not an existing category.** The
    Bestiary's locked weapon list (`Qiraki_Bestiary.md` /
    `Bloom_Wars_GDD_v0.2.docx` §5.1) is claws, spines, acid/enzyme spray,
    sonic disruption, concussive limbs, projectile biomass, energy
    discharge — no psionic/mental type exists yet anywhere in the
    established taxonomy. Worth noting sonic already covers some of this
    ground mechanically (GDD: "sonic = area ATK debuff"; Sirenmaw's
    on-hit is already an AoE −20% attack aura within 2 tiles). Open
    question for whoever scopes this: is "psionic" meant as a genuinely
    new 8th weapon category (mind-affecting effects — forced skip-turn, a
    temporary side-swap, revealing the whole map, hallucinated fake
    units) or dressing on an existing category — sonic, most likely — for
    specific lore-appropriate creatures? Cthulhu-flavored dread/madness
    effects (panic, hallucination, a unit that breaks and acts on its own
    for a turn) are a genuinely different design space from a stat debuff
    and might be the more interesting home for "psionic" than reskinned
    sonic — worth deciding rather than defaulting to the easy answer.
  **Update, 22 Aug 2026, same day:** Maxime followed this up with "sessile
  are absolute monster, look at what I had planed for them in military era
  docx" and asked for the Qiraki Bestiary/Bioterror Bank to be expanded
  where needed. Read `Qiraki_Military_Era_Outline_v3.md` and
  `Qiraki_Concept_v4.md` before touching anything: Book 8 Mission 3 ("the
  sessile tomb") is locked canon of exactly the threat weight Maxime's
  instinct was pointing at — a *small* sessile organism wipes Team One via
  a root ambush that drains energy shields rather than damaging them
  outright, two of five die to extraction failure, and standing protocol
  requires escalating *any* sessile engagement to a higher-ranked unit
  regardless of size. `Qiraki_Bestiary.md` had one line for sessile against
  all of that; expanded it with a full "Sessile — a special case" section
  plus a "Seams" mechanical summary (the critical-hit-module anatomy, only
  ever exposed on a sessile — full biological grounding already lived in
  the Bioterror Bank, dated 2026-08-20, just never got summarized on the
  stat-system side). `Qiraki_Bioterror_Bank_v2.md` got one addition, a
  "Root engagement" section drafting the Mission 3 ambush (shields
  *drained*, not damaged — a genuinely different threat shape than any of
  the seven Weapons entries) into reusable descriptive material, flagged
  open rather than locked, since generalizing one mission's specific beat
  into a reusable category is a real creative call, not a transcription.
  **Then Maxime settled the open question this raised on the game side**
  — see "Sessile Bloom are the campaign's boss tier — RESOLVED" up in
  Already Built above; that's now a locked rule, not a question, and the
  Gallcyst tension it surfaces is tracked there and in the Bestiary's own
  Open items.
  Not scoped, not started on the code side — same "wait for the fuller
  Bloom-variety pass" holding pattern as the item above; this just
  captures the reference points and the concrete questions they raise
  while they're fresh, rather than letting them evaporate.
- **Reeps extra shot.** Reeps is already the safest class — range 2+, never
  countered, plus a terrain range bonus on ridge tiles. A free second
  attack on top of that risks making it strictly the best unit with no
  downside; probably needs a tradeoff attached (e.g. only when stationary)
  rather than being a flat buff. Now that two actions are in, Reeps
  already effectively gets a "second shot" if it doesn't move (attack costs
  an action and ends the turn either way, so this doesn't actually stack —
  worth explicitly checking whether Reeps still needs a bespoke ability at
  all, or whether the two-action system quietly solved this one too).
- **Veterancy grades (XCOM 2 style).** The game already runs two
  progression axes — Tier (raw stat scaling) and Mek gear (specialization
  bonuses). Does earned veterancy run as a third axis alongside those, or
  fold into/replace one of them?
- **Severance / Heirloom upgrade paths.** Locked so far: it always hits
  friend and foe, no exceptions, across every upgrade path — "it's tech, not
  magic," so no path can be tuned to spare allies. Still open: what actually
  varies between paths (damage? AoE shape? charge cost?), and how many
  paths there should be.
- **Art style and tone, confirmed 22 Aug 2026.** Maxime wants "an xcom like
  game with advance war art-style and co power," a story that "feel like
  freespace freespace 2," and confirmed no artist for Sunrider-style
  hand-painted portraits — so Advance-Wars-readable placeholder-style art
  stays the target, nothing to walk back there (the engine's current
  rendering was already built toward that, not toward VN portraits).
  Sunrider's *structure* (two layered maps) is the only piece worth
  borrowing, and stays separable from its art. On tone: this isn't a new
  ask needing new worldbuilding — the project's existing Qiraki/Sinker Wars
  novel bible is already locked toward a grim, casualty-heavy military
  setting with real political rot and a craft rule ("warmth lives in the
  dialogue, the dark lives in the background") that solves the exact
  bright-art/dark-story tension Days of Ruin solved the same way. Given the
  continuity confirmation above, this tone is now the game's tone too, by
  default — worth treating mission briefings, pilot banter, and combat log
  flavor text as under that same style rule rather than reinventing one.

  **Update, 25 Aug 2026 — a staged tone/fidelity roadmap, not a reopen of
  the art call above.** Maxime: "the goal of the game is to be realistic
  gory and goegious like the book project." Checked directly against the
  locked call two paragraphs up before treating this as new direction,
  since "gorgeous" read as visual fidelity is in real tension with
  "placeholder-style art stays the target." Asked directly rather than
  assumed either way, given that tension: what "gorgeous" means for this
  game given the locked placeholder-shape art, and what "gory" means
  concretely for how loss and combat get depicted.

  **Answer: staged, not immediate — "all 3 eventually. but 1st, ist 1."**
  Read as three sequential stages rather than a single visual-scope
  decision: **(1) writing and atmosphere** — mission prose, loss/combat
  description, pilot banter, the same style rule already locked above —
  carrying the "gorgeous and gory" bar first, starting now, no engine work
  required, nothing about the placeholder-art call touched at all.
  **(2) UI/production polish** — presentation quality within the existing
  placeholder-art paradigm (layout, effects, feedback, readability), still
  not real sprites or portraits. **(3) real visual fidelity** — actual art
  investment, the point at which the art-direction call above would need
  to be formally reopened rather than just flagged as in tension.
  Confirmed as the visual-scope answer. The parallel gory-depiction
  question got the same staged prompt in the same round but wasn't picked
  apart separately in the reply — reading it as the same staged logic
  (textual gore now, heavier visual depiction later, if ever) by
  consistency with the visual answer, not as its own explicit
  confirmation. Worth a direct check whenever depiction specifics actually
  come up, rather than treated as settled from one combined answer.

  **Doc flag, per the project's own rule ("say which doc needs
  updating").** This doesn't change the GDD today — Stage 1 doesn't touch
  the locked placeholder-art line at all — but that section will need a
  note added the next time someone's actually in the file, flagging that
  "placeholder shapes, not sprites" is the *current* stage of a longer
  intended arc rather than necessarily the permanent ceiling. Not edited
  here, since that edit wasn't asked for and the .docx itself hasn't been
  opened this session.

  **Not scoped, not started — a concrete Stage 1 starting point, proposed
  rather than decided.** The loss/combat/mission prose already written and
  shipped this session is the obvious first target to run against the new
  bar, since it already exists and needs no new systems to test: the
  sandbox's victim/survivor Stress messages, the mourner ripple text,
  Command Vacuum's message, the Grief Catalyst text, and the Amaranth
  Reckoning's own mission-by-mission prose. A real proposal for where to
  start, not a decision made here.
- **A canon in-fiction calendar with a visible clock — not just a
  completion-time stopwatch, 25 Aug 2026, same day as the mission real-time
  clock above.** Maxime, first asking to log an idea rather than build one:
  "add this to nect thing to add. a game long clock that track how long it
  took you to finish the game. so player can compâre each other." Then,
  unprompted, before this even got written down, sharpened what he actually
  meant: "like a calanda a canon based one. but with obiously a tracking
  clock in it. so player can see how much time passed. becasue its gonna be
  relevant when we do the social game. social stuff take time. and time u
  do social u aint fighting."

  That second message changes the shape of the idea, not just its detail.
  The first read like a pure stat — a stopwatch that stops at the credits,
  existing only to be compared afterward. The second gives it a job
  *during* play: an in-universe calendar, visible throughout the campaign,
  that the social layer (Rec Room, Berths, CO conversations, romance — the
  whole "later" bucket two entries up, parked in
  `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`) spends against. "Time u do social
  u aint fighting" is a real opportunity-cost mechanic, not flavor text:
  every stretch spent on hub activities is calendar time the war keeps
  moving without you, and the total elapsed in-fiction time at the end of
  the 36-mission campaign becomes the number that gets compared between
  players — not "how long you personally sat at your desk," but "how
  efficiently you ran the war," which is a much more interesting stat than
  a raw wall-clock total.

  **Checked against the project for existing precedent before writing this
  down.** Nothing on the Bloom Wars side currently tracks in-fiction
  calendar time — no locked start date, no day-count, nothing in the GDD,
  Data Pack, or Canon Pass. The closest thing that exists is
  `pilot_creator.html`'s "Simulate a Day/Week" buttons, and that sandbox is
  explicit about its own limits (own comment: "a design/tuning tool, not a
  claim about real pacing") — it walks an arbitrary day count to test
  roster/lance logistics, not a real campaign calendar with dates or
  consequences. Genuinely new territory, not something already half-built.
  (Qiraki's book side does have its own locked calendar system —
  deliberately not pulling any of it in here; different project, different
  rules, and nothing about it fits Bloom Wars' own setting anyway.)

  **How this differs from the mission real-time clock directly above —
  worth being explicit, since both are "a clock" and they are not the same
  axis.** That system is real-world wall-clock time — minutes and hours as
  the player's own computer clock ticks them — running only during an
  active mission attempt (BEAM DOWN to Debrief), enforced with a hard
  12-hour fail-and-recall. This calendar is the opposite on every axis:
  in-fiction time, not real-world time; runs across the whole campaign, not
  one mission at a time; and — per "so player can see how much time
  passed," not "so player fails if they take too long" — it reads as a
  visible, ambient number with no obvious fail state attached. Two
  different clocks solving two different problems; don't merge them
  without a real reason to.

  **Real open questions, none answered here, all worth deciding before
  this is buildable:**

  - **What actually advances the calendar, and by how much.** Does each
    mission cost a fixed or mission-specific number of in-fiction days
    regardless of how long the player personally took (making the number
    purely about *choices* — how much social time you bought — not play
    speed at all)? Or does it fold in some version of the just-built
    real-world clock, so a player who dawdles in a live mission also burns
    more calendar time? The first reading fits "so player can compare each
    other" much better — a fair comparison needs the number to reflect
    decisions, not internet connection or how many times someone got up
    for coffee mid-mission.
  - **What social activities actually cost, and whether that's flat or
    itemized.** "Social stuff take time" could mean a flat calendar-day tax
    per hub visit, or a real price list — a Rec Room night costs less than
    a Berths romance scene, a CO conversation costs less than either. This
    is the same pricing work the Favorability/Stress systems (Hub doc §13,
    §11.4) already owe the project once they're actually built — worth
    designing together rather than inventing a second, uncoordinated cost
    model.
  - **Whether elapsed time has any teeth beyond the final scoreboard
    number.** Purely cosmetic (a number shown at the credits, nothing
    reacts to it in play) is the simplest version. A version with teeth —
    the war's own state quietly worsening the longer a campaign runs,
    missions or narrative beats reading differently at day 400 than day
    150 — would fit this project's existing grim, casualty-heavy tone (and
    the Sessile-are-endgame-bosses rule above already treats time-in-
    campaign as a real threat-scaling axis, just for one creature type
    rather than the whole war) but is real design and content work, not a
    formatting choice.
  - **The "compare with each other" part still has no infrastructure to
    run on** — same gap flagged when this was first logged: this is a pure
    local-browser game, `localStorage` only, no accounts, no backend. A
    shareable result (a code, a screenshot-ready end screen with the final
    day count) is the low-cost version; a real leaderboard is the expensive
    one. Whatever gets built here, this is the part that needs real scoping
    whenever it's picked up.

  **Confirmed, same day — the date-stamp shape, specifically.** Floated
  back as a partner suggestion rather than something asked for: if elapsed
  time is visible during play rather than only totted up at the end, it
  could double as a pacing landmark — dating major beats ("Day 47 —
  Muster," "Day 212 — The Reckoning") the way an in-fiction date-stamp
  would, instead of a bare running total in a corner. Maxime: "yeah that
  would be cool. indeed." Locked as the direction *if and when* this gets
  built — doesn't resolve any of the four open questions above (still no
  answer on what advances the calendar, what social activities actually
  cost, whether elapsed time has teeth, or how "compare" would work
  without a backend), just settles what the display should look like once
  those are.

  **Confirmed, same day — this is needed, not just nice-to-have.** Maxime:
  "yeah, we ned the calandar, the whole social aspect of the game is going
  affect player efficency as they run the war." Upgrades this from "an
  idea worth keeping" to "the social layer's actual cost model runs
  through this" — without a calendar, Favorability/Stress/Rec Room/Berths/
  romance are all just flavor with a stress-relief number attached; with
  one, every hour spent on them is a real, comparable cost against how
  fast the war got run. The calendar isn't a side stat *about* the social
  layer anymore, it's the mechanism that makes the social layer's
  trade-offs real.

  Still behind the same "hard loop before the social layer" sequencing
  rule Maxime set himself and the project has held to everywhere else in
  this bucket — that rule isn't touched by this confirmation, and nothing
  above is scoped for building yet. Flagging it plainly rather than
  quietly starting: this is now confirmed *design intent*, not a build
  order — worth a direct check-in on whether "we need this" means "keep it
  locked in and queued" or "start scoping it now," given how much of the
  hard tactical loop has actually shipped at this point.

  **Answered, same day — queued, with a real sequencing plan attached, and
  a new piece of the social layer volunteered along the way.** Maxime,
  keeping the line: "keep it queue. we gonna add the full calandar when we
  are done with the mission building. because after than I want to work on
  the ui for non combat interaction." Concrete phase order, not just
  "later" anymore: finish building out the 36-mission campaign first, then
  move to non-combat UI as its own phase, with the full calendar landing
  inside that phase rather than bolted on separately. Refines the standing
  hard-loop-first rule into an actual order of operations rather than a
  single before/after line.

  In the same breath, describing what "the social part of the game" is
  actually made of rather than just naming rooms: "and the social part of
  the game is gonna be live npc doing life stuff in real time as yopur
  character go out to fight alongside friends, they gonna worry, form
  relationship evolve etc." This is new texture on top of everything
  already parked in `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` and the
  Favorability/Stress systems above, not a separate idea: crew NPCs living
  something that reads as an ongoing life — worrying about a friend who's
  out on a mission, relationships that evolve on their own rather than
  only moving when the player directly triggers a scene. Two things worth
  flagging rather than assuming:

  - **"Real time" is ambiguous in exactly the way the mission clock and
    this calendar already forced a decision on above** — does an NPC's
    worry/relationship-drift tick against the player's actual wall-clock
    time (mirroring `engine/campaignState.ts`'s real-world mission clock),
    or against in-fiction calendar time (mirroring the campaign-day model
    this whole entry leans toward)? The two produce very different
    textures: wall-clock worry means a crewmate's concern is live and
    ongoing the moment a mission starts and would need some kind of
    passive/background update even with the tab closed; calendar-tick
    worry only updates at natural check-in points (debrief, hub visits)
    and reads more like a status the player discovers rather than
    something ticking unattended. Not resolved here — genuinely two
    different systems.
  - **This is the "ambient lines, not branching dialogue" idea from the
    Hub-layer update above, given an actual driver.** That entry already
    proposed a rotating ambient-line pool per pilot, keyed to state
    (recent mission, Stress, wounded, grieving) instead of a real
    conversation tree — "worrying about a friend currently on a mission"
    and "relationship visibly evolving over calendar time" are both just
    new state inputs to that same pool, not a new dialogue system needing
    inventing. Worth designing as one mechanism, not two.

  Not scoped, not started — captured now, alongside the calendar itself,
  since it arrived in the same conversation and clearly belongs with it.
  Both wait for the same trigger: mission building finished, then the
  non-combat UI phase, which is where this whole bucket gets designed for
  real.

  **Answered, same day — the wall-clock-vs-calendar fork above, resolved,
  and it's simpler than either straight answer.** Maxime: "the worry goes
  paralel to mission time. it run until the player exit, what isnt saved
  is lost." Two things locked by that one line:

  - **Real wall-clock, not calendar-tick** — "paralel to mission time"
    points straight at the mechanism already built for the mission clock
    (`engine/campaignState.ts` §9, `missionStartedAt`/`Date.now()` in
    `Battle.ts`): worry accrues against actual elapsed real time, computed
    the same "now minus a stored start" way, not against in-fiction
    calendar days. Answers the fork cleanly in the wall-clock direction —
    the calendar-tick alternative (only updates at debrief/hub check-ins)
    is the one that's set aside.
  - **But deliberately not persisted the way the mission clock is — this
    is the real simplification.** The 12-hour clock survives a closed tab
    on purpose, because a real consequence (the recall) has to fire even
    if the player never comes back; that's why it's written to
    `CampaignState.activeMissionAttempt` on BEAM DOWN. Worry doesn't get
    that same treatment: it runs live only while the session is actually
    open, and "what isnt saved is lost" accepts that closing the tab
    mid-drift just drops whatever accrued since the last real save point,
    no special recovery logic needed. No Boot.ts-style timeout check to
    build for this one, because nothing about it fails if it's never
    resolved — it's ambient, not a clock with a consequence attached.
    Meaningfully less engineering than the mission clock needed, and worth
    remembering that difference instead of assuming this wants the same
    persistence machinery just because both are "real-time" systems.

  Still not scoped, not started, still waiting on the mission-building →
  non-combat-UI trigger above — this just means that whenever that phase
  starts, the wall-clock-vs-calendar and persistence questions are already
  answered instead of open.

## Parked — bigger ideas, not scoped yet

- **Carrier as an ant-base hub**, XCOM Avenger style — a real base-management
  layer between missions (rooms, upgrades, roster management) instead of a
  flat mission-select screen.
- **Company-scale battles** — a later, bigger mode: the player directs ships
  plus waves of mechs across two layered maps (a strategic/ship layer and a
  tactical/mech layer), in the spirit of *Sunrider: Mask of Arcadius*'s
  structure. This is likely where Sunrider's EN-budget system (see above)
  actually belongs, rather than in the mech-tactics layer. Worth remembering
  *why* this one's on the list too: that game's short length left Maxime
  wanting more of exactly this — a design cue, not just a random reference.
  **See the 25 Aug update on the gladiator-matches entry below — Maxime's
  latest pass reads as this idea and that one converging into one mode,
  not two separate ones anymore.**
- **PvP — company-vs-company "gladiator matches"** (new, 22 Aug 2026).
  Maxime, floated explicitly as a "down the line" idea while talking
  through the hard-loop-first priority above, not something to build now:
  a PvP mode pitting one player's built-up company against another's —
  "the vaunted gladiator match between company[ies]" — with his own aside
  flagging the obvious complication: "turn gladiator into rts lol." He's
  right to flag it — a real-time or even careful turn-based fight between
  two full companies (Act III's ~20-pilot battalion scale) stops looking
  like this game's single-squad tactics loop and starts looking like an
  RTS the moment both sides are simultaneously fielding that many units,
  which is a genuinely different engine problem (simultaneous multi-unit
  control, almost certainly real-time or some new turn structure) rather
  than a reskin of the existing one-party-vs-AI mission flow. Also raises
  its own question the moment it's real: a company built through real
  permadeath and player-created recruits (see the resolved permadeath
  entry above) is a company with actual stakes invested in it — losing a
  PvP match would need to *not* mean losing those pilots for real, or
  PvP starts feeling like it's spending single-player progress. Not
  scoped, not started, explicitly a "someday" per Maxime's own framing.

  **Update, 25 Aug 2026 — the AI-opponent question is now a real decision,
  not just a flag.** Maxime confirmed Gladiator's near-term target is a
  single-player fight against an AI that's actually learned from real play
  (his own play, to start, generalizing to whoever's playing) — not a
  placeholder bot, and learning gates the mode rather than the mode
  shipping first and getting smarter later. He separately expects real
  human-vs-human multiplayer, if it ever gets built, would need a
  different, real-time ("Doom style") architecture — "a fair ai to fight
  against at least, i'm sure if we add actual multiplayer itl have to be
  doom style." Full reasoning, the dependency chain this commits to
  (campaign has to substantially exist first, logging real play is new
  engineering, per-player data volume is still thin even across a full
  campaign, squad composition and the turn-scale problem right above are
  both still open), and what's deliberately not decided are in the new
  `claude/Bloom_Wars_Gladiator_Learned_Opponent_v1.md`, not duplicated
  here. **Superseded same day — see below.**

  **Update, same day — scoped down to something shippable, rest stays
  wish-list.** Maxime, after weighing the chain above: "lets fold it in
  the wish list ill get to it when ther emor emission dones." The
  learning-gates-the-mode version above isn't dropped, just no longer the
  plan to build toward first. The practical version: a fair-by-
  construction opponent (same rules and points budget as the player, no
  vision/stat cheats, plausibly a roster that mirrors the player's own
  trained company) using the Player AI plan's own bot, with its heuristics
  hand-tuned from Maxime's actual play the same informal way every other
  balance number in this doc already gets tuned (the Tank-dodge fix and
  the two-action Munti change, both above, are that exact process) — no
  new logging system, no per-player data pipeline, nothing beyond what's
  already committed elsewhere. The full per-player-learning version stays
  on record as the real "someday." Either way, not picked up until more of
  the campaign is actually built — filed here, not scheduled. Full v1/v2
  split in `claude/Bloom_Wars_Gladiator_Learned_Opponent_v1.md`.

  **Update, 25 Aug 2026 (same day, later) — the mode's actual shape, not
  just its AI.** First real content pass on what a gladiator match (and,
  by extension, "Company-scale battles" above — read as the same idea
  now, not two) is actually made of, rather than just how the opponent
  thinks. Maxime, verbatim: "carrier co, legion co, company co. as rank,
  then sword of the stars style space battle with 3 carrier and escort
  and mech fighting, 2 layer the mech micro and the ship micro. gladriator
  during the war fight and gladiator after the war fight. expanded point
  system, heavy mech customisation. allow mech to hurt ships via landing
  on them if the mech reach a ship in time. stuff like that."

  Breaking that down:

  - **Carrier CO / Legion CO / Company CO as rank.** Reads as a command-
    echelon ladder — who's in charge of what size force — not the same
    axis as the personal military rank ladder already locked for pilots
    (2nd Lt. → Capt. → Maj., Antfarm Carrier Hub doc §12, now also live
    in `pilot_creator.html`'s Stage system). **Open question, not
    resolved here:** is this a second, independent progression track
    layered on top of the existing one, or does it replace/reframe it
    for Gladiator mode specifically? Worth deciding before either gets
    built, since the existing ladder is already wired into the pilot
    dialogue system.
  - **Sword of the Stars-style space battle, 3 carriers + escorts, mechs
    fighting, two layers (ship micro + mech micro).** Checked this
    against SotS's actual combat model rather than going on memory alone:
    it's order-based, not direct-control — ships get facing orders
    (broadside/face-target/directional) and movement orders (close
    distance/pursue/stand off/retreat), armor is modeled as "bricks"
    that have to be breached before hull damage lands, and critical hits
    disable specific systems or kill crew rather than just draining a
    health bar (source: SotS combat guide,
    https://steamcommunity.com/sharedfiles/filedetails/?id=179425117).
    That order-based structure is worth stealing on its own merits — it
    might be the actual answer to the "turn gladiator into rts lol"
    scale problem flagged above: the player issues orders to ships
    rather than directly micromanaging them, which is a different
    (and probably much more shippable) engine problem than simultaneous
    direct control of a full company.
  - **Gladiator during the war fight, and gladiator after the war fight.**
    New distinction — the existing entries above only ever assumed
    post-campaign. "During" points at something specific already in the
    campaign: the House Amaranth / Colonel Marrow thread that recurs
    across missions 6/9/10/16/18/20/23/24/28, with Mission 20 already
    named as Marrow's first named mech duel. That's a natural in-fiction
    hook for an in-campaign gladiator-style set-piece — flagged as a
    connection worth remembering, not a decision to build it.
  - **Expanded point system, heavy mech customisation.** Read as depth
    passes on systems that already exist (the points-shop economy, the
    gear-tier/mek-track progression) rather than new systems on their
    own — no further shape specified yet.
  - **Mechs hurting ships by landing on them, if they reach the ship in
    time.** The sharpest new idea in this batch, and the first real
    answer to how the ship layer and the mech layer actually interact
    mechanically rather than just running in parallel. Worth being
    honest about the comparison: SotS's own advanced fleet templates
    already include a named "anti-ship boarding fleet" concept, which
    validates that mechs-vs-ships isn't a left-field addition to the
    reference — but SotS does it with dedicated boarding ships, not a
    single mech mid-fight reaching a target under a time/positioning
    constraint. That makes this a genuinely new mechanic inspired by the
    reference, not a lift from it.

  Still not scoped, not started — this is a first real pass at shape, not
  a plan. Stays behind Gladiator's existing locked wish-list status
  (learning-AI version parked, fair-by-construction version is the
  practical target, neither picked up until more of the campaign is
  built). Full AI-opponent split stays in
  `claude/Bloom_Wars_Gladiator_Learned_Opponent_v1.md`; this update lives
  here since it's about the mode's shape, not the opponent.

  **Update, 25 Aug 2026 (same day, later still) — rank-ladder logic, force
  composition, and a naming-lock catch.** Maxime clarified the CO ladder
  isn't arbitrary naming, it's shorthand for a real command-scale
  structure, verbatim: "carrier co has 1 carrier under his command, and
  all its mech and personal escort. the normal role of a [Qiraki-side
  term, redacted here — see the naming-lock note right below]. so the
  normally apoint house role. the backseat commander that live half a
  galaxy away. then the legion commander was my name for wehn player earn
  right to have 2 carrier under its control. escort and mech, there is 5
  lance per carrier. mc in game only command up to 3. pvp is its own
  thing and a far away plan. so legion has 10 lance of 5 mech and 2
  carrier and 8 escort ship a mix of destroyer and a cruiser and a single
  battleship. then its company commander, a company is the gladiator name
  for a full military group. like multiple RL carrier group seceding
  from the us to go live in deep water. they'll follow one guy. thats a
  merc company. it kept its name because it was a corp that use to own
  the entire group. now its the gouvernement. because of the war"

  **Naming-lock catch, flagged before this got written down as-is.** The
  "backseat commander that live half a galaxy away," House-appointed,
  normally-absentee framing Maxime used to describe the Carrier CO role,
  plus the one specific word redacted in the quote above, reads as the
  Qiraki side's own political-command structure (a House officer holding
  nominal command while a professional actually runs things day to day),
  not something built for Bloom Wars. Not claiming that word is
  necessarily *the* undisclosed lint-rule term itself — that's not known
  here either — but it's clearly book-side vocabulary crossing into game
  material, which the project's shared rule says not to do unless a
  master index explicitly calls it a deliberate cross-reference, which
  nothing here does. Redacted it out of this doc rather than write it
  into permanent game material either way.

  Good news: Bloom Wars already has its own native version of the exact
  same idea, no borrowing required. The Independent Campaign doc's "Seal
  and the Sword" (§4): a charter House's battlegroup is nominally
  commanded by a House officer holding its seal — political, not
  necessarily competent — while a professional soldier actually runs it
  day to day. Already the shape of Colonel Marrow's own arc. Used that
  below instead. Flag it back if this reads wrong, or if that word was
  actually a typo for something else entirely — nothing below is locked.

  **The ladder, using that substitution:**

  - **Carrier CO** — 1 carrier under command: its full mech complement
    and personal escort. Framed as the Seal role at this scale, and
    **the player holds it, not an NPC** — corrected 25 Aug 2026 (same
    day, later still) after Maxime clarified: "yeah, thats what I meant
    by the carabil. the player is the house apointed commadner backseat
    driving from far away. you know, videogame logic given sense." MC is
    the House political appointee, genuinely the "backseat commander half
    a galaxy away," while whoever's actually running the carrier day to
    day in the field is the Sword underneath the player, not the other
    way around — see the update below for what that's doing double duty
    for.
  - **Legion CO** — earned once the player's force grows to 2 carriers
    under command. Composition: 5 lances per carrier (10 lances total in
    the Legion's roster), 8 escort ships — a mix of destroyers and
    cruisers plus a single battleship. The 5-per-lance, 1-Munti-minimum
    lance definition isn't new — same unit the Antfarm Carrier Hub doc
    and the live pilot-creator sandbox already use. Worth calling out
    explicitly: MC's own per-mission command cap stays at 3 lances (15
    units) even at Legion scale — Maxime confirmed this directly ("mc in
    game only command up to 3"), which means Legion CO grows the *total
    strategic pool* of available forces, not what actually gets fielded
    in any single engagement. That's the same 15-unit number the Antfarm
    Hub doc already flagged as wanted-but-not-built in the real engine —
    this doesn't add a second, bigger number to reconcile, it's
    consistent with the one already on record.
  - **Company Commander** — top of the ladder. "Company" here is Warden
    Company itself: Maxime's framing is multiple legions operating
    together, compared to several real-world carrier strike groups
    seceding to go independent, following one commander — a merc company
    in practice. New backstory for why the name stuck: it was originally
    a corporation that owned the entire military group outright, and the
    war effectively turned that corporation into the group's government
    without the name ever changing.

    **Flag — this touches existing canon, not just Spitball.** The
    Independent Campaign doc's own §6 already explains why "Warden
    Company" keeps its name past company scale: "nobody in it wants to
    change it" (sentimental). Maxime's new corp-turned-government
    explanation isn't necessarily a contradiction — a structural reason
    underneath a sentimental one holds together fine — but the two
    versions haven't been reconciled anywhere, and this is exactly the
    kind of thing the project's own rule flags: a decision in chat that
    touches something already written should say which doc needs
    updating. This one's Canon Pass and/or the Independent Campaign
    doc's §6, not Spitball — recording the idea here since that's what
    was actually asked for, not doing that rewrite unprompted.

  PvP stays exactly where it already was — "its own thing and a far away
  plan," Maxime's own words again this time, matching every prior pass on
  this entry. Nothing above changes that.

  **The player-as-Seal correction is worth more than a fix — it answers
  two open questions from earlier in this same entry at once.** First:
  why does control feel different at Gladiator scale than in a normal
  campaign mission, where you're directly piloting Rourke? Now there's an
  in-fiction reason instead of just an abstraction — the player literally
  isn't on the carrier. They're a remote political commander issuing
  intent, not a hands-on pilot, which is exactly the justification the
  SotS-style order-based control scheme above needed: you're not
  micromanaging units because your character wouldn't be able to, they're
  half a galaxy away. Second: the Seal-and-Sword doc itself says Seal
  holders are normally "political, not necessarily competent" — a figurehead,
  by design, distinct from whoever's actually good at the job. A player
  who's also spent the whole campaign as a genuinely skilled pilot (the
  personal 2nd Lt./Capt./Maj. ladder, earned in the field) becomes a Seal
  holder who's actually competent, which the setting itself treats as
  unusual. That's a real character beat sitting unclaimed here: other
  characters would have reason to notice and remark on it, not just the
  player quietly being good at two unrelated things. Not written into
  anything yet — flagging it because it's exactly the kind of connection
  worth catching before this mode gets built, not after.

  Still not scoped, not started. This pass is shape and internal
  consistency-checking, not new commitments.

  **Update, 26 Aug 2026 — a three-way pressure for "Gladiator during the
  war" specifically: the rival company, the Bloom, and a rare forced-
  cooperation event.** Maxime, verbatim: "gladiator battle during war mode
  will have bloom incursion happening live between the fight and the bloom
  incursion level depend on chance. there gonna be a 1% chance to have a
  gigafish invasion appear. and it take both player team[s] their use of
  the 'blackhole' weapon to kill the gigafish. i want gigafish event to
  force player to cooperate. killing bloom give extra military point.
  killing the other team give point too. the player will have to fight
  both at once."

  **⚠ NAMING LOCK CATCH, 26 Aug 2026 — everything below quoting "Gigafish"
  or "the blackhole weapon" is blocked on a rename, not cleared to build
  as-worded.** Checked "it's in the military era doc, I'm sure" (Maxime's
  own hunch, said later while pitching the ship-combat layer below) —
  correct, just the wrong project's Military Era doc. `Qiraki_Concept_v4.md`
  has "Blackhole weapon, LOCKED": an artificial blackhole, kills
  indiscriminately, size scales with the mass it hits. `Qiraki_Weapons_
  And_Progression.md` goes further — dreadnought-mounted, used against an
  extreme-tier threat, no friendly-fire protection, size scales with the
  target's own size. Same doc's threat taxonomy calls that extreme-tier
  threat "Gigafish," and calls deployed pilots "Synkers" (the word Maxime
  separately used for Gladiator's 125 PvP pilots, below). All three are
  Qiraki-native coined terms, not generic English, and `tools/lint-
  spoiler.mjs` already carries a dedicated soft tripwire for a "Synker"-
  adjacent phrase — strong signal this word family is exactly what the
  Build Brief's "absolute" naming lock exists to catch, even without
  knowing whether one of these three is literally the hidden
  `BW_RESERVED_TERM` itself. The mechanic underneath (rare world-ending
  threat, one big forced-cooperation superweapon) is fine and staying —
  only the words need to change. Thrown-out, non-final replacement
  candidates: the creature as "Colossus," "Broodmaw," or "Swarmheart"
  instead of Gigafish; the weapon as "Collapse Charge," "Gravity Well," or
  "the Eclipse" instead of blackhole weapon (sits next to Severance's own
  naming); the pilots just as "pilots," no new coinage needed. Not
  resolved here — flagged for Maxime to pick or override before this
  entry's wording is treated as final, and the two bullets right below
  still use the original words pending that call, left as-is rather than
  silently edited so the record of what was actually said isn't lost.

  This is specifically the "during the war" half of Gladiator (the
  in-campaign version tied to the House Amaranth/Marrow thread, per the
  distinction drawn earlier in this same entry) — not the post-campaign
  version. Three pieces, worth naming separately even though the message
  presents them as one idea:

  - **A live Bloom incursion running underneath every "during the war"
    match, severity randomized.** Not an occasional twist, the baseline
    condition — every one of these matches has Bloom activity happening
    "live between the fight," and how bad it is comes down to chance each
    time. Turns a 2-sided PvP fight into a 3-way pressure by default: the
    rival company, the Bloom, and whatever the incursion roll produced.
  - **Gigafish — new to Bloom Wars, 1% roll, no existing Bloom Wars
    definition.** *Correction, same day, see the naming-lock catch above:
    "first time this name has shown up in either project" was wrong —
    it's a LOCKED term in `Qiraki_Weapons_And_Progression.md`'s threat
    taxonomy, not a coincidence. Blocked on a rename before this is real;
    reasoning below about Bloom Wars' own category fit still holds once
    it has a Bloom Wars name.* Not in the Bestiary, not in the
    sessile/boss-tier discussion elsewhere in this doc. Reads as its own
    rare "world event" tier, one level above even the sessile
    boss-tier rule already locked ("sessile are absolute monster... meet
    one too early and you die," above) — where that rule is about a
    *mission* going wrong if you're underleveled, this is a *rare event*
    that can land on top of an already-running PvP match. Worth deciding
    whenever this gets picked up for real: is it a sessile archetype
    specifically, or its own new category outside the Bestiary's existing
    movement-type taxonomy entirely?
  - **The blackhole weapon, and the forced-cooperation design goal —
    stated directly, not left implicit: "i want gigafish event to force
    player to cooperate."** Both companies have to use it together to
    kill the Gigafish — no existing weapon by this name in the Data Pack,
    the Bestiary's weapon-type list, or the Heirloom/Severance system
    above (closest existing precedent is Severance itself, "it's tech,
    not magic," always hits friend and foe — a blackhole weapon sounds
    like it could be a Gladiator-scale sibling to that idea rather than
    a ground-combat ability, matching the "expanded point system, heavy
    mech customisation" depth-pass already flagged for Gladiator above,
    but that's a guess, not stated). Real open question, not answered
    here: does using it require literal coordinated input from both
    players (a shared-charge or simultaneous-activation mechanic), or is
    it more that both sides are incentivized to stop shooting each other
    and let one side use it? The design goal is clear even though the
    mechanism isn't.

  **Scoring interaction worth flagging as a real balance question, not
  just flavor.** "Killing bloom give extra military point. killing the
  other team give point too." — both objectives pay out on the same
  points economy, at the same time, which is exactly what makes this a
  three-way fight rather than a PvP match with an environmental hazard
  bolted on. Undecided: are the two point values meant to be comparable
  (a real choice between farming Bloom kills or pressing the human
  opponent), or is Bloom-killing meant to read as the lesser, secondary
  payout precisely because ignoring the incursion long enough presumably
  gets dangerous on its own? Not answered by the message as given.

  **Update, same day — the points themselves have a job, not just a
  score.** Maxime, immediately following: "point work like world of tank
  grey tint economy. used to repair and outfit your merc team." Checked
  against how World of Tanks' Credits economy actually works before
  writing this down, rather than going off a loose impression of "WoT
  economy": Credits are WoT's single general-purpose earned currency
  (separate from Gold, the real-money/premium currency) — earned mainly
  from damage dealt in a match, plus spotting/assist damage and a
  victory bonus, and spent on nearly every recurring cost of staying in
  the fight: repairs, ammo resupply, crew training, modules. The specific
  mechanic worth borrowing on purpose: repair cost scales with how much
  damage the vehicle took, and costs more if it was destroyed outright
  than if it survived banged up — damage taken has a direct bill attached,
  not just a stat that resets next match. (Sources: WoT Strategy Guide,
  https://worldoftanksguide.com/guide-game-currency.shtml; BoostRoom's
  service-cost breakdown, https://boostroom.com/blog/service-costs-explained-repairs-resupply-post-battle-expenses.)

  Reading Maxime's line against that mechanic: Gladiator's military points
  aren't a leaderboard number, they're the currency that keeps a merc
  company combat-capable — win a match (or farm Bloom kills, or beat the
  rival team, per the scoring question above) and the payout is what pays
  for the repairs and re-outfitting the *next* match needs. That's a real
  answer to a question the "expanded point system, heavy mech
  customisation" line (above, in the same Gladiator update) left open —
  what the points are actually *for*, mechanically, not just how many of
  them there are.

  **One thing worth flagging on purpose, since WoT is the explicit
  reference and this is exactly the failure mode that reference is best
  known for:** WoT has a well-documented "negative economy" problem at
  its higher tiers, where repair/ammo/consumable costs on a loss can
  meet or exceed the Credits a non-premium player earns from that same
  battle — several guides describe tech-tree tanks as flatly unprofitable
  from Tier VIII up without a premium account or premium vehicle
  subsidizing the grind. If Gladiator borrows the repair-cost-scales-
  with-damage mechanic without also deciding how a losing team stays
  solvent, this project would be importing that same problem by default
  rather than by choice. Not a reason to avoid the mechanic — the
  damage-has-a-bill idea is exactly the texture Maxime asked for — just
  worth deciding on purpose whether a bad Gladiator match can leave a
  company unable to afford its next one, the way it can in WoT, or
  whether there's a floor under it.

  **Also open, not decided here: is this the same points economy the
  main campaign already runs (Hangar shop, gear tiers, spare mek parts),
  or Gladiator's own separate currency?** The message says "your merc
  team," and Gladiator's own command ladder (Carrier CO/Legion CO/Company
  CO, earlier in this same entry) is framed as a distinct scale from the
  personal campaign — worth deciding whether that separation extends to
  the economy too, or whether Gladiator spends and earns against the same
  pool the campaign already uses.

  **Update, same day — two payout rules: no draws, and a real cost to
  quitting.** Maxime: "the player can do whatever they want. but if there
  is no victor. they get no point. if a player leave. he get fined for the
  media outlash and they get no point for the mission." Two separate
  rules, worth keeping distinct:

  - **No victor, no points — reads as absolute, not a partial-credit
    rule.** As stated, this doesn't carve out an exception for the
    per-kill income described above (Bloom kills, rival-team kills) — "no
    point" is unqualified. Worth flagging plainly rather than quietly
    reconciling it: taken literally, this is now in real tension with
    "killing bloom give extra military point, killing the other team give
    point too" from the same conversation, since that reads as continuous
    income *during* the match regardless of how it ends. Two ways this
    could resolve, neither decided here: either the per-kill points are
    provisional and only actually pay out if the match reaches a real
    victor (the likely reading, since it's the one that makes "no victor,
    no point" mean anything), or "no point" refers only to a separate
    victory bonus stacked on top of kills that always pay. Worth a direct
    check whenever this gets scoped for real, since the two readings
    produce very different incentives — the first makes stalling a real
    match strictly worse than committing to a fight, which lines up with
    "the player will have to fight both at once" being the intended
    pressure in the first place.

    **Resolved, same day.** Asked directly which reading was meant —
    Maxime: "if they farm bloom before fighting it out. who care?" Confirms
    the strict reading: "no victor, no point" is absolute, full stop, and
    the order a player does things in doesn't matter to it. Farming Bloom
    kills for a while before ever engaging the rival team isn't an exploit
    worth guarding against, because it doesn't get anyone out of eventually
    needing a real victor for any of it to pay — there's no version of
    "stall forever, cash out anyway." Sequencing is a free strategic
    choice; the payout gate is the outcome alone, not the process.
  - **Leaving mid-match costs twice, and one of the two costs is a
    fiction-grounded penalty, not just an anti-quit tax.** No points for
    that mission (straightforward, matches the no-victor case functionally
    — an abandoned match is a kind of no-victor outcome) *plus* a separate
    fine, specifically framed as a media/reputation consequence rather
    than a bare mechanical penalty. Worth naming why that's a good fit
    rather than an arbitrary flourish: this project already grounds its
    mechanics in fiction on purpose whenever it can (the Seal-and-Sword
    political framing for the CO ladder, Warden Company's corp-turned-
    government backstory, both earlier in this same entry) — "media
    outlash" gives Gladiator a standing in-world reason abandoning a match
    is costly (it's a broadcast/spectated event with real public stakes,
    not just a private skirmish) rather than leaving quitting penalized
    for pure game-design reasons with no in-fiction voice. Open question,
    not answered here: is the fine a flat amount, scaled to something
    (how far into the match, rank/scale of the force involved), and does
    it come out of the same Credits-style pool from the update above or
    hit something else (standing/reputation, if that ends up a tracked
    number of its own).

  **Update, same day — "after the war" gets its own, lighter economy, not
  the same one.** Maxime: "gladiator after the war? the repair are free.
  but you still need point to upgrade train and outfit your company."
  Everything logged above in this update (the WoT-style repair-costs-
  points mechanic, no-victor-no-points, the media-outlash quit fine) reads
  as specific to the "during the war" variant — this is the first time the
  "after the war" variant (the original, older half of this same entry,
  before the Bloom-incursion idea existed) got its own economy stated
  rather than assumed to share one. Repairs cost nothing in "after," which
  sidesteps the WoT negative-economy risk flagged above entirely for this
  variant specifically — there's no damage-has-a-bill tension to worry
  about if damage never bills anyone. Points still matter, but for a
  different job: progression (upgrade/train/outfit) rather than upkeep.
  That reads as a much closer cousin to the main campaign's own existing
  points-shop economy (gear tiers, mek-track investment, Debrief payouts)
  than to anything WoT-shaped — worth checking directly whenever this is
  scoped for real, since "upgrade, train, and outfit your company" is
  close enough to that existing system's own job description that this
  might not need a new economy invented at all, just that one extended to
  Gladiator scale. Not stated outright, but a reasonable inference now
  sitting next to a real fact rather than a guess: "during the war" is
  where the repair-cost/no-draws/quit-fine pressure actually lives, and
  "after the war" is comparatively the low-friction, long-session mode —
  fitting given "during" is a live 3-way fight with a rare forced-
  cooperation event bolted on, and "after" is the one Maxime's earlier
  framing already called the more casual "someday" endgame.

  **Update, 26 Aug 2026 — Gladiator gets a second permadeath exception, and
  this one's scoped by mode, not by character.** Maxime: "I'm sure if I add
  in perma death is still part of the game I'll get people mad at me. So
  hard rule: I'm gonna bend on my realistic dream. Once." His own words for
  it — "hard rule," not a maybe — put this in the same locked-decision
  category as "no victor, no points" above, not an open question.

  Worth being precise about what this touches, because it's the single
  most carefully negotiated system in the project. The existing rule
  (`claude/build_log/engine_systems/permadeath_and_commander_down.md` §"Live
  permadeath," `engine/campaignState.ts`'s `evaluatePermadeathCheck`) is a
  real, live roll on every downed pilot, with exactly one exception carved
  out so far: "the only character that is safe is the mc" — Dessa Rourke
  ("Lark") is mechanically exempt, the sole unkillable unit in the roster,
  everyone else is exposed. That exception is scoped to a *character*: it
  travels with Rourke regardless of what mission or mode she's in. This new
  one reads as scoped to a *mode* instead: something about Gladiator
  specifically softens permadeath for everyone in it, Rourke included or
  not, campaign missions unaffected either way. Two different shapes of
  carve-out to the same rule, sitting side by side rather than one
  replacing the other — worth keeping straight so a future pass doesn't
  conflate them or assume the second implies loosening the first.

  What isn't in Maxime's message, and is the real open question before this
  is buildable: the actual mechanism of the bend. "Bend," not "remove," so
  the going-in read is that Gladiator keeps *some* stakes rather than going
  full no-consequence arena mode — but the message doesn't say which of
  several plausible shapes that takes. Candidates, none confirmed: downed
  pilots in a Gladiator match simply don't run the permadeath check at all
  (closest to a literal mode-wide exemption, mirroring how Rourke's
  exemption works today, just applied to a mode instead of a person);
  permadeath still fires but losses don't carry back to the main campaign
  roster (stakes exist within the match — you can still lose the fight
  because your pilot's down — but the game world's actual roster is
  insulated, so a bad Gladiator run doesn't cost a mercenary you were
  counting on for Act 3); or something narrower still, like permadeath
  applying normally "after the war" (post-campaign, roster consequences
  moot anyway since the story's over) but being the mode that's softened
  "during the war" (where a lost pilot could otherwise mid-campaign-wreck a
  save). Not picking one here — flagging that the message alone
  under-determines it, and this is exactly the kind of thing worth
  confirming directly with Maxime before it's ever scoped for real, given
  how much weight the base rule has carried up to now.

  **Resolved, same day, in two more exchanges.** First, Maxime ruled out
  the "check doesn't run at all" candidate himself: "there should be a
  real cost to losing or we will waste the best part of the game. the
  social engine" — a mode-wide exemption gives the reaction/rumor/grief
  system nothing to react to, which is exactly the waste he's naming.
  Second: "they can already farm their way into s-rank on a single
  mission. lets give them ironman pvp" — the campaign's own mission-
  replay loop already lets a player retry until they get a clean run
  (confirmed against `Bloom_Wars_Data_Pack_v0.1.docx` §12.3's per-mission
  bonus criteria and the mission clock's confirmed relaunchability), so
  Gladiator doesn't need to be the game's soft corner too — it can be the
  hard one. "Ironman" here reads as: the match, once entered, is final —
  no reload, no requeue to dodge a bad outcome — which is the same
  underlying move as the media-outlash quit fine above, generalized
  ("leaving to avoid a bad result" and "quitting to avoid a bad result"
  are the same exploit). Third, from the ship-combat pitch further down
  this entry: "ill bend my usual hard rule on realistic to allow player to
  keep their pvp rooster. (yes separate rooster between pvp and pve)" —
  names the actual mechanism at last. Full permadeath check, full teeth,
  no exemption, fires exactly like the campaign's — it just fires against
  a Gladiator-specific company (up to 5 carriers, 25 pilots per carrier —
  125 pilots at a full roster) instead of the named campaign squad. All three pieces now fit one consistent design: real, permanent,
  ironman-strict loss, scoped to a roster built and risked specifically
  for Gladiator, so the social engine gets real material to react to
  without a bad PvP night costing a mercenary three acts of campaign
  investment. One cost this design carries, not free: those
  Gladiator pilots need actual names and a catalyst voice for the
  reaction engine to have anything to grieve — not disposable numbers —
  which the "natural balance" generated-recruit system (built for
  backfilling campaign Muntis, a few sections up) can likely serve double
  duty for rather than needing its own new generator.

  **New, 26 Aug 2026 — a mode-select easter egg names the mode out loud.**
  Maxime: choosing to enter PvP shows the line "I was told not to give you
  permadeath, you're lucky" — a fourth-wall wink at his own real-world
  hesitation (the "hard rule, I'm gonna bend" framing that started this
  whole thread) rather than anything a campaign character would say.
  Clicking "lucky" opens a small box that just reads "(PVP Ironman)" —
  the joke's punchline: the claimed leniency is undercut by the label
  right there, since Ironman is the least lenient thing on offer, not the
  most. Worth flagging as new territory tonally, not just mechanically:
  everything else in this project stays in-fiction (the Hub's ambient
  lines, mission briefings, "COMMAND DOWN"/"RECALLED" overlays) — this is
  the first moment anything in Bloom Wars talks to the *player* rather
  than the *commander*. Not necessarily a problem, just worth deciding on
  purpose whether that's a one-off exception for the PvP entry point
  specifically or a tone this project is now open to elsewhere.

  **Resolved, same day.** Asked directly what the confirm step was —
  Maxime: "a small box they can fill to opt in the lobby for ironman
  pvp." So the "(PVP Ironman)" box isn't just a label, it's the opt-in
  control itself — filling it (a checkbox/tickbox reading, most likely,
  though the exact widget isn't pinned down further than "fill") is what
  commits the player and moves them into the matchmaking lobby. Clean
  single-step flow: click "lucky" → box appears naming the mode → fill it
  → into the lobby. No separate "Ready" screen needed on top of it.

  **New, 26 Aug 2026 — two lobbies, not one, and the softer one has a real
  mechanism now, not just "less bad."** Maxime: "i want two lobby, the
  ironman one and the non ironman one. where loss is simulate with mental
  backlash from ship recall function." This is the actual resolution to
  the whole back-and-forth that started this entry's permadeath thread —
  not a walk-back of the Ironman design above, a second option sitting
  next to it. Ironman lobby: everything already logged — real permanent
  loss, no retry, Gladiator's own separate roster. Non-Ironman lobby, new:
  a "loss" doesn't cost the pilot at all — it's simulated as a **ship
  recall**, reusing the mechanic and even the visual language that
  already exists for voided mission attempts (`Boot.ts`'s `drawRecallNotice`
  / the "RECALLED" overlay, `campaignState.ts`'s 12-hour timeout recall —
  Maxime's own prior line on that system, "forcefully recalled to ship for
  a dressing down by the CO," is the exact tone this borrows). The pilot
  comes back intact. What makes this not a consequence-free arena mode is
  the second half of the line: **mental backlash** — a real hit, just not
  a permanent one. Reads as the first concrete trigger proposed for
  Stress (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.4, the parked morale/
  stress axis — currently only speced against losses, mission difficulty,
  and rest) rather than a new, uncoordinated number. Gives Gladiator a
  clean two-tier stakes ladder that finally answers the original backlash
  worry without touching the Ironman design at all: players who want real
  stakes queue Ironman, players who don't queue the other lobby and still
  feel something when a match goes badly, they just don't lose the
  pilot. Open, not answered by the message: how big a Stress hit "mental
  backlash" is meant to read as relative to a real loss elsewhere in the
  game (presumably smaller, to keep the two lobbies feeling meaningfully
  different — but not stated), and whether it's per downed pilot or per
  match.

  Not scoped, not started — same holding pattern as the rest of this
  entry: Gladiator waits on more of the campaign being built first. Logged
  now, per Maxime's own "log this," so the shape and the open questions
  aren't lost by the time it's picked up.
- **Character mod kit + map editor** (new, 22 Aug 2026). Maxime: "eventually
  I want to build a character mod kit with the map editor so player can
  make their own shit up." Genuinely well-aligned with a decision already
  made rather than a pivot: the engine was built data-first from the start
  (Build Brief §2.3) — units, meks, maps, abilities all live as plain data
  (`src/data/*.ts`), separate from the engine logic that runs them
  (`src/engine/*.ts`, which is barred by lint from even importing Phaser).
  A modding layer is close to "expose a UI over data that already exists in
  this shape" rather than a rearchitecture. Two real design questions this
  raises, worth deciding before building rather than after:
  - **Canon vs. custom separation.** Given the continuity confirmation
    above (the roster is real book characters, on purpose), a mod kit that
    lets players freely rename/reskin/redefine those same characters risks
    muddying canon — probably wants a clear boundary, e.g. a
    "workshop"/custom-content space that's obviously separate from the
    campaign roster, the way most moddable story games keep official
    content and player content visibly apart. **Sharper now, 22 Aug 2026:**
    this stopped being a hypothetical the moment the permadeath entry
    above made player-created pilots a real, load-bearing gameplay system
    (rotating cast, "natural balance") rather than a sandbox curiosity —
    the two efforts (an official recruit-creation system and a full
    community mod kit) are close cousins and probably want to share
    infrastructure; worth designing the recruit creator with half an eye
    on the mod kit rather than building them twice.
  - **Data format for moddability.** Current unit/mek/map definitions are
    TypeScript modules, which need a recompile to change. A real in-game or
    external editor eventually wants those as data files (JSON or similar)
    loaded at runtime instead — not an urgent change now, but worth keeping
    in mind so today's data-first choice doesn't quietly become
    TS-first-and-therefore-not-actually-moddable by the time this gets
    built.
  Not scoped or started — flagging the fit and the two open questions now
  so they're on record, not proposing to build any of this yet.

  **Update, 26 Aug 2026 — the full shape arrives: hub, mission, character,
  and story, unified under one ambition.** Maxime, in a single back-to-back
  exchange: "player should be able to design their own carrier hub, and
  living space. make their own mission, create their own dude. make their
  own story with what we are giving them." Then, asked directly whether a
  Hub editor means personal decoration or a real level editor, and whether
  a built hub is private or shareable: "as much freedom of expression as
  possible." That answers both questions the same way — not a narrow menu
  of options, the actual Warcraft-3/Creation-Kit-style ambition this
  entry's own opening line already pointed at ("player can make their own
  shit up"), now stated as a governing principle rather than left implied.

  Four pillars, not one, and worth being honest that three of them already
  exist somewhere in this project — this is the moment they get named as
  parts of the same thing instead of separate asks:

  1. **Character creation.** Already fully designed —
     `Bloom_Wars_Character_Editor_v1.md`, "design pass only, zero code, per
     Maxime's own explicit call," prototyped hands-on in `pilot_creator.html`.
  2. **Mission/map creation.** Already designed in tiers, GDD §13,
     "Post-launch: a scenario editor," reasoned from Warcraft 3's own
     precedent by name ("the game's architecture exposed to the player").
     Tier 1 (terrain/placement, deploy zones, unit drops, objective picker)
     is locked "Yes, commit — if [data-first] holds." Tier 2 (event →
     condition → action triggers) is locked "Later," flagged as "the real
     WC3 value proposition and the real engineering lift."
  3. **Hub/living-space creation.** Brand new, first named the day before
     this update, no design doc yet. Worth naming the concrete evidence
     rather than treating this as hypothetical: `Hub.ts`, built this same
     session, hardcodes its room shape and NPC roster as literal TypeScript
     constants (`ROOM`, `NPC_SEED`, a hand-placed positions array) — hits
     the exact same data-format wall as the other two pillars, today, in
     code that already exists.
  4. **"Make their own story with what we're giving them."** This is GDD
     §13 Tier 2 by another name — the trigger/event layer is what turns a
     placed mission into an authored story instead of just a populated
     map, using the same building blocks the real campaign already runs
     on (mission events, the Hub's own message-propagation system built
     this session, Favorability once it exists for real). Already on
     record as the tier with the highest value *and* the highest cost.

  **Being straight about size, since "as much freedom of expression as
  possible" deserves an honest answer, not just a nod.** This is the
  single biggest ambition on record for this project — bigger than any one
  system discussed so far. The closest real analogues — Warcraft 3's World
  Editor, Skyrim's Creation Kit, Baldur's Gate 3's toolset — all shipped
  years after their respective base games, built by dedicated tooling
  teams, and are a real part of why those specific games still have active
  communities a decade-plus later. That's the right company for this idea
  to keep, not a reason to shrink it — but it earns a plain, undramatic
  statement of scale rather than a quiet nod along.

  **The one shared unlock, named three separate times now in three
  different places, converges into a single first step.** Character
  Editor doc §6, this entry's own "Data format for moddability" bullet
  above, and pillar 3 above (`Hub.ts`, today) all independently hit the
  identical wall: the data any of this would need to edit — units, meks,
  maps, the Hub's own NPC/room layout — lives in compiled TypeScript,
  which needs a recompile to change. None of the four pillars is buildable
  for a real player until that becomes a runtime-loadable format (JSON or
  similar) instead. Whichever pillar gets picked up first, that migration
  is the actual first engineering step, not any one editor's own UI.

  Not scoped, not started — behind the same hard-loop-first sequencing
  rule as everything else in this bucket, and now the single largest thing
  waiting behind it. Worth a real conversation, whenever it's time, about
  which pillar goes first rather than trying to design or build all four
  at once.
- **Maps/engine as a lightweight TTRPG virtual tabletop** (new, 22 Aug
  2026). Maxime: "if they can play their ttrpg on my maps and engine, itl
  be pretty cool" — a follow-on from the mod-kit idea above, but worth
  keeping as its own line item because it's a genuinely different use case,
  not just more of the same one. A real tabletop session generally wants
  freeform token placement and movement (no move-range highlighting, no
  action economy, no forced turn order), fog of war a GM controls by hand,
  and some way to roll dice / track arbitrary HP or stats that have nothing
  to do with Bloom Wars' own unit stats — none of which is what
  `engine/mission.ts` actually does today; that file *is* the Advance-Wars
  tactics ruleset (move+attack economy, the validated combat resolver,
  win/loss conditions). The map/grid/rendering layer (map editor output,
  `engine/grid.ts`, the Battle scene's tile rendering) is genuinely
  reusable as-is for this. The turn/combat engine is not, and wouldn't
  need to be — a TTRPG mode would sit *beside* Mission, as its own
  freeform sandbox mode over the same maps and tokens, not a reskin of the
  tactics rules. Worth remembering as "reuse the map editor and renderer,
  build a separate freeform mode" rather than "make the existing engine
  more flexible," if this ever gets scoped for real.

---

Sources on Sunrider's combat system (checked 22 Aug 2026):
- [Sunrider – General Tactics and Upgrade Guide (Steam Community)](https://steamcommunity.com/sharedfiles/filedetails/?id=702397311)
- [Sunrider: Mask of Arcadius Combat Walkthrough (Steam Community)](https://steamcommunity.com/sharedfiles/filedetails/?id=953990063)

Source on XCOM 2's action-point rule (checked 22 Aug 2026):
- [Medikit (XCOM 2) — XCOM Wiki](https://xcom.fandom.com/wiki/Medikit_(XCOM_2))

Add to this whenever something comes to mind. I'll keep it organized and
pull items into the real docs (GDD / Data Pack / Canon Pass) once they're
actually decided.
