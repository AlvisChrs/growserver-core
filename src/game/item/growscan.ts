import { DialogBuilder } from "../../utils/dialog-builder";
import { getItem } from "./item-utils";
import type { Player } from "../player";
import type { World } from "../world/world";
import { registerDialog } from "../network/dialog-handler";
import { ActionTypes } from "../world/constants";

export const GROWSCAN_ITEM_ID = 6016;

export function isGrowscan(itemId: number): boolean {
  if (itemId === GROWSCAN_ITEM_ID) return true;
  const item = getItem(itemId);
  return item?.type === ActionTypes.STATS_BLOCK || (item?.name?.toLowerCase().includes("growscan") ?? false);
}

/**
 * Scans the current world and displays a comprehensive GrowScan 9000 diagnostic report.
 */
export function openGrowscan(player: Player, world: World): void {
  // Aggregate placed blocks
  const blockCounts = new Map<number, number>();
  let totalBlocks = 0;
  let totalTrees = 0;
  let readyTrees = 0;

  const now = Date.now();
  for (const tile of world.data.blocks) {
    if (tile.fg > 0) {
      totalBlocks++;
      blockCounts.set(tile.fg, (blockCounts.get(tile.fg) ?? 0) + 1);
    }
    if (tile.tree) {
      totalTrees++;
      if (tile.tree.fullyGrownAt <= now) {
        readyTrees++;
      }
    }
  }

  // Aggregate floating items
  const dropCounts = new Map<number, number>();
  let totalDrops = 0;
  let totalFloatingGems = 0;

  for (const drop of world.data.dropped.items) {
    totalDrops += drop.count;
    if ([914, 916, 918, 920, 924].includes(drop.id)) {
      totalFloatingGems += drop.count;
    }
    dropCounts.set(drop.id, (dropCounts.get(drop.id) ?? 0) + drop.count);
  }

  // Sort top blocks
  const sortedBlocks = Array.from(blockCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Sort top drops
  const sortedDrops = Array.from(dropCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const dialog = new DialogBuilder()
    .defaultColor()
    .embed("netID", player.netID)
    .addLabelWithIcon(`\`wGrowScan 9000: \`2${world.name}\`\``, GROWSCAN_ITEM_ID, "big")
    .addSpacer("small")
    .addTextBox("`2[World Overview]``")
    .addSmallText(
      `\`oDimensions: \`w${world.width}x${world.height}\`\` | \`oPlayers Online: \`w${world.players.length}\`\` | \`oTotal Blocks: \`w${totalBlocks}\`\``,
    )
    .addSmallText(
      `\`oPlanted Trees: \`w${totalTrees}\`\` (\`2${readyTrees} ready for harvest\`o) | \`oFloating Items: \`w${totalDrops}\`\` | \`oFloating Gems: \`w${totalFloatingGems}\`\``,
    )
    .addSpacer("small")
    .addTextBox("`9[Top Placed Blocks]``");

  if (sortedBlocks.length === 0) {
    dialog.addSmallText("`4No blocks placed in this world.`");
  } else {
    const blockListStr = sortedBlocks
      .map(([id, count]) => `\`w${getItem(id)?.name ?? `Item #${id}`}\`o: \`2${count}\`\``)
      .join("  |  ");
    dialog.addSmallText(blockListStr);
  }

  dialog.addSpacer("small").addTextBox("`e[Top Floating Dropped Items]``");

  if (sortedDrops.length === 0) {
    dialog.addSmallText("`4No floating items on the ground.`");
  } else {
    const dropListStr = sortedDrops
      .map(([id, count]) => `\`w${getItem(id)?.name ?? `Item #${id}`}\`o: \`2${count}\`\``)
      .join("  |  ");
    dialog.addSmallText(dropListStr);
  }

  dialog.addSpacer("small").addQuickExit().endDialog("growscan_dialog", "", "Close");

  player.sendTextBubble(`\`6[GrowScan 9000] World scan complete! (${totalBlocks} blocks, ${totalTrees} trees, ${totalDrops} items)\`\``, true);
  player.variants.sendOnConsoleMessage(`\`6[GrowScan 9000]\`\` Scanned \`2${world.name}\`\`: \`w${totalBlocks}\`\` blocks, \`w${totalTrees}\`\` trees (\`2${readyTrees} ready\`\`), \`w${totalDrops}\`\` floating items.`);
  world.playPositioned("audio/scanner.wav", player.netID);
  player.variants.sendOnDialogRequest(dialog.str());
}

registerDialog("growscan_dialog", () => {});
