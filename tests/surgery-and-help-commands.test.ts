import { describe, expect, test, mock } from "bun:test";
import { PLAYER_ROLE } from "../src/constants";
import { commands, executeCommand, findCommand } from "../src/game/commands/registry";
import "../src/game/commands/core-commands";
import { TileMapByItem } from "../src/game/world/tiles";
import { SurgeryRobotTile } from "../src/game/world/tiles/surgery-robot-tile";
import { handleSurgeryAction, handleSurgeryWrench, sendSurgeryDialog, startSurgery } from "../src/game/surgery/surgery-manager";
import { generateDefaultWorld } from "../src/game/world/generation/default";
import { WEATHER_CLEAR } from "../src/game/world/constants";

describe("Surgery Robot Patient & Medical Training Dummy", () => {
  test("TileMapByItem maps Surg-E (4296) and Train-E (8558) to SurgeryRobotTile", () => {
    expect(TileMapByItem[4296]).toBe(SurgeryRobotTile);
    expect(TileMapByItem[8558]).toBe(SurgeryRobotTile);
    expect(TileMapByItem[1256]).toBe(SurgeryRobotTile);
  });

  test("Punching or wrenching Surg-E opens surgery confirmation dialog with Break Robot option", async () => {
    const dialogs: string[] = [];
    const mockPlayer: any = {
      displayName: "Doctor",
      role: PLAYER_ROLE.BASIC,
      playMods: { has: () => false },
      quests: { surgerySkill: 15 },
      variants: {
        sendOnDialogRequest: (d: string) => dialogs.push(d),
      },
    };

    const mockWorld: any = {
      players: [mockPlayer],
    };

    const handled = handleSurgeryWrench(mockPlayer, mockWorld, 10, 15, 4296);
    expect(handled).toBe(true);
    expect(mockPlayer.surgery).toBeDefined();
    expect(mockPlayer.surgery.tileX).toBe(10);
    expect(mockPlayer.surgery.tileY).toBe(15);
    expect(mockPlayer.surgery.robotId).toBe(4296);
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]).toContain("Surg-E Anatomical Dummy");
    expect(dialogs[0]).toContain("surge_start");
    expect(dialogs[0]).toContain("surge_break");
    expect(dialogs[0]).toContain("surge_cancel");
  });

  test("Clicking an empty tray slot triggers emptySlotReason and informs player about missing tools", () => {
    const dialogs: string[] = [];
    const speechBubbles: string[] = [];
    const consoleMsgs: string[] = [];

    const mockPlayer: any = {
      displayName: "Doctor",
      role: PLAYER_ROLE.BASIC,
      inventory: {
        hasItem: () => false,
        getAmount: () => 0,
      },
      playMods: { has: () => false },
      quests: { surgerySkill: 20 },
      sendTextBubble: (txt: string) => speechBubbles.push(txt),
      variants: {
        sendOnDialogRequest: (d: string) => dialogs.push(d),
        sendOnConsoleMessage: (m: string) => consoleMsgs.push(m),
      },
      surgery: {
        tileX: 10,
        tileY: 15,
        robotId: 4296,
        maladyName: "broken arm",
        scanText: "",
        fixText: "",
        postText: "",
        sounded: false,
        labworked: false,
        fixable: false,
        sleeping: false,
        sleep: 0,
        pulse: 4,
        temp: 98.6,
        fever: 0,
        heart: 0,
        site: 0,
        dirt: 0,
        bleeding: 0,
        incisions: 0,
        incisionsNeeded: 1,
        brokenBones: 1,
        shatteredBones: 0,
        fixed: false,
        antibs: false,
        skillPassed: true,
        toolText: "",
        endText: "",
      },
    };

    const mockWorld: any = { players: [mockPlayer] };

    // Generate dialog: all 14 tools should render with their individual button IDs (e.g. tool1260)
    sendSurgeryDialog(mockPlayer);
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]).toContain("tool1260"); // Scalpel slot
    expect(dialogs[0]).toContain("tool1258"); // Sponge slot

    // Player clicks slot for Scalpel (1260) without having it
    handleSurgeryAction(mockPlayer, mockWorld, "tool1260");

    expect(speechBubbles.length).toBeGreaterThanOrEqual(1);
    expect(speechBubbles[0]).toContain("Scalpel");
  });
});

describe("Categorized /help and /? Command", () => {
  test("Developer sees Developer, Moderator, Guardian, Supporter, and Player sections in /help dialog", async () => {
    let capturedDialog = "";
    const consoleMsgs: string[] = [];

    const devPlayer: any = {
      role: PLAYER_ROLE.DEVELOPER,
      variants: {
        sendOnDialogRequest: (d: string) => {
          capturedDialog = d;
        },
        sendOnConsoleMessage: (m: string) => consoleMsgs.push(m),
      },
    };

    const cmd = findCommand("help");
    expect(cmd).toBeDefined();
    await cmd!.execute(devPlayer, [], "help");

    expect(capturedDialog).toContain("GrowServer Command Manual");
    expect(capturedDialog).toContain("Developer Commands");
    expect(capturedDialog).toContain("Moderator Commands");
    expect(capturedDialog).toContain("Guardian Commands");
    expect(capturedDialog).toContain("Supporter Commands");
    expect(capturedDialog).toContain("Player & Public Commands");
    expect(capturedDialog).toContain("/resetworld");
    expect(capturedDialog).toContain("/role");
    expect(capturedDialog).toContain("/reloadworld");
  });

  test("Normal user sees only Player & Public section without leaking Developer commands", async () => {
    let capturedDialog = "";
    const consoleMsgs: string[] = [];

    const userPlayer: any = {
      role: PLAYER_ROLE.BASIC,
      variants: {
        sendOnDialogRequest: (d: string) => {
          capturedDialog = d;
        },
        sendOnConsoleMessage: (m: string) => consoleMsgs.push(m),
      },
    };

    const cmd = findCommand("?");
    expect(cmd).toBeDefined();
    await cmd!.execute(userPlayer, [], "?");

    expect(capturedDialog).toContain("GrowServer Command Manual");
    expect(capturedDialog).toContain("Player & Public Commands");
    expect(capturedDialog).not.toContain("Developer Commands");
    expect(capturedDialog).not.toContain("Moderator Commands");
    expect(capturedDialog).not.toContain("/resetworld");
    expect(capturedDialog).not.toContain("/reloadworld");
    expect(capturedDialog).toContain("/rules");
    expect(capturedDialog).toContain("/hero");
    expect(capturedDialog).toContain("/immortal");
  });
});

describe("World Restore & Reset Safety", () => {
  test("/restore template regenerates world blocks and retains valid weather without crashing", async () => {
    const template = generateDefaultWorld("RESTORETEST", 100, 60);
    const mockWorld: any = {
      name: "RESTORETEST",
      width: 100,
      height: 60,
      data: {
        blocks: template.blocks,
        weather: { id: WEATHER_CLEAR },
      },
      players: [],
      mainDoor: { x: 50, y: 23 },
      markDirty: () => {},
      leave: () => {},
      enter: async () => {},
    };

    const consoleMsgs: string[] = [];
    const devPlayer: any = {
      role: PLAYER_ROLE.DEVELOPER,
      world: mockWorld,
      sendInventory: () => {},
      sendTextBubble: () => {},
      variants: {
        sendOnConsoleMessage: (m: string) => consoleMsgs.push(m),
      },
    };
    mockWorld.players.push(devPlayer);

    const cmd = findCommand("restore");
    expect(cmd).toBeDefined();
    await cmd!.execute(devPlayer, ["template"], "restore template");

    expect(mockWorld.data.weather).toBeDefined();
    expect(mockWorld.data.weather.id).toBe(WEATHER_CLEAR);
    expect(mockWorld.data.blocks.length).toBe(100 * 60);
    expect(consoleMsgs.some((m) => m.includes("restored to its procedural template"))).toBe(true);
  });
});

describe("/hero Cosmetic Disguise & /rules Interactive Dialog", () => {
  test("/hero toggles disguise without adding any items to backpack", async () => {
    let itemsAdded = 0;
    const initialClothes = { hair: 12, shirt: 34, pants: 56, feet: 78, face: 0, hand: 0, back: 0, mask: 0, necklace: 0, ances: 0 };
    const mockPlayer: any = {
      role: PLAYER_ROLE.BASIC,
      inventory: {
        clothes: { ...initialClothes },
        hasItem: () => false,
      },
      addItemInven: () => {
        itemsAdded++;
      },
      playMods: {
        add: () => {},
        remove: () => {},
      },
      sendClothesToWorld: () => {},
      sendCharacterState: () => {},
      sendSfx: () => {},
      sendTextBubble: () => {},
      variants: {
        sendOnConsoleMessage: () => {},
      },
    };

    const cmd = findCommand("hero");
    expect(cmd).toBeDefined();

    // 1. Transform into Ezio
    await cmd!.execute(mockPlayer, ["ezio"], "hero ezio");
    expect(itemsAdded).toBe(0); // Zero items added to backpack!
    expect(mockPlayer.isHeroDisguised).toBe(true);
    expect(mockPlayer.inventory.clothes.hair).toBe(7080); // Ezio's Hood

    // 2. Untransform with /hero off
    await cmd!.execute(mockPlayer, ["off"], "hero off");
    expect(itemsAdded).toBe(0);
    expect(mockPlayer.isHeroDisguised).toBe(false);
    expect(mockPlayer.inventory.clothes.hair).toBe(12); // Restored original civilian hair!
  });

  test("/rules sends interactive DialogBuilder popup with comprehensive rules", async () => {
    let capturedDialog = "";
    const consoleMsgs: string[] = [];
    const mockPlayer: any = {
      variants: {
        sendOnDialogRequest: (d: string) => {
          capturedDialog = d;
        },
        sendOnConsoleMessage: (m: string) => consoleMsgs.push(m),
      },
    };

    const cmd = findCommand("rules");
    expect(cmd).toBeDefined();
    await cmd!.execute(mockPlayer, [], "rules");

    expect(capturedDialog).toContain("GrowServer Rules & Guidelines");
    expect(capturedDialog).toContain("Respect & Decency");
    expect(capturedDialog).toContain("Fair Play & Economy");
    expect(capturedDialog).toContain("I Agree & Understand");
    expect(consoleMsgs.some((m) => m.includes("GrowServer Rules"))).toBe(true);
  });
});
