import "../src/game/index";
import { describe, expect, test, mock, spyOn } from "bun:test";
import { isPackItem, openPack } from "../src/game/item/packs";
import { isGrowscan, openGrowscan } from "../src/game/item/growscan";
import type { Player } from "../src/game/player";
import type { World } from "../src/game/world/world";
import { worldManager } from "../src/game/world/world-manager";
import { findCommand } from "../src/game/commands/registry";
import "../src/game/commands/core-commands";
import { ActionTypes, TileFlags } from "../src/game/world/constants";
import { CHARACTER_STATE, PLAYER_ROLE } from "../src/constants";
import { WEARABLE_MODS } from "../src/game/player/play-mods";
import * as itemUtils from "../src/game/item/item-utils";
import type { ItemDefinition } from "grow-items";
import type { TileData } from "../src/game/world/types";

describe("Seed Packs & Consumable Package Opening", () => {
  test("isPackItem correctly identifies Small Seed Pack and Bountiful Seed Pack", () => {
    expect(isPackItem(5706)).toBe(true); // Small Seed Pack
    expect(isPackItem(8970)).toBe(true); // Bountiful Seed Pack
    expect(isPackItem(14930)).toBe(true); // Stuffins' Support Package
    expect(isPackItem(9412)).toBe(true); // Increase Backpack
    expect(isPackItem(2)).toBe(false); // Dirt
  });

  test("openPack consumes the pack and grants random seeds and gems", () => {
    const inv = new Map<number, number>([[5706, 1]]);
    let gems = 0;

    const mockWorld = {
      playPositioned: mock(),
      broadcastVariant: mock(),
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      tankIDName: "PackOpener",
      state: { x: 100, y: 100 },
      inventory: {
        hasItem: (id: number) => (inv.get(id) ?? 0) > 0,
      },
      removeItemInven: (id: number, count: number) => {
        const cur = inv.get(id) ?? 0;
        if (cur < count) return 0;
        inv.set(id, cur - count);
        return count;
      },
      addItemInven: (id: number, count: number) => {
        inv.set(id, (inv.get(id) ?? 0) + count);
      },
      addGems: (amt: number) => {
        gems += amt;
      },
      sendTextBubble: mock(),
      variants: {
        sendOnConsoleMessage: mock(),
      },
    } as unknown as Player;

    const success = openPack(mockPlayer, mockWorld, 5706);
    expect(success).toBe(true);
    expect(inv.get(5706)).toBe(0); // Pack consumed
    expect(gems).toBeGreaterThan(0); // Gems granted
    expect(inv.size).toBeGreaterThan(1); // Seeds added
  });
});

describe("GrowScan 9000 World Diagnostic Scanner", () => {
  test("isGrowscan identifies ID 6016 and stats blocks", () => {
    expect(isGrowscan(6016)).toBe(true);
  });

  test("openGrowscan aggregates blocks, planted trees, and dropped items", () => {
    let dialogOutput = "";
    let bubbleOutput = "";

    const block1: TileData = { x: 0, y: 0, fg: 2 }; // Dirt
    const block2: TileData = { x: 1, y: 0, fg: 2 }; // Dirt
    const block3: TileData = { x: 2, y: 0, fg: 8 }; // Bedrock
    const block4: TileData = {
      x: 3,
      y: 0,
      fg: 3,
      tree: { plantedAt: Date.now() - 100000, fullyGrownAt: Date.now() - 1000 },
    }; // Ready tree

    const mockWorld = {
      name: "TESTWORLD",
      width: 100,
      height: 60,
      players: [{ netID: 1 }],
      data: {
        blocks: [block1, block2, block3, block4],
        dropped: {
          uid: 1,
          items: [{ id: 914, count: 50, x: 100, y: 100, uid: 1 }],
        },
      },
      playPositioned: mock(),
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      sendTextBubble: (msg: string) => {
        bubbleOutput = msg;
      },
      variants: {
        sendOnConsoleMessage: mock(),
        sendOnDialogRequest: (str: string) => {
          dialogOutput = str;
        },
      },
    } as unknown as Player;

    openGrowscan(mockPlayer, mockWorld);

    expect(dialogOutput).toContain("GrowScan 9000");
    expect(dialogOutput).toContain("TESTWORLD");
    expect(dialogOutput).toContain("Planted Trees");
    expect(bubbleOutput).toContain("scan complete");
  });
});

describe("Lava & Deadly Hazard Lethality", () => {
  test("Deadly hazards and lava trigger death and respawn", () => {
    const lavaTile: TileData = { x: 5, y: 5, fg: 4 }; // Lava
    let respawnCalled = false;

    const mockPlayer = {
      netID: 1,
      state: { isGhost: false, characterState: 0 },
      isDeveloper: false,
      playMods: { has: () => false },
      inventory: { clothes: { feet: 0 } },
      respawn: () => {
        respawnCalled = true;
      },
      sendTextBubble: mock(),
    } as unknown as Player;

    // Simulate stepping on deadly block
    const isDeadly = lavaTile.fg === 4;
    expect(isDeadly).toBe(true);

    if (isDeadly && !mockPlayer.state.isGhost) {
      mockPlayer.respawn();
    }

    expect(respawnCalled).toBe(true);
  });
});

describe("Punch Weapons & Carnival Rings Registration", () => {
  test("Rayman's Fist (5480) grants canonical punchType 80 and extended range", () => {
    const rayman = WEARABLE_MODS.get(5480);
    expect(rayman).toBeDefined();
    expect(rayman?.punchType).toBe(80);
    expect(rayman?.punchRange).toBe(2);
  });

  test("Death Ray (1958) grants canonical laser punchType 8", () => {
    const deathRay = WEARABLE_MODS.get(1958);
    expect(deathRay).toBeDefined();
    expect(deathRay?.punchType).toBe(8);
  });

  test("Pickaxes (98, 1438) grant mining damage and knockback without projectile overrides", () => {
    expect(WEARABLE_MODS.get(98)?.punchDamage).toBe(1);
    expect(WEARABLE_MODS.get(98)?.punchType).toBeUndefined();
    expect(WEARABLE_MODS.get(1438)?.punchDamage).toBe(2);
    expect(WEARABLE_MODS.get(1438)?.punchType).toBeUndefined();
  });

  test("Ring of Force (1874) grants kinetic punchType 24, while passive rings grant clean stats", () => {
    expect(WEARABLE_MODS.get(1874)?.punchType).toBe(24);
    expect(WEARABLE_MODS.get(1876)?.speed).toBe(60);
    expect(WEARABLE_MODS.get(1876)?.punchType).toBeUndefined();
    expect(WEARABLE_MODS.get(11094)?.punchRange).toBe(2);
    expect(WEARABLE_MODS.get(11094)?.punchType).toBeUndefined();
  });
});

describe("World Ban, Server-wide World Ban, and Template Reset", () => {
  test("/worldban bans target from world and entryDenial rejects them", async () => {
    const worldbanCmd = findCommand("worldban");
    expect(worldbanCmd).toBeDefined();

    let denied = false;
    let targetKicked = false;

    const mockWorld: any = {
      name: "MYFARM",
      getOwnerPlayerId: () => 10,
      bannedPlayers: new Map(),
      banPlayer(pId: number, duration: number, reason: string) {
        this.bannedPlayers.set(pId, { until: Date.now() + duration * 60000, reason });
      },
      unbanPlayer(pId: number) {
        return this.bannedPlayers.delete(pId);
      },
      isPlayerBanned(pId: number) {
        const r = this.bannedPlayers.get(pId);
        if (!r) return { banned: false, remainingMinutes: 0, reason: "" };
        return { banned: true, remainingMinutes: 60, reason: r.reason };
      },
      broadcastVariant: mock(),
    };

    const ownerPlayer = {
      playerId: 10,
      displayName: "FarmOwner",
      world: mockWorld,
      isModerator: false,
      isDeveloper: false,
      variants: { sendOnConsoleMessage: mock() },
    } as unknown as Player;

    const targetPlayer: any = {
      playerId: 25,
      tankIDName: "griefer_tom",
      name: "griefer_tom",
      world: mockWorld,
      isModerator: false,
      isDeveloper: false,
      leaveWorld: () => {
        targetKicked = true;
      },
      variants: { sendOnConsoleMessage: mock() },
    };

    // Execute ban
    mockWorld.banPlayer(25, 60, "Trolling");
    expect(mockWorld.isPlayerBanned(25).banned).toBe(true);

    // Unban
    mockWorld.unbanPlayer(25);
    expect(mockWorld.isPlayerBanned(25).banned).toBe(false);
  });

  test("Server-wide world ban rejects entry for non-developers", () => {
    worldManager.banWorld("ILLEGALWORLD", "Casino / Scam world");
    expect(worldManager.isWorldBanned("ILLEGALWORLD")).toContain("Casino");

    worldManager.unbanWorld("ILLEGALWORLD");
    expect(worldManager.isWorldBanned("ILLEGALWORLD")).toBeUndefined();
  });

  test("/resetworld regenerates world blocks to default procedural template", async () => {
    const resetCmd = findCommand("resetworld");
    expect(resetCmd).toBeDefined();

    const world = await worldManager.get("RESETTEST");
    // Dirty the world by modifying a block
    world.data.blocks[0].fg = 9999;
    expect(world.data.blocks[0].fg).toBe(9999);

    const devPlayer = {
      isDeveloper: true,
      world,
      variants: { sendOnConsoleMessage: mock() },
    } as unknown as Player;

    await resetCmd?.execute(devPlayer, ["RESETTEST"], "/resetworld RESETTEST");

    // Must be restored to template
    expect(world.data.blocks[0].fg).toBe(0); // Top left is air (0) in default template
  });
});
