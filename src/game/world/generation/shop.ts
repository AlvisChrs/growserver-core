import { ITEM_ID, TileFlags, WEATHER_CLEAR, WORLD_SIZE, Y_END_DIRT, Y_LAVA_START, Y_START_DIRT } from "../constants";
import type { TileData, WorldData, Vending } from "../types";

interface VendItemConfig {
  x: number;
  y: number;
  itemId: number;
  count: number;
  price: number;
}

/**
 * Generates the dedicated SHOP world, fully stocked with vending machines
 * across 4 architectural floors with wooden platform bridges and clear sky.
 */
export function generateShopWorld(width = WORLD_SIZE.WIDTH, height = WORLD_SIZE.HEIGHT): WorldData {
  const blocks: TileData[] = [];
  const mainDoorX = 50;
  const groundY = Y_START_DIRT; // y = 24

  // Initialize base empty grid with cave background underground
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const block: TileData = { x, y, fg: 0, bg: 0, flags: 0 };

      if (y >= groundY) {
        block.bg = ITEM_ID.CAVE_BACKGROUND;
        if (y === groundY) {
          // Solid bedrock ground across the entire shop floor
          block.fg = ITEM_ID.BEDROCK;
        } else if (y >= Y_END_DIRT) {
          block.fg = ITEM_ID.BEDROCK;
        } else if (y >= Y_LAVA_START) {
          block.fg = (x + y) % 5 === 0 ? ITEM_ID.LAVA : ITEM_ID.ROCK;
        } else {
          block.fg = (x + y) % 3 === 0 ? ITEM_ID.ROCK : ITEM_ID.DIRT;
        }
      }

      blocks.push(block);
    }
  }

  const getBlock = (x: number, y: number): TileData => {
    return blocks[x + y * width]!;
  };

  // 1. Entrance Area (Floor 1 at y = 23)
  const doorTile = getBlock(mainDoorX, groundY - 1);
  doorTile.fg = ITEM_ID.MAIN_DOOR;
  doorTile.door = { label: "EXIT", destination: "EXIT" };
  doorTile.flags |= TileFlags.PUBLIC | TileFlags.TILEEXTRA;

  // Welcome Sign
  const signTile = getBlock(mainDoorX - 1, groundY - 1);
  signTile.fg = ITEM_ID.SIGN;
  signTile.sign = { label: "Welcome to SHOP! Browse all 4 floors of fully stocked vending machines!" };
  signTile.flags |= TileFlags.TILEEXTRA;

  // World Lock (Shop Ownership)
  const lockTile = getBlock(mainDoorX + 1, groundY - 1);
  lockTile.fg = ITEM_ID.WORLD_LOCK;
  lockTile.flags |= TileFlags.TILEEXTRA;
  lockTile.worldLockData = { ownerUserId: 99999, ownerName: "ShopKeeper_GT" };

  // 2. Wooden Platforms for Upper Floors
  // Floor 2 platforms at y = 20
  for (let x = 30; x <= 70; x++) {
    const tile = getBlock(x, 20);
    tile.fg = 102; // Wooden Platform
  }

  // Floor 3 platforms at y = 16
  for (let x = 30; x <= 70; x++) {
    const tile = getBlock(x, 16);
    tile.fg = 102; // Wooden Platform
  }

  // Floor 4 (VIP/PRO) platforms at y = 12
  for (let x = 32; x <= 68; x++) {
    const tile = getBlock(x, 12);
    tile.fg = 102; // Wooden Platform
  }

  // Helper to place and stock a vending machine
  const placeVending = (cfg: VendItemConfig): void => {
    const tile = getBlock(cfg.x, cfg.y);
    tile.fg = 2978; // Vending Machine item ID
    tile.flags |= TileFlags.TILEEXTRA | TileFlags.OPEN;
    tile.vending = {
      itemId: cfg.itemId,
      count: cfg.count,
      price: cfg.price,
      earned: 0,
    };
  };

  // 3. Vending Machines Catalog
  const vends: VendItemConfig[] = [
    // -------------------------------------------------------------------------
    // FLOOR 1 (Ground Floor - Seeds, Tools & Locks)
    // Left Wing: Seeds & Farmables (y = 23, x = 36..47)
    // -------------------------------------------------------------------------
    { x: 36, y: 23, itemId: 5667, count: 200, price: -20 },  // Laser Grid Seed (20/WL)
    { x: 37, y: 23, itemId: 341,  count: 200, price: -15 },  // Chandelier Seed (15/WL)
    { x: 38, y: 23, itemId: 4585, count: 200, price: -30 },  // Pepper Tree Seed (30/WL)
    { x: 39, y: 23, itemId: 3005, count: 200, price: -40 },  // Fish Tank Seed (40/WL)
    { x: 40, y: 23, itemId: 527,  count: 200, price: -25 },  // Pinball Bumper Seed (25/WL)
    { x: 41, y: 23, itemId: 325,  count: 200, price: -20 },  // High Tech Block Seed (20/WL)
    { x: 42, y: 23, itemId: 5991, count: 200, price: -10 },  // Magic Bell Seed (10/WL)
    { x: 43, y: 23, itemId: 107,  count: 200, price: -50 },  // Mushroom Seed (50/WL)
    { x: 44, y: 23, itemId: 11,   count: 200, price: -100 }, // Rock Seed (100/WL)
    { x: 45, y: 23, itemId: 3,    count: 200, price: -200 }, // Dirt Seed (200/WL)
    { x: 46, y: 23, itemId: 13,   count: 200, price: -100 }, // Grass Seed (100/WL)
    { x: 47, y: 23, itemId: 15,   count: 200, price: -100 }, // Wood Block Seed (100/WL)

    // Right Wing: Tools, Locks & Machines (y = 23, x = 53..64)
    { x: 53, y: 23, itemId: 98,   count: 200, price: -5 },   // Pickaxe (5/WL)
    { x: 54, y: 23, itemId: 1438, count: 30,  price: 20 },   // Golden Pickaxe (20 WL)
    { x: 55, y: 23, itemId: 822,  count: 200, price: -10 },  // Display Block (10/WL)
    { x: 56, y: 23, itemId: 1796, count: 50,  price: 100 },  // Diamond Lock (100 WL)
    { x: 57, y: 23, itemId: 202,  count: 200, price: -50 },  // Small Lock (50/WL)
    { x: 58, y: 23, itemId: 204,  count: 200, price: -10 },  // Big Lock (10/WL)
    { x: 59, y: 23, itemId: 206,  count: 200, price: -2 },   // Huge Lock (2/WL)
    { x: 60, y: 23, itemId: 1240, count: 50,  price: 1 },    // Heart Monitor (1 WL)
    { x: 61, y: 23, itemId: 4992, count: 20,  price: 5 },    // Antigravity Generator (5 WL)
    { x: 62, y: 23, itemId: 758,  count: 30,  price: 3 },    // Roulette Wheel (3 WL)
    { x: 63, y: 23, itemId: 756,  count: 30,  price: 3 },    // Slot Machine (3 WL)
    { x: 64, y: 23, itemId: 3694, count: 20,  price: 2 },    // Weather Machine - Heatwave (2 WL)

    // -------------------------------------------------------------------------
    // FLOOR 2 (Wings & Footwear Gallery - y = 19, platforms at y = 20)
    // -------------------------------------------------------------------------
    { x: 36, y: 19, itemId: 362,  count: 50,  price: 5 },    // Angel Wings (5 WL)
    { x: 38, y: 19, itemId: 1206, count: 50,  price: 12 },   // Devil Wings (12 WL)
    { x: 40, y: 19, itemId: 678,  count: 40,  price: 8 },    // Crimson Eagle Wings (8 WL)
    { x: 42, y: 19, itemId: 818,  count: 35,  price: 15 },   // Ripper Wings (15 WL)
    { x: 44, y: 19, itemId: 156,  count: 60,  price: 1 },    // Fairy Wings (1 WL)
    { x: 46, y: 19, itemId: 1460, count: 20,  price: 100 },  // Golden Angel Wings (100 WL / 1 DL)
    { x: 54, y: 19, itemId: 1674, count: 10,  price: 800 },  // Phoenix Wings (800 WL / 8 DL)
    { x: 56, y: 19, itemId: 1784, count: 5,   price: 1500 }, // Legendary Wings (1500 WL / 15 DL)
    { x: 58, y: 19, itemId: 1940, count: 30,  price: 35 },   // Diamond Rocket Shoes (35 WL)
    { x: 60, y: 19, itemId: 496,  count: 80,  price: 1 },    // Air Robinsons (1 WL)
    { x: 62, y: 19, itemId: 78,   count: 80,  price: -4 },   // Patent Leather Shoes (4/WL)
    { x: 64, y: 19, itemId: 1030, count: 60,  price: -2 },   // Cowboy Boots (2/WL)

    // -------------------------------------------------------------------------
    // FLOOR 3 (Clothing & Accessories - y = 15, platforms at y = 16)
    // -------------------------------------------------------------------------
    { x: 36, y: 15, itemId: 66,   count: 50,  price: 3 },    // Top Hat (3 WL)
    { x: 38, y: 15, itemId: 38,   count: 100, price: -2 },   // Tuxedo (2/WL)
    { x: 40, y: 15, itemId: 462,  count: 50,  price: 2 },    // Fedora (2 WL)
    { x: 42, y: 15, itemId: 468,  count: 90,  price: -3 },   // Pinstripe Pants (3/WL)
    { x: 44, y: 15, itemId: 76,   count: 100, price: -4 },   // Black Pants (4/WL)
    { x: 46, y: 15, itemId: 48,   count: 100, price: -5 },   // Jeans (5/WL)
    { x: 54, y: 15, itemId: 34,   count: 100, price: -5 },   // Shades (5/WL)
    { x: 56, y: 15, itemId: 1590, count: 50,  price: 1 },    // 3D Glasses (1 WL)
    { x: 58, y: 15, itemId: 146,  count: 40,  price: 2 },    // Gold-Rimmed Glasses (2 WL)
    { x: 60, y: 15, itemId: 890,  count: 100, price: -10 },  // Straw Hat (10/WL)
    { x: 62, y: 15, itemId: 892,  count: 100, price: -10 },  // Overalls (10/WL)
    { x: 64, y: 15, itemId: 70,   count: 80,  price: -2 },   // Spikey Hair (2/WL)

    // -------------------------------------------------------------------------
    // FLOOR 4 (VIP / PRO Showroom - y = 11, platforms at y = 12)
    // -------------------------------------------------------------------------
    { x: 38, y: 11, itemId: 5480, count: 5,   price: 5000 }, // Rayman's Fist (50 DL)
    { x: 41, y: 11, itemId: 5638, count: 5,   price: 3000 }, // MAGPLANT 5000 (30 DL)
    { x: 44, y: 11, itemId: 1204, count: 15,  price: 200 },  // Focused Eyes (2 DL)
    { x: 47, y: 11, itemId: 7188, count: 5,   price: 10000 },// Blue Gem Lock (1 BGL)
    { x: 50, y: 11, itemId: 1216, count: 20,  price: 25 },   // Cultist Hood (25 WL)
    { x: 53, y: 11, itemId: 1218, count: 20,  price: 25 },   // Cultist Robe (25 WL)
    { x: 56, y: 11, itemId: 2866, count: 25,  price: 10 },   // Wizard's Staff (10 WL)
    { x: 59, y: 11, itemId: 2030, count: 10,  price: 40 },   // Special Cultist Hood (40 WL)
    { x: 62, y: 11, itemId: 1438, count: 25,  price: 20 },   // Golden Pickaxe (20 WL)
  ];

  for (const vend of vends) {
    placeVending(vend);
  }

  return {
    name: "SHOP",
    width,
    height,
    blocks,
    dropped: { uid: 0, items: [] },
    weather: { id: WEATHER_CLEAR },
  };
}
