import { describe, expect, test } from "bun:test";
import { computeEffectiveClothes, FULL_BODY_SUITS, MORPH_ITEMS } from "../src/game/player/transform";
import { createEmptyClothes, type PlayerClothes } from "../src/game/player/inventory";
import { CHARACTER_STATE } from "../src/constants";
import { PLAY_MODS, WEARABLE_MODS, computeStats } from "../src/game/player/play-mods";

describe("Full-Body Hero Suits & Transformation Mechanics", () => {
  const EZIO = 11560;
  const GROWFORMER = 7384;

  test("FULL_BODY_SUITS includes Ezio and other Assassin's Creed hero suits", () => {
    expect(FULL_BODY_SUITS.has(EZIO)).toBe(true);
    expect(FULL_BODY_SUITS.has(12646)).toBe(true); // Altair
    expect(FULL_BODY_SUITS.has(13896)).toBe(true); // Kassandra
    expect(FULL_BODY_SUITS.has(11554)).toBe(true); // Bodvar
  });

  test("MORPH_ITEMS includes Go-Go-Growformer! and morph accessories", () => {
    expect(MORPH_ITEMS.has(GROWFORMER)).toBe(true);
    expect(MORPH_ITEMS.has(7480)).toBe(true); // Growformer PowerKey
    expect(MORPH_ITEMS.has(10960)).toBe(true); // Space Rabbit
  });

  test("Wearing a full-body suit preserves worn necklace and clears conflicting body clothes", () => {
    const raw: PlayerClothes = {
      hair: 100,
      shirt: 200,
      pants: 300,
      feet: 400,
      face: 500,
      hand: 98, // Pickaxe
      back: 156, // Crimson Wings
      mask: 600,
      necklace: EZIO,
      ances: 700,
    };

    const effective = computeEffectiveClothes(raw, false);

    expect(effective.necklace).toBe(EZIO);
    expect(effective.hair).toBe(0);
    expect(effective.shirt).toBe(0);
    expect(effective.pants).toBe(0);
    expect(effective.feet).toBe(0);
    expect(effective.face).toBe(0);
    expect(effective.mask).toBe(0);
    expect(effective.hand).toBe(98);
    expect(effective.back).toBe(156);
    expect(effective.ances).toBe(700);
  });

  test("Go-Go-Growformer! normal equipped state shows regular clothes", () => {
    const raw: PlayerClothes = {
      hair: 100,
      shirt: 200,
      pants: 300,
      feet: GROWFORMER,
      face: 500,
      hand: 98,
      back: 156,
      mask: 0,
      necklace: 0,
      ances: 0,
    };

    const effective = computeEffectiveClothes(raw, false);
    expect(effective).toEqual(raw);
  });

  test("Go-Go-Growformer! vehicle mode renders robot automaton cleanly", () => {
    const raw: PlayerClothes = {
      hair: 100,
      shirt: 200,
      pants: 300,
      feet: GROWFORMER,
      face: 500,
      hand: 98,
      back: 156,
      mask: 0,
      necklace: 0,
      ances: 0,
    };

    const effective = computeEffectiveClothes(raw, true);
    expect(effective.feet).toBe(GROWFORMER);
    expect(effective.shirt).toBe(1780);
    expect(effective.pants).toBe(6384);
    expect(effective.hair).toBe(16132);
    expect(effective.back).toBe(7582);
    expect(effective.face).toBe(0);
    expect(effective.mask).toBe(0);
  });

  test("Transformed assassin hero suits render full-body iconic outfits by clearing clashing clothes", () => {
    const ezioRaw: PlayerClothes = {
      hair: 100,
      shirt: 200,
      pants: 300,
      feet: 400,
      face: 500,
      hand: 98,
      back: 156,
      mask: 600,
      necklace: EZIO,
      ances: 0,
    };
    const ezioEffective = computeEffectiveClothes(ezioRaw, true);
    expect(ezioEffective.necklace).toBe(EZIO);
    expect(ezioEffective.hair).toBe(0);
    expect(ezioEffective.shirt).toBe(0);
    expect(ezioEffective.pants).toBe(0);
    expect(ezioEffective.feet).toBe(0);
    expect(ezioEffective.face).toBe(0);
    expect(ezioEffective.mask).toBe(0);
    expect(ezioEffective.hand).toBe(98);
    expect(ezioEffective.back).toBe(156);

    const altairRaw: PlayerClothes = {
      hair: 120,
      shirt: 220,
      pants: 320,
      feet: 420,
      face: 520,
      hand: 0,
      back: 0,
      mask: 0,
      necklace: 12646,
      ances: 0,
    };
    const altairEffective = computeEffectiveClothes(altairRaw, true);
    expect(altairEffective.necklace).toBe(12646);
    expect(altairEffective.hair).toBe(0);
    expect(altairEffective.shirt).toBe(0);
    expect(altairEffective.pants).toBe(0);
    expect(altairEffective.feet).toBe(0);
    expect(altairEffective.face).toBe(0);
    expect(altairEffective.mask).toBe(0);
  });

  test("Hero suits are registered in WEARABLE_MODS and grant hero stats", () => {
    const heroMod = WEARABLE_MODS.get(EZIO);
    expect(heroMod).toBeDefined();
    expect(heroMod?.id).toBe("hero_suit");
    expect(heroMod?.speed).toBe(100);
    expect(heroMod?.punchRange).toBe(1);
    expect((heroMod?.charState ?? 0) & CHARACTER_STATE.DOUBLE_JUMP).not.toBe(0);

    const stats = computeStats([{ id: "hero_suit", expiresAt: 0 }]);
    expect(stats.speed).toBeGreaterThan(1200);
    expect(stats.punchRange).toBe(129);
    expect((stats.charState & CHARACTER_STATE.DOUBLE_JUMP) !== 0).toBe(true);
  });

  test("Growformer speed and transform mode play mods grant correct stats", () => {
    const passiveMod = WEARABLE_MODS.get(GROWFORMER);
    expect(passiveMod?.id).toBe("growformer_speed");
    expect(passiveMod?.speed).toBe(100);

    const transformMod = PLAY_MODS.get("transformed");
    expect(transformMod).toBeDefined();
    expect(transformMod?.speed).toBe(250);
    expect(transformMod?.punchType).toBe(20); // Official Legendbot exploding rockets punch
    expect((transformMod?.charState ?? 0) & CHARACTER_STATE.DOUBLE_JUMP).not.toBe(0);
    expect((transformMod?.charState ?? 0) & CHARACTER_STATE.NO_BODY).toBe(0);
    expect((transformMod?.charState ?? 0) & CHARACTER_STATE.NO_HANDS).toBe(0);

    const transformedStats = computeStats([{ id: "transformed", expiresAt: 0 }]);
    expect(transformedStats.speed).toBe(1200 + 250);
    expect(transformedStats.punchType).toBe(20);
    expect((transformedStats.charState & CHARACTER_STATE.DOUBLE_JUMP) !== 0).toBe(true);
    expect((transformedStats.charState & CHARACTER_STATE.NO_BODY) !== 0).toBe(false);
    expect((transformedStats.charState & CHARACTER_STATE.NO_HANDS) !== 0).toBe(false);
  });
});
