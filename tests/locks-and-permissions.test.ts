import "../src/game/index";
import { describe, expect, test, beforeAll, beforeEach, afterEach } from "bun:test";
import { init as initWasm } from "../src/services/wasm-init";
import { initItems } from "../src/game/item/item-info";
import { World } from "../src/game/world/world";
import type { TileData, WorldData } from "../src/game/world/types";
import { tileFrom } from "../src/game/world/tiles";
import { ITEM_ID, LockPermission, TileFlags } from "../src/game/world/constants";
import { handleChatInput } from "../src/game/network/chat-handler";
import { dialogs } from "../src/game/network/dialog-handler";
import { TextParser } from "../src/utils/text-parser";
import { serverManager } from "../src/game/server/server-manager";

function createMockWorld(name = "LOCKTEST"): World {
  const blocks: TileData[] = [];
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 100; x++) {
      blocks.push({
        fg: y >= 30 ? (y === 59 ? ITEM_ID.BEDROCK : ITEM_ID.DIRT) : 0,
        bg: y >= 30 ? 14 : 0,
        x,
        y,
        flags: 0,
      });
    }
  }
  const data: WorldData = {
    name,
    width: 100,
    height: 60,
    blocks,
    dropped: { uid: 0, items: [] },
    weather: { id: 41 },
  };
  return new World(data);
}

function createMockPlayer(id: number, name: string, world?: World) {
  const items = new Map<number, number>();
  const sentConsole: string[] = [];
  const sentBubbles: string[] = [];
  const sentDialogs: string[] = [];

  const player: any = {
    id: `server-17091:${id}`,
    playerId: id,
    netID: id,
    displayName: name,
    tankIDName: name,
    role: 0,
    isDeveloper: false,
    isModerator: false,
    isGuardian: false,
    world,
    state: {
      x: 100 * 32,
      y: 20 * 32,
      characterState: 0,
      isGhost: false,
      isMuted: false,
      rotatedLeft: false,
      world: { name: world?.name ?? "" },
    },
    inventory: {
      items,
      clothes: { hair: 0, shirt: 0, pants: 0, feet: 0, face: 0, hand: 0, back: 0, mask: 0, neck: 0, ances: 0 },
      hasItem(itemId: number) {
        return (items.get(itemId) ?? 0) > 0;
      },
      getAmount(itemId: number) {
        return items.get(itemId) ?? 0;
      },
      addItem(itemId: number, count: number) {
        items.set(itemId, (items.get(itemId) ?? 0) + count);
      },
      removeItem(itemId: number, count: number) {
        const cur = items.get(itemId) ?? 0;
        if (cur <= count) items.delete(itemId);
        else items.set(itemId, cur - count);
      },
      canAddItem() {
        return true;
      },
    },
    addItemInven(itemId: number, count: number) {
      this.inventory.addItem(itemId, count);
    },
    removeItemInven(itemId: number, count: number) {
      this.inventory.removeItem(itemId, count);
    },
    sendInventory() {},
    sendClothesToWorld() {},
    sendSfx() {},
    sendBuffer() {},
    send() {},
    variants: {
      sendOnConsoleMessage(msg: string) {
        sentConsole.push(msg);
      },
      sendOnTalkBubble(netID: number, msg: string) {
        sentBubbles.push(msg);
      },
      sendOnDialogRequest(dialog: string) {
        sentDialogs.push(dialog);
      },
      sendOnSpawn() {},
      sendOnSetPos() {},
      sendClothes() {},
      sendOnSetCurrentWeather() {},
      sendOnEmoticonDataChanged() {},
      buildCharacterState() {
        return Buffer.alloc(0);
      },
    },
    sendTextBubble(msg: string) {
      sentBubbles.push(msg);
    },
    playMods: {
      has() {
        return false;
      },
      add() {},
      delete() {},
    },
    get isWorldOwner() {
      return this.world?.getOwnerPlayerId() === this.playerId;
    },
    get formattedName() {
      if (this.isWorldOwner) {
        if (this.world?.isRoyalLocked) return `\`^👑 ${this.displayName}\`\``;
        return `\`2${this.displayName}\`\``;
      }
      if (this.world?.isWorldAdmin(this.playerId)) {
        if (this.world?.isRoyalLocked) return `\`^⚔️ ${this.displayName}\`\``;
        return `\`2${this.displayName}\`\``;
      }
      return `\`w${this.displayName}\`\``;
    },
    sentConsole,
    sentBubbles,
    sentDialogs,
  };

  serverManager.players.set(player.id, player);
  return player;
}

describe("world locks and special lock behaviors", () => {
  beforeAll(async () => {
    await initWasm();
    await initItems();
  });
  beforeEach(() => {
    serverManager.players.clear();
  });

  afterEach(() => {
    serverManager.players.clear();
  });

  test("world lock placement claims world ownership and restricts non-admins", async () => {
    const world = createMockWorld("START");
    const owner = createMockPlayer(100, "DarkMaster", world);
    const visitor = createMockPlayer(200, "VisitorGuy", world);

    owner.inventory.addItem(ITEM_ID.WORLD_LOCK, 1);
    const tile = world.getTileAt(10, 20)!;
    expect(tile.fg).toBe(0);

    const lockTile = tileFrom(world, tile, 3, ITEM_ID.WORLD_LOCK);
    const placed = await lockTile.onPlaceForeground(owner, { id: ITEM_ID.WORLD_LOCK, name: "World Lock", type: 3 } as any);
    expect(placed).toBe(true);

    expect(world.isWorldLocked).toBe(true);
    expect(world.getOwnerPlayerId()).toBe(100);
    expect(owner.isWorldOwner).toBe(true);
    expect(owner.formattedName).toContain("`2DarkMaster");

    // Owner has build & break permissions everywhere
    const dirtTile = world.getTileAt(15, 35)!;
    expect(await world.hasTilePermission(owner, dirtTile, LockPermission.BUILD)).toBe(true);
    expect(await world.hasTilePermission(owner, dirtTile, LockPermission.BREAK)).toBe(true);

    // Visitor without access is denied
    expect(await world.hasTilePermission(visitor, dirtTile, LockPermission.BUILD)).toBe(false);
    expect(await world.hasTilePermission(visitor, dirtTile, LockPermission.BREAK)).toBe(false);

    // Punch fail tells visitor that world is owned
    visitor.sentBubbles.length = 0;
    await tileFrom(world, dirtTile).onPunchFail(visitor);
    expect(visitor.sentBubbles.some((b) => b.includes("This world is owned by DarkMaster"))).toBe(true);
  });

  test("breaking world lock removes world ownership and clears owner state", async () => {
    const world = createMockWorld("FARM");
    const owner = createMockPlayer(100, "WorldOwner", world);

    owner.inventory.addItem(ITEM_ID.WORLD_LOCK, 1);
    const tile = world.getTileAt(5, 5)!;
    const lockTile = tileFrom(world, tile, 3, ITEM_ID.WORLD_LOCK);
    await lockTile.onPlaceForeground(owner, { id: ITEM_ID.WORLD_LOCK, name: "World Lock", type: 3 } as any);

    expect(world.isWorldLocked).toBe(true);
    expect(world.getOwnerPlayerId()).toBe(100);

    // Owner breaks the lock
    await tileFrom(world, tile).onDestroy(owner);

    expect(world.isWorldLocked).toBe(false);
    expect(world.getOwnerPlayerId()).toBeUndefined();
    expect(owner.isWorldOwner).toBe(false);
    expect(owner.formattedName).toBe("`wWorldOwner``");
  });

  test("builder's lock honors build_only and break_only modes", async () => {
    const world = createMockWorld("BUILDTEST");
    const owner = createMockPlayer(100, "BobTheBuilder", world);
    const worker = createMockPlayer(200, "Worker1", world);

    owner.inventory.addItem(ITEM_ID.BUILDERS_LOCK, 1);
    const lockPos = world.getTileAt(20, 20)!;
    const lockTile = tileFrom(world, lockPos, 3, ITEM_ID.BUILDERS_LOCK);
    const placed = await lockTile.onPlaceForeground(owner, { id: ITEM_ID.BUILDERS_LOCK, name: "Builder's Lock", type: 3 } as any);
    expect(placed).toBe(true);

    const neighborTile = world.getTileAt(20, 21)!;
    expect(neighborTile.lockedBy).toBeDefined();

    // 1. By default, Builder's Lock is BREAK ONLY when public
    lockPos.flags |= TileFlags.PUBLIC;
    lockPos.lock!.permission = LockPermission.BREAK;

    // Worker can BREAK, but CANNOT BUILD
    expect(await world.hasTilePermission(worker, neighborTile, LockPermission.BREAK)).toBe(true);
    expect(await world.hasTilePermission(worker, neighborTile, LockPermission.BUILD)).toBe(false);

    // Place fail on Builder's Lock explains break-only
    worker.sentBubbles.length = 0;
    await tileFrom(world, neighborTile).onPlaceFail(worker);
    expect(worker.sentBubbles).toContain("This lock allows breaking only!");

    // 2. Switch Builder's Lock to BUILD ONLY via dialog
    const handler = dialogs.get("area_lock_edit")!;
    expect(handler).toBeDefined();

    const editAction = new TextParser();
    editAction.parse(
      `dialog_name|area_lock_edit\ntilex|20\ntiley|20\nallow_break_build|1\nbuild_only|1\nlimit_admin|0\n`,
    );
    await handler(owner, editAction);

    expect(lockPos.lock!.permission).toBe(LockPermission.BUILD);

    // Worker can BUILD, but CANNOT BREAK
    expect(await world.hasTilePermission(worker, neighborTile, LockPermission.BUILD)).toBe(true);
    expect(await world.hasTilePermission(worker, neighborTile, LockPermission.BREAK)).toBe(false);

    // Punch fail on Builder's Lock explains build-only
    worker.sentBubbles.length = 0;
    await tileFrom(world, neighborTile).onPunchFail(worker);
    expect(worker.sentBubbles).toContain("This lock allows building only!");
  });

  test("royal lock provides crown title, royal decree, and silence peasants mutes visitors", async () => {
    const world = createMockWorld("KINGDOM");
    const king = createMockPlayer(1, "Arthur", world);
    const peasant = createMockPlayer(999, "PeasantJoe", world);

    king.inventory.addItem(ITEM_ID.ROYAL_LOCK, 1);
    const lockPos = world.getTileAt(10, 10)!;
    const lockTile = tileFrom(world, lockPos, 3, ITEM_ID.ROYAL_LOCK);
    await lockTile.onPlaceForeground(king, { id: ITEM_ID.ROYAL_LOCK, name: "Royal Lock", type: 3 } as any);

    expect(world.isWorldLocked).toBe(true);
    expect(world.isRoyalLocked).toBe(true);
    expect(king.formattedName).toContain("👑 Arthur");

    // Configure Royal Lock: Silence Peasants & Royal Decree
    const handler = dialogs.get("area_lock_edit")!;
    const editAction = new TextParser();
    editAction.parse(
      `dialog_name|area_lock_edit\ntilex|10\ntiley|10\nallow_break_build|0\nsilence_peasants|1\nroyal_rainbows|1\nroyal_decree|All hail the King!\n`,
    );
    await handler(king, editAction);

    expect(lockPos.worldLockData?.silencePeasants).toBe(true);
    expect(lockPos.worldLockData?.royalDecree).toBe("All hail the King!");
    expect(world.isSilencePeasantsActive(peasant.playerId)).toBe(true);
    expect(world.isSilencePeasantsActive(king.playerId)).toBe(false);

    // Peasant tries to chat in kingdom -> muted by Silence Peasants!
    peasant.sentBubbles.length = 0;
    await handleChatInput(peasant, "Hello everyone");
    expect(peasant.sentBubbles.some((b) => b.includes("Silence, peasants! You cannot speak in the King's realm."))).toBe(true);

    // King can speak freely
    king.sentBubbles.length = 0;
    await handleChatInput(king, "Welcome to my realm!");
    expect(king.sentBubbles.some((b) => b.includes("Silence, peasants"))).toBe(false);
  });
});
