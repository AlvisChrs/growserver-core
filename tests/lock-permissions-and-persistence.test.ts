import { describe, expect, it } from "bun:test";
import { World } from "../src/game/world/world";
import { LockPermission, ITEM_ID } from "../src/game/world/constants";
import { PLAYER_ROLE } from "../src/constants";
import { encodeWorldFile, decodeWorldFile } from "../src/game/world/world-manager";
import type { WorldData } from "../src/game/world/types";

function createTestWorld(name: string): World {
  const blocks: any[] = [];
  for (let i = 0; i < 6000; i++) {
    blocks.push({
      fg: i === 3000 ? 2 : 0, // Tile 3000 has Dirt (2)
      bg: 0,
      x: i % 100,
      y: Math.floor(i / 100),
      flags: 0,
      damage: 0,
    });
  }

  const worldData: WorldData = {
    name,
    width: 100,
    height: 60,
    blockCount: 6000,
    blocks,
    weather: { id: 0 },
    dropped: { items: [], uid: 0 },
  };

  return new World(worldData);
}

function createPlayer(id: number, role: PLAYER_ROLE) {
  return {
    id: `server-17091:${id}`,
    netID: id,
    playerId: id,
    displayName: `Player${id}`,
    role,
    realRole: role,
    isDeveloper: role >= PLAYER_ROLE.DEVELOPER,
    isModerator: role >= PLAYER_ROLE.MODERATOR,
    friends: new Set<number>(),
    incomingFriendRequests: new Set<number>(),
    guildId: null,
    guildRole: null,
    state: { x: 0, y: 0, characterState: 0 },
    inventory: { hasItem: () => true, removeItem: () => true, addItem: () => true },
    variants: { sendOnConsoleMessage: () => {}, sendOnTalkBubble: () => {} },
    sendTextBubble: () => {},
    sendPlayPositioned: () => {},
  } as any;
}

describe("Lock System Permissions & Persistence", () => {
  it("prevents unauthorized users from building and breaking in locked worlds", async () => {
    const world = createTestWorld("LOCKTEST1");
    const owner = createPlayer(100, PLAYER_ROLE.BASIC);
    const friend = createPlayer(101, PLAYER_ROLE.BASIC);
    const stranger = createPlayer(102, PLAYER_ROLE.BASIC);
    const moderator = createPlayer(200, PLAYER_ROLE.MODERATOR);
    const developer = createPlayer(300, PLAYER_ROLE.DEVELOPER);

    // Place World Lock at tile index 0
    const lockTile = world.data.blocks[0]!;
    lockTile.fg = ITEM_ID.WORLD_LOCK;
    lockTile.lock = {
      ownerPlayerId: owner.playerId,
      adminIds: [friend.playerId],
      permission: LockPermission.NONE,
      adminLimited: false,
      ignoreEmptyAir: false,
      ownedTiles: [],
    };
    lockTile.worldLockData = {
      bpm: 100,
      customMusicBlocksDisabled: false,
      invisMusicBlocks: false,
      minLevel: 1,
    };
    world.data.worldLockIndex = 0;

    const targetTile = world.data.blocks[3000]!; // Dirt tile

    // 1. Owner: CAN break and build
    expect(await world.hasTilePermission(owner, targetTile, LockPermission.BREAK)).toBe(true);
    expect(await world.hasTilePermission(owner, targetTile, LockPermission.BUILD)).toBe(true);

    // 2. Friend (Given access in adminIds): CAN break and build
    expect(await world.hasTilePermission(friend, targetTile, LockPermission.BREAK)).toBe(true);
    expect(await world.hasTilePermission(friend, targetTile, LockPermission.BUILD)).toBe(true);

    // 3. Stranger (No access): CANNOT break or build
    expect(await world.hasTilePermission(stranger, targetTile, LockPermission.BREAK)).toBe(false);
    expect(await world.hasTilePermission(stranger, targetTile, LockPermission.BUILD)).toBe(false);

    // 4. Moderator & Developer: CAN break and build (administrative bypass)
    expect(await world.hasTilePermission(moderator, targetTile, LockPermission.BREAK)).toBe(true);
    expect(await world.hasTilePermission(moderator, targetTile, LockPermission.BUILD)).toBe(true);
    expect(await world.hasTilePermission(developer, targetTile, LockPermission.BREAK)).toBe(true);
    expect(await world.hasTilePermission(developer, targetTile, LockPermission.BUILD)).toBe(true);
  });

  it("persists world lock ownership and settings across encode and decode", () => {
    const world = createTestWorld("SAVELOCKTEST");
    const lockTile = world.data.blocks[50]!;
    lockTile.fg = ITEM_ID.WORLD_LOCK;
    lockTile.lock = {
      ownerPlayerId: 777,
      adminIds: [888, 999],
      permission: LockPermission.NONE,
      adminLimited: false,
      ignoreEmptyAir: false,
      ownedTiles: [],
    };
    lockTile.worldLockData = {
      bpm: 120,
      customMusicBlocksDisabled: true,
      invisMusicBlocks: false,
      minLevel: 5,
    };
    world.data.worldLockIndex = 50;

    // Encode to binary buffer (as saved to disk)
    const encoded = encodeWorldFile(world.data);
    expect(encoded.length).toBeGreaterThan(0);

    // Decode from binary buffer (as loaded from disk)
    const decoded = decodeWorldFile(encoded);
    const restoredWorld = new World(decoded);

    expect(restoredWorld.isWorldLocked).toBe(true);
    expect(restoredWorld.getOwnerPlayerId()).toBe(777);
    const restoredLock = restoredWorld.worldLockTile;
    expect(restoredLock).toBeDefined();
    expect(restoredLock?.lock?.ownerPlayerId).toBe(777);
    expect(restoredLock?.lock?.adminIds).toEqual([888, 999]);
    expect(restoredLock?.worldLockData?.bpm).toBe(120);
    expect(restoredLock?.worldLockData?.minLevel).toBe(5);
  });
});
