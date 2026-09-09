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
  ALL_CHASSIS_SUFFIXES,
  type ArchetypeChassisSuffix,
  type CampaignState,
} from "../../engine/campaignState";
import { UNIT_ARCHETYPES } from "../../data/units";
import { generateRecruitName } from "../../data/names";
import { makeShopButton } from "./ShopPanel";

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
  const backdrop = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0.8).setInteractive().setScrollFactor(0);
  const panel = scene.add.rectangle(480, 320, 560, 360, 0x141a20, 1).setStrokeStyle(1, 0x3a4552).setScrollFactor(0);
  const title = scene.add.text(480, 172, "NEW RECRUIT", { fontFamily: "monospace", fontSize: "18px", color: "#facc15" }).setOrigin(0.5).setScrollFactor(0);
  layer.add([backdrop, panel, title]);

  const currentArchetype = UNIT_ARCHETYPES[entry.pilot.archetypeId];
  const classLabel = currentArchetype ? currentArchetype.path[0].toUpperCase() + currentArchetype.path.slice(1) : "";
  const classLine = scene.add
    .text(480, 198, `${classLabel} pilot, G-tier`, { fontFamily: "monospace", fontSize: "12px", color: "#8a97a6" })
    .setOrigin(0.5)
    .setScrollFactor(0);
  const mek = state.meks[entry.pilot.mekId];
  const mekLine = scene.add
    .text(480, 218, mek ? `with their Mek, ${mek.displayName}` : "", { fontFamily: "monospace", fontSize: "11px", color: "#5a6472" })
    .setOrigin(0.5)
    .setScrollFactor(0);
  layer.add([classLine, mekLine]);

  const nameLabel = scene.add.text(420, 244, "NAME", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0.5).setScrollFactor(0);
  layer.add(nameLabel);

  const nameInput = scene.add
    .dom(
      420,
      270,
      "input",
      "width: 260px; padding: 6px 8px; font-family: monospace; font-size: 13px; text-align: center; " +
        "background: #1a2028; color: #e8e2d4; border: 1px solid #4a7a9a; outline: none;",
    )
    .setOrigin(0.5)
    .setScrollFactor(0);
  const nameNode = nameInput.node as HTMLInputElement;
  nameNode.value = entry.pilot.displayName;
  nameNode.maxLength = 40;
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

  makeShopButton(scene, layer, 610, 270, 110, 30, "REROLL", true, () => {
    nameNode.value = generateRecruitName();
  });

  const speciesLabel = scene.add.text(480, 306, "SPECIES", { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }).setOrigin(0.5).setScrollFactor(0);
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
        .rectangle(cx, 332, btnW, 30, selected ? 0x2e5c7a : 0x1a2028, 1)
        .setStrokeStyle(1, selected ? 0xfacc15 : 0x3a4552)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      const txt = scene.add
        .text(cx, 332, CHASSIS_LABELS[suffix], { fontFamily: "monospace", fontSize: "11px", color: selected ? "#ffffff" : "#8a97a6" })
        .setOrigin(0.5)
        .setScrollFactor(0);
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

  makeShopButton(scene, layer, 480, 384, 220, 36, "CONFIRM", true, () => {
    renamePilot(state, pilotId, nameNode.value);
    layer.destroy();
    nameInput.destroy();
    onDone?.();
  });
}
