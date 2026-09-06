// src/data/codex.ts
// Codex Rebuild & Live Briefing Plan v1, Part A — real, unlock-gated,
// save-aware codex content: Personnel, Bloom Bestiary, World, Systems,
// Ranks & Command, Glossary. All six categories were already fully drafted
// in the project's own claude/Bloom_Wars_*_Codex_Entries_v1.md docs before
// this file existed — this module is that content, transcribed and wired
// to real unlock evaluation, not new invention. Every paragraph below is
// copied from those docs' own locked entry text (design-note asides in the
// source docs — the italicized parentheticals explaining a writing choice
// to Maxime — are deliberately left out; they're commentary about the
// entry, not part of it).
//
// Pure data/logic module — same src/data purity rule missionBriefing.ts
// already established (see that file's own header): only ./types and
// sibling data/ files, never ../engine/*, ../scenes/*, ../ui/*, ../sim/*.
// The one live-state question every gated category needs — "how far has
// this save gotten" — reuses missionBriefing.ts's own
// highestWardenMissionIndexReached()/wardenMissionIndex(), fed the same
// plain { missionId: string } | undefined shape. Personnel additionally
// needs live per-pilot status; callers (Codex.ts) extract that into the
// minimal LivePilotStatus shape below themselves, the same "pass in the
// plain shape, don't import the real engine type" pattern.
//
// Three interpretive calls made while wiring this, each real enough to
// flag rather than bury in a comment — Maxime should get these in the
// build-log write-up, not just here:
//
// 1. PERSONNEL UNLOCK. The five named pilots' own doc
//    (Personnel_Codex_Entries_v1.md) writes each as "(unlocks — Mission 1,
//    roster join)." Mechanically, all five are already on the roster the
//    instant a Warden campaign is created (engine/campaignState.ts's own
//    createCampaignState seeds WARDEN_PILOTS before Mission 1 is ever
//    flown) — so "unlocked at Mission 1 roster join" is already true for
//    every Warden save that exists, with no mission-index check needed.
//    Personnel entries render for Rourke, the CO, and any of the other
//    four pilots present in the save's own roster, full stop — see
//    PERSONNEL below; there is no gate field on PersonnelEntry at all.
//
// 2. BESTIARY UNLOCK, AS A PROXY FOR "FIRST ENCOUNTER." The bestiary doc's
//    own gate is "unlocks on first encounter" — a real in-mission event
//    this engine has no live tracking for (no encountered-archetype set
//    exists anywhere on CampaignState). Every mission's enemy composition
//    is fixed, known data, though, so this file uses the same
//    highestWardenMissionIndexReached() gate the live briefing panel
//    already established: an entry unlocks once the save has RESOLVED
//    (won or lost) the mission that first fields it, not the instant that
//    mission starts. That's a turn or two later than the literal moment of
//    first contact, in exchange for using data this save actually has
//    rather than inventing new tracking state — under-unlocking rather
//    than guessing, same discipline as missionBriefing.ts's own fallbacks.
//
// 3. SYSTEMS / RANKS & COMMAND / GLOSSARY GATING. Several individual
//    entries in their own source docs carry a "(unlocks — proposed:
//    Mission X...)" note — but every one is marked "proposed," never
//    confirmed, and the Codex Rebuild plan doc's own §2 (the doc Maxime
//    actually answered AskUserQuestion against) resolves it at the
//    category level instead: "Systems, Ranks & Command... and Glossary can
//    stay fully browsable with no save." That's the decided policy, so
//    these three categories carry no gating at all — every entry, every
//    save state, Main Menu included.
//
// PERSONNEL, WORLD, and BESTIARY ARE WARDEN-SCOPED. All three were written
// to accompany Warden Company's own campaign (Personnel doc's own §0:
// House Amaranth's five pilots are "a real next pass, once you want it,"
// not built here; World's own Amaranth-Reach revision literally reads
// "Warden Company holds a stretch of border line here"). A save without
// pilot_rourke on its roster — a House Amaranth save, today's only other
// save shape (engine/campaignState.ts's own baseSceneKeyFor uses that same
// pilot_rourke-presence check to route Hub vs. Hangar) — should see an
// honest "not built for this campaign yet" placeholder for these three
// instead of Warden-flavored content that wouldn't fit its own story.
// Codex.ts is responsible for that check (it already has the real
// CampaignState in hand); this file only degrades gracefully on its own
// for World/Bestiary (an unrecognized echo simply unlocks nothing, since
// wardenMissionIndex returns -1 for a House Amaranth mission id) and
// exposes nothing at all Warden-specific for Systems/Ranks/Glossary, which
// need no such check in the first place.
import { wardenMissionIndex, WARDEN_MISSION_ORDER } from "./missionBriefing";

// ---------------------------------------------------------------------
// Personnel
// ---------------------------------------------------------------------

/**
 * The minimal shape Codex.ts extracts from a real CampaignPilotEntry
 * (engine/campaignState.ts) before calling in here — see this file's own
 * header on why src/data never imports that type directly. "active",
 * "reassigned", and "discharged" need nothing further; "permanently_lost"
 * carries just enough of PilotLossContext to name where and when.
 */
export type LivePilotStatus =
  | { kind: "active" }
  | { kind: "reassigned" }
  | { kind: "discharged" }
  | { kind: "permanently_lost"; missionId: string; turn: number };

export interface PersonnelMek {
  /** e.g. "mek_rourke, catalyst Raven" — the doc's own id+catalyst tag. */
  idLine: string;
  bio: string;
}

export interface PersonnelEntry {
  id: string;
  /** "2nd Lt. Dessa Rourke — "Lark"" — full rank, name, and callsign. */
  displayName: string;
  /** Full paragraphs, path/species tag included inline, verbatim from the doc. */
  bio: string[];
  /** Every named pilot has exactly one paired Mek. Absent only for the CO. */
  mek?: PersonnelMek;
  /** The CO's own catalyst — he has no paired Mek (he isn't a deployed pilot). */
  catalystLine?: string;
  /** Selects how personnelStatusText renders this entry's Status line. */
  statusMode: "rourke" | "co" | "roster";
}

export const PERSONNEL: PersonnelEntry[] = [
  {
    id: "pilot_rourke",
    displayName: '2nd Lt. Dessa Rourke — "Lark"',
    bio: [
      "Meeps. Human. Green when this started, and it showed — quick, aggressive, not yet a commander. Still leading from the front. The unit under her now carries the opposite of her own callsign.",
      "By Mission 12 she's carrying Capt.'s bars, and Maj.'s by Mission 24 — Company Commander over the whole force, both times. Neither promotion pulls her out of Lance A. She's still its Lead in person, still the same lance she's run since Mission 1, just with more of Warden Company answering to her on top of it.",
    ],
    mek: {
      idLine: "mek_rourke, catalyst Raven",
      bio: "Grew up on a working dock on Glasswater itself, close enough to the sector capital's real labor to know exactly what keeps a comfortable world running underneath it. That's the same instinct that makes a good Mek: quietly making sure Rourke's own rig is right before she ever has to ask.",
    },
    statusMode: "rourke",
  },
  {
    id: "pilot_bosk",
    displayName: 'M.Sgt. Halvard Bosk — "Anvil"',
    bio: [
      "Tank. Human. Came up through House Amaranth's own regulars before Warden Company folded him in. Raised in a garrison quarter on Glasswater itself — comfortable enough by any Reach standard, but a garrison childhood shows you exactly what that comfort actually costs to keep, and Bosk came out the other side of it not cynical, just exact. He explains a thing once, correctly, and expects you to have heard him. That's the instinct every newer pilot in the company leans on without being told to.",
    ],
    mek: {
      idLine: "mek_bosk, catalyst Bear",
      bio: "A different upbringing entirely from his own pilot's — Tallowmere's smoky industrial anchor world, hit hard and early, learned to keep its own counsel and just work. The steady, self-contained presence at Bosk's back that never needs him to check on it.",
    },
    statusMode: "roster",
  },
  {
    id: "pilot_iyari",
    displayName: 'Pvt. Tegan Iyari — "Foxfire"',
    bio: [
      "Meeps. Hiopi — centauroid frame. Grew up on Emberfall, a refinery world the Bloom had already reached, close enough to an unmarked preserve boundary nobody in her family ever fully explained. Real frontier hardship the whole way through, and she met it by finding something to laugh about anyway, every time — not a habit she picked up later, the same thing that makes her the one already cracking a joke before anyone else has finished processing what just happened.",
    ],
    mek: {
      idLine: "mek_iyari, catalyst Fox",
      bio: "Raised on money that never quite matched the plateau world around it, tested into a prestige Core academy despite frontier roots — still finding its own footing, quick and adaptable because nothing's forced it to be anything else yet. A fast, improvising presence that suits a Meeps pilot who moves the same way.",
    },
    statusMode: "roster",
  },
  {
    id: "pilot_anand",
    displayName: 'Cpl. Priya Anand — "Farsight"',
    bio: [
      "Reeps. Osnian — the first of her kind Warden Company's ever fielded. Raised in Skeinreach's weave-mill housing, one remove from anything that could honestly be called danger, trained locally alongside people she'd go on to actually serve beside. Nothing about her read is a standout, and that's the point — steady, exactly where the formation needs her, holding a Reeps line rather than chasing a kill count.",
    ],
    mek: {
      idLine: "mek_anand, catalyst Dog",
      bio: "A comfortable, home-centered upbringing on Glasswater itself — the kind of loyalty that never had to be tested to become real. Distinct from Anand's own busier read: the Mek's job is simple devotion, not vigilance.",
    },
    statusMode: "roster",
  },
  {
    id: "pilot_lask",
    displayName: 'Spec. Corin Lask — "Patch"',
    bio: [
      "Munti. Human. Grew up on a fiber farm in Skeinreach, where a blight or a scrape isn't an emergency, it's Tuesday — quiet, unglamorous upkeep that just has to happen, every day, so everything else keeps working. That's the job now too, just with a squad instead of a field. He's not who anyone talks about after a mission goes well. He's the reason there's a squad left to talk about it.",
    ],
    mek: {
      idLine: "mek_lask, catalyst Rabbit",
      bio: "Raised transient, ferried between Glasswater Reach's own barge routes rather than settled anywhere solid, and lost something real despite all that institutional shelter. Came out of it protective, specifically — the exact temperament for a Mek partnered with the one person in the company whose entire job is protecting everyone else.",
    },
    statusMode: "roster",
  },
  {
    // Note for whoever next touches this: the CO's real displayName field
    // in code is still the leftover placeholder string "Arangement of
    // Content" (Catalyst Formula doc's own flagged typo) — never render
    // that raw. This entry hardcodes a safe display string instead, same
    // as the personnel doc itself does, and should get a one-line update
    // the day Maxime actually picks him a real name.
    id: "co",
    displayName: "the CO — the ship's Commanding Officer",
    bio: [
      "Raised inside the Understrand's own orderly, procedural culture from the start — an Academy Ward childhood on a dense arcology world, groomed for institutional service rather than combat. Steady, duty-bound, unremarkable in exactly the way that eventually puts someone in charge of an entire complement's worth of people, not despite it.",
    ],
    catalystLine: "Wolf — team-first, formation-minded, the same read that makes him command staff rather than a line officer.",
    statusMode: "co",
  },
];

/**
 * The Status line under a Personnel entry — a live read of that pilot's
 * actual save state, never a mission-specific or campaign-specific branch
 * (Personnel doc's own §0.3 rule: a codex that knew a pilot's fate ahead of
 * time would spoil the game's own permadeath system). `live` is undefined
 * for a pilot this save has no CampaignPilotEntry for at all — shouldn't
 * happen for any of the four ordinary roster entries on a real Warden save
 * (they're seeded at creation), but handled the same as "active" rather
 * than crashing, since a missing entry reads the same as "nothing's gone
 * wrong here" from the codex's own vantage point.
 */
export function personnelStatusText(entry: PersonnelEntry, live: LivePilotStatus | undefined): string {
  if (entry.statusMode === "rourke") {
    return "Still in the field. Warden Company's line has never reported her down for good — if it ever does, that's a fight still being fought, not one that's over.";
  }
  if (entry.statusMode === "co") {
    return "Hub-side command staff, not a deployed roster slot — there's no mission outcome to report here.";
  }
  if (!live || live.kind === "active") {
    return "Active, serving with Warden Company.";
  }
  if (live.kind === "reassigned") {
    return "No longer serving with Warden Company — reassigned off the ship, at the player's own request.";
  }
  // Discharge (5 Sep 2026) is deliberately worded apart from "reassigned"
  // above even though both read as "gone, not dead": reassignment is a
  // forced CO-mediated resolution to a standoff, discharge is a plain
  // administrative choice made at the shop, no conversation involved.
  if (live.kind === "discharged") {
    return "No longer serving with Warden Company — discharged, tier and gear investment left behind.";
  }
  const idx = wardenMissionIndex(live.missionId);
  const missionName = idx === -1 ? live.missionId : WARDEN_MISSION_ORDER[idx].displayName;
  return `Lost at ${missionName}, turn ${live.turn}. Warden Company's roster carries the record, not a replacement.`;
}

// ---------------------------------------------------------------------
// Bloom Bestiary
// ---------------------------------------------------------------------

export interface BestiaryEntry {
  id: string;
  /** The Warden mission that first fields this archetype — see gate note #2 above. */
  gateMissionId: string;
  displayName: string;
  body: string;
}

export const BESTIARY: BestiaryEntry[] = [
  {
    id: "bloom_crawlmass",
    gateMissionId: "mission_amaranth_1",
    displayName: "Crawlmass",
    body: "The first thing most soldiers ever see of the Bloom, and the least dangerous — alone. A Crawlmass folds almost the instant it's hit. The danger was never any single one of them; it's that they never show up alone, and every one you're fighting is a turn you're not spending on something worse.",
  },
  {
    id: "bloom_splitfang",
    gateMissionId: "mission_amaranth_2",
    displayName: "Splitfang",
    body: "A Crawlmass drift with something coordinating it. Nothing changes about how any one of them looks or moves — until one spots you, and the rest turn like they heard it happen. They don't share a mind. They share a target, the instant one of them finds it, and three or four of them converging on the same mech in the same turn is the fastest way anyone's squad has folded on open ground. Kill the one that saw you first, if you can tell which it was. Otherwise, kill fast, and don't be standing wherever they all decided to look.",
  },
  {
    id: "bloom_undertow",
    gateMissionId: "mission_amaranth_4",
    displayName: "Undertow",
    body: "You will not see this thing until it wants you to, or until something with a sharper sensor does. It waits under the ground, motionless, right up until it surfaces to strike — and the strike lands harder for the wait. After that, it's just a target like anything else. The wait is the entire fight.",
  },
  {
    id: "bloom_sporethrower",
    gateMissionId: "mission_amaranth_7",
    displayName: "Sporethrower",
    body: "Slow, low to the ground, and it never has to be anywhere near you to hurt you. It plants itself at range and spits, and nothing you do at melee reach touches it back — no counter, no retaliation, just the shot landing and the next one already loading. It's not fast and it's not smart. It doesn't have to be either, from that far away. Close the distance or go around it. Standing where it can already see you is the one thing that doesn't work.",
  },
  {
    id: "bloom_choir",
    gateMissionId: "mission_amaranth_8",
    displayName: "The Choir",
    body: "Whatever the flying ones usually are, this isn't one of them alone — it's several, and they don't hunt like several. They call and answer, mid-fight, in real time, closing from different angles on the same signal like it was planned before the fight started. Maybe it was. Nobody's found anything that looks like a leader among them, which is its own kind of unsettling — coordination this clean, and apparently nobody in charge of it. Whatever's screaming, it's screaming together.",
  },
  {
    id: "bloom_gallcyst",
    gateMissionId: "mission_amaranth_9",
    displayName: "Gallcyst",
    body: "It doesn't move, doesn't need to — plant it somewhere with a line of sight and it holds that ground better than almost anything else the Bloom fields. Whatever's actually alive inside that shell is small. Getting through to it is the entire fight, and for most of that fight it does not look like it's working. Then it does, all at once, and whatever's left underneath goes just as fast as it looked slow a moment ago. The acid it spits in the meantime doesn't wash off clean, and neither does the ground it lands on.",
  },
  {
    id: "bloom_sirenmaw",
    gateMissionId: "mission_amaranth_12",
    displayName: "Sirenmaw",
    body: "The first thing that flies. Ground, rubble, open water — none of it slows this thing down or gets in its way, and nothing on the field can wall it out. It doesn't hit hardest of anything you'll fight. What it does is scream, close enough and loud enough that everyone near the mech it's screaming at fights a little worse for a while — not just the one it caught. Take it down first if you can reach it, or plan the fight assuming your own aim is a little off for as long as it's still in the air.",
  },
  {
    id: "bloom_wellroot",
    gateMissionId: "mission_amaranth_21",
    displayName: "The Wellroot",
    body: 'Solheim found the root structure two weeks before anyone found what\'s actually growing out of it — "too regular to be natural," she called it, and she wasn\'t wrong. It doesn\'t move, doesn\'t have to: it\'s already dug in past anywhere you\'d want to reach it, and it calls up burrowers of its own the longer the fight runs. The wound it leaves isn\'t the kind that closes clean. Whatever\'s feeding it, it isn\'t hungry — it\'s patient.',
  },
  {
    id: "bloom_unnamed",
    gateMissionId: "mission_amaranth_35",
    displayName: "The Unnamed",
    body: "Nobody who's fought this thing has ever called it anything else, and nobody's tried very hard to fix that. It's not that no name fits — it's that naming it feels like agreeing it's one thing, singular, when everything about how it fights says otherwise. It doesn't move because it's already everywhere it needs to be. It doesn't panic when the shell finally gives, because nothing about what's underneath was ever waiting to be found — it was already there the whole time, under everything you thought you were fighting instead. Whatever it is you actually beat, if you beat it, you won't get a name for that either. You'll get to still be standing, and Meridian still standing under you. Some fights, that's the whole prize.",
  },
];

export function isBestiaryEntryUnlocked(entry: BestiaryEntry, highestMissionIndexReached: number): boolean {
  return wardenMissionIndex(entry.gateMissionId) <= highestMissionIndexReached;
}

// ---------------------------------------------------------------------
// World
// ---------------------------------------------------------------------

export interface WorldRevision {
  /** undefined = ungated — visible for any Warden save from the start. */
  unlockedAfterMissionId?: string;
  text: string;
}

export interface WorldEntry {
  id: string;
  title: string;
  /** In ascending gate order — see latestUnlockedWorldRevision. */
  revisions: WorldRevision[];
}

export const WORLD: WorldEntry[] = [
  {
    id: "world_coalition",
    title: "The Coalition",
    revisions: [
      {
        text: "The Amaranth Reach is one frontier sector among more than Warden Company will ever see the edge of. Out past it, the war against the Bloom is fought by an alliance of worlds and species stretching further than any one unit's own maps show — the Reach answers, on paper, up a chain of command most of the company has never met and mostly doesn't think about.\n\nDoctrine, wherever it actually comes from, is simple: you're given the objective, and you're trusted to reach it. Nobody's radioed Rourke a change of orders in longer than anyone currently serving can remember. A company this far out, still carrying a corporate name nobody ever bothered to change, doesn't get many occasions to ask whether that's how the chain of command is supposed to work, or just how it's worked out here.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_20",
        text: "Colonel Marrow said it plainly, once the duel was over and there was nothing left on the field to prove by pretending otherwise: nobody's actually held Warden Company's own paperwork in years. Said it like an insult, and meant it like one — a House officer's easy contempt for a unit that answers to no one because no one's bothered to ask in longer than anyone still serving can remember.\n\nShe didn't explain further, and nobody chased her for it. Whether she was right, or just cruel, or both, is the kind of question the war doesn't leave much room to sit with — not until somebody official says so out loud, on the record, instead of an enemy throwing it out as one last word before disengaging.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_36",
        text: 'The relief fleet that reached the Reach was the first time anyone in Warden Company heard their own chain of command\'s full name spoken out loud, formally, the way an institution states itself on first contact: the Coalition of Enlightened. Nobody in the company has said it that way since. It\'s "the Coalition," same as it always was — the short form was never a mystery, just never confirmed.\n\nWhat the fleet\'s own officers made clear, without quite saying it plainly: out past the Reach, the war runs on a real shape — worlds and species administered in overlapping rings the Coalition itself calls Core, Mid-Rim, and Frontier, and threaded through with old political houses (the Hearth Bloc, the Ledger, the Frontier Compact, Standing Service, the Cradle Circle) that have been arguing over the war\'s cost longer than Warden Company has existed. A unit like Warden\'s is nominally held under something the Coalition calls a Warrant — political ownership, separate from whoever\'s actually running a unit day to day, the Hand in their own terms. Whichever officer holds Warden\'s Warrant, nobody currently serving has ever met them — and the fleet\'s own records, checked without much ceremony, turned up exactly what a House Amaranth colonel had already said for free, sixteen missions and a war ago: there\'s nobody left to check.',
      },
    ],
  },
  {
    id: "world_amaranth_reach",
    title: "The Amaranth Reach",
    revisions: [
      {
        text: "A frontier cluster on the edge of core-administered space, held nominally by a sector governor-general who's never once had to actually worry about it. Its wealth and its name both come from the same source — House Amaranth, the founding charter dynasty, generations deep in the sector's richest agricultural terraces. Warden Company holds a stretch of border line here, the Fallow Line, alongside House Amaranth's own chartered battlegroup. Meridian, the Reach's capital, gets its own entry.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_36",
        text: "After the siege, the name doesn't get used much anymore. Nobody's issued an order about it. It just isn't, the way people stop calling a street by a landlord's name once everyone remembers what that landlord actually did.",
      },
    ],
  },
  {
    id: "world_house_amaranth",
    title: "House Amaranth",
    revisions: [
      {
        unlockedAfterMissionId: "mission_amaranth_6",
        text: "A charter house, generations old, holding the Reach's richest terraces. Fields its own chartered battlegroup alongside the Reach's loyalist regulars — Colonel Ysolde Marrow runs it day to day. Officially allied with Warden Company. That alliance has been tense since a checkpoint dispute neither side has fully let go of.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_10",
        text: "Whatever's actually kept this alliance strained, it broke outright once. House Amaranth pulled off a position everyone was supposed to be holding together — no warning given, no explanation offered since.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_17",
        text: 'Something about how the Bloom grows on House Amaranth\'s own terraces doesn\'t read as accident anymore. Too regular, too directed, too calm about it on House Amaranth\'s side for something that\'s supposed to be everyone\'s shared enemy. Nobody\'s said the word "deliberate" out loud yet. It\'s getting harder not to.',
      },
      {
        unlockedAfterMissionId: "mission_amaranth_23",
        text: "It was deliberate the whole time. House Amaranth's own research — decades of it, reaching back to the war's earliest years — got turned into a bargain: divert the Bloom's growth away from House lands, and call the redirected mess stewardship instead of what it actually is. It worked long enough to look like wisdom. Nobody who signed off on it thought it would still be paying out this way.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_28",
        text: "Whatever debt put Colonel Marrow in that seat, she's stopped paying it. She turned on Halcyon Amaranth herself, mid-battle, at real cost — the kind of choice that doesn't undo anything already done, and isn't made to undo anything either. Warden Company doesn't know yet whether it changes the war they're actually fighting. It's not clear it does.",
      },
    ],
  },
  {
    id: "world_meridian",
    title: "Meridian",
    revisions: [
      {
        text: "The Amaranth Reach's capital world. Shipyards, an orbital elevator, more people than the rest of the sector combined. Everyone out on the Fallow Line has family there, or knows someone who does. It's the place this whole war is nominally protecting, whether or not it ever feels like it from a trench on the border.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_25",
        text: "Whatever's been quietly accelerating out on the terraces has found a new gear entirely, and it's coming this way faster than anyone accounted for. Meridian's own orbital defense grid — Meridian's Oath — just went from a name on a briefing slide to something Warden Company is actually calling in mid-fight.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_29",
        text: "Falling back ring by ring around a capital that isn't supposed to fall changes what a fight even means. The outer ring went by design, not by failure — buying time, not holding ground. What's left gets smaller every time Warden Company checks, and closer to the people the whole war was supposed to be keeping safe.",
      },
      {
        unlockedAfterMissionId: "mission_amaranth_36",
        text: "It held. Changed for good — the name that used to belong to the whole reach around it doesn't get said much anymore, and Meridian itself remembers exactly how close that margin actually was, even if the official histories round it up to a clean victory.",
      },
    ],
  },
];

/**
 * The one revision to actually render — the LATEST one this save's own
 * progress has reached, per the WorldCodexEntry schema's own rule (always
 * show the newest applicable revision, never the whole history at once).
 * Returns null when even the first revision's gate hasn't been met yet
 * (only possible for House Amaranth, whose revision 1 itself requires
 * Mission 6) — Codex.ts renders that as "not yet encountered," the same
 * placeholder convention Bestiary uses for a fully-locked entry.
 */
export function latestUnlockedWorldRevision(entry: WorldEntry, highestMissionIndexReached: number): WorldRevision | null {
  let unlocked: WorldRevision | null = null;
  for (const rev of entry.revisions) {
    const meetsGate = rev.unlockedAfterMissionId === undefined || wardenMissionIndex(rev.unlockedAfterMissionId) <= highestMissionIndexReached;
    if (meetsGate) unlocked = rev;
  }
  return unlocked;
}

// ---------------------------------------------------------------------
// Systems — always browsable, no save required (see gate note #3 above)
// ---------------------------------------------------------------------

export interface SystemsEntry {
  id: string;
  title: string;
  body: string[];
}

export const SYSTEMS: SystemsEntry[] = [
  {
    id: "system_class_triangle",
    title: "The Three Paths",
    body: [
      "Every pilot flies one of three combat paths, and the three beat each other in a loop: Meeps beats Reeps, Reeps beats Tank, Tank beats Meeps. No path is strongest overall — which one wins a fight depends entirely on who's fighting whom.",
      "A Meeps is fast and fragile — six tiles of movement, one-tile reach, built to close distance before anything can react. It doesn't out-fight a Tank; it goes around one, because a Tank's whole threat is standing next to you, and a Meeps' whole plan is never giving it the chance.",
      "A Tank stands its ground — short movement, high defense, an overshield that protects everyone standing near it. It punishes anything that comes adjacent. It has no answer to anything that doesn't.",
      "A Reeps fights from range — two to four tiles out, never in melee, never countered for it. It chips away at a Tank's raised defense from a distance the Tank can't close, and it dies in two hits if a Meeps ever actually reaches it.",
      "A fourth path, Munti, sits outside the triangle entirely. It doesn't win fights — it keeps everyone else alive. Every mission is quietly a mission to protect it.",
    ],
  },
  {
    id: "system_chassis",
    title: "Chassis and Species",
    body: [
      "Every pilot's body shapes how they move and fight, independent of which of the three paths they've chosen — a Hiopi Meeps and a human Meeps are both Meeps, they just get there differently.",
      "Human pilots use the standard bipedal frame — no terrain penalties, no special tricks, a slightly higher baseline toughness to make up for it.",
      "Hiopi pilots use a centauroid frame — full speed across open ground, slower through rubble and tight structures, and a real reward for committing to it: charging three tiles or more in a straight line before striking hits harder.",
      "Osnian pilots use a modified bipedal frame with a longer sensor suite — wider vision, and the ability to see burrowed threats other pilots can only find by walking into them.",
    ],
  },
  {
    id: "system_mek",
    title: "Meks",
    body: [
      "Every pilot has exactly one Mek — never on the board, never a target, never lost to anything that happens in a fight. A Mek doesn't fight. It's the reason the pilot fights a little better, all the time, without anyone having to think about it mid-mission.",
      "Four real specialties, and a Mek carries one, sometimes two. A Fabricator keeps spare parts in reserve — a downed pilot's own restock crate, so when Beacon Control pulls them back into the fight it costs the company nothing from the Restock Room shelf. An Armorer simply makes the whole unit hit harder and shrug off more. A Runemaster sharpens awareness and reaction across the board — sees further, reacts first, and makes whatever the pilot's own weapon does on a hit last longer and bite harder. A Fieldwright rewards holding position: heals the pilot who stays put, and if that pilot is a Munti, makes their own healing hit harder too.",
      "One specialty exists only as a Mek's second skill, never its first — a Mek that's purely good at stretching the company's points further, cheaper gear for the rest of the campaign, nothing sharper in a fight. Not every pilot wants that trade. Some do, and it adds up.",
    ],
  },
  {
    id: "system_gear",
    title: "Gear Tiers",
    body: [
      "Every pilot starts on standard issue and earns better with points spent, not levels grinded — a straight climb from G up to A, seven rungs, each one a real but modest step rather than a leap that makes everything below it obsolete. The company doesn't hand out gear that turns a fight into a stat check. It hands out gear that turns a close fight into a winnable one.",
      "What it's actually called changes with what a pilot flies. A Meeps climbs from a Stocklance through Heavylance, Twinlance, and Pairblade, on to an Arcblade, a Flareblade, and — for the very few who get there — a Stormblade. A Tank goes Blockshield to Wallpanel to Skinshield to Groupshield, then Maserline, Tachlance, Bastion. A Reeps runs a Popgun up through Burstrifle, Twinburst, Longeye, Farmark, Twinmark, to a Skyline. A Munti's kit goes from a Quickfix kit to a Longarm, a Farfix, a Lifebox, a Quickbox, a Widefix, and at the very top, an Overcharge.",
      "D-tier is the first rung that earns a real ability. B-tier earns a second. A-tier is as far as the standard ladder goes — and past it, there's nothing left to buy. What's past it isn't for sale at all.",
    ],
  },
  {
    id: "system_collapse",
    title: "How the Bloom Dies: the Collapse Rule",
    body: [
      "A Bloom creature's health isn't one bar — it's two: Endurance, the shell, and Vitality, the thing living underneath it. Damage empties Endurance first, and a hit that overflows past zero Endurance does not carry into Vitality — the shell simply breaks. Once Endurance hits zero, the creature enters Collapse: any hit at least as hard as its remaining Vitality kills it outright, and — this is the part worth watching for — a creature in Collapse hits back at full strength, not weaker. The moment it looks like it's dying is the moment it's most dangerous. That's not a bug in how it reads. That's the whole point.",
    ],
  },
  {
    id: "system_heirloom",
    title: "The Heirloom",
    body: [
      "One per company, not one per pilot — charged by every hit landed and every hit taken, by anyone, and spent all at once by whoever's holding it when it's full. Aim it in a straight line, eight tiles long, and it fires.",
      "It doesn't ask what's standing in that line. Ally, enemy, doesn't matter — it hits everything the same, at the same fixed, ugly number, no gear bonus, no defense stat softening it, nothing. Every other hit in this war respects one limit: nothing can drop a mech from full health in a single shot. The Heirloom doesn't know that rule exists. And against anything the Bloom fields with a shell worth grinding down — the kind of thing that just shrugs off everything smaller — it doesn't grind. It goes straight through the shell to whatever's actually alive underneath, and if that's not much, that's the whole fight, over, in one line drawn across the map.",
      "Charging it is free. Firing it never is.",
    ],
  },
];

// ---------------------------------------------------------------------
// Ranks & Command — always browsable, flavor-only (nothing here is
// mechanically live yet, per Rank_And_Command_v1.md's own "paper only,
// nothing here is built" framing).
// ---------------------------------------------------------------------

export interface RanksEntry {
  id: string;
  title: string;
  body: string[];
}

export const RANKS: RanksEntry[] = [
  {
    id: "rank_personal",
    title: "Personal Rank",
    body: [
      "Every pilot climbs the same ladder, earned through gear rather than time served — showing up and training isn't separately rewarded here, only real capability is. Pvt. at the bottom, then Pfc., Cpl., Sgt., Staff Sgt., M.Sgt., and at the very top of what an enlisted pilot can reach without a command posting, Sgt. Maj.",
      "Munti pilots often carry a different title at the same rungs — Spec. in place of Cpl. or Sgt. — the same old habit real militaries have of marking support and technical roles apart from the line, not a separate ladder, just a different name painted on the same climb.",
    ],
  },
  {
    id: "rank_command",
    title: "Command Position",
    body: [
      "A role, not a rung — layered on top of personal rank rather than replacing it. Lance Lead runs one five-pilot lance day to day, carrying the title 2nd Lt. Company Commander sits above that, running the whole force, carrying Capt. and later Maj. as the company grows.",
      "The two aren't a hand-off. When a Lance Lead gets promoted to Company Commander, they don't step back from the lance they were already running — they keep leading it in person, on top of everything else now answering to them. Rourke's own record is the clearest example: still Lance A's Lead, the exact same lance she's led since her very first mission, and Company Commander over the whole of Warden Company besides.",
    ],
  },
];

// ---------------------------------------------------------------------
// Glossary — always browsable, short-form lookups.
// ---------------------------------------------------------------------

export interface GlossaryTerm {
  term: string;
  def: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: "Meeps", def: "Fast, fragile combat path. Six tiles of movement, one-tile reach. Beats Tank, loses to Reeps." },
  { term: "Reeps", def: "Ranged combat path. Fights from two to four tiles out, never in melee. Beats Tank at range, loses badly if a Meeps ever closes the distance." },
  { term: "Tank", def: "Defensive combat path. Short movement, high defense, an overshield that protects nearby allies. Beats Meeps, loses to Reeps." },
  { term: "Munti", def: "Support path. Outside the triangle entirely — doesn't fight to win, keeps everyone else alive. Every mission is quietly a mission to protect it." },
  { term: "Endurance", def: "A Bloom creature's outer health value. Depletes first; a hit that overflows past zero doesn't carry through to Vitality underneath." },
  { term: "Vitality", def: "What's actually alive underneath a Bloom creature's Endurance. Once Endurance hits zero, any hit at least this large kills outright." },
  { term: "Collapse", def: "The state a Bloom creature enters the instant its Endurance hits zero. Fights back at full strength while in it — not weaker." },
  { term: "Restock", def: "A downed pilot returns to the field at full strength next mission, rather than being lost for good — provided a Munti was alive on the field at the moment they went down. No Munti on the field, no restock." },
  { term: "Mek", def: "A pilot's personal support partner. Never deployed, never a target, never lost to anything that happens in a fight." },
  { term: "Bloom-mat", def: "Ground the Bloom leaves behind. Deals acid damage over time to anything standing on it." },
  { term: "Spare part", def: "A Fabricator Mek's own restock crate. When Beacon Control revives that Mek's pilot mid-mission, the beacon burns one of these instead of a crate from the Restock Room." },
  { term: "Lance", def: "A five-pilot squad; the basic organizational unit Warden Company is built from." },
  { term: "Gear tier", def: "A pilot's own equipment ladder, G up through A, climbed with points rather than time served. An Heirloom pilot sits above it entirely, at S — a rung nothing can be bought up to." },
  { term: "The Requiem system", def: "Warden Company's own company-wide Heirloom mechanic. One charge, shared by the whole unit, spent by whoever's holding it: a line of damage eight tiles long that doesn't check sides, and doesn't stop for a full shell of Endurance either. The specific weapon wielded under it — Bosk's, then Rourke's — is called Gjallar." },
];
