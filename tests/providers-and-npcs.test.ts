import "../src/game/index";
import { describe, expect, spyOn, test, mock, beforeEach, afterEach } from "bun:test";
import * as itemUtils from "../src/game/item/item-utils";
import type { ItemDefinition } from "grow-items";
import { ProviderTile } from "../src/game/world/tiles/provider-tile";
import { NpcTile } from "../src/game/world/tiles/npc-tile";
import { TileFlags, ActionTypes } from "../src/game/world/constants";
import type { TileData } from "../src/game/world/types";
import type { World } from "../src/game/world/world";
import type { Player } from "../src/game/player";
import {
  CARNIVAL_RINGS,
  grantCarnivalRing,
  deliverRingmasterStep,
  ringmasterDialog,
  RINGMASTER_TRIALS,
} from "../src/game/quests/ringmaster-quest";
import { findCommand } from "../src/game/commands/registry";
import "../src/game/commands/core-commands";
import { PLAYER_ROLE } from "../src/constants";

describe("Provider Items & ATM Machine Fixes", () => {
  let getItemSpy: any;

  beforeEach(() => {
    getItemSpy = spyOn(itemUtils, "getItem").mockImplementation(
      (id) =>
        ({
          id,
          name: id === 1008 ? "ATM Machine" : id === 928 ? "Science Station" : `Item #${id}`,
          type: ActionTypes.PROVIDER,
          growTime: id === 1008 ? 79200 : id === 928 ? 43200 : 86400,
          breakHits: 4,
        }) as ItemDefinition,
    );
  });

  afterEach(() => {
    getItemSpy?.mockRestore();
  });

  test("ATM Machine (1008) awards gems and drops gem items", () => {
    let addedGems = 0;
    const droppedItems: { itemId: number; count: number }[] = [];

    const mockWorld = {
      drop: (_p: any, _x: number, _y: number, itemId: number, count: number) => {
        droppedItems.push({ itemId, count });
      },
      playPositioned: mock(),
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      tankIDName: "PlayerOne",
      addGems: (amount: number) => {
        addedGems += amount;
      },
      sendTextBubble: mock(),
      variants: {
        sendOnConsoleMessage: mock(),
      },
      quests: {
        role: () => ({ lvl: 1 }),
        addRoleXp: mock(),
      },
    } as unknown as Player;

    const block: TileData = {
      x: 10,
      y: 10,
      fg: 1008, // ATM Machine
      flags: TileFlags.TILEEXTRA,
      provider: { plantedAt: Date.now() - 100000000 },
    };

    const tile = new ProviderTile(mockWorld, block);
    tile.tileUpdate = mock();

    tile.harvest(mockPlayer, itemUtils.getItem(1008)!);

    // ATM must grant direct gems
    expect(addedGems).toBeGreaterThanOrEqual(50);
    // ATM must also drop gem items (914, 916, 918, 920, 924)
    expect(droppedItems.length).toBeGreaterThan(0);
    expect([914, 916, 918, 920, 924]).toContain(droppedItems[0].itemId);
  });

  test("Science Station (928) drops chemical compounds, NOT gems", () => {
    const droppedItems: { itemId: number; count: number }[] = [];
    const mockWorld = {
      drop: (_p: any, _x: number, _y: number, itemId: number, count: number) => {
        droppedItems.push({ itemId, count });
      },
      playPositioned: mock(),
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      tankIDName: "PlayerOne",
      addGems: mock(),
      sendTextBubble: mock(),
      variants: {
        sendOnConsoleMessage: mock(),
      },
      quests: {
        role: () => ({ lvl: 1 }),
        addRoleXp: mock(),
      },
    } as unknown as Player;

    const block: TileData = {
      x: 10,
      y: 10,
      fg: 928, // Science Station
      flags: TileFlags.TILEEXTRA,
      provider: { plantedAt: Date.now() - 100000000 },
    };

    const tile = new ProviderTile(mockWorld, block);
    tile.tileUpdate = mock();

    tile.harvest(mockPlayer, itemUtils.getItem(928)!);

    // Science Station must drop chemicals (826, 828, 830, 832, 834, 836)
    expect(droppedItems.length).toBeGreaterThan(0);
    expect([826, 828, 830, 832, 834, 836]).toContain(droppedItems[0].itemId);
  });

  test("ProviderTile onWrench shows status, time remaining, and action buttons", async () => {
    let dialogStr = "";
    const mockPlayer = {
      netID: 1,
      isDeveloper: true,
      variants: {
        sendOnDialogRequest: (str: string) => {
          dialogStr = str;
        },
      },
      inventory: { clothes: {} },
    } as unknown as Player;

    const block: TileData = {
      x: 5,
      y: 5,
      fg: 1008,
      provider: { plantedAt: Date.now() - 1000 }, // only 1 second elapsed
    };

    const mockWorld = {
      hasTilePermission: async () => true,
    } as unknown as World;

    const tile = new ProviderTile(mockWorld, block);
    await tile.onWrench(mockPlayer);

    expect(dialogStr).toContain("ATM Machine");
    expect(dialogStr).toContain("Status: Recharging");
    expect(dialogStr).toContain("provider_dev_harvest");
    expect(dialogStr).toContain("provider_remove");
  });

  test("ProviderTile onPunch when not ready notifies user without destroying", async () => {
    let bubbleText = "";
    const mockPlayer = {
      netID: 1,
      isDeveloper: false,
      inventory: { clothes: {} },
      playMods: { has: () => false },
      sendTextBubble: (text: string) => {
        bubbleText = text;
      },
      variants: {
        sendOnConsoleMessage: mock(),
      },
    } as unknown as Player;

    const block: TileData = {
      x: 5,
      y: 5,
      fg: 1008,
      damage: 0,
      provider: { plantedAt: Date.now() }, // freshly planted
    };

    const mockWorld = {
      hasTilePermission: async () => true,
      broadcast: mock(),
      playPositioned: mock(),
    } as unknown as World;

    const tile = new ProviderTile(mockWorld, block);
    await tile.onPunch(mockPlayer);

    expect(bubbleText).toContain("not ready yet");
    expect(block.fg).toBe(1008); // Not destroyed!
  });
});

describe("The Ringmaster Quests & Carnival Rings", () => {
  test("All 13 Carnival Rings are defined and verified", () => {
    expect(CARNIVAL_RINGS.length).toBe(13);
    expect(CARNIVAL_RINGS).toContain(1874); // Ring of Force
    expect(CARNIVAL_RINGS).toContain(1904); // The One Ring
    expect(CARNIVAL_RINGS).toContain(11094); // Ring of Range
  });

  test("Granting a Carnival Ring adds the ring, broadcasts celebration, and plays audio", () => {
    const inv: number[] = [];
    let broadcastFound = false;

    const mockWorld = {
      broadcastVariant: (v: any) => {
        if (v.args?.[0] === "OnConsoleMessage" && String(v.args?.[1]).includes("CARNIVAL")) {
          broadcastFound = true;
        }
      },
      playPositioned: mock(),
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      tankIDName: "CircusMaster",
      state: { x: 100, y: 100 },
      world: mockWorld,
      inventory: {
        hasItem: (id: number) => inv.includes(id),
      },
      addItemInven: (id: number) => {
        inv.push(id);
      },
    } as unknown as Player;

    const ringId = grantCarnivalRing(mockPlayer);
    expect(CARNIVAL_RINGS).toContain(ringId);
    expect(inv).toContain(ringId);
    expect(broadcastFound).toBe(true);
  });

  test("Ringmaster Trials progression and buyout", () => {
    let step = 1;
    let completed = 0;
    let gems = 10000;

    const mockPlayer = {
      currentGems: gems,
      removeGems: (cost: number) => {
        gems -= cost;
      },
      inventory: {
        getAmount: () => 0,
        hasItem: () => false,
      },
      addItemInven: mock(),
      sendTextBubble: mock(),
      variants: {
        sendOnConsoleMessage: mock(),
      },
      quests: {
        get ringmasterStep() {
          return step;
        },
        set ringmasterStep(val: number) {
          step = val;
        },
        incrementRingmasterCompleted: () => {
          completed++;
          step = 0;
        },
      },
    } as unknown as Player;

    // Trial 1 buyout costs 500 gems
    const success = deliverRingmasterStep(mockPlayer, true);
    expect(success).toBe(true);
    expect(step).toBe(2);
    expect(gems).toBe(9500);

    // Fast-forward to Trial 10
    step = 10;
    const finalSuccess = deliverRingmasterStep(mockPlayer, true);
    expect(finalSuccess).toBe(true);
    expect(completed).toBe(1);
    expect(step).toBe(0);
  });

  test("ringmasterDialog displays step 0 and ongoing step details", () => {
    const playerAtStep0 = {
      netID: 1,
      currentGems: 5000,
      isDeveloper: true,
      inventory: { getAmount: () => 50 },
      quests: { ringmasterStep: 0, ringmasterCompletedCount: 0 },
    } as unknown as Player;

    const dialog0 = ringmasterDialog(playerAtStep0);
    expect(dialog0).toContain("The Ringmaster's Big Top");
    expect(dialog0).toContain("ringmaster_start_tickets");
    expect(dialog0).toContain("ringmaster_dev_advance");

    const playerAtStep3 = {
      netID: 1,
      currentGems: 5000,
      isDeveloper: false,
      inventory: { getAmount: () => 50 },
      quests: { ringmasterStep: 3, ringmasterCompletedCount: 0 },
    } as unknown as Player;

    const dialog3 = ringmasterDialog(playerAtStep3);
    expect(dialog3).toContain("Step 3/10");
    expect(dialog3).toContain("Fresh Greens");
  });
});

describe("NPC Tiles Interaction (Ringmaster, Crazy Jim, Pet Trainer)", () => {
  test("Punching or wrenching Ringmaster (1900) opens Ringmaster dialog", async () => {
    let dialogOpened = "";
    let soundPlayed = false;

    const mockWorld = {
      hasTilePermission: async () => true,
      playPositioned: (sound: string) => {
        if (sound.includes("cackle")) soundPlayed = true;
      },
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      tankIDName: "Explorer",
      isDeveloper: false,
      inventory: { clothes: {} },
      sendTextBubble: mock(),
      quests: { ringmasterStep: 0, ringmasterCompletedCount: 0 },
      variants: {
        sendOnDialogRequest: (str: string) => {
          dialogOpened = str;
        },
      },
    } as unknown as Player;

    const block: TileData = { x: 2, y: 3, fg: 1900 };
    const npcTile = new NpcTile(mockWorld, block);

    await npcTile.onPunch(mockPlayer);
    expect(dialogOpened).toContain("The Ringmaster");
    expect(soundPlayed).toBe(true);
  });

  test("Punching or wrenching Crazy Jim (3902) opens Daily Quest dialog", async () => {
    let dialogOpened = "";

    const mockWorld = {
      hasTilePermission: async () => true,
      playPositioned: mock(),
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      tankIDName: "Explorer",
      isDeveloper: false,
      inventory: { clothes: {}, getAmount: () => 0 },
      sendTextBubble: mock(),
      quests: { lastDeliveryDay: 0 },
      variants: {
        sendOnDialogRequest: (str: string) => {
          dialogOpened = str;
        },
      },
    } as unknown as Player;

    const block: TileData = { x: 4, y: 5, fg: 3902 };
    const npcTile = new NpcTile(mockWorld, block);

    await npcTile.onWrench(mockPlayer);
    expect(dialogOpened).toContain("Crazy Jim");
  });

  test("Punching or wrenching Pet Trainer (3554) opens Pet Trainer dialog", async () => {
    let dialogOpened = "";

    const mockWorld = {
      hasTilePermission: async () => true,
      playPositioned: mock(),
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      tankIDName: "Explorer",
      isDeveloper: false,
      inventory: { clothes: {} },
      sendTextBubble: mock(),
      variants: {
        sendOnDialogRequest: (str: string) => {
          dialogOpened = str;
        },
      },
    } as unknown as Player;

    const block: TileData = { x: 7, y: 8, fg: 3554 };
    const npcTile = new NpcTile(mockWorld, block);

    await npcTile.onPunch(mockPlayer);
    expect(dialogOpened).toContain("Pet Training Grounds");
  });
});

describe("/growall command updates both trees and providers", () => {
  test("/growall sets plantedAt on both trees and providers", async () => {
    const growallCmd = findCommand("growall");
    expect(growallCmd).toBeDefined();

    const treeBlock: TileData = {
      x: 1,
      y: 1,
      fg: 3,
      tree: { plantedAt: Date.now(), fullyGrownAt: Date.now() + 100000 },
    };

    const providerBlock: TileData = {
      x: 2,
      y: 2,
      fg: 1008,
      provider: { plantedAt: Date.now() },
    };

    let consoleOutput = "";
    const mockWorld = {
      players: [],
      data: { blocks: [treeBlock, providerBlock] },
      markDirty: mock(),
      broadcast: mock(),
    } as unknown as World;

    const devPlayer = {
      role: PLAYER_ROLE.DEVELOPER,
      world: mockWorld,
      variants: {
        sendOnConsoleMessage: (msg: string) => {
          consoleOutput = msg;
        },
      },
    } as unknown as Player;

    await growallCmd?.execute(devPlayer, [], "/growall");

    expect(treeBlock.tree!.fullyGrownAt).toBeLessThan(Date.now());
    expect(providerBlock.provider!.plantedAt).toBeLessThan(Date.now() - 100000);
    expect(consoleOutput).toContain("trees and readied");
    expect(consoleOutput).toContain("providers");
  });
});
