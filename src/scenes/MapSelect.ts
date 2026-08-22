// src/scenes/MapSelect.ts
// Not in the Build Brief's named scene list (Boot, Battle, Debrief) but a
// cheap, honest stand-in for "pick which mission to test" — there's no
// campaign/shop layer wired up yet (Build Brief steps 11-12), so this is
// how you reach any mission without playing the one before it to
// completion first. Now spans two independent campaigns (data/allCampaigns.ts)
// behind a simple tab switcher: the original Team One engine-test slice,
// and Amaranth Act I's first four missions.
import Phaser from "phaser";
import { CAMPAIGNS } from "../data/allCampaigns";

export class MapSelect extends Phaser.Scene {
  private missionListLayer!: Phaser.GameObjects.Container;
  private tabButtons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; campaignId: string }[] = [];
  private activeCampaignIndex = 1; // default to the Amaranth Act I slice

  constructor() {
    super("MapSelect");
  }

  create() {
    this.activeCampaignIndex = Math.min(this.activeCampaignIndex, CAMPAIGNS.length - 1);
    this.cameras.main.setBackgroundColor("#0c0f12");
    this.add.text(480, 44, "THE BLOOM WARS", { fontFamily: "monospace", fontSize: "30px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 76, "engine test pass — pick a campaign, then a mission", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);

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

    this.missionListLayer = this.add.container(0, 0);
    this.renderMissionList();
  }

  private selectCampaign(index: number) {
    if (index === this.activeCampaignIndex) return;
    this.activeCampaignIndex = index;
    this.tabButtons.forEach((t, i) => t.bg.setFillStyle(i === index ? 0x2e5c7a : 0x1a2028, 1));
    this.renderMissionList();
  }

  private renderMissionList() {
    this.missionListLayer.removeAll(true);
    const campaign = CAMPAIGNS[this.activeCampaignIndex];

    const subtitle = this.add
      .text(480, 156, campaign.subtitle, { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a", align: "center", wordWrap: { width: 820 } })
      .setOrigin(0.5, 0);
    this.missionListLayer.add(subtitle);

    campaign.missions.forEach((mission, i) => {
      const y = 210 + i * 92;
      const card = this.add.rectangle(480, y, 860, 74, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552).setInteractive({ useHandCursor: true });
      const title = this.add.text(140, y - 20, mission.displayName, { fontFamily: "monospace", fontSize: "17px", color: "#e8e2d4" });
      const brief = this.add.text(140, y + 6, mission.briefing, { fontFamily: "monospace", fontSize: "10px", color: "#8a97a6", wordWrap: { width: 700 } });
      card.on("pointerover", () => card.setFillStyle(0x232b35, 1));
      card.on("pointerout", () => card.setFillStyle(0x1a2028, 1));
      card.on("pointerdown", () => this.scene.start("Battle", { missionId: mission.id }));
      this.missionListLayer.add([card, title, brief]);
    });
  }
}
