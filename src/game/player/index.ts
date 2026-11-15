import { Packet, PacketKind, type Peer } from "growtopia.wasm";
import { Variant, VariantHandler, type SpawnOptions } from "../packets/variants";
import { PlayerInventory, CLOTH_MAP, type ClothTypes } from "./inventory";
import { PlayerAuth } from "./auth";
import { ActionsHandler } from "../packets/actions";
import { CHARACTER_STATE, LOGON_MODE, PLAYER_ROLE, WORLD_FEATURE_FLAGS, playerRoleRank } from "../../constants";
import { logger } from "../../utils/logger";
import { PlayerDB } from "../../database/services/player-db";
import type { PlayerRecord } from "../../database/tables";
import { getItem } from "../item/item-utils";
import { getItemInfo } from "../item/item-wiki";
import type { World } from "../world/world";
import { worldManager } from "../world/world-manager";
import { ActionTypes, ITEM_ID } from "../world/constants";
import type { BlockPosition } from "../world/types";
import { PlayModController } from "./play-mod-controller";
import { applyXenonite, tintSkinColor, type CharacterStats } from "./play-mods";
import { QuestController } from "../quests/quest-state";
import type { FishingSession } from "../fishing/fishing-manager";
import type { GeigerSession } from "../geiger/geiger-manager";
import type { ActiveSurgery } from "../surgery/surgery-manager";
import { FULL_BODY_SUITS, MORPH_ITEMS, computeEffectiveClothes } from "./transform";
import { DEFAULT_RIFT_CAPE_CONFIG, DEFAULT_RIFT_WINGS_CONFIG, type RiftCapeConfig, type RiftWingsConfig } from "../item/configurable-items";

export * from "./inventory";
export * from "./transform";

/** Delay between an inventory change and the database write that persists it. */
const INVENTORY_SAVE_DEBOUNCE_MS = 1500;
/** How many recently visited worlds are remembered for the world menu. */
const MAX_RECENT_WORLDS = 6;
/** Highest reachable level. */
export const MAX_LEVEL = 125;
/** Default avatar skin color (the client's default peach tone). */
export const DEFAULT_SKIN_COLOR = 0x8295c3ff;
/** Value the login server writes for new accounts before a skin is chosen. */
const PLACEHOLDER_SKIN_COLOR = 0x80808080;

export interface PlayerStateWorld {
  name: string;
}

export interface PlayerState {
  /** Position in pixels (32 per tile). */
  x: number;
  y: number;
  status: number; // bitwise flags
  isMod: boolean;
  isMuted: boolean;
  /** Facing left (from the last STATE packet). */
  rotatedLeft: boolean;
  /** Ghost mode: immune to death and item pickup. */
  isGhost: boolean;
  /** Character modifiers sent with SET_CHARACTER_STATE. */
  characterState: number;
  world: PlayerStateWorld;
}

export enum PlayerStateFlags {
  LOGIN_REQUEST = 1 << 0,
  ENTERING_GAME = 1 << 1,
  IN_GAME = 1 << 2,
  LOGOUT = 1 << 3,
}

/** Items that can never leave the backpack. */
const PROTECTED_ITEMS: ReadonlySet<number> = new Set([ITEM_ID.FIST, ITEM_ID.WRENCH]);

/**
 * Comprehensive mapping of authentic Growtopia weapons and wearable accessories
 * to their exact visual punch animation and particle effect IDs.
 */
export const WEAPON_PUNCH_TYPES: Readonly<Record<number, number>> = {
  // Rayman's Fists & Floating Fists (80 = Disembodied floating fists)
  5480: 80,  // Rayman's Fist
  5980: 80,  // Floating Fists
  12018: 80, // Rok's Fists

  // Katanas & Japanese Blades (43 = Iconic blade slice & anime slash)
  2592: 43,  // Legendary Katana
  3838: 43,  // Dueling Katanas
  7830: 43,  // Heartsword
  7832: 43,  // Golden Heartsword
  9058: 43,  // Cursed Katana
  9116: 43,  // Red Laser Scimitar
  9118: 43,  // Green Laser Scimitar
  9120: 43,  // Blue Laser Scimitar
  9122: 43,  // Purple Laser Scimitar
  10402: 43, // Christmas Tree Sword
  11118: 43, // Sonic Buster Katana
  11298: 43, // Sakura's Revenge
  12342: 43, // Mageblade
  13710: 43, // Dark Magic Katana
  14018: 43, // Greatest Swordsman's Dual Wield
  14380: 43, // Fierce Wingman Blades
  14764: 43, // Blade of Revolt
  16428: 43, // Immortal Sonic Buster Katana

  // Scythes (13 = Reaper dark soul slash, 36 = Heavenly, 42 = Flame)
  1068: 13,  // Hand Scythe
  1484: 13,  // Atomic Shadow Scythe
  2386: 36,  // Heavenly Scythe (Heavenly heart burst slash)
  2572: 42,  // Flame Scythe (Brutal carnival flame slash)
  4166: 13,  // Death's Scythe
  6242: 13,  // Anomalizing Reliable Scythe
  6244: 13,  // Anomalizing Pristine Scythe
  6246: 13,  // Exquisite Scythe
  6928: 13,  // Anomalizing Elegant Scythe
  7098: 13,  // Apocalypse Scythe
  9032: 13,  // Scythe of the Underworld
  10498: 13, // Candy Cane Scythe
  11006: 13, // Soul Scythe
  11464: 13, // Ice Dragon Scythe
  13400: 13, // Bamboo Scythe
  13828: 13, // Soul Harvester's Scythe
  15574: 13, // Scythed Hero Scythes

  // Dragon Hands & Claws (6 = Fire breath, 11 = Ice breath, 16 = Fiesta, 21 = Legend, 32 = Crystal)
  900: 6,    // Dragon Hand
  1378: 11,  // Ice Dragon Hand
  1576: 16,  // Fiesta Dragon
  1782: 21,  // Dragon of Legend
  1998: 6,   // Skeletal Dragon Claw
  2212: 32,  // Black Crystal Dragon
  2450: 40,  // Diamond Dragon
  7752: 6,   // Gourmet Dragon Claw
  7754: 6,   // Emergency Dragon Claw
  7758: 6,   // Prehistoric Dragon Claw
  7760: 6,   // Star Dragon Claw
  9086: 6,   // Friendship Dragon Claw

  // Guns, Blasters, Heavy Weapons & Lasers
  472: 3,    // Tommygun
  768: 5,    // Sawed-Off Shotgun
  910: 7,    // Reanimator Remote
  930: 8,    // Death Ray
  1016: 9,   // Six Shooter
  1250: 7,   // Bride Of Reanimator Remote
  1676: 17,  // Squirt Gun
  1710: 18,  // Keytar
  1748: 19,  // Flamethrower
  1780: 20,  // Legendbot-009
  1958: 8,   // Death Ray (Alternate ID)
  2752: 45,  // Pineapple Launcher
  3066: 57,  // Fire Hose
  3300: 64,  // Party Blaster
  3716: 69,  // Neutron Gun / Pack
  4474: 72,  // Skull Launcher
  4840: 78,  // Balloon Launcher
  6058: 9,   // Dual Six-Shooters
  10626: 8,  // Rose Rifle
  10724: 3,  // Lil Growpeep's Baaaa Blaster
  11312: 8,  // Spider Sniper
  12014: 8,  // Dal's Phasers

  // Bows & Crossbows (4 = Arrow, 2 = Hearts, 44 = Electric)
  278: 2,    // Heart Bow
  366: 2,    // Heartbow
  594: 4,    // Elvish Longbow
  1464: 2,   // Golden Heartbow
  2720: 44,  // Electric Bow
  4136: 4,   // Heatbow
  5424: 4,   // Winter Frost Bow
  5456: 4,   // Silverstar Bow
  10052: 4,  // Eldritch Crossbow
  10130: 4,  // Sun Shooter Bow
  10670: 4,  // Bow of the Rainbow
  11380: 4,  // Black Bow of the Rainbow
  11438: 4,  // Digital Bow
  11440: 4,  // Mystic Bow
  11442: 4,  // Royal Mystic Bow
  12870: 4,  // Candy Cane Bow
  14834: 4,  // Primal Bow
  15948: 4,  // Hair Longbow

  // Tridents, Spears & Lances (49 = Poseidon's Trident, 47 = Gungnir)
  2756: 47,  // The Gungnir
  2802: 49,  // Poseidon's Trident
  4126: 49,  // Stone Spear
  5276: 49,  // Celestial Lance
  6110: 49,  // Pineapple Spear
  7434: 49,  // Poseidon's Digger's Trident
  7646: 47,  // Tyr's Spear
  7736: 49,  // Dragon Knight's Spear
  9758: 49,  // Neptune's Trident
  10578: 49, // Mystic Battle Lance
  10680: 49, // Finias' Red Javelin
  10922: 49, // Pegasus Lance
  11076: 49, // Ambu-Lance
  11120: 49, // Primordial Jade Lance
  12628: 49, // Shattered Spear
  12886: 49, // Icicle Lance
  13366: 49, // Carrot Lance
  13638: 49, // Lembuswana Trident
  14220: 49, // Rocket Lance
  14222: 49, // Royal Rocket Lance
  14258: 49, // Dual Spears of Diarmuid
  14964: 49, // Dual Obsidian Spears
  15234: 49, // Cu Chulainn's Mythical Lance

  // Staves, Wands, Rods & Magic (50 = Wizard Staff, 65 = Serpent Staff, 22 = Lightning)
  158: 50,   // Fairy Wand
  1804: 22,  // Zeus' Lightning Bolt
  1874: 24,  // Ring of Force
  1946: 25,  // Ice Calf Leash
  1956: 50,  // Chaos Cursed Wand
  2066: 31,  // Cosmic Unicorn Bracelet
  2218: 33,  // Mighty Snow Rod
  2266: 35,  // Crystal Glaive
  2754: 46,  // Demonic Arm
  2866: 50,  // Wizard's Staff
  2908: 29,  // Carrot Sword
  2910: 50,  // Emerald Staff
  3214: 60,  // Axe Of Winter
  3418: 65,  // Serpent Staff
  3466: 29,  // Slasher
  4506: 29,  // Machete
  4778: 76,  // Adventurer's Whip
  6840: 50,  // Dreamcatcher Staff
  7470: 50,  // Narwhal Tusk Staff
  7826: 50,  // Heartstaff
  7828: 50,  // Golden Heartstaff
  9410: 50,  // Radiant Doom Staff
  9738: 50,  // Staff of the Deep
  10406: 50, // Staff of Deepest Winter
  11004: 50, // Brass Staff
  11248: 50, // Staff of S'mores
  11630: 50, // Monkey Warrior's Staff
  12246: 50, // Staff of Gale
  12248: 50, // Royal Staff of Gale
  12412: 50, // Wizard's Wand
  13326: 50, // Shamrock Staff
  14092: 50, // Snowglobe Staff
  14298: 50, // Jade's Dai-Jo Staff
  15178: 50, // Bubble Wand
  15192: 50, // Good Witch's Wand
  15858: 50, // Staff of the North Star

  // Fists & Boxing Gloves
  96: 1,     // Boxing Gloves
  7940: 1,   // Flaming Boxing Gloves

  // Face: Eyes & Visors
  138: 1,    // Cyclopean Visor (Optic blast)
  452: 1,    // Cyclopean Visor / Visor alias
  1204: 10,  // Focused Eyes (Optic zap laser)
  1872: 10,  // Cybernetic Eye (Laser beam)
  2476: 39,  // Burning Eyes (Fiery flame punch)
  2976: 10,  // Cybernetic Eye
  10336: 39, // Black Burning Eyes (Dark flame punch)

  // Hair / Head: Eyes, Horns, Crowns & Wigs
  306: 14,   // Rainbow Wig (Rainbow burst)
  2780: 8,   // Medusa's Head (Petrifying gaze)
  3836: 19,  // Burning Crown (Fire strike)
  4182: 13,  // Malevolent Hair (Shadow punch)
  4456: 40,  // Diamond Horns (Diamond sparkle blast)
  4746: 75,  // Energized Horn (Horn lightning)
  4748: 75,  // Energized Horns (Horn lightning)
  4750: 75,  // Double Energized Horns (Horn lightning)
  8372: 8,   // Giant Eye Head (Baleful optic gaze)
  9034: 19,  // Horns of the Underworld (Demon flame)

  // Back: Wings & Capes
  160: 19,   // Demon Wings (Dark flame)
  350: 1,    // Heroman Cape (Heroic punch)
  1460: 40,  // Golden Angel Wings (Golden feathers)
  1672: 14,  // Rainbow Wings (Rainbow punch)
  1674: 19,  // Phoenix Wings (Fire punch)
  1784: 19,  // Dragon Wings (Fire punch)
  2168: 1,   // Superhero Cape (Heroic punch)
  7150: 40,  // Golden Angel Wings (Golden feathers)
  8286: 4,   // Da Vinci Wings (Golden spark)
  16262: 4,  // Immortal Da Vinci Wings (Golden spark)

  // Necklace & Pets
  1454: 14,  // Pet Leprechaun (Rainbows!)
  1512: 14,  // Pet Leprechaun (Rainbows!)
  1538: 14,  // Unicorn Garland (Rainbows!)
  1648: 14,  // Unicorn Garland (Rainbows!)
  1782: 21,  // Dragon of Legend (Legendary pulse)
  1874: 24,  // Ring of Force (Force burst)
  1946: 25,  // Ice Calf Leash (Frost beam)
  1968: 13,  // Death's Scarf (Dark pulse)
  2066: 31,  // Cosmic Unicorn Bracelet (Cosmic pulse)

  // Masks
  912: 6,    // Dragon Mask (Dragon fire)
  1228: 6,   // Green Dragon Mask (Dragon fire)
  2988: 13,  // Anubis Mask (Sand magic)
  7748: 6,   // Super-Dragon Mask (Dragon fire)
  8996: 13,  // Anubis Mask (Sand magic)

  // Feet
  7384: 5,   // Go-Go-Growformer! (Rocket explosion)
};

export class Player {
  /** Global unique player identifier (e.g. "server-17091:0") */
  public id: string;
  /** Database unique player ID (primary key from database) */
  public playerId: number = 0;
  /**
   * Avatar net ID inside the current world, assigned by the world on entry
   * (starting at 1). 0 means the player is not in a world; the client treats
   * 0 as "no avatar", so it must never be used for a spawned player.
   */
  public netID = 0;
  public serverLabel: string;
  public serverPort: number;
  public tankIDName = "";
  public displayName = "";
  public role: PLAYER_ROLE = PLAYER_ROLE.BASIC;
  /** Original/highest assigned role, preserved across test disguise / role changes. */
  public realRole: PLAYER_ROLE = PLAYER_ROLE.BASIC;
  public gems = 0;
  public level = 1;
  public xp = 0;
  /** Raw 32-bit skin color as sent to the client. */
  public skinColor: number = DEFAULT_SKIN_COLOR;
  /** Whether the avatar is currently transformed (vehicle/robot or morph mode). */
  public isTransformed = false;

  public variants: VariantHandler;
  public actions: ActionsHandler;
  public inventory: PlayerInventory = new PlayerInventory();
  public auth: PlayerAuth = new PlayerAuth();

  /** The world the player is in, or null while in the world menu. */
  public world: World | null = null;
  /** Checkpoint to respawn at instead of the main door. */
  public lastCheckpoint: BlockPosition | null = null;
  /** Recently visited world names, oldest first. */
  public lastVisitedWorlds: string[] = [];

  private inventorySaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether `loadFromRecord` ran; only then may this instance write to the database. */
  private recordLoaded = false;

  /** When the account was created (profile "playing since"). */
  public createdAt: Date = new Date();
  /** Seconds online before this session, from the database. */
  private savedPlaytime = 0;
  /** When this session's playtime started counting. */
  private sessionStartedAt = Date.now();
  /** Wearable and timed play mods. */
  public playMods: PlayModController = new PlayModController(this);
  /** Quest state: Crazy Jim delivery, personal points, role levels, surgery skill. */
  public quests: QuestController = new QuestController(this);
  /** Active fishing session, if currently fishing. */
  public fishing: FishingSession | null = null;
  /** Geiger counter radiation tracking state. */
  public geiger: GeigerSession | null = null;
  /** Active surgery session, if performing surgery. */
  public surgery: ActiveSurgery | null = null;
  /** World `/home` warps to, null when the player has not set one. */
  public homeWorld: string | null = null;
  /** Name of the player who last whispered to this player (for `/r`). */
  public lastWhisperFrom: string | null = null;
  /** Saved civilian clothes when /hero disguise is active. */
  public heroOriginalClothes?: PlayerClothes;
  /** Whether cosmetic /hero disguise is currently active. */
  public isHeroDisguised: boolean = false;
  /** Timestamp and coordinates of the last royal rainbow particle emitted while moving. */
  public lastRainbowAt?: number;
  public lastRainbowX?: number;
  public lastRainbowY?: number;
  /** Custom configuration for Rift Cape (#10424). */
  public riftCapeConfig?: RiftCapeConfig;
  /** Custom configuration for Rift Wings (#11478). */
  public riftWingsConfig?: RiftWingsConfig;
  /** Timestamp of the last back item particle emitted while moving. */
  public lastBackParticleAt?: number;

  public state: PlayerState = {
    x: 0,
    y: 0,
    status: 0,
    isMod: false,
    isMuted: false,
    rotatedLeft: false,
    isGhost: false,
    characterState: 0,
    world: { name: "" },
  };

  public get currentWorld(): string {
    return this.state.world.name;
  }

  /** Developer or owner: unrestricted building and developer commands. */
  public get isDeveloper(): boolean {
    return playerRoleRank(this.role) >= playerRoleRank(PLAYER_ROLE.DEVELOPER);
  }

  /** Moderator or above. */
  public get isModerator(): boolean {
    return playerRoleRank(this.role) >= playerRoleRank(PLAYER_ROLE.MODERATOR);
  }

  /** Guardian role. */
  public get isGuardian(): boolean {
    return this.role === PLAYER_ROLE.GUARDIAN;
  }

  public get isOwner(): boolean {
    return this.role === PLAYER_ROLE.OWNER;
  }

  /** Whether player has permission to switch roles (Owner/Developer). */
  public get canManageRoles(): boolean {
    return playerRoleRank(this.realRole) >= playerRoleRank(PLAYER_ROLE.DEVELOPER) ||
           playerRoleRank(this.role) >= playerRoleRank(PLAYER_ROLE.DEVELOPER);
  }

  /** Pixel coordinates convenience getters. */
  public get x(): number {
    return this.state.x;
  }

  public get y(): number {
    return this.state.y;
  }

  /** Country shown on the name tag; developers get the "rt" badge. */
  public get country(): string {
    if (this.isDeveloper) return "rt";
    return this.auth.metadata.country || "us";
  }

  constructor(
    public peer: Peer,
    serverLabel: string,
    serverPort: number,
  ) {
    this.serverLabel = serverLabel;
    this.serverPort = serverPort;
    this.id = `${serverLabel}:${peer.id}`;
    this.variants = new VariantHandler(peer);
    this.actions = new ActionsHandler(peer);
  }

  public addStateStatus(flag: PlayerStateFlags): void {
    this.state.status |= flag;
  }

  public removeStateStatus(flag: PlayerStateFlags): void {
    this.state.status &= ~flag;
  }

  public hasStateStatus(flag: PlayerStateFlags): boolean {
    return (this.state.status & flag) !== 0;
  }

  /**
   * Fills the in-memory player from its database record (role, gems, level,
   * inventory). New players get the default fist and wrench.
   */
  public loadFromRecord(record: PlayerRecord): void {
    this.recordLoaded = true;
    this.playerId = record.id;
    this.tankIDName = record.name;
    this.displayName = record.display_name || record.name;
    this.role = (record.role_id ?? PLAYER_ROLE.BASIC) as PLAYER_ROLE;
    this.realRole = this.role;
    this.gems = record.gems ?? 0;
    this.level = record.level || 1;
    this.xp = record.xp ?? 0;
    const storedSkin = (record.skin_color ?? 0) >>> 0;
    // 0 and the registration placeholder mean "never chosen"
    this.skinColor = storedSkin && storedSkin !== PLACEHOLDER_SKIN_COLOR ? storedSkin : DEFAULT_SKIN_COLOR;
    this.createdAt = record.created_at ? new Date(record.created_at.endsWith("Z") || record.created_at.includes("+") ? record.created_at : `${record.created_at.replace(" ", "T")}Z`) : new Date();
    this.savedPlaytime = record.playtime ?? 0;
    this.sessionStartedAt = Date.now();
    this.playMods.load(record.play_mods);
    this.quests.load(record.quest_data);
    this.homeWorld = record.home_world ?? null;

    if (!this.inventory.load(record.inventory)) {
      this.inventory.addItem(ITEM_ID.FIST, 1);
      this.inventory.addItem(ITEM_ID.WRENCH, 1);
    }
    // the tools can never be missing
    if (!this.inventory.hasItem(ITEM_ID.FIST)) this.inventory.addItem(ITEM_ID.FIST, 1);
    if (!this.inventory.hasItem(ITEM_ID.WRENCH)) this.inventory.addItem(ITEM_ID.WRENCH, 1);
    // A saved token has no live machine binding after a reconnect or restart.
    this.inventory.removeItem(ITEM_ID.MAGPLANT_REMOTE, this.inventory.getAmount(ITEM_ID.MAGPLANT_REMOTE));

    this.playMods.syncWearables(false);
  }

  /** Seconds spent online, including the current session. */
  public get playtime(): number {
    return this.savedPlaytime + Math.floor((Date.now() - this.sessionStartedAt) / 1000);
  }

  /** Days since the account was created. */
  public get accountAgeDays(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / 86_400_000);
  }

  public customSpeed?: number;
  public customGravity?: number;

  /** The avatar modifiers currently in effect. */
  public get characterStats(): CharacterStats {
    const stats = { ...this.playMods.stats };
    const xenonite = this.world?.xenoniteSettings();
    const result = xenonite ? applyXenonite(stats, xenonite) : stats;
    if (this.customSpeed !== undefined) result.speed = this.customSpeed;
    if (this.customGravity !== undefined) result.gravity = this.customGravity;
    return result;
  }

  /** Skin color as drawn, with the active mods' tint. */
  public get effectiveSkinColor(): number {
    return tintSkinColor(this.skinColor, this.playMods.stats.skinTint);
  }

  /** Custom player title prefix (e.g. "Dr.", "Master", "Legend", "Lord"). */
  public customTitle?: string;

  /**
   * Name as shown in chat and name tags. Role colors win (owners black,
   * developers orange, moderators purple, supporters blue); below them the
   * world role colors the name green for the world owner and its co-owners.
   */
  public get formattedName(): string {
    const title = this.customTitle ? `${this.customTitle} ` : "";
    switch (this.role) {
      case PLAYER_ROLE.OWNER:
        return `\`b@${title}${this.displayName}\`\``;
      case PLAYER_ROLE.DEVELOPER:
        return `\`8@${title}${this.displayName}\`\``;
      case PLAYER_ROLE.MODERATOR:
        return `\`5@${title}${this.displayName}\`\``;
      case PLAYER_ROLE.GUARDIAN:
        return `\`3@${title}${this.displayName}\`\``;
      case PLAYER_ROLE.SUPPORTER:
        return `\`e${title}${this.displayName}\`\``;
    }

    if (this.isWorldOwner) {
      if (this.world?.isRoyalLocked) return `\`^👑 ${title}${this.displayName}\`\``;
      return `\`2${title}${this.displayName}\`\``;
    }
    if (this.world?.isWorldAdmin(this.playerId)) {
      if (this.world?.isRoyalLocked) return `\`^⚔️ ${title}${this.displayName}\`\``;
      return `\`2${title}${this.displayName}\`\``;
    }
    return `\`w${title}${this.displayName}\`\``;
  }

  /** Whether this player owns the world lock of the world they are in. */
  public get isWorldOwner(): boolean {
    return this.world !== null && this.world.getOwnerPlayerId() === this.playerId;
  }

  /** OnSpawn parameters for this player. `local` marks the receiving client's own avatar. */
  public spawnOptions(local: boolean): SpawnOptions {
    const options: SpawnOptions = {
      netID: this.netID,
      userID: this.playerId,
      x: this.state.x,
      y: this.state.y,
      displayName: this.formattedName,
      country: this.country,
      invis: this.state.isGhost ? 1 : 0,
      mstate: (this.isModerator || this.isGuardian) && !this.isDeveloper ? 1 : 0,
      smstate: this.isDeveloper ? 1 : 0,
    };
    if (local) options.type = "local";
    return options;
  }

  /** Re-sends avatar spawn, country state, and name to all players in the world when role or visual state updates. */
  public refreshAvatar(): void {
    if (!this.world) return;
    this.variants.sendOnSpawn(this.spawnOptions(true));
    this.sendCountryState();
    this.world.broadcastVariant(Variant.from({ netID: this.netID }, "OnNameChanged", this.formattedName));
    for (const other of this.world.players) {
      if (other === this) continue;
      other.variants.sendOnSpawn(this.spawnOptions(false));
    }
  }

  /**
   * Sends OnSendToServer variant packet to redirect player to another server or world.
   * Uses unique database playerId instead of transient peer netID.
   */
  public sendOnSendToServer(address?: string, port?: number, doorID: string = "", logonMode: LOGON_MODE = LOGON_MODE.WELCOME, token?: number): void {
    this.variants.sendOnSendToServer(address, port, this.playerId, doorID, logonMode, this.tankIDName || this.displayName, token);
  }

  /**
   * Send a packet to this player. A peer that already went away throws
   * `NotConnected` inside the ENet binding; that is not an error worth
   * crashing for, so it is swallowed and logged at debug level.
   */
  public send(packet: Packet): void {
    try {
      this.peer.send(packet);
    } catch (err) {
      logger.debug({ err, id: this.id }, "dropped packet for disconnected peer");
    }
  }

  /** Send a raw packet buffer to this player */
  public sendBuffer(buffer: Buffer): void {
    this.send(new Packet(buffer, PacketKind.Reliable));
  }

  /** Disconnect this player */
  public disconnect(data?: number): void {
    this.peer.disconnect(data);
  }

  /** Disconnect this player immediately */
  public disconnectNow(data?: number): void {
    this.peer.disconnectNow(data);
  }

  /** Disconnect this player after queued packets are sent */
  public disconnectLater(data?: number): void {
    this.peer.disconnectLater(data);
  }

  // ---------------------------------------------------------------------------
  // messaging helpers
  // ---------------------------------------------------------------------------

  /**
   * Shows a talk bubble above an avatar (this player's by default).
   * @param stacked When true the bubble replaces the one currently shown.
   */
  public sendTextBubble(message: string, stacked = true, netID = this.netID): void {
    this.variants.sendOnTalkBubble(netID, message, stacked);
  }

  /** Plays a positioned sound at this player's avatar, for this player only. */
  public sendPlayPositioned(file: string): void {
    this.variants.sendOnPlayPositioned(file, this.netID);
  }

  /** Plays a sound effect for this player. */
  public sendSfx(file: string, delayMs = 0): void {
    this.actions.sendPlaySfx(file, delayMs);
  }

  // ---------------------------------------------------------------------------
  // inventory
  // ---------------------------------------------------------------------------

  /** Sends the whole backpack to the client. */
  public sendInventory(): void {
    this.variants.sendInventoryState(this.inventory);
  }

  /**
   * Adds items to the backpack and tells the client.
   * @param notifyClient false when the client already counts the items
   * itself, as it does for a collected drop (ITEM_CHANGE_OBJECT).
   * @returns the amount actually added.
   */
  public addItemInven(itemId: number, amount = 1, notifyClient = true): number {
    const added = this.inventory.addItem(itemId, amount);
    if (added > 0) {
      if (notifyClient) this.variants.sendModifyItemInventory(itemId, added);
      this.scheduleInventorySave();
    }
    return added;
  }

  /**
   * Removes items from the backpack and tells the client. Fist and wrench are never removed.
   * @param notifyClient false when the client already subtracts the items
   * itself, as it does for a block it placed (TILE_CHANGE_REQUEST echo).
   * @returns the amount actually removed.
   */
  public removeItemInven(itemId: number, amount = 1, notifyClient = true): number {
    if (PROTECTED_ITEMS.has(itemId) || itemId <= 0) return 0;
    const wasEquipped = this.inventory.isEquipped(itemId);
    const removed = this.inventory.removeItem(itemId, amount);
    if (removed > 0) {
      if (notifyClient) this.variants.sendModifyItemInventory(itemId, -removed);
      if (wasEquipped && !this.inventory.isEquipped(itemId)) {
        if (this.isTransformed && (itemId === 7384 || !this.hasTransformItem())) {
          this.untransform();
        }
        this.onClothesChanged(itemId, false);
      }
      this.scheduleInventorySave();
    }
    return removed;
  }

  /** Persists the inventory soon (debounced). */
  public scheduleInventorySave(): void {
    if (this.inventorySaveTimer) clearTimeout(this.inventorySaveTimer);
    this.inventorySaveTimer = setTimeout(() => {
      this.inventorySaveTimer = null;
      void this.saveToDatabase();
    }, INVENTORY_SAVE_DEBOUNCE_MS);
  }

  /** Writes inventory, gems, level and xp to the database. */
  public async saveToDatabase(): Promise<void> {
    // the login-hop connection knows the player id but never loaded the
    // record; saving it would overwrite the real inventory with an empty one
    if (this.playerId <= 0 || !this.recordLoaded) return;
    if (this.inventorySaveTimer) {
      clearTimeout(this.inventorySaveTimer);
      this.inventorySaveTimer = null;
    }
    try {
      // fold the session so far into the saved total and start counting again
      this.savedPlaytime = this.playtime;
      this.sessionStartedAt = Date.now();
      await PlayerDB.updateById(this.playerId, {
        inventory: this.inventory.toBuffer(),
        gems: this.gems,
        level: this.level,
        xp: this.xp,
        skin_color: this.skinColor,
        playtime: this.savedPlaytime,
        play_mods: this.playMods.serialize(),
        quest_data: this.quests.serialize(),
      });
    } catch (err) {
      logger.error({ err, playerId: this.playerId }, "failed to save player");
    }
  }

  // ---------------------------------------------------------------------------
  // gems & xp
  // ---------------------------------------------------------------------------

  /** Sets the gem balance and updates the client HUD. */
  public setGems(amount: number, skipAnimation = false): void {
    this.gems = Math.max(0, amount);
    this.variants.sendOnSetBux(this.gems, skipAnimation);
    this.scheduleInventorySave();
  }

  public addGems(amount: number): void {
    this.setGems(this.gems + amount);
  }

  /** XP needed to advance from the given level. */
  public static requiredXpForLevel(level: number): number {
    return 50 * (level * level + 2);
  }

  /** Grants experience and handles level ups. */
  public addXp(amount: number): void {
    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
      return;
    }

    let finalAmount = amount;
    if (this.playMods.has("triple_xp") && Math.random() < 0.1) {
      finalAmount *= 3;
    } else if (this.playMods.has("extra_xp") && Math.random() < 0.25) {
      finalAmount *= 2;
    }

    this.xp += finalAmount;
    const required = Player.requiredXpForLevel(this.level);
    if (this.xp >= required) {
      this.level++;
      this.xp = 0;

      const message = `${this.displayName} is now level ${this.level}!`;
      if (this.world) {
        this.world.broadcastVariant(Variant.from("OnParticleEffect", 46, [this.state.x + 10, this.state.y + 16]));
        this.world.broadcastVariant(Variant.from("OnTalkBubble", this.netID, message, 0));
        this.world.broadcastVariant(Variant.from("OnConsoleMessage", message));
      }
      this.sendCountryState();
    }
    this.scheduleInventorySave();
  }

  // ---------------------------------------------------------------------------
  // clothes & character state
  // ---------------------------------------------------------------------------

  /** Toggles a clothing item on or off. */
  public equipClothes(itemId: number): void {
    if (!this.inventory.hasItem(itemId)) return;
    if (itemId === 3172 && this.tryUseLegalBriefs()) return;

    if (this.inventory.isEquipped(itemId)) {
      this.unequipClothes(itemId);
      return;
    }

    const item = getItem(itemId);
    if (!item) return;

    if (item.type === ActionTypes.ANCES) {
      this.inventory.clothes.ances = itemId;
    } else {
      const slot = CLOTH_MAP[item.bodyPartType as ClothTypes];
      if (!slot) return;

      // If equipping standard body clothing while wearing a full-body hero suit in necklace,
      // unequip the hero suit so the newly equipped item renders clearly without conflict.
      if (FULL_BODY_SUITS.has(this.inventory.clothes.necklace) && slot !== "necklace" && slot !== "ances") {
        this.inventory.clothes.necklace = 0;
        this.isTransformed = false;
        this.isHeroDisguised = false;
      }

      // If transformed in vehicle/robot mode and changing body parts (face, hair, shirt, pants, feet):
      if (this.isTransformed && itemId !== 7384 && (slot === "shirt" || slot === "pants" || slot === "feet" || slot === "hair" || slot === "face")) {
        this.untransform();
      }

      this.inventory.clothes[slot] = itemId;
    }

    this.onClothesChanged(itemId, true);
  }

  public unequipClothes(itemId: number): void {
    if (this.inventory.unequipById(itemId)) {
      if (this.isTransformed && (itemId === 7384 || !this.hasTransformItem())) {
        this.untransform();
      }
      this.onClothesChanged(itemId, false);
    }
  }

  /**
   * Visually effective clothes rendered by clients. Suppresses clashing items
   * when full-body hero suits are worn or while transformed.
   */
  public get effectiveClothes(): PlayerClothes {
    return this.getEffectiveClothes();
  }

  public getEffectiveClothes(): PlayerClothes {
    return computeEffectiveClothes(this.inventory.clothes, this.isTransformed);
  }

  /**
   * Whether the player is currently wearing an item that grants transformation capability.
   */
  public hasTransformItem(): boolean {
    if (this.inventory.clothes.feet === 7384) return true;
    if (FULL_BODY_SUITS.has(this.inventory.clothes.necklace)) return true;
    for (const id of MORPH_ITEMS) {
      if (this.inventory.isEquipped(id)) return true;
    }
    return false;
  }

  /**
   * Whether the player can enter or toggle transform mode.
   * True if wearing a transform item (like Go-Go-Growformer!), a full-body suit,
   * or has developer privileges.
   */
  public canTransform(): boolean {
    if (this.isDeveloper) return true;
    return this.hasTransformItem();
  }

  /**
   * Untransforms the avatar, cleaning up character states, play mods, and visuals.
   */
  public untransform(): void {
    if (!this.isTransformed) return;
    this.isTransformed = false;
    this.state.characterState &= ~(CHARACTER_STATE.NO_BODY | CHARACTER_STATE.NO_HANDS);
    this.playMods.remove("transformed");
    this.sendTextBubble("`4Powering down...``", true);
    this.variants.sendOnConsoleMessage("`4Transform mode deactivated.``");
    this.sendSfx("audio/power_down.wav");
    this.applyPlayMods();
    this.sendClothesToWorld();
    this.sendCharacterState();
  }

  /**
   * Toggles avatar transformation (vehicle/robot mode for Growformer, or hero stance).
   */
  public toggleTransform(): boolean {
    if (!this.hasTransformItem()) {
      if (this.inventory.hasItem(7384)) {
        this.inventory.clothes.feet = 7384;
      } else if (this.isDeveloper || this.isModerator) {
        this.addItemInven(7384, 1);
        this.inventory.clothes.feet = 7384;
        this.sendInventory();
      } else if (!this.canTransform()) {
        this.variants.sendOnConsoleMessage("`4You need a transformable item (like Go-Go-Growformer! or a Hero Suit) to transform!``");
        return false;
      }
    }

    this.isTransformed = !this.isTransformed;

    if (this.isTransformed) {
      if (this.inventory.clothes.feet === 7384) {
        this.playMods.add("transformed");
        this.sendTextBubble("`3Growformer, Roll Out!``", true);
        this.variants.sendOnConsoleMessage("`3Go-Go-Growformer: Activated! Transforming into Robot Automaton!``");
        this.sendSfx("audio/jet_engine01.wav");
      } else if (FULL_BODY_SUITS.has(this.inventory.clothes.necklace)) {
        this.playMods.add("transformed");
        this.sendTextBubble("`5Hero mode engaged!``", true);
        this.variants.sendOnConsoleMessage("`5Hero transformation activated! Unleash the legend within!``");
        this.sendSfx("audio/change_clothes.wav");
      } else {
        this.playMods.add("transformed");
        this.sendTextBubble("`2Transformed!``", true);
        this.variants.sendOnConsoleMessage("`2Transform mode activated!``");
        this.sendSfx("audio/jet_engine01.wav");
      }
    } else {
      this.playMods.remove("transformed");
      if (this.inventory.clothes.feet === 7384) {
        this.sendTextBubble("`3Growformer: Car Mode!``", true);
        this.variants.sendOnConsoleMessage("`3Go-Go-Growformer: Switched back to sports car vehicle mode!``");
        this.sendSfx("audio/jet_engine01.wav");
      } else {
        this.sendTextBubble("`4Powering down...``", true);
        this.variants.sendOnConsoleMessage("`4Transform mode deactivated.``");
        this.sendSfx("audio/power_down.wav");
      }
    }

    this.sendClothesToWorld();
    this.sendCharacterState();
    return true;
  }

  /** Consumes one Legal Briefs to clear malpractice; inventory removal updates worn clothes. */
  public tryUseLegalBriefs(): boolean {
    if (!this.playMods.has("malpractice") || !this.inventory.hasItem(3172)) return false;
    if (this.removeItemInven(3172, 1, true) !== 1) return false;
    this.playMods.remove("malpractice");
    this.sendTextBubble("`2Your briefs have stunned the judge!``", true);
    this.variants.sendOnConsoleMessage("You've paid your debt to society! (`$Malpractice`` mod removed)");
    this.sendSfx("audio/dialog_confirm.wav");
    return true;
  }

  private onClothesChanged(itemId: number, equipped: boolean): void {
    if (!equipped && this.isTransformed && (itemId === 7384 || !this.hasTransformItem())) {
      this.untransform();
    }

    const info = getItemInfo(itemId);
    const message = equipped ? info?.func?.add : info?.func?.rem;
    if (message) this.variants.sendOnConsoleMessage(message);

    // Special visual feedback for NekoRei set
    if (itemId === 8030 || itemId === 8032) {
      if (equipped) {
        this.sendTextBubble("`5Nyaa~ Meow! 🐾``", true);
        this.variants.sendOnConsoleMessage("`5NekoRei's feline charm radiates around you!``");
      }
    }

    this.applyPlayMods();
    this.sendClothesToWorld();
    this.sendCharacterState();
    this.sendInventory();
    this.sendSfx("audio/change_clothes.wav");
    this.scheduleInventorySave();
  }

  public get effectiveCapeColor(): number {
    if (this.effectiveClothes.back === 10424 || this.inventory.clothes.back === 10424) {
      const rgb = this.riftCapeConfig?.capeRgb ?? DEFAULT_RIFT_CAPE_CONFIG.capeRgb;
      // Growtopia Proton 32-bit RGBA color format: 0xBBGGRRAA with alpha = 0xff
      return (((rgb[2] & 0xff) << 24) | ((rgb[1] & 0xff) << 16) | ((rgb[0] & 0xff) << 8) | 0xff) >>> 0;
    }
    if (this.effectiveClothes.back === 11478 || this.inventory.clothes.back === 11478) {
      const rgb = this.riftWingsConfig?.wingsRgb ?? DEFAULT_RIFT_WINGS_CONFIG.wingsRgb;
      return (((rgb[2] & 0xff) << 24) | ((rgb[1] & 0xff) << 16) | ((rgb[0] & 0xff) << 8) | 0xff) >>> 0;
    }
    return 0;
  }

  public get effectiveCollarColor(): number {
    if (this.effectiveClothes.back === 10424 || this.inventory.clothes.back === 10424) {
      const rgb = this.riftCapeConfig?.collarRgb ?? DEFAULT_RIFT_CAPE_CONFIG.collarRgb;
      return (((rgb[2] & 0xff) << 24) | ((rgb[1] & 0xff) << 16) | ((rgb[0] & 0xff) << 8) | 0xff) >>> 0;
    }
    return 0;
  }

  /** Sends the current effective clothes to everyone in the world (including this player). */
  public sendClothesToWorld(): void {
    const skin = this.effectiveSkinColor;
    const clothes = this.effectiveClothes;
    const capeColor = this.effectiveCapeColor;
    const collarColor = this.effectiveCollarColor;
    if (this.world) {
      for (const other of this.world.players) {
        other.variants.sendClothes(this.netID, clothes, skin, capeColor, collarColor);
        other.variants.sendOnChangeSkin(this.netID, skin);
      }
    } else {
      this.variants.sendClothes(this.netID, clothes, skin, capeColor, collarColor);
    }
  }

  /** Sets (or clears) the player's home world and persists it. */
  public setHomeWorld(worldName: string | null = null): void {
    this.homeWorld = worldName;
    if (!this.recordLoaded || this.playerId <= 0) return;

    PlayerDB.updateById(this.playerId, { home_world: worldName }).catch((err) =>
      logger.error({ err, playerId: this.playerId }, "failed to save the player home world"),
    );
  }

  /** Recomputes the play mods granted by the worn clothes and sends the result. */
  public applyPlayMods(): void {
    this.playMods.syncWearables(true);
  }

  /** Sends SET_CHARACTER_STATE for this player to the world. */
  public sendCharacterState(): void {
    const buffer = this.variants.buildCharacterState(this.netID, this.characterStats, this.state.characterState, this.punchId);
    this.sendBuffer(buffer);
    this.world?.broadcast(buffer, this.id);
  }

  /** Punch effect id forced with /pid; null uses the active mods' punch type. */
  public customPunchId: number | null = null;

  /** Punch effect id: forced, weapon punch, head/face/body punch, active mods, or 0 for plain fist. */
  public get punchId(): number {
    if (this.customPunchId !== null) return this.customPunchId;

    const handItem = this.effectiveClothes.hand || this.inventory.clothes.hand;

    // 1. Direct hand weapon / item lookup in WEAPON_PUNCH_TYPES
    if (handItem && WEAPON_PUNCH_TYPES[handItem] !== undefined) {
      return WEAPON_PUNCH_TYPES[handItem]!;
    }

    // 2. Dynamic weapon category detection for held hand weapons
    if (handItem > 0 && handItem !== ITEM_ID.FIST) {
      const itemDef = getItem(handItem);
      if (itemDef?.name) {
        const lower = itemDef.name.toLowerCase();
        if (lower.includes("katana") || lower.includes("sword") || lower.includes("blade") || lower.includes("saber")) {
          return 43; // Authentic Japanese Katana / blade slice
        }
        if (lower.includes("scythe")) {
          return 13; // Authentic scythe reaper slash
        }
        if (lower.includes("bow") || lower.includes("crossbow")) {
          return 4; // Authentic bow arrow
        }
        if (
          lower.includes("gun") ||
          lower.includes("blaster") ||
          lower.includes("rifle") ||
          lower.includes("shotgun") ||
          lower.includes("pistol") ||
          lower.includes("revolver")
        ) {
          return 5; // Gun / blaster projectile
        }
        if (lower.includes("staff") || lower.includes("wand") || lower.includes("rod")) {
          return 50; // Wizard staff projectile
        }
        if (
          lower.includes("trident") ||
          lower.includes("spear") ||
          lower.includes("lance") ||
          lower.includes("javelin") ||
          lower.includes("halberd")
        ) {
          return 49; // Trident / spear thrust
        }
        if (lower.includes("dragon")) {
          return 6; // Dragon fire
        }
      }
    }

    // 3. Face accessories (Burning Eyes: 39, Black Burning Eyes: 39, Focused Eyes: 10, Cyclopean Visor: 1)
    const faceItem = this.effectiveClothes.face || this.inventory.clothes.face;
    if (faceItem && WEAPON_PUNCH_TYPES[faceItem] !== undefined) {
      return WEAPON_PUNCH_TYPES[faceItem]!;
    }

    // 4. Head / Hair accessories (Giant Eye Head: 8, Energized Horns: 75, Diamond Horns: 40, Rainbow Wig: 14)
    const hairItem = this.effectiveClothes.hair || this.inventory.clothes.hair;
    if (hairItem && WEAPON_PUNCH_TYPES[hairItem] !== undefined) {
      return WEAPON_PUNCH_TYPES[hairItem]!;
    }

    // 5. Back accessories (Phoenix Wings: 19, Rainbow Wings: 14, Da Vinci Wings: 4, Heroman Cape: 1)
    const backItem = this.effectiveClothes.back || this.inventory.clothes.back;
    if (backItem && WEAPON_PUNCH_TYPES[backItem] !== undefined) {
      return WEAPON_PUNCH_TYPES[backItem]!;
    }

    // 6. Active play mod punch type (food, potions, consumables)
    if (this.characterStats.punchType) return this.characterStats.punchType;

    // 7. Other clothing slots (necklace, mask, feet)
    const neckItem = this.effectiveClothes.necklace || this.inventory.clothes.necklace;
    if (neckItem && WEAPON_PUNCH_TYPES[neckItem] !== undefined) {
      return WEAPON_PUNCH_TYPES[neckItem]!;
    }

    const maskItem = this.effectiveClothes.mask || this.inventory.clothes.mask;
    if (maskItem && WEAPON_PUNCH_TYPES[maskItem] !== undefined) {
      return WEAPON_PUNCH_TYPES[maskItem]!;
    }

    const feetItem = this.effectiveClothes.feet || this.inventory.clothes.feet;
    if (feetItem && WEAPON_PUNCH_TYPES[feetItem] !== undefined) {
      return WEAPON_PUNCH_TYPES[feetItem]!;
    }

    return 0;
  }

  /** Sends the country/name-tag state of this player and every player around. */
  public sendCountryState(): void {
    const state = (player: Player) => `${player.country}${player.level >= MAX_LEVEL ? "|maxLevel" : ""}`;

    this.variants.sendOnCountryState(this.netID, state(this));
    if (!this.world) return;
    for (const other of this.world.players) {
      if (other === this) continue;
      other.variants.sendOnCountryState(this.netID, state(this));
      this.variants.sendOnCountryState(other.netID, state(other));
    }
  }

  // ---------------------------------------------------------------------------
  // worlds
  // ---------------------------------------------------------------------------

  /**
   * Moves the player into a world, leaving the current one first.
   */
  public async enterWorld(worldName: string, x?: number, y?: number): Promise<void> {
    const world = await worldManager.get(worldName);

    const denial = world.entryDenial(this);
    if (denial) {
      this.variants.sendOnFailedToEnterWorld();
      this.variants.sendOnConsoleMessage(denial);
      this.sendTextBubble(denial, true);
      return;
    }

    if (this.world && this.world !== world) this.world.leave(this);

    await world.enter(this, x, y);
    this.sendInventory();
    this.sendCountryState();
    this.sendSfx("audio/door_open.wav");
    this.applyPlayMods();
    // the official server re-sends the feature flags once the player is in a world
    this.variants.sendOnSetFeatureEnableFlags(WORLD_FEATURE_FLAGS);

    this.lastVisitedWorlds = this.lastVisitedWorlds.filter((name) => name !== world.name);
    this.lastVisitedWorlds.push(world.name);
    if (this.lastVisitedWorlds.length > MAX_RECENT_WORLDS) this.lastVisitedWorlds.shift();
  }

  /**
   * Leaves the current world and optionally shows the world select menu.
   */
  public leaveWorld(sendMenu = true): void {
    const world = this.world;
    if (!world) return;
    world.leave(this);

    if (sendMenu) {
      this.variants.sendOnRequestWorldSelectMenu(this.lastVisitedWorlds, 500, this.homeWorld, this.playerId);
    }
  }

  /**
   * Kills the avatar and respawns it at the checkpoint, the main door, or the
   * top-left corner when the world has no main door.
   */
  public respawn(): void {
    if (this.state.isGhost || !this.world) return;

    let target: BlockPosition | undefined = this.world.mainDoor;

    if (this.lastCheckpoint) {
      const block = this.world.getTileAt(this.lastCheckpoint.x, this.lastCheckpoint.y);
      const item = block ? getItem(block.fg || block.bg) : undefined;
      if (item?.type === ActionTypes.CHECKPOINT) {
        target = this.lastCheckpoint;
      } else {
        this.lastCheckpoint = null;
        this.variants.sendVariant(Variant.from({ netID: this.netID, delay: 0 }, "SetRespawnPos", 0));
      }
    }

    const x = (target?.x ?? 0) * 32;
    const y = (target?.y ?? 0) * 32;
    this.state.x = x;
    this.state.y = y;

    this.variants.sendOnSetFreezeState(this.netID, true);
    this.variants.sendOnKilled(this.netID);
    this.variants.sendOnSetPos(this.netID, x, y, 2000);
    this.variants.sendOnSetFreezeState(this.netID, false, 2000);
    this.sendSfx("audio/teleport.wav", 2000);
  }

  /** Teleports the avatar within the current world (pixel coordinates). */
  public setPosition(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
    const packet = Variant.from({ netID: this.netID }, "OnSetPos", [x, y]).parse();
    if (this.world) this.world.broadcast(packet);
    else this.sendBuffer(packet);
  }
}
