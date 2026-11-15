import "../src/game/index";
import { describe, expect, test } from "bun:test";
import { WEAPON_PUNCH_TYPES } from "../src/game/player";
import { FULL_BODY_SUITS } from "../src/game/player/transform";
import { PLAY_MODS, WEARABLE_MODS, computeStats } from "../src/game/player/play-mods";
import { findCommand } from "../src/game/commands/registry";
import "../src/game/commands/core-commands";
import { searchItemNames } from "../src/game/item/item-search";
import type { ItemDefinition } from "grow-items";

describe("Burning Eyes, Multi-Slot Punch Animations & Immortal Collection", () => {
  test("WEAPON_PUNCH_TYPES maps multi-slot punch accessories across face, head, back, and hand", () => {
    // Face
    expect(WEAPON_PUNCH_TYPES[2476]).toBe(39); // Burning Eyes
    expect(WEAPON_PUNCH_TYPES[10336]).toBe(39); // Black Burning Eyes
    expect(WEAPON_PUNCH_TYPES[1204]).toBe(10); // Focused Eyes
    expect(WEAPON_PUNCH_TYPES[452]).toBe(1); // Cyclopean Visor

    // Hair / Head
    expect(WEAPON_PUNCH_TYPES[8372]).toBe(8); // Giant Eye Head
    expect(WEAPON_PUNCH_TYPES[4746]).toBe(75); // Energized Horn
    expect(WEAPON_PUNCH_TYPES[4456]).toBe(40); // Diamond Horns
    expect(WEAPON_PUNCH_TYPES[306]).toBe(14); // Rainbow Wig

    // Back
    expect(WEAPON_PUNCH_TYPES[1674]).toBe(19); // Phoenix Wings
    expect(WEAPON_PUNCH_TYPES[1672]).toBe(14); // Rainbow Wings
    expect(WEAPON_PUNCH_TYPES[8286]).toBe(4); // Da Vinci Wings
    expect(WEAPON_PUNCH_TYPES[16262]).toBe(4); // Immortal Da Vinci Wings

    // Hand
    expect(WEAPON_PUNCH_TYPES[2592]).toBe(43); // Legendary Katana
    expect(WEAPON_PUNCH_TYPES[16428]).toBe(43); // Immortal Sonic Buster Katana
    expect(WEAPON_PUNCH_TYPES[5480]).toBe(80); // Rayman's Fist
  });

  test("Burning Eyes and Giant Eye Head are registered in PLAY_MODS and WEARABLE_MODS", () => {
    const beMod = PLAY_MODS.get("burning_eyes");
    expect(beMod).toBeDefined();
    expect(beMod?.punchType).toBe(39);
    expect(WEARABLE_MODS.get(2476)?.id).toBe("burning_eyes");
    expect(WEARABLE_MODS.get(10336)?.id).toBe("burning_eyes");

    const gehMod = PLAY_MODS.get("giant_eye_head");
    expect(gehMod).toBeDefined();
    expect(gehMod?.punchType).toBe(8);
    expect(WEARABLE_MODS.get(8372)?.id).toBe("giant_eye_head");
  });

  test("Equipping face item auto-clears full-body hero suit to avoid cosmetic lock", () => {
    const clothes = {
      hair: 7080,
      shirt: 7082,
      pants: 7086,
      feet: 7094,
      face: 0,
      hand: 0,
      back: 0,
      mask: 0,
      necklace: 11560, // Ezio
      ances: 0,
    };

    let isTransformed = true;
    let isHeroDisguised = true;

    // Simulate equipClothes(2476 Burning Eyes)
    const slot = "face";
    const itemId = 2476;
    if (FULL_BODY_SUITS.has(clothes.necklace) && slot !== "necklace" && slot !== "ances") {
      clothes.necklace = 0;
      isTransformed = false;
      isHeroDisguised = false;
    }
    clothes.face = itemId;

    expect(clothes.necklace).toBe(0);
    expect(clothes.face).toBe(2476);
    expect(isTransformed).toBe(false);
    expect(isHeroDisguised).toBe(false);
  });

  test("Punch ID priority: Hand weapon > Robot Automaton > Face > Head > Back > Passive", () => {
    const evaluatePunch = (c: { hand?: number; face?: number; hair?: number; back?: number; feet?: number }, isTransformed = false) => {
      if (c.hand && WEAPON_PUNCH_TYPES[c.hand] !== undefined) return WEAPON_PUNCH_TYPES[c.hand];
      if (isTransformed && c.feet === 7384) return 5;
      if (c.face && WEAPON_PUNCH_TYPES[c.face] !== undefined) return WEAPON_PUNCH_TYPES[c.face];
      if (c.hair && WEAPON_PUNCH_TYPES[c.hair] !== undefined) return WEAPON_PUNCH_TYPES[c.hair];
      if (c.back && WEAPON_PUNCH_TYPES[c.back] !== undefined) return WEAPON_PUNCH_TYPES[c.back];
      return 0;
    };

    // Katana overrides everything
    expect(evaluatePunch({ hand: 2592, face: 2476, hair: 8372, back: 1674 })).toBe(43);

    // Empty hand, Burning Eyes overrides Head and Back
    expect(evaluatePunch({ hand: 0, face: 2476, hair: 8372, back: 1674 })).toBe(39);

    // Empty hand and face, Giant Eye Head overrides Back
    expect(evaluatePunch({ hand: 0, face: 0, hair: 8372, back: 1674 })).toBe(8);

    // Only Phoenix Wings equipped
    expect(evaluatePunch({ hand: 0, face: 0, hair: 0, back: 1674 })).toBe(19);

    // Transformed Robot Automaton
    expect(evaluatePunch({ hand: 0, feet: 7384 }, true)).toBe(5);
  });

  test("searchItemNames resolves 'immortal giant' alias to Giant Eye Head (#8372)", () => {
    const mockDefs: ItemDefinition[] = [
      { id: 8372, name: "Giant Eye Head" } as ItemDefinition,
      { id: 8373, name: "Giant Eye Head Seed" } as ItemDefinition,
      { id: 16428, name: "Immortal Sonic Buster Katana" } as ItemDefinition,
      { id: 16262, name: "Immortal Da Vinci Wings" } as ItemDefinition,
    ];

    const result = searchItemNames(mockDefs, "immortal giant", false);
    expect(result.matches.some((m) => m.id === 8372)).toBe(true);

    const seedResult = searchItemNames(mockDefs, "immortal giant", true);
    expect(seedResult.matches.some((m) => m.id === 8373)).toBe(true);
  });

  test("/immortal command gives full Immortal collection including Giant Eye Head", () => {
    const cmd = findCommand("immortal");
    expect(cmd).toBeDefined();

    const inv = new Map<number, number>();
    const mockPlayer = {
      inventory: {
        hasItem: (id: number) => inv.has(id),
      },
      addItemInven: (id: number, count = 1) => inv.set(id, (inv.get(id) ?? 0) + count),
      sendSfx: () => {},
      sendTextBubble: () => {},
      variants: { sendOnConsoleMessage: () => {} },
    } as any;

    cmd?.execute(mockPlayer, []);
    expect(inv.has(16428)).toBe(true); // Immortal Katana
    expect(inv.has(16262)).toBe(true); // Immortal Da Vinci Wings
    expect(inv.has(16426)).toBe(true); // Immortal Pickaxe
    expect(inv.has(8372)).toBe(true); // Giant Eye Head
  });

  test("/eyes command gives Burning Eyes, Black Burning Eyes, Focused Eyes, and Giant Eye Head", () => {
    const cmd = findCommand("eyes");
    expect(cmd).toBeDefined();

    const inv = new Map<number, number>();
    const mockPlayer = {
      inventory: {
        hasItem: (id: number) => inv.has(id),
      },
      addItemInven: (id: number, count = 1) => inv.set(id, (inv.get(id) ?? 0) + count),
      sendSfx: () => {},
      sendTextBubble: () => {},
      variants: { sendOnConsoleMessage: () => {} },
    } as any;

    cmd?.execute(mockPlayer, []);
    expect(inv.has(2476)).toBe(true); // Burning Eyes
    expect(inv.has(10336)).toBe(true); // Black Burning Eyes
    expect(inv.has(1204)).toBe(true); // Focused Eyes
    expect(inv.has(8372)).toBe(true); // Giant Eye Head
  });
});
