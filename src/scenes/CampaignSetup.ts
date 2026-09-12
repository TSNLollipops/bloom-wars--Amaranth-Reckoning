// src/scenes/CampaignSetup.ts
// Main Menu / Save / Ironman UI Plan v1 §4, 28 Aug 2026 — the New Campaign
// screen, and the actual location the Ironman decision was given three days
// earlier (Bloom_Wars_Spitball_Ideas.md, 25 Aug 2026): "Ironman is a
// checkbox on the New Game/campaign-creation screen itself, presented once,
// locked in for that campaign — not something flipped later from a settings
// menu, not changeable mid-run." This screen just gives that decision an
// actual place to live.
import Phaser from "phaser";
import {
  createWardenCampaignState,
  createHouseAmaranthCampaignState,
  saveCampaignState,
  DEFAULT_WARDEN_COMPANY_NAME,
  DEFAULT_HOUSE_AMARANTH_COMPANY_NAME,
  COMPANY_NAME_MAX_LENGTH,
} from "../engine/campaignState";
import { makeShopButton } from "./shop/ShopPanel";
import { AMARANTH_ACT1 } from "../data/campaignAmaranth";
import { HOUSE_AMARANTH_ACT1 } from "../data/campaignHouseAmaranth";
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";

type Side = "warden" | "house_amaranth";

export class CampaignSetup extends Phaser.Scene {
  private ironmanChecked = true; // checked by default — Ironman is the base experience, not an opt-in extra (§4)
  private checkboxBg!: Phaser.GameObjects.Rectangle;
  private checkboxMark!: Phaser.GameObjects.Text;
  // Side select, made real 1 Sep 2026 (Mission Select wiring pass) — was a
  // pre-selected, non-interactive slot ("House Amaranth's side isn't built
  // yet") until House Amaranth actually had missions to launch into.
  private selectedSide: Side = "warden";
  private wardenBg!: Phaser.GameObjects.Rectangle;
  private houseAmaranthBg!: Phaser.GameObjects.Rectangle;
  // B6, "name your company" (5 Sep 2026). The DOM input follows Hub.ts's own
  // chat-box idiom (buildChatBox) — this.add.dom with an inline style string,
  // which main.ts's `dom: { createContainer: true }` exists to allow. No
  // addCapture/removeCapture dance is needed here the way Hub needs one:
  // this scene registers no keyboard input at all, so there's nothing for a
  // keystroke to leak into. The keydown listener still stops propagation
  // anyway, matching Hub's pattern rather than relying on that staying true.
  private companyInput!: Phaser.GameObjects.DOMElement;
  // Whether the player has actually typed their own name. While false, the
  // field tracks whichever side is selected, so clicking HOUSE AMARANTH
  // doesn't leave "Warden Company" sitting in the box; the moment they edit
  // it, side changes stop overwriting what they wrote.
  private companyNameEdited = false;
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // This scene had no HoverTip before — a plain scene class, same as
  // Options.ts/ShopPanel.ts, so one shared instance covers everything.
  private hoverTip!: HoverTip;

  constructor() {
    super("CampaignSetup");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    this.ironmanChecked = true;
    this.hoverTip = new HoverTip(this);

    this.add.text(480, 50, "NEW CAMPAIGN", { fontFamily: "monospace", fontSize: "26px", color: "#e8e2d4" }).setOrigin(0.5);

    this.companyNameEdited = false;
    this.drawSideSelect();
    this.drawCompanyNameField();
    this.drawIronmanCheckbox();
    this.drawBeginButton();

    makeShopButton(
      this,
      this.add.container(0, 0),
      100,
      604,
      160,
      30,
      "BACK",
      true,
      () => {
        this.scene.start("MainMenu");
      },
      ["Back", "", ...wrapTipText("Returns to the main menu. Nothing on this screen is saved until you press BEGIN CAMPAIGN.", 42)],
      this.hoverTip
    );
  }

  // Side select (§5): "Warden Company" vs. "House Amaranth," made real 1
  // Sep 2026 — House Amaranth's own 36 missions are built and (as of this
  // pass) reachable, so the slot this screen always reserved for a second
  // side (per §4's own note, "cheap to leave now rather than retrofit
  // later") is finally live. Two side-by-side toggle buttons rather than a
  // dropdown — same "few big obvious choices" visual language the Ironman
  // checkbox right below already uses on this screen.
  private drawSideSelect() {
    this.add.text(480, 110, "SIDE", { fontFamily: "monospace", fontSize: "12px", color: "#6b7a8a" }).setOrigin(0.5);

    this.wardenBg = this.add
      .rectangle(330, 140, 280, 40, 0x2e5c7a, 1)
      .setStrokeStyle(1, 0x4a7a9a)
      .setInteractive({ useHandCursor: true });
    this.add.text(330, 140, "WARDEN COMPANY", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);

    this.houseAmaranthBg = this.add
      .rectangle(630, 140, 280, 40, 0x1a2028, 1)
      .setStrokeStyle(1, 0x4a7a9a)
      .setInteractive({ useHandCursor: true });
    this.add.text(630, 140, "HOUSE AMARANTH", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);

    this.wardenBg.on("pointerdown", () => this.setSide("warden"));
    this.houseAmaranthBg.on("pointerdown", () => this.setSide("house_amaranth"));
    const wardenTip = ["Warden Company", "", ...wrapTipText("The default side — a full Hub to walk around in between missions, plus the Shop, Roster, and everything else.", 42)];
    const houseTip = [
      "House Amaranth",
      "",
      ...wrapTipText("Missions and roster only — no Hub screen to walk around in yet. Shop, gear, and recruiting all still work the same.", 42),
    ];
    this.wardenBg
      .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(wardenTip, pointer.x, pointer.y))
      .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(wardenTip, pointer.x, pointer.y))
      .on("pointerout", () => this.hoverTip.hide());
    this.houseAmaranthBg
      .on("pointerover", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(houseTip, pointer.x, pointer.y))
      .on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(houseTip, pointer.x, pointer.y))
      .on("pointerout", () => this.hoverTip.hide());

    // y=178, not 168 (Claude, 5 Sep 2026 — pre-existing, found by screenshot
    // during the B6 pass, not caused by it). This string is 94 characters,
    // which at 10px monospace is just past the 560px wrap width, so it has
    // always rendered as TWO lines: 26px tall, centered at 168, spanning
    // 155-181 — while the side buttons above end at 160. It has been
    // overlapping them by ~5px the whole time. Nudged clear rather than
    // rewrapped, since the wrap itself reads fine.
    this.add
      .text(480, 178, "House Amaranth has no Hub of its own to walk around in yet — missions and roster only for now.", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#5a6472",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5);
  }

  private setSide(side: Side) {
    this.selectedSide = side;
    this.wardenBg.setFillStyle(side === "warden" ? 0x2e5c7a : 0x1a2028);
    this.houseAmaranthBg.setFillStyle(side === "house_amaranth" ? 0x2e5c7a : 0x1a2028);
    // Untouched field follows the side; an edited one is left alone — see
    // companyNameEdited's own comment.
    if (!this.companyNameEdited && this.companyInput) {
      (this.companyInput.node as HTMLInputElement).value = this.defaultNameForSide();
    }
  }

  private defaultNameForSide(): string {
    return this.selectedSide === "house_amaranth" ? DEFAULT_HOUSE_AMARANTH_COMPANY_NAME : DEFAULT_WARDEN_COMPANY_NAME;
  }

  /**
   * B6 (First Game Dev Feature Gap Report §B6, "Players name things they
   * intend to lose"), built 5 Sep 2026. One text field, pre-filled with the
   * side's real default so a player who doesn't care can ignore it entirely
   * and get exactly today's behavior — the name is never a required step.
   */
  private drawCompanyNameField() {
    this.add.text(480, 206, "COMPANY NAME", { fontFamily: "monospace", fontSize: "12px", color: "#6b7a8a" }).setOrigin(0.5);

    this.companyInput = this.add
      .dom(
        480,
        236,
        "input",
        "width: 300px; padding: 7px 9px; font-family: monospace; font-size: 14px; text-align: center; " +
          "background: #1a2028; color: #e8e2d4; border: 1px solid #4a7a9a; outline: none;"
      )
      .setOrigin(0.5);

    const node = this.companyInput.node as HTMLInputElement;
    node.value = this.defaultNameForSide();
    node.maxLength = COMPANY_NAME_MAX_LENGTH;
    node.addEventListener("input", () => {
      this.companyNameEdited = true;
    });
    node.addEventListener("keydown", (e: KeyboardEvent) => {
      // Enter shouldn't submit anything here (there's no form, and BEGIN
      // CAMPAIGN is a deliberate second click, not something a stray Enter
      // in a name box should trigger). stopPropagation matches Hub.ts's own
      // chat-input handling — see companyInput's field comment.
      if (e.key === "Enter") e.preventDefault();
      e.stopPropagation();
    });

    this.add
      .text(480, 266, `Whatever you call them is what the roster, the pad, and the record will call them. ${COMPANY_NAME_MAX_LENGTH} characters.`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#5a6472",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5);
  }

  /** The typed name, trimmed — or the side's default if the player blanked the box, so a campaign can never start nameless. */
  private resolveCompanyName(): string {
    const typed = (this.companyInput?.node as HTMLInputElement | undefined)?.value ?? "";
    const trimmed = typed.trim();
    return trimmed.length > 0 ? trimmed : this.defaultNameForSide();
  }

  private drawIronmanCheckbox() {
    // Moved down from 260 to 320 (5 Sep 2026) to clear B6's company-name
    // field above it — drawCompanyNameField's help text ends around y=272.
    const y = 320;
    this.checkboxBg = this.add.rectangle(370, y, 26, 26, 0x1a2028, 1).setStrokeStyle(1, 0x4a7a9a).setInteractive({ useHandCursor: true });
    this.checkboxMark = this.add.text(370, y, "X", { fontFamily: "monospace", fontSize: "16px", color: "#facc15" }).setOrigin(0.5);
    this.add.text(392, y, "IRONMAN", { fontFamily: "monospace", fontSize: "15px", color: "#e8e2d4" }).setOrigin(0, 0.5);

    this.checkboxBg.on("pointerdown", () => {
      this.ironmanChecked = !this.ironmanChecked;
      this.checkboxMark.setVisible(this.ironmanChecked);
    });

    this.add
      .text(370, y + 34, "One save, no going back. A pilot lost stays lost, same as always — but so does everything that leads there: no manual saves, no rewinding a bad call. Uncheck this to keep save slots you can return to.", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8a97a6",
        wordWrap: { width: 560 },
      })
      .setOrigin(0, 0);
  }

  private drawBeginButton() {
    // Routing fix, 28 Aug 2026 (Maxime: "as you start a new campaign you go
    // into the 1st mission"). Used to land on MapSelect's flat mission list
    // — harmless for an engine-test pass with nothing to pick between yet,
    // but wrong for a real campaign start: a fresh Warden roster has
    // exactly one mission actually available (nothing else is unlocked in
    // any real sense — MapSelect just doesn't enforce order), so the list
    // was a needless extra click in front of a foregone choice. Straight to
    // TransporterPad for Act I's own opening mission instead — still gets
    // the real squad-review/BEAM DOWN screen, same as picking it manually
    // would have, just without the pointless intermediate list.
    //
    // AMARANTH_ACT1[0].id / HOUSE_AMARANTH_ACT1[0].id rather than a second
    // "mission_amaranth_1"/"mission_house_amaranth_1" string literal —
    // derived from the same arrays MapSelect itself renders, so this can
    // never silently drift from whatever each side's actual opening
    // mission is if either array's order ever changes.
    makeShopButton(
      this,
      this.add.container(0, 0),
      480,
      540,
      320,
      48,
      "BEGIN CAMPAIGN",
      true,
      () => {
        const state = this.selectedSide === "house_amaranth" ? createHouseAmaranthCampaignState() : createWardenCampaignState();
        state.ironman = this.ironmanChecked;
        state.companyName = this.resolveCompanyName(); // B6 — same "overwrite the factory default before the first save" shape as ironman right above
        saveCampaignState(state);
        const missionId = this.selectedSide === "house_amaranth" ? HOUSE_AMARANTH_ACT1[0].id : AMARANTH_ACT1[0].id;
        this.scene.start("TransporterPad", { missionId });
      },
      [
        "Begin Campaign",
        "",
        ...wrapTipText(
          "Creates the new campaign with the side, Ironman setting, and company name set above (blank name falls back to the side's default), and launches straight into its opening mission.",
          42
        ),
      ],
      this.hoverTip
    );
  }
}
