import { Packet, PacketKind, type Peer } from "growtopia.wasm";
import { Player } from "../player";
import { CHARACTER_STATE, PLAYER_ROLE, TANK_PACKET_FLAGS, TANK_PACKET_TYPE } from "../../constants";
import { GameUpdatePacket } from "../packets/game-packet";
import { Variant } from "../packets/variants";
import { logger } from "../../utils/logger";
import { serverManager } from "../server/server-manager";
import { TileFlags } from "../world/constants";
import { getItem } from "../item/item-utils";
import type { World } from "../world/world";

/**
 * Scans a column to find the tile Y where an avatar can stand firmly with solid ground underneath.
 */
export function findGroundTileY(world: World, tileX: number, startY: number = 23): number {
  const x = Math.max(0, Math.min(world.width - 1, tileX));

  for (let y = Math.max(0, startY); y < world.height - 1; y++) {
    const tile = world.getTileAt(x, y);
    if (tile && tile.fg !== 0) {
      const item = getItem(tile.fg);
      const coll = item?.collisionType ?? 0;
      if (coll === 1 || coll === 2 || ((coll === 3 || coll === 4) && (tile.flags & TileFlags.OPEN) === 0)) {
        return Math.max(0, y - 1);
      }
    }
  }

  for (let y = 1; y < world.height - 1; y++) {
    const tile = world.getTileAt(x, y);
    if (tile && tile.fg !== 0) {
      const item = getItem(tile.fg);
      const coll = item?.collisionType ?? 0;
      if (coll === 1 || coll === 2 || ((coll === 3 || coll === 4) && (tile.flags & TileFlags.OPEN) === 0)) {
        return Math.max(0, y - 1);
      }
    }
  }

  return 23;
}

/**
 * Creates a mock ENet peer for bot instances where all network sends are safe no-ops.
 */
export function createMockPeer(peerId: number): Peer {
  return {
    id: peerId,
    send: () => {},
    disconnect: () => {},
    disconnectNow: () => {},
    disconnectLater: () => {},
  } as unknown as Peer;
}

export type BotBehaviorType = "social" | "farmer" | "casino_host" | "casino_gambler" | "trader" | "wanderer";

export interface BotClothesConfig {
  hair?: number;
  shirt?: number;
  pants?: number;
  feet?: number;
  face?: number;
  hand?: number;
  back?: number;
  mask?: number;
  necklace?: number;
  ances?: number;
}

export interface BotConfig {
  name: string;
  role?: PLAYER_ROLE;
  level?: number;
  gems?: number;
  country?: string;
  skinColor?: number;
  clothes?: BotClothesConfig;
  behavior: BotBehaviorType;
  worldName: string;
  dialoguePool?: string[];
  targetTileX?: number;
  targetTileY?: number;
  minTileX?: number;
  maxTileX?: number;
}

export class BotPlayer extends Player {
  public isBot = true;
  public behaviorType: BotBehaviorType;
  public dialoguePool: string[] = [];
  public targetWorld: string;
  public homeTileX: number = 0;
  public homeTileY: number = 0;
  public minTileX: number = 0;
  public maxTileX: number = 100;
  public seenPlayersCooldown: Map<number, number> = new Map();
  public nextActionAt: number = 0;
  public nextChatAt: number = 0;

  constructor(peerId: number, config: BotConfig) {
    const mockPeer = createMockPeer(peerId);
    super(mockPeer, "bot-server", 17091);

    this.playerId = peerId;
    this.tankIDName = config.name;
    this.displayName = config.name;
    this.role = config.role ?? PLAYER_ROLE.BASIC;
    this.realRole = this.role;
    this.level = config.level ?? Math.floor(15 + Math.random() * 45);
    this.gems = config.gems ?? Math.floor(10000 + Math.random() * 150000);
    this.skinColor = config.skinColor ?? 0xd8b598ff;
    this.auth.metadata.country = config.country ?? "us";
    this.behaviorType = config.behavior;
    this.targetWorld = config.worldName.toUpperCase();
    this.dialoguePool = config.dialoguePool ?? [];
    this.minTileX = config.minTileX ?? Math.max(2, (config.targetTileX ?? 50) - 15);
    this.maxTileX = config.maxTileX ?? Math.min(98, (config.targetTileX ?? 50) + 15);

    if (config.clothes) {
      for (const [slot, id] of Object.entries(config.clothes)) {
        if (id && id > 0) {
          (this.inventory.clothes as any)[slot] = id;
          this.inventory.items.set(id, 1);
        }
      }
    }

    const now = Date.now();
    this.nextActionAt = now + 1500 + Math.random() * 3000;
    this.nextChatAt = now + 4000 + Math.random() * 10000;
  }

  /**
   * Overridden so simulated bots do not write fake records into the SQLite database.
   */
  public override async saveToDatabase(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Cleanly unregisters this bot when disconnected via /kick or /ban.
   */
  public override disconnect(): void {
    if (this.world) {
      this.leaveWorld(false);
    }
    serverManager.unregisterPlayer(this);
    import("./bot-manager")
      .then(({ BotManager }) => {
        BotManager.getInstance().bots.delete(this.tankIDName.toLowerCase());
      })
      .catch(() => {});
  }

  public override disconnectNow(): void {
    this.disconnect();
  }

  public override disconnectLater(): void {
    this.disconnect();
  }

  /**
   * Speaks a chat message aloud in the world with both speech bubble above avatar head and console chat log.
   */
  public say(message: string): void {
    if (!this.world || this.state.isMuted) return;
    const cleanMsg = message.replace(/`./g, "").trim();
    if (!cleanMsg) return;

    // Visual speech bubble above the bot's head (matching official GT chat bubble protocol)
    this.world.broadcastVariant(
      Variant.from("OnTalkBubble", this.netID, "CP:_PL:0_OID:_`w" + cleanMsg, 0, 0),
    );
    // World channel console message formatted as [W] <BotName> message
    this.world.broadcastVariant(
      Variant.from("OnConsoleMessage", `CP:_PL:0_OID:_CT:[W]_ \`6<\`w${this.displayName}\`6> \`$player_chat=\`$${cleanMsg}`),
    );
  }

  /**
   * Performs an emote animation for everyone in the world.
   */
  public playEmote(name: string): void {
    if (!this.world) return;
    this.world.broadcastVariant(Variant.from({ netID: this.netID }, "OnAction", `/${name}`));
  }

  /**
   * Executes a regular slash command as a player.
   */
  public async runCommand(commandText: string): Promise<void> {
    if (!this.world) return;
    try {
      const { executeCommand } = await import("../commands");
      await executeCommand(this, commandText);
    } catch {}
  }

  /**
   * Replies privately to a player.
   */
  public replyPrivately(target: Player, message: string): void {
    if (this.state.isMuted) return;
    target.variants.sendOnConsoleMessage(`CP:_PL:0_OID:_CT:[W]_ \`5PM from \`w${this.displayName}\`5: \`$${message}\`\``);
    target.actions.sendPlaySfx("audio/camerashutter.wav");
    target.lastWhisperFrom = this.tankIDName;
  }

  public isWalking = false;

  /**
   * Broadcasts a movement step to the current world.
   */
  public walkTo(x: number, y: number, facingLeft = false, jump = false, speedX = 0): void {
    if (!this.world) return;
    if ((this.state.characterState & CHARACTER_STATE.IS_FROZEN) !== 0) return;

    this.state.x = x;
    this.state.y = y;
    this.state.rotatedLeft = facingLeft;

    const flags =
      (facingLeft ? TANK_PACKET_FLAGS.FACING_LEFT : 0) |
      (jump ? TANK_PACKET_FLAGS.ON_JUMP : TANK_PACKET_FLAGS.ON_GROUND);

    const movePacket = GameUpdatePacket.create({
      type: TANK_PACKET_TYPE.STATE,
      netID: this.netID,
      flags,
      posX: this.state.x,
      posY: this.state.y,
      speedX,
      speedY: jump ? -380 : 0,
    });

    const parsed = movePacket.parse();
    if (parsed) {
      this.world.broadcast(parsed, this.id);
    }
  }

  /**
   * Smoothly steps toward a target tile X tile-by-tile, checking ground and wall collisions at every step.
   */
  public async walkPath(targetTileX: number): Promise<void> {
    if (!this.world || this.isWalking) return;
    if ((this.state.characterState & CHARACTER_STATE.IS_FROZEN) !== 0) return;

    this.isWalking = true;
    try {
      const curTileX = Math.floor(this.state.x / 32);
      const curTileY = Math.floor(this.state.y / 32);
      if (targetTileX === curTileX) return;

      const direction = targetTileX > curTileX ? 1 : -1;
      const steps = Math.min(8, Math.abs(targetTileX - curTileX));

      let currentX = curTileX;
      let currentY = curTileY;

      for (let i = 0; i < steps; i++) {
        if (!this.world || (this.state.characterState & CHARACTER_STATE.IS_FROZEN) !== 0) break;
        if (currentX === targetTileX) break;

        const nextX = currentX + direction;
        let stepTargetX = nextX;
        let groundY = currentY;
        let jump = false;

        // Obstacle detection in front of the bot
        if (this.world.isSolid(nextX, currentY)) {
          // Check if obstacle is 1 block high with headroom clear (at currentY - 1 and currentY - 2)
          if (!this.world.isSolid(nextX, currentY - 1) && !this.world.isSolid(nextX, currentY - 2)) {
            const leapX = nextX + direction;
            const leapGroundY = findGroundTileY(this.world, leapX, Math.max(0, currentY - 2));

            // If tile behind the 1-block obstacle is clear and has solid ground, leap over it directly!
            if (
              leapX >= 0 &&
              leapX < this.world.width &&
              !this.world.isSolid(leapX, leapGroundY) &&
              !this.world.isSolid(leapX, leapGroundY - 1) &&
              Math.abs(leapGroundY - currentY) <= 1
            ) {
              stepTargetX = leapX;
              groundY = leapGroundY;
              jump = true;
            } else {
              // Otherwise, jump onto the 1-block step/ledge
              stepTargetX = nextX;
              groundY = currentY - 1;
              jump = true;
            }
          } else {
            // Wall is 2+ blocks tall or ceiling is blocked, cannot pass
            break;
          }
        } else if (this.world.isSolid(nextX, currentY - 1)) {
          // Low ceiling / overhead obstruction at head level
          break;
        } else {
          // Normal ground traversal
          groundY = findGroundTileY(this.world, nextX, Math.max(0, currentY - 2));
          if (Math.abs(groundY - currentY) > 2) {
            break;
          }
          jump = groundY < currentY;
        }

        const isLast = currentX === targetTileX || stepTargetX === targetTileX || i === steps - 1;
        const speedX = isLast ? 0 : (direction < 0 ? -180 : 180);

        this.walkTo(stepTargetX * 32, groundY * 32, direction < 0, jump, speedX);
        currentX = stepTargetX;
        currentY = groundY;

        if (currentX === targetTileX) break;

        if (!isLast) {
          await new Promise((resolve) => setTimeout(resolve, stepTargetX !== nextX ? 220 : 140));
        }
      }
    } finally {
      this.isWalking = false;
    }
  }

  /**
   * Broadcasts a punch animation and tile action to the world.
   */
  public punchTile(tileX: number, tileY: number): void {
    if (!this.world) return;
    if ((this.state.characterState & CHARACTER_STATE.IS_FROZEN) !== 0) return;

    const facingLeft = tileX * 32 < this.state.x;
    this.state.rotatedLeft = facingLeft;

    const punchPacket = GameUpdatePacket.create({
      type: TANK_PACKET_TYPE.STATE,
      netID: this.netID,
      flags:
        (facingLeft ? TANK_PACKET_FLAGS.FACING_LEFT : 0) |
        TANK_PACKET_FLAGS.ON_GROUND |
        TANK_PACKET_FLAGS.ON_TILE_ACTION |
        TANK_PACKET_FLAGS.ON_PUNCHED,
      posX: this.state.x,
      posY: this.state.y,
      tileX,
      tileY,
    });

    const parsed = punchPacket.parse();
    if (parsed) {
      this.world.broadcast(parsed, this.id);
      this.world.playPositioned("audio/punch.wav", this.netID);
    }
  }

  /**
   * Rotates / flips a foreground block horizontally, mimicking wrench interaction.
   */
  public rotateBlock(tileX: number, tileY: number): void {
    if (!this.world) return;
    const tile = this.world.getTileAt(tileX, tileY);
    if (!tile || tile.fg === 0) return;

    tile.flags ^= TileFlags.FLIPPED;
    const flipped = (tile.flags & TileFlags.FLIPPED) !== 0;

    this.punchTile(tileX, tileY);
    this.world.broadcast(
      GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.TILE_CHANGE_REQUEST,
        netID: this.netID,
        itemID: tile.fg,
        tileX,
        tileY,
        flags: flipped ? 0x10 : 0,
      }).parse()!,
    );
    this.world.playPositioned("audio/wrench.wav", this.netID);
    this.world.markDirty();
  }

  /**
   * Plants a tree seed on a solid ground tile.
   */
  public plantSeed(tileX: number, tileY: number, seedId = 3): void {
    if (!this.world) return;
    const tile = this.world.getTileAt(tileX, tileY);
    const ground = this.world.getTileAt(tileX, tileY + 1);
    if (!tile || tile.fg !== 0 || !ground || ground.fg === 0) return;

    const seedMeta = getItem(seedId);
    if (!seedMeta) return;

    tile.fg = seedId;
    tile.flags |= TileFlags.TILEEXTRA | TileFlags.SEED;
    tile.tree = {
      fruit: Math.max(1, seedId - 1),
      fruitCount: Math.floor(Math.random() * 4) + 1,
      fullyGrownAt: Date.now() + 5000,
      plantedAt: Date.now(),
      isSpliced: false,
    };

    this.punchTile(tileX, tileY);
    this.world.broadcast(
      GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.TILE_CHANGE_REQUEST,
        netID: this.netID,
        itemID: seedId,
        tileX,
        tileY,
      }).parse()!,
    );
    this.world.playPositioned("audio/seed_plant.wav", this.netID);
    this.world.markDirty();
  }

  /**
   * Harvests a fully grown crop or tree, dropping fruits and seeds.
   */
  public harvestTree(tileX: number, tileY: number): void {
    if (!this.world) return;
    const tile = this.world.getTileAt(tileX, tileY);
    if (!tile || !tile.tree) return;

    const tree = tile.tree;
    const seedId = tile.fg;
    const fruitId = tree.fruit;
    const count = tree.fruitCount;

    this.world.broadcast(
      GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.SEND_TILE_TREE_STATE,
        netID: this.netID,
        targetNetID: -1,
        tileX,
        tileY,
      }).parse()!,
    );

    tile.fg = 0;
    tile.damage = 0;
    tile.flags &= ~(TileFlags.TILEEXTRA | TileFlags.SEED);
    delete tile.tree;

    // Drop fruits & chance for seed
    this.world.drop(this, tileX * 32 + 8, tileY * 32 + 8, fruitId, count, { tree: true, origin: "harvest" });
    if (Math.random() < 0.75) {
      this.world.drop(this, tileX * 32 + 16, tileY * 32 + 8, seedId, 1, { tree: true, origin: "harvest" });
    }

    this.punchTile(tileX, tileY);
    this.world.playPositioned("audio/punch.wav", this.netID);
    this.world.markDirty();
  }

  /**
   * Rolls a dice block or spins roulette with game update packet.
   */
  public rollDice(tileX: number, tileY: number): void {
    if (!this.world) return;
    const tile = this.world.getTileAt(tileX, tileY);
    if (!tile || tile.fg === 0) return;

    const face = Math.floor(Math.random() * 6) + 1; // 1-6
    if (tile.dice) {
      tile.dice.symbol = face - 1;
    }

    this.punchTile(tileX, tileY);
    this.world.broadcast(
      GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.TILE_APPLY_DAMAGE,
        netID: this.netID,
        tileX,
        tileY,
        buildRange: face - 1,
      }).parse()!,
    );
    this.world.playPositioned("audio/dice.wav", this.netID);
    this.say(`[Dice] Rolled a \`2${face}\`\`!`);
  }
}
