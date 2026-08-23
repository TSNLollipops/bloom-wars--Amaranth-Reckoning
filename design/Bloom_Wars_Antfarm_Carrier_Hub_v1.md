# THE BLOOM WARS — The Antfarm: Carrier Hub & Between-Mission Story Layer v1

**A design pass turning two things into one thing — NON-CANON where it touches the Amaranth Reckoning, additive everywhere else**

*Written 22 August 2026. Answers two asks that turned out to be the same feature: "add Sunrider-style story moments between missions" and "start planning the antfarm carrier — workshop, heirloom, energy, more squads, faster ship fires." Both point at the same screen. This document builds that screen.*

**Update, same day, after the permadeath/recruit-phase design landed.** That design (full reasoning in `claude/Bloom_Wars_Spitball_Ideas.md`, practical summary in the campaign doc's new §6a) needs a real UI home starting Mission 1 — the deploy gate and the recruit tracks aren't Act-II-only, they're live from Muster onward. That collides gently with this doc's own §9 recommendation ("Tier 1 lands alongside Act II's prototype... not before Act I is proven") and its §1 claim that "Act I has no hub." Reconciled in the new §6a below rather than silently changed: the *engine and data* this system needs are being built now, starting with Act I, because they have to be; the *Antfarm identity* — Providence, the room fiction, the banter — still waits for Act II exactly as originally planned. Act I gets a plain, unbranded meta-screen shaped like the future rooms; Act II is where it becomes the Antfarm for real.

**Update, 23 August 2026 (cont'd) — five of §11.2's open questions resolved.** Maxime's calls, verbatim where it matters: Weapons Bay "reduce cd on 14 weapon by half" (flat effect, not a menu — the ability itself still unlocks at Mission 14 exactly as §1 already had it); Generator "allow you to power fabricator and other heavy room" (the heavier, genre-faithful option — a real power budget, not just a bigger Energy cap); Beacon and Restock Room "yes separate," Restock Room's job specifically to "reduce the after effect of a restock"; and stress/willpower gets a real shape even though it's not being fully designed yet — see the new §11.4. Rolled into the §11.2 table and a new §11.4 below rather than rewritten in place, same as this doc's other updates. Maxime's framing: "an XCOM type ant farm... we are going to add new room to it as I think of them," buildable "as soon as they can in act 1, except for arc specific locked thing." This turns §3's Carrier Upgrade Modules from an abstract points-spend with no spatial representation into what he actually pictured — a literal build grid, twelve bays around a new, sixth fixed compartment (the CO's grotto) that isn't one of §2's five narrative rooms and isn't one of the twelve either. Full pass in the new §11. Doesn't override the Tier 0/Tier 1 split above: bay *construction* is real starting Act I (Tier 0/1 territory, arc-locked bays excepted, same as Forward Battery already being unbuyable before Mission 14), the Providence/Antfarm *skin* still waits for Act II exactly as already decided.

---

## 0. Two asks, one answer

The Spitball doc already parked this, twice, without connecting the two entries: "Carrier as an ant-base hub, XCOM Avenger style — a real base-management layer between missions" sits a few lines above "Sunrider's EN-budget system... stays parked for a possible future ship layer." They're the same future. A hub screen is exactly where XCOM's Avenger-walk banter lives *and* exactly where Sunrider's ship-deck conversations live — those are two well-known instances of one genre convention, not two features. Build one hub. It carries the workshop, the Heirloom Vault, the Energy resource, roster growth, and the social scenes, because a real place has rooms and rooms are where all of this already wants to live.

This does not replace the existing debrief screen's mechanics (gear tier purchases, spare mek parts, mek secondaries — Build Brief step 11, GDD §6.4). It gives that screen a floor plan and adds new things to spend on and look at once you're standing in it.

**Scope note, matching the Amaranth Reckoning doc's own discipline:** this hub is designed for a battalion-scale campaign — a roster that grows, a ship that can be damaged, veterans who earn named ultimates. The 4-mission vertical slice (5 pilots, no composition choice, one shared Heirloom slot) doesn't need it and nothing here touches that slice. Amaranth Reckoning is the first campaign big enough to justify building this, which is presumably why the ask landed here first.

## 1. The identity call: Providence is the Antfarm

Recommendation, easy to veto: the hub *is* Providence, the ship Amaranth Reckoning already names for Act II fire support (Mission 14, "Steel Rain") and already puts in harm's way (Mission 22, "Ash on the Water" — "the Providence takes real damage"). Rather than inventing a fourth named ship, give an existing one a second job. The crew nickname for it is "the Antfarm" — not its service designation, just what Warden Company calls the thing they keep tunneling new rooms into every time the roster outgrows it, which is often. That's an in-fiction joke that also happens to explain the mechanic: the hub keeps getting bigger because the war keeps making it need to.

Consequences this creates, all of them already consistent with the existing table in §10 of the campaign doc:

- **Act I has no hub**, because Providence isn't forward-deployed yet — matches the squad-scaling table's "off-board support: none" for Act I exactly. The hub unlocks the same mission the call-in ability does (Mission 14), so it's one unlock, not two. **Still true for the fiction — see §6a for what Act I gets instead.**
- **Mission 22 gets real teeth.** "Protect Asset" currently means an off-board ship with a damage state. If that ship is also the player's own hub, damage to it can knock a room or an upgrade offline for a mission or two — the first time the player's *base* is the thing at risk, rehearsing exactly the stakes Act III needs before Act III asks for them. The doc already calls this mission a "rehearsal for Act III's capital-ship stakes"; this makes it rehearse the right thing.
- **Meridian's Oath is untouched.** That's a separate capital ship introduced in Act III (Mission 25) for capital-scale fire support and Mission 32's defense — a different, bigger, later thing. Nothing here renames or merges it with Providence.

**The one thing this doc has to protect:** Providence stays scenery. It is never piloted, never a played unit, never a ship-combat layer — the hub is a menu you visit between missions, not a mode you play. That's the same discipline the campaign doc already locked for the capital-ship objective missions ("the ship is fragile scenery you defend, never a unit you pilot, keeping the 'Freespace never gave us capital ships' instinct intact"). A hub with rooms in it is a much shorter step toward accidentally building ship combat than it looks like from here — worth a flag now rather than a scope argument in six months.

## 2. The rooms

Five rooms for v1. Each does one mechanical job and one narrative job — that pairing is deliberate, not incidental, because it's what keeps this from being a menu with flavor text bolted on.

| Room | Mechanical job | Narrative job |
| --- | --- | --- |
| **Hangar Deck** | Roster and deploy management, mission select, **the Munti deploy gate (new — §6a)** | Low-stakes group banter — the room everyone passes through, so it's the room where casual voice lives |
| **The Workshop** | Gear tier purchases, mek secondaries, spare parts, carrier upgrade modules (new — §3, **now including three recruit-phase modules — §6a**) | The Quartermaster's domain; running commentary on the war through its logistics, not its battles |
| **The Vault** | Heirloom management, dedication, salvage integration (new — §4) | Grief-adjacent. The campaign's heaviest room, used sparingly on purpose |
| **Berths** | Lance recruitment, roster capacity (new — §6), **now the literal home of the recruit-phase system — §6a** | One-on-one pilot scenes — the actual Sunrider slot: quarters, rest, the people rather than the war |
| **CIC / Bridge** | Fire-support call-in configuration, Energy allocation (new — §5) | Marrow sightings, House Amaranth politics, campaign-plot beats — briefing-adjacent in subject, never in tone |

A sixth room, a common mess deck with no mechanical function at all, is worth wanting and worth not building yet — see §9. **Partly un-parked by §11's Rec Room — see there.**

## 3. The Workshop (added workshop)

Two layers. The first already exists and just moves into this room unchanged: gear tier purchases, spare mek parts, mek secondary specializations, at their existing costs (Data Pack §12.1). The second is new.

**Carrier Upgrade Modules** — a second thing the same points currency buys, spent from the ship's own ledger rather than a pilot's. This is a deliberate expansion of "points buy exactly three things, which is deliberately few" (GDD §6.4), and it's licensed by the campaign doc's own Appendix B, which already flags that the points economy "needs its own balance pass at build time" once it's scaled across 36 missions and a fivefold roster — this is that scaling, not a new precedent. Every module carries a real cost, same rule the Heirloom table already enforces: nothing here is strictly better than not buying it. **As of §11, these seven are bays in the physical build grid, not a separate system — same costs, same effects, just a place now.**

| Module | Effect | Cost |
| --- | --- | --- |
| **Auxiliary Berths** | Pulls a lance's worth of deploy slots in early, ahead of the Act's scripted schedule ("more squads," on demand rather than only at Act breaks) | Heavy point cost, and a permanent DEF penalty to Providence itself for the rest of the act — crew diverted to billeting is crew not on damage-control stations, which is exactly what Mission 22 is waiting to punish |
| **Forward Battery** | **Resolved, 23 Aug 2026 — no longer a standalone lever.** Now an *upgrade tier built on top of* §11.2's Weapons Bay, not a separate/competing cooldown module. Weapons Bay cuts the Mission-14 weapon's cooldown 50% on its own; Forward Battery adds another 25% on top, for 75% total cooldown reduction — final cooldown sits at 25% of baseline, not 75% (written out plainly since "75% total" reads two ways). Maxime: "foward battery should be a upgrade to weapon bay and reduce cooldown by 25% for a 75%, total cd." | Heavy point cost, not purchasable before Mission 14 and now also gated behind Weapons Bay being built first. **Dropped, not carried forward:** the old "or reduces Energy cost" clause — this description only covers cooldown, so treating the Energy-cost lever as retired unless told otherwise; it doesn't have a home right now. |
| **Fabrication Bay Expansion** | Raises every Fabricator mek's spare-part cap campaign-wide, not just one pilot's | Point cost scaled to how many Fabricator meks are in the current roster, so it gets more expensive as the payoff gets bigger |
| **Runic Integration Line** | Required before a *salvaged* Heirloom (see §4 — The Debutante's Answer is the one example that exists today) can be assigned to anyone. Without it, a salvaged Heirloom sits in the Vault, inert | Moderate point cost, one-time |
| **Combat Medic Cadre** (new, 22 Aug 2026) | Discretionary-track Munti recruits (§6a) enter at F-tier instead of G — a reward for a player who's identified Munti as the load-bearing class and is deliberately building depth there, not a change to the free emergency replacement, which stays bare-bones on purpose | Moderate point cost, one-time |
| **Reserve Muster** (new, 22 Aug 2026) | A discretionary recruit (any class, bought proactively — §6a) is available immediately instead of waiting for the next debrief. Speed, not power; still doesn't touch the emergency track | Moderate point cost, one-time |
| **Vital Signs Uplink** (new, 22 Aug 2026) | Early-warning HUD cue when a side's last living Munti drops below a set HP threshold mid-mission — advance notice instead of only learning the safety net is off after it's already off | Moderate point cost, one-time |

## 4. The Vault (added heirloom)

A physical home for the 20-name Heirloom pool the campaign doc already built (§9 of the Amaranth Reckoning doc). Nothing about the pool's rules changes; the Vault is where the rule everyone already agreed to becomes a scene instead of a stat change.

The existing unlock condition — reaching A tier is "Heirloom-adjacent," and *surviving a real story beat afterward* is the actual unlock, "not a shop purchase" — currently has no "where." The Vault is the where. A veteran's dedication happens here: a short scene, once, the moment the story beat resolves. Requiem's transfer from Bosk to Rourke at the end of Mission 12 is the obvious first one to write, and it should be treated as load-bearing the way the GDD uses that exact word for the base slice's Mission 1b briefing — "the only thing the game ever says about a mission whose weight the player is expected to work out on their own." Same idea, moved from a briefing to a scene: this is the one moment in the whole campaign the hub isn't allowed to be quiet about. See §7 below for why it doesn't get to be skippable. **Now genuinely conditional rather than certain — per §6a of the campaign doc, this scene only happens exactly as written if Bosk is actually the one who reaches Mission 12. If he isn't, this scene needs a version that names whoever actually did.**

Salvaged Heirlooms are a second, smaller case worth naming explicitly: The Debutante's Answer is tagged "salvaged, not issued" in the existing table, which already implies it doesn't arrive through the normal unlock path. The Vault is where it sits, uncalibrated, until the Workshop's Runic Integration Line is bought — a small, concrete link between the two rooms rather than a special case bolted onto one ability.

**Open, not decided here:** whether a permanently lost pilot's Heirloom (if they were carrying one) is retired, orphaned back into the pool, or memorialized in the Vault as unusable. The campaign doc doesn't currently say whether Amaranth Reckoning reuses the base game's "points invested in a lost pilot are not recovered" rule (Canon Pass §C.3) for Heirlooms specifically. **Sharper now that permadeath is a real, general system rather than a single scripted Mission 12 loss — this will come up more than once across a campaign, worth resolving before the Vault actually gets built rather than after.**

## 5. Energy (added energy)

A resource that belongs to the ship, not to any pilot or mek — a separate axis from HP, points, or Heirloom charge, the same way the campaign doc's own research already scoped it: Sunrider's EN-budget was explicitly researched, explicitly rejected for the mech-combat layer (two-action XCOM economy won that argument on its merits), and explicitly "parked for a possible future ship layer instead." This is that ship layer, finally given something to be attached to.

- **What it fuels:** Providence's fire-support call-ins, and — if this ever gets built out — active defense during Protect Asset missions (Ash on the Water, Hold at the Spire), which right now are pure damage-sponge scenery with no player lever. Energy is a cheap way to give the player one button in those missions without turning them into ship combat.
- **How it's gained:** flat regen per mission completed, the same performance bonuses already defined for points (Data Pack §12.3 — turns under limit, no pilot downed, no spare parts spent) also feed Energy. No new tracked stats, no new scoring rules — the existing scorecard just has a second column now. **§11's Generator bay is a second lever on this — see there.**
- **Cap and use-it-or-lose-it:** capped per act, and unused Energy does not carry across an act boundary. That's a deliberate contrast with points (which persist) — it keeps each act's Energy budget a real decision made on that act's own terms, rather than something that snowballs into Act III being trivially funded by Act I discipline.
- **Its cost is logistical, not personal.** Severance's whole design point is that its cost is felt immediately and specifically — it can kill your own unit, right now, on purpose. Energy shouldn't try to copy that; it's a different tension serving a different scale. Its cost is opportunity and scarcity: what you didn't buy this act because you spent Energy instead of banking it. That's a real cost. It doesn't need to also be a dramatic one — the game already has a mechanic that does dramatic, and diluting Severance's exclusivity on "this can hurt you" would cost more than it'd add.

## 6. Berths and squad growth (more squads)

The campaign doc already scripts roster growth — 5 at Act I, 10 across two lances at Act II open, roughly 20 across four lances by Act III (§10's squad-scaling table). That schedule stays the floor; nothing here delays or replaces it. Auxiliary Berths (§3) is the only lever that moves it, and only earlier, and only at the DEF cost already described. This keeps the campaign's pacing author-controlled by default, with hub investment as optional acceleration for a player who wants to pay for it — additive, not a rewrite of a table that's already been thought through.

## 6a. The recruit-phase system lives here first — before the hub does (new, 22 Aug 2026)

Full design and every direct quote preserved in `claude/Bloom_Wars_Spitball_Ideas.md`; practical summary in the campaign doc's §6a. This section is just the room-wiring and the Act I sequencing fix.

**Where it lives, mechanically, once the hub exists:** the deploy gate (no mission launches without a living Munti in the squad) is Hangar Deck's job, same room that already owns roster/deploy management. The two recruit tracks — automatic free emergency replacement the moment living Munti count hits zero, and paid discretionary recruiting for anyone buying a backup proactively — are Berths' job, the room that already owned "lance recruitment, roster capacity" before this system existed. Nothing here needed a new room; the existing five already had the right shape.

**Where it lives *before* the hub exists — the actual gap this update closes.** The recruit system isn't an Act II feature. It has to work starting Mission 1, because the deploy gate and the permadeath rule are live from Muster onward, and §1's "Act I has no hub" is still correct as fiction — Providence isn't forward-deployed yet, nothing here changes that. The resolution: build the underlying state and rules now, as plain engine/data work with no room fiction attached, and let Act I use an unbranded functional meta-screen (a squad-select/debrief screen that does the Hangar-Deck and Berths jobs without being called that, without Providence, without banter) until Mission 14 unlocks the real Antfarm and that same functionality gets the room skin and the scenes on top. Concretely: the same underlying functions and state (`checkMuntiGuarantee`, permanent-loss tracking, the emergency/discretionary recruit paths) get called from a bare Act I screen first and a fully-dressed Hangar Deck / Berths later — one system, two skins, exactly the same pattern §9 of this doc already uses for CO powers and Heirloom effects elsewhere in the project. Nothing about this weakens the "Tier 1 lands alongside Act II" build recommendation for the *narrative* hub — it only means the *rules* can't wait that long, because Mission 1 needs them to be true. **§11's grotto is a second thing that now needs the same two-skins treatment — see there.**

## 7. The story-moment layer

This is the actual Sunrider ask, and it's the smallest technical lift in this document, because the campaign already has the exact right-shaped tool for it. GDD §7 defines `MissionEvent` — a flat trigger/action data record, no special-cased code — specifically so scripted moments stay data. A hub scene is the same idea at a different trigger point:

```
interface HubScene {
  id: string;
  room: "hangar" | "workshop" | "vault" | "berths" | "cic";
  trigger: { type: "after_mission" | "heirloom_unlock" | "roster_change";
             missionId?: string; pilotId?: string };
  participants: string[];       // pilot ids
  beats: { speaker: string; text: string }[];   // no branching in v1
  once: boolean;
}
```

**No branching dialogue in v1.** A tree multiplies writing cost fast and buys very little at this campaign's stage — flag it for later (§9), don't build it now. This is the same "prototype the small version first" instinct the campaign doc already applies to itself in its own Appendix C.

**No new art.** GDD §12.2 already solved this problem for the exact reason it's about to come up again: "confirmed no artist for Sunrider-style hand-painted portraits... a coloured circle with two initials. Real portraits are a later drop-in against the same field." Hub scenes use that same placeholder, just with more screen time and a name-plate. The art decision doesn't need to be reopened; it needs to be reused.

**Reconciling this with the "briefings never editorialize" rule.** GDD §10.1 is explicit that mission briefings state the task and nothing else — "a single extra clause of atmosphere would do the narrating the discipline exists to prevent." That rule is untouched and this layer doesn't argue with it; it's a different room doing a different job. The Qiraki side of this project already has the exact craft rule this needs, and Spitball Ideas already declared it the game's tone too, by default: *"warmth lives in the dialogue, the dark lives in the background."* Briefings are the background. The hub is where the dialogue lives. Two rooms, one house, already-agreed rule — this doc isn't asking for a new tone decision, just pointing at the one that's already made and applying it somewhere it hasn't been applied yet.

## 8. Beat placement across the 36 missions

Concrete placements, tied to beats the campaign doc already named. This is a starting pass, not a full script — enough to prove the room-per-scene idea against real content before committing to writing all of it.

| After mission | Room | What it's for |
| --- | --- | --- |
| 1 — Muster | Hangar Deck | First-time-in-a-lance banter. Mission 1 establishes all five voices in combat; this is the social equivalent |
| 5 — Foraging Party | Berths | Restock-not-death, felt rather than mechanical — someone processing having watched a squadmate go down and come back |
| 8 — The Choir Sings | Workshop | Post-mid-boss banter; a natural slot for a Rourke/Iyari (Foxfire) rivalry beat, given her established competitive streak |
| **12 — The Fallow Line** | **Vault** | **Load-bearing, not skippable.** Requiem's transfer from Bosk to Rourke — or whoever actually holds the gate, per §6a's permadeath note above. The campaign doc wants "the friend-or-foe rule read as grief rather than as game design" — this scene is the only place that reading actually gets delivered |
| 13 — New Colors, Old Wounds | Hangar Deck | The second lance arrives; direct payoff for the roster-growth beat the mission title is already about |
| 17 — The Wellroot Uncovered | CIC | House Amaranth's collaboration becomes visible; political-complexity beat matching Act II's "moral weight of a civil war" |
| 20 — Marrow's Line | CIC | Processing the first named mech-vs-mech duel; a strong slot for Anand (Farsight), already established as "the company's real mentor once Bosk is gone" |
| A-tier unlocks, whenever they occur | Vault | Each Heirloom dedication scene, data-driven off the unlock event, not tied to a specific mission number |
| 24 — Two Fires (Act II finale) | CIC or Hangar Deck | Rourke's promotion to Major; the tone hinge into Act III's grimmer register |
| 29 — The Outer Ring Falls | CIC | Deliberately short and grim — this is where Act III starts earning the tonal shift the doc names outright at Mission 33 ("tone shifts from 'win' to 'survive'"). This scene shouldn't try to comfort anyone |
| 31 — The Last Convoy | Berths | Quiet, earned rest. The Qiraki side of this project already models exactly this need mid-siege — the gigafish sequence's own beat sheet calls for "3-4 chapters of genuine rest and recuperation, earned downtime, not filler, the reader needs the breath as much as the characters do." Same instinct, same place in the structure |
| Before 36 — Until Relief | Vault | Meridian's Vow — the battalion-wide Heirloom "reserved narratively for the finale" gets its dedication scene here, explicitly, before the last mission spends it |

## 9. Build cost, honestly

**Tier 0 — engine/data only, build now, no UI attached (new, 22 Aug 2026).** The permadeath rule (live Munti check on every downing), campaign-persistent roster state (nothing like this exists in the codebase yet — confirmed 22 Aug 2026, no localStorage, no debrief scene, no Fabricator mid-mission wiring either), the deploy gate's validation logic, and the emergency/discretionary recruit functions from §6a. This has no room fiction, no Providence, no art — it's the rules Act I needs to be true starting Mission 1, built as plain TypeScript against the engine the same way everything else in `engine/` is. Genuinely urgent, unlike everything below.

**Tier 1 — cheap, build alongside Act II's own prototype pass.** A room-based reskin of the existing debrief/shop screen (Hangar + Workshop only), the `HubScene` data type, and the Mission 12 Vault scene written by hand because it's the one that has to exist for any of this to be worth doing. No new resource yet. Existing placeholder portraits. **This is where Tier 0's plain Act I screen gets its Antfarm skin and Providence's identity — the underlying calls don't change, only what's drawn around them.**

**Tier 2 — moderate.** Energy, the Forward Battery / Auxiliary Berths / Fabrication Bay Expansion / Combat Medic Cadre / Reserve Muster / Vital Signs Uplink modules, the Vault's dedication trigger wired to the existing A-tier unlock condition.

**Tier 3 — later, don't build yet.** Branching dialogue, an affinity/relationship layer, the Mess Deck, animated portraits, and — much later — exposing hub scenes to the player-authored mod kit already parked in Spitball Ideas.

Recommend Tier 1 lands alongside Act II's prototype, the same seam where ship fire-support and the composition choice both already come online per the campaign doc's own Appendix — not before Act I is proven, matching Appendix C's own "prototype Act 1 first" advice. This doc doesn't override that sequencing; it just has somewhere to plug in once that sequencing gets there. **Tier 0 is the one exception to "not before Act I is proven" — it's not narrative hub work, it's the rules engine, and Act I can't be played honestly without it now that permadeath is real.**

## 10. Open questions — your call

- **Providence-as-Antfarm** — the whole document leans on this. Easy to swap for a new, unnamed ship if that reads better once there's more of the campaign written; nothing else here would need to change structurally.
- **Mandatory vs. skippable scenes.** Mission 12's Vault scene reads as mandatory to me for the reason stated above. Everything else I'd default to skippable-but-logged (so a player who skips can still read it later from the Vault or a "ship's log"), but that's a real tone call, not a technical one.
- **Does Energy ever touch Meridian's Oath?** As written, Energy is Providence-only. Whether Act III's capital ship gets its own pool, shares this one, or stays outside this system entirely is untouched here.
- **Salvaged-vs-lost Heirloom handling**, per §4 — flagged, not resolved. **Sharper now that permadeath is general rather than one scripted loss.**
- **Act I's plain meta-screen, new 22 Aug 2026** — does it get any visual identity at all (even a placeholder "Fallow Line command post" header) or is it deliberately as bare as possible to keep the Antfarm's eventual reveal feeling like a real upgrade rather than a coat of paint on something that already looked finished? Not decided here.
- **The build-grid pass (§11, added 23 Aug 2026)** rolls up its own open questions there rather than duplicating them here — the CO's identity chief among them.

## 11. The build-grid pass — twelve bays and the CO's grotto (added 23 Aug 2026)

*Maxime's framing, verbatim: "an XCOM type ant farm... add new room to it as I think of them... thing player can build as soon as they can in act 1, except for arc specific locked thing." This section turns that into the doc's existing shape rather than starting a second, competing system.*

### 11.1 How this fits what's already here

§2's five rooms don't change — they're still the answer to "which room is a given `HubScene` set in," the narrative/scene-trigger layer §7 defines. What's new is a second, physical layer nested inside that fiction: a twelve-bay build grid, the literal XCOM-Avenger-style thing §3's Carrier Upgrade Modules table was always describing in the abstract (buy with points, no spatial representation) but never actually drew. The existing seven modules become bays in this grid rather than a separate system — nothing about their costs or effects changes, only that they now have a place. §2's rooms are still where the *scenes* happen; several of them plausibly contain some number of the twelve bays — the Workshop room holding the Fabricator, Weapons Bay and Generator, CIC holding the Sensor Array and the Beacon control, and so on. That room-to-bay mapping is a recommendation, easy to redraw once the bay list below stabilizes — not load-bearing yet.

**The grotto is new and separate from both systems** — not one of the twelve bays, not one of §2's five rooms. It's the fixed centre the grid is physically built around: the carrier group CO's own post.

**Sequencing note, same shape as §6a's two-skins pattern:** bay *construction* starts Act I like everything else Tier 0 covers — arc-locked bays (a Weapons Bay tied to the Mission-14 unlock, say, the same way Forward Battery already can't be bought before it) excepted. The *grid itself* doesn't get the Antfarm/Providence skin until Act II, same as the rest of the hub. Act I plausibly sees a bare, unbranded build-list; Act II is when it becomes a drawn twelve-bay deck plan aboard Providence.

### 11.2 The twelve bays — running list

Provisional, per Maxime's own framing ("add new room to it as I think of them," "etc.") — this is the list so far, not a final twelve, and the existing seven §3 modules aren't repeated here in full (see that table for their costs and effects).

| Bay | Job | Notes / open questions |
| --- | --- | --- |
| **Weapons Bay** (new) | Flat 50% cooldown cut on the Mission-14 ship weapon, base tier | **Resolved, 23 Aug 2026:** "reduce cd on 14 weapon by half" — a flat number, not a menu of options. Confirms the ability itself still unlocks at Mission 14 exactly as §1 already had it; this bay only makes it fire more often. **Overlap with Forward Battery, resolved same day:** the two aren't competing anymore — Forward Battery (§3) is now built as an upgrade *on top of* Weapons Bay, adding another 25% cooldown cut for 75% total. Bay build order matters here: Weapons Bay first, Forward Battery second. |
| **Fabricator** | More spare parts | §3's existing Fabrication Bay Expansion, just given a bay rather than staying an abstract purchase. No new mechanic. |
| **Generator** (new) | Powers the grid | **Resolved, 23 Aug 2026:** "allow you to power fabricator and other heavy room" — the genre-faithful option. Generator is a real power budget: heavier bays (Fabricator confirmed by name; Weapons Bay, Sensor Array, and others presumably qualify too, not itemized yet) need Generator capacity built up before they can actually run, not just be purchased. This gives the twelve-bay grid a real build *order* for the first time — Generator likely has to go in early, possibly first, or later bays sit built-but-unpowered. Separate from §5's Energy (the ship's per-mission fire-support/defense resource) — Generator capacity and Energy are two different pools unless told otherwise. |
| **Long-Range Sensor Array** (new) | Removes fog of war from mission maps campaign-wide, from the moment it's built onward | Maps cleanly onto what the engine already does: `engine/ai.ts`'s `unitsVisibleToSide` currently gates only *hostile unit* visibility — terrain was never fogged to begin with, per that function's own doc comment. This bay would just stop gating unit visibility. Burrowed (Undertow) and concealed (`abil_ambush` / `abil_screen`) states stay hidden regardless, exactly as specified — those are a separate check in the same function and this bay has no reason to touch them. |
| **Resupply Beacon** (new) | Lets the player designate a spawn/resupply point anywhere on the mission map | **Confirmed separate from Restock Room, 23 Aug 2026** ("beacon and restock. yes separate"). Still reads as an activated ability, not a passive stat — needs its own rules once it's time to build it: once per mission? Costs a unit's action to place, or free? |
| **Restock Room** (new) | Reduces the after-effects of a restock | **Resolved, 23 Aug 2026:** "restock help reduce the after effect of a restock" — not general resupply. This is the mitigation lever for whatever cost currently attaches to a *restock event* specifically — most likely §6a/§8's emergency Munti replacement (§8 already calls Mission 5's beat "Restock-not-death"), possibly extending to other forced-replacement cases as the recruit system grows. What the "after effect" actually is isn't defined yet — a stat/tier penalty on the replacement? A stress hit (see §11.4)? Flagging the link to §11.4 rather than assuming it, since stress is the obvious candidate once it exists. |
| **Rec Room** (new) | Reduces pilot stress | Confirmed as one bay covering both phrasings from the original ask ("reducing combat stress" / "a game room for less stress"), not two. This is also §2/§9's Tier-3 Mess Deck, un-parked — that section called a no-mechanical-function mess deck "worth wanting and worth not building yet"; it now has a mechanical job, which changes its tier. The stress system itself — what it is, what triggers it, what it costs unmanaged — is its own thing now; see §11.4. |

### 11.3 The grotto and the CO

The carrier group CO's own post — where carrier-modification approval and, per Maxime, advice both live.

**Mechanically, resolved 23 Aug 2026:** automatic, for now. Maxime: *"co approval. should be automatic. for now."* The CO signs off, no gameplay effect beyond the bay's existing point cost — the lighter default this doc already flagged as the safer call, now confirmed rather than just assumed.

**Future hook, on record even though it was floated half-joking:** *"later itl be its own dsting sim (i'm joking but I'm thinking of stealing dragon age origin's love bar)."* Read straight: a real CO relationship/approval meter down the line, Dragon Age: Origins party-approval style — where the CO's standing toward the player could eventually gate or color things instead of rubber-stamping every build. Same treatment as Stress in §11.4: worth writing the intent down now so a future pass isn't reverse-engineering it from a chat log, without designing the actual meter, triggers, or effects here.

**Narratively:** the CO's advice function slots next to CIC/Bridge's existing job (§2: "campaign-plot beats, briefing-adjacent in subject, never in tone") without duplicating it — CIC is politics and the war's shape, the grotto is the player's own commanding officer, a different register, closer to Berths' "the people rather than the war" than to CIC's.

**Name resolved, 23 Aug 2026: Arangement of Content.** Recorded as typed — flag if that should read "Arrangement." Amaranth Reckoning is explicitly the non-canon parallel campaign (this doc's own header, and `MapSelect`'s own subtitle), so naming a CO fresh for it rather than reaching for an existing canon character keeps the line this project has otherwise been careful to hold. **Species and voice still open** — the name itself already reads as a deliberate choice (not a typical person-name, closer to a title or designation), worth building the rest of the character around rather than treating as incidental. Same "your call" status as the other character gaps this doc has left standing.

### 11.4 Stress — the shape, not the numbers (added 23 Aug 2026)

Maxime, on why it isn't called Will: *"I dont think we can straight up use 'will' thats why I was calling the mechanic stress."* Keeping that name. This is a real, intended system — not fully designed yet, and per Maxime, that's fine for now ("we just need the basic for now. but we should probably plug this in") — but it needs a shape on record so nothing downstream (Rec Room, Restock Room's "after effect," the recruit-phase system in §6a) is built blind to it.

**What's actually decided:**

- **A per-pilot stat that doesn't exist in the codebase yet.** Same category of gap as permadeath before §6a — needs engine/data work, not just a room.
- **Not an early-game problem, by design.** Maxime: *"something thats generally a problem by mission 15 not something thats a problem early."* Reads as an Act II-onward system — notably, right around the same seam where the Antfarm identity itself comes online (Mission 14) and Weapons Bay unlocks. Worth treating that as one seam, not a coincidence: Act I plays clean, Act II is where the ship *and* the pressure both become real.
- **What high stress does — not damage, not death.** Maxime's own reference point is XCOM's Will/panic system: *"something to either rotate crew or force player unit into unfavorable position like will did in xcom."* Two levers, not one: (1) a soft push toward benching an overstressed pilot rather than deploying them — a crew-management pressure, felt at the roster screen; (2) an in-mission effect that puts a stressed unit somewhere the player didn't choose — XCOM's panic (a unit acts against orders) is the direct model, exact form TBD.
- **A future hook, explicitly parked:** *"i want to introduce ctulu mental effect by certain unit they are just not coded in yet."* Certain units (unspecified — presumably Qiraki-side entities with a cosmic-horror register, matching this project's own established tone elsewhere) are meant to inflict a heavier, Lovecraftian flavor of mental effect on top of baseline Stress. Not designed here — those units don't exist in the engine yet, so there's nothing to attach it to. Flagging the intent so Stress's basic version gets built with room for a nastier tier later, rather than needing a rework to add one.

**Still genuinely open, not guessed at:** what raises Stress (a downing witnessed, a Collapse, a failed extraction, a restock — see §11.2's Restock Room), whether it decays on its own or needs the Rec Room actively, whether it's tracked per-pilot or company-wide, and the actual numbers for either lever. Same restraint this doc already shows with Energy and Severance — the shape's on record, the math isn't, because guessing at math nobody asked for is how a "basic version for now" quietly turns into a full system nobody agreed to yet.
