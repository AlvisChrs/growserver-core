import type { PlayerClothes } from "./inventory";

/**
 * Definition of a Full-Body Hero Suit.
 * When equipped, the visual appearance of the avatar is automatically coordinated
 * to display the iconic complete hero sprite without cluttering the player's backpack.
 */
export interface HeroSuitSet {
  name: string;
  hair?: number;
  shirt?: number;
  pants?: number;
  feet?: number;
  face?: number;
  hand?: number;
  back?: number;
  mask?: number;
  necklace?: number;
}

export const HERO_SUIT_SETS: Record<number, HeroSuitSet> = {
  11560: {
    // Ezio Auditore
    name: "Ezio Auditore",
    hair: 7080,   // Ezio's Hood
    shirt: 7082,  // Ezio's Vest
    pants: 7086,  // Ezio's Trousers
    feet: 7094,   // Ezio's Boots
    face: 7090,   // Ezio's Beard
    hand: 7088,   // Ezio's Armguards
    back: 7084,   // Ezio's Cape
    mask: 7092,   // Ezio's Hair
    necklace: 11560,
  },
  12646: {
    // Altair Ibn-La'Ahad
    name: "Altair Ibn-La'Ahad",
    hair: 12740,  // Altair's Hood
    shirt: 12742, // Altair's Vest
    pants: 12744, // Altair's Trousers
    feet: 12746,  // Altair's Boots
    hand: 7088,   // Assassin Armguards
    back: 7084,   // Assassin Cape
    necklace: 12646,
  },
  12650: {
    // Bayek of Siwa
    name: "Bayek of Siwa",
    hair: 12748,  // Bayek's Hood
    shirt: 12750, // Bayek's Vest
    pants: 12752, // Bayek's Trousers
    feet: 12754,  // Bayek's Boots
    back: 7084,
    hand: 7088,
    necklace: 12650,
  },
  13892: {
    // Basim
    name: "Basim",
    mask: 13904,  // Basim's Hood
    face: 13906,  // Basim's Beard
    shirt: 13908, // Basim's Vest
    pants: 13910, // Basim's Trousers
    feet: 13912,  // Basim's Boots
    back: 7084,
    necklace: 13892,
  },
  13894: {
    // Connor Kenway
    name: "Connor Kenway",
    mask: 13914,  // Connor's Hood
    shirt: 13916, // Connor's Vest
    pants: 13918, // Connor's Trousers
    feet: 13920,  // Connor's Boots
    back: 7084,
    necklace: 13894,
  },
  13896: {
    // Kassandra
    name: "Kassandra",
    mask: 13922,  // Kassandra's Hair
    shirt: 13924, // Kassandra's Armor
    pants: 13926, // Kassandra's Skirt
    feet: 13928,  // Kassandra's Sandals
    necklace: 13896,
  },
  15288: {
    // Edward Kenway
    name: "Edward Kenway",
    hair: 15292,  // Edward's Hood
    mask: 15294,  // Edward's Hair
    face: 15296,  // Edward's Beard
    shirt: 15298, // Edward's Vest
    pants: 15300, // Edward's Trousers
    feet: 15302,  // Edward's Boots
    necklace: 15288,
  },
  15290: {
    // Yasuke
    name: "Yasuke",
    hair: 15304,  // Yasuke's Helmet
    mask: 15306,  // Yasuke's Hair
    face: 15308,  // Yasuke's Beard
    shirt: 15310, // Yasuke's Armor
    pants: 15312, // Yasuke's Trousers
    feet: 15314,  // Yasuke's Boots
    necklace: 15290,
  },
  12648: {
    // Eivor
    name: "Eivor",
    mask: 12756,  // Eivor's Hair
    face: 12758,  // Eivor's Tattoos
    shirt: 12760, // Eivor's Vest
    pants: 12762, // Eivor's Trousers
    feet: 12764,  // Eivor's Boots
    necklace: 12648,
  },
  15284: {
    // Nix
    name: "Nix",
    mask: 15330,  // Nix's Hair
    shirt: 15332, // Nix's Jacket
    pants: 15334, // Nix's Pants
    feet: 15328,  // Nix's Shoes
    necklace: 15284,
  },
  11554: {
    // Bodvar
    name: "Bödvar",
    face: 13254,  // Bodvar's Beard
    necklace: 11554,
  },
  11556: {
    // Val
    name: "Val",
    mask: 13256,  // Val's Hair
    necklace: 11556,
  },
  11558: {
    // Sam Fisher
    name: "Sam Fisher",
    face: 1204,   // Night Vision Goggles / Eyes
    necklace: 11558,
  },
  5480: {
    // Rayman
    name: "Rayman",
    hand: 5480,   // Rayman's Fist
    mask: 5482,   // Rayman's Hair
    shirt: 5484,  // Rayman's Hoodie
    feet: 5486,   // Rayman's Shoes
    face: 5488,   // Rayman's Nose
  },
};

/**
 * Known Full-Body Hero Suits (equipped in the necklace slot).
 */
export const FULL_BODY_SUITS: ReadonlySet<number> = new Set(
  Object.keys(HERO_SUIT_SETS).map((id) => Number.parseInt(id, 10)),
);

/**
 * Items that provide transformation/morph mechanisms (e.g. Go-Go-Growformer!,
 * Growformer PowerKey, Space Rabbit, etc.).
 */
export const MORPH_ITEMS: ReadonlySet<number> = new Set([
  7384, // Go-Go-Growformer! (Feet)
  7480, // Growformer PowerKey
  10960, // Space Rabbit
  12014, // Dal's Phasers
  12018, // Rok's Fists
  13196, // Rabbid Buddy
]);

/**
 * Computes the visually effective clothes sent to clients via `OnSetClothing`.
 * Preserves the player's true equipped wardrobe across all slots (hair, shirt,
 * pants, feet, face, hand, back, mask, necklace, ances) without artificial
 * overriding or suppressing clothes.
 */
export function computeEffectiveClothes(clothes: Readonly<PlayerClothes>, _isTransformed = false): PlayerClothes {
  return { ...clothes };
}
