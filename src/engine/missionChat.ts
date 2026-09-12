// src/engine/missionChat.ts
//
// Mission chat's routing — who a typed line is addressed to, and what kind
// of line it is — as pure logic. Mission Chat, Player Notes and Battle HUD
// Relayout Plan v1, Workstream 4 (§5a/§5b), 12 Sep 2026. Phaser-free for
// the usual reason (see engine/battleLayout.ts's header); scenes/Battle.ts
// asks this "given what the player typed, who's on the board, who's
// selected and who's visible, what do I do," then does the doing.
//
// The Hub routes by walkable proximity (nearestNpcInRange). A mission has
// no proximity, so the rule is different — and it's the plan's own:
//
//   - The default addressee is the currently SELECTED friendly unit. The
//     natural analogue of "who you're standing next to," and it needs no
//     new interaction — a player is already clicking units all turn.
//   - Nothing selected means a squad broadcast: every living, un-downed
//     friendly pilot hears it. For small talk and ordinary chatter that's
//     exactly right ("hold together, all of you"). For the seven SOCIAL
//     VERBS it is deliberately NOT: a broadcast Praise would land the full
//     Favorability delta on five pilots at once, once per turn, for one
//     keystroke — a farming exploit the Hub's one-target verbs never had.
//     So a verb with no selection and no name is refused with a line that
//     says how to aim it. Flagged as a deviation from §5a's plain wording
//     ("nothing selected means a squad broadcast"), and easy to reverse.
//   - A name inside an ordinary line ("well done, Bosk") beats the
//     selection, exactly as Hub.ts's resolveChatTarget lets a named crewmate
//     beat "nearest" — chatIntent.ts's extractNamedTarget, reused, not
//     rebuilt. Crew only: hostiles are reached with :t, never by an inline
//     name, so a taunt can't accidentally re-target itself.
//   - ":t <name> <text>" targets by name — friendly OR hostile.
//
// Fog of war applies to chat. A hostile can only be addressed if the
// player side can currently see it (Mission.playerVisibleHostileIds, the
// same query the board draws from). Every AI tier except LEGACY got honest
// fog of war on 1 Sep because the old bot could shoot burrowed and
// concealed units no human can click; letting the player taunt something
// they can't see would reintroduce the same inconsistency from the other
// direction, and the restriction is free tension besides.
//
// The Bloom get no channel at all (locked decision 2, 4 Sep 2026). Not an
// eerie non-response, not a described behaviour line: naming one is a
// plain refusal. Human-crewed hostile mechs (BattleUnit.kind === "mech" on
// the hostile side — the runtime discriminator the plan's fact 1c asked
// for, no hardcoded archetype list) can be addressed; what saying
// something to one DOES is the Battle scene's business (today: logged,
// no reply — there is no morale system on the enemy side and no hostile
// content bank yet, see the scene).
import { detectCommand, detectSmallTalk, detectVerbRequest, extractNamedTarget, type ChatCommand, type SmallTalkKind } from "../data/chatIntent";
import { isSocialVerb, type SocialVerb } from "./socialVerbResolution";

/** Everything the router needs to know about one unit on the board. */
export interface ChatCandidate {
  id: string; // BattleUnit.instanceId
  pilotId?: string; // friendly pilots only
  displayName: string;
  side: "player" | "hostile";
  kind: "pilot" | "mech" | "bloom";
  /** Alive and not downed (a downed pilot can't reply; a downed hostile isn't a target). */
  able: boolean;
  /** Hostiles only: currently inside the player side's fog-of-war vision. Friendlies are always true. */
  visible: boolean;
}

/** A colon command other than :t — help, notes, unknown — for the scene to run. */
export type CommsCommand = Exclude<ChatCommand, { kind: "talk" }>;

export type MissionChatRoute =
  /** A colon command other than :t — the scene runs it (help, notes, unknown). */
  | { kind: "command"; command: CommsCommand }
  /** One of the seven social verbs at one friendly pilot. */
  | { kind: "verb"; verb: SocialVerb; target: ChatCandidate; text: string }
  /** Greeting/farewell/worry check-in/advice/banter at one or more friendly pilots. */
  | { kind: "smallTalk"; smallTalk: SmallTalkKind; targets: ChatCandidate[]; text: string }
  /** Anything else said to friendlies — the scene picks a catalyst-dictionary reaction or the shared shrug. */
  | { kind: "chatter"; targets: ChatCandidate[]; text: string }
  /** A line addressed to a visible, human-crewed hostile. */
  | { kind: "hostile"; target: ChatCandidate; text: string }
  /** Nothing happens; `reason` is shown as a SYS line. */
  | { kind: "refused"; reason: string };

export interface MissionChatContext {
  candidates: ChatCandidate[];
  /** The currently selected unit's instanceId, if any. */
  selectedId: string | null;
}

export const AIM_HINT = "Select a pilot first, or name one: :t <name> <what to say>";

function shortName(c: ChatCandidate): string {
  return c.displayName.split("—")[0].trim();
}

function friendlies(ctx: MissionChatContext): ChatCandidate[] {
  return ctx.candidates.filter((c) => c.side === "player" && c.kind === "pilot");
}

function ableFriendlies(ctx: MissionChatContext): ChatCandidate[] {
  return friendlies(ctx).filter((c) => c.able);
}

/** The selected unit, if it's a friendly pilot who can answer. */
function selectedFriendly(ctx: MissionChatContext): ChatCandidate | null {
  if (!ctx.selectedId) return null;
  const c = ctx.candidates.find((u) => u.id === ctx.selectedId);
  return c && c.side === "player" && c.kind === "pilot" && c.able ? c : null;
}

/**
 * extractNamedTarget over a candidate set, mapped back to the candidate.
 * The matcher only ever looks at the part of a display name BEFORE the
 * "— callsign" suffix (Hub.ts's six verbs never needed callsigns). The
 * plan's own §5a wants "display name or callsign" for missions, so the
 * suffix is folded into the matchable text here — "Farsight" reaches Anand
 * the same way "Anand" does — without changing what the Hub matches on.
 */
function named(text: string, pool: ChatCandidate[]): ChatCandidate | undefined {
  const hit = extractNamedTarget(
    text,
    pool.map((c) => ({ pilotId: c.id, displayName: c.displayName.replace(/[—“”"]/g, " ") }))
  );
  return hit ? pool.find((c) => c.id === hit) : undefined;
}

/** What kind of line `text` is, once its addressee is settled. */
function classify(text: string, targets: ChatCandidate[]): MissionChatRoute {
  const verb = detectVerbRequest(text);
  if (isSocialVerb(verb)) {
    if (targets.length !== 1) return { kind: "refused", reason: AIM_HINT };
    return { kind: "verb", verb, target: targets[0], text };
  }
  const smallTalk = detectSmallTalk(text);
  if (smallTalk) return { kind: "smallTalk", smallTalk, targets, text };
  return { kind: "chatter", targets, text };
}

/**
 * Route one typed line. Pure: no state is touched, nothing is logged —
 * the returned route says what the scene should do.
 */
export function resolveMissionChat(raw: string, ctx: MissionChatContext): MissionChatRoute {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "refused", reason: "" };

  const command = detectCommand(trimmed);
  if (command && command.kind !== "talk") return { kind: "command", command };

  if (command) {
    // ":t <name> <text>" — by name, friendly or hostile.
    if (!command.targetName || !command.text) return { kind: "refused", reason: "Usage: :t <name> <what to say>" };
    const target = named(command.targetName, ctx.candidates);
    if (!target) return { kind: "refused", reason: `Nobody on the field answers to "${command.targetName}".` };
    if (target.kind === "bloom") return { kind: "refused", reason: `The Bloom don't answer. Pick a pilot, or a hostile mech you can see.` };
    if (target.side === "hostile") {
      if (!target.able) return { kind: "refused", reason: `${shortName(target)} is down — nobody's listening on that channel.` };
      if (!target.visible) return { kind: "refused", reason: `You can't see ${shortName(target)} from here.` };
      return { kind: "hostile", target, text: command.text };
    }
    if (!target.able) return { kind: "refused", reason: `${shortName(target)} is down and can't answer.` };
    return classify(command.text, [target]);
  }

  // Ordinary text: an inline crew name wins, then the selection, then the
  // squad. Hostiles are never reached this way — see the file header.
  const inline = named(trimmed, ableFriendlies(ctx));
  if (inline) return classify(trimmed, [inline]);
  const selected = selectedFriendly(ctx);
  if (selected) return classify(trimmed, [selected]);
  const squad = ableFriendlies(ctx);
  if (squad.length === 0) return { kind: "refused", reason: "Nobody on your side is up to answer." };
  return classify(trimmed, squad);
}
