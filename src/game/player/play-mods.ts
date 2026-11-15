import { CHARACTER_STATE } from "../../constants";
import { Collection } from "../../utils/collection";
import { FULL_BODY_SUITS } from "./transform";
import {
  XENO_B_DOUBLE_JUMP,
  XENO_B_HIGH_JUMP,
  XENO_B_LONG_BUILD,
  XENO_B_LONG_PUNCH,
  XENO_B_SPEED,
  XENO_B_STRONG_PUNCH,
  XENO_F_DOUBLE_JUMP,
  XENO_F_HIGH_JUMP,
  XENO_F_LONG_BUILD,
  XENO_F_LONG_PUNCH,
  XENO_F_SPEED,
  XENO_F_STRONG_PUNCH,
} from "../world/constants";
import type { XenoniteSettings } from "../world/types";

/**
 * A play mod: a temporary or wearable modifier of the avatar. Wearable mods
 * are granted by the items in `items` while they are worn; timed mods are
 * granted by consumables for `duration` seconds (0 = until removed).
 * Modelled after the official play mod list (names and messages match the
 * real game).
 */
export interface PlayModDef {
  id: string;
  name: string;
  /** Item drawn next to the name in the profile. */
  displayItem: number;
  addMessage: string;
  removeMessage: string;
  /** Seconds the mod lasts; 0 lasts until it is removed. */
  duration: number;
  /** Items that grant the mod while worn. */
  items: number[];
  charState: number;
  /** Multiplied into the skin color, as `[r, g, b, a]` 0..255. */
  skinColor?: [number, number, number, number];
  /** Added to the base movement speed. */
  speed?: number;
  /** Replaces the base gravity. */
  gravity?: number;
  /** Added to the base punch knockback. */
  punchPower?: number;
  /** Added to the base block damage per punch. */
  punchDamage?: number;
  /** Punch effect id. */
  punchType?: number;
  buildRange?: number;
  punchRange?: number;
  /** Sound played to the player when the mod is added. */
  sound?: string;
}

type ModInput = Omit<PlayModDef, "duration" | "items" | "charState"> & Partial<Pick<PlayModDef, "duration" | "items" | "charState">>;

function mod(input: ModInput): PlayModDef {
  return { duration: 0, items: [], charState: 0, ...input };
}

/**
 * All mobility back-slot items (wings, capes, jetpacks, auras, spirits, gliders)
 * that grant Double Jump in Growtopia.
 */
export const ALL_MOBILITY_BACK_ITEMS: readonly number[] = [
  156, 160, 350, 362, 678, 736, 818, 1166, 1206, 1460, 1550, 1574, 1672, 1674, 1738, 1762, 1784, 1824, 1934, 1936,
  1938, 1960, 1970, 2050, 2158, 2160, 2162, 2164, 2166, 2168, 2254, 2256, 2258, 2260, 2262, 2264, 2390, 2392, 2438, 2538,
  2642, 2722, 2778, 2982, 3104, 3112, 3114, 3120, 3134, 3144, 3512, 3858, 4156, 4534, 4880, 4970, 4972, 4986, 5020, 5206,
  5738, 5754, 6004, 6144, 6284, 6334, 6694, 6758, 6818, 6842, 7084, 7104, 7150, 7196, 7204, 7214, 7304, 7412, 7502, 7582,
  7734, 7834, 7910, 7914, 7916, 8024, 8026, 8194, 8286, 8302, 8308, 8552, 8576, 8578, 8580, 8582, 8620, 8862, 8914, 9006,
  9064, 9088, 9094, 9114, 9182, 9190, 9210, 9320, 9322, 9352, 9394, 9408, 9422, 9428, 9446, 9610, 9712, 9760, 10054, 10168,
  10170, 10172, 10178, 10180, 10182, 10184, 10188, 10210, 10332, 10338, 10424, 10500, 10502, 10644, 10684, 10718, 10726, 10772, 10806, 10892,
  11016, 11050, 11238, 11288, 11290, 11294, 11300, 11350, 11352, 11386, 11462, 11478, 11482, 11504, 11510, 11544, 11588, 11660, 11662, 11664,
  11666, 11766, 11790, 11870, 11992, 12174, 12234, 12306, 12354, 12376, 12406, 12414, 12634, 12638, 12640, 12842, 12848, 12856, 12892, 12996,
  13002, 13062, 13106, 13108, 13140, 13198, 13228, 13266, 13372, 13408, 13418, 13432, 13434, 13458, 13460, 13608, 13680, 13692, 13714, 13836,
  13838, 13840, 13938, 13968, 14004, 14006, 14016, 14086, 14218, 14232, 14234, 14390, 14506, 14550, 14552, 14566, 14596, 14604, 14632, 14694,
  14722, 14756, 14800, 14836, 14866, 14990, 14992, 15104, 15106, 15196, 15230, 15380, 15392, 15416, 15460, 15466, 15548, 15550, 15654, 15780,
  15800, 15826, 15850, 15890, 15944, 15946, 15970, 15980, 15982, 15984, 16012, 16134, 16216, 16218, 16262, 16316, 16360, 16444,
];

/** Every play mod the server knows, keyed by id. */
export const PLAY_MODS: Collection<string, PlayModDef> = new Collection();

for (const def of [
  // --- wearable ------------------------------------------------------------
  mod({ id: "ninja_stealth", name: "Ninja Stealth", displayItem: 290, addMessage: "Silent, invisible, deadly.", removeMessage: "You are less sneaky now.", skinColor: [100, 100, 100, 150], items: [290] }),
  mod({
    id: "double_jump",
    name: "Double Jump",
    displayItem: 156,
    addMessage: "You can jump in mid-air!  It's like flying, but less.",
    removeMessage: "Gravity - it's the law.",
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [...ALL_MOBILITY_BACK_ITEMS],
  }),
  mod({
    id: "golden_angel_float",
    name: "Golden Flight",
    displayItem: 1460,
    addMessage: "`6Blessed wings lift your spirit with gentle floating!``",
    removeMessage: "You settle back to Earth.",
    gravity: 600,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [1460],
  }),
  mod({
    id: "davinci_glider",
    name: "Da Vinci Glider",
    displayItem: 8286,
    addMessage: "`3Genius engineering allows smooth gliding!``",
    removeMessage: "Gliding wings tucked away.",
    gravity: 500,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [8286],
  }),
  mod({
    id: "phoenix_flame",
    name: "Phoenix Ascendance",
    displayItem: 1674,
    addMessage: "`4From the ashes! Fiery wings grant power and agility!``",
    removeMessage: "The embers cool down.",
    speed: 60,
    punchType: 19,
    punchPower: 250,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [1674],
  }),
  mod({
    id: "rainbow_wings",
    name: "Rainbow Wings",
    displayItem: 1672,
    addMessage: "`oRainbow colors radiate beneath your wings!``",
    removeMessage: "The rainbow fades.",
    speed: 80,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [1672],
  }),
  mod({
    id: "rift_cape",
    name: "Rift in Time",
    displayItem: 10424,
    addMessage: "`5A rift in time, here I come! Dimensional energies surround you.``",
    removeMessage: "Dimensional anomaly stabilized.",
    speed: 80,
    punchPower: 250,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [10424],
  }),
  mod({
    id: "rift_wings",
    name: "Dimensional Rift",
    displayItem: 11478,
    addMessage: "`5Cosmic rift wings flutter through dimensional spacetime!``",
    removeMessage: "Rift wings rested.",
    speed: 100,
    punchPower: 300,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [11478],
  }),
  mod({ id: "the_one_ring", name: "The One Ring", displayItem: 1904, addMessage: "No one will take your precious!", removeMessage: "I guess someone took your precious.", charState: CHARACTER_STATE.IS_INVISIBLE, items: [1904] }),
  mod({ id: "legendary", name: "Legendary!", displayItem: 1782, addMessage: "You should be very very nice to your pet.", removeMessage: "You feel lonely.", punchPower: 300, punchDamage: 4, punchType: 21, items: [1782] }),
  mod({ id: "speedy", name: "Speedy", displayItem: 496, addMessage: "You can move faster!", removeMessage: "You are slow again.", speed: 60, items: [496, 1822, 1940] }),
  mod({ id: "carrying_a_torch", name: "Carrying a Torch", displayItem: 3578, addMessage: "I'm attacking the darkness!", removeMessage: "My torch went out.", items: [3578] }),
  mod({ id: "energized_horn", name: "Energized Horn", displayItem: 4746, addMessage: "You shoot lightning from your horn(s)!", removeMessage: "Tired of tooting your own horn?", punchType: 75, buildRange: 1, items: [4746, 4748, 4750] }),
  mod({ id: "fire_hose", name: "Fire Hose", displayItem: 3066, addMessage: "Where does the water come from?", removeMessage: "Guess you finally ran out of water.", punchType: 57, punchRange: 1, punchPower: 300, items: [3066] }),
  mod({ id: "focused_eyes", name: "Focused Eyes", displayItem: 1204, addMessage: "Give people the evil eye.", removeMessage: "Your vision is normal.", punchType: 10, items: [1204] }),
  mod({ id: "putt_putt_putt", name: "Putt Putt Putt", displayItem: 898, addMessage: "Tractors are not speedy.", removeMessage: "You can walk faster than that thing!", speed: -100, items: [898, 1830, 1966] }),
  mod({ id: "hunting_ghosts", name: "Hunting Ghosts", displayItem: 3716, addMessage: "You fire Neutron Beams (requires Neutron Pack to work).", removeMessage: "You're afraid of a ghost.", punchType: 69, punchRange: 2, items: [3716] }),
  mod({ id: "geiger_counter", name: "Geiger Counter", displayItem: 2204, addMessage: "You are detecting radiation...", removeMessage: "Geiger Counter removed.", items: [2204] }),
  mod({ id: "slasher", name: "Slasher", displayItem: 3466, addMessage: "You can slash with your blade!", removeMessage: "You put your blade away.", punchType: 29, items: [3466, 4506] }),
  mod({
    id: "hero_suit",
    name: "Hero Instincts",
    displayItem: 11560,
    addMessage: "You feel the instincts of a legendary hero!",
    removeMessage: "You stepped down from hero duty.",
    speed: 100,
    punchPower: 250,
    punchRange: 1,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    items: [
      ...FULL_BODY_SUITS,
      7080, 7082, 7084, 7086, 7088, 7090, 7094, // Ezio Assassin Brotherhood Set
      350, // Heroman Cape
      2098, 2100, 2102, 2104, 2106, 2108, // Heroic Tights
      2122, 2124, 2126, 2128, 2130, 2132, // Heroic Boots
      2134, 2136, 2138, 2140, 2142, 2144, // Superhero Masks
      2170, 2172, 2174, 2176, 2178, 2180, // Superheroine Tops
    ],
  }),
  mod({
    id: "growformer_speed",
    name: "Speedy: Go-Go!",
    displayItem: 7384,
    addMessage: "Go-Go-Growformer activated!",
    removeMessage: "Go-Go-Growformer deactivated.",
    speed: 100,
    items: [7384],
  }),
  mod({
    id: "nekorei_charm",
    name: "NekoRei's Feline Charm",
    displayItem: 8030,
    addMessage: "Nyaa~ You feel the playful feline spirit of NekoRei's companion!",
    removeMessage: "The feline companion takes a cozy catnap.",
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    speed: 80,
    sound: "audio/change_clothes.wav",
    items: [8030, 8032],
  }),
  mod({
    id: "raymans_fist",
    name: "Rayman's Fist",
    displayItem: 5480,
    addMessage: "You punch with legendary disembodied fists!",
    removeMessage: "Your fists returned to normal.",
    punchType: 80,
    punchPower: 300,
    punchRange: 2,
    items: [5480, 5980],
  }),
  mod({
    id: "death_ray",
    name: "Death Ray",
    displayItem: 1958,
    addMessage: "High-energy laser projector charged!",
    removeMessage: "Laser weapon powered down.",
    punchType: 8,
    punchRange: 1,
    items: [1958, 1956, 2056],
  }),
  mod({
    id: "dragon_hand",
    name: "Dragon Hand",
    displayItem: 900,
    addMessage: "Incinerate blocks with your pet dragon!",
    removeMessage: "The dragon rests.",
    punchType: 6,
    punchPower: 300,
    punchDamage: 2,
    items: [900],
  }),
  mod({
    id: "cyclopean_visor",
    name: "Cyclopean Visor",
    displayItem: 452,
    addMessage: "Optic blast charged!",
    removeMessage: "Optic blast powered down.",
    punchType: 1,
    items: [452],
  }),
  mod({
    id: "heart_bow",
    name: "Heart Bow",
    displayItem: 278,
    addMessage: "Love arrows ready!",
    removeMessage: "Heart bow lowered.",
    punchType: 2,
    items: [278],
  }),
  mod({
    id: "flamethrower",
    name: "Flamethrower",
    displayItem: 1038,
    addMessage: "Flamethrower ignited!",
    removeMessage: "Flame extinguished.",
    punchType: 19,
    punchPower: 250,
    items: [1038],
  }),
  mod({
    id: "pickaxe",
    name: "Mining Pickaxe",
    displayItem: 98,
    addMessage: "Mining tool equipped.",
    removeMessage: "Mining tool unequipped.",
    punchDamage: 1,
    punchPower: 150,
    items: [98],
  }),
  mod({
    id: "golden_pickaxe",
    name: "Golden Pickaxe",
    displayItem: 1438,
    addMessage: "Golden mining pickaxe equipped.",
    removeMessage: "Golden mining pickaxe unequipped.",
    punchDamage: 2,
    punchPower: 200,
    items: [1438],
  }),
  mod({
    id: "winters_breath",
    name: "Winter's Breath",
    displayItem: 1542,
    addMessage: "Freezing blizzard punch active!",
    removeMessage: "Winter's chill faded.",
    punchPower: 200,
    items: [1542],
  }),
  mod({ id: "ring_of_force", name: "Ring of Force", displayItem: 1874, addMessage: "Pure kinetic force empowers your strikes!", removeMessage: "Force fades.", punchType: 24, punchPower: 350, items: [1874] }),
  mod({ id: "ring_of_winds", name: "Ring of Winds", displayItem: 1876, addMessage: "The wind is beneath your wings!", removeMessage: "The breeze stills.", speed: 60, items: [1876] }),
  mod({ id: "fistful_of_rings", name: "Fistful of Rings", displayItem: 1932, addMessage: "Fistful of power!", removeMessage: "Rings lowered.", punchPower: 200, items: [1932] }),
  mod({ id: "gemini_ring", name: "Gemini Ring", displayItem: 1986, addMessage: "Twinned resonance active!", removeMessage: "Resonance fades.", items: [1986] }),
  mod({ id: "ring_of_wisdom", name: "Ring of Wisdom", displayItem: 1996, addMessage: "Ancient wisdom guides you.", removeMessage: "Wisdom fades.", items: [1996] }),
  mod({ id: "ring_of_water", name: "Ring of Water", displayItem: 2970, addMessage: "Aquatic grace surrounds you.", removeMessage: "Water recedes.", items: [2970] }),
  mod({ id: "ring_of_savings", name: "Ring of Savings", displayItem: 3140, addMessage: "Wealth aura empowers you.", removeMessage: "Aura fades.", items: [3140] }),
  mod({ id: "ring_of_smithing", name: "Ring of Smithing", displayItem: 3174, addMessage: "Forge power radiates from you.", removeMessage: "Forge cools.", punchPower: 200, items: [3174] }),
  mod({ id: "ring_of_shrinking", name: "Ring of Shrinking", displayItem: 6028, addMessage: "Dimensional compression engaged!", removeMessage: "Expanded to normal size.", items: [6028] }),
  mod({ id: "ring_of_nature", name: "Ring of Nature", displayItem: 6846, addMessage: "Verdant life surges around you!", removeMessage: "Nature rests.", items: [6846] }),
  mod({ id: "ring_of_night", name: "Ring of Night", displayItem: 8962, addMessage: "Shadows envelop your strikes!", removeMessage: "Dawn breaks.", items: [8962] }),
  mod({ id: "ring_of_range", name: "Ring of Range", displayItem: 11094, addMessage: "Extended reaching strikes active!", removeMessage: "Reach normalizes.", punchRange: 2, items: [11094] }),
  mod({
    id: "thunderstorm",
    name: "Thunderstorm",
    displayItem: 7184,
    addMessage: "Lightning crackles at your fingertips!",
    removeMessage: "The storm clears.",
    punchType: 88,
    items: [7184],
  }),
  mod({
    id: "celestial_lance",
    name: "Celestial Lance",
    displayItem: 9144,
    addMessage: "Celestial power surges through your strikes!",
    removeMessage: "Celestial power dissipated.",
    punchType: 112,
    items: [9144, 10578, 12886],
  }),
  mod({
    id: "legendary_katana",
    name: "Legendary Katana",
    displayItem: 2592,
    addMessage: "`#You unsheath the Legendary Katana! Slice and dice!``",
    removeMessage: "`#The Legendary Katana returns to its scabbard.``",
    punchType: 43,
    speed: 100,
    punchPower: 350,
    punchDamage: 3,
    punchRange: 1,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    sound: "audio/sword_clash.wav",
    items: [2592],
  }),
  mod({
    id: "cursed_katana",
    name: "Cursed Katana",
    displayItem: 9058,
    addMessage: "`4Dark energy envelops your blade!``",
    removeMessage: "The dark energy recedes.",
    punchType: 29,
    speed: 60,
    punchPower: 300,
    punchDamage: 2,
    sound: "audio/punch_cursed.wav",
    items: [9058],
  }),
  mod({
    id: "sonic_buster_katana",
    name: "Sonic Buster Katana",
    displayItem: 11118,
    addMessage: "`eSonic waves vibrate through your blade!``",
    removeMessage: "Sonic vibration subsides.",
    punchType: 75,
    speed: 120,
    punchPower: 350,
    punchDamage: 3,
    sound: "audio/fireball.wav",
    items: [11118],
  }),
  mod({
    id: "dark_magic_katana",
    name: "Dark Magic Katana",
    displayItem: 13710,
    addMessage: "`5Arcane shadow pulses through your blade!``",
    removeMessage: "Arcane energy fades.",
    punchType: 112,
    speed: 80,
    punchPower: 320,
    punchDamage: 2,
    sound: "audio/magic_hit.wav",
    items: [13710],
  }),
  mod({
    id: "immortal_sonic_buster_katana",
    name: "Immortal Sonic Buster Katana",
    displayItem: 16428,
    addMessage: "`#Immortal sonic blast resonates across your strikes!``",
    removeMessage: "Immortal resonance quiets.",
    punchType: 43,
    speed: 140,
    punchPower: 400,
    punchDamage: 4,
    charState: CHARACTER_STATE.DOUBLE_JUMP,
    sound: "audio/hitman.wav",
    items: [16428],
  }),
  mod({
    id: "transformed",
    name: "Transform Mode",
    displayItem: 7384,
    addMessage: "Growformer, Roll Out!",
    removeMessage: "Powering down...",
    speed: 250,
    punchType: 20,
    charState: CHARACTER_STATE.DOUBLE_JUMP | CHARACTER_STATE.NO_BODY | CHARACTER_STATE.NO_HANDS,
  }),

  // --- world-driven ------------------------------------------------------------
  // granted while a Xenonite Crystal is placed in the world; its masks, not the
  // mod itself, carry the force/block state (see applyXenonite)
  mod({ id: "xenonite", name: "Xenonite", displayItem: 2072, addMessage: "", removeMessage: "" }),

  // --- timed (consumables) -------------------------------------------------
  mod({ id: "feelin_blue", name: "Feelin' Blue", displayItem: 196, addMessage: "A `!blueberry`` slides down your throat!", removeMessage: "The effects of the `!blueberry`` have worn off.", skinColor: [0, 0, 255, 255], duration: 3600, sound: "audio/spray.wav" }),
  mod({ id: "stinky", name: "Stinky", displayItem: 372, addMessage: "You really really smell.", removeMessage: "The air clears.", charState: CHARACTER_STATE.HAVE_CIGAR, duration: 300, sound: "audio/spray.wav" }),
  mod({ id: "frozen", name: "Frozen", displayItem: 1368, addMessage: "Your body has turned to ice. You can't move!", removeMessage: "You've thawed out.", charState: CHARACTER_STATE.IS_FROZEN, skinColor: [100, 200, 255, 255], duration: 2, sound: "audio/freeze.wav" }),
  mod({ id: "egged", name: "Egged!", displayItem: 874, addMessage: "You have egg on your face.", removeMessage: "You washed your face!", charState: CHARACTER_STATE.IS_EGGED, skinColor: [255, 221, 0, 255], duration: 180 }),
  mod({ id: "muddy", name: "Muddy", displayItem: 368, addMessage: "You've been splattered with mud!", removeMessage: "Clean again!", skinColor: [101, 67, 33, 255], speed: -200, gravity: 900, duration: 3, sound: "audio/splat.wav" }),
  mod({ id: "irradiated", name: "Irradiated", displayItem: 2206, addMessage: "You are aglow with radiation!", removeMessage: "You have recovered.", charState: CHARACTER_STATE.HAVE_GEIGER_RADIATION, duration: 1800 }),
  mod({ id: "duct_tape", name: "Duct Tape", displayItem: 408, addMessage: "Duct tape has covered your mouth!", removeMessage: "Duct tape removed. OUCH!", charState: CHARACTER_STATE.IS_DUCTAPED, duration: 600, sound: "audio/already_used.wav" }),
  mod({ id: "valentine", name: "Valentine", displayItem: 384, addMessage: "You are somebody's valentine!", removeMessage: "Yuck!", skinColor: [255, 150, 200, 255], duration: 3600, sound: "audio/choir.wav" }),
  mod({ id: "lucky", name: "Lucky", displayItem: 528, addMessage: "You're luckier than before!", removeMessage: "Your luck has worn off.", charState: CHARACTER_STATE.IS_SHINING, duration: 1800 }),
  mod({ id: "envious", name: "Envious", displayItem: 540, addMessage: "It ain't easy being you.", removeMessage: "Healthy color restored.", skinColor: [96, 255, 96, 255], duration: 900, sound: "audio/eat.wav" }),
  mod({ id: "floating", name: "Floating!", displayItem: 338, addMessage: "Whoooooooaaaaaaaa...", removeMessage: "Gravity - it's the law.", gravity: -30, duration: 2, sound: "audio/balloon.wav" }),
  mod({ id: "saucy", name: "Saucy!", displayItem: 962, addMessage: "You are a saucy person.", removeMessage: "You got cleaned up.", skinColor: [255, 40, 40, 255], duration: 180 }),
  mod({ id: "antidote", name: "Antidote!", displayItem: 782, addMessage: "You are now immune to zombie bites! Temporarily...", removeMessage: "Your immunity is gone.", duration: 3600 }),
  mod({ id: "golden_halo", name: "Golden Halo!", displayItem: 128, addMessage: "You have been good.", removeMessage: "You're falling out of favor.", charState: CHARACTER_STATE.GOLDEN_HALO, duration: 1800 }),
  mod({ id: "infected", name: "Infected!", displayItem: 764, addMessage: "You've been infected by the g-Virus. Punch others to infect them, too! Braiiiins...", removeMessage: "You've been cured.", charState: CHARACTER_STATE.IS_ZOMBIE, duration: 60 }),
  mod({ id: "devil_horns", name: "Devil Horns", displayItem: 126, addMessage: "You little devil...", removeMessage: "Off the naughty list!", charState: CHARACTER_STATE.DEVIL_HORNS, duration: 1800, sound: "audio/spray.wav" }),
  mod({ id: "on_fire", name: "ON FIRE!!!", displayItem: 960, addMessage: "You are burning up!", removeMessage: "The fire's out.", charState: CHARACTER_STATE.IS_HIT_BY_LAVA, duration: 5 }),
  mod({ id: "haunted", name: "Haunted!", displayItem: 1988, addMessage: "You are haunted!", removeMessage: "Not anymore.", charState: CHARACTER_STATE.HAVE_HAUNTED_SHADOWS, duration: 1800, sound: "audio/spray.wav" }),
  mod({ id: "caffeinated", name: "Caffeinated", displayItem: 1634, addMessage: "You are full of caffeine!", removeMessage: "Ugh. Caffeine crash.", speed: 100, duration: 5, sound: "audio/spray.wav" }),
  mod({ id: "blushing_red", name: "Blushing Red", displayItem: 4766, addMessage: "`4Cherry`` red lips!", removeMessage: "The effects of the `!Cherry`` have worn off.", skinColor: [255, 120, 120, 255], duration: 1800, sound: "audio/spray.wav" }),
  mod({ id: "megaphone", name: "Megaphone!", displayItem: 2480, addMessage: "Broadcasting to ALL!", removeMessage: "You can broadcast once again.", duration: 600 }),
  mod({ id: "extra_xp", name: "Food: Extra XP", displayItem: 1474, addMessage: "25% chance of double XP for all actions.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/spray.wav" }),
  mod({ id: "composer", name: "Food: Composer", displayItem: 6906, addMessage: "You can see musical notes in the world!", removeMessage: "The music fades from your eyes.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "berry_crepes", name: "Food: Berry Crepes", displayItem: 4596, addMessage: "Gain 30% more XP from Surgery!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "deep_fried_ice_cream", name: "Food: Deep-Fried Ice Cream", displayItem: 6316, addMessage: "Gain 50% more XP from Surgery!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "apple_strudel", name: "Food: Apple Strudel", displayItem: 4594, addMessage: "Trees you plant grow 5% faster!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "arroz_con_pollo", name: "Food: Arroz Con Pollo", displayItem: 4604, addMessage: "10% chance of a gem when you break a block.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "fish_and_chips", name: "Food: Fish and Chips", displayItem: 4600, addMessage: "Catch 5% larger fish!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "fish_taco", name: "Food: Fish Taco", displayItem: 4592, addMessage: "Gain 1 gem for every 5lbs. your fish catches weigh.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "pineapple_turnover", name: "Food: Pineapple Turnover", displayItem: 4768, addMessage: "Get triple XP for using consumables.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "triple_xp", name: "Food: Triple XP", displayItem: 5452, addMessage: "10% chance of triple XP for all actions.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "cooking_gas", name: "Food: Cooking on Gas!", displayItem: 10270, addMessage: "Now we are cooking on gas! (+5% Cooking Quality)", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "gluttons_gazpacho", name: "Food: Glutton's Gazpacho", displayItem: 6908, addMessage: "Increase the duration of food buffs by 30%.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "growlectables", name: "Food: Growlectables", displayItem: 6910, addMessage: "25% chance of double Growtokens from Daily Quests.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "spicey_skills", name: "Food: Spicey Skills", displayItem: 6912, addMessage: "Reduce your skill fails by half in both Surgery and Startopia missions.", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "gemonade", name: "Food: Gemonade", displayItem: 6914, addMessage: "Get extra gems from a variety of actions!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "bbq_bacon_burger", name: "Food: BBQ Bacon Burger", displayItem: 4598, addMessage: "You deal more damage in Carnage and Guild battles!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "chips_and_guac", name: "Food: Chips and Guac", displayItem: 4674, addMessage: "Gain 15% more XP from Crime Wave battles!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "guac_bueno", name: "Food: Guacamole Bueno", displayItem: 6046, addMessage: "Gain 10% more XP from Fishing and Surgery!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "guac_sabroso", name: "Food: Guacamole Sabroso", displayItem: 6048, addMessage: "Gain 20% more XP from Fishing and Surgery!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "guac_perfecto", name: "Food: Guacamole Perfecto", displayItem: 6050, addMessage: "Gain 35% more XP from Fishing and Surgery!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "coconut_tart", name: "Food: Coconut Tart", displayItem: 7056, addMessage: "You feel refreshed with tropical energy!", removeMessage: "Your stomach's rumbling.", duration: 1800, sound: "audio/eat.wav" }),
  mod({ id: "malpractice", name: "Malpractice", displayItem: 1258, addMessage: "You are not allowed to perform surgery for a while!", removeMessage: "You can perform surgery again.", duration: 3600 }),
  mod({ id: "recovering", name: "Recovering", displayItem: 1256, addMessage: "Congratulations on your successful surgery!", removeMessage: "Fully recovered from surgery.", duration: 1200 }),
]) {
  PLAY_MODS.set(def.id, def);
}

/** Play mods granted by wearing an item, keyed by item id. */
export const WEARABLE_MODS: Collection<number, PlayModDef> = new Collection();
for (const def of PLAY_MODS.values()) {
  for (const itemId of def.items) WEARABLE_MODS.set(itemId, def);
}

/** A mod currently applied to a player. */
export interface ActivePlayMod {
  id: string;
  /** Unix ms when the mod ends, 0 for wearable mods. */
  expiresAt: number;
}

/** The avatar modifiers sent with SET_CHARACTER_STATE. */
export interface CharacterStats {
  charState: number;
  punchType: number;
  buildRange: number;
  punchRange: number;
  speed: number;
  accel: number;
  gravity: number;
  punchPower: number;
  punchDamage: number;
  waterSpeed: number;
  /** `[r, g, b, a]` multiplier applied to the skin color, or undefined. */
  skinTint?: [number, number, number, number];
}

/** Defaults the client plays with when no mod is active. */
export const BASE_STATS: Readonly<CharacterStats> = {
  charState: 0,
  punchType: 0,
  buildRange: 128,
  punchRange: 128,
  speed: 1200,
  accel: 250,
  gravity: 1000,
  punchPower: 200,
  punchDamage: 6,
  waterSpeed: 125,
};

/** Formats seconds as the game does: `1h 2m 3s`. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (rest || parts.length === 0) parts.push(`${rest}s`);
  return parts.join(" ");
}

/**
 * Combines the active mods into the stats to send. Mods add to the base
 * values; the last mod that sets a punch type or gravity wins.
 */
export function computeStats(active: Iterable<ActivePlayMod>): CharacterStats {
  const stats: CharacterStats = { ...BASE_STATS };
  const tints: [number, number, number, number][] = [];

  for (const entry of active) {
    const def = PLAY_MODS.get(entry.id);
    if (!def) continue;

    stats.charState |= def.charState;
    if (def.punchType) stats.punchType = def.punchType;
    if (def.gravity !== undefined) stats.gravity = def.gravity;
    stats.speed += def.speed ?? 0;
    stats.punchPower += def.punchPower ?? 0;
    stats.punchDamage += def.punchDamage ?? 0;
    stats.buildRange += def.buildRange ?? 0;
    stats.punchRange += def.punchRange ?? 0;

    if (def.skinColor) tints.push(def.skinColor);
  }

  const tint = mixTints(tints);
  if (tint) stats.skinTint = tint;
  return stats;
}

/**
 * Averages the colors of the active effect mods, weighted by their alpha, so
 * stacked effects (egg + tomato, ...) mix instead of multiplying into black.
 * The strongest alpha is kept as the coverage over the base skin color.
 */
export function mixTints(tints: readonly (readonly [number, number, number, number])[]): [number, number, number, number] | undefined {
  let red = 0, green = 0, blue = 0, weight = 0, alpha = 0;

  for (const [r, g, b, a] of tints) {
    const coverage = a / 255;
    if (coverage <= 0) continue;
    red += r * coverage;
    green += g * coverage;
    blue += b * coverage;
    weight += coverage;
    alpha = Math.max(alpha, a);
  }

  if (weight === 0) return undefined;
  return [Math.round(red / weight), Math.round(green / weight), Math.round(blue / weight), alpha];
}

/**
 * Applies a Xenonite Crystal's force/block masks to the stats, with the same
 * clamp values as the official server. Heat resist (fire damage) and the
 * powerup block are enforced by the client from the crystal's extra data.
 */
export function applyXenonite(stats: CharacterStats, settings: XenoniteSettings): CharacterStats {
  const { flags, flags2 } = settings;
  if (!flags && !flags2) return stats;

  const restricted: CharacterStats = { ...stats };
  const force = (bit: number) => (flags & bit) !== 0;
  const block = (bit: number) => (flags & bit) !== 0;
  const force2 = (bit: number) => (flags2 & bit) !== 0;
  const block2 = (bit: number) => (flags2 & bit) !== 0;

  if (force(XENO_F_DOUBLE_JUMP)) restricted.charState |= CHARACTER_STATE.DOUBLE_JUMP;
  else if (block(XENO_B_DOUBLE_JUMP)) restricted.charState &= ~CHARACTER_STATE.DOUBLE_JUMP;

  if (force(XENO_F_HIGH_JUMP)) {
    if (700 < restricted.gravity) restricted.gravity = 700;
  } else if (block(XENO_B_HIGH_JUMP)) {
    if (restricted.gravity < BASE_STATS.gravity) restricted.gravity = BASE_STATS.gravity;
  }

  if (force(XENO_F_STRONG_PUNCH)) {
    if (restricted.punchPower < 500) restricted.punchPower = 500;
  } else if (block(XENO_B_STRONG_PUNCH)) {
    if (BASE_STATS.punchPower < restricted.punchPower) restricted.punchPower = BASE_STATS.punchPower;
  }

  if (force(XENO_F_SPEED)) {
    if (restricted.accel < 310) restricted.accel = 310;
  } else if (block(XENO_B_SPEED)) {
    if (BASE_STATS.accel < restricted.accel) restricted.accel = BASE_STATS.accel;
  }

  if (force2(XENO_F_LONG_PUNCH)) {
    if (restricted.punchRange < 128) restricted.punchRange = 130;
  } else if (block2(XENO_B_LONG_PUNCH)) {
    if (128 < restricted.punchRange) restricted.punchRange = 128;
  }

  if (force2(XENO_F_LONG_BUILD)) {
    if (restricted.buildRange < 128) restricted.buildRange = 129;
  } else if (block2(XENO_B_LONG_BUILD)) {
    if (128 < restricted.buildRange) restricted.buildRange = 128;
  }

  return restricted;
}

/** Composites an RGBA tint over the client's packed `0xBBGGRRAA` skin color. */
export function tintSkinColor(color: number, tint: [number, number, number, number] | undefined): number {
  if (!tint) return color >>> 0;
  const [red, green, blue, alpha] = tint;
  const coverage = alpha / 255;
  const channel = (shift: number, value: number) => {
    const base = (color >>> shift) & 0xff;
    return Math.round(base * (1 - coverage) + value * coverage) & 0xff;
  };
  return ((channel(24, blue) << 24) | (channel(16, green) << 16) | (channel(8, red) << 8) | (color & 0xff)) >>> 0;
}
