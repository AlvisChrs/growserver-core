import { Tile } from "../tile";
import type { Player } from "../../player";
import type { World } from "../world";
import type { TileData } from "../types";
import { TileExtraTypes, TileFlags } from "../constants";
import { TANK_PACKET_TYPE } from "../../../constants";
import { GameUpdatePacket } from "../../packets/game-packet";
import { Variant } from "../../packets/variants";
import type { ExtendBuffer } from "../../../utils/extend-buffer";

/**
 * Villain Portraits awarded when defeating a Crime In Progress (#2302).
 */
export const VILLAIN_PORTRAITS: readonly number[] = [
  2344, // The Firebug
  2346, // Jimmy Snow
  2348, // Big Bertha
  2350, // Shockinator
  2352, // Generic Thug #17
  2354, // Kat 5
  2356, // Professor Pummel
  2358, // Dragon Hand
  2360, // Dr. Destructo
  2362, // Ms. Terry
  2364, // Z. Everett Koop
];

/**
 * Burglar / Crime In Progress tile (#2302, type 57 BURGLAR).
 * Spawned during a Crime Wave (#2382) or placed by builders/superheroes.
 * Punching fights the criminal; when defeated, awards gems, villain portraits,
 * and broadcasts heroic justice across the world.
 */
export class BurglarTile extends Tile {
  public extraType = TileExtraTypes.BURGLAR;

  public constructor(world: World, data: TileData) {
    super(world, data);
  }

  public override async onPunch(player: Player): Promise<boolean> {
    if (this.data.fg !== 2302) return true;

    // Crime In Progress is a villain combat block; anyone can punch to stop the crime!
    this.world.playPositioned("audio/hitman.wav", player.netID);
    this.world.broadcastVariant(Variant.from("OnParticleEffect", 34, [this.data.x * 32 + 16, this.data.y * 32 + 16]));

    // Superheroes and Katana wielders deal extra hit damage
    const isHero = player.playMods.has("hero_suit") || player.playMods.has("transformed");
    const isKatana = player.inventory.clothes.hand === 2592 || player.inventory.clothes.hand === 9058 ||
      player.inventory.clothes.hand === 11118 || player.inventory.clothes.hand === 13710 || player.inventory.clothes.hand === 16428;
    const hitDamage = isHero || isKatana ? 2 : 1;

    this.data.damage = (this.data.damage ?? 0) + hitDamage;

    const breakHits = this.item?.breakHits ?? 8;
    if (this.data.damage >= breakHits) {
      await this.onDestroy(player);
    } else {
      this.world.broadcast(
        GameUpdatePacket.create({
          type: TANK_PACKET_TYPE.TILE_APPLY_DAMAGE,
          netID: player.netID,
          tileX: this.data.x,
          tileY: this.data.y,
          flags: 0,
        }).parse()!,
      );
    }

    return true;
  }

  public override async onDestroy(player: Player): Promise<void> {
    const tileX = this.data.x;
    const tileY = this.data.y;

    this.data.fg = 0;
    this.data.damage = 0;
    this.data.flags &= ~(TileFlags.TILEEXTRA | TileFlags.OPEN);

    // Audio and visual celebrations
    this.world.playPositioned("audio/cheer.wav", player.netID);
    this.world.broadcastVariant(Variant.from("OnParticleEffect", 46, [tileX * 32 + 16, tileY * 32 + 16]));
    this.world.broadcastVariant(
      Variant.from("OnConsoleMessage", `\`5[CRIME STOPPED] \`w${player.displayName}\`\` defeated the villain and saved the day! Justice reigns!`),
    );
    player.sendTextBubble("`5You defeated the villain and stopped the crime!``", true);

    // Reward: 500-1500 Gems
    const gemsAwarded = Math.floor(Math.random() * 1000) + 500;
    player.addGems(gemsAwarded);
    player.variants.sendOnConsoleMessage(`\`2Received \`$${gemsAwarded} gems\`\` for apprehending the criminal!`);

    // Reward: Random Villain Portrait dropped or added to inventory
    const portraitId = VILLAIN_PORTRAITS[Math.floor(Math.random() * VILLAIN_PORTRAITS.length)] ?? 2360;
    if (player.inventory.canAddItem(portraitId)) {
      player.addItemInven(portraitId, 1);
    } else {
      this.world.drop(player, tileX * 32, tileY * 32, portraitId, 1);
    }

    this.world.broadcast(
      GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.TILE_CHANGE_REQUEST,
        netID: player.netID,
        itemID: 0,
        tileX,
        tileY,
      }).parse()!,
    );

    this.tileUpdate();
    this.world.markDirty();
  }

  public override serialize(buffer: ExtendBuffer): void {
    buffer.writeU8(this.extraType);
    buffer.writeU16(0); // name (empty string)
    buffer.writeU32(0); // target item ID
    buffer.writeU8(0);  // progress byte
  }
}
