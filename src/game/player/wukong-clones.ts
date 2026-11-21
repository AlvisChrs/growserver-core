import { Packet, PacketKind } from "growtopia.wasm";
import { TANK_PACKET_FLAGS, TANK_PACKET_TYPE } from "../../constants";
import { GameUpdatePacket } from "../packets/game-packet";
import { Variant } from "../packets/variants";
import { TextParser } from "../../utils/text-parser";
import type { Player } from "./index";
import type { World } from "../world/world";

/** In-game item ID for Wukong's Staff (Ruyi Jingu Bang). */
export const WUKONG_STAFF_ID = 11630;
export const WUKONG_CLONE_COUNT = 5;

export interface CloneInstance {
  netID: number;
  userID: number;
  dx: number;
  dy: number;
  x: number;
  y: number;
  title: string;
}

/**
 * 5 Sun Wukong shadow clones standing side-by-side in a horizontal row alongside the player.
 * All clones stay on the floor (dy: 0) with no clone above the head.
 */
const CLONE_OFFSETS: ReadonlyArray<{ dx: number; dy: number; title: string }> = [
  { dx: -34, dy: 0, title: "Clone I" },
  { dx: 34, dy: 0, title: "Clone II" },
  { dx: -68, dy: 0, title: "Clone III" },
  { dx: 68, dy: 0, title: "Clone IV" },
  { dx: -102, dy: 0, title: "Clone V" },
];

/**
 * Manages the Multi-Shadow Clone Jutsu (5 Sun Wukong clones) summoned
 * whenever Wukong's Staff (Ruyi Jingu Bang) is equipped.
 */
export class WukongCloneManager {
  public clones: CloneInstance[] = [];
  public isActive = false;

  /**
   * Summons 5 shadow clones standing side-by-side alongside the player.
   */
  public spawn(player: Player): void {
    if (this.isActive || !player.world || player.isInvisible) return;
    const world = player.world;
    this.isActive = true;
    this.clones = [];

    const baseUserId = 990000 + (player.playerId % 1000) * 10;

    for (let i = 0; i < WUKONG_CLONE_COUNT; i++) {
      const config = CLONE_OFFSETS[i]!;
      const netID = world.allocNetId();
      const userID = baseUserId + i + 1;
      const facingSign = player.state.rotatedLeft ? -1 : 1;
      const cloneX = player.state.x + config.dx * facingSign;
      const cloneY = player.state.y + config.dy;

      const clone: CloneInstance = {
        netID,
        userID,
        dx: config.dx,
        dy: config.dy,
        x: cloneX,
        y: cloneY,
        title: config.title,
      };
      this.clones.push(clone);

      // Spawn for the owner player and every other player in the world
      this.spawnCloneFor(player, clone, player);
      for (const other of world.players) {
        if (other !== player) {
          this.spawnCloneFor(other, clone, player);
        }
      }

      // Golden sparkle particle effect at each clone's spawn point
      world.sendParticleEffect(44, cloneX, cloneY);
      world.sendParticleEffect(46, cloneX, cloneY);
    }

    player.sendSfx("audio/zap.wav");
    player.sendSfx("audio/magic_burst.wav");
    player.sendTextBubble("`eMulti-Shadow Clone Jutsu! (5 Clones)``", true);
    player.variants.sendOnConsoleMessage("`e[Wukong's Staff]: Multi-Shadow Clone Jutsu! Sun Wukong summons 5 clones!``");
  }

  /**
   * Dispels all active shadow clones with a puff of smoke.
   */
  public despawn(player: Player): void {
    if (!this.isActive) return;
    this.isActive = false;

    const world = player.world;
    for (const clone of this.clones) {
      if (world) {
        world.sendParticleEffect(28, clone.x, clone.y); // smoke puff
        for (const other of world.players) {
          other.variants.sendOnRemove(clone.netID, clone.userID);
        }
      }
      player.variants.sendOnRemove(clone.netID, clone.userID);
    }

    this.clones = [];
    player.sendSfx("audio/trash.wav");
    player.variants.sendOnConsoleMessage("`4[Wukong's Staff]: The 5 shadow clones vanish in a puff of smoke.``");
  }

  /**
   * Synchronizes clone positions and animation states with the player's movement.
   */
  public syncMovement(player: Player, tank: GameUpdatePacket, world: World): void {
    if (!this.isActive || this.clones.length === 0 || !world || player.isInvisible) return;

    const facingSign = player.state.rotatedLeft ? -1 : 1;
    const facingFlag = player.state.rotatedLeft ? TANK_PACKET_FLAGS.FACING_LEFT : 0;
    const playerTileX = Math.floor(player.state.x / 32);
    const playerTileY = Math.floor(player.state.y / 32);

    const relTileX = tank.data.tileX > 0 ? tank.data.tileX - playerTileX : 0;
    const relTileY = tank.data.tileY > 0 ? tank.data.tileY - playerTileY : 0;

    for (const clone of this.clones) {
      const cloneX = player.state.x + clone.dx * facingSign;
      const cloneY = player.state.y + clone.dy;
      clone.x = cloneX;
      clone.y = cloneY;

      const cloneTileX = relTileX !== 0 ? Math.floor(cloneX / 32) + relTileX : 0;
      const cloneTileY = relTileY !== 0 ? Math.floor(cloneY / 32) + relTileY : 0;

      const cloneState = GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.STATE,
        netID: clone.netID,
        flags: (tank.data.flags & ~TANK_PACKET_FLAGS.FACING_LEFT) | facingFlag,
        posX: cloneX,
        posY: cloneY,
        speedX: tank.data.speedX,
        speedY: tank.data.speedY,
        tileX: cloneTileX,
        tileY: cloneTileY,
      });

      const parsed = cloneState.parse();
      if (parsed) {
        player.send(new Packet(parsed, PacketKind.Unreliable));
        world.broadcast(parsed, player.id);
      }
    }
  }

  /**
   * Synchronizes punch attack direction for all 5 clones so every clone strikes
   * in the exact same relative angle and direction as the player's extending staff.
   */
  public syncPunch(player: Player, data: GameUpdatePacket["data"], world: World): void {
    if (!this.isActive || this.clones.length === 0 || !world || player.isInvisible) return;

    const playerTileX = Math.floor(player.state.x / 32);
    const playerTileY = Math.floor(player.state.y / 32);

    // Relative direction vector of the player's punch
    const relTileX = data.tileX - playerTileX;
    const relTileY = data.tileY - playerTileY;

    // Determine facing based on target tile
    const punchLeft = data.tileX < playerTileX || (data.tileX === playerTileX && player.state.rotatedLeft);
    const facingFlag = punchLeft ? TANK_PACKET_FLAGS.FACING_LEFT : 0;

    for (const clone of this.clones) {
      const cloneTileX = Math.floor(clone.x / 32) + relTileX;
      const cloneTileY = Math.floor(clone.y / 32) + relTileY;

      const punchPacket = GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.STATE,
        netID: clone.netID,
        flags: TANK_PACKET_FLAGS.ON_GROUND | facingFlag | TANK_PACKET_FLAGS.ON_TILE_ACTION | TANK_PACKET_FLAGS.ON_PUNCHED,
        posX: clone.x,
        posY: clone.y,
        tileX: cloneTileX,
        tileY: cloneTileY,
      });

      const parsed = punchPacket.parse();
      if (parsed) {
        player.send(new Packet(parsed, PacketKind.Unreliable));
        world.broadcast(parsed, player.id);
      }
    }
  }

  /**
   * Re-sends clothing and character state to all clones if the owner changes clothing while clones are active.
   */
  public updateClothes(player: Player): void {
    if (!this.isActive || !player.world) return;
    const world = player.world;
    for (const clone of this.clones) {
      player.variants.sendClothes(
        clone.netID,
        player.effectiveClothes,
        player.effectiveSkinColor,
        player.effectiveCapeColor,
        player.effectiveCollarColor,
      );
      player.sendBuffer(
        player.variants.buildCharacterState(
          clone.netID,
          player.characterStats,
          player.state.characterState,
          80, // Extending staff punch
        ),
      );
      for (const other of world.players) {
        other.variants.sendClothes(
          clone.netID,
          player.effectiveClothes,
          player.effectiveSkinColor,
          player.effectiveCapeColor,
          player.effectiveCollarColor,
        );
        other.sendBuffer(
          other.variants.buildCharacterState(
            clone.netID,
            player.characterStats,
            player.state.characterState,
            80, // Extending staff punch
          ),
        );
      }
    }
  }

  /**
   * Sends all active clones to a newly entering player.
   */
  public sendTo(targetPlayer: Player, owner: Player): void {
    if (!this.isActive || this.clones.length === 0 || owner.isInvisible) return;
    for (const clone of this.clones) {
      this.spawnCloneFor(targetPlayer, clone, owner);
    }
  }

  /**
   * Internal helper to send the spawn, clothing, and character state packet for one clone to a recipient.
   */
  private spawnCloneFor(target: Player, clone: CloneInstance, owner: Player): void {
    const text = new TextParser();
    text.add("spawn", "avatar");
    text.add("netID", clone.netID);
    text.add("userID", clone.userID);
    text.add("colrect", 0, 0, 20, 30);
    text.add("posXY", clone.x, clone.y);

    const cloneName = owner.isOwner
      ? `\`b@${owner.displayName} (${clone.title})\`\``
      : owner.isDeveloper
        ? `\`8@${owner.displayName} (${clone.title})\`\``
        : `\`e${owner.displayName} (${clone.title})\`\``;

    text.add("name", cloneName);
    text.add("country", owner.country);
    text.add("invis", 0);
    text.add("mstate", 0);
    text.add("smstate", owner.isDeveloper ? 1 : 0);
    text.add("onlineID", "");

    const spawnVariant = Variant.from({ delay: -1 }, "OnSpawn", `${text.toString()}\n`);
    target.send(spawnVariant.parsePacket());

    target.variants.sendClothes(
      clone.netID,
      owner.effectiveClothes,
      owner.effectiveSkinColor,
      owner.effectiveCapeColor,
      owner.effectiveCollarColor,
    );

    target.sendBuffer(
      target.variants.buildCharacterState(
        clone.netID,
        owner.characterStats,
        owner.state.characterState,
        80, // Extending staff punch animation ID
      ),
    );
  }
}
