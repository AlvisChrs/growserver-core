import { PLAYER_ROLE } from "../../constants";
import type { BotConfig } from "./bot-player";

/**
 * Pre-configured bot roster deployed across various social, farm, casino, and trade worlds.
 * All bots run as regular players (PLAYER_ROLE.BASIC) with authentic attire and lively behaviors.
 */
export const DEFAULT_BOT_ROSTER: BotConfig[] = [
  // ---------------------------------------------------------------------------
  // START World (Social hub & welcoming community)
  // ---------------------------------------------------------------------------
  {
    name: "HamumuFan",
    role: PLAYER_ROLE.BASIC,
    level: 54,
    gems: 120000,
    country: "us",
    behavior: "social",
    worldName: "START",
    targetTileX: 42,
    targetTileY: 23,
    minTileX: 28,
    maxTileX: 58,
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
    targetTileX: 62,
    targetTileY: 23,
    minTileX: 50,
    maxTileX: 78,
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
    targetTileX: 30,
    targetTileY: 23,
    minTileX: 18,
    maxTileX: 44,
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
  {
    name: "ParkourPro_GT",
    role: PLAYER_ROLE.BASIC,
    level: 45,
    gems: 60000,
    country: "ca",
    behavior: "social",
    worldName: "START",
    targetTileX: 78,
    targetTileY: 23,
    minTileX: 65,
    maxTileX: 92,
    skinColor: 0xd8b598ff,
    clothes: {
      mask: 70,       // Spikey Hair
      shirt: 36,      // Green Shirt
      pants: 76,      // Black Pants
      feet: 1940,     // Diamond Rocket Shoes
      back: 156,      // Fairy Wings
    },
    dialoguePool: [
      "Check out this jump! 3-tile gap easy!",
      "Parkour is the ultimate test of skill!",
      "Jump, jump, slide! Smooth landing!",
      "Can anyone beat my world record speedrun?",
      "Practice makes perfect in Growtopia!",
    ],
  },
  {
    name: "ChattyCathy",
    role: PLAYER_ROLE.BASIC,
    level: 32,
    gems: 38000,
    country: "uk",
    behavior: "social",
    worldName: "START",
    targetTileX: 52,
    targetTileY: 23,
    minTileX: 38,
    maxTileX: 66,
    skinColor: 0xffe0bdff,
    clothes: {
      hair: 212,      // Froghat
      shirt: 304,     // Tie Dyed Shirt
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
      face: 146,      // Gold-Rimmed Glasses
    },
    dialoguePool: [
      "Hi everyone! Having a lovely day?",
      "The community here is so friendly! <3",
      "Don't forget to eat and drink water while gaming!",
      "I love exploring all the creative worlds here!",
      "Has anyone visited /warp trade today?",
    ],
  },
  {
    name: "RetroGrower",
    role: PLAYER_ROLE.BASIC,
    level: 67,
    gems: 280000,
    country: "us",
    behavior: "social",
    worldName: "START",
    targetTileX: 20,
    targetTileY: 23,
    minTileX: 8,
    maxTileX: 34,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 66,       // Top Hat
      shirt: 38,      // Tuxedo
      pants: 468,     // Pinstripe Pants
      feet: 78,       // Patent Leather Shoes
      hand: 2866,     // Wizard's Staff
    },
    dialoguePool: [
      "Ah, the good old days of Growtopia...",
      "Simplicity is the true art of world building.",
      "A golden pickaxe and a smile is all you need.",
      "Always respect the server rules and moderators!",
      "Patience turns dirt seeds into diamond locks.",
    ],
  },
  {
    name: "NoobGrower_01",
    role: PLAYER_ROLE.BASIC,
    level: 7,
    gems: 4500,
    country: "id",
    behavior: "social",
    worldName: "START",
    targetTileX: 36,
    targetTileY: 23,
    minTileX: 25,
    maxTileX: 48,
    skinColor: 0xffdfd3ff,
    clothes: {
      shirt: 4,       // White Shirt
      pants: 6,       // Blue Jeans
      feet: 40,       // Brown Shoes
    },
    dialoguePool: [
      "Can anyone teach me how to splice dirt seed and rock seed?",
      "How do people get Diamond Locks so fast?!",
      "Is this world safe from drop games?",
      "Anyone want to be my friend? Type /friend NoobGrower_01!",
      "I just started today, this server is so cool!",
    ],
  },
  {
    name: "FashionIcon_GT",
    role: PLAYER_ROLE.BASIC,
    level: 63,
    gems: 340000,
    country: "fr",
    behavior: "social",
    worldName: "START",
    targetTileX: 72,
    targetTileY: 23,
    minTileX: 58,
    maxTileX: 86,
    skinColor: 0xffe4b5ff,
    clothes: {
      hair: 66,       // Top Hat
      shirt: 38,      // Tuxedo
      pants: 76,      // Black Pants
      feet: 496,      // Air Robinsons
      face: 34,       // Shades
      back: 362,      // Angel Wings
    },
    dialoguePool: [
      "Style is everything! What do you think of my set?",
      "Matching wings with shoes is an art form!",
      "Looking fabulous is half the battle in GT!",
      "Don't just farm, dress to impress!",
    ],
  },
  {
    name: "CasualWalker_GT",
    role: PLAYER_ROLE.BASIC,
    level: 38,
    gems: 52000,
    country: "id",
    behavior: "wanderer",
    worldName: "START",
    targetTileX: 35,
    targetTileY: 23,
    minTileX: 20,
    maxTileX: 65,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 46,       // Baseball Cap
      shirt: 36,      // Green Shirt
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
    },
    dialoguePool: [
      "Just taking a nice stroll around START~",
      "I love exploring every corner of Growtopia!",
      "Such a peaceful day for a walk!",
      "Nice scenery here! Good job to the world builders!",
      "Walking around keeps my character active! :D",
    ],
  },
  {
    name: "WorldExplorer_99",
    role: PLAYER_ROLE.BASIC,
    level: 56,
    gems: 175000,
    country: "us",
    behavior: "wanderer",
    worldName: "START",
    targetTileX: 65,
    targetTileY: 23,
    minTileX: 45,
    maxTileX: 88,
    skinColor: 0xffe0bdff,
    clothes: {
      hair: 890,      // Straw Hat
      shirt: 304,     // Tie Dyed Shirt
      pants: 76,      // Black Pants
      feet: 496,      // Air Robinsons
      back: 156,      // Fairy Wings
      face: 34,       // Shades
    },
    dialoguePool: [
      "Exploring new horizons every single day!",
      "Always checking what secrets worlds have to offer.",
      "Remember to take breaks and stretch while gaming!",
      "On a quest to visit every world in the server!",
      "Strolling around, enjoying the good server vibes!",
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
    targetTileX: 25,
    targetTileY: 23,
    minTileX: 12,
    maxTileX: 42,
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
    targetTileX: 62,
    targetTileY: 23,
    minTileX: 48,
    maxTileX: 76,
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
  {
    name: "L-Grid_Grinder",
    role: PLAYER_ROLE.BASIC,
    level: 56,
    gems: 420000,
    country: "ph",
    behavior: "farmer",
    worldName: "FARM",
    targetTileX: 42,
    targetTileY: 23,
    minTileX: 28,
    maxTileX: 58,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 46,       // Baseball Cap
      shirt: 892,     // Overalls
      pants: 48,      // Jeans
      feet: 42,       // Boots
      hand: 98,       // Pickaxe
    },
    dialoguePool: [
      "Laser Grid is peak efficiency! 4 hits to break!",
      "Seed count increased by 15% this harvest cycle!",
      "Don't forget your fuel packs for faster tractor speed!",
      "Breaking, collecting, planting... repeat for profit!",
      "Gotta keep that rhythm going!",
    ],
  },
  {
    name: "SeedSupplier",
    role: PLAYER_ROLE.BASIC,
    level: 40,
    gems: 150000,
    country: "id",
    behavior: "farmer",
    worldName: "FARM",
    targetTileX: 80,
    targetTileY: 23,
    minTileX: 68,
    maxTileX: 92,
    skinColor: 0xffdfd3ff,
    clothes: {
      hair: 890,      // Straw Hat
      shirt: 36,      // Green Shirt
      pants: 76,      // Black Pants
      feet: 40,       // Brown Shoes
    },
    dialoguePool: [
      "Selling fresh farmable seeds! Bulk discounts available!",
      "Clean seeds, 100% genuine harvest!",
      "Stock up before the next harvest festival!",
      "PM me if you need 1,000+ seeds delivered!",
    ],
  },
  {
    name: "FarmStroller",
    role: PLAYER_ROLE.BASIC,
    level: 42,
    gems: 68000,
    country: "id",
    behavior: "wanderer",
    worldName: "FARM",
    targetTileX: 45,
    targetTileY: 23,
    minTileX: 20,
    maxTileX: 70,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 890,      // Straw Hat
      shirt: 892,     // Overalls
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
    },
    dialoguePool: [
      "The smell of fresh soil and growing crops is the best!",
      "Admiring the beautiful farm fields!",
      "Hard work truly pays off in Growtopia!",
      "Just taking a stroll through the plantation!",
      "Seeing everyone farm together brings back great memories!",
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
    targetTileX: 50,
    targetTileY: 23,
    minTileX: 48,
    maxTileX: 52,
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
    role: PLAYER_ROLE.BASIC,
    level: 68,
    gems: 500000,
    country: "id",
    behavior: "casino_gambler",
    worldName: "CASINO",
    targetTileX: 46,
    targetTileY: 23,
    minTileX: 42,
    maxTileX: 49,
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
    targetTileX: 54,
    targetTileY: 23,
    minTileX: 51,
    maxTileX: 58,
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
  {
    name: "BetMaximus",
    role: PLAYER_ROLE.BASIC,
    level: 70,
    gems: 750000,
    country: "de",
    behavior: "casino_gambler",
    worldName: "CASINO",
    targetTileX: 43,
    targetTileY: 23,
    minTileX: 38,
    maxTileX: 47,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 66,       // Top Hat
      shirt: 38,      // Tuxedo
      pants: 76,      // Black Pants
      feet: 1940,     // Diamond Rocket Shoes
      back: 1460,     // Golden Angel Wings
    },
    dialoguePool: [
      "Putting 5 Diamond Locks on RED!",
      "Fortune favors the bold!",
      "Big stakes, big thrills!",
      "Let's see that wheel spin!",
      "The house always entertains!",
    ],
  },
  {
    name: "UnluckySam",
    role: PLAYER_ROLE.BASIC,
    level: 28,
    gems: 15000,
    country: "us",
    behavior: "casino_gambler",
    worldName: "CASINO",
    targetTileX: 57,
    targetTileY: 23,
    minTileX: 53,
    maxTileX: 64,
    skinColor: 0xffe0bdff,
    clothes: {
      hair: 890,      // Straw Hat
      shirt: 892,     // Overalls
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
    },
    dialoguePool: [
      "Why does it always land on the other color?! :')",
      "Just 1 World Lock left... this is the one!",
      "My luck has gotta turn around soon, right?",
      "Can I get a lucky coin or something? Haha!",
      "One day I'll win big, just you wait!",
    ],
  },
  {
    name: "RouletteQueen",
    role: PLAYER_ROLE.BASIC,
    level: 64,
    gems: 620000,
    country: "ph",
    behavior: "casino_gambler",
    worldName: "CASINO",
    targetTileX: 53,
    targetTileY: 23,
    minTileX: 47,
    maxTileX: 60,
    skinColor: 0xffe0bdff,
    clothes: {
      hair: 462,      // Fedora
      shirt: 304,     // Tie Dyed Shirt
      pants: 48,      // Jeans
      feet: 1940,     // Diamond Rocket Shoes
      back: 156,      // Fairy Wings
    },
    dialoguePool: [
      "I have a feeling RED 14 is coming up next!",
      "Always bet with confidence, never tilt!",
      "The spin of the wheel is pure adrenaline!",
      "Who's up for a friendly dice duel?!",
      "Spin that wheel, host! Make us rich!",
    ],
  },
  {
    name: "CasinoVisitor",
    role: PLAYER_ROLE.BASIC,
    level: 49,
    gems: 94000,
    country: "us",
    behavior: "wanderer",
    worldName: "CASINO",
    targetTileX: 38,
    targetTileY: 23,
    minTileX: 25,
    maxTileX: 62,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 66,       // Top Hat
      shirt: 38,      // Tuxedo
      pants: 76,      // Black Pants
      feet: 78,       // Patent Leather Shoes
      face: 34,       // Shades
    },
    dialoguePool: [
      "Just sightseeing the casino floor, no bets for me today!",
      "The lights and sounds of the roulette wheel are dazzling!",
      "Wishing the best of luck to all the high rollers!",
      "Strolling around the lobby, such an exciting atmosphere!",
    ],
  },

  // ---------------------------------------------------------------------------
  // TRADE World (High-End Trading & Vending)
  // ---------------------------------------------------------------------------
  {
    name: "DL_Whale",
    role: PLAYER_ROLE.BASIC,
    level: 88,
    gems: 2500000,
    country: "sg",
    behavior: "trader",
    worldName: "TRADE",
    targetTileX: 50,
    targetTileY: 23,
    minTileX: 46,
    maxTileX: 54,
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
  {
    name: "RareBuyer_88",
    role: PLAYER_ROLE.BASIC,
    level: 59,
    gems: 890000,
    country: "my",
    behavior: "trader",
    worldName: "TRADE",
    targetTileX: 32,
    targetTileY: 23,
    minTileX: 20,
    maxTileX: 44,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 462,      // Fedora
      shirt: 38,      // Tuxedo
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
      face: 34,       // Shades
      back: 362,      // Angel Wings
    },
    dialoguePool: [
      "Buying rare wings & dragon items! PM price!",
      "Looking for trade deals, instant cash!",
      "Legit trader, fast and honest!",
      "Drop by my vending shop for great bargains!",
    ],
  },
  {
    name: "VendingKing",
    role: PLAYER_ROLE.BASIC,
    level: 51,
    gems: 320000,
    country: "id",
    behavior: "trader",
    worldName: "TRADE",
    targetTileX: 68,
    targetTileY: 23,
    minTileX: 56,
    maxTileX: 82,
    skinColor: 0xffe4b5ff,
    clothes: {
      hair: 46,       // Baseball Cap
      shirt: 304,     // Tie Dyed Shirt
      pants: 76,      // Black Pants
      feet: 496,      // Air Robinsons
      hand: 98,       // Pickaxe
    },
    dialoguePool: [
      "Restocked vending machines with cheap seeds!",
      "Best prices in the whole server!",
      "Auto-buy from vend, hassle free!",
      "Check the displays for today's specials!",
    ],
  },
  {
    name: "TradeShark_SG",
    role: PLAYER_ROLE.BASIC,
    level: 82,
    gems: 1900000,
    country: "sg",
    behavior: "trader",
    worldName: "TRADE",
    targetTileX: 40,
    targetTileY: 23,
    minTileX: 28,
    maxTileX: 52,
    skinColor: 0xd8b598ff,
    clothes: {
      hair: 66,       // Top Hat
      shirt: 38,      // Tuxedo
      pants: 76,      // Black Pants
      feet: 1940,     // Diamond Rocket Shoes
      face: 34,       // Shades
      back: 1460,     // Golden Angel Wings
      hand: 98,       // Pickaxe
    },
    dialoguePool: [
      "B> WORLD LOCKS 2000 GEMS EACH! FAST DEAL!",
      "Buying rare unobtainable items, PM offers!",
      "Trade me to negotiate, cash ready in inventory!",
      "Honest trader since 2014, zero scam record!",
    ],
  },
  {
    name: "StockBroker_GT",
    role: PLAYER_ROLE.BASIC,
    level: 58,
    gems: 410000,
    country: "us",
    behavior: "trader",
    worldName: "TRADE",
    targetTileX: 60,
    targetTileY: 23,
    minTileX: 48,
    maxTileX: 74,
    skinColor: 0xffdfd3ff,
    clothes: {
      hair: 462,      // Fedora
      shirt: 304,     // Tie Dyed Shirt
      pants: 48,      // Jeans
      feet: 78,       // Patent Leather Shoes
      face: 146,      // Gold-Rimmed Glasses
    },
    dialoguePool: [
      "Market trend: Pepper Tree seeds are rising in value!",
      "Invest in farmables, passive income is king!",
      "Check the trade board for daily fluctuations!",
      "Selling farm bulk packages! PM for inquiries!",
    ],
  },
  {
    name: "WindowShopper",
    role: PLAYER_ROLE.BASIC,
    level: 36,
    gems: 48000,
    country: "uk",
    behavior: "wanderer",
    worldName: "TRADE",
    targetTileX: 52,
    targetTileY: 23,
    minTileX: 25,
    maxTileX: 78,
    skinColor: 0xffe4b5ff,
    clothes: {
      hair: 46,       // Baseball Cap
      shirt: 36,      // Green Shirt
      pants: 48,      // Jeans
      feet: 40,       // Brown Shoes
      face: 34,       // Shades
    },
    dialoguePool: [
      "Just window shopping for today's best deals!",
      "Comparing prices across all these vending machines!",
      "Maybe I'll buy a rare set if the price is right!",
      "Such a bustling marketplace, love the energy here!",
    ],
  },
];
