import { describe, expect, test, mock } from "bun:test";
import { PLAYER_ROLE, playerRoleRank, CHARACTER_STATE } from "../src/constants";
import { canUseCommand, commands, executeCommand, findCommand } from "../src/game/commands/registry";
import "../src/game/commands/core-commands";
import { WEARABLE_MODS, PLAY_MODS, computeStats } from "../src/game/player/play-mods";
import { broadcastWorldChat } from "../src/game/network/chat-handler";
import { serverManager } from "../src/game/server/server-manager";

describe("Ban System Protections & Login Suspension Detection", () => {
  test("Staff cannot ban themselves", async () => {
    const banCmd = findCommand("ban");
    expect(banCmd).toBeDefined();

    let consoleMsg = "";
    const modPlayer: any = {
      id: "server:1",
      playerId: 42,
      tankIDName: "moderator_dan",
      displayName: "Dan",
      role: PLAYER_ROLE.MODERATOR,
      isDeveloper: false,
      isModerator: true,
      variants: {
        sendOnConsoleMessage: (msg: string) => {
          consoleMsg = msg;
        },
      },
    };

    // Attempting to self-ban using GrowID or #id
    serverManager.players.set(modPlayer.id, modPlayer);
    await banCmd?.execute(modPlayer, ["/moderator_dan"], "/ban /moderator_dan");
    serverManager.players.delete(modPlayer.id);
    // Should fail with self-ban warning
    expect(consoleMsg).toContain("cannot ban yourself");
  });

  test("Moderator cannot ban Developer or Owner", async () => {
    const banCmd = findCommand("ban");
    expect(banCmd).toBeDefined();

    const devTarget: any = {
      id: "server:2",
      playerId: 99,
      tankIDName: "owner_boss",
      displayName: "Boss",
      role: PLAYER_ROLE.DEVELOPER,
      isDeveloper: true,
      variants: {
        sendOnConsoleMessage: mock(),
        sendOnDialogRequest: mock(),
      },
      disconnect: mock(),
    };

    serverManager.players.set(devTarget.id, devTarget);

    let consoleMsg = "";
    const modPlayer: any = {
      id: "server:1",
      playerId: 42,
      tankIDName: "moderator_dan",
      displayName: "Dan",
      role: PLAYER_ROLE.MODERATOR,
      isDeveloper: false,
      isModerator: true,
      variants: {
        sendOnConsoleMessage: (msg: string) => {
          consoleMsg = msg;
        },
      },
    };

    await banCmd?.execute(modPlayer, ["/owner_boss"], "/ban /owner_boss");
    expect(consoleMsg).toContain("cannot ban an administrator or equal/higher rank staff");
    expect(devTarget.disconnect).not.toHaveBeenCalled();

    serverManager.players.delete(devTarget.id);
  });
});

describe("Lingering Punch Effect & Untransform Bug Prevention", () => {
  const GROWFORMER = 7384;

  test("Unequipping or dropping Go-Go-Growformer! untransforms player and removes punch laser", () => {
    // Simulate player with inventory, clothes, and transform state
    const player: any = {
      id: "server:10",
      netID: 1,
      playerId: 10,
      role: PLAYER_ROLE.BASIC,
      isDeveloper: false,
      isTransformed: false,
      customPunchId: null,
      inventory: {
        clothes: {
          hair: 0,
          shirt: 0,
          pants: 0,
          feet: 0,
          face: 0,
          hand: 0,
          back: 0,
          mask: 0,
          necklace: 0,
          ances: 0,
        },
        items: new Map([[GROWFORMER, { id: GROWFORMER, amount: 1 }]]),
        isEquipped(id: number) {
          return Object.values(this.clothes).includes(id);
        },
        unequipById(id: number) {
          for (const [slot, equippedId] of Object.entries(this.clothes)) {
            if (equippedId === id) {
              (this.clothes as any)[slot] = 0;
              return true;
            }
          }
          return false;
        },
      },
      state: {
        characterState: 0,
      },
      activeMods: new Set<string>(),
      playMods: {
        add(id: string) {
          player.activeMods.add(id);
        },
        remove(id: string) {
          player.activeMods.delete(id);
        },
        has(id: string) {
          return player.activeMods.has(id);
        },
      },
      hasTransformItem() {
        return this.inventory.clothes.feet === GROWFORMER;
      },
      canTransform() {
        if (this.isDeveloper) return true;
        return this.hasTransformItem();
      },
      untransform() {
        if (!this.isTransformed) return;
        this.isTransformed = false;
        this.state.characterState &= ~(CHARACTER_STATE.NO_BODY | CHARACTER_STATE.NO_HANDS);
        this.playMods.remove("transformed");
      },
      get characterStats() {
        const activeDefs = [...player.activeMods].map((id) => PLAY_MODS.get(id)).filter(Boolean);
        return computeStats(activeDefs as any);
      },
      get punchId() {
        return this.customPunchId ?? this.characterStats.punchType;
      },
    };

    // Step 1: Equip Growformer and Transform
    player.inventory.clothes.feet = GROWFORMER;
    expect(player.canTransform()).toBe(true);

    player.isTransformed = true;
    player.state.characterState |= CHARACTER_STATE.NO_BODY | CHARACTER_STATE.NO_HANDS;
    player.playMods.add("transformed");

    // Punch effect is 20 (Rocket punch) while transformed
    expect(player.characterStats.punchType).toBe(20);
    expect(player.punchId).toBe(20);
    expect(player.state.characterState & CHARACTER_STATE.NO_BODY).toBeTruthy();

    // Step 2: Unequip Growformer
    player.inventory.unequipById(GROWFORMER);
    if (player.isTransformed && !player.hasTransformItem() && !player.isDeveloper) {
      player.untransform();
    }

    // Must be untransformed immediately!
    expect(player.isTransformed).toBe(false);
    expect(player.playMods.has("transformed")).toBe(false);
    expect(player.state.characterState & CHARACTER_STATE.NO_BODY).toBeFalsy();
    // Punch laser is 100% gone, reverted to base fist (0)
    expect(player.characterStats.punchType).toBe(0);
    expect(player.punchId).toBe(0);
  });
});

describe("NekoRei Items Integration", () => {
  test("NekoRei's Fluffy Micio (#8030) and Fluffy Tail (#8032) are registered in WEARABLE_MODS", () => {
    const micioMod = WEARABLE_MODS.get(8030);
    expect(micioMod).toBeDefined();
    expect(micioMod?.id).toBe("nekorei_charm");
    expect(micioMod?.charState & CHARACTER_STATE.DOUBLE_JUMP).toBeTruthy();
    expect(micioMod?.speed).toBe(80);

    const tailMod = WEARABLE_MODS.get(8032);
    expect(tailMod).toBeDefined();
    expect(tailMod?.id).toBe("nekorei_charm");
  });
});

describe("Tiered Command Permissions by Role", () => {
  test("Role hierarchy assigns commands strictly according to permissions", () => {
    // Owner / Developer commands
    const startevent = findCommand("startevent");
    const giveitem = findCommand("giveitem");
    const clearworld = findCommand("clearworld");
    const rename = findCommand("rename");
    expect(startevent?.role).toBe(PLAYER_ROLE.DEVELOPER);
    expect(giveitem?.role).toBe(PLAYER_ROLE.DEVELOPER);
    expect(clearworld?.role).toBe(PLAYER_ROLE.DEVELOPER);
    expect(rename?.role).toBe(PLAYER_ROLE.DEVELOPER);

    // Moderator commands
    const ban = findCommand("ban");
    const unban = findCommand("unban");
    const invis = findCommand("invis");
    const sdb = findCommand("sdb");
    expect(ban?.role).toBe(PLAYER_ROLE.MODERATOR);
    expect(unban?.role).toBe(PLAYER_ROLE.MODERATOR);
    expect(invis?.role).toBe(PLAYER_ROLE.MODERATOR);
    expect(sdb?.role).toBe(PLAYER_ROLE.MODERATOR);

    // Guardian commands
    const warn = findCommand("warn");
    const mute = findCommand("mute");
    const unmute = findCommand("unmute");
    const freeze = findCommand("freeze");
    const unfreeze = findCommand("unfreeze");
    const curse = findCommand("curse");
    const heal = findCommand("heal");
    expect(warn?.role).toBe(PLAYER_ROLE.GUARDIAN);
    expect(mute?.role).toBe(PLAYER_ROLE.GUARDIAN);
    expect(unmute?.role).toBe(PLAYER_ROLE.GUARDIAN);
    expect(freeze?.role).toBe(PLAYER_ROLE.GUARDIAN);
    expect(unfreeze?.role).toBe(PLAYER_ROLE.GUARDIAN);
    expect(curse?.role).toBe(PLAYER_ROLE.GUARDIAN);
    expect(heal?.role).toBe(PLAYER_ROLE.GUARDIAN);

    // Supporter commands
    const ghost = findCommand("ghost");
    const pid = findCommand("pid");
    expect(ghost?.role).toBe(PLAYER_ROLE.MODERATOR);
    expect(pid?.role).toBe(PLAYER_ROLE.SUPPORTER);

    // Basic / User commands
    const help = findCommand("help");
    const who = findCommand("who");
    const rules = findCommand("rules");
    const trade = findCommand("trade");
    const warp = findCommand("warp");
    const sb = findCommand("sb");
    expect(help?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(who?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(rules?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(trade?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(warp?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(sb?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
  });

  test("canUseCommand permission check enforcement", () => {
    const guardianCommand = findCommand("warn")!;
    const modCommand = findCommand("ban")!;
    const devCommand = findCommand("startevent")!;
    const supporterCommand = findCommand("pid")!;
    const basicCommand = findCommand("help")!;

    const basicPlayer: any = { role: PLAYER_ROLE.BASIC };
    const supporterPlayer: any = { role: PLAYER_ROLE.SUPPORTER };
    const guardianPlayer: any = { role: PLAYER_ROLE.GUARDIAN };
    const modPlayer: any = { role: PLAYER_ROLE.MODERATOR };
    const devPlayer: any = { role: PLAYER_ROLE.DEVELOPER };

    // Basic player checks
    expect(canUseCommand(basicPlayer, basicCommand)).toBe(true);
    expect(canUseCommand(basicPlayer, supporterCommand)).toBe(false);
    expect(canUseCommand(basicPlayer, guardianCommand)).toBe(false);
    expect(canUseCommand(basicPlayer, modCommand)).toBe(false);
    expect(canUseCommand(basicPlayer, devCommand)).toBe(false);

    // Supporter checks
    expect(canUseCommand(supporterPlayer, basicCommand)).toBe(true);
    expect(canUseCommand(supporterPlayer, supporterCommand)).toBe(true);
    expect(canUseCommand(supporterPlayer, guardianCommand)).toBe(false);

    // Guardian checks
    expect(canUseCommand(guardianPlayer, basicCommand)).toBe(true);
    expect(canUseCommand(guardianPlayer, supporterCommand)).toBe(true);
    expect(canUseCommand(guardianPlayer, guardianCommand)).toBe(true);
    expect(canUseCommand(guardianPlayer, modCommand)).toBe(false);

    // Moderator checks
    expect(canUseCommand(modPlayer, guardianCommand)).toBe(true);
    expect(canUseCommand(modPlayer, modCommand)).toBe(true);
    expect(canUseCommand(modPlayer, devCommand)).toBe(false);

    // Developer checks
    expect(canUseCommand(devPlayer, devCommand)).toBe(true);
    expect(canUseCommand(devPlayer, modCommand)).toBe(true);
    expect(canUseCommand(devPlayer, guardianCommand)).toBe(true);
    expect(canUseCommand(devPlayer, supporterCommand)).toBe(true);
    expect(canUseCommand(devPlayer, basicCommand)).toBe(true);
  });
});

describe("Moderation Commands Execution & Chat Restrictions", () => {
  test("Muted player cannot send world chat", async () => {
    let bubbleText = "";
    let consoleMsg = "";

    const mutedPlayer: any = {
      world: {
        broadcastVariant: mock(),
      },
      state: {
        isMuted: true,
        characterState: 0,
      },
      playMods: {
        has: () => false,
      },
      sendTextBubble: (text: string) => {
        bubbleText = text;
      },
      variants: {
        sendOnConsoleMessage: (msg: string) => {
          consoleMsg = msg;
        },
      },
      formattedName: "TestUser",
      role: PLAYER_ROLE.BASIC,
    };

    await broadcastWorldChat(mutedPlayer, "Hello everyone!");

    expect(bubbleText).toContain("Mmmph!");
    expect(consoleMsg).toContain("You are muted");
    expect(mutedPlayer.world.broadcastVariant).not.toHaveBeenCalled();
  });

  test("Frozen player cannot send world chat", async () => {
    let bubbleText = "";
    let consoleMsg = "";

    const frozenPlayer: any = {
      world: {
        broadcastVariant: mock(),
      },
      state: {
        isMuted: false,
        characterState: CHARACTER_STATE.IS_FROZEN,
      },
      playMods: {
        has: () => false,
      },
      sendTextBubble: (text: string) => {
        bubbleText = text;
      },
      variants: {
        sendOnConsoleMessage: (msg: string) => {
          consoleMsg = msg;
        },
      },
      formattedName: "TestUser",
      role: PLAYER_ROLE.BASIC,
    };

    await broadcastWorldChat(frozenPlayer, "Let me move!");

    expect(bubbleText).toContain("Brrr!");
    expect(consoleMsg).toContain("You are frozen");
    expect(frozenPlayer.world.broadcastVariant).not.toHaveBeenCalled();
  });

  test("Warn, Mute, Unmute, Freeze, and Unfreeze commands operate on target", async () => {
    const targetPlayer: any = {
      id: "server:55",
      netID: 55,
      playerId: 55,
      tankIDName: "troublemaker",
      displayName: "Troublemaker",
      role: PLAYER_ROLE.BASIC,
      isDeveloper: false,
      state: {
        isMuted: false,
        characterState: 0,
      },
      activeMods: new Set<string>(),
      playMods: {
        add(id: string) {
          targetPlayer.activeMods.add(id);
        },
        remove(id: string) {
          targetPlayer.activeMods.delete(id);
        },
        has(id: string) {
          return targetPlayer.activeMods.has(id);
        },
      },
      sendTextBubble: mock(),
      sendCharacterState: mock(),
      sendSfx: mock(),
      variants: {
        sendOnDialogRequest: mock(),
        sendOnConsoleMessage: mock(),
        sendOnSetFreezeState: mock(),
      },
    };

    serverManager.players.set(targetPlayer.id, targetPlayer);

    const guardianPlayer: any = {
      id: "server:3",
      playerId: 3,
      tankIDName: "guardian_hero",
      displayName: "Hero",
      role: PLAYER_ROLE.GUARDIAN,
      isGuardian: true,
      variants: {
        sendOnConsoleMessage: mock(),
      },
    };

    // 1. /warn
    const warnCmd = findCommand("warn")!;
    await warnCmd.execute(guardianPlayer, ["/troublemaker", "Stop", "spamming"], "/warn /troublemaker Stop spamming");
    expect(targetPlayer.variants.sendOnDialogRequest).toHaveBeenCalled();

    // 2. /mute
    const muteCmd = findCommand("mute")!;
    await muteCmd.execute(guardianPlayer, ["/troublemaker", "5", "Spamming"], "/mute /troublemaker 5 Spamming");
    expect(targetPlayer.state.isMuted).toBe(true);
    expect(targetPlayer.playMods.has("duct_tape")).toBe(true);

    // 3. /unmute
    const unmuteCmd = findCommand("unmute")!;
    await unmuteCmd.execute(guardianPlayer, ["/troublemaker"], "/unmute /troublemaker");
    expect(targetPlayer.state.isMuted).toBe(false);
    expect(targetPlayer.playMods.has("duct_tape")).toBe(false);

    // 4. /freeze
    const freezeCmd = findCommand("freeze")!;
    await freezeCmd.execute(guardianPlayer, ["/troublemaker"], "/freeze /troublemaker");
    expect(targetPlayer.state.characterState & CHARACTER_STATE.IS_FROZEN).toBeTruthy();
    expect(targetPlayer.variants.sendOnSetFreezeState).toHaveBeenCalledWith(55, true);

    // 5. /unfreeze
    const unfreezeCmd = findCommand("unfreeze")!;
    await unfreezeCmd.execute(guardianPlayer, ["/troublemaker"], "/unfreeze /troublemaker");
    expect(targetPlayer.state.characterState & CHARACTER_STATE.IS_FROZEN).toBeFalsy();
    expect(targetPlayer.variants.sendOnSetFreezeState).toHaveBeenCalledWith(55, false);

    serverManager.players.delete(targetPlayer.id);
  });
});
