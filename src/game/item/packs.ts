import { getItem } from "./item-utils";
import type { Player } from "../player";
import type { World } from "../world/world";
import { Variant } from "../packets/variants";
import { logger } from "../../utils/logger";

/** Seed packs and special reward pack items that unpack upon use. */
export const PACK_ITEMS: ReadonlySet<number> = new Set([
  5706, // Small Seed Pack
  8970, // Bountiful Seed Pack
  14930, // Stuffins' Support Package
  10868, // DUMB G4G Crate Pack
  9412, // Increase Backpack (+10 slots)
]);

export function isPackItem(itemId: number): boolean {
  if (PACK_ITEMS.has(itemId)) return true;
  const name = getItem(itemId)?.name?.toLowerCase() ?? "";
  return name.includes("seed pack") || name.includes("support package");
}

/** Basic common seed pool (Tier 1-3) */
const COMMON_SEEDS = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45];
/** Rare seed pool (Tier 4-6) */
const RARE_SEEDS = [105, 107, 109, 111, 113, 115, 117, 119, 121, 123, 125, 127, 129, 131, 133, 135, 137, 139, 141, 143];

/**
 * Opens a seed pack or gift package for the player.
 */
export function openPack(player: Player, world: World, itemId: number): boolean {
  if (!player.inventory.hasItem(itemId)) return false;

  const itemMeta = getItem(itemId);
  const packName = itemMeta?.name ?? `Pack #${itemId}`;

  if (player.removeItemInven(itemId, 1) <= 0) return false;

  const grantedItems: { id: number; count: number; name: string }[] = [];
  let grantedGems = 0;

  switch (itemId) {
    case 5706: { // Small Seed Pack
      grantedGems = 25 + Math.floor(Math.random() * 50);
      const seedCount = 3 + Math.floor(Math.random() * 3); // 3 to 5 seeds
      for (let i = 0; i < seedCount; i++) {
        const seedId = COMMON_SEEDS[Math.floor(Math.random() * COMMON_SEEDS.length)] ?? 3;
        player.addItemInven(seedId, 1);
        const name = getItem(seedId)?.name ?? `Seed #${seedId}`;
        const existing = grantedItems.find((entry) => entry.id === seedId);
        if (existing) existing.count++;
        else grantedItems.push({ id: seedId, count: 1, name });
      }
      break;
    }

    case 8970: { // Bountiful Seed Pack
      grantedGems = 100 + Math.floor(Math.random() * 150);
      const seedCount = 5 + Math.floor(Math.random() * 5); // 5 to 9 seeds
      for (let i = 0; i < seedCount; i++) {
        const pool = Math.random() < 0.6 ? RARE_SEEDS : COMMON_SEEDS;
        const seedId = pool[Math.floor(Math.random() * pool.length)] ?? 3;
        player.addItemInven(seedId, 1);
        const name = getItem(seedId)?.name ?? `Seed #${seedId}`;
        const existing = grantedItems.find((entry) => entry.id === seedId);
        if (existing) existing.count++;
        else grantedItems.push({ id: seedId, count: 1, name });
      }
      break;
    }

    case 14930: { // Stuffins' Support Package
      grantedGems = 200;
      const tools = [1258, 1260, 1262, 1264, 1266, 1268, 1270];
      for (let i = 0; i < 3; i++) {
        const toolId = tools[Math.floor(Math.random() * tools.length)] ?? 1258;
        player.addItemInven(toolId, 1);
        const name = getItem(toolId)?.name ?? `Tool #${toolId}`;
        const existing = grantedItems.find((entry) => entry.id === toolId);
        if (existing) existing.count++;
        else grantedItems.push({ id: toolId, count: 1, name });
      }
      break;
    }

    case 9412: { // Increase Backpack (+10 inventory slots)
      player.inventory.upgradeBackpack(10);
      player.sendTextBubble("`2Your backpack space has expanded by +10 slots!``", true);
      player.variants.sendOnConsoleMessage(`\`2Upgraded backpack capacity to \`w${player.inventory.capacity}\`2 slots!\`\``);
      world.playPositioned("audio/upgrade.wav", player.netID);
      return true;
    }

    default: {
      // Generic seed pack fallback
      grantedGems = 50;
      const seedId = COMMON_SEEDS[Math.floor(Math.random() * COMMON_SEEDS.length)] ?? 3;
      player.addItemInven(seedId, 2);
      const name = getItem(seedId)?.name ?? `Seed #${seedId}`;
      grantedItems.push({ id: seedId, count: 2, name });
      break;
    }
  }

  if (grantedGems > 0) {
    player.addGems(grantedGems);
  }

  // Audio, visual, and text notifications
  world.playPositioned("audio/secret.wav", player.netID);
  world.broadcastVariant(Variant.from("OnParticleEffect", 44, [player.state.x + 10, player.state.y + 16]));

  const itemsSummary = grantedItems.map((entry) => `${entry.count} ${entry.name}`).join(", ");
  const message = `You opened \`w${packName}\`\` and found: \`2${itemsSummary}\`\`${grantedGems > 0 ? ` and \`2${grantedGems} Gems\`\`` : ""}!`;

  player.sendTextBubble(message, true);
  player.variants.sendOnConsoleMessage(message);

  logger.info({ player: player.tankIDName, pack: packName, grantedItems, gems: grantedGems }, "opened consumable pack");
  return true;
}
