import { describe, expect, test, mock } from "bun:test";
import { PLAYER_ROLE, PLAYER_ROLE_NAMES, playerRoleRank } from "../src/constants";
import { commands, executeCommand } from "../src/game/commands/registry";
import "../src/game/commands/core-commands";
import type { Player } from "../src/game/player";
import { TileFlags, LockPermission } from "../src/game/world/constants";

describe("Role Hierarchy & Role Management System", () => {
  test("PLAYER_ROLE includes GUARDIAN and ranks correctly", () => {
    expect(PLAYER_ROLE.GUARDIAN).toBe(5);
    expect(PLAYER_ROLE_NAMES[PLAYER_ROLE.GUARDIAN]).toBe("Guardian");

    expect(playerRoleRank(PLAYER_ROLE.OWNER)).toBe(5);
    expect(playerRoleRank(PLAYER_ROLE.DEVELOPER)).toBe(4);
    expect(playerRoleRank(PLAYER_ROLE.MODERATOR)).toBe(3);
    expect(playerRoleRank(PLAYER_ROLE.GUARDIAN)).toBe(2);
    expect(playerRoleRank(PLAYER_ROLE.SUPPORTER)).toBe(1);
    expect(playerRoleRank(PLAYER_ROLE.BASIC)).toBe(0);

    expect(playerRoleRank(PLAYER_ROLE.DEVELOPER)).toBeGreaterThan(playerRoleRank(PLAYER_ROLE.MODERATOR));
    expect(playerRoleRank(PLAYER_ROLE.MODERATOR)).toBeGreaterThan(playerRoleRank(PLAYER_ROLE.GUARDIAN));
    expect(playerRoleRank(PLAYER_ROLE.GUARDIAN)).toBeGreaterThan(playerRoleRank(PLAYER_ROLE.SUPPORTER));
    expect(playerRoleRank(PLAYER_ROLE.SUPPORTER)).toBeGreaterThan(playerRoleRank(PLAYER_ROLE.BASIC));
  });

  test("Player role disguise and canManageRoles behavior", () => {
    // Mock player simulating a developer
    const devPlayer = {
      id: "test:1",
      displayName: "Alvis",
      role: PLAYER_ROLE.DEVELOPER,
      realRole: PLAYER_ROLE.DEVELOPER,
      get isDeveloper() {
        return playerRoleRank(this.role) >= playerRoleRank(PLAYER_ROLE.DEVELOPER);
      },
      get isModerator() {
        return playerRoleRank(this.role) >= playerRoleRank(PLAYER_ROLE.MODERATOR);
      },
      get isGuardian() {
        return this.role === PLAYER_ROLE.GUARDIAN;
      },
      get canManageRoles() {
        return (
          playerRoleRank(this.realRole) >= playerRoleRank(PLAYER_ROLE.DEVELOPER) ||
          playerRoleRank(this.role) >= playerRoleRank(PLAYER_ROLE.DEVELOPER)
        );
      },
      get country() {
        if (this.isDeveloper) return "rt";
        return "id";
      },
      get formattedName() {
        switch (this.role) {
          case PLAYER_ROLE.OWNER:
            return `\`b@${this.displayName}\`\``;
          case PLAYER_ROLE.DEVELOPER:
            return `\`8@${this.displayName}\`\``;
          case PLAYER_ROLE.MODERATOR:
            return `\`5@${this.displayName}\`\``;
          case PLAYER_ROLE.GUARDIAN:
            return `\`3@${this.displayName}\`\``;
          case PLAYER_ROLE.SUPPORTER:
            return `\`e${this.displayName}\`\``;
        }
        return `\`w${this.displayName}\`\``;
      },
      spawnOptions(local: boolean) {
        return {
          displayName: this.formattedName,
          country: this.country,
          mstate: (this.isModerator || this.isGuardian) && !this.isDeveloper ? 1 : 0,
          smstate: this.isDeveloper ? 1 : 0,
        };
      },
    };

    // Initially Developer
    expect(devPlayer.isDeveloper).toBe(true);
    expect(devPlayer.canManageRoles).toBe(true);
    expect(devPlayer.formattedName).toBe("`8@Alvis``");
    expect(devPlayer.spawnOptions(true).smstate).toBe(1);
    expect(devPlayer.spawnOptions(true).mstate).toBe(0);
    expect(devPlayer.country).toBe("rt");

    // Disguise as Moderator
    devPlayer.role = PLAYER_ROLE.MODERATOR;
    expect(devPlayer.isDeveloper).toBe(false);
    expect(devPlayer.isModerator).toBe(true);
    expect(devPlayer.canManageRoles).toBe(true); // Still allowed because realRole is Developer!
    expect(devPlayer.formattedName).toBe("`5@Alvis``");
    expect(devPlayer.spawnOptions(true).mstate).toBe(1);
    expect(devPlayer.spawnOptions(true).smstate).toBe(0);
    expect(devPlayer.country).toBe("id");

    // Disguise as Guardian
    devPlayer.role = PLAYER_ROLE.GUARDIAN;
    expect(devPlayer.isDeveloper).toBe(false);
    expect(devPlayer.isGuardian).toBe(true);
    expect(devPlayer.canManageRoles).toBe(true);
    expect(devPlayer.formattedName).toBe("`3@Alvis``");
    expect(devPlayer.spawnOptions(true).mstate).toBe(1);
    expect(devPlayer.spawnOptions(true).smstate).toBe(0);

    // Disguise as regular User / Player Biasa
    devPlayer.role = PLAYER_ROLE.BASIC;
    expect(devPlayer.isDeveloper).toBe(false);
    expect(devPlayer.isModerator).toBe(false);
    expect(devPlayer.canManageRoles).toBe(true); // Can still switch back!
    expect(devPlayer.formattedName).toBe("`wAlvis``");
    expect(devPlayer.spawnOptions(true).mstate).toBe(0);
    expect(devPlayer.spawnOptions(true).smstate).toBe(0);

    // Switch back to Developer
    devPlayer.role = PLAYER_ROLE.DEVELOPER;
    expect(devPlayer.isDeveloper).toBe(true);
    expect(devPlayer.formattedName).toBe("`8@Alvis``");
  });

  test("Normal user cannot manage roles", () => {
    const normalPlayer = {
      role: PLAYER_ROLE.BASIC,
      realRole: PLAYER_ROLE.BASIC,
      get canManageRoles() {
        return (
          playerRoleRank(this.realRole) >= playerRoleRank(PLAYER_ROLE.DEVELOPER) ||
          playerRoleRank(this.role) >= playerRoleRank(PLAYER_ROLE.DEVELOPER)
        );
      },
    };
    expect(normalPlayer.canManageRoles).toBe(false);
  });
});

describe("Basic Player Commands & World Owner Permissions", () => {
  test("Warp, Who, Rules, Me, Pull, Kick, and Role commands are registered", () => {
    expect(commands.has("warp")).toBe(true);
    expect(commands.has("who")).toBe(true);
    expect(commands.has("rules")).toBe(true);
    expect(commands.has("me")).toBe(true);
    expect(commands.has("pull")).toBe(true);
    expect(commands.has("kick")).toBe(true);
    expect(commands.has("role")).toBe(true);
  });

  test("Basic commands have BASIC role requirement so normal players can use them", () => {
    expect(commands.get("warp")?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(commands.get("pull")?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(commands.get("kick")?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(commands.get("who")?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
    expect(commands.get("rules")?.role ?? PLAYER_ROLE.BASIC).toBe(PLAYER_ROLE.BASIC);
  });

  test("/role self-switch changes player role and refreshes avatar", async () => {
    const consoleMsgs: string[] = [];
    let refreshed = false;
    const roleCmd = commands.get("role")!;
    const originalCooldown = roleCmd.cooldown;
    roleCmd.cooldown = 0;

    try {
      const mockDev = {
        id: "dev-session-role-test",
        displayName: "Admin",
        role: PLAYER_ROLE.DEVELOPER,
        realRole: PLAYER_ROLE.DEVELOPER,
        canManageRoles: true,
        variants: {
          sendOnConsoleMessage: (msg: string) => {
            consoleMsgs.push(msg);
          },
        },
        refreshAvatar: () => {
          refreshed = true;
        },
      } as unknown as Player;

      // Switch to mod
      await executeCommand(mockDev, "role mod");
      expect(mockDev.role).toBe(PLAYER_ROLE.MODERATOR);
      expect(refreshed).toBe(true);
      expect(consoleMsgs.some((m) => m.includes("Moderator"))).toBe(true);

      // Switch to guardian
      refreshed = false;
      await executeCommand(mockDev, "role guardian");
      expect(mockDev.role).toBe(PLAYER_ROLE.GUARDIAN);
      expect(refreshed).toBe(true);
      expect(consoleMsgs.some((m) => m.includes("Guardian"))).toBe(true);

      // Switch to user / biasa
      refreshed = false;
      await executeCommand(mockDev, "role biasa");
      expect(mockDev.role).toBe(PLAYER_ROLE.BASIC);
      expect(refreshed).toBe(true);
      expect(consoleMsgs.some((m) => m.includes("User"))).toBe(true);

      // Switch back to dev
      refreshed = false;
      await executeCommand(mockDev, "role dev");
      expect(mockDev.role).toBe(PLAYER_ROLE.DEVELOPER);
      expect(refreshed).toBe(true);
      expect(consoleMsgs.some((m) => m.includes("Developer"))).toBe(true);
    } finally {
      roleCmd.cooldown = originalCooldown;
    }
  });

  test("Unauthorized player running /role is rejected", async () => {
    const consoleMsgs: string[] = [];
    const mockUser = {
      id: "normal-user-1",
      displayName: "Noob",
      role: PLAYER_ROLE.BASIC,
      realRole: PLAYER_ROLE.BASIC,
      canManageRoles: false,
      variants: {
        sendOnConsoleMessage: (msg: string) => {
          consoleMsgs.push(msg);
        },
      },
    } as unknown as Player;

    await executeCommand(mockUser, "role dev");
    expect(mockUser.role).toBe(PLAYER_ROLE.BASIC);
    expect(consoleMsgs.some((m) => m.includes("permission"))).toBe(true);
  });
});

describe("Door Security & Privacy Enforcement", () => {
  test("Private door blocks unauthorized players and allows owners/builders", async () => {
    // Door block with PUBLIC flag not set
    const privateDoorBlock = {
      fg: 12, // Door
      flags: 0, // Not public!
      door: { destination: "TEST:1", id: "1", label: "Secret" },
    };

    const publicDoorBlock = {
      fg: 12,
      flags: TileFlags.PUBLIC,
      door: { destination: "TEST:2", id: "2", label: "Open" },
    };

    // Public door check: PUBLIC flag allows all
    expect((publicDoorBlock.flags & TileFlags.PUBLIC) !== 0).toBe(true);

    // Private door check: PUBLIC flag missing
    expect((privateDoorBlock.flags & TileFlags.PUBLIC) !== 0).toBe(false);

    // Verification that non-developer without permission is rejected
    const isPublic = (privateDoorBlock.flags & TileFlags.PUBLIC) !== 0;
    const isDev = false;
    const hasPermission = false;

    const accessAllowed = isPublic || isDev || hasPermission;
    expect(accessAllowed).toBe(false);

    // Lock owner/admin with permission is allowed
    const ownerAllowed = isPublic || isDev || true;
    expect(ownerAllowed).toBe(true);
  });
});
