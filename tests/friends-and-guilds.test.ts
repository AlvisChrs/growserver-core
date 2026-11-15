import { describe, expect, it } from "bun:test";
import { FriendManager } from "../src/game/friends/friend-manager";
import { GuildManager } from "../src/game/guild/guild-manager";
import { GuildDB } from "../src/database/services/guild-db";
import { PlayerDB } from "../src/database/services/player-db";
import { spawnInvisGhostSwarm, spawnInvisReappearDarkFlames } from "../src/game/player/invis-effects";
import { findCommand, executeCommand } from "../src/game/commands/registry";
import { PLAYER_ROLE } from "../src/constants";
import { serverManager } from "../src/game/server/server-manager";
import type { World } from "../src/game/world/world";

function createMockPlayer(id: number, name: string) {
  const sentConsole: string[] = [];
  const sentDialogs: string[] = [];
  const sentBubbles: string[] = [];

  const player: any = {
    id: `server-17091:${id}`,
    netID: id,
    playerId: id,
    displayName: name,
    tankIDName: name.toLowerCase(),
    role: PLAYER_ROLE.BASIC,
    realRole: PLAYER_ROLE.BASIC,
    isDeveloper: false,
    isModerator: false,
    gems: 100_000,
    friends: new Set<number>(),
    incomingFriendRequests: new Set<number>(),
    guildId: null,
    guildRole: null,
    state: { x: 100, y: 100, characterState: 0, isGhost: false, world: { name: "TESTWORLD" } },
    currentWorld: "TESTWORLD",
    variants: {
      sendOnConsoleMessage: (msg: string) => sentConsole.push(msg),
      sendOnDialogRequest: (dialog: string) => sentDialogs.push(dialog),
    },
    sendTextBubble: (text: string) => sentBubbles.push(text),
    sendSfx: () => {},
    setGems: (amount: number) => { player.gems = amount; },
    saveToDatabase: async () => {},
    warp: (world: string) => { player.currentWorld = world; },
    _sentConsole: sentConsole,
    _sentDialogs: sentDialogs,
    _sentBubbles: sentBubbles,
  };

  serverManager.players.set(player.id, player);
  return player;
}

describe("Invis Effects & Dark Flame Reappear", () => {
  it("spawnInvisGhostSwarm runs smoothly without throwing", () => {
    const mockWorld: any = {
      sendParticleEffect: () => {},
      broadcastVariant: () => {},
      playPositioned: () => {},
    };
    expect(() => spawnInvisGhostSwarm(mockWorld, 100, 100, 1)).not.toThrow();
  });

  it("spawnInvisReappearDarkFlames runs smoothly and triggers dark flames", () => {
    const effects: number[] = [];
    const mockWorld: any = {
      sendParticleEffect: (id: number) => effects.push(id),
      broadcastVariant: () => {},
      playPositioned: () => {},
    };
    expect(() => spawnInvisReappearDarkFlames(mockWorld, 100, 100, 1)).not.toThrow();
    // Verify core dark rift (12), dark matter (44), and flame burst (36) were emitted
    expect(effects.includes(12)).toBe(true);
    expect(effects.includes(44)).toBe(true);
    expect(effects.includes(36)).toBe(true);
  });
});

describe("Friend System", () => {
  it("handles friend request, accept, and friend list dialog", async () => {
    const p1 = createMockPlayer(1001, "Alice");
    const p2 = createMockPlayer(1002, "Bob");

    // Send request
    await FriendManager.sendRequest(p1, p2);
    expect(p2.incomingFriendRequests.has(p1.playerId)).toBe(true);
    expect(p2._sentDialogs.length).toBeGreaterThan(0);
    expect(p2._sentDialogs[0]).toContain("Friend Request!");

    // Accept request
    await FriendManager.acceptRequest(p2, p1.playerId);
    expect(p2.friends.has(p1.playerId)).toBe(true);
    expect(p1.friends.has(p2.playerId)).toBe(true);
    expect(p2.incomingFriendRequests.has(p1.playerId)).toBe(false);

    // Open Friends Dialog
    await FriendManager.openFriendsDialog(p1);
    expect(p1._sentDialogs.length).toBeGreaterThan(0);
    const lastDialog = p1._sentDialogs[p1._sentDialogs.length - 1];
    expect(lastDialog).toContain("Friends List");

    // Remove friend
    await FriendManager.removeFriend(p1, p2.playerId);
    expect(p1.friends.has(p2.playerId)).toBe(false);
  });
});

describe("Guild System", () => {
  it("creates guild, invites member, allows chat, and disbands", async () => {
    const leader = createMockPlayer(2001, "GuildLeader");
    const member = createMockPlayer(2002, "GuildMember");

    // Create guild
    const guildName = "Guild" + Math.floor(Math.random() * 100000);
    const guild = await GuildManager.createGuild(leader, guildName, "TGA");
    expect(guild).toBeDefined();
    expect(guild?.name).toBe(guildName);
    expect(guild?.tag).toBe("TGA");
    expect(leader.guildId).toBe(guild?.id);
    expect(leader.guildRole).toBe("leader");

    // Invite member
    await GuildManager.inviteMember(leader, member);
    expect(member._sentDialogs.length).toBeGreaterThan(0);
    expect(member._sentDialogs[0]).toContain("Guild Invitation");

    // Member joins
    await GuildManager.joinGuild(member, guild!.id);
    expect(member.guildId).toBe(guild!.id);
    expect(member.guildRole).toBe("member");

    // Guild Chat
    GuildManager.sendGuildChat(member, "Hello Guild!");

    // Open Guild Dialog
    await GuildManager.openGuildDialog(leader);
    expect(leader._sentDialogs.length).toBeGreaterThan(0);
    const guildDialog = leader._sentDialogs[leader._sentDialogs.length - 1];
    expect(guildDialog).toContain(guildName);

    // Disband guild
    await GuildManager.disbandGuild(leader);
    expect(leader.guildId).toBeNull();
    expect(member.guildId).toBeNull();
  });
});

describe("Registered Slash Commands", () => {
  it("registers /friends, /friend, /unfriend, /guild, and /gc", () => {
    expect(findCommand("friends")).toBeDefined();
    expect(findCommand("friend")).toBeDefined();
    expect(findCommand("unfriend")).toBeDefined();
    expect(findCommand("guild")).toBeDefined();
    expect(findCommand("gc")).toBeDefined();
  });
});
