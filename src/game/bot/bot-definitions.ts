import { PLAYER_ROLE } from "../../constants";
import type { BotConfig } from "./bot-player";

/**
 * Pre-configured bot roster deployed across various social, farm, and casino worlds.
 */
export const DEFAULT_BOT_ROSTER: BotConfig[] = [
  // ---------------------------------------------------------------------------
  // START World (Social hub & welcoming community)
  // ---------------------------------------------------------------------------
  {
    name: "HamumuFan",
    role: PLAYER_ROLE.SUPPORTER,
    level: 54,
    gems: 120000,
    country: "us",
    behavior: "social",
    worldName: "START",
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 462,      // Fedora
      shirt: 38,      // Tuxedo
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
      back: 362,      // Angel Wings
      face: 34,       // Shades
    },
    dialoguePool: [
      "Welcome to GrowServer! :D",
      "Anyone want to trade or hang out?",
      "Who remembers old Growtopia 2013-2015? Good times!",
      "Nice world! Drop party when?",
      "Buying rare seed packs, message me!",
      "Check out the other worlds with /warp farm and /warp casino!",
      "Remember to set your /sethome so you never lose your base!",
    ],
  },
  {
    name: "PixelTrader",
    role: PLAYER_ROLE.BASIC,
    level: 38,
    gems: 45000,
    country: "sg",
    behavior: "social",
    worldName: "START",
    skinColor: 0xffe4b5ff,
    clothes: {
      hair: 46,       // Baseball Cap
      shirt: 304,     // Tie Dyed Shirt
      pants: 48,      // Jeans
      feet: 496,      // Air Robinsons
      back: 678,      // Crimson Eagle Wings
      hand: 98,       // Pickaxe
    },
    dialoguePool: [
      "B> Laser Grid seeds 5/1 fast trade!",
      "Selling World Locks for gems, PM me!",
      "Anyone selling Diamond Locks?",
      "Trade me or /msg PixelTrader if you have farmables!",
      "Market prices are booming today :o",
      "Looking for trusted trade partners!",
    ],
  },
  {
    name: "GrowNoob_99",
    role: PLAYER_ROLE.BASIC,
    level: 8,
    gems: 2500,
    country: "id",
    behavior: "social",
    worldName: "START",
    skinColor: 0xffe0bdff,
    clothes: {
      hair: 890,      // Straw Hat
      shirt: 892,     // Overalls
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
    },
    dialoguePool: [
      "Halo! How do I get rich fast?",
      "Can anyone give free world lock please? :')",
      "Where is the best world to farm?",
      "Whoa your clothes look so cool!",
      "How do I lock my world with World Lock?",
      "Nice server! So fun to play!",
    ],
  },

  // ---------------------------------------------------------------------------
  // FARM World (Active farming & block breaking)
  // ---------------------------------------------------------------------------
  {
    name: "FarmerJack",
    role: PLAYER_ROLE.BASIC,
    level: 62,
    gems: 350000,
    country: "us",
    behavior: "farmer",
    worldName: "FARM",
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 890,      // Straw Hat
      shirt: 36,      // Green Shirt
      pants: 48,      // Jeans
      feet: 42,       // Boots
      hand: 98,       // Pickaxe
    },
    dialoguePool: [
      "Breaking Chandeliers fast! Need more pickaxes!",
      "Row 3 is almost cleared, time to plant seeds!",
      "4 seeds dropped from that batch! Sweet!",
      "Farming is the true way to get rich in Growtopia.",
      "Laser grid and chandeliers give the best gem yield.",
      "Just 100 more trees to harvest today!",
    ],
  },
  {
    name: "ChandHarvester",
    role: PLAYER_ROLE.BASIC,
    level: 49,
    gems: 210000,
    country: "my",
    behavior: "farmer",
    worldName: "FARM",
    skinColor: 0xf5deb3ff,
    clothes: {
      hair: 74,       // Ski Cap
      shirt: 892,     // Overalls
      pants: 48,      // Jeans
      feet: 1030,     // Cowboy Boots
      hand: 1438,     // Golden Pickaxe
      back: 156,      // Fairy Wings
    },
    dialoguePool: [
      "Harvest session going strong!",
      "Gems stacking up fast haha!",
      "Hit that farmable block! Steady rhythm!",
      "Anyone want to help break? Split gems 50/50!",
      "Pickaxe speed bonus is so satisfying.",
    ],
  },

  // ---------------------------------------------------------------------------
  // CASINO World (Roulette Host & active gamblers)
  // ---------------------------------------------------------------------------
  {
    name: "WheelMaster",
    role: PLAYER_ROLE.BASIC,
    level: 75,
    gems: 990000,
    country: "us",
    behavior: "casino_host",
    worldName: "CASINO",
    skinColor: 0xffdfd3ff,
    clothes: {
      hair: 66,       // Top Hat
      shirt: 38,      // Tuxedo
      pants: 76,      // Black Pants
      feet: 78,       // Patent Leather Shoes
      face: 146,      // Gold-Rimmed Glasses
      hand: 2866,     // Wizard's Staff
    },
    dialoguePool: [
      "All bets in! Minimum bet 5 World Locks!",
      "Rolling the roulette wheel... good luck everyone!",
      "Drop your bet on the table to join the round!",
      "Winner takes all! Fair play 100%!",
      "Who will hit the lucky number this round?",
      "Next round starts in 10 seconds! Place your bets!",
    ],
  },
  {
    name: "HighRoller_GT",
    role: PLAYER_ROLE.SUPPORTER,
    level: 68,
    gems: 500000,
    country: "id",
    behavior: "casino_gambler",
    worldName: "CASINO",
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 462,      // Fedora
      shirt: 38,      // Tuxedo
      pants: 468,     // Pinstripe Pants
      feet: 78,       // Patent Leather Shoes
      face: 34,       // Shades
      back: 1206,     // Devil Wings
    },
    dialoguePool: [
      "Bet 50 WL on RED!",
      "Bet 100 WL on BLACK this time!",
      "Spin it host! Let's go!",
      "Double or nothing! I feel lucky today!",
      "GG! Rematch next round!",
      "Haha winner winner chicken dinner!",
    ],
  },
  {
    name: "LuckyBoyz",
    role: PLAYER_ROLE.BASIC,
    level: 42,
    gems: 80000,
    country: "ph",
    behavior: "casino_gambler",
    worldName: "CASINO",
    skinColor: 0xffe4c4ff,
    clothes: {
      mask: 70,       // Spikey Hair
      shirt: 304,     // Tie Dyed Shirt
      pants: 48,      // Jeans
      feet: 496,      // Air Robinsons
      face: 1590,     // 3D Glasses
      back: 818,      // Ripper Wings
    },
    dialoguePool: [
      "Bet 10 WL on Green 0!",
      "Aww lost again, one more round!",
      "Host is 100% legit, no scam!",
      "EZ win boys! Who's next?",
      "Rolling high tonight!",
    ],
  },

  // ---------------------------------------------------------------------------
  // TRADE World (High-End Trading & Vending)
  // ---------------------------------------------------------------------------
  {
    name: "DL_Whale",
    role: PLAYER_ROLE.SUPPORTER,
    level: 88,
    gems: 2500000,
    country: "sg",
    behavior: "trader",
    worldName: "TRADE",
    skinColor: 0xffffff80,
    clothes: {
      hair: 66,       // Top Hat
      shirt: 38,      // Tuxedo
      pants: 76,      // Black Pants
      feet: 1940,     // Diamond Rocket Shoes
      face: 146,      // Gold-Rimmed Glasses
      back: 1460,     // Golden Angel Wings
      hand: 1438,     // Golden Pickaxe
    },
    dialoguePool: [
      "B> Magplant 80 Diamond Locks! Fast deal!",
      "S> Rayman Fist 450 DL offer /trade me!",
      "Check vending machine stock on top platform!",
      "Buying all Golden Ances / Legendary items!",
      "Fair trades only, trade me to negotiate!",
    ],
  },
];
