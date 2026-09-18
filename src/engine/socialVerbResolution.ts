// src/engine/socialVerbResolution.ts
//
// The single-target social verbs that share one flat-delta shape — Gift,
// Praise, Flirt, Insult, Apology, Congratulate, Send-Off — resolved in one
// Phaser-free place. Mission Chat, Player Notes and Battle HUD Relayout
// Plan v1, Workstream 4 (§5c), 12 Sep 2026: "The real work is
// architectural, not designed." Condolences and Reassurance (15 Sep 2026,
// the "Any new verb we can add in?" batch) joined the same list later —
// same flat-delta shape, same reasons to live here rather than on a scene.
//
// Until today every one of these lived as a private method on scenes/Hub.ts
// (giveGift, praiseNpc, flirtWithNpc, insultNpc, apologizeToNpc,
// congratulateNpc, sendOffNpc — 2 Sep 2026, Flirt 12 Sep 2026), each one
// mutating a HubNpc, showing a bubble, logging the verb, persisting. The
// Battle scene needs the exact same mechanics for mission chat and cannot
// import a scene file: scene files import "phaser" at module scope, which
// throws outside a browser (the same reason engine/hubGeometry.ts and
// engine/hoverTipLayout.ts exist as separate modules). This is the
// project's own reuse-over-rebuild rule applied directly: the MECHANICS —
// which numbers move, by how much, the Insult ladder's tiers, which line
// bank answers — are here, once; the two scenes keep only what's genuinely
// theirs (the Hub's bubble and walk-hold, the Battle's comms line).
//
// What this touches and what it deliberately doesn't:
//
//   - It reads and writes the pilot's persisted HubPilotSocialState
//     (engine/campaignState.ts's ensureHubSocialState — favorability,
//     stress, morale, insultsGiven, refusesDeployment, socialLog). Every
//     number Hub.ts used to write onto the HubNpc and then copy across in
//     persistNpcSocial now lands on the persisted object first; Hub.ts
//     copies the result back onto its NPC (see applySocialVerbToNpc there).
//   - It does NOT save. The caller saves (Hub: persistNpcSocial, as
//     always; Battle: saveCampaignState straight after) — same "mutate,
//     then save" idiom every scene already uses.
//   - It does NOT charge the calendar. The Hub charges applyVerbDayCost
//     per verb as before; the Battle's clock is real time accrued for the
//     whole mission (Battle.ts's calendarMsAccrued), so charging a verb
//     cost on top would count the same minutes twice.
//   - It does NOT push hot topics anywhere. A Tier-2 insult produces the
//     "insulted" HotTopic as a RETURN VALUE; the Hub pushes it into its own
//     live list exactly as before, the Battle queues it on
//     CampaignState.pendingHotTopics for the Hub to pick up on the next
//     visit (see that field's own comment) — the Hub's hot topics are a
//     scene-local list seeded from one-shot flags, and there is no Hub
//     to push into from inside a mission.
//   - Congratulate needs a live "promoted" topic about this pilot to pay
//     out (the anti-farming rule from 2 Sep 2026). The caller passes
//     whatever topic list it has — the Hub its live list, the Battle the
//     pending queue — and gets the same "Congrats for what?" refusal
//     either way when there's none. 13 Sep 2026: mission chat also has a
//     second, independent way in — SocialVerbContext.killCredit, true when
//     the pilot has a confirmed kill this mission (Mission.unitPerformance,
//     the same counter ledger_entry and the Debrief summary already read).
//     A real "congrats on the kill" beat, not a wording change: promotions
//     never happen mid-mission, so without this the mission-chat Congratulate
//     could never once succeed. Deliberately NOT a HotTopic — a kill isn't
//     something other pilots should overhear about later (see hotTopics.ts's
//     own circulation rules), it's a private, in-the-moment nod between the
//     two people in the exchange. The Hub never sets this flag and its
//     behavior is unchanged.
//
// Diminishing returns (§5c's one flagged addition, easy to veto): Maxime
// explicitly declined a per-mission cap on chat, and this respects that —
// nothing here limits how much a player may TYPE. But the same verb at the
// same pilot repeated within one mission is worth half the previous
// instance each time, floored at zero, or "type the same compliment eleven
// times" is the dominant morale strategy in the game. `repeatIndex` is
// how many times this verb has already been used on this pilot in the
// current mission (0 the first time); the Hub passes 0 always — it never
// had this rule and this pass doesn't add one there. The reaction line
// still plays at full strength; only the deltas scale.
import type { CampaignState } from "./campaignState";
import { ensureHubSocialState } from "./campaignState";
import { recordMemory } from "./memoryLedger";
import type { Catalyst } from "../data/ambientLines";
import type { HotTopic } from "../data/hotTopics";
import type { SocialLogEntry, VerbId } from "../data/verbs";
import {
  GIFT_FAVORABILITY_DELTA,
  pickGiftLine,
  PRAISE_FAVORABILITY_DELTA,
  pickPraiseLine,
  INSULT_FAVORABILITY_DELTA,
  pickInsultLine,
  APOLOGY_FAVORABILITY_DELTA,
  pickApologyLine,
  INSULT_TIER2_COUNT,
  INSULT_TIER2_STRESS_BUMP,
  INSULT_TIER3_COUNT,
  INSULT_TIER3_FAVORABILITY_CEILING,
  CONGRATULATE_FAVORABILITY_DELTA,
  CONGRATULATE_MORALE_DELTA,
  pickCongratulateLine,
  FLIRT_FAVORABILITY_DELTA,
  FLIRT_FAVORABILITY_GATE,
  pickFlirtLine,
  SEND_OFF_FAVORABILITY_DELTA,
  SEND_OFF_STRESS_DELTA,
  pickSendOffLine,
  CONDOLENCE_FAVORABILITY_DELTA,
  CONDOLENCE_STRESS_DELTA,
  pickCondolenceLine,
  REASSURANCE_STRESS_DELTA,
  REASSURANCE_MORALE_DELTA,
  pickReassuranceLine,
  type VerbLineState,
} from "../data/socialActions";
import { STRESS_PANIC_THRESHOLD, MORALE_PANIC_THRESHOLD } from "../data/ambientLines";
import { CLOSE_FRIEND_ONLY_LINES } from "../data/romance";

export type SocialVerb = Extract<
  VerbId,
  "gift" | "praise" | "flirt" | "insult" | "apology" | "congratulate" | "sendOff" | "condolences" | "reassurance"
>;

export const SOCIAL_VERBS: readonly SocialVerb[] = [
  "gift",
  "praise",
  "flirt",
  "insult",
  "apology",
  "congratulate",
  "sendOff",
  "condolences",
  "reassurance",
];

export function isSocialVerb(verb: VerbId | null | undefined): verb is SocialVerb {
  return !!verb && (SOCIAL_VERBS as readonly string[]).includes(verb);
}

/** Who the verb is aimed at — everything the mechanics need to know about them. */
export interface SocialVerbSubject {
  pilotId: string;
  /** Display name with any "— callsign" suffix; the "insulted" topic's aboutName is derived from it exactly as Hub.ts always did. */
  displayName: string;
  catalyst: Catalyst;
  /** romance.ts's isRomanceableSpecies for this pilot — Flirt's close-friend-only redirect key. */
  romanceable: boolean;
  /** Seed values for a pilot with no persisted social state yet (Hub.ts's own per-NPC seed or its generic {0, 10, 70}). */
  seed: { favorability: number; stress: number; morale: number };
}

export interface SocialVerbContext {
  /** Live hot topics the caller knows about — Congratulate looks for a "promoted" one about this pilot. */
  hotTopics: readonly HotTopic[];
  /** Mission chat only, 13 Sep 2026 — true when this pilot has a confirmed kill this mission, a second (non-HotTopic) way for Congratulate to pay out. See this file's own header. Hub always leaves this unset. */
  killCredit?: boolean;
  /** Date.now() at the caller — SocialLogEntry.at and the topic's `at`. */
  now: number;
  /** Times this verb has already hit this pilot in the current mission (Battle only; Hub passes 0). */
  repeatIndex?: number;
  /** Optional RNG for line picks with more than one candidate (tests). Defaults to Math.random. */
  rng?: () => number;
  /** Emotional Brain, 12 Sep 2026 — who else was there (same room in the Hub, the deployed squad in a mission). Recorded on the memory a Gift or an Insult leaves. */
  witnesses?: readonly string[];
}

export interface SocialVerbResult {
  verb: SocialVerb;
  /** The reaction line the pilot says. */
  line: string;
  /** False when the verb refused (Congratulate with no topic, Flirt at a close-friend-only species): nothing moved. */
  applied: boolean;
  /** True when a SocialLogEntry was written — every applied verb, plus the close-friend-only Flirt redirect (Hub.ts always logged that one). Congratulate's "for what?" is the one case nothing is logged. Callers persist and charge the calendar exactly when this is true, matching what each scene did before. */
  logged: boolean;
  /** The pilot's persisted numbers AFTER the verb — the Hub copies these back onto its NPC. */
  favorability: number;
  stress: number;
  morale: number;
  /** Set only when this call is what flipped refusesDeployment (Insult Tier 3). */
  refusesDeploymentSet: boolean;
  /** Set only when this call reached Insult Tier 2 — the caller decides where the topic goes. */
  hotTopic?: HotTopic;
  /** Set only on Send-Off — the caller writes CampaignState.preMissionSendOff as before. */
  sendOff?: boolean;
  /** The scale the deltas were applied at (1 the first time, 0.5, 0.25, …, then 0). */
  scale: number;
}

/** 1, 0.5, 0.25, 0.125, then 0 — halving each repeat, floored to nothing past the fourth. */
export function repeatScale(repeatIndex: number): number {
  if (repeatIndex <= 0) return 1;
  if (repeatIndex >= 4) return 0;
  return 1 / 2 ** repeatIndex;
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Scale a delta and round toward zero, so a halved -3 is -1, never -2, and a scale of 0 is exactly 0. */
function scaled(delta: number, scale: number): number {
  return Math.trunc(delta * scale);
}

/**
 * Resolve one verb against one pilot. Mutates that pilot's persisted
 * social state (through ensureHubSocialState) and returns what happened.
 * Never saves, never charges the calendar, never pushes a hot topic — see
 * the file header for who does each of those.
 */
/**
 * Which line bucket a reaction comes from, 17 Sep 2026 — read off the same
 * persisted social state the deltas are applied to, BEFORE this verb's own
 * delta lands (the pilot reacts as the person they were when you spoke).
 * Precedence: drunk, then stressed, then low_morale, then idle — see
 * data/socialActions.ts's VerbLineState. Exported so a test can pin it.
 */
export function verbLineStateFor(social: { stress: number; morale: number; drunkUntil?: number }, now: number): VerbLineState {
  if (social.drunkUntil !== undefined && social.drunkUntil > now) return "drunk";
  if (social.stress >= STRESS_PANIC_THRESHOLD) return "stressed";
  if (social.morale <= MORALE_PANIC_THRESHOLD) return "low_morale";
  return "idle";
}

export function resolveSocialVerb(state: CampaignState, subject: SocialVerbSubject, verb: SocialVerb, ctx: SocialVerbContext): SocialVerbResult {
  const social = ensureHubSocialState(state, subject.pilotId, subject.seed);
  const scale = repeatScale(ctx.repeatIndex ?? 0);
  const rng = ctx.rng ?? Math.random;
  // 17 Sep 2026 — the bucket every catalyst line pick below reads from.
  // Every bucket but idle is empty today (Maxime writes them), so this is
  // behaviour-neutral until his lines land.
  const lineState = verbLineStateFor(social, ctx.now);
  const base = (line: string, applied: boolean, logged: boolean = applied): SocialVerbResult => ({
    verb,
    line,
    applied,
    logged,
    favorability: social.favorability,
    stress: social.stress,
    morale: social.morale,
    refusesDeploymentSet: false,
    scale,
  });
  const log = (line: string) => {
    social.socialLog = social.socialLog ?? [];
    const entry: SocialLogEntry = { verb, line, at: ctx.now };
    social.socialLog.push(entry);
  };

  switch (verb) {
    case "gift": {
      social.favorability += scaled(GIFT_FAVORABILITY_DELTA, scale);
      const line = pickGiftLine(subject.catalyst, lineState, rng);
      log(line);
      // Emotional Brain, 12 Sep 2026 — a gift is carried (data/memories.ts
      // `was_gifted`, warm). Only while the verb still has weight: the
      // fifth gift in one mission (scale 0) moves nothing and is not a
      // memory either.
      if (scale > 0) recordMemory(state, subject.pilotId, { kind: "was_gifted", echo: "love", witnesses: [...(ctx.witnesses ?? [])], now: ctx.now });
      return base(line, true);
    }
    case "praise": {
      social.favorability += scaled(PRAISE_FAVORABILITY_DELTA, scale);
      const line = pickPraiseLine(subject.catalyst, lineState, rng);
      log(line);
      return base(line, true);
    }
    case "flirt": {
      if (!subject.romanceable) {
        // The same CLOSE_FRIEND_ONLY redirect Ask Out uses for the identical
        // case — logged as a flirt (Hub.ts always did), nothing moves.
        const line = CLOSE_FRIEND_ONLY_LINES[Math.floor(rng() * CLOSE_FRIEND_ONLY_LINES.length)];
        log(line);
        return base(line, false, true);
      }
      // Favorability gate, 12 Sep 2026 (Placeholder TODO item N, resolved
      // via AskUserQuestion — "layer both gates"): the species check above
      // is unchanged and still runs first; this is a second, independent
      // gate on top of it. Below FLIRT_FAVORABILITY_GATE this refuses like
      // any other requirements-gated verb (Congratulate's "Congrats for
      // what?" precedent) — a plain line, no favorability change, no line
      // roll, nothing logged.
      if (social.favorability < FLIRT_FAVORABILITY_GATE) {
        return base("You don't know them well enough yet.", false);
      }
      social.favorability += scaled(FLIRT_FAVORABILITY_DELTA, scale);
      const line = pickFlirtLine(subject.catalyst);
      log(line);
      return base(line, true);
    }
    case "insult": {
      social.favorability += scaled(INSULT_FAVORABILITY_DELTA[subject.catalyst], scale);
      // The ladder counts every insult at full weight regardless of scale:
      // repeating yourself is worth less standing, not fewer strikes.
      social.insultsGiven = (social.insultsGiven ?? 0) + 1;
      const count = social.insultsGiven;
      let hotTopic: HotTopic | undefined;
      if (count === INSULT_TIER2_COUNT) {
        hotTopic = {
          kind: "insulted",
          aboutPilotId: subject.pilotId,
          aboutName: subject.displayName.split("—")[0].trim(),
          at: ctx.now,
          mentionedBy: [],
        };
        social.stress = Math.min(100, social.stress + INSULT_TIER2_STRESS_BUMP);
      }
      let refusesDeploymentSet = false;
      if (count >= INSULT_TIER3_COUNT && social.favorability <= INSULT_TIER3_FAVORABILITY_CEILING && !social.refusesDeployment) {
        social.refusesDeployment = true;
        refusesDeploymentSet = true;
      }
      const line = pickInsultLine(subject.catalyst, lineState, rng);
      log(line);
      // Emotional Brain, 12 Sep 2026 — an insult is carried (`was_insulted`).
      // Anger for most archetypes; a Rabbit takes it as hurt, a Bear as
      // withdrawal (data/echoLean.ts's own rows say the same about them).
      if (scale > 0) {
        const echo = subject.catalyst === "rabbit" || subject.catalyst === "bear" ? "sadness" : "anger";
        recordMemory(state, subject.pilotId, { kind: "was_insulted", echo, witnesses: [...(ctx.witnesses ?? [])], now: ctx.now });
      }
      return { ...base(line, true), hotTopic, refusesDeploymentSet };
    }
    case "apology": {
      social.favorability += scaled(APOLOGY_FAVORABILITY_DELTA[subject.catalyst], scale);
      const line = pickApologyLine(subject.catalyst, lineState, rng);
      log(line);
      return base(line, true);
    }
    case "congratulate": {
      const topic = ctx.hotTopics.find((t) => t.kind === "promoted" && t.aboutPilotId === subject.pilotId);
      if (!topic && !ctx.killCredit) return base("Congrats for what?", false);
      social.favorability += scaled(CONGRATULATE_FAVORABILITY_DELTA, scale);
      social.morale = clamp100(social.morale + scaled(CONGRATULATE_MORALE_DELTA, scale));
      const line = pickCongratulateLine(subject.catalyst, lineState, rng);
      log(line);
      return base(line, true);
    }
    case "sendOff": {
      social.favorability += scaled(SEND_OFF_FAVORABILITY_DELTA, scale);
      social.stress = clamp100(social.stress + scaled(SEND_OFF_STRESS_DELTA, scale));
      const line = pickSendOffLine(subject.catalyst, lineState, rng);
      log(line);
      return { ...base(line, true), sendOff: true };
    }
    // 15 Sep 2026 — see data/socialActions.ts's own Condolences header for
    // why this gates on ANY live "muntiLost" topic rather than one about
    // this specific subject (aboutPilotId on that topic is the deceased,
    // not the pilot being consoled).
    case "condolences": {
      const topic = ctx.hotTopics.find((t) => t.kind === "muntiLost");
      if (!topic) return base("Comfort them about what? Nobody's been lost.", false);
      social.favorability += scaled(CONDOLENCE_FAVORABILITY_DELTA, scale);
      social.stress = clamp100(social.stress + scaled(CONDOLENCE_STRESS_DELTA, scale));
      const line = pickCondolenceLine(subject.catalyst, lineState, rng);
      log(line);
      return base(line, true);
    }
    // 15 Sep 2026 — no hot-topic gate, no Favorability change (the Spitball
    // doc's own spec: Stress/Morale only). The per-pilot cooldown lives on
    // Hub.ts's HubNpc, not here — see socialActions.ts's own Reassurance
    // header for why.
    case "reassurance": {
      social.stress = clamp100(social.stress + scaled(REASSURANCE_STRESS_DELTA, scale));
      social.morale = clamp100(social.morale + scaled(REASSURANCE_MORALE_DELTA, scale));
      const line = pickReassuranceLine(subject.catalyst, lineState, rng);
      log(line);
      return base(line, true);
    }
  }
}
