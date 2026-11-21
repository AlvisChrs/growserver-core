import { Packet, PacketKind, type Peer } from "growtopia.wasm";
import { Player } from "../player";
import { CHARACTER_STATE, PLAYER_ROLE, TANK_PACKET_FLAGS, TANK_PACKET_TYPE } from "../../constants";
import { GameUpdatePacket } from "../packets/game-packet";
import { Variant } from "../packets/variants";
import { logger } from "../../utils/logger";
import { serverManager } from "../server/server-manager";

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

export type BotBehaviorType = "social" | "farmer" | "casino_host" | "casino_gambler" | "trader";

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
}

export class BotPlayer extends Player {
  public isBot = true;
  public behaviorType: BotBehaviorType;
  public dialoguePool: string[] = [];
  public targetWorld: string;
  public homeTileX: number = 0;
  public homeTileY: number = 0;
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

    if (config.clothes) {
      if (config.clothes.hair) this.inventory.clothes.hair = config.clothes.hair;
      if (config.clothes.shirt) this.inventory.clothes.shirt = config.clothes.shirt;
      if (config.clothes.pants) this.inventory.clothes.pants = config.clothes.pants;
      if (config.clothes.feet) this.inventory.clothes.feet = config.clothes.feet;
      if (config.clothes.face) this.inventory.clothes.face = config.clothes.face;
      if (config.clothes.hand) this.inventory.clothes.hand = config.clothes.hand;
      if (config.clothes.back) this.inventory.clothes.back = config.clothes.back;
      if (config.clothes.mask) this.inventory.clothes.mask = config.clothes.mask;
      if (config.clothes.necklace) this.inventory.clothes.necklace = config.clothes.necklace;
      if (config.clothes.ances) this.inventory.clothes.ances = config.clothes.ances;
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
   * Speaks a chat message aloud in the world with both talk bubble and world console message.
   */
  public say(message: string): void {
    if (!this.world || this.state.isMuted) return;
    this.world.broadcastVariant(Variant.from({ netID: this.netID }, "OnTalkBubble", this.netID, message, 0));
    this.world.broadcastVariant(Variant.from("OnConsoleMessage", `CP:0_PL:4_o_C:0_ <\`w${this.displayName}\`o> \`$$${message}\`\``));
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

  /**
   * Broadcasts a movement step to the current world.
   */
  public walkTo(x: number, y: number, facingLeft = false, jump = false): void {
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
    });

    const parsed = movePacket.parse();
    if (parsed) {
      this.world.broadcast(parsed, this.id);
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
}
