import "../src/game/index";
import { describe, expect, test } from "bun:test";
import { WEARABLE_MODS, computeStats } from "../src/game/player/play-mods";
import { CHARACTER_STATE, PLAYER_ROLE } from "../src/constants";
import { BurglarTile, VILLAIN_PORTRAITS } from "../src/game/world/tiles/burglar-tile";
import { LEGENDARY_QUESTS, legendaryWizardDialog } from "../src/game/quests/legendary-wizard-quest";
import { FISHING_RODS, FISHING_BAITS, handleFishingCast } from "../src/game/fishing/fishing-manager";
import { findCommand } from "../src/game/commands/registry";
import "../src/game/commands/core-commands";
import { TileFlags, ActionTypes, ITEM_ID } from "../src/game/world/constants";
import { TileMapByItem } from "../src/game/world/tiles";
import type { Player } from "../src/game/player";
import type { World } from "../src/game/world/world";

describe("Legendary Katana & Katana Series", () => {
  test("Legendary Katana (#2592) is registered in WEARABLE_MODS with unique Legendary slash punchType 43 and stats", () => {
    const lkat = WEARABLE_MODS.get(2592);
    expect(lkat).toBeDefined();
    expect(lkat?.id).toBe("legendary_katana");
    expect(lkat?.punchType).toBe(43);
    expect(lkat?.speed).toBe(100);
    expect(lkat?.punchPower).toBe(350);
    expect(lkat?.punchDamage).toBe(3);
    expect((lkat?.charState ?? 0) & CHARACTER_STATE.DOUBLE_JUMP).not.toBe(0);

    const stats = computeStats([{ id: "legendary_katana", expiresAt: 0 }]);
    expect(stats.punchType).toBe(43);
    expect(stats.speed).toBeGreaterThan(300);
    expect((stats.charState & CHARACTER_STATE.DOUBLE_JUMP) !== 0).toBe(true);
  });

  test("Elemental and cursed katanas are equipped with distinctive custom slash punch effects", () => {
    const cursed = WEARABLE_MODS.get(9058);
    expect(cursed?.punchType).toBe(29); // Blood-red slasher dark cut
    expect(cursed?.punchPower).toBe(300);

    const sonic = WEARABLE_MODS.get(11118);
    expect(sonic?.punchType).toBe(8); // Cyan sonic energy wave blast
    expect(sonic?.speed).toBe(120);

    const dark = WEARABLE_MODS.get(13710);
    expect(dark?.punchType).toBe(13); // Dark shadow reaper slash

    const immortal = WEARABLE_MODS.get(16428);
    expect(immortal?.punchType).toBe(8); // Enhanced sonic blast
    expect(immortal?.speed).toBe(140);
    expect((immortal?.charState ?? 0) & CHARACTER_STATE.DOUBLE_JUMP).not.toBe(0);
  });
});

describe("Crime System: Crime Wave & Crime In Progress & Criminal Mastermind", () => {
  test("VILLAIN_PORTRAITS includes all 11 classic villain portrait IDs", () => {
    expect(VILLAIN_PORTRAITS).toContain(2344); // The Firebug
    expect(VILLAIN_PORTRAITS).toContain(2360); // Dr. Destructo
    expect(VILLAIN_PORTRAITS).toContain(2362); // Ms. Terry
    expect(VILLAIN_PORTRAITS.length).toBe(11);
  });

  test("TileMapByItem maps both Crime In Progress (2302) and Criminal Mastermind (12276) to BurglarTile", () => {
    expect(TileMapByItem[2302]).toBe(BurglarTile);
    expect(TileMapByItem[12276]).toBe(BurglarTile);
  });

  test("BurglarTile punches apply damage and defeating drops gems, portrait, and cards", async () => {
    let droppedItem = 0;
    let addedGems = 0;
    const tileData = { x: 5, y: 10, fg: 2302, bg: 0, flags: TileFlags.TILEEXTRA, damage: 0 };

    const mockWorld = {
      players: [],
      playPositioned: () => {},
      broadcastVariant: () => {},
      broadcast: () => {},
      markDirty: () => {},
      drop: (_p: any, _x: number, _y: number, itemId: number) => {
        droppedItem = itemId;
      },
    } as unknown as World;

    const mockPlayer = {
      netID: 1,
      displayName: "HeroPlayer",
      playMods: new Set(["hero_suit"]),
      inventory: {
        clothes: { hand: 2592 }, // Holding Katana
        canAddItem: () => true,
        hasItem: () => false,
      },
      addItemInven: (id: number) => {
        droppedItem = id;
      },
      addGems: (amt: number) => {
        addedGems += amt;
      },
      sendTextBubble: () => {},
      variants: { sendOnConsoleMessage: () => {} },
    } as unknown as Player;

    const burglar = new BurglarTile(mockWorld, tileData);

    // Punch 1: Hero + Katana deals 2 damage
    await burglar.onPunch(mockPlayer);
    expect(tileData.damage).toBe(2);
    expect(tileData.fg).toBe(2302);

    // Deliver enough hits to reach maxHp (8 hits total)
    await burglar.onPunch(mockPlayer); // 4
    await burglar.onPunch(mockPlayer); // 6
    await burglar.onPunch(mockPlayer); // 8 -> defeated!

    expect(tileData.fg).toBe(0);
    expect(addedGems).toBeGreaterThanOrEqual(500);
    expect(droppedItem).toBeGreaterThan(0);
  });

  test("Criminal Mastermind (12276) can be fought and defeated with Mastermind rewards", async () => {
    let droppedItem = 0;
    let addedGems = 0;
    const tileData = { x: 8, y: 12, fg: 12276, bg: 0, flags: TileFlags.TILEEXTRA, damage: 0 };

    const mockWorld = {
      players: [],
      playPositioned: () => {},
      broadcastVariant: () => {},
      broadcast: () => {},
      markDirty: () => {},
      drop: (_p: any, _x: number, _y: number, itemId: number) => {
        droppedItem = itemId;
      },
    } as unknown as World;

    const mockPlayer = {
      netID: 2,
      displayName: "MasterHero",
      playMods: new Set(["hero_suit"]),
      inventory: {
        clothes: { hand: 2592 }, // Katana
        canAddItem: () => true,
        hasItem: () => false,
      },
      addItemInven: (id: number) => {
        droppedItem = id;
      },
      addGems: (amt: number) => {
        addedGems += amt;
      },
      sendTextBubble: () => {},
      variants: { sendOnConsoleMessage: () => {} },
    } as unknown as Player;

    const mastermind = new BurglarTile(mockWorld, tileData);

    // Punch Mastermind: 2 damage per hero katana punch
    await mastermind.onPunch(mockPlayer);
    expect(tileData.damage).toBe(2);
    expect(tileData.fg).toBe(12276);

    // Punch until defeated (up to 12 hits for Masterminds)
    for (let i = 0; i < 6; i++) {
      await mastermind.onPunch(mockPlayer);
    }

    expect(tileData.fg).toBe(0);
    expect(addedGems).toBeGreaterThanOrEqual(1500); // Mastermind bounty: 1500-3000 gems
    expect(droppedItem).toBeGreaterThan(0);
  });

  test("Wrenching Crime In Progress or Criminal Mastermind opens Crime Battle Dialog", async () => {
    let capturedDialog = "";
    const tileData = { x: 3, y: 7, fg: 12276, bg: 0, flags: TileFlags.TILEEXTRA, damage: 0 };
    const mockWorld = {
      players: [],
    } as unknown as World;

    const mockPlayer = {
      displayName: "Detective",
      inventory: {
        getAmount: (id: number) => (id === 2292 ? 3 : 0),
      },
      variants: {
        sendOnDialogRequest: (d: string) => {
          capturedDialog = d;
        },
      },
    } as unknown as Player;

    const mastermind = new BurglarTile(mockWorld, tileData);
    await mastermind.onWrench(mockPlayer);

    expect(capturedDialog).toContain("crime_battle");
    expect(capturedDialog).toContain("CRIMINAL MASTERMIND");
    expect(capturedDialog).toContain("Heroic Strike");
    expect(capturedDialog).toContain("crime_card_2292"); // Has Heat Vision
  });

  test("/criminal command grants Crime Wave, Crime In Progress, Criminal Mastermind, and Cards", () => {
    const cmd = findCommand("criminal");
    expect(cmd).toBeDefined();

    const inv = new Map<number, number>();
    const mockPlayer = {
      addItemInven: (id: number, count = 1) => inv.set(id, (inv.get(id) ?? 0) + count),
      equipClothes: () => {},
      sendInventory: () => {},
      sendSfx: () => {},
      sendTextBubble: () => {},
      variants: { sendOnConsoleMessage: () => {} },
    } as unknown as Player;

    cmd?.execute(mockPlayer, []);
    expect(inv.get(2382)).toBe(5); // Crime Wave
    expect(inv.get(2302)).toBe(5); // Crime In Progress
    expect(inv.get(12276)).toBe(5); // Criminal Mastermind
    expect(inv.get(2292)).toBe(5); // Heat Vision
    expect(inv.get(2310)).toBe(5); // Frost Breath
    expect(inv.get(2320)).toBe(5); // Super Strength
    expect(inv.get(2334)).toBe(5); // Thunderstorm
  });
});

describe("Legendary Wizard NPC & Legendary Quests", () => {
  test("Legendary Wizard offers 4 Legendary Quests including Katana and Dragon", () => {
    expect(LEGENDARY_QUESTS.length).toBe(4);
    const katanaQuest = LEGENDARY_QUESTS.find(q => q.rewardId === 2592);
    expect(katanaQuest).toBeDefined();
    expect(katanaQuest?.steps.length).toBe(4);

    const dragonQuest = LEGENDARY_QUESTS.find(q => q.rewardId === 1782);
    expect(dragonQuest).toBeDefined();
  });

  test("legendaryWizardDialog generates dialog with quest options and dev shortcuts", () => {
    const mockPlayer = {
      playerId: 9999,
      netID: 1,
      isDeveloper: true,
      gems: 50000,
      inventory: { getAmount: () => 100 },
    } as unknown as Player;

    const dialog = legendaryWizardDialog(mockPlayer, 10, 15);
    expect(dialog).toContain("Legendary Wizard's Sanctum");
    expect(dialog).toContain("Quest for the Legendary Katana");
    expect(dialog).toContain("dev_instant_complete_lquest");
  });
});

describe("Fishing & Aquarium Verification", () => {
  test("FISHING_RODS and FISHING_BAITS recognize standard gear", () => {
    expect(FISHING_RODS[2912]).toBeDefined(); // Fishing Rod
    expect(FISHING_RODS[3040]).toBeDefined(); // Goldenrod
    expect(FISHING_BAITS.has(2914)).toBe(true); // Wiggly Worm
    expect(FISHING_BAITS.has(3014)).toBe(true); // Salmon Eggs
    expect(FISHING_BAITS.has(5528)).toBe(true); // Mega-Pellet
  });

  test("handleFishingCast auto-equips fishing rod if in backpack", async () => {
    const inv = new Map<number, number>([[2912, 1], [2914, 5]]);
    const clothes: Record<string, number> = { hand: 0 };

    const mockWorld = {
      getTileAt: () => ({ flags: TileFlags.WATER, fg: 0 }),
      isSolid: () => false,
      broadcast: () => {},
    } as unknown as World;

    const mockPlayer = {
      state: { x: 32, y: 32 },
      inventory: {
        clothes,
        hasItem: (id: number) => inv.has(id),
      },
      equipClothes(id: number) {
        clothes.hand = id;
      },
      removeItemInven: (id: number, count = 1) => {
        inv.set(id, (inv.get(id) ?? 0) - count);
        return count;
      },
      sendTextBubble: () => {},
    } as unknown as Player;

    // Cast bait onto water tile at (1, 1)
    const handled = await handleFishingCast(mockPlayer, mockWorld, 2914, 1, 1);
    expect(handled).toBe(true);
    expect(clothes.hand).toBe(2912); // Rod was auto-equipped!
    expect(mockPlayer.fishing).toBeDefined();
    expect(mockPlayer.fishing?.baitId).toBe(2914);
  });

  test("/hero transforms player into Ezio Auditore as cosmetic disguise without giving backpack items", () => {
    const cmd = findCommand("hero");
    expect(cmd).toBeDefined();

    const inv = new Map<number, number>();
    const clothes: Record<string, number> = {};
    const mods = new Set<string>();

    const mockPlayer = {
      inventory: {
        clothes,
        hasItem: (id: number) => inv.has(id),
      },
      addItemInven: (id: number, count = 1) => inv.set(id, (inv.get(id) ?? 0) + count),
      playMods: {
        add: (id: string) => mods.add(id),
        remove: (id: string) => mods.delete(id),
      },
      sendClothesToWorld: () => {},
      sendCharacterState: () => {},
      sendInventory: () => {},
      sendSfx: () => {},
      sendTextBubble: () => {},
      variants: { sendOnConsoleMessage: () => {} },
    } as unknown as Player;

    cmd?.execute(mockPlayer, []);

    // Full Ezio outfit equipped visually
    expect(clothes.hair).toBe(7080); // Ezio's Hood
    expect(clothes.shirt).toBe(7082); // Ezio's Vest
    expect(clothes.back).toBe(7084); // Ezio's Cape
    expect(clothes.pants).toBe(7086); // Ezio's Trousers
    expect(clothes.hand).toBe(7088); // Ezio's Armguards
    expect(clothes.face).toBe(7090); // Ezio's Beard
    expect(clothes.feet).toBe(7094); // Ezio's Boots
    expect(clothes.necklace).toBe(11560); // Ezio Morph
    expect(mods.has("hero_suit")).toBe(true);
    expect(inv.size).toBe(0); // Zero items added to inventory to protect economy!

    // /hero super transforms into Superhero
    cmd?.execute(mockPlayer, ["super"]);
    expect(clothes.mask).toBe(2134);
    expect(clothes.shirt).toBe(2170);
    expect(clothes.pants).toBe(2098);
    expect(clothes.feet).toBe(2122);
    expect(clothes.back).toBe(350);
    expect(inv.size).toBe(0);
  });
});
