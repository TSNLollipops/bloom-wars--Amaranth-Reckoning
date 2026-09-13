// src/scenes/shop/CharacterCreatorOverlay.ts
// New, 9 Sep 2026. Maxime, same message that asked for randomized recruit
// chassis: "maybe even finally code in the damn creator thats been giving
// me nightmare since I started building the social work of the hub. a
// true character creator that act as the toggle for all the new npc
// player receive. you are free to code it all in."
//
// Scope, deliberately bounded rather than building everything
// `claude/Bloom_Wars_Character_Editor_v1.md` (25 Aug 2026, design-only)
// ever floated: that doc's Layer 2 (an animal-label personality picker
// feeding the still-unbuilt Reaction Engine) and its §6 JSON/runtime-data
// migration (for a from-scratch 50-pilot creation mode) are both real,
// separate, bigger asks nobody has greenlit — nothing here touches either.
// What Maxime actually described is narrower and already has a real,
// live target: every place engine/campaignState.ts's generatePilot already
// mints a brand-new recruit (checkMuntiGuarantee, recruitDiscretionary,
// recruitIntoLance's generated-fallback branch, generateRandomRescuedPilot)
// now rolls a random chassis/species too (that file's own 9 Sep 2026
// header has the "why" — it used to silently always be human), and THIS
// overlay is the "toggle" — a small modal the player sees right after one
// of those fires, showing the rolled name and species with a reroll on
// each, before the recruit is walked away with. Same visual/DOM idiom as
// ShopPanel.ts's own showSaveAsOverlay (backdrop + centered panel, pinned
// to screen) and CampaignSetup.ts's own DOM name field — no new UI
// language invented for this.
//
// Deliberately NOT wired to the "chosen authored candidate" branch of
// ShopPanel.ts's recruitIntoLance button (a real, named, hand-authored
// bench pilot like Trahsin Hyrs) — only ever call this against a pilotId
// that generatePilot actually minted this turn. Re-chassising a named
// pilot would silently rewrite their canon species, which is exactly the
// kind of drift this project's own "verify against the real file" rule
// exists to prevent, not something this overlay should ever be able to do
// by construction.
import Phaser from "phaser";
import {
  rechassisPilot,
  renamePilot,
  setPilotGender,
  ALL_CHASSIS_SUFFIXES,
  type ArchetypeChassisSuffix,
  type CampaignState,
} from "../../engine/campaignState";
import { UNIT_ARCHETYPES } from "../../data/units";
import { ABILITIES } from "../../data/abilities";
import { generateRecruitName } from "../../data/names";
import { ALL_GENDERS, GENDER_LABELS, genderOf, type Gender } from "../../data/gender";
import { makeShopButton } from "./ShopPanel";
import { HoverTip } from "../ui/HoverTip";
import { wrapTipText } from "../../engine/hoverTipLayout";

/** The three species labels a player actually reads, in the same order as ALL_CHASSIS_SUFFIXES. Kept local — this is UI copy, not a third copy of the chassis-to-species mapping (that mapping lives once, in data/units.ts's own UNIT_ARCHETYPES entries). */
const CHASSIS_LABELS: Record<ArchetypeChassisSuffix, string> = {
  bipedal: "HUMAN",
  centauroid: "HIOPI",
  vibrissal: "OSNIAN",
};

/** Reads a pilot's current chassis suffix straight off their archetypeId — the same three suffixes ALL_CHASSIS_SUFFIXES lists, so this never needs its own separate source of truth. Falls back to "bipedal" only if archetypeId is somehow malformed (shouldn't happen; generatePilot always builds it as arch_<class>_<suffix>). */
function chassisSuffixOf(archetypeId: string): ArchetypeChassisSuffix {
  return ALL_CHASSIS_SUFFIXES.find((suffix) => archetypeId.endsWith(`_${suffix}`)) ?? "bipedal";
}

// Tooltip pass, 12 Sep 2026 (standing rule — see
// claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
// Species choice here is NOT cosmetic — rechassisPilot rebuilds
// archetypeId as arch_<same class>_<new chassis>, and data/units.ts's own
// arch_*_bipedal / _centauroid / _vibrissal entries carry genuinely
// different baseHp, vision, and (on two of the three chassis) a bonus
// class ability. A generic "just changes species" tooltip would be wrong,
// so this looks up the pilot's real class+chassis combo and states its
// actual numbers, same discipline as everywhere else in this pass.
function chassisTooltipLines(pathId: string | undefined, suffix: ArchetypeChassisSuffix): string[] {
  const title = CHASSIS_LABELS[suffix];
  const arch = pathId ? UNIT_ARCHETYPES[`arch_${pathId}_${suffix}`] : undefined;
  if (!arch) {
    // Shouldn't happen — every class this creator can show already has all
    // three chassis defined — but never let a missing lookup crash the
    // picker over a cosmetic tooltip.
    return [title, "", ...wrapTipText("Switches this recruit to this species.", 42)];
  }
  const abilityNames = arch.abilities.map((id) => ABILITIES[id]?.displayName ?? id).join(", ");
  const body = `${arch.baseHp} HP, vision ${arch.vision}. Abilities: ${abilityNames}.`;
  return [title, "", ...wrapTipText(body, 42)];
}

/**
 * Pops the Character Creator over whatever scene called it, pointed at one
 * already-generated pilot (`pilotId` must already exist in
 * `state.pilots` — every real call site generates first, then opens this
 * to let the player review/reroll the result, same order checkMuntiGuarantee
 * etc. already run in). Lets the player: retype or reroll the name, and
 * change species by picking a different chassis (applies immediately per
 * click, live — there is no separate "cancel," since the recruit already
 * exists on the roster either way; CONFIRM just finalizes the name and
 * closes). `onDone` fires once, after the overlay closes — Debrief.ts uses
 * it to chain a second overlay when both a Munti guarantee and a rescue
 * recruit fire in the same debrief.
 */
export function showCharacterCreatorOverlay(scene: Phaser.Scene, state: CampaignState, pilotId: string, onDone?: () => void): void {
  const entry = state.pilots[pilotId];
  if (!entry) {
    // Shouldn't happen — every real caller just generated this pilot this
    // same tick — but never leave the caller's onDone chain stuck waiting
    // on a modal that can't open.
    onDone?.();
    return;
  }

  const layer = scene.add.container(0, 0).setDepth(30).setScrollFactor(0);
  // One shared instance for this overlay's whole lifetime — CONFIRM is the
  // single choke point everything else already destroys through, so it's
  // also the one place this gets torn down.
  const hoverTip = new HoverTip(scene);
  const backdrop = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0.8).setInteractive().setScrollFactor(0);
  // Panel is 350 tall centred at y=275 (was 360 at y=320) — it grew by one
  // row and moved up when the GENDER row landed, 13 Sep 2026, and every y
  // below shifted with it. Margins checked against a real render, not
  // guessed: ~24px above the title, ~25px below CONFIRM. Still one screen,
  // no scrolling: the row order is GENDER, NAME, SPECIES, CONFIRM.
  const panel = scene.add.rectangle(480, 275, 560, 350, 0x141a20, 1).setStrokeStyle(1, 0x3a4552).setScrollFactor(0);
  const title = scene.add.text(480, 133, "NEW RECRUIT", { fontFamily: "monospace", fontSize: "18px", color: "#facc15" }).setOrigin(0.5).setScrollFactor(0);
  layer.add([backdrop, panel, title]);

  const currentArchetype = UNIT_ARCHETYPES[entry.pilot.archetypeId];
  const classLabel = currentArchetype ? currentArchetype.path[0].toUpperCase() + currentArchetype.path.slice(1) : "";
  const classLine = scene.add
    .text(480, 159, `${classLabel} pilot, G-tier`, { fontFamily: "monospace", fontSize: "12px", color: "#8a97a6" })
    .setOrigin(0.5)
    .setScrollFactor(0);
  const mek = state.meks[entry.pilot.mekId];
  const mekLine = scene.add
    .text(480, 179, mek ? `with their Mek, ${mek.displayName}` : "", { fontFamily: "monospace", fontSize: "11px", color: "#5a6472" })
    .setOrigin(0.5)
    .setScrollFactor(0);
  layer.add([classLine, mekLine]);

  // ---- GENDER, deliberately drawn above NAME -------------------------
  // Maxime, 13 Sep 2026: "The gender is chosen before name. So it match."
  // The ordering is the feature, not decoration — picking a gender rerolls
  // the name below it out of the matching pool, so the two never disagree.
  const genderLabel = scene.add.text(480, 207, "GENDER", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0.5).setScrollFactor(0);
  layer.add(genderLabel);
  const genderRow = scene.add.container(0, 0).setScrollFactor(0);
  layer.add(genderRow);
  let currentGender: Gender = genderOf(entry.pilot);

  const nameLabel = scene.add.text(420, 265, "NAME", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0.5).setScrollFactor(0);
  layer.add(nameLabel);

  const nameInput = scene.add
    .dom(
      420,
      291,
      "input",
      "width: 260px; padding: 6px 8px; font-family: monospace; font-size: 13px; text-align: center; " +
        "background: #1a2028; color: #e8e2d4; border: 1px solid #4a7a9a; outline: none;",
    )
    .setOrigin(0.5)
    .setScrollFactor(0);
  const nameNode = nameInput.node as HTMLInputElement;
  nameNode.value = entry.pilot.displayName;
  nameNode.maxLength = 40;
  // Whether the player has typed in this field themselves. Picking a
  // gender rerolls the name to match — but only while the name is still
  // one the game rolled. The moment someone types their own, that name is
  // theirs and a later gender click must not silently delete it. Pressing
  // REROLL hands the field back to the game and clears this again.
  let nameTouched = false;
  nameNode.addEventListener("input", () => {
    nameTouched = true;
  });
  nameNode.addEventListener("keydown", (e: KeyboardEvent) => {
    // Same reasoning as CampaignSetup.ts's own companyInput: no form to
    // submit, and this scene's own keyboard input (if any) shouldn't see
    // a stray keystroke leak out of this field.
    if (e.key === "Enter") e.preventDefault();
    e.stopPropagation();
  });
  // Deliberately NOT layer.add(nameInput) — a DOM Element sits in Phaser's
  // own separate DOM layer (an actual HTML overlay div, not the WebGL/
  // Canvas display list a Container manages), so it doesn't behave as a
  // normal Container child. CampaignSetup.ts's own companyInput follows
  // the same rule: added straight to the scene via scene.add.dom, never
  // into a container. destroyed by hand alongside `layer` in CONFIRM's
  // handler below since layer.destroy() has no idea it exists.
  nameInput.setDepth(31);

  makeShopButton(
    scene,
    layer,
    610,
    291,
    110,
    30,
    "REROLL",
    true,
    () => {
      nameNode.value = generateRecruitName(currentGender);
      nameTouched = false;
    },
    ["Reroll", "", ...wrapTipText("Randomizes this recruit's name, from the pool matching their gender. Doesn't touch species or Mek.", 42)],
    hoverTip
  );

  // Drawn here, after nameNode exists, because a gender click has to be
  // able to reroll the name field. Declared above the NAME row so the
  // reading order on screen is still gender first.
  function redrawGenderRow() {
    genderRow.removeAll(true);
    const btnW = 150;
    const gap = 10;
    const startCx = 480 - (btnW + gap) / 2; // two buttons, centered as a pair
    ALL_GENDERS.forEach((gender, i) => {
      const cx = startCx + i * (btnW + gap);
      const selected = gender === currentGender;
      const bg = scene.add
        .rectangle(cx, 233, btnW, 30, selected ? 0x2e5c7a : 0x1a2028, 1)
        .setStrokeStyle(1, selected ? 0xfacc15 : 0x3a4552)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      const txt = scene.add
        .text(cx, 233, GENDER_LABELS[gender], { fontFamily: "monospace", fontSize: "11px", color: selected ? "#ffffff" : "#8a97a6" })
        .setOrigin(0.5)
        .setScrollFactor(0);
      const tip = [
        GENDER_LABELS[gender],
        "",
        ...wrapTipText(
          "Sets this recruit's gender, which is what the crew's own lines use when they talk about them. Rerolls the name below to match, unless you've typed one yourself.",
          42,
        ),
      ];
      bg.on("pointerover", (pointer: Phaser.Input.Pointer) => hoverTip.show(tip, pointer.x, pointer.y))
        .on("pointermove", (pointer: Phaser.Input.Pointer) => hoverTip.show(tip, pointer.x, pointer.y))
        .on("pointerout", () => hoverTip.hide());
      bg.on("pointerdown", () => {
        if (gender === currentGender) return;
        const result = setPilotGender(state, pilotId, gender);
        if (!result.ok) return;
        currentGender = gender;
        // The whole point of the row order: a name the game rolled follows
        // the gender. A name the player typed does not.
        if (!nameTouched) nameNode.value = generateRecruitName(gender);
        redrawGenderRow();
      });
      genderRow.add([bg, txt]);
    });
  }
  redrawGenderRow();

  const speciesLabel = scene.add.text(480, 327, "SPECIES", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0.5).setScrollFactor(0);
  layer.add(speciesLabel);

  const speciesRow = scene.add.container(0, 0).setScrollFactor(0);
  layer.add(speciesRow);
  let currentChassis: ArchetypeChassisSuffix = chassisSuffixOf(entry.pilot.archetypeId);

  function redrawSpeciesRow() {
    speciesRow.removeAll(true);
    const btnW = 150;
    const gap = 10;
    const startCx = 480 - btnW - gap; // first of three, centered as a group of three
    ALL_CHASSIS_SUFFIXES.forEach((suffix, i) => {
      const cx = startCx + i * (btnW + gap);
      const selected = suffix === currentChassis;
      const bg = scene.add
        .rectangle(cx, 353, btnW, 30, selected ? 0x2e5c7a : 0x1a2028, 1)
        .setStrokeStyle(1, selected ? 0xfacc15 : 0x3a4552)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      const txt = scene.add
        .text(cx, 353, CHASSIS_LABELS[suffix], { fontFamily: "monospace", fontSize: "11px", color: selected ? "#ffffff" : "#8a97a6" })
        .setOrigin(0.5)
        .setScrollFactor(0);
      const chassisTip = chassisTooltipLines(currentArchetype?.path, suffix);
      bg.on("pointerover", (pointer: Phaser.Input.Pointer) => hoverTip.show(chassisTip, pointer.x, pointer.y))
        .on("pointermove", (pointer: Phaser.Input.Pointer) => hoverTip.show(chassisTip, pointer.x, pointer.y))
        .on("pointerout", () => hoverTip.hide());
      bg.on("pointerdown", () => {
        if (suffix === currentChassis) return;
        const result = rechassisPilot(state, pilotId, suffix);
        if (result.ok) {
          currentChassis = suffix;
          redrawSpeciesRow();
        }
      });
      speciesRow.add([bg, txt]);
    });
  }
  redrawSpeciesRow();

  makeShopButton(
    scene,
    layer,
    480,
    407,
    220,
    36,
    "CONFIRM",
    true,
    () => {
      renamePilot(state, pilotId, nameNode.value);
      layer.destroy();
      nameInput.destroy();
      hoverTip.destroy();
      onDone?.();
    },
    ["Confirm", "", ...wrapTipText("Locks in this name and species, and adds the recruit to the roster as shown.", 42)],
    hoverTip
  );
}
