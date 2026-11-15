import "../src/game/index";
import { describe, expect, test } from "bun:test";
import { WEAPON_PUNCH_TYPES, Player } from "../src/game/player";
import { ActionTypes, ITEM_ID } from "../src/game/world/constants";

describe("Comprehensive Punch Effects & Weapon Category Fallbacks", () => {
  test("WEAPON_PUNCH_TYPES includes all authentic weapons across Growtopia categories", () => {
    // Katanas
    expect(WEAPON_PUNCH_TYPES[2592]).toBe(43); // Legendary Katana (Golden anime slice)
    expect(WEAPON_PUNCH_TYPES[3838]).toBe(43); // Dueling Katanas (Twin blade slice)
    expect(WEAPON_PUNCH_TYPES[9058]).toBe(29); // Cursed Katana (Blood-red slasher dark cut)
    expect(WEAPON_PUNCH_TYPES[11118]).toBe(8);  // Sonic Buster Katana (Cyan sonic wave blast)
    expect(WEAPON_PUNCH_TYPES[13710]).toBe(13); // Dark Magic Katana (Dark shadow reaper slash)
    expect(WEAPON_PUNCH_TYPES[16428]).toBe(8);  // Immortal Sonic Buster Katana (Enhanced sonic blast)

    // Scythes
    expect(WEAPON_PUNCH_TYPES[1068]).toBe(13); // Hand Scythe
    expect(WEAPON_PUNCH_TYPES[1484]).toBe(13); // Atomic Shadow Scythe
    expect(WEAPON_PUNCH_TYPES[2386]).toBe(36); // Heavenly Scythe
    expect(WEAPON_PUNCH_TYPES[2572]).toBe(42); // Flame Scythe
    expect(WEAPON_PUNCH_TYPES[4166]).toBe(13); // Death's Scythe
    expect(WEAPON_PUNCH_TYPES[7098]).toBe(13); // Apocalypse Scythe
    expect(WEAPON_PUNCH_TYPES[9032]).toBe(13); // Scythe of the Underworld
    expect(WEAPON_PUNCH_TYPES[10498]).toBe(13); // Candy Cane Scythe
    expect(WEAPON_PUNCH_TYPES[11006]).toBe(13); // Soul Scythe
    expect(WEAPON_PUNCH_TYPES[11464]).toBe(13); // Ice Dragon Scythe
    expect(WEAPON_PUNCH_TYPES[13400]).toBe(13); // Bamboo Scythe
    expect(WEAPON_PUNCH_TYPES[13828]).toBe(13); // Soul Harvester's Scythe
    expect(WEAPON_PUNCH_TYPES[15574]).toBe(13); // Scythed Hero Scythes

    // Dragon Hands
    expect(WEAPON_PUNCH_TYPES[900]).toBe(6);   // Dragon Hand
    expect(WEAPON_PUNCH_TYPES[1378]).toBe(11); // Ice Dragon Hand
    expect(WEAPON_PUNCH_TYPES[1576]).toBe(16); // Fiesta Dragon
    expect(WEAPON_PUNCH_TYPES[1782]).toBe(21); // Dragon of Legend
    expect(WEAPON_PUNCH_TYPES[2212]).toBe(32); // Black Crystal Dragon
    expect(WEAPON_PUNCH_TYPES[2450]).toBe(40); // Diamond Dragon

    // Rayman
    expect(WEAPON_PUNCH_TYPES[5480]).toBe(80);  // Rayman's Fist
    expect(WEAPON_PUNCH_TYPES[5980]).toBe(80);  // Floating Fists
    expect(WEAPON_PUNCH_TYPES[12018]).toBe(80); // Rok's Fists

    // Guns, Blasters & Heavy Weapons
    expect(WEAPON_PUNCH_TYPES[472]).toBe(3);   // Tommygun
    expect(WEAPON_PUNCH_TYPES[768]).toBe(5);   // Sawed-Off Shotgun
    expect(WEAPON_PUNCH_TYPES[910]).toBe(7);   // Reanimator Remote
    expect(WEAPON_PUNCH_TYPES[930]).toBe(8);   // Death Ray
    expect(WEAPON_PUNCH_TYPES[1016]).toBe(9);  // Six Shooter
    expect(WEAPON_PUNCH_TYPES[1676]).toBe(17); // Squirt Gun
    expect(WEAPON_PUNCH_TYPES[1710]).toBe(18); // Keytar
    expect(WEAPON_PUNCH_TYPES[1748]).toBe(19); // Flamethrower
    expect(WEAPON_PUNCH_TYPES[1780]).toBe(20); // Legendbot-009
    expect(WEAPON_PUNCH_TYPES[2752]).toBe(45); // Pineapple Launcher
    expect(WEAPON_PUNCH_TYPES[3066]).toBe(57); // Fire Hose
    expect(WEAPON_PUNCH_TYPES[3300]).toBe(64); // Party Blaster
    expect(WEAPON_PUNCH_TYPES[3716]).toBe(69); // Neutron Gun
    expect(WEAPON_PUNCH_TYPES[4474]).toBe(72); // Skull Launcher
    expect(WEAPON_PUNCH_TYPES[4840]).toBe(78); // Balloon Launcher
    expect(WEAPON_PUNCH_TYPES[11140]).toBe(20); // Legendary Destroyer (Fists of Fury Rocket Mech Punch)
    expect(WEAPON_PUNCH_TYPES[11142]).toBe(21); // Legendary Owl (Legendary Night Pulse)

    // Bows
    expect(WEAPON_PUNCH_TYPES[278]).toBe(2);   // Heart Bow
    expect(WEAPON_PUNCH_TYPES[366]).toBe(2);   // Heartbow
    expect(WEAPON_PUNCH_TYPES[594]).toBe(4);   // Elvish Longbow
    expect(WEAPON_PUNCH_TYPES[2720]).toBe(44); // Electric Bow

    // Tridents & Spears
    expect(WEAPON_PUNCH_TYPES[2756]).toBe(47); // The Gungnir
    expect(WEAPON_PUNCH_TYPES[2802]).toBe(49); // Poseidon's Trident
    expect(WEAPON_PUNCH_TYPES[9758]).toBe(49); // Neptune's Trident

    // Staves & Magic
    expect(WEAPON_PUNCH_TYPES[1804]).toBe(22); // Zeus' Lightning Bolt
    expect(WEAPON_PUNCH_TYPES[1874]).toBe(24); // Ring of Force
    expect(WEAPON_PUNCH_TYPES[2866]).toBe(50); // Wizard's Staff
    expect(WEAPON_PUNCH_TYPES[3214]).toBe(60); // Axe of Winter
    expect(WEAPON_PUNCH_TYPES[3418]).toBe(65); // Serpent Staff
    expect(WEAPON_PUNCH_TYPES[4778]).toBe(76); // Adventurer's Whip
  });

  test("Player punchId dynamically resolves weapons and category fallbacks", () => {
    const mock = new Player({} as any, "test", 17091);

    // 1. Holding Legendary Katana gives punch 43
    mock.inventory.clothes.hand = 2592;
    expect(mock.punchId).toBe(43);

    // 2. Holding Hand Scythe gives punch 13
    mock.inventory.clothes.hand = 1068;
    expect(mock.punchId).toBe(13);

    // 3. Holding Flame Scythe gives punch 42
    mock.inventory.clothes.hand = 2572;
    expect(mock.punchId).toBe(42);

    // 4. Holding Heavenly Scythe gives punch 36
    mock.inventory.clothes.hand = 2386;
    expect(mock.punchId).toBe(36);

    // 5. Holding Dragon Hand gives punch 6
    mock.inventory.clothes.hand = 900;
    expect(mock.punchId).toBe(6);

    // 6. Holding Ice Dragon Hand gives punch 11
    mock.inventory.clothes.hand = 1378;
    expect(mock.punchId).toBe(11);

    // 7. Holding Death Ray gives punch 8
    mock.inventory.clothes.hand = 930;
    expect(mock.punchId).toBe(8);

    // 8. Holding Rayman's Fist gives punch 80
    mock.inventory.clothes.hand = 5480;
    expect(mock.punchId).toBe(80);

    // 9. Holding Zeus' Lightning Bolt gives punch 22
    mock.inventory.clothes.hand = 1804;
    expect(mock.punchId).toBe(22);

    // 10. Holding Fire Hose gives punch 57
    mock.inventory.clothes.hand = 3066;
    expect(mock.punchId).toBe(57);
  });

  test("Player punchId priority when hand is bare: Shirt > Face > Head > Back > Neck > Mask > Feet", () => {
    const mock = new Player({} as any, "test", 17091);
    mock.inventory.clothes.hand = 0; // Bare fist

    // Shirt item: Legendbot-009 (20: Rocket Punch)
    mock.inventory.clothes.shirt = 1780;
    mock.inventory.clothes.face = 2476; // Burning Eyes (39)
    mock.inventory.clothes.hair = 8372; // Giant Eye Head (8)
    mock.inventory.clothes.back = 1674; // Phoenix Wings (19)
    expect(mock.punchId).toBe(20);

    // Clear shirt: Burning Eyes (39) takes over
    mock.inventory.clothes.shirt = 0;
    expect(mock.punchId).toBe(39);

    // Clear face: Giant Eye Head (8) takes over
    mock.inventory.clothes.face = 0;
    expect(mock.punchId).toBe(8);

    // Clear head: Phoenix Wings (19) takes over
    mock.inventory.clothes.hair = 0;
    expect(mock.punchId).toBe(19);

    // Clear back: Dragon of Legend (21) takes over
    mock.inventory.clothes.back = 0;
    mock.inventory.clothes.necklace = 1782;
    expect(mock.punchId).toBe(21);

    // Clear neck: Dragon Mask (6) takes over
    mock.inventory.clothes.necklace = 0;
    mock.inventory.clothes.mask = 912;
    expect(mock.punchId).toBe(6);

    // Clear mask: Go-Go-Growformer! (5) takes over
    mock.inventory.clothes.mask = 0;
    mock.inventory.clothes.feet = 7384;
    expect(mock.punchId).toBe(5);

    // Clear feet: defaults to 0
    mock.inventory.clothes.feet = 0;
    expect(mock.punchId).toBe(0);
  });

  test("Custom punch id (/pid) strictly overrides all equipped clothing", () => {
    const mock = new Player({} as any, "test", 17091);
    mock.inventory.clothes.hand = 2592; // Legendary Katana (43)
    mock.customPunchId = 99;
    expect(mock.punchId).toBe(99);

    mock.customPunchId = 0;
    expect(mock.punchId).toBe(0);

    mock.customPunchId = null; // Revert override
    expect(mock.punchId).toBe(43);
  });
});
