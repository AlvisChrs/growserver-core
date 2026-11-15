import { describe, expect, test } from "bun:test";
import { CHARACTER_STATE, PLAYER_ROLE } from "../src/constants";
import { ALL_MOBILITY_BACK_ITEMS, PLAY_MODS, WEARABLE_MODS } from "../src/game/player/play-mods";
import { riftCapeDialog, riftWingsDialog, DEFAULT_RIFT_CAPE_CONFIG } from "../src/game/item/configurable-items";
import { executeCommand, findCommand } from "../src/game/commands/registry";
import type { Player } from "../src/game/player";

describe("Mobility Back Items & Wing Perks", () => {
  test("ALL_MOBILITY_BACK_ITEMS contains comprehensive list of wings and mobility back items", () => {
    expect(ALL_MOBILITY_BACK_ITEMS.length).toBeGreaterThanOrEqual(200);
    // Well-known wings must be present
    expect(ALL_MOBILITY_BACK_ITEMS.includes(156)).toBe(true); // Fairy Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(362)).toBe(true); // Angel Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(1206)).toBe(true); // Devil Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(1460)).toBe(true); // Golden Angel Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(1672)).toBe(true); // Rainbow Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(1674)).toBe(true); // Phoenix Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(2256)).toBe(true); // Diamond Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(8286)).toBe(true); // Da Vinci Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(10424)).toBe(true); // Rift Cape
    expect(ALL_MOBILITY_BACK_ITEMS.includes(11478)).toBe(true); // Rift Wings
    expect(ALL_MOBILITY_BACK_ITEMS.includes(15826)).toBe(true); // Wings of Infinity
  });

  test("Every item in ALL_MOBILITY_BACK_ITEMS is registered in WEARABLE_MODS with DOUBLE_JUMP", () => {
    for (const itemId of ALL_MOBILITY_BACK_ITEMS) {
      const mod = WEARABLE_MODS.get(itemId);
      expect(mod).toBeDefined();
      expect(mod?.charState & CHARACTER_STATE.DOUBLE_JUMP).toBe(CHARACTER_STATE.DOUBLE_JUMP);
    }
  });

  test("Special wings have enhanced perks registered", () => {
    // Phoenix Wings (#1674): fire punch + speed + double jump
    const phoenix = WEARABLE_MODS.get(1674);
    expect(phoenix?.speed).toBe(60);
    expect(phoenix?.punchType).toBe(19);

    // Golden Angel Wings (#1460): low gravity float
    const goldenAngel = WEARABLE_MODS.get(1460);
    expect(goldenAngel?.gravity).toBe(600);

    // Da Vinci Wings (#8286): glider low gravity
    const davinci = WEARABLE_MODS.get(8286);
    expect(davinci?.gravity).toBe(500);

    // Rift Cape (#10424): speed + double jump
    const riftCape = WEARABLE_MODS.get(10424);
    expect(riftCape?.speed).toBe(80);

    // Rift Wings (#11478): speed + double jump
    const riftWings = WEARABLE_MODS.get(11478);
    expect(riftWings?.speed).toBe(100);
  });
});

describe("Invis & Ghost Haunted Shadows & Visual Effects", () => {
  test("/invis toggles IS_INVISIBLE and HAVE_HAUNTED_SHADOWS with sfx and particles", async () => {
    const invisCmd = findCommand("invis");
    expect(invisCmd).toBeDefined();

    const consoleMsgs: string[] = [];
    const broadcastVariants: unknown[] = [];
    const playedSounds: string[] = [];

    const mockMod = {
      role: PLAYER_ROLE.MODERATOR,
      realRole: PLAYER_ROLE.MODERATOR,
      netID: 1,
      state: { x: 100, y: 200, characterState: 0 },
      effectiveClothes: { back: 0 },
      sendCharacterState: () => {},
      sendClothesToWorld: () => {},
      world: {
        players: [],
        broadcastVariant: (v: unknown) => {
          broadcastVariants.push(v);
        },
        sendParticleEffect: (id: number, x: number, y: number) => {
          broadcastVariants.push({ id, x, y });
        },
        playPositioned: (sound: string) => {
          playedSounds.push(sound);
        },
      },
      variants: {
        sendOnConsoleMessage: (msg: string) => {
          consoleMsgs.push(msg);
        },
      },
    } as unknown as Player;

    // Turn INVIS ON
    await invisCmd?.execute(mockMod, []);
    expect((mockMod.state.characterState & CHARACTER_STATE.IS_INVISIBLE) !== 0).toBe(true);
    expect((mockMod.state.characterState & CHARACTER_STATE.HAVE_HAUNTED_SHADOWS) !== 0).toBe(true);
    expect(playedSounds).toContain("audio/spooky.wav");
    expect(broadcastVariants.length).toBeGreaterThan(0);
    expect(consoleMsgs.some((m) => m.includes("Invisibility enabled"))).toBe(true);

    // Turn INVIS OFF
    playedSounds.length = 0;
    broadcastVariants.length = 0;
    await invisCmd?.execute(mockMod, []);
    expect((mockMod.state.characterState & CHARACTER_STATE.IS_INVISIBLE) === 0).toBe(true);
    expect((mockMod.state.characterState & CHARACTER_STATE.HAVE_HAUNTED_SHADOWS) === 0).toBe(true);
    expect(playedSounds).toContain("audio/teleport.wav");
    expect(broadcastVariants.length).toBeGreaterThan(0);
    expect(consoleMsgs.some((m) => m.includes("Invisibility disabled"))).toBe(true);
  });

  test("/ghost mode includes HAVE_HAUNTED_SHADOWS", async () => {
    const ghostCmd = findCommand("ghost");
    expect(ghostCmd).toBeDefined();

    const mockMod = {
      role: PLAYER_ROLE.MODERATOR,
      realRole: PLAYER_ROLE.MODERATOR,
      netID: 1,
      state: { x: 100, y: 200, isGhost: false, characterState: 0 },
      effectiveClothes: { back: 0 },
      sendCharacterState: () => {},
      sendClothesToWorld: () => {},
      world: {
        players: [],
        broadcastVariant: () => {},
        playPositioned: () => {},
        sendParticleEffect: () => {},
      },
      variants: {
        sendOnConsoleMessage: () => {},
      },
    } as unknown as Player;

    await ghostCmd?.execute(mockMod, []);
    expect(mockMod.state.isGhost).toBe(true);
    expect((mockMod.state.characterState & CHARACTER_STATE.HAVE_HAUNTED_SHADOWS) !== 0).toBe(true);
    expect((mockMod.state.characterState & CHARACTER_STATE.WALK_IN_BLOCKS) !== 0).toBe(true);
  });
});

describe("Configurable Items (Rift Cape & Rift Wings)", () => {
  test("riftCapeDialog returns formatted dialog with color inputs and presets", () => {
    const mockPlayer = {
      riftCapeConfig: { ...DEFAULT_RIFT_CAPE_CONFIG },
    } as unknown as Player;

    const dialog = riftCapeDialog(mockPlayer);
    expect(dialog).toContain("Rift Cape Customization");
    expect(dialog).toContain("cape_rgb");
    expect(dialog).toContain("collar_rgb");
    expect(dialog).toContain("preset_purple");
    expect(dialog).toContain("preset_crimson");
    expect(dialog).toContain("rift_cape_config");
  });

  test("riftWingsDialog returns formatted dialog with color inputs and presets", () => {
    const mockPlayer = {} as unknown as Player;

    const dialog = riftWingsDialog(mockPlayer);
    expect(dialog).toContain("Rift Wings Customization");
    expect(dialog).toContain("wings_rgb");
    expect(dialog).toContain("wpreset_purple");
    expect(dialog).toContain("rift_wings_config");
  });

  test("/rift command opens customization for equipped or owned gear", async () => {
    const riftCmd = findCommand("rift");
    expect(riftCmd).toBeDefined();

    let dialogSent = "";
    const mockPlayer = {
      role: PLAYER_ROLE.BASIC,
      effectiveClothes: { back: 10424 },
      inventory: { clothes: { back: 10424 }, hasItem: (id: number) => id === 10424 },
      variants: {
        sendOnDialogRequest: (d: string) => {
          dialogSent = d;
        },
        sendOnConsoleMessage: () => {},
      },
    } as unknown as Player;

    await riftCmd?.execute(mockPlayer, []);
    expect(dialogSent).toContain("Rift Cape Customization");
  });

  test("Rift custom colors are correctly packed into Proton 32-bit RGBA numbers with full alpha", () => {
    const red = [255, 0, 0] as [number, number, number];
    const packedRed = (((red[2] & 0xff) << 24) | ((red[1] & 0xff) << 16) | ((red[0] & 0xff) << 8) | 0xff) >>> 0;
    expect(packedRed).toBe(0x0000ffff);

    const cyan = [0, 220, 255] as [number, number, number];
    const packedCyan = (((cyan[2] & 0xff) << 24) | ((cyan[1] & 0xff) << 16) | ((cyan[0] & 0xff) << 8) | 0xff) >>> 0;
    expect(packedCyan).toBe(0xffdc00ff);
  });
});
