import { DialogBuilder } from "../../../utils/dialog-builder";
import { getItem } from "../../item/item-utils";
import type { Player } from "../../player";
import { questDailyDialog } from "../../quests/daily-quest";
import { ringmasterDialog } from "../../quests/ringmaster-quest";
import { legendaryWizardDialog } from "../../quests/legendary-wizard-quest";
import { LockPermission } from "../constants";
import { Tile } from "../tile";
import { registerDialog } from "../../network/dialog-handler";

/**
 * Tile handler for interactive NPCs placed in worlds:
 * - 1900: The Ringmaster (Carnival Quests & Rings)
 * - 3902: Crazy Jim (Daily Quest Deliveries)
 * - 3554 / 15224: Pet Trainer & Pet Battle Gym Trainer
 * - 13546: Tropical Merchant
 */
export class NpcTile extends Tile {
  public override async onPunch(player: Player): Promise<boolean> {
    if (this.data.fg === 0) return true;

    // Check if player is holding pickaxe to intentionally break the NPC
    const isPickaxe = player.inventory.clothes.hand === 98 || player.inventory.clothes.hand === 2754;
    const hasBreakPermission = await this.world.hasTilePermission(player, this.data, LockPermission.BREAK);

    if (isPickaxe && (hasBreakPermission || player.isDeveloper)) {
      return super.onPunch(player);
    }

    // Interacting with the NPC
    return this.interact(player);
  }

  public override async onWrench(player: Player): Promise<boolean> {
    if (this.data.fg === 0) return true;
    return this.interact(player);
  }

  /**
   * Opens the appropriate conversation or quest dialog for this NPC.
   */
  private async interact(player: Player): Promise<boolean> {
    const fg = this.data.fg;

    switch (fg) {
      case 1900: { // The Ringmaster
        player.sendTextBubble("`5[The Ringmaster] Step right up, adventurer! Enter the Big Top!``", false);
        this.world.playPositioned("audio/cackle.wav", player.netID);
        player.variants.sendOnDialogRequest(ringmasterDialog(player, this.data.x, this.data.y));
        return true;
      }

      case 3902: { // Crazy Jim
        player.sendTextBubble("`9[Crazy Jim] Hehehe! Got any junk or treasures for me today?!``", false);
        this.world.playPositioned("audio/change_clothes.wav", player.netID);
        player.variants.sendOnDialogRequest(questDailyDialog(player));
        return true;
      }

      case 3554: // Pet Trainer
      case 15224: { // Pet Battle Gym Trainer
        player.sendTextBubble("`2[Pet Trainer] Train your companions well and unleash their hidden powers!``", false);
        this.world.playPositioned("audio/whistle.wav", player.netID);
        player.variants.sendOnDialogRequest(this.petTrainerDialog(player));
        return true;
      }

      case 13546: { // Tropical Merchant
        player.sendTextBubble("`6[Tropical Merchant] Exotic goods and island blessings for weary travelers!``", false);
        this.world.playPositioned("audio/secret.wav", player.netID);
        player.variants.sendOnDialogRequest(this.merchantDialog(player));
        return true;
      }

      case 1790: { // Legendary Wizard
        player.sendTextBubble("`9[Legendary Wizard] Greetings, seeker of ancient relics and supreme blades!``", false);
        this.world.playPositioned("audio/magic_hit.wav", player.netID);
        player.variants.sendOnDialogRequest(legendaryWizardDialog(player, this.data.x, this.data.y));
        return true;
      }

      default: {
        const item = getItem(fg);
        const name = item?.name ?? "NPC";
        player.sendTextBubble(`\`o[${name}] Greetings, traveler!\`\``, false);
        return true;
      }
    }
  }

  private petTrainerDialog(player: Player): string {
    const item = getItem(this.data.fg);
    const name = item?.name ?? "Pet Trainer";

    const dialog = new DialogBuilder()
      .defaultColor()
      .embed("tileX", this.data.x)
      .embed("tileY", this.data.y)
      .embed("netID", player.netID)
      .addLabelWithIcon(`\`2${name}\`\``, this.data.fg, "big")
      .addSpacer("small")
      .addTextBox("`oWelcome to the Pet Training Grounds!``")
      .addTextBox("`wFeed, care for, and train your faithful companions. As they level up, they will assist you across worlds!``")
      .addSpacer("small")
      .addSmallText("`6Pet Training Tip: \`oKeep your pets well-fed and take them on adventures to earn pet XP!``")
      .addSpacer("small");

    // Developer / Owner removal option
    if (player.isDeveloper) {
      dialog.addButton("npc_remove_tile", "`4[Dev/Owner] Pick Up / Remove NPC``");
    }

    dialog.addQuickExit().endDialog("npc_dialog", "", "Close");
    return dialog.str();
  }

  private merchantDialog(player: Player): string {
    const dialog = new DialogBuilder()
      .defaultColor()
      .embed("tileX", this.data.x)
      .embed("tileY", this.data.y)
      .embed("netID", player.netID)
      .addLabelWithIcon("`6Tropical Merchant``", 13546, "big")
      .addSpacer("small")
      .addTextBox("`oAloha, friend! The trade winds brought me to your shores!``")
      .addSpacer("small")
      .addSmallText("`eCome back often as exotic goods arrive with the tide!``");

    if (player.isDeveloper) {
      dialog.addSpacer("small").addButton("npc_remove_tile", "`4[Dev/Owner] Pick Up / Remove NPC``");
    }

    dialog.addQuickExit().endDialog("npc_dialog", "", "Farewell");
    return dialog.str();
  }
}

// Dialog handler for NPC interactions
registerDialog("npc_dialog", async (player, action) => {
  const button = action.get("buttonClicked") ?? "";
  const tileX = Number.parseInt(action.get("tileX") ?? "0", 10);
  const tileY = Number.parseInt(action.get("tileY") ?? "0", 10);

  if (button === "npc_remove_tile") {
    const world = player.world;
    if (!world) return;
    const tile = world.getTileAt(tileX, tileY);
    if (!tile || tile.fg === 0) return;

    if (await world.hasTilePermission(player, tile, LockPermission.BREAK) || player.isDeveloper) {
      await tile.onDestroy(player);
      player.variants.sendOnConsoleMessage("`2NPC picked up.`");
    }
  }
});
