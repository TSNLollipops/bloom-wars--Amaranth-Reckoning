// src/scenes/MapSelect.ts
// Not in the Build Brief's named scene list (Boot, Battle, Debrief) but a
// cheap, honest stand-in for "pick which mission to test" — there's no
// campaign/shop layer wired up yet (Build Brief steps 11-12), so this is
// how you reach any mission without playing the one before it to
// completion first. Backed by data/allCampaigns.ts's CAMPAIGNS array; the
// tab switcher below only renders when that array has more than one entry,
// so archiving a campaign out of CAMPAIGNS (Team One, currently) collapses
// this straight to a single mission list with no dead switcher UI, and the
// switcher comes back on its own if a second campaign is ever un-archived.
import Phaser from "phaser";
import { CAMPAIGNS } from "../data/allCampaigns";

export class MapSelect extends Phaser.Scene {
  private missionListLayer!: Phaser.GameObjects.Container;
  private tabButtons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; campaignId: string }[] = [];
  private activeCampaignIndex = 0;

  constructor() {
    super("MapSelect");
  }

  create() {
    this.activeCampaignIndex = Math.min(this.activeCampaignIndex, CAMPAIGNS.length - 1);
    this.cameras.main.setBackgroundColor("#0c0f12");
    this.add.text(480, 44, "THE BLOOM WARS", { fontFamily: "monospace", fontSize: "30px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 76, "engine test pass — pick a mission", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);

    // Same accumulation bug as Battle.ts's actionSlots (fixed 23 Aug 2026,
    // see that file's comment for the full mechanism): create() re-runs
    // every time this scene restarts, and Phaser destroys the previous
    // run's GameObjects on the way out but never touches this array on its
    // own — without the reset, a second visit would push more entries onto
    // stale, destroyed tab buttons instead of replacing them. Currently
    // dormant (CAMPAIGNS.length is 1, so showTabs is false and the forEach
    // below never runs), but it's the identical landmine and this is the
    // one place it can be defused before a second campaign ever un-archives
    // and makes the tab row live.
    this.tabButtons = [];
    const showTabs = CAMPAIGNS.length > 1;
    if (showTabs) {
      const tabWidth = 900 / CAMPAIGNS.length;
      CAMPAIGNS.forEach((campaign, i) => {
        const x = 30 + tabWidth * i + tabWidth / 2;
        const bg = this.add
          .rectangle(x, 116, tabWidth - 12, 40, i === this.activeCampaignIndex ? 0x2e5c7a : 0x1a2028, 1)
          .setStrokeStyle(1, 0x3a4552)
          .setInteractive({ useHandCursor: true });
        const label = this.add
          .text(x, 116, campaign.name, { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4", align: "center", wordWrap: { width: tabWidth - 24 } })
          .setOrigin(0.5);
        bg.on("pointerdown", () => this.selectCampaign(i));
        bg.on("pointerover", () => {
          if (i !== this.activeCampaignIndex) bg.setFillStyle(0x232b35, 1);
        });
        bg.on("pointerout", () => {
          if (i !== this.activeCampaignIndex) bg.setFillStyle(0x1a2028, 1);
        });
        this.tabButtons.push({ bg, label, campaignId: campaign.id });
      });
    }

    this.missionListLayer = this.add.container(0, 0);
    this.renderMissionList(showTabs ? 156 : 100);
  }

  private selectCampaign(index: number) {
    if (index === this.activeCampaignIndex) return;
    this.activeCampaignIndex = index;
    this.tabButtons.forEach((t, i) => t.bg.setFillStyle(i === index ? 0x2e5c7a : 0x1a2028, 1));
    this.renderMissionList(156); // only reachable when showTabs was true
  }

  // subtitleY: 156 under the tab row, or 100 right under the header when
  // there's only one campaign and the tabs are skipped entirely.
  private renderMissionList(subtitleY: number) {
    this.missionListLayer.removeAll(true);
    const campaign = CAMPAIGNS[this.activeCampaignIndex];

    const subtitle = this.add
      .text(480, subtitleY, campaign.subtitle, { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a", align: "center", wordWrap: { width: 820 } })
      .setOrigin(0.5, 0);
    this.missionListLayer.add(subtitle);

    const listTop = subtitleY + 54;
    campaign.missions.forEach((mission, i) => {
      const y = listTop + i * 92;
      const card = this.add.rectangle(480, y, 860, 74, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552).setInteractive({ useHandCursor: true });
      const title = this.add.text(140, y - 20, mission.displayName, { fontFamily: "monospace", fontSize: "17px", color: "#e8e2d4" });
      const brief = this.add.text(140, y + 6, mission.briefing, { fontFamily: "monospace", fontSize: "10px", color: "#8a97a6", wordWrap: { width: 700 } });
      card.on("pointerover", () => card.setFillStyle(0x232b35, 1));
      card.on("pointerout", () => card.setFillStyle(0x1a2028, 1));
      card.on("pointerdown", () => this.scene.start("TransporterPad", { missionId: mission.id }));
      this.missionListLayer.add([card, title, brief]);
    });
  }
}
