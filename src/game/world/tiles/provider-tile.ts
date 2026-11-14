import type { ItemDefinition } from "grow-items";
import type { ExtendBuffer } from "../../../utils/extend-buffer";
import { DialogBuilder } from "../../../utils/dialog-builder";
import { getItem } from "../../item/item-utils";
import type { Player } from "../../player";
import { addRoleXp } from "../../quests/role-quests";
import { LockPermission, TileExtraTypes, TileFlags } from "../constants";
import { Tile } from "../tile";
import { registerDialog } from "../../network/dialog-handler";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "Ready!";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Providers: ATM machines, science stations, cows, chickens, and other blocks
 * that yield items/gems over time. Extra data layout: u8 extraType (9), u32 age (seconds).
 */
export class ProviderTile extends Tile {
  public override serializedFlags(flags: number): number {
    return flags | TileFlags.TILEEXTRA;
  }

  public override serialize(buffer: ExtendBuffer): void {
    buffer.writeU8(TileExtraTypes.PROVIDER ?? 9);
    const plantedAt = this.data.provider?.plantedAt ?? Date.now();
    const ageSeconds = Math.max(0, Math.floor((Date.now() - plantedAt) / 1000));
    buffer.writeU32(ageSeconds);
  }

  public override async onPlaceForeground(player: Player, itemMeta: ItemDefinition): Promise<boolean> {
    if (!(await super.onPlaceForeground(player, itemMeta))) return false;
    this.data.flags |= TileFlags.TILEEXTRA;
    this.data.provider = { plantedAt: Date.now() };
    this.tileUpdate();
    return true;
  }

  public override async onWrench(player: Player): Promise<boolean> {
    if (this.data.fg === 0) return true;
    const itemMeta = this.item;
    if (!itemMeta) return false;

    const growTime = itemMeta.growTime ?? 86400;
    const plantedAt = this.data.provider?.plantedAt ?? 0;
    const elapsedSeconds = Math.floor((Date.now() - plantedAt) / 1000);
    const isReady = elapsedSeconds >= growTime;
    const remaining = Math.max(0, growTime - elapsedSeconds);

    const dialog = new DialogBuilder()
      .defaultColor()
      .embed("tileX", this.data.x)
      .embed("tileY", this.data.y)
      .embed("netID", player.netID)
      .addLabelWithIcon(`\`w${itemMeta.name}\`\``, this.data.fg, "big")
      .addSpacer("small");

    if (isReady) {
      dialog
        .addTextBox("`2Status: READY TO HARVEST!``")
        .addSmallText("`oAll items/gems have accumulated and are ready to collect.``")
        .addSpacer("small")
        .addButton("provider_harvest", "`2Harvest Now``");
    } else {
      dialog
        .addTextBox("`4Status: Recharging...``")
        .addSmallText(`\`oTime remaining: \`2${formatDuration(remaining)}\`\` (\`w${remaining}\`o seconds)`)
        .addSpacer("small");
    }

    if (player.isDeveloper) {
      dialog
        .addSpacer("small")
        .addTextBox("`4[Staff / Developer Controls]``")
        .addButton("provider_dev_harvest", "`4[Dev] Instant Harvest``")
        .addButton("provider_dev_ready", "`4[Dev] Instant Ready (Set Timer)``");
    }

    // Owner / Dev can pick up provider cleanly without beating it up
    const hasBreakPermission = await this.world.hasTilePermission(player, this.data, LockPermission.BREAK);
    if (hasBreakPermission || player.isDeveloper) {
      dialog.addSpacer("small").addButton("provider_remove", "`4[Pick Up Provider]``");
    }

    dialog.addQuickExit().endDialog("provider_status", "", "Close");
    player.variants.sendOnDialogRequest(dialog.str());
    return true;
  }

  public override async onPunch(player: Player): Promise<boolean> {
    if (this.data.fg === 0) return true;
    const itemMeta = this.item;
    if (!itemMeta) return false;

    if (!(await this.world.hasTilePermission(player, this.data, LockPermission.BUILD))) {
      await this.onPunchFail(player);
      return false;
    }

    // If player holds a pickaxe, they explicitly want to break the block
    const isPickaxe = player.inventory.clothes.hand === 98 || player.inventory.clothes.hand === 2754;
    if (isPickaxe) {
      return super.onPunch(player);
    }

    const growTime = itemMeta.growTime ?? 86400;
    const plantedAt = this.data.provider?.plantedAt ?? 0;
    const elapsedSeconds = Math.floor((Date.now() - plantedAt) / 1000);

    // If ready, harvest!
    if (elapsedSeconds >= growTime) {
      this.harvest(player, itemMeta);
      return true;
    }

    // Developer instant harvest convenience
    if (player.isDeveloper) {
      this.harvest(player, itemMeta);
      return true;
    }

    // Not ready yet: inform player and apply standard punch damage
    const remaining = growTime - elapsedSeconds;
    player.sendTextBubble(`\`w${itemMeta.name} is not ready yet! (\`2${formatDuration(remaining)}\`w remaining)\`\``, true);
    player.variants.sendOnConsoleMessage(`\`o${itemMeta.name} is not ready yet! \`2${formatDuration(remaining)}\`o remaining.\`\``);

    return super.onPunch(player);
  }

  /**
   * Harvests the ready provider and drops prizes according to Growtopia rules.
   */
  public harvest(player: Player, itemMeta: ItemDefinition): void {
    const roleState = player.quests.role("provider");
    const providerLevel = roleState.lvl;

    // Role perks: Weed Magic double drop chance (1..5%)
    let multiplier = 1;
    const doubleChance = Math.min(5, Math.max(1, Math.floor(providerLevel / 2)));
    if (providerLevel >= 2 && Math.random() * 100 <= doubleChance) {
      multiplier = 2;
      player.variants.sendOnConsoleMessage("`2Weed Magic bonus doubled item drops!`");
    }

    // Rare milestone bonuses from GTOS
    if (providerLevel >= 4 && Math.random() * 100 <= 1) {
      player.addItemInven(5136, 1); // Smaraged Block
      player.variants.sendOnConsoleMessage("`2Obtained Smaraged Block!`");
    } else if (providerLevel >= 7 && Math.random() * 100 <= 1) {
      player.addItemInven(2410, 1); // Emerald Shard
      player.variants.sendOnConsoleMessage("`2Obtained Emerald Shard!`");
    } else if (providerLevel >= 10 && Math.floor(Math.random() * 300) === 0) {
      // Provider duplicates itself
      this.world.drop(player, this.dropX(), this.dropY(), this.data.fg, 1);
      player.variants.sendOnConsoleMessage(`\`2The ${itemMeta.name} has duplicated itself!\``);
    }

    const fg = this.data.fg;
    switch (fg) {
      case 1008: { // ATM Machine -> Direct gems & gem drops
        const directGems = Math.floor((50 + Math.random() * 150) * multiplier);
        player.addGems(directGems);
        player.sendTextBubble(`\`2+${directGems} Gems from ATM Machine!\`\``, true);
        player.variants.sendOnConsoleMessage(`\`2Collected \`w${directGems}\`2 gems from the \`$ATM Machine\`2!\`\``);

        const gemPool = [914, 916, 918, 920, 924];
        const gemItem = gemPool[Math.floor(Math.random() * gemPool.length)] ?? 914;
        this.world.drop(player, this.dropX(), this.dropY(), gemItem, multiplier);
        break;
      }

      case 928: { // Science Station -> Chemicals (826, 828, 830, 832, 834, 836)
        const chemList = [826, 828, 830, 832, 834, 836];
        const chem = chemList[Math.floor(Math.random() * chemList.length)] ?? 826;
        const count = (Math.random() <= 0.25 ? 2 : 1) * multiplier;
        this.world.drop(player, this.dropX(), this.dropY(), chem, count);
        player.variants.sendOnConsoleMessage(`\`2Obtained chemical compound from \`$Science Station\`2!\`\``);
        break;
      }

      case 872: { // Chicken -> Egg (874)
        this.world.drop(player, this.dropX(), this.dropY(), 874, (Math.random() <= 0.25 ? 2 : 1) * multiplier);
        break;
      }

      case 866: // Cow -> Milk (868)
      case 1044: { // Buffalo -> Milk (868)
        this.world.drop(player, this.dropX(), this.dropY(), 868, (Math.random() <= 0.25 ? 2 : 1) * multiplier);
        break;
      }

      case 3888: { // Sheep -> Wool (3890)
        const holdingShears = player.inventory.clothes.hand === 3914;
        const count = (holdingShears ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 2) + 1) * multiplier;
        this.world.drop(player, this.dropX(), this.dropY(), 3890, count);
        break;
      }

      case 2798: // Well -> Water Bucket (822)
      case 10656: { // Well of Love -> Water Bucket (822)
        this.world.drop(player, this.dropX(), this.dropY(), 822, 1 * multiplier);
        break;
      }

      case 1632: { // Coffee Maker -> Coffee (1634)
        this.world.drop(player, this.dropX(), this.dropY(), 1634, 1 * multiplier);
        break;
      }

      case 1636: { // Awkward Friendly Unicorn -> Rainbow (1640) or Horseshoe (1638)
        const unicornLoot = Math.random() < 0.5 ? 1640 : 1638;
        this.world.drop(player, this.dropX(), this.dropY(), unicornLoot, 1 * multiplier);
        break;
      }

      case 3044: { // Tackle Box -> Baits
        const baitList = [2914, 3012, 3014, 3016, 3018, 5528, 5526];
        const baitItem = baitList[Math.floor(Math.random() * baitList.length)] ?? 2914;
        this.world.drop(player, this.dropX(), this.dropY(), baitItem, (Math.random() <= 0.25 ? 2 : 1) * multiplier);
        break;
      }

      case 4858: { // Balloon Filling Station -> Balloons
        const balloonList = [4856, 4854, 4852];
        const balloon = balloonList[Math.floor(Math.random() * balloonList.length)] ?? 4856;
        this.world.drop(player, this.dropX(), this.dropY(), balloon, 1 * multiplier);
        break;
      }

      case 5116: { // Tea Set -> Tea (5114)
        this.world.drop(player, this.dropX(), this.dropY(), 5114, 1 * multiplier);
        break;
      }

      case 6212: { // Surgical Tool Bag -> Surgery tools
        const surgTools = [1258, 1260, 1262, 1264, 1266, 1268, 1270, 4308, 4310, 4312, 4314, 4316, 4318];
        const surgItem = surgTools[Math.floor(Math.random() * surgTools.length)] ?? 1258;
        this.world.drop(player, this.dropX(), this.dropY(), surgItem, 1 * multiplier);
        break;
      }

      case 6414: { // Star Tool Droid -> Startopia tools
        const starTools = [6404, 6406, 6408, 6410, 6412];
        const tool = starTools[Math.floor(Math.random() * starTools.length)] ?? 6404;
        this.world.drop(player, this.dropX(), this.dropY(), tool, 1 * multiplier);
        break;
      }

      case 8196: { // Building Blocks Machine -> Building blocks
        const blocks = [8198, 8200, 8202, 8204];
        const block = blocks[Math.floor(Math.random() * blocks.length)] ?? 8198;
        this.world.drop(player, this.dropX(), this.dropY(), block, 1 * multiplier);
        break;
      }

      case 10450: { // Diamond Builders Bonanza
        const dGems = Math.floor((100 + Math.random() * 200) * multiplier);
        player.addGems(dGems);
        player.sendTextBubble(`\`2+${dGems} Gems!\`\``, true);
        break;
      }

      case 12680: { // Wonder Provider
        const wonderGems = Math.floor((200 + Math.random() * 300) * multiplier);
        player.addGems(wonderGems);
        player.sendTextBubble(`\`2+${wonderGems} Gems from Wonder Provider!\`\``, true);
        break;
      }

      case 16104: { // Gumball Machine -> Gumball (16106)
        this.world.drop(player, this.dropX(), this.dropY(), 16106, 1 * multiplier);
        break;
      }

      case 16238: { // Ice Cream Truck
        this.world.drop(player, this.dropX(), this.dropY(), 16240, 1 * multiplier);
        break;
      }

      case 5318:
      case 7476:
      case 9224:
      case 10446:
      case 11472:
      case 12986:
      case 14138:
      case 15010:
      case 15822: { // Winterfest Calendars -> Winterfest gifts / candy canes / hot chocolate
        const winterItems = [538, 926, 1550, 9240];
        const winterPrize = winterItems[Math.floor(Math.random() * winterItems.length)] ?? 538;
        this.world.drop(player, this.dropX(), this.dropY(), winterPrize, 1 * multiplier);
        break;
      }

      default: {
        // Fallback: drops associated product (item.id - 1 or item.id)
        const dropId = itemMeta.id ? itemMeta.id - 1 : fg;
        this.world.drop(player, this.dropX(), this.dropY(), dropId > 0 ? dropId : fg, 1 * multiplier);
        break;
      }
    }

    // Role XP
    addRoleXp(player, "provider", 1);

    // Reset harvest timer
    this.data.provider = { plantedAt: Date.now() };
    this.tileUpdate();
    this.world.playPositioned("audio/getpoint.wav", player.netID);
  }

  private dropX(): number {
    return this.data.x * 32 + Math.floor(Math.random() * 16);
  }

  private dropY(): number {
    return this.data.y * 32 + Math.floor(Math.random() * 16);
  }
}

// Dialog return handler for provider status
registerDialog("provider_status", async (player, action) => {
  const button = action.get("buttonClicked") ?? "";
  const tileX = Number.parseInt(action.get("tileX") ?? "0", 10);
  const tileY = Number.parseInt(action.get("tileY") ?? "0", 10);

  const world = player.world;
  if (!world) return;
  const tile = world.getTileAt(tileX, tileY);
  if (!tile || tile.fg === 0) return;

  const itemMeta = getItem(tile.fg);
  if (!itemMeta) return;

  const provider = new ProviderTile(world, tile);

  if (button === "provider_harvest") {
    const growTime = itemMeta.growTime ?? 86400;
    const plantedAt = tile.provider?.plantedAt ?? 0;
    const elapsedSeconds = Math.floor((Date.now() - plantedAt) / 1000);

    if (elapsedSeconds >= growTime || player.isDeveloper) {
      provider.harvest(player, itemMeta);
      player.variants.sendOnConsoleMessage(`\`2Harvested \`w${itemMeta.name}\`2 successfully!\`\``);
    } else {
      player.sendTextBubble("This provider is still recharging!", true);
    }
    return;
  }

  if (button === "provider_dev_harvest" && player.isDeveloper) {
    provider.harvest(player, itemMeta);
    player.variants.sendOnConsoleMessage(`\`2[DEV] Instant harvested \`w${itemMeta.name}\`2.\`\``);
    return;
  }

  if (button === "provider_dev_ready" && player.isDeveloper) {
    tile.provider = { plantedAt: 0 };
    provider.tileUpdate();
    player.variants.sendOnConsoleMessage(`\`2[DEV] \`w${itemMeta.name}\`2 is now instantly ready for harvest!\`\``);
    await provider.onWrench(player);
    return;
  }

  if (button === "provider_remove") {
    if (await world.hasTilePermission(player, tile, LockPermission.BREAK) || player.isDeveloper) {
      await tile.onDestroy(player);
      player.variants.sendOnConsoleMessage(`\`2Picked up \`w${itemMeta.name}\`2.\`\``);
    }
  }
});
