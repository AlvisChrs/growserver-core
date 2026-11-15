import { CHARACTER_STATE, TANK_PACKET_TYPE } from "../../constants";
import { logger } from "../../utils/logger";
import { placeWithMagplantRemote } from "../world/magplant";
import { getItem } from "../item/item-utils";
import { useConsumable } from "../item/consumables";
import { isPackItem } from "../item/packs";
import { isGrowscan, openGrowscan } from "../item/growscan";
import type { GameUpdatePacket } from "../packets/game-packet";
import { Variant } from "../packets/variants";
import type { Player } from "../player";
import { FULL_BODY_SUITS, MORPH_ITEMS } from "../player/transform";
import { ActionTypes, ITEM_ID, LockPermission, TileFlags } from "../world/constants";
import { isPlaceableType, tileFrom } from "../world/tiles";
import type { World } from "../world/world";
import { worldManager } from "../world/world-manager";
import { handleFishingCast, handleFishingMovement, handleFishingPunch } from "../fishing/fishing-manager";
import { tickGeiger } from "../geiger/geiger-manager";
import { handleSurgeryWrench } from "../surgery/surgery-manager";
import { DEAD_GEIGER_COUNTER, depositDeadGeiger } from "../world/tiles/geiger-charger-tile";
import { loadLobsterTrap } from "../world/tiles/lobster-trap-tile";
import {
  handleCookingItemActivate,
  handleCuttingBoardSlice,
  handleFoodGrinderUse,
  handleFoodGrinderWrench,
  handleOvenItemPlace,
} from "../cooking/cooking-manager";

type TankHandler = (player: Player, tank: GameUpdatePacket, world: World) => Promise<void> | void;

/** Player movement and punch/build input. */
function State(player: Player, tank: GameUpdatePacket, world: World): void {
  const data = tank.data;
  data.netID = player.netID;

  player.state.x = data.posX;
  player.state.y = data.posY;
  player.state.rotatedLeft = (data.flags & 0x10) !== 0;
  // walking in or out of a music block's radius starts or stops its stream
  world.syncMusic();

  handleFishingMovement(player, world);
  tickGeiger(player);

  world.broadcast(tank.parse()!, player.id);

  // Royal Lock rainbow trail for owner, admins, and developers when enabled
  if (world.isRoyalLocked && world.worldLockTile?.worldLockData?.royalRainbows) {
    if (world.getOwnerPlayerId() === player.playerId || world.isWorldAdmin(player.playerId) || player.isDeveloper) {
      const now = Date.now();
      if (now - (player.lastRainbowAt ?? 0) >= 300) {
        player.lastRainbowAt = now;
        world.broadcastVariant(Variant.from("OnParticleEffect", 14, [data.posX + 10, data.posY + 16]));
      }
    }
  }

  // tile the player is standing on, only reported when not punching
  if (data.tileX > 0 || data.tileY > 0) return;
  const block =
    world.getTileAt(Math.floor((data.posX + 10) / 32), Math.floor((data.posY + 15) / 32)) ??
    world.getTileAt(Math.floor(data.posX / 32), Math.floor(data.posY / 32));
  if (!block) return;

  const item = getItem(block.fg || block.bg);
  if (item?.type === ActionTypes.CHECKPOINT) {
    const index = block.x + block.y * world.width;
    player.variants.sendVariant(Variant.from({ netID: player.netID, delay: 0 }, "SetRespawnPos", index));
    player.lastCheckpoint = { x: block.x, y: block.y };
  }

  // Lava and deadly hazard check
  const fgItem = getItem(block.fg);
  const isDeadlyHazard =
    block.fg === 4 ||
    fgItem?.type === ActionTypes.LAVA ||
    fgItem?.type === ActionTypes.DEADLY_BLOCK ||
    fgItem?.type === ActionTypes.POINTY;

  if (isDeadlyHazard && !player.state.isGhost) {
    const isImmune =
      (player.isDeveloper && (player.state.characterState & CHARACTER_STATE.WALK_IN_BLOCKS) !== 0) ||
      player.playMods.has("antidote") ||
      player.inventory.clothes.feet === 622; // Fireproof Boots

    if (!isImmune) {
      player.respawn();
      player.sendTextBubble("`4Ouch! That's deadly!``", true);
      world.playPositioned("audio/burn.wav", player.netID);
      return;
    }
  }
}

/**
 * Rayman's Fist punches two more tiles beyond the one hit, continuing in the
 * punch direction: sideways when the target is on the player's row, up or
 * down when it is on the player's column, diagonally otherwise.
 */
async function raymanPunch(player: Player, world: World, data: GameUpdatePacket["data"]): Promise<void> {
  const playerTileX = Math.floor(data.posX / 32);
  const playerTileY = Math.floor(data.posY / 32);
  const facing = player.state.rotatedLeft ? -1 : 1;
  const vertical = data.tileY < playerTileY ? -1 : 1;

  let dx: number;
  let dy: number;
  if (data.tileY === playerTileY) {
    dx = facing;
    dy = 0;
  } else if (data.tileX === playerTileX) {
    dx = 0;
    dy = vertical;
  } else {
    dx = facing;
    dy = vertical;
  }

  for (let step = 1; step <= 2; step++) {
    const block = world.getTileAt(data.tileX + dx * step, data.tileY + dy * step);
    if (!block || (block.fg === 0 && block.bg === 0)) continue;
    await tileFrom(world, block).onPunch(player);
  }
}

/** Punch, wrench or place on a tile. */
async function TileChangeRequest(player: Player, tank: GameUpdatePacket, world: World): Promise<void> {
  const data = tank.data;
  const block = world.getTileAt(data.tileX, data.tileY);
  if (!block) return;
  if (data.itemID === ITEM_ID.MAGPLANT_REMOTE) {
    if (player.inventory.hasItem(ITEM_ID.MAGPLANT_REMOTE)) await placeWithMagplantRemote(player, world, block);
    return;
  }

  if (data.itemID === ITEM_ID.FIST) {
    if (handleFishingPunch(player, world)) return;
    if (await handleCuttingBoardSlice(player, world, block)) return;
    await tileFrom(world, block).onPunch(player);
    if (player.inventory.clothes.hand === ITEM_ID.RAYMANS_FIST) await raymanPunch(player, world, data);
  } else if (data.itemID === ITEM_ID.WRENCH) {
    if (handleSurgeryWrench(player, world, data.tileX, data.tileY, block.fg)) return;
    if (handleFoodGrinderWrench(player, block)) return;
    await tileFrom(world, block).onWrench(player);
  } else {
    const itemMeta = getItem(data.itemID);
    if (!itemMeta) return;
    const type = itemMeta.type ?? ActionTypes.FOREGROUND;

    // bait on a lobster trap loads it instead of casting
    if (await loadLobsterTrap(player, world, block, itemMeta.id ?? 0)) return;
    // items used on a Food Grinder or Cooking Oven go into the appliance before consumable/fishing checks
    if (handleFoodGrinderUse(player, block, itemMeta.id ?? 0)) return;
    if (await handleOvenItemPlace(player, world, block, itemMeta.id ?? 0)) return;

    if (await handleFishingCast(player, world, data.itemID, data.tileX, data.tileY)) return;

    if (isGrowscan(itemMeta.id ?? 0)) {
      openGrowscan(player, world);
      return;
    }

    if (type === ActionTypes.CONSUMABLE || isPackItem(itemMeta.id ?? 0)) {
      await useConsumable(player, world, itemMeta, data.tileX, data.tileY);
      return;
    }

    // the Dead Geiger Counter is a wearable item, but using it on a Geiger
    // Charger drops it in to charge
    if (itemMeta.id === DEAD_GEIGER_COUNTER && (await depositDeadGeiger(player, world, block))) return;

    // clothes are never placed. Used on the player's own tile they toggle
    // wear/unwear, anywhere else the click is ignored
    if (type === ActionTypes.CLOTHES || type === ActionTypes.ANCES) {
      if (itemMeta.id === 3172 && player.playMods.has("malpractice")) {
        player.equipClothes(3172);
        return;
      }
      const ownX = Math.floor((player.state.x + 10) / 32);
      const ownY = Math.floor((player.state.y + 16) / 32);
      if (data.tileX === ownX && data.tileY === ownY) player.equipClothes(itemMeta.id ?? 0);
      return;
    }

    if (!isPlaceableType(type)) {
      player.sendTextBubble("That item isn't supported on this server yet.");
      return;
    }

    if (type === ActionTypes.BACKGROUND) {
      // keep the current foreground behaviour
      await tileFrom(world, block).onPlaceBackground(player, itemMeta);
    } else if (block.fg === 0) {
      await tileFrom(world, block, type, itemMeta.id).onPlaceForeground(player, itemMeta);
    } else {
      await tileFrom(world, block).onItemPlace(player, itemMeta);
    }
  }

  world.markDirty();
}

/** Door usage. */
async function TileActivateRequest(player: Player, tank: GameUpdatePacket, world: World): Promise<void> {
  const block = world.getTileAt(tank.data.tileX, tank.data.tileY);
  // the main door always leads out, even when its door data went missing
  if (block?.fg === ITEM_ID.MAIN_DOOR) return player.leaveWorld();
  if (!block?.door) return;

  // Private door check: only owner, lock admins, or developers can enter non-public doors
  if (!(block.flags & TileFlags.PUBLIC) && !player.isDeveloper && !(await world.hasTilePermission(player, block, LockPermission.BUILD))) {
    player.sendTextBubble("`4This door is locked!``", true);
    player.variants.sendOnPlayPositioned("audio/door_shut.wav", player.netID);
    return;
  }

  const [rawWorld, rawId] = (block.door.destination ?? "").split(":");
  const targetWorld = rawWorld?.trim().toUpperCase() || world.name;
  const targetId = rawId?.trim().toUpperCase() ?? "";

  if (targetWorld === "EXIT") return player.leaveWorld();

  if (targetWorld === world.name) {
    const door = (targetId && world.data.blocks.find((b) => b.door?.id?.toUpperCase() === targetId)) || world.mainDoor;
    const x = (door?.x ?? 0) * 32;
    const y = (door?.y ?? 0) * 32;

    player.state.x = x;
    player.state.y = y;
    player.variants.sendOnZoomCamera(10000, 1000);
    for (const other of world.players) {
      other.variants.sendOnSetFreezeState(player.netID, false);
      other.variants.sendOnSetPos(player.netID, x, y);
      other.variants.sendOnPlayPositioned("audio/door_open.wav", player.netID);
    }
    return;
  }

  const destination = await worldManager.get(targetWorld);
  const door = (targetId && destination.data.blocks.find((b) => b.door?.id?.toUpperCase() === targetId)) || destination.mainDoor;
  await player.enterWorld(targetWorld, door?.x, door?.y);
}

/** Picking up a dropped item. */
function ItemActivateObjectRequest(player: Player, tank: GameUpdatePacket, world: World): void {
  if (player.state.isGhost) return;
  world.collect(player, tank.data.itemID);
}

/** Using an item from the backpack: wear clothes, convert locks. */
async function ItemActivateRequest(player: Player, tank: GameUpdatePacket): Promise<void> {
  const itemId = tank.data.itemID;
  const item = getItem(itemId);
  if (!item || !player.inventory.hasItem(itemId)) return;

  if (await handleCookingItemActivate(player, itemId)) return;

  if (item.type === ActionTypes.LOCK) {
    const convert = (from: number, fromAmount: number, to: number, toAmount: number, message: string, tooMany: string) => {
      if (player.inventory.getAmount(from) < fromAmount) return;
      if (player.inventory.getAmount(to) + toAmount > 200) {
        player.sendTextBubble(tooMany);
        return;
      }
      player.removeItemInven(from, fromAmount);
      player.addItemInven(to, toAmount);
      player.sendTextBubble(message);
    };

    switch (itemId) {
      case ITEM_ID.BLUE_GEM_LOCK:
        convert(ITEM_ID.BLUE_GEM_LOCK, 1, ITEM_ID.DIAMOND_LOCK, 100, "You shattered a Blue Gem Lock into 100 Diamond Locks!", "Whoops, you're holding too many Diamond Locks!");
        break;
      case ITEM_ID.DIAMOND_LOCK:
        convert(ITEM_ID.DIAMOND_LOCK, 1, ITEM_ID.WORLD_LOCK, 100, "You shattered a Diamond Lock into 100 World Locks!", "Whoops, you're holding too many World Locks!");
        break;
      case ITEM_ID.WORLD_LOCK:
        convert(ITEM_ID.WORLD_LOCK, 100, ITEM_ID.DIAMOND_LOCK, 1, "You compressed 100 World Locks into a Diamond Lock!", "Whoops, you're holding too many Diamond Locks!");
        break;
    }
    await player.saveToDatabase();
    return;
  }

  if (item.type === ActionTypes.CLOTHES || item.type === ActionTypes.ANCES) {
    player.equipClothes(itemId);
    return;
  }

  if (isGrowscan(itemId) && player.world) {
    openGrowscan(player, player.world);
    return;
  }

  // a consumable or pack used from the backpack is used on the player's own tile
  if ((item.type === ActionTypes.CONSUMABLE || isPackItem(itemId)) && player.world) {
    await useConsumable(player, player.world, item, Math.floor((player.state.x + 10) / 32), Math.floor((player.state.y + 15) / 32));
  }
}

/** Selected item in the hotbar changed; relay to the world. */
function SetIconState(player: Player, tank: GameUpdatePacket, world: World): void {
  tank.data.netID = player.netID;
  tank.data.flags = player.state.rotatedLeft ? 16 : 0;
  world.broadcast(tank.parse()!, player.id);
}

const TankMap: Partial<Record<number, TankHandler>> = {
  [TANK_PACKET_TYPE.STATE]: State,
  [TANK_PACKET_TYPE.TILE_CHANGE_REQUEST]: TileChangeRequest,
  [TANK_PACKET_TYPE.TILE_ACTIVATE_REQUEST]: TileActivateRequest,
  [TANK_PACKET_TYPE.ITEM_ACTIVATE_OBJECT_REQUEST]: ItemActivateObjectRequest,
  [TANK_PACKET_TYPE.ITEM_ACTIVATE_REQUEST]: ItemActivateRequest,
  [TANK_PACKET_TYPE.SET_ICON_STATE]: SetIconState,
};

/**
 * Dispatches an incoming GAME_PACKET to its handler. Everything except
 * DISCONNECT requires the player to be inside a world.
 */
export async function handleTankPacket(player: Player, tank: GameUpdatePacket): Promise<void> {
  if (tank.data.type === TANK_PACKET_TYPE.DISCONNECT) {
    player.disconnectNow();
    return;
  }

  const world = player.world;
  if (!world) return;

  const handler = TankMap[tank.data.type];
  if (!handler) return;

  try {
    await handler(player, tank, world);
  } catch (err) {
    logger.error({ err, type: TANK_PACKET_TYPE[tank.data.type], player: player.tankIDName }, "failed to handle game packet");
  }
}
