import "../src/game/index";
import { describe, expect, test, beforeAll } from "bun:test";
import { World } from "../src/game/world/world";
import type { WorldData } from "../src/game/world/types";
import { tileFrom } from "../src/game/world/tiles";
import { initItems } from "../src/game/item/item-info";

function createTestWorld(name: string): World {
  const blocks: any[] = [];
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 100; x++) {
      blocks.push({
        fg: 0,
        bg: 0,
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
    weather: { id: 0 },
  };
  return new World(data);
}

function createMockPlayer(world: World) {
  return {
    netID: 1,
    playerId: 1,
    currentWorld: world.name,
    isDeveloper: true,
    effectiveClothes: { hand: 0, feet: 0 },
    inventory: { clothes: { hand: 0, feet: 0 }, canAddItem: () => true },
    playMods: { has: () => false },
    characterStats: { punchDamage: 0 },
    sendTextBubble: () => {},
    sendPlayPositioned: () => {},
    addXp: () => {},
  } as any;
}

describe("Strict Block Damage & One-Hit Scoping", () => {
  beforeAll(async () => {
    await initItems();
  });

  test("Standard weapons (Legendary Katana, etc.) do NOT one-hit blocks", async () => {
    const world = createTestWorld("TESTPUNCH");
    const player = createMockPlayer(world);

    // Setup a Dirt block (item 2, breakHits = 3)
    const block = world.getTileAt(10, 10)!;
    block.fg = 2;
    block.bg = 0;
    block.damage = 0;

    // Equip Legendary Katana (#2592)
    player.effectiveClothes.hand = 2592;
    player.inventory.clothes.hand = 2592;

    const tile = tileFrom(world, block);
    await tile.onPunch(player);

    // Block took exactly 1 hit of damage, NOT destroyed!
    expect(block.fg).toBe(2);
    expect(block.damage).toBe(1);
  });

  test("Digger's Spade strictly one-hits Dirt and Cave Background, but NOT Rock or other blocks", async () => {
    const world = createTestWorld("TESTSPADE");
    const player = createMockPlayer(world);

    // Equip Digger's Spade (#2952)
    player.effectiveClothes.hand = 2952;
    player.inventory.clothes.hand = 2952;

    // 1. Dirt block (item 2)
    const dirtBlock = world.getTileAt(10, 10)!;
    dirtBlock.fg = 2;
    dirtBlock.bg = 0;
    dirtBlock.damage = 0;

    const dirtTile = tileFrom(world, dirtBlock);
    await dirtTile.onPunch(player);

    // Dirt is destroyed in 1 hit!
    expect(dirtBlock.fg).toBe(0);

    // 2. Rock block (item 10, breakHits = 4)
    const rockBlock = world.getTileAt(11, 10)!;
    rockBlock.fg = 10;
    rockBlock.bg = 0;
    rockBlock.damage = 0;

    const rockTile = tileFrom(world, rockBlock);
    await rockTile.onPunch(player);

    // Rock is NOT destroyed in 1 hit! Spade does NOT affect rock!
    expect(rockBlock.fg).toBe(10);
    expect(rockBlock.damage).toBe(1);
  });

  test("Poseidon's Digger's Trident strictly one-hits Sand only", async () => {
    const world = createTestWorld("TESTSAND");
    const player = createMockPlayer(world);

    // Equip Poseidon's Digger's Trident (#7434)
    player.effectiveClothes.hand = 7434;
    player.inventory.clothes.hand = 7434;

    // 1. Sand block (item 428)
    const sandBlock = world.getTileAt(10, 10)!;
    sandBlock.fg = 428;
    sandBlock.bg = 0;
    sandBlock.damage = 0;

    const sandTile = tileFrom(world, sandBlock);
    await sandTile.onPunch(player);

    // Sand is destroyed in 1 hit!
    expect(sandBlock.fg).toBe(0);

    // 2. Dirt block (item 2) punched with Trident
    const dirtBlock = world.getTileAt(11, 10)!;
    dirtBlock.fg = 2;
    dirtBlock.bg = 0;
    dirtBlock.damage = 0;

    const dirtTile = tileFrom(world, dirtBlock);
    await dirtTile.onPunch(player);

    // Dirt is NOT one-hit with Poseidon's Trident!
    expect(dirtBlock.fg).toBe(2);
    expect(dirtBlock.damage).toBe(1);
  });
});
