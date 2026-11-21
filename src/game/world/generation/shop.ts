import { ITEM_ID, TileFlags, TileExtraTypes, WORLD_SIZE } from "../constants";
import type { TileData, WorldData } from "../types";

interface VendItemConfig {
  x: number;
  y: number;
  itemId: number;
  count: number;
  price: number;
}

/**
 * Atmospheric Sunset sky weather ID (matches core command /weather sunset).
 */
export const WEATHER_SUNSET = 11;

/** Luxury building block palette IDs */
export const LUXURY_BLOCKS = {
  GOLDEN_BLOCK: 260,
  MARBLE_BLOCK: 668,
  BLACK_BLOCK: 166,
  WHITE_BLOCK: 168,
  WOODEN_PLATFORM: 102,
  CHANDELIER: 340,
  DISPLAY_BLOCK: 822,
  STREETLAMP: 992,
  CHECKER_WALLPAPER: 284,
  BLACK_WALLPAPER: 1158,
  BLUE_STAR_WALLPAPER: 432,
  VENDING_MACHINE: 2978,
} as const;

/**
 * Generates a luxurious Grand Marketplace world for "SHOP" featuring:
 * - Atmospheric Sunset weather sky
 * - Polished Marble & Golden Block architecture
 * - Checker & Black Wallpaper interiors with hanging Chandeliers
 * - Zero dirt/rock/lava clutter in the ground (clean open basement down to bedrock at y=59)
 * - 4 grand shopping floors plus a VIP Diamond Vault basement
 * - 58 fully stocked Vending Machines and luxury item displays
 */
export function generateShopWorld(width = WORLD_SIZE.WIDTH, height = WORLD_SIZE.HEIGHT): WorldData {
  const blocks: TileData[] = [];
  const mainDoorX = 50;
  const groundFloorY = 24;

  // Initialize completely clean 100x60 world grid with bedrock ONLY at the bottom-most boundary (y = 59)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const block: TileData = { x, y, fg: 0, bg: 0, flags: 0 };
      if (y === height - 1) {
        // Bedrock solely at the bottom-most row to prevent out-of-bounds falling
        block.fg = ITEM_ID.BEDROCK;
      }
      blocks.push(block);
    }
  }

  const getBlock = (x: number, y: number): TileData => {
    return blocks[x + y * width]!;
  };

  // ---------------------------------------------------------------------------
  // 1. Grand Mall Wallpaper & Frame (x: 20..80, y: 8..24)
  // ---------------------------------------------------------------------------
  for (let y = 8; y <= groundFloorY; y++) {
    for (let x = 20; x <= 80; x++) {
      const tile = getBlock(x, y);
      // Alternating luxury boutique wallpaper
      if (y >= 9 && y <= 23) {
        tile.bg = (x + y) % 2 === 0 ? LUXURY_BLOCKS.BLACK_WALLPAPER : LUXURY_BLOCKS.CHECKER_WALLPAPER;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Pillars & Structural Framing
  // ---------------------------------------------------------------------------
  // Outer Golden & Marble Columns (x = 20, 80)
  for (let y = 8; y <= groundFloorY; y++) {
    const leftPillar = getBlock(20, y);
    const rightPillar = getBlock(80, y);
    const blockType = y % 2 === 0 ? LUXURY_BLOCKS.GOLDEN_BLOCK : LUXURY_BLOCKS.MARBLE_BLOCK;
    leftPillar.fg = blockType;
    rightPillar.fg = blockType;
  }

  // Mid Columns (x = 34, 66)
  for (let y = 8; y <= groundFloorY; y++) {
    const colLeft = getBlock(34, y);
    const colRight = getBlock(66, y);
    const blockType = (y + 1) % 2 === 0 ? LUXURY_BLOCKS.GOLDEN_BLOCK : LUXURY_BLOCKS.MARBLE_BLOCK;
    colLeft.fg = blockType;
    colRight.fg = blockType;
  }

  // Roof Cornice & Crown (y = 8)
  for (let x = 20; x <= 80; x++) {
    const roof = getBlock(x, 8);
    roof.fg = (x % 3 === 0) ? LUXURY_BLOCKS.GOLDEN_BLOCK : LUXURY_BLOCKS.MARBLE_BLOCK;
  }
  // Central golden ornamental spire
  getBlock(49, 7).fg = LUXURY_BLOCKS.GOLDEN_BLOCK;
  getBlock(50, 7).fg = LUXURY_BLOCKS.GOLDEN_BLOCK;
  getBlock(51, 7).fg = LUXURY_BLOCKS.GOLDEN_BLOCK;
  getBlock(50, 6).fg = LUXURY_BLOCKS.GOLDEN_BLOCK;

  // ---------------------------------------------------------------------------
  // 3. Ground Floor Promenade (y = 24)
  // ---------------------------------------------------------------------------
  // Full world marble walkway across x = 0..99 at y = 24
  for (let x = 0; x < width; x++) {
    const tile = getBlock(x, groundFloorY);
    if (x >= 20 && x <= 80) {
      tile.fg = (x % 2 === 0) ? LUXURY_BLOCKS.MARBLE_BLOCK : LUXURY_BLOCKS.BLACK_BLOCK;
    } else {
      tile.fg = LUXURY_BLOCKS.MARBLE_BLOCK;
    }
  }
  // Solid golden foundation under main door
  getBlock(mainDoorX, groundFloorY).fg = LUXURY_BLOCKS.GOLDEN_BLOCK;

  // ---------------------------------------------------------------------------
  // 4. Main Entrance Lobby (y = 23)
  // ---------------------------------------------------------------------------
  // Main White Exit Door
  const doorTile = getBlock(mainDoorX, groundFloorY - 1);
  doorTile.fg = ITEM_ID.MAIN_DOOR;
  doorTile.door = { label: "EXIT", destination: "EXIT" };
  doorTile.flags |= TileFlags.PUBLIC | TileFlags.TILEEXTRA;

  // Entrance Golden Lamp Posts
  getBlock(mainDoorX - 2, groundFloorY - 1).fg = LUXURY_BLOCKS.STREETLAMP;
  getBlock(mainDoorX + 2, groundFloorY - 1).fg = LUXURY_BLOCKS.STREETLAMP;

  // Welcome Sign
  const signTile = getBlock(mainDoorX - 1, groundFloorY - 1);
  signTile.fg = ITEM_ID.SIGN;
  signTile.sign = { label: "Welcome to SHOP! The premier luxury Sunset Mall with 4 floors & VIP Diamond Vault!" };
  signTile.flags |= TileFlags.TILEEXTRA;

  // World Lock (Shop Ownership)
  const lockTile = getBlock(mainDoorX + 1, groundFloorY - 1);
  lockTile.fg = ITEM_ID.WORLD_LOCK;
  lockTile.flags |= TileFlags.TILEEXTRA;
  lockTile.worldLockData = { ownerUserId: 99999, ownerName: "ShopKeeper_GT" };

  // ---------------------------------------------------------------------------
  // 5. Wooden Platforms for Vertical Floors
  // ---------------------------------------------------------------------------
  // Floor 2 platforms at y = 20 (x: 21..79)
  for (let x = 21; x <= 79; x++) {
    if (x !== 34 && x !== 66) {
      getBlock(x, 20).fg = LUXURY_BLOCKS.WOODEN_PLATFORM;
    }
  }

  // Floor 3 platforms at y = 16 (x: 21..79)
  for (let x = 21; x <= 79; x++) {
    if (x !== 34 && x !== 66) {
      getBlock(x, 16).fg = LUXURY_BLOCKS.WOODEN_PLATFORM;
    }
  }

  // Floor 4 (VIP/PRO) platforms at y = 12 (x: 25..75)
  for (let x = 25; x <= 75; x++) {
    if (x !== 34 && x !== 66) {
      getBlock(x, 12).fg = LUXURY_BLOCKS.WOODEN_PLATFORM;
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Ambient Ceiling Chandeliers
  // ---------------------------------------------------------------------------
  const chandelierSpots = [
    // Hanging from Roof (y = 9) above Floor 4
    { x: 38, y: 9 }, { x: 44, y: 9 }, { x: 50, y: 9 }, { x: 56, y: 9 }, { x: 62, y: 9 },
    // Hanging from Floor 4 (y = 13) above Floor 3
    { x: 28, y: 13 }, { x: 40, y: 13 }, { x: 50, y: 13 }, { x: 60, y: 13 }, { x: 72, y: 13 },
    // Hanging from Floor 3 (y = 17) above Floor 2
    { x: 28, y: 17 }, { x: 40, y: 17 }, { x: 50, y: 17 }, { x: 60, y: 17 }, { x: 72, y: 17 },
    // Hanging from Floor 2 (y = 21) above Floor 1
    { x: 28, y: 21 }, { x: 42, y: 21 }, { x: 58, y: 21 }, { x: 72, y: 21 },
  ];
  for (const pos of chandelierSpots) {
    getBlock(pos.x, pos.y).fg = LUXURY_BLOCKS.CHANDELIER;
  }

  // ---------------------------------------------------------------------------
  // 7. Basement VIP Diamond Vault (Floor -1, y: 25..30)
  // ---------------------------------------------------------------------------
  // Central platform stairs leading down to vault
  for (let y = 25; y <= 29; y++) {
    getBlock(49, y).fg = LUXURY_BLOCKS.WOODEN_PLATFORM;
    getBlock(50, y).fg = LUXURY_BLOCKS.WOODEN_PLATFORM;
    getBlock(51, y).fg = LUXURY_BLOCKS.WOODEN_PLATFORM;
  }

  // Vault Floor & Walls (x: 30..70, y: 25..30)
  for (let y = 25; y <= 30; y++) {
    for (let x = 30; x <= 70; x++) {
      const tile = getBlock(x, y);
      tile.bg = LUXURY_BLOCKS.BLUE_STAR_WALLPAPER;
      if (y === 30) {
        tile.fg = (x % 2 === 0) ? LUXURY_BLOCKS.GOLDEN_BLOCK : LUXURY_BLOCKS.MARBLE_BLOCK;
      }
    }
  }
  // Vault edge pillars
  for (let y = 25; y <= 30; y++) {
    getBlock(30, y).fg = LUXURY_BLOCKS.GOLDEN_BLOCK;
    getBlock(70, y).fg = LUXURY_BLOCKS.GOLDEN_BLOCK;
  }

  // Luxury Display Blocks inside Vault showcasing treasures
  const vaultDisplays = [
    { x: 36, y: 29, itemId: 1796 }, // Diamond Lock
    { x: 40, y: 29, itemId: 7188 }, // Blue Gem Lock
    { x: 44, y: 29, itemId: 5480 }, // Rayman's Fist
    { x: 56, y: 29, itemId: 5638 }, // MAGPLANT 5000
    { x: 60, y: 29, itemId: 1460 }, // Golden Angel Wings
    { x: 64, y: 29, itemId: 1204 }, // Focused Eyes
  ];
  for (const disp of vaultDisplays) {
    const tile = getBlock(disp.x, disp.y);
    tile.fg = LUXURY_BLOCKS.DISPLAY_BLOCK;
    tile.flags |= TileFlags.TILEEXTRA;
    tile.displayBlock = { displayedItem: disp.itemId };
  }
  // Vault Chandeliers
  getBlock(38, 26).fg = LUXURY_BLOCKS.CHANDELIER;
  getBlock(62, 26).fg = LUXURY_BLOCKS.CHANDELIER;

  // Helper to place and stock a vending machine
  const placeVending = (cfg: VendItemConfig): void => {
    const tile = getBlock(cfg.x, cfg.y);
    tile.fg = LUXURY_BLOCKS.VENDING_MACHINE;
    tile.flags |= TileFlags.TILEEXTRA | TileFlags.OPEN;
    tile.vending = {
      itemId: cfg.itemId,
      count: cfg.count,
      price: cfg.price,
      earned: 0,
    };
  };

  // ---------------------------------------------------------------------------
  // 8. Vending Machines Catalog (58 Machines across 4 Floors)
  // ---------------------------------------------------------------------------
  const vends: VendItemConfig[] = [
    // FLOOR 1 (Ground Floor - Seeds, Tools & Locks)
    // Left Wing: Farmable Seeds (y = 23, x = 25..33, 35..37)
    { x: 25, y: 23, itemId: 5667, count: 200, price: -20 },  // Laser Grid Seed (20/WL)
    { x: 26, y: 23, itemId: 341,  count: 200, price: -15 },  // Chandelier Seed (15/WL)
    { x: 27, y: 23, itemId: 4585, count: 200, price: -30 },  // Pepper Tree Seed (30/WL)
    { x: 28, y: 23, itemId: 3005, count: 200, price: -40 },  // Fish Tank Seed (40/WL)
    { x: 29, y: 23, itemId: 527,  count: 200, price: -25 },  // Pinball Bumper Seed (25/WL)
    { x: 30, y: 23, itemId: 325,  count: 200, price: -20 },  // High Tech Block Seed (20/WL)
    { x: 31, y: 23, itemId: 5991, count: 200, price: -10 },  // Magic Bell Seed (10/WL)
    { x: 32, y: 23, itemId: 107,  count: 200, price: -50 },  // Mushroom Seed (50/WL)
    { x: 33, y: 23, itemId: 11,   count: 200, price: -100 }, // Rock Seed (100/WL)
    { x: 35, y: 23, itemId: 3,    count: 200, price: -200 }, // Dirt Seed (200/WL)
    { x: 36, y: 23, itemId: 13,   count: 200, price: -100 }, // Grass Seed (100/WL)
    { x: 37, y: 23, itemId: 15,   count: 200, price: -100 }, // Wood Block Seed (100/WL)

    // Right Wing: Tools, Locks & Machines (y = 23, x = 63..65, 67..75)
    { x: 63, y: 23, itemId: 98,   count: 200, price: -5 },   // Pickaxe (5/WL)
    { x: 64, y: 23, itemId: 1438, count: 30,  price: 20 },   // Golden Pickaxe (20 WL)
    { x: 65, y: 23, itemId: 822,  count: 200, price: -10 },  // Display Block (10/WL)
    { x: 67, y: 23, itemId: 1796, count: 50,  price: 100 },  // Diamond Lock (100 WL)
    { x: 68, y: 23, itemId: 202,  count: 200, price: -50 },  // Small Lock (50/WL)
    { x: 69, y: 23, itemId: 204,  count: 200, price: -10 },  // Big Lock (10/WL)
    { x: 70, y: 23, itemId: 206,  count: 200, price: -2 },   // Huge Lock (2/WL)
    { x: 71, y: 23, itemId: 1240, count: 50,  price: 1 },    // Heart Monitor (1 WL)
    { x: 72, y: 23, itemId: 4992, count: 20,  price: 5 },    // Antigravity Generator (5 WL)
    { x: 73, y: 23, itemId: 758,  count: 30,  price: 3 },    // Roulette Wheel (3 WL)
    { x: 74, y: 23, itemId: 756,  count: 30,  price: 3 },    // Slot Machine (3 WL)
    { x: 75, y: 23, itemId: 3694, count: 20,  price: 2 },    // Weather Machine - Heatwave (2 WL)

    // FLOOR 2 (Wings & Footwear Gallery - y = 19, platforms at y = 20)
    { x: 26, y: 19, itemId: 362,  count: 50,  price: 5 },    // Angel Wings (5 WL)
    { x: 28, y: 19, itemId: 1206, count: 50,  price: 12 },   // Devil Wings (12 WL)
    { x: 30, y: 19, itemId: 678,  count: 40,  price: 8 },    // Crimson Eagle Wings (8 WL)
    { x: 32, y: 19, itemId: 818,  count: 35,  price: 15 },   // Ripper Wings (15 WL)
    { x: 36, y: 19, itemId: 156,  count: 60,  price: 1 },    // Fairy Wings (1 WL)
    { x: 38, y: 19, itemId: 1460, count: 20,  price: 100 },  // Golden Angel Wings (100 WL / 1 DL)
    { x: 62, y: 19, itemId: 1674, count: 10,  price: 800 },  // Phoenix Wings (800 WL / 8 DL)
    { x: 64, y: 19, itemId: 1784, count: 5,   price: 1500 }, // Legendary Wings (1500 WL / 15 DL)
    { x: 68, y: 19, itemId: 1940, count: 30,  price: 35 },   // Diamond Rocket Shoes (35 WL)
    { x: 70, y: 19, itemId: 496,  count: 80,  price: 1 },    // Air Robinsons (1 WL)
    { x: 72, y: 19, itemId: 78,   count: 80,  price: -4 },   // Patent Leather Shoes (4/WL)
    { x: 74, y: 19, itemId: 1030, count: 60,  price: -2 },   // Cowboy Boots (2/WL)

    // FLOOR 3 (Clothing & Accessories - y = 15, platforms at y = 16)
    { x: 26, y: 15, itemId: 66,   count: 50,  price: 3 },    // Top Hat (3 WL)
    { x: 28, y: 15, itemId: 38,   count: 100, price: -2 },   // Tuxedo (2/WL)
    { x: 30, y: 15, itemId: 462,  count: 50,  price: 2 },    // Fedora (2 WL)
    { x: 32, y: 15, itemId: 468,  count: 90,  price: -3 },   // Pinstripe Pants (3/WL)
    { x: 36, y: 15, itemId: 76,   count: 100, price: -4 },   // Black Pants (4/WL)
    { x: 38, y: 15, itemId: 48,   count: 100, price: -5 },   // Jeans (5/WL)
    { x: 62, y: 15, itemId: 34,   count: 100, price: -5 },   // Shades (5/WL)
    { x: 64, y: 15, itemId: 1590, count: 50,  price: 1 },    // 3D Glasses (1 WL)
    { x: 68, y: 15, itemId: 146,  count: 40,  price: 2 },    // Gold-Rimmed Glasses (2 WL)
    { x: 70, y: 15, itemId: 890,  count: 100, price: -10 },  // Straw Hat (10/WL)
    { x: 72, y: 15, itemId: 892,  count: 100, price: -10 },  // Overalls (10/WL)
    { x: 74, y: 15, itemId: 70,   count: 80,  price: -2 },   // Spikey Hair (2/WL)

    // FLOOR 4 (VIP / PRO Showroom - y = 11, platforms at y = 12)
    { x: 30, y: 11, itemId: 5480, count: 5,   price: 5000 }, // Rayman's Fist (50 DL)
    { x: 33, y: 11, itemId: 5638, count: 5,   price: 3000 }, // MAGPLANT 5000 (30 DL)
    { x: 36, y: 11, itemId: 1204, count: 15,  price: 200 },  // Focused Eyes (2 DL)
    { x: 40, y: 11, itemId: 7188, count: 5,   price: 10000 },// Blue Gem Lock (1 BGL)
    { x: 60, y: 11, itemId: 1216, count: 20,  price: 25 },   // Cultist Hood (25 WL)
    { x: 63, y: 11, itemId: 1218, count: 20,  price: 25 },   // Cultist Robe (25 WL)
    { x: 67, y: 11, itemId: 2866, count: 25,  price: 10 },   // Wizard's Staff (10 WL)
    { x: 70, y: 11, itemId: 2030, count: 10,  price: 40 },   // Special Cultist Hood (40 WL)
    { x: 72, y: 11, itemId: 1438, count: 25,  price: 20 },   // Golden Pickaxe (20 WL)
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
    weather: { id: WEATHER_SUNSET },
  };
}
