import { CHARACTER_STATE, PLAYER_ROLE, PLAYER_ROLE_NAMES } from "../../constants";
import { DialogBuilder } from "../../utils/dialog-builder";
import { searchItemNames } from "../item/item-search";
import { PlayerDB } from "../../database/services/player-db";
import { items } from "../item/item-info";
import { getItem } from "../item/item-utils";
import { Variant } from "../packets/variants";
import type { Player } from "../player";
import type { World } from "../world/world";
import { serverManager } from "../server/server-manager";
import { registerDialog } from "../network/dialog-handler";
import { homeWorldDialog } from "../network/home-world-dialog";
import { questDailyDialog, sendGoalsDialog } from "../quests";
import { ActionTypes, ITEM_ID, LOCKS, LockPermission, TileFlags, WEATHER_CLEAR } from "../world/constants";
import { generateDefaultWorld } from "../world/generation/default";
import { worldManager } from "../world/world-manager";
import { SeedTile } from "../world/tiles/seed-tile";
import { ProviderTile } from "../world/tiles/provider-tile";
import { tileFrom } from "../world/tiles";
import { Collection } from "../../utils/collection";
import { canUseCommand, commands, registerCommand, roleRank, type ChatCommand } from "./registry";
import { tradeManager } from "../trade/trade-manager";
import { eventManager, GameEventType } from "../events/event-manager";
import { riftCapeDialog, riftWingsDialog } from "../item/configurable-items";
import { HERO_SUIT_SETS } from "../player/transform";
import { spawnInvisGhostSwarm, spawnInvisReappearDarkFlames } from "../player/invis-effects";
import { FriendManager } from "../friends/friend-manager";
import { GuildManager } from "../guild/guild-manager";
import { botManager } from "../bot";

const ROLE_NAMES = PLAYER_ROLE_NAMES;

/**
 * Resolves a command target written as `/name` (exact GrowID) or `#id`
 * (database id) to an online player or a database record.
 */
async function resolveTarget(raw: string, includeDeleted = false): Promise<{ online?: Player; playerId?: number; name?: string } | null> {
  if (raw.startsWith("#")) {
    const id = Number.parseInt(raw.slice(1), 10);
    if (Number.isNaN(id)) return null;
    const online = serverManager.players.find((player) => player.playerId === id);
    if (online) return { online, playerId: id, name: online.tankIDName };
    const record = includeDeleted ? await PlayerDB.getByIdWithDeleted(id) : await PlayerDB.getById(id);
    return record ? { playerId: record.id, name: record.name } : null;
  }

  const name = raw.replace(/^\//, "").toLowerCase();
  if (!name) return null;
  const online = serverManager.players.find((player) => player.tankIDName.toLowerCase() === name);
  if (online) return { online, playerId: online.playerId, name: online.tankIDName };
  const record = includeDeleted ? await PlayerDB.getByNameWithDeleted(name) : await PlayerDB.getByName(name);
  return record ? { playerId: record.id, name: record.name } : null;
}

function sendTargetUsage(player: Player, usage: string): void {
  player.variants.sendOnConsoleMessage(`\`4Usage: ${usage}\`o - target is \`/username\`\` or \`#id\`\``);
}

registerCommand({
  name: "help",
  aliases: ["?", "commands", "cmds"],
  description: "Shows available commands categorized by role",
  usage: "/help [command]",
  cooldown: 2,
  execute(player, args) {
    const requested = args[0]?.replace(/^\//, "").toLowerCase();
    if (requested) {
      const command = commands.get(requested) ?? commands.find((entry) => (entry.aliases ?? []).includes(requested));
      if (!command) return player.variants.sendOnConsoleMessage("It seems that command doesn't exist.");
      if (!canUseCommand(player, command)) {
        return player.variants.sendOnConsoleMessage("`4You don't have permission to view or use this command.``");
      }

      const dialog = new DialogBuilder()
        .defaultColor()
        .addLabelWithIcon(`/${command.name}`, ITEM_ID.WRENCH, "small")
        .addSpacer("small")
        .addSmallText(`Description: ${command.description}`)
        .addSmallText(`Usage: ${command.usage ?? `/${command.name}`}`)
        .addSmallText(`Aliases: ${command.aliases?.length ? command.aliases.map((alias) => `/${alias}`).join(", ") : "None"}`)
        .addSmallText(`Cooldown: ${command.cooldown ?? 1}s`)
        .addSmallText(`Role: ${ROLE_NAMES[command.role ?? PLAYER_ROLE.BASIC]}`)
        .addQuickExit()
        .endDialog("help_end", "", "Ok")
        .str();
      return player.variants.sendOnDialogRequest(dialog);
    }

    const userRole = player.role ?? PLAYER_ROLE.BASIC;
    const userRoleName = ROLE_NAMES[userRole] ?? "User";
    const userRank = roleRank(userRole);

    const allowed = commands
      .toArray()
      .filter((command: ChatCommand) => canUseCommand(player, command));

    const ownerCmds: ChatCommand[] = [];
    const devCmds: ChatCommand[] = [];
    const modCmds: ChatCommand[] = [];
    const guardianCmds: ChatCommand[] = [];
    const supporterCmds: ChatCommand[] = [];
    const userCmds: ChatCommand[] = [];

    for (const cmd of allowed) {
      const requiredRole = cmd.role ?? PLAYER_ROLE.BASIC;
      const cmdRank = roleRank(requiredRole);
      if (cmdRank >= roleRank(PLAYER_ROLE.OWNER)) {
        ownerCmds.push(cmd);
      } else if (cmdRank >= roleRank(PLAYER_ROLE.DEVELOPER)) {
        devCmds.push(cmd);
      } else if (cmdRank >= roleRank(PLAYER_ROLE.MODERATOR)) {
        modCmds.push(cmd);
      } else if (cmdRank >= roleRank(PLAYER_ROLE.GUARDIAN)) {
        guardianCmds.push(cmd);
      } else if (cmdRank >= roleRank(PLAYER_ROLE.SUPPORTER)) {
        supporterCmds.push(cmd);
      } else {
        userCmds.push(cmd);
      }
    }

    const sortFn = (a: ChatCommand, b: ChatCommand) => a.name.localeCompare(b.name);
    ownerCmds.sort(sortFn);
    devCmds.sort(sortFn);
    modCmds.sort(sortFn);
    guardianCmds.sort(sortFn);
    supporterCmds.sort(sortFn);
    userCmds.sort(sortFn);

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("`wGrowServer Command Manual``", ITEM_ID.WRENCH, "big")
      .addSpacer("small")
      .addSmallText(`Your Role: \`2${userRoleName}\`\` (Rank ${userRank}) | Total Commands: \`w${allowed.length}\`\``)
      .addSmallText("`oTip: Use `w/help <command>`o for full parameter usage & description!``")
      .addSpacer("small");

    if (ownerCmds.length > 0) {
      dialog.addLabelWithIcon(`\`bOwner Commands (${ownerCmds.length})\`\``, 32, "small");
      dialog.addTextBox(ownerCmds.map((c) => `\`b/${c.name}\`\``).join(", "));
      dialog.addSpacer("small");
    }

    if (devCmds.length > 0) {
      dialog.addLabelWithIcon(`\`#Developer Commands (${devCmds.length})\`\``, 32, "small");
      dialog.addTextBox(devCmds.map((c) => `\`2/${c.name}\`\``).join(", "));
      dialog.addSpacer("small");
    }

    if (modCmds.length > 0) {
      dialog.addLabelWithIcon(`\`^Moderator Commands (${modCmds.length})\`\``, 1256, "small");
      dialog.addTextBox(modCmds.map((c) => `\`^/${c.name}\`\``).join(", "));
      dialog.addSpacer("small");
    }

    if (guardianCmds.length > 0) {
      dialog.addLabelWithIcon(`\`0Guardian Commands (${guardianCmds.length})\`\``, 242, "small");
      dialog.addTextBox(guardianCmds.map((c) => `\`0/${c.name}\`\``).join(", "));
      dialog.addSpacer("small");
    }

    if (supporterCmds.length > 0) {
      dialog.addLabelWithIcon(`\`eSupporter Commands (${supporterCmds.length})\`\``, 756, "small");
      dialog.addTextBox(supporterCmds.map((c) => `\`e/${c.name}\`\``).join(", "));
      dialog.addSpacer("small");
    }

    if (userCmds.length > 0) {
      dialog.addLabelWithIcon(`\`$Player & Public Commands (${userCmds.length})\`\``, 18, "small");
      dialog.addTextBox(userCmds.map((c) => `\`$/${c.name}\`\``).join(", "));
      dialog.addSpacer("small");
    }

    dialog
      .addQuickExit()
      .endDialog("help_overview", "", "Ok");

    player.variants.sendOnDialogRequest(dialog.str());
    player.variants.sendOnConsoleMessage(
      `\`o[Help]: Showing \`w${allowed.length}\`o commands for \`2${userRoleName}\`o. Type \`/help <cmd>\` for individual info.`,
    );
  },
});

registerCommand({
  name: "ping",
  aliases: ["pong"],
  description: "Ping pong",
  cooldown: 2,
  execute(player) {
    player.variants.sendOnConsoleMessage("Pong :>");
  },
});

registerCommand({
  name: "sb",
  description: "Broadcast a message to everyone",
  usage: "/sb <message>",
  cooldown: 5,
  execute(player, args) {
    if (player.state.isMuted || player.playMods.has("duct_tape")) {
      return player.variants.sendOnConsoleMessage("`4You are muted and cannot use super broadcast.``");
    }
    if (args.length === 0) return player.variants.sendOnConsoleMessage("Message are required.");
    const message = args.join(" ").replace(/`./g, "");
    const location = player.currentWorld || "the menu";
    // super broadcasts use the retail layout, with the world hidden when a
    // signal jammer is on
    const worldLabel = player.world?.signalJammed ? "`4JAMMED!``" : location;
    const textColor = player.isDeveloper ? "`5" : player.isModerator ? "`^" : "`$";

    serverManager.broadcast(
      Variant.from("OnConsoleMessage", "CP:_PL:0_OID:_CT:[SB]_ `5** from (`0" + player.formattedName + "`````5) in [```$" + worldLabel + "```5] ** : ``" + textColor + message + "``").parsePacket(),
    );
    for (const other of serverManager.players.values()) other.sendSfx("audio/beep.wav");
  },
});

registerCommand({
  name: "sdb",
  description: "Send a global message to everyone via a dialog box",
  usage: "/sdb <message>",
  role: PLAYER_ROLE.MODERATOR,
  cooldown: 5,
  execute(player, args) {
    if (args.length === 0) return player.variants.sendOnConsoleMessage("Message are required.");

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Super Duper Broadcast", 2480, "big")
      .addSpacer("small")
      .addSmallText(`\`oMessage from: \`$${player.displayName}`)
      .addSmallText(`\`oWorld: \`o${player.currentWorld || "the menu"}`)
      .addSpacer("small")
      .addSmallText(`\`5${args.join(" ")}`)
      .addQuickExit()
      .endDialog("ok", "Close", "")
      .str();

    for (const other of serverManager.players.values()) {
      other.variants.sendOnDialogRequest(dialog);
      other.sendSfx("audio/beep.wav");
    }
    player.variants.sendOnConsoleMessage("`2Super Duper Broadcast sent to all players.");
  },
});

registerCommand({
  name: "warp",
  description: "Warp to another world or door.",
  usage: "/warp <world name:door id>",
  role: PLAYER_ROLE.BASIC,
  cooldown: 2,
  async execute(player, args) {
    const destination = args[0];
    if (!destination) return player.variants.sendOnConsoleMessage("`4Usage: /warp <world name:door id>");

    const [rawWorld, doorId] = destination.split(":");
    const worldName = (rawWorld || player.currentWorld).toUpperCase();
    if (!worldName) return player.variants.sendOnConsoleMessage("`4That world name is empty.");
    if (/\W|_/.test(worldName) || worldName === "EXIT") return player.variants.sendOnConsoleMessage("`4That world name contains invalid characters.");

    const world = await worldManager.get(worldName);
    const door = (doorId && world.data.blocks.find((block) => block.door?.id?.toUpperCase() === doorId.toUpperCase())) || world.mainDoor;
    if (doorId && !door) return player.variants.sendOnConsoleMessage("`4Door not found in that world.");

    player.variants.sendOnConsoleMessage(`Warping to \`2${doorId ? `${worldName}:${doorId}` : worldName}\`\`...`);
    if (player.world === world) {
      player.variants.sendOnZoomCamera(10000, 1000);
      player.setPosition((door?.x ?? 0) * 32, (door?.y ?? 0) * 32);
      world.playPositioned("audio/door_open.wav", player.netID);
      return;
    }
    await player.enterWorld(worldName, door?.x, door?.y);
  },
});

registerCommand({
  name: "sethome",
  aliases: ["addhome"],
  description: "Set the world you are in as your home world.",
  usage: "/sethome",
  cooldown: 2,
  execute(player) {
    const world = player.world;
    if (!world) return player.variants.sendOnConsoleMessage("`4You are not in a world.");

    if (world.getOwnerPlayerId() !== player.playerId) {
      return player.variants.sendOnConsoleMessage("`4You can only set your home world in a World Locked world that you own.");
    }
    if (player.homeWorld === world.name) {
      return player.variants.sendOnConsoleMessage(`\`2${world.name}\`\` is already your home world!`);
    }

    player.setHomeWorld(world.name);
    const message = `\`2${world.name}\`\` has been set as your home world!`;
    player.sendTextBubble(message, false);
    player.variants.sendOnConsoleMessage(message);
  },
});

registerCommand({
  name: "removehome",
  aliases: ["delhome", "unhome", "unsethome"],
  description: "Remove the home world from your account.",
  usage: "/removehome",
  cooldown: 2,
  execute(player) {
    if (!player.homeWorld) return player.variants.sendOnConsoleMessage("`4You don't have a home world set.");

    const removed = player.homeWorld;
    player.setHomeWorld(null);
    const message = `\`2${removed}\`\` has been removed as your home world!`;
    player.sendTextBubble(message, false);
    player.variants.sendOnConsoleMessage(message);
  },
});

registerCommand({
  name: "home",
  aliases: ["gethome"],
  description: "Warp to your home world.",
  usage: "/home",
  cooldown: 15,
  async execute(player) {
    const name = player.homeWorld;
    if (!name) {
      player.variants.sendOnDialogRequest(homeWorldDialog(player));
      return;
    }

    player.variants.sendOnConsoleMessage(`Magically warping to home world \`5${name}\`\`...`);
    if (player.world?.name === name) {
      const door = player.world.mainDoor;
      player.setPosition((door?.x ?? 0) * 32, (door?.y ?? 0) * 32);
      player.world.playPositioned("audio/door_open.wav", player.netID);
      return;
    }
    await player.enterWorld(name);
  },
});

registerCommand({
  name: "homeworld",
  description: "Open your home-world settings.",
  cooldown: 1,
  execute(player) {
    player.variants.sendOnDialogRequest(homeWorldDialog(player));
  },
});

registerCommand({
  name: "daily",
  aliases: ["dailyquest", "dailyquests"],
  description: "Open Crazy Jim's daily quest.",
  cooldown: 1,
  execute(player) {
    player.variants.sendOnDialogRequest(questDailyDialog(player));
  },
});

registerCommand({
  name: "roles",
  aliases: ["rolequest", "rolequests", "quests"],
  description: "Open your role quests and level rewards.",
  cooldown: 1,
  execute(player) {
    sendGoalsDialog(player);
  },
});

function sendFindResults(player: Player, query: string, seedsOnly: boolean): void {
  const dialog = new DialogBuilder().defaultColor().addQuickExit().addLabelWithIcon("Find the item", 6016, "big").addSpacer("small");
  const result = searchItemNames(items.meta.items.values(), query, seedsOnly);
  if (!result.query) return;
  if (result.corrected) dialog.addSmallText(`No exact matches; showing results for: ${result.query}`);
  for (const item of result.matches) {
    const id = item.id!;
    dialog.addButtonWithIcon(id, id, item.name ?? String(id), "staticBlueFrame", id);
  }

  if (result.matches.length === 0) dialog.addSmallText("`4No items found.``");
  dialog.endDialog("find_item_end", "Cancel", "");
  player.variants.sendOnDialogRequest(dialog.str());
}

registerCommand({
  name: "find",
  description: "Find some items",
  usage: "/find [item name]",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player, args) {
    if (args.length > 0) return sendFindResults(player, args.join(" "), false);

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Find the item", 6016, "big")
      .addCheckbox("seed_only", "Only seed", "not_selected")
      .addInputBox("find_item_name", "", "", 30)
      .addQuickExit()
      .endDialog("find_item", "Cancel", "Find")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  },
});

registerDialog("find_item", (player, action) => {
  if (!player.isDeveloper) return;
  const query = action.get("find_item_name");
  if (!query) return;
  sendFindResults(player, query, action.get("seed_only") === "1");
});

registerDialog("find_item_end", (player, action) => {
  if (!player.isDeveloper) return;
  const itemId = action.getInt("buttonClicked", 0, 0);
  const item = getItem(itemId);
  if (!item) return;
  player.addItemInven(itemId, 200);
  player.variants.sendOnConsoleMessage(`Added \`6${item.name}\`\` to your inventory.`);
});

registerCommand({
  name: "search",
  description: "Search items with the searchable item list",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    const dialog = new DialogBuilder()
      .defaultColor()
      .addInputBox("n", "Search: ", "", 26)
      .raw("add_searchable_item_list||sourceType:allItems;listType:iconWithCustomLabel;resultLimit:50|n|\n")
      .addQuickExit()
      .endDialog("search_item", "", "")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  },
});

registerDialog("search_item", (player, action) => {
  if (!player.isDeveloper) return;
  const clicked = action.get("buttonClicked");
  // searchableItemListButton_{itemID}_{index}_{param}
  const itemId = Number.parseInt(clicked.startsWith("searchableItemListButton_") ? (clicked.split("_")[1] ?? "") : clicked, 10);
  const item = getItem(itemId);
  if (!item) return player.variants.sendOnConsoleMessage("`4Error: Invalid item ID.``");
  player.addItemInven(itemId, 200);
  player.variants.sendOnConsoleMessage(`Added \`6${item.name}\`\` (200) to your inventory.`);
});

const GHOST_STATE = CHARACTER_STATE.WALK_IN_BLOCKS | CHARACTER_STATE.DOUBLE_JUMP | CHARACTER_STATE.HAVE_FLYING_PINEAPPLE;

registerCommand({
  name: "ghost",
  aliases: ["unghost"],
  description: "Toggle ghost mode to walk through blocks.",
  role: PLAYER_ROLE.MODERATOR,
  cooldown: 2,
  execute(player) {
    player.state.isGhost = !player.state.isGhost;
    const world = player.world;

    if (player.state.isGhost) {
      player.state.characterState |= GHOST_STATE;
      if (world) {
        world.playPositioned?.("audio/spooky.wav", player.netID);
      }
      player.variants.sendOnConsoleMessage("`2Ghost mode enabled``. You can now walk through blocks!");
      // semi-transparent white appearance
      for (const other of player.world?.players ?? [player]) {
        other.variants.sendClothes(player.netID, player.effectiveClothes, 0xffffff80);
      }
    } else {
      player.state.characterState &= ~GHOST_STATE;
      if (world) {
        world.playPositioned?.("audio/teleport.wav", player.netID);
      }
      player.variants.sendOnConsoleMessage("`4Ghost mode disabled``. You materialize back to normal.");
      player.refreshAvatar();
      player.sendClothesToWorld();
    }
    player.sendCharacterState();
  },
});

registerCommand({
  name: "pid",
  aliases: ["punchid"],
  description: "Change your punch effect id",
  usage: "/pid <id>",
  role: PLAYER_ROLE.SUPPORTER,
  cooldown: 1,
  execute(player, args) {
    const punchId = Number.parseInt(args[0] ?? "", 10);
    if (Number.isNaN(punchId) || punchId < 0 || punchId > 255) return player.variants.sendOnConsoleMessage("`4Usage: /pid <id> (0-255)");
    player.customPunchId = punchId;
    player.variants.sendOnConsoleMessage(`\`2Your punch id has been changed to: ${punchId}`);
    player.sendCharacterState();
  },
});

registerCommand({
  name: "addgems",
  aliases: ["gems", "gem"],
  description: "Add gems to a player or yourself",
  usage: "/gems [target] <amount>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  async execute(player, args) {
    let target = player;
    let rawAmount = args[0];

    if (args.length >= 2) {
      const resolved = await resolveTarget(args[0]!);
      if (!resolved?.playerId) return player.variants.sendOnConsoleMessage(`\`4Player \`o${args[0]}\`4 not found.\`\``);
      if (resolved.online) {
        target = resolved.online;
      } else {
        const amount = Number.parseInt(args[1] ?? "", 10);
        if (Number.isNaN(amount) || amount <= 0) return player.variants.sendOnConsoleMessage("`4Invalid gem amount.``");
        await PlayerDB.addGems(resolved.playerId, amount);
        return player.variants.sendOnConsoleMessage(`\`2Successfully added \`o${amount.toLocaleString()}\`2 gems to \`o${resolved.name}\`2 (offline).\`\``);
      }
      rawAmount = args[1];
    }

    const amount = Number.parseInt(rawAmount ?? "", 10);
    if (Number.isNaN(amount) || amount <= 0) return player.variants.sendOnConsoleMessage("`4Usage: /gems [target] <amount> (e.g. /gems 1000000)``");

    target.addGems(amount);
    target.variants.sendOnConsoleMessage(`\`2You received \`o${amount.toLocaleString()}\`2 gems!\`\``);
    if (target !== player) {
      player.variants.sendOnConsoleMessage(`\`2Successfully added \`o${amount.toLocaleString()}\`2 gems to \`o${target.displayName}\`2.\`\``);
    }
  },
});

registerCommand({
  name: "giverole",
  description: "Permanently assign a player's role in the database.",
  usage: "/giverole <target> <0 user|1 developer|2 moderator|3 supporter|4 owner|5 guardian>",
  role: PLAYER_ROLE.OWNER,
  cooldown: 1,
  async execute(player, args) {
    const [rawTarget, rawRole] = args;
    const role = Number.parseInt(rawRole ?? "", 10) as PLAYER_ROLE;
    if (!rawTarget || !(role in ROLE_NAMES)) return sendTargetUsage(player, "/giverole <target> <0|1|2|3|4|5>");

    const target = await resolveTarget(rawTarget);
    if (!target?.playerId) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 not found.\`\``);

    await PlayerDB.updateById(target.playerId, { role_id: role });
    if (target.online) {
      target.online.role = role;
      target.online.realRole = role;
      target.online.refreshAvatar();
      target.online.variants.sendOnConsoleMessage(`\`2Your role has been changed to \`o${ROLE_NAMES[role]}\`2 by Server Owner \`$${player.displayName}\`2!\`\``);
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully changed role of \`o${target.name}\`2 to \`o${ROLE_NAMES[role]}\`2.\`\``);
  },
});

registerCommand({
  name: "saveall",
  aliases: ["save-all", "flush"],
  description: "Force saves all active worlds and flushes database state to disk immediately",
  usage: "/saveall",
  role: PLAYER_ROLE.OWNER,
  cooldown: 5,
  async execute(player) {
    const count = worldManager.worlds.size;
    await worldManager.saveAll();
    player.variants.sendOnConsoleMessage(`\`2[Owner]: Successfully saved \`w${count}\`2 active worlds and flushed state to disk!\`\``);
  },
});

registerCommand({
  name: "serverstatus",
  aliases: ["sysinfo", "stats"],
  description: "Shows live server performance metrics, RAM usage, and multi-server status",
  usage: "/serverstatus",
  role: PLAYER_ROLE.OWNER,
  cooldown: 3,
  execute(player) {
    const mem = process.memoryUsage();
    const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
    const heapMb = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = uptimeSec % 60;
    const totalPlayers = serverManager.players.size;
    const activeWorlds = worldManager.worlds.size;

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("`bServer System Status (Owner)``", 32, "big")
      .addSpacer("small")
      .addSmallText(`Server Uptime: \`w${hours}h ${mins}m ${secs}s\`\``)
      .addSmallText(`Total Connected Players: \`2${totalPlayers}\`\``)
      .addSmallText(`Active Worlds in Memory: \`e${activeWorlds}\`\``)
      .addSmallText(`RAM Usage (Heap / RSS): \`w${heapMb} MB / ${rssMb} MB\`\``)
      .addSmallText(`Active Subservers: \`w${serverManager.servers.size}\`\``)
      .addQuickExit()
      .endDialog("sysinfo_end", "", "Close")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  },
});

registerCommand({
  name: "alert",
  aliases: ["announcement", "notice"],
  description: "Send a server-wide popup alert to every online player across all servers",
  usage: "/alert <message>",
  role: PLAYER_ROLE.OWNER,
  cooldown: 2,
  execute(player, args) {
    const message = args.join(" ").trim();
    if (!message) return player.variants.sendOnConsoleMessage("`4Usage: /alert <message>``");

    for (const target of serverManager.players.values()) {
      target.sendTextBubble(`\`4[ANNOUNCEMENT]\`o: ${message}`, true);
      target.variants.sendOnConsoleMessage(`\`4[ANNOUNCEMENT from Owner ${player.displayName}]: \`$$${message}\`\``);
      target.sendSfx("audio/party_horn.wav");
    }
    player.variants.sendOnConsoleMessage(`\`2Alert broadcasted to \`w${serverManager.players.size}\`2 online players.\`\``);
  },
});

const ROLE_INPUT_MAP: Record<string, PLAYER_ROLE> = {
  "0": PLAYER_ROLE.BASIC,
  user: PLAYER_ROLE.BASIC,
  player: PLAYER_ROLE.BASIC,
  basic: PLAYER_ROLE.BASIC,
  biasa: PLAYER_ROLE.BASIC,
  normal: PLAYER_ROLE.BASIC,

  "1": PLAYER_ROLE.DEVELOPER,
  dev: PLAYER_ROLE.DEVELOPER,
  developer: PLAYER_ROLE.DEVELOPER,

  "2": PLAYER_ROLE.MODERATOR,
  mod: PLAYER_ROLE.MODERATOR,
  moderator: PLAYER_ROLE.MODERATOR,

  "3": PLAYER_ROLE.SUPPORTER,
  supporter: PLAYER_ROLE.SUPPORTER,
  vip: PLAYER_ROLE.SUPPORTER,

  "4": PLAYER_ROLE.OWNER,
  owner: PLAYER_ROLE.OWNER,

  "5": PLAYER_ROLE.GUARDIAN,
  guardian: PLAYER_ROLE.GUARDIAN,
  guard: PLAYER_ROLE.GUARDIAN,
};

registerCommand({
  name: "role",
  aliases: ["setrole", "myrole"],
  description: "Switch your active role/disguise or set another player's role",
  usage: "/role <dev|mod|guardian|supporter|user|owner> OR /role <target> <role>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  async execute(player, args) {
    if (!player.canManageRoles) {
      return player.variants.sendOnConsoleMessage("`4You don't have permission to manage roles.``");
    }

    if (args.length === 0) {
      player.variants.sendOnConsoleMessage(`\`2Your current role: \`o${ROLE_NAMES[player.role]}\`2 (Original: \`o${ROLE_NAMES[player.realRole]}\`2)`);
      player.variants.sendOnConsoleMessage("`2Available roles: \`$dev, mod, guardian, supporter, user, owner``");
      player.variants.sendOnConsoleMessage("`2Usage: \`/role <role>\`\` to change yourself, or \`/role <target> <role>\`\` to change another player.");
      return;
    }

    // Single argument: self role change (/role dev, /role mod, /role guardian, /role user)
    if (args.length === 1) {
      const input = args[0]!.toLowerCase().trim();
      const targetRole = ROLE_INPUT_MAP[input];
      if (targetRole === undefined) {
        return player.variants.sendOnConsoleMessage("`4Invalid role. Available: dev, mod, guardian, supporter, user, owner``");
      }

      if (targetRole === PLAYER_ROLE.OWNER && player.realRole !== PLAYER_ROLE.OWNER) {
        return player.variants.sendOnConsoleMessage("`4Only the true Server Owner can assume the Owner role!``");
      }

      if (roleRank(targetRole) > roleRank(player.realRole)) {
        return player.variants.sendOnConsoleMessage("`4You cannot disguise as a role higher than your original rank!``");
      }

      player.role = targetRole;
      player.refreshAvatar();
      player.variants.sendOnConsoleMessage(`\`2Your active role is now: \`$${ROLE_NAMES[targetRole]}\`2! (Disguise/Test mode active)`);
      return;
    }

    // Two arguments: set another player's role (/role <target> <role>)
    const [rawTarget, rawRole] = args;
    const targetRole = ROLE_INPUT_MAP[rawRole!.toLowerCase().trim()];
    if (targetRole === undefined) {
      return player.variants.sendOnConsoleMessage("`4Invalid role. Available: dev, mod, guardian, supporter, user, owner``");
    }

    if (targetRole === PLAYER_ROLE.OWNER && !player.isOwner) {
      return player.variants.sendOnConsoleMessage("`4Only the Server Owner can grant the Owner role!``");
    }

    const target = await resolveTarget(rawTarget!);
    if (!target?.playerId) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 not found.\`\``);

    if (target.online && roleRank(target.online.role) >= roleRank(player.role) && target.online.playerId !== player.playerId) {
      return player.variants.sendOnConsoleMessage("`4You cannot change the role of an equal or higher ranked staff member!``");
    }

    await PlayerDB.updateById(target.playerId, { role_id: targetRole });
    if (target.online) {
      target.online.role = targetRole;
      target.online.realRole = targetRole;
      target.online.refreshAvatar();
      target.online.variants.sendOnConsoleMessage(`\`2Your role has been set to \`o${ROLE_NAMES[targetRole]}\`2 by \`$${player.displayName}\`2!\`\``);
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully set role of \`o${target.name}\`2 to \`o${ROLE_NAMES[targetRole]}\`2.\`\``);
  },
});

const worldBackups = new Map<string, string>();
const manualWorldBackups = new Map<string, string>();

function clearWorldBlocks(world: World): void {
  worldBackups.set(world.name, JSON.stringify(world.data.blocks));
  for (const block of world.data.blocks) {
    const item = getItem(block.fg || block.bg);
    const isAreaLock = LOCKS.some((lock) => lock.id === item?.id);
    if (block.fg === ITEM_ID.MAIN_DOOR || block.fg === ITEM_ID.BEDROCK || (item?.type === ActionTypes.LOCK && !isAreaLock)) continue;

    const { x, y } = block;
    const record = block as unknown as Record<string, unknown>;
    for (const key of Object.keys(record)) delete record[key];
    Object.assign(block, { x, y, fg: 0, bg: 0, flags: 0 });
  }
  world.clearDrops();
  world.markDirty();

  for (const other of world.players) other.leaveWorld();
}

registerCommand({
  name: "clearworld",
  aliases: ["nuke", "clean"],
  description: "Clear everything in your world (instant with /nuke)",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 5,
  execute(player, args) {
    const world = player.world;
    if (!world) return;
    const ownerId = world.getOwnerPlayerId();
    if (ownerId === undefined || (ownerId !== player.playerId && !player.isDeveloper)) {
      return player.variants.sendOnConsoleMessage("`4You need to own this world to clear it.``");
    }

    const isInstant = player.isDeveloper || args[0]?.toLowerCase() === "force" || args[0]?.toLowerCase() === "fast";
    if (isInstant) {
      clearWorldBlocks(world);
      return player.variants.sendOnConsoleMessage("`2World nuked and cleared instantly! Use \`/undo\` to revert if needed.``");
    }

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Warning", 1432, "big")
      .addTextBox("This will clear everything on your world, including your building. Are you sure?")
      .endDialog("confirm_clearworld", "Nevermind", "Yes")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  },
});

registerDialog("confirm_clearworld", (player) => {
  const world = player.world;
  if (!world) return;
  const ownerId = world.getOwnerPlayerId();
  if (ownerId === undefined || (ownerId !== player.playerId && !player.isDeveloper)) return;

  clearWorldBlocks(world);
});

registerCommand({
  name: "save",
  aliases: ["saveserver"],
  description: "Save every player and world now",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 5,
  async execute(player) {
    for (const other of serverManager.players.values()) await other.saveToDatabase();
    await worldManager.saveAll();
    player.variants.sendOnConsoleMessage("Successfully saved all worlds & players");
  },
});

registerCommand({
  name: "rename",
  aliases: ["changename", "nick", "name"],
  description: "Change your display name or another player's name",
  usage: "/rename [target] <new name>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  async execute(player, args) {
    if (args.length === 0) return player.variants.sendOnConsoleMessage("`4Usage: /rename [target] <new name>``");

    // Check if targeting another player
    if (args.length >= 2) {
      const targetQuery = args[0];
      const target = await resolveTarget(targetQuery);
      if (target?.playerId) {
        const newName = args.slice(1).join(" ").trim();
        if (!newName) return player.variants.sendOnConsoleMessage("`4Invalid new name.``");
        await PlayerDB.updateById(target.playerId, { display_name: newName });
        if (target.online) {
          target.online.displayName = newName;
          target.online.world?.broadcastVariant(Variant.from({ netID: target.online.netID }, "OnNameChanged", target.online.formattedName));
          target.online.sendCountryState();
          target.online.variants.sendOnConsoleMessage(`\`2Your display name was changed to ${target.online.formattedName}\`2 by ${player.displayName}.\`\``);
        }
        return player.variants.sendOnConsoleMessage(`\`2Successfully renamed \`o${target.name}\`2 to \`o${newName}\`2.\`\``);
      }
    }

    const name = args.join(" ").trim();
    player.displayName = name;
    await PlayerDB.updateById(player.playerId, { display_name: name });
    player.world?.broadcastVariant(Variant.from({ netID: player.netID }, "OnNameChanged", player.formattedName));
    player.sendCountryState();
    player.variants.sendOnConsoleMessage(`Your display name has been changed to ${player.formattedName}.`);
  },
});

registerCommand({
  name: "warn",
  aliases: ["warning"],
  description: "Issue an official warning to a player",
  usage: "/warn <target> <reason>",
  role: PLAYER_ROLE.GUARDIAN,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget || args.length < 2) return sendTargetUsage(player, "/warn <target> <reason>");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    const reason = args.slice(1).join(" ");
    const warnDialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("`4Official Server Warning``", ITEM_ID.WRENCH, "small")
      .addSpacer("small")
      .addSmallText(`\`4You have received an official warning from staff (\`w${player.displayName}\`4):\`\``)
      .addSpacer("small")
      .addSmallText(`Reason: \`o${reason}\`\``)
      .addSpacer("small")
      .addSmallText("Please respect server rules `/rules` to avoid account suspension.")
      .addQuickExit()
      .endDialog("warn_end", "", "I Understand")
      .str();

    target.online.variants.sendOnDialogRequest(warnDialog);
    target.online.variants.sendOnConsoleMessage(`\`4[WARNING from ${player.displayName}]: \`o${reason}\`\``);
    target.online.sendSfx("audio/cant_place_tile.wav");
    if ((target.online as any).isBot) {
      (target.online as any).say?.("Sorry staff! I understand, won't happen again!");
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully issued warning to \`o${target.name}\`2.`);
  },
});

registerCommand({
  name: "mute",
  description: "Mute a player from chat",
  usage: "/mute <target> [minutes] [reason]",
  role: PLAYER_ROLE.GUARDIAN,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/mute <target> [minutes] [reason]");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    if (roleRank(target.online.role) >= roleRank(player.role)) {
      return player.variants.sendOnConsoleMessage("`4You cannot mute equal or higher ranked staff.``");
    }

    let minutes = 0;
    let reasonIndex = 1;
    if (args[1] && /^\d+$/.test(args[1])) {
      minutes = Number.parseInt(args[1], 10);
      reasonIndex = 2;
    }
    const reason = args.slice(reasonIndex).join(" ") || "Muted by staff.";

    target.online.state.isMuted = true;
    target.online.playMods.add("duct_tape");
    target.online.sendTextBubble("`4Mmmph! (You have been muted)``", true);
    target.online.variants.sendOnConsoleMessage(`\`4You have been muted by ${player.displayName}${minutes > 0 ? ` for ${minutes}m` : ""}: \`o${reason}\`\``);
    target.online.sendSfx("audio/cant_place_tile.wav");

    if (minutes > 0) {
      setTimeout(() => {
        if (target.online && target.online.state.isMuted) {
          target.online.state.isMuted = false;
          target.online.playMods.remove("duct_tape");
          target.online.variants.sendOnConsoleMessage("`2Your mute has expired. You can now chat again.``");
        }
      }, minutes * 60 * 1000);
    }

    player.variants.sendOnConsoleMessage(`\`2Successfully muted \`o${target.name}\`2${minutes > 0 ? ` for ${minutes} minute(s)` : ""}.`);
  },
});

registerCommand({
  name: "unmute",
  description: "Unmute a player",
  usage: "/unmute <target>",
  role: PLAYER_ROLE.GUARDIAN,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/unmute <target>");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    target.online.state.isMuted = false;
    target.online.playMods.remove("duct_tape");
    target.online.variants.sendOnConsoleMessage(`\`2You have been unmuted by ${player.displayName}. You can now chat again.\`\``);
    player.variants.sendOnConsoleMessage(`\`2Successfully unmuted \`o${target.name}\`2.`);
  },
});

registerCommand({
  name: "freeze",
  description: "Freeze a player in place",
  usage: "/freeze <target>",
  role: PLAYER_ROLE.GUARDIAN,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/freeze <target>");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    if (roleRank(target.online.role) >= roleRank(player.role)) {
      return player.variants.sendOnConsoleMessage("`4You cannot freeze equal or higher ranked staff.``");
    }

    target.online.state.characterState |= CHARACTER_STATE.IS_FROZEN;
    target.online.playMods.add("frozen");
    target.online.variants.sendOnSetFreezeState(target.online.netID, true);
    target.online.sendCharacterState();
    target.online.sendTextBubble("`4*Brrr! (You have been frozen)*``", true);
    target.online.variants.sendOnConsoleMessage(`\`4You have been frozen by ${player.displayName}.\`\``);
    if ((target.online as any).isBot) {
      (target.online as any).say?.("Brrr! Why am I frozen?! Please unfreeze me!");
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully froze \`o${target.name}\`2.`);
  },
});

registerCommand({
  name: "unfreeze",
  aliases: ["thaw"],
  description: "Unfreeze a frozen player",
  usage: "/unfreeze <target>",
  role: PLAYER_ROLE.GUARDIAN,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/unfreeze <target>");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    target.online.state.characterState &= ~CHARACTER_STATE.IS_FROZEN;
    target.online.playMods.remove("frozen");
    target.online.variants.sendOnSetFreezeState(target.online.netID, false);
    target.online.sendCharacterState();
    target.online.variants.sendOnConsoleMessage(`\`2You have been unfrozen by ${player.displayName}.\`\``);
    if ((target.online as any).isBot) {
      (target.online as any).say?.("Phew, thanks for unfreezing me!");
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully unfroze \`o${target.name}\`2.`);
  },
});

registerCommand({
  name: "curse",
  description: "Curse a player with the dark aura",
  usage: "/curse <target>",
  role: PLAYER_ROLE.GUARDIAN,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/curse <target>");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    if (roleRank(target.online.role) >= roleRank(player.role)) {
      return player.variants.sendOnConsoleMessage("`4You cannot curse equal or higher ranked staff.``");
    }

    target.online.state.characterState |= CHARACTER_STATE.IS_CURSED;
    target.online.sendCharacterState();
    target.online.variants.sendOnConsoleMessage(`\`4You have been cursed by ${player.displayName}!\`\``);
    if ((target.online as any).isBot) {
      (target.online as any).say?.("Nooo! The dark aura is consuming me! Have mercy!");
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully cursed \`o${target.name}\`2.`);
  },
});

registerCommand({
  name: "online",
  aliases: ["who"],
  description: "Show how many players are online",
  cooldown: 2,
  execute(player) {
    const total = serverManager.getTotalPlayersCount();
    const here = player.world?.players.length ?? 0;
    player.variants.sendOnConsoleMessage(`There are \`w${total}\`\` players online, \`w${here}\`\` in this world.`);
  },
});

registerCommand({
  name: "mods",
  aliases: ["mod", "staff"],
  description: "List online moderators and developers",
  cooldown: 2,
  execute(player) {
    const staff = serverManager.players
      .toArray()
      .filter((p) => p.isModerator || p.isDeveloper || p.isGuardian);
    if (staff.length === 0) {
      return player.variants.sendOnConsoleMessage("`4There are no moderators online right now.``");
    }
    const names = staff.map((p) => `${p.formattedName} (\`2${ROLE_NAMES[p.role]}\`\`)`);
    player.variants.sendOnConsoleMessage(`Online staff: ${names.join(", ")}`);
  },
});

registerCommand({
  name: "kick",
  description: "Kick a player from the server or current world",
  usage: "/kick <target> [reason]",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/kick <target> [reason]");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    const isStaff = player.isModerator || player.isGuardian || player.isDeveloper;
    const isWorldAuth = player.world && (player.isWorldOwner || player.world.isWorldAdmin(player.playerId));

    if (!isStaff && !isWorldAuth) {
      return player.variants.sendOnConsoleMessage("`4You must be the world owner or admin to kick players here.``");
    }

    const reason = args.slice(1).join(" ") || (isStaff ? "Kicked by administrator." : "Kicked by world owner.");

    if (!isStaff) {
      if (target.online.world !== player.world) {
        return player.variants.sendOnConsoleMessage("`4That player is not in this world.``");
      }
      if (target.online.isDeveloper || target.online.isModerator || target.online.isGuardian) {
        return player.variants.sendOnConsoleMessage("`4You cannot kick a staff member.``");
      }
      target.online.variants.sendOnConsoleMessage(`\`4You were kicked from this world: \`o${reason}\`\``);
      await target.online.leaveWorld();
      player.variants.sendOnConsoleMessage(`\`2Successfully kicked \`o${target.name}\`2 from the world.\`\``);
      return;
    }

    target.online.variants.sendOnConsoleMessage(`\`4You were kicked: \`o${reason}`);
    target.online.disconnect();
    player.variants.sendOnConsoleMessage(`\`2Successfully kicked \`o${target.name}\`2 from the server.`);
  },
});

registerCommand({
  name: "ban",
  description: "Ban a player from the server",
  usage: "/ban <target> [reason]",
  role: PLAYER_ROLE.MODERATOR,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/ban <target> [reason]");
    const target = await resolveTarget(rawTarget, true);
    if (!target?.playerId) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 not found.\`\``);

    if (target.playerId === player.playerId) {
      return player.variants.sendOnConsoleMessage("`4You cannot ban yourself!``");
    }

    if (target.online) {
      if (roleRank(target.online.role) >= roleRank(player.role)) {
        return player.variants.sendOnConsoleMessage("`4You cannot ban an administrator or equal/higher rank staff member.``");
      }
    } else {
      const record = await PlayerDB.getByIdWithDeleted(target.playerId);
      if (record && roleRank(record.role_id ?? PLAYER_ROLE.BASIC) >= roleRank(player.role)) {
        return player.variants.sendOnConsoleMessage("`4You cannot ban an administrator or equal/higher rank staff member.``");
      }
    }

    const reason = args.slice(1).join(" ") || "Banned by administrator.";

    await PlayerDB.softDelete(target.playerId);
    if (target.online) {
      const banDialog = new DialogBuilder()
        .defaultColor()
        .addLabelWithIcon("`4Account Suspended``", ITEM_ID.WRENCH, "small")
        .addSpacer("small")
        .addSmallText("`4You have been suspended from GrowServer!``")
        .addSmallText(`Admin: \`w${player.displayName}\`\``)
        .addSmallText(`Reason: \`o${reason}\`\``)
        .addSmallText("If you believe this ban is a mistake, contact server administration.")
        .addQuickExit()
        .endDialog("ban_notice", "", "Ok")
        .str();

      target.online.variants.sendOnDialogRequest(banDialog);
      target.online.variants.sendOnConsoleMessage(`\`4[ALERT] You have been banned by ${player.displayName}: \`o${reason}\`\``);
      target.online.sendSfx("audio/cant_place_tile.wav");
      const targetPeer = target.online;
      setTimeout(() => {
        try {
          targetPeer.disconnect();
        } catch {}
      }, 1500);
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully banned \`o${target.name}\`2 (Reason: ${reason}).`);
  },
});

registerCommand({
  name: "unban",
  description: "Unban a player",
  usage: "/unban <target>",
  role: PLAYER_ROLE.MODERATOR,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/unban <target>");
    const target = await resolveTarget(rawTarget, true);
    if (!target?.playerId) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 not found.\`\``);

    await PlayerDB.restore(target.playerId);
    player.variants.sendOnConsoleMessage(`\`2Successfully unbanned \`o${target.name}\`2.`);
  },
});

registerCommand({
  name: "pull",
  description: "Pull a player to your current position",
  usage: "/pull <target>",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/pull <target>");
    if (!player.world) return player.variants.sendOnConsoleMessage("`4You must be in a world to use this command.``");

    const isStaff = player.isModerator || player.isGuardian || player.isDeveloper;
    const isWorldAuth = player.isWorldOwner || player.world.isWorldAdmin(player.playerId);

    if (!isStaff && !isWorldAuth) {
      return player.variants.sendOnConsoleMessage("`4You must be the world owner or admin to pull players here.``");
    }

    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);

    if (!isStaff) {
      if (target.online.world !== player.world) {
        return player.variants.sendOnConsoleMessage("`4That player is not in this world.``");
      }
      if (target.online.isDeveloper || target.online.isModerator) {
        return player.variants.sendOnConsoleMessage("`4You cannot pull a staff member.``");
      }
    }

    if (target.online.world !== player.world) {
      await target.online.enterWorld(player.world.name, Math.floor(player.x / 32), Math.floor(player.y / 32));
    } else {
      target.online.setPosition(player.x, player.y);
    }
    if ((target.online as any).isBot) {
      (target.online as any).say?.("Whoa, where did I just get pulled to?!");
      (target.online as any).homeTileX = Math.floor(player.x / 32);
      (target.online as any).homeTileY = Math.floor(player.y / 32);
    }
    target.online.variants.sendOnConsoleMessage(`\`2You were pulled by \`$${player.displayName}\`2!\`\``);
    player.variants.sendOnConsoleMessage(`\`2Successfully pulled \`$${target.name}\`2 to your position.\`\``);
  },
});

registerCommand({
  name: "tp",
  aliases: ["goto", "teleport"],
  description: "Teleport to a player",
  usage: "/tp <target>",
  role: PLAYER_ROLE.MODERATOR,
  cooldown: 1,
  async execute(player, args) {
    const rawTarget = args[0];
    if (!rawTarget) return sendTargetUsage(player, "/tp <target>");
    const target = await resolveTarget(rawTarget);
    if (!target?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 is not online.\`\``);
    if (!target.online.world) return player.variants.sendOnConsoleMessage("`4Player is not in a world.``");

    if (player.world !== target.online.world) {
      await player.enterWorld(target.online.world.name, Math.floor(target.online.x / 32), Math.floor(target.online.y / 32));
    } else {
      player.setPosition(target.online.x, target.online.y);
    }
    player.variants.sendOnConsoleMessage(`\`2Teleported to \`$${target.name}\`2.\`\``);
  },
});

registerCommand({
  name: "fillworld",
  aliases: ["fill", "bedrockworld", "fillbedrock"],
  description: "Fill the entire world with a specific block (e.g. bedrock, dirt, lava)",
  usage: "/fillworld [item id or name]",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 3,
  async execute(player, args) {
    const world = player.world;
    if (!world) return;

    let rawItem = args.join(" ").trim();
    if (!rawItem) rawItem = "bedrock"; // defaults to bedrock if empty

    let blockId = Number.parseInt(rawItem, 10);
    if (Number.isNaN(blockId)) {
      const match = searchItemNames(items.meta.items.values(), rawItem, false).matches[0];
      if (!match?.id) return player.variants.sendOnConsoleMessage(`\`4Item \`o${rawItem}\`4 not found.\`\``);
      blockId = match.id;
    }
    const item = getItem(blockId);
    if (!item) return player.variants.sendOnConsoleMessage("`4Invalid item ID.``");

    worldBackups.set(world.name, JSON.stringify(world.data.blocks));

    for (const block of world.data.blocks) {
      if (block.fg === ITEM_ID.MAIN_DOOR || block.fg === ITEM_ID.BEDROCK) continue;
      block.fg = blockId;
      block.bg = 0;
    }
    world.markDirty();
    for (const p of world.players) {
      p.leaveWorld();
    }
    player.variants.sendOnConsoleMessage(`\`2World filled with \`o${item.name}\`2! Use \`/undo\` to revert if needed.\`\``);
  },
});

registerCommand({
  name: "undo",
  aliases: ["undoworld", "revert"],
  description: "Undo the last /fillworld or /nuke in this world",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    const world = player.world;
    if (!world) return;
    const backup = worldBackups.get(world.name);
    if (!backup) return player.variants.sendOnConsoleMessage("`4No undo history found for this world.``");

    world.data.blocks = JSON.parse(backup);
    world.markDirty();
    for (const p of world.players) {
      p.leaveWorld();
    }
    player.variants.sendOnConsoleMessage("`2World successfully reverted to before the last fill/nuke! Re-enter to view.``");
  },
});

registerCommand({
  name: "backup",
  aliases: ["snapshot", "saveworld"],
  description: "Take a snapshot of the current world to restore anytime",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    const world = player.world;
    if (!world) return;
    manualWorldBackups.set(world.name, JSON.stringify(world.data.blocks));
    player.variants.sendOnConsoleMessage(`\`2Snapshot of world \`o${world.name}\`2 saved! Use \`/restore\` anytime to revert.\`\``);
  },
});

registerCommand({
  name: "restore",
  aliases: ["restoreworld", "loadsnapshot"],
  description: "Restore the world from your manual /backup snapshot or procedural template",
  usage: "/restore [template]",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  async execute(player, args) {
    const world = player.world;
    if (!world) return;

    const sub = args[0]?.toLowerCase();
    if (sub === "template" || sub === "default") {
      const template = generateDefaultWorld(world.name, world.width, world.height);
      world.data.blocks = template.blocks;
      world.data.dropped = { uid: 0, items: [] };
      delete world.data.worldLockIndex;
      world.data.weather = { id: WEATHER_CLEAR };
      world.markDirty();

      const door = world.mainDoor;
      const doorX = door?.x ?? 0;
      const doorY = door?.y ?? 0;

      const playersInWorld = [...world.players];
      for (const p of playersInWorld) {
        world.leave(p);
        await world.enter(p, doorX, doorY);
        p.sendInventory();
        p.sendTextBubble("`2The world was reset to its original template!``", true);
        p.variants.sendOnConsoleMessage(`\`2World \`w${world.name}\`2 was regenerated to its clean procedural template.\`\``);
      }
      player.variants.sendOnConsoleMessage(`\`2World \`w${world.name}\`2 was restored to its procedural template.\`\``);
      return;
    }

    const backup = manualWorldBackups.get(world.name);
    if (!backup) {
      player.variants.sendOnConsoleMessage(
        "`4No manual snapshot found for this world. Use \`/backup\` first to save a snapshot, or use \`/restore template\` (or \`/resetworld\`) to reset to default procedural template.\`\`",
      );
      return;
    }

    world.data.blocks = JSON.parse(backup);
    world.data.weather ??= { id: WEATHER_CLEAR };
    world.markDirty();

    const door = world.mainDoor;
    const doorX = door?.x ?? 0;
    const doorY = door?.y ?? 0;

    const playersInWorld = [...world.players];
    for (const p of playersInWorld) {
      world.leave(p);
      await world.enter(p, doorX, doorY);
      p.sendInventory();
      p.sendTextBubble("`2World restored to snapshot!``", true);
      p.variants.sendOnConsoleMessage(`\`2World \`o${world.name}\`2 restored to snapshot!\`\``);
    }
  },
});

registerCommand({
  name: "rain",
  aliases: ["dropworld", "dropall"],
  description: "Rain/drop an item across the entire world",
  usage: "/rain <item id or name> [amount per tile] [spacing]",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 5,
  execute(player, args) {
    const world = player.world;
    if (!world) return;
    const rawItem = args[0];
    if (!rawItem) return player.variants.sendOnConsoleMessage("`4Usage: /rain <item id or name> [amount] [spacing]``");

    let blockId = Number.parseInt(rawItem, 10);
    if (Number.isNaN(blockId)) {
      const match = searchItemNames(items.meta.items.values(), rawItem, false).matches[0];
      if (!match?.id) return player.variants.sendOnConsoleMessage(`\`4Item \`o${rawItem}\`4 not found.\`\``);
      blockId = match.id;
    }
    const item = getItem(blockId);
    if (!item) return player.variants.sendOnConsoleMessage("`4Invalid item ID.``");
    const amount = Number.parseInt(args[1] ?? "1", 10) || 1;
    const spacing = Math.max(1, Number.parseInt(args[2] ?? "3", 10) || 3);

    let count = 0;
    for (let y = 0; y < 55; y += spacing) {
      for (let x = 0; x < 100; x += spacing) {
        if (!world.isSolid(x, y)) {
          world.drop(player, x * 32, y * 32, blockId, Math.min(200, amount), { noSimilar: true });
          count++;
        }
      }
    }
    world.markDirty();
    player.variants.sendOnConsoleMessage(`\`2Raining \`o${item.name}\`2 (${count} stacks) across the world! Use \`/cleardrops\` to remove.\`\``);
  },
});

registerCommand({
  name: "cleardrops",
  aliases: ["cleardrop", "nodrops"],
  description: "Remove all dropped items in the world",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    const world = player.world;
    if (!world) return;
    world.clearDrops();
    world.markDirty();
    player.variants.sendOnConsoleMessage("`2All dropped items have been cleared from this world.\`\``");
  },
});

registerCommand({
  name: "giveitem",
  aliases: ["give", "item"],
  description: "Give an item directly to your inventory without dialog",
  usage: "/give <item id or name> [amount]",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    const rawItem = args[0];
    if (!rawItem) return player.variants.sendOnConsoleMessage("`4Usage: /give <item id or name> [amount]``");

    let itemId = Number.parseInt(rawItem, 10);
    let count = Number.parseInt(args[args.length - 1] ?? "200", 10) || 200;

    if (Number.isNaN(itemId)) {
      const query = args.length > 1 && !Number.isNaN(Number.parseInt(args[args.length - 1]!, 10))
        ? args.slice(0, -1).join(" ")
        : args.join(" ");
      const match = searchItemNames(items.meta.items.values(), query, false).matches[0];
      if (!match?.id) return player.variants.sendOnConsoleMessage(`\`4Item \`o${query}\`4 not found.\`\``);
      itemId = match.id;
    }

    const item = getItem(itemId);
    if (!item) return player.variants.sendOnConsoleMessage("`4Invalid item ID.``");
    player.addItemInven(itemId, count);
    player.variants.sendOnConsoleMessage(`Added \`6${item.name}\`\` (${count}) to your inventory.`);
  },
});

registerCommand({
  name: "level",
  aliases: ["setlevel"],
  description: "Set player level (1-125)",
  usage: "/level [target] <level>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  async execute(player, args) {
    let target = player;
    let rawLevel = args[0];
    if (args.length >= 2) {
      const resolved = await resolveTarget(args[0]!);
      if (!resolved?.online) return player.variants.sendOnConsoleMessage(`\`4Player \`o${args[0]}\`4 not online.\`\``);
      target = resolved.online;
      rawLevel = args[1];
    }
    const lvl = Number.parseInt(rawLevel ?? "", 10);
    if (Number.isNaN(lvl) || lvl < 1 || lvl > 125) return player.variants.sendOnConsoleMessage("`4Usage: /level [target] <1-125>``");
    target.level = lvl;
    await PlayerDB.updateById(target.playerId, { level: lvl });
    target.sendCountryState();
    target.variants.sendOnConsoleMessage(`\`2Your level is now \`o${lvl}\`2!\`\``);
    if (target !== player) player.variants.sendOnConsoleMessage(`\`2Set level of \`o${target.displayName}\`2 to \`o${lvl}\`2.\`\``);
  },
});

registerCommand({
  name: "invis",
  aliases: ["invisible", "vanish"],
  description: "Toggle invisibility with spooky shadow vanish and reappear effects",
  role: PLAYER_ROLE.MODERATOR,
  cooldown: 2,
  execute(player) {
    const isCurrentlyInvisible = (player.state.characterState & CHARACTER_STATE.IS_INVISIBLE) !== 0;
    const world = player.world;
    const px = player.state.x + 10;
    const py = player.state.y + 16;

    if (isCurrentlyInvisible) {
      player.state.characterState &= ~CHARACTER_STATE.IS_INVISIBLE;
      if (world) {
        spawnInvisReappearDarkFlames(world, px, py, player.netID);
      }
      player.refreshAvatar();
      player.sendClothesToWorld();
      player.sendCharacterState();
      // Re-spawn Wukong's clones if wearing staff
      const handItem = player.inventory.clothes.hand || player.effectiveClothes.hand;
      if (handItem === 11630) {
        player.wukongClones.spawn(player);
      }
      player.variants.sendOnConsoleMessage("`4Invisibility disabled. You step back through the dark shadow portal into reality.``");
    } else {
      player.state.characterState |= CHARACTER_STATE.IS_INVISIBLE;
      if (player.wukongClones?.isActive) {
        player.wukongClones.despawn(player);
      }
      if (world) {
        spawnInvisGhostSwarm(world, px, py, player.netID);
      }
      player.refreshAvatar();
      player.sendClothesToWorld();
      player.sendCharacterState();
      player.variants.sendOnConsoleMessage("`2Invisibility enabled! Haunted shadow spirits swarm as you vanish into the unseen.``");
    }
    player.sendCharacterState();
  },
});

registerCommand({
  name: "title",
  aliases: ["settitle"],
  description: "Set a custom Growtopia title in your name tag",
  usage: "/title <title name or clear> (e.g. /title Dr., /title Legend, /title Master)",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    const input = args.join(" ").trim();
    if (!input) {
      return player.variants.sendOnConsoleMessage("`2Available title ideas: \`$Dr., Master, Legend, Lord, Hero, Sir, King, Emperor, Sensei, Chef\`2. Usage: \`/title <name>\`\` or \`/title clear\`\`");
    }

    if (input.toLowerCase() === "clear" || input.toLowerCase() === "reset" || input.toLowerCase() === "none") {
      player.customTitle = undefined;
      player.world?.broadcastVariant(Variant.from({ netID: player.netID }, "OnNameChanged", player.formattedName));
      return player.variants.sendOnConsoleMessage("`4Title removed. Your name is back to normal.``");
    }

    player.customTitle = input;
    player.world?.broadcastVariant(Variant.from({ netID: player.netID }, "OnNameChanged", player.formattedName));
    player.variants.sendOnConsoleMessage(`\`2Your title has been updated to: \`$${player.formattedName}\`2!\`\``);
  },
});

const WEATHER_NAMES: Record<string, number> = {
  clear: 41,
  sunny: 4,
  night: 2,
  arid: 3,
  rain: 5,
  snow: 6,
  spooky: 7,
  undersea: 8,
  warp: 9,
  comet: 10,
  sunset: 11,
  space: 14,
  apocalypse: 16,
  jungle: 17,
  autumn: 18,
  desert: 19,
  snowy_night: 20,
  blood_moon: 21,
  aurora: 22,
};

registerCommand({
  name: "weather",
  aliases: ["setweather", "sky"],
  description: "Change world weather/sky instantly",
  usage: "/weather <clear|sunny|night|snow|spooky|aurora|blood_moon|space|...>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    const world = player.world;
    if (!world) return;
    const query = args[0]?.toLowerCase().trim();
    if (!query) {
      const keys = Object.keys(WEATHER_NAMES).join(", ");
      return player.variants.sendOnConsoleMessage(`\`2Available weathers: \`$\n${keys}\`2. Usage: \`/weather <name or id>\`\``);
    }

    let weatherId = WEATHER_NAMES[query];
    if (weatherId === undefined) {
      const num = Number.parseInt(query, 10);
      if (!Number.isNaN(num) && num >= 0 && num <= 100) weatherId = num;
    }

    if (weatherId === undefined) {
      return player.variants.sendOnConsoleMessage(`\`4Unknown weather '\`o${query}\`4'. Use \`/weather\` to see options.\`\``);
    }

    world.data.weather.id = weatherId;
    for (const other of world.players) {
      other.variants.sendOnSetCurrentWeather(weatherId);
    }
    world.markDirty();
    player.variants.sendOnConsoleMessage(`\`2World weather set to \`o${query}\`2 (ID: ${weatherId}).\`\``);
  },
});

registerCommand({
  name: "heal",
  aliases: ["cure", "god"],
  description: "Heal status, remove curses, and restore effects",
  usage: "/heal [target]",
  role: PLAYER_ROLE.GUARDIAN,
  cooldown: 1,
  async execute(player, args) {
    let subject = player;
    if (args.length > 0) {
      const target = await resolveTarget(args[0]);
      if (target?.online) subject = target.online;
    }
    subject.state.characterState &= ~(
      CHARACTER_STATE.IS_CURSED |
      CHARACTER_STATE.IS_DUCTAPED |
      CHARACTER_STATE.IS_FROZEN |
      CHARACTER_STATE.IS_ZOMBIE |
      CHARACTER_STATE.IS_HIT_BY_LAVA |
      CHARACTER_STATE.IS_EGGED
    );
    subject.state.isMuted = false;
    if (subject.playMods.has("malpractice")) subject.playMods.remove("malpractice");
    if (subject.playMods.has("duct_tape")) subject.playMods.remove("duct_tape");
    if (subject.playMods.has("frozen")) subject.playMods.remove("frozen");

    subject.sendCharacterState();
    subject.variants.sendOnSetFreezeState(subject.netID, false);
    subject.variants.sendOnConsoleMessage("`2You feel refreshed! Negative effects and injuries healed.``");
    if (subject !== player) {
      player.variants.sendOnConsoleMessage(`\`2Successfully healed \`o${subject.displayName}\`2.`);
    }
  },
});

registerCommand({
  name: "speed",
  description: "Set custom run speed (e.g. /speed 500, /speed reset)",
  usage: "/speed <number or reset>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    const input = args[0]?.toLowerCase().trim();
    if (!input || input === "reset" || input === "default") {
      player.customSpeed = undefined;
      player.sendCharacterState();
      return player.variants.sendOnConsoleMessage("`2Speed reset to normal (250).``");
    }

    const val = Number.parseInt(input, 10);
    if (Number.isNaN(val) || val < 100 || val > 10000) {
      return player.variants.sendOnConsoleMessage("`4Usage: /speed <100-10000> or /speed reset (normal is 250)``");
    }

    player.customSpeed = val;
    player.sendCharacterState();
    player.variants.sendOnConsoleMessage(`\`2Speed set to \`o${val}\`2! Run like the wind!\`\``);
  },
});

registerCommand({
  name: "gravity",
  description: "Set custom gravity (e.g. /gravity 200 for moon jump, /gravity reset)",
  usage: "/gravity <number or reset>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    const input = args[0]?.toLowerCase().trim();
    if (!input || input === "reset" || input === "default") {
      player.customGravity = undefined;
      player.sendCharacterState();
      return player.variants.sendOnConsoleMessage("`2Gravity reset to normal (1000).``");
    }

    const val = Number.parseInt(input, 10);
    if (Number.isNaN(val) || val < 50 || val > 10000) {
      return player.variants.sendOnConsoleMessage("`4Usage: /gravity <50-10000> or /gravity reset (normal: 1000, moon: 200)``");
    }

    player.customGravity = val;
    player.sendCharacterState();
    player.variants.sendOnConsoleMessage(`\`2Gravity set to \`o${val}\`2! Enjoy low/high gravity!\`\``);
  },
});

registerCommand({
  name: "particle",
  aliases: ["pe", "part"],
  description: "Spawn particle effect at your position (e.g. /particle 46 for Stars, /particle 44 for Sparkles, /particle 2 for Hearts)",
  usage: "/particle <id>",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  execute(player, args) {
    const id = Number.parseInt(args[0] ?? "", 10);
    if (Number.isNaN(id) || id < 0 || id > 500) {
      return player.variants.sendOnConsoleMessage("`4Usage: /particle <0-500> (46: Stars, 44: Sparkles, 2: Hearts)``");
    }
    const world = player.world;
    if (!world) return;
    const x = player.state.x + 10;
    const y = player.state.y + 16;
    world.sendParticleEffect(id, x, y);
    player.variants.sendOnConsoleMessage(`\`2Spawned particle effect ID \`o${id}\`2 at (${Math.round(x)}, ${Math.round(y)})!\`\``);
  },
});

registerCommand({
  name: "royaltrail",
  aliases: ["rtrail", "locktrail"],
  description: "Set or toggle particle effect for Royal Lock walking trail in current world (e.g. /royaltrail 0: Rainbow Stars, /royaltrail off)",
  usage: "/royaltrail <particle_id|off>",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  execute(player, args) {
    const world = player.world;
    if (!world) return;
    const arg = (args[0] ?? "").toLowerCase().trim();
    if (!arg) {
      const current = (world.royalTrailParticle ?? 0) >= 0 ? `ID \`o${world.royalTrailParticle ?? 0}\`\` (Rainbow Stars)` : "`4Disabled``";
      return player.variants.sendOnConsoleMessage(`\`2Royal Lock Trail Particle is currently: ${current}. Usage: \`/royaltrail <0-500|off>\`\` (e.g. 0: Rainbow Stars, 46: Sparkles, 2: Hearts).`);
    }

    if (arg === "off" || arg === "none" || arg === "disable" || arg === "clear") {
      world.royalTrailParticle = -1;
      player.variants.sendOnConsoleMessage("`2Royal Lock trail particle disabled.``");
      player.sendTextBubble("`2Royal trail disabled!``", true);
      return;
    }

    const id = Number.parseInt(arg, 10);
    if (Number.isNaN(id) || id < 0 || id > 500) {
      return player.variants.sendOnConsoleMessage("`4Invalid particle ID. Usage: /royaltrail <0-500|off>``");
    }

    world.royalTrailParticle = id;
    player.variants.sendOnConsoleMessage(`\`2Royal Lock walking trail particle set to ID \`o${id}\`\`!`);
    player.sendTextBubble(`\`2Royal trail set to particle ${id}!\`\``, true);
  },
});

registerCommand({
  name: "zoom",
  description: "Zoom camera in or out (e.g. /zoom 10000, /zoom 50000, /zoom reset)",
  usage: "/zoom <number or reset>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    const input = args[0]?.toLowerCase().trim();
    if (!input || input === "reset" || input === "normal") {
      player.variants.sendOnZoomCamera(10000, 1000);
      return player.variants.sendOnConsoleMessage("`2Camera zoom reset to standard.``");
    }

    const val = Number.parseInt(input, 10);
    if (Number.isNaN(val) || val < 100) {
      return player.variants.sendOnConsoleMessage("`4Usage: /zoom <number> (e.g. /zoom 20000, /zoom 50000) or /zoom reset``");
    }

    player.variants.sendOnZoomCamera(val, 1000);
    player.variants.sendOnConsoleMessage(`\`2Camera zoom adjusted to \`o${val}\`2.\`\``);
  },
});

registerCommand({
  name: "growall",
  aliases: ["grow", "trees", "providers"],
  description: "Instantly grow all planted seed trees and ready all providers in the world",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    const world = player.world;
    if (!world) return;

    let treeCount = 0;
    let providerCount = 0;
    for (const block of world.data.blocks) {
      if (block.tree) {
        block.tree.plantedAt = Date.now() - 999999999;
        block.tree.fullyGrownAt = Date.now() - 1000;
        new SeedTile(world, block).tileUpdate();
        treeCount++;
      }
      if (block.provider) {
        block.provider.plantedAt = Date.now() - 999999999;
        new ProviderTile(world, block).tileUpdate();
        providerCount++;
      }
    }
    world.markDirty();
    player.variants.sendOnConsoleMessage(
      `\`2Instantly grew \`o${treeCount}\`2 trees and readied \`o${providerCount}\`2 providers in this world! Ready for harvest!\`\``,
    );
  },
});

registerCommand({
  name: "starter",
  aliases: ["pack", "kit"],
  description: "Receive the Ultimate Admin Starter Kit (Locks, Rayman, Wings, Tools)",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 5,
  execute(player) {
    const kit = [
      { id: ITEM_ID.WORLD_LOCK, count: 200 },
      { id: ITEM_ID.DIAMOND_LOCK, count: 200 },
      { id: ITEM_ID.BLUE_GEM_LOCK, count: 200 },
      { id: ITEM_ID.ROYAL_LOCK, count: 200 },
      { id: ITEM_ID.BUILDERS_LOCK, count: 200 },
      { id: ITEM_ID.SMALL_LOCK, count: 200 },
      { id: ITEM_ID.BIG_LOCK, count: 200 },
      { id: ITEM_ID.HUGE_LOCK, count: 200 },
      { id: 5480, count: 1 }, // Rayman's Fists
      { id: 362, count: 1 }, // Angel Wings
      { id: 736, count: 1 }, // Play Wings / Dragon
      { id: 98, count: 1 }, // Pickaxe
      { id: 1782, count: 1 }, // Golden Heart Crystal
      { id: 5638, count: 1 }, // Magplant 5000
      { id: 4412, count: 1 }, // Gauntlet
    ];
    for (const item of kit) {
      player.addItemInven(item.id, item.count);
    }
    player.variants.sendOnConsoleMessage("`2Received the \`$Ultimate Admin Starter Pack\`2 (WLs, DLs, BGLs, Royal, Builder, Rayman, Wings, Tools)!\`\``");
  },
});

registerCommand({
  name: "locks",
  aliases: ["getlocks", "lockpack"],
  description: "Receive 200 of all lock types (WL, DL, BGL, Royal Lock, Builder's Lock, Area Locks)",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    const lockList = [
      { id: ITEM_ID.WORLD_LOCK, count: 200 },
      { id: ITEM_ID.DIAMOND_LOCK, count: 200 },
      { id: ITEM_ID.BLUE_GEM_LOCK, count: 200 },
      { id: ITEM_ID.ROYAL_LOCK, count: 200 },
      { id: ITEM_ID.BUILDERS_LOCK, count: 200 },
      { id: ITEM_ID.SMALL_LOCK, count: 200 },
      { id: ITEM_ID.BIG_LOCK, count: 200 },
      { id: ITEM_ID.HUGE_LOCK, count: 200 },
      { id: ITEM_ID.EMERALD_LOCK, count: 200 },
      { id: ITEM_ID.RUBY_LOCK, count: 200 },
      { id: ITEM_ID.ROBOTIC_LOCK, count: 200 },
    ];
    for (const lock of lockList) {
      player.addItemInven(lock.id, lock.count);
    }
    player.variants.sendOnConsoleMessage("`2Received \`$200x of all Lock types\`2 (WL, DL, BGL, Royal, Builder, Small, Big, Huge, Emerald, Ruby, Robotic)!`");
  },
});

registerCommand({
  name: "lockworld",
  aliases: ["claimworld", "worldlock"],
  description: "Directly locks the current world for yourself (options: wl, dl, royal)",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  async execute(player, args) {
    const world = player.world;
    if (!world) return;

    const typeArg = (args[0] || "wl").toLowerCase();
    let lockId: number = ITEM_ID.WORLD_LOCK;
    if (typeArg.includes("royal")) lockId = ITEM_ID.ROYAL_LOCK;
    else if (typeArg.includes("dl") || typeArg.includes("diamond")) lockId = ITEM_ID.DIAMOND_LOCK;
    else if (typeArg.includes("bgl") || typeArg.includes("blue")) lockId = ITEM_ID.BLUE_GEM_LOCK;

    const lockMeta = getItem(lockId);
    const tileX = Math.floor(player.state.x / 32);
    const tileY = Math.floor(player.state.y / 32);
    let targetTile = world.getTileAt(tileX, tileY);

    if (!targetTile || targetTile.fg !== 0) {
      targetTile = world.data.blocks.find((b) => b.fg === 0 && b.y >= 10);
    }
    if (!targetTile) {
      return player.variants.sendOnConsoleMessage("`4No suitable empty tile found to place the world lock.`");
    }

    targetTile.fg = lockId;
    targetTile.flags |= TileFlags.TILEEXTRA;
    targetTile.lock = {
      ownerPlayerId: player.playerId,
      permission: LockPermission.NONE,
      adminIds: [],
      adminLimited: false,
      ignoreEmptyAir: false,
      ownedTiles: [],
    };
    targetTile.worldLockData = {
      bpm: 100,
      customMusicBlocksDisabled: false,
      invisMusicBlocks: false,
      minLevel: 1,
    };
    world.data.worldLockIndex = targetTile.x + targetTile.y * world.width;
    world.refreshNameColors();
    tileFrom(world, targetTile).tileUpdate();
    world.markDirty();

    const lockName = lockMeta?.name ?? "World Lock";
    const lockAction = lockName.endsWith("Lock") ? `${lockName.slice(0, -4).trim()} Locked` : `${lockName}ed`;
    const message = `\`5[\`w${world.name} \`ohas been \`$${lockAction}\`\` by ${player.displayName}\`5]`;
    for (const p of world.players) {
      p.variants.sendOnConsoleMessage(message);
      p.variants.sendOnTalkBubble(player.netID, message, false);
    }
    player.variants.sendOnConsoleMessage(`\`2World \`w${world.name}\`2 successfully locked with \`$${lockName}\`\`!`);
  },
});

registerCommand({
  name: "unlockworld",
  aliases: ["unclaimworld", "removeworldlock"],
  description: "Removes the world lock from the current world",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  async execute(player) {
    const world = player.world;
    if (!world) return;
    const lockTile = world.worldLockTile;
    if (!lockTile) {
      return player.variants.sendOnConsoleMessage("`4This world does not have a world lock.`");
    }

    const lockMeta = getItem(lockTile.fg);
    const lockName = lockMeta?.name ?? "World Lock";
    lockTile.fg = 0;
    delete lockTile.lock;
    delete lockTile.worldLockData;
    delete world.data.worldLockIndex;
    world.refreshNameColors();
    tileFrom(world, lockTile).tileUpdate();
    world.markDirty();

    const message = `\`5[\`\`\`w${world.name}\`\` has had its \`$${lockName}\`\` removed by staff!\`5]\`\``;
    for (const p of world.players) {
      p.variants.sendOnConsoleMessage(message);
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully removed \`$${lockName}\`\` from \`w${world.name}\`\`!`);
  },
});

registerCommand({
  name: "clearinv",
  aliases: ["emptyinv", "trashall"],
  description: "Empty all items from your inventory",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    player.inventory.items = new Collection();
    player.inventory.itemCount = 0;
    player.inventory.send();
    player.variants.sendOnConsoleMessage("`2Your inventory has been completely emptied!``");
  },
});

registerCommand({
  name: "fly",
  aliases: ["flight"],
  description: "Toggle double-jump and flight mode without wings",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player) {
    const hasDoubleJump = (player.state.characterState & CHARACTER_STATE.DOUBLE_JUMP) !== 0;
    if (hasDoubleJump) {
      player.state.characterState &= ~CHARACTER_STATE.DOUBLE_JUMP;
      player.variants.sendOnConsoleMessage("`4Flight mode disabled.``");
    } else {
      player.state.characterState |= CHARACTER_STATE.DOUBLE_JUMP;
      player.variants.sendOnConsoleMessage("`2Flight mode enabled! You can now double jump in mid-air!\`\``");
    }
    player.sendCharacterState();
  },
});

registerCommand({
  name: "who",
  aliases: ["players", "listplayers"],
  description: "List players in the current world",
  cooldown: 1,
  execute(player) {
    const world = player.world;
    if (!world) return;
    const names = world.players.map((p) => p.formattedName).join(", ");
    player.variants.sendOnConsoleMessage(`\`oPlayers in this world (${world.players.length}): ${names}`);
  },
});

registerCommand({
  name: "rules",
  description: "View server rules",
  cooldown: 2,
  execute(player) {
    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("`wGrowServer Rules & Guidelines``", ITEM_ID.WRENCH, "big")
      .addSpacer("small")
      .addSmallText("`2Welcome to GrowServer! By playing here, you agree to the following server rules:``")
      .addSpacer("small")
      .addTextBox("`w1. Respect & Decency:`` No harassment, hate speech, severe toxicity, or discriminatory behavior toward any player.")
      .addTextBox("`w2. Fair Play & Economy:`` No scamming, gambling fraud, duping, botting/macroing, or exploiting glitches. Report exploits to Developers.")
      .addTextBox("`w3. Safe Trading:`` Always double check trade windows before accepting. You are responsible for your own items and account security.")
      .addTextBox("`w4. World Etiquette:`` Do not grief or trap visitors in public worlds. World Locks and Area Locks belong to their respective owners.")
      .addTextBox("`w5. Staff Guidance:`` Respect and follow instructions from Guardians, Moderators, and Developers. Impersonating staff is strictly prohibited.")
      .addSpacer("small")
      .addSmallText("`5Violations will result in warnings, temporary mutes, world bans, or permanent account suspensions.``")
      .addSpacer("small")
      .addQuickExit()
      .endDialog("rules_dialog", "", "I Agree & Understand")
      .str();

    player.variants.sendOnDialogRequest(dialog);
    player.variants.sendOnConsoleMessage("`2=== GrowServer Rules ===``");
    player.variants.sendOnConsoleMessage("`o1. Respect everyone. No toxicity, harassment, or hate speech.");
    player.variants.sendOnConsoleMessage("`o2. No scamming, duping, or exploiting bugs.");
    player.variants.sendOnConsoleMessage("`o3. Follow staff instructions. Have fun building and exploring!``");
  },
});

registerCommand({
  name: "me",
  description: "Express an action in chat",
  usage: "/me <action>",
  cooldown: 1,
  execute(player, args) {
    if (!args.length || !player.world) return;
    const action = args.join(" ");
    player.world.broadcastVariant(Variant.from("OnConsoleMessage", `\`6* ${player.formattedName} \`6${action}\`\``));
  },
});

registerCommand({
  name: "msg",
  aliases: ["tell", "w", "whisper"],
  description: "Send a private message to an online player",
  usage: "/msg <player> <message>",
  cooldown: 1,
  execute(player, args) {
    if (args.length < 2) {
      return player.variants.sendOnConsoleMessage("`4Usage: /msg <player> <message>``");
    }
    const targetName = args[0]!;
    const message = args.slice(1).join(" ").trim();
    if (!message) return;

    if (player.state.isMuted) {
      return player.variants.sendOnConsoleMessage("`4You are muted and cannot send private messages.``");
    }

    const target = serverManager.getPlayerByName(targetName);
    if (!target) {
      return player.variants.sendOnConsoleMessage(`\`4Player \`o${targetName}\`4 is not online.\`\``);
    }

    if (target === player) {
      return player.variants.sendOnConsoleMessage("`4You cannot message yourself.``");
    }

    player.variants.sendOnConsoleMessage(`CP:_PL:0_OID:_CT:[W]_ \`5PM to \`w${target.displayName}\`5: \`$${message}\`\``);
    target.variants.sendOnConsoleMessage(`CP:_PL:0_OID:_CT:[W]_ \`5PM from \`w${player.displayName}\`5: \`$${message}\`\``);
    target.sendSfx("audio/camerashutter.wav");
    target.lastWhisperFrom = player.tankIDName || player.displayName;
    if ((target as any).isBot) {
      botManager.onPlayerWhisper(player, target as any, message);
    }
  },
});

registerCommand({
  name: "r",
  aliases: ["reply"],
  description: "Reply to the last player who sent you a private message",
  usage: "/r <message>",
  cooldown: 1,
  execute(player, args) {
    if (!player.lastWhisperFrom) {
      return player.variants.sendOnConsoleMessage("`4No one has sent you a private message yet.``");
    }
    const message = args.join(" ").trim();
    if (!message) {
      return player.variants.sendOnConsoleMessage("`4Usage: /r <message>``");
    }

    const target = serverManager.getPlayerByName(player.lastWhisperFrom);
    if (!target) {
      return player.variants.sendOnConsoleMessage(`\`4Player \`o${player.lastWhisperFrom}\`4 is no longer online.\`\``);
    }

    if (player.state.isMuted) {
      return player.variants.sendOnConsoleMessage("`4You are muted and cannot send private messages.``");
    }

    player.variants.sendOnConsoleMessage(`CP:_PL:0_OID:_CT:[W]_ \`5PM to \`w${target.displayName}\`5: \`$${message}\`\``);
    target.variants.sendOnConsoleMessage(`CP:_PL:0_OID:_CT:[W]_ \`5PM from \`w${player.displayName}\`5: \`$${message}\`\``);
    target.sendSfx("audio/camerashutter.wav");
    target.lastWhisperFrom = player.tankIDName || player.displayName;
    if ((target as any).isBot) {
      botManager.onPlayerWhisper(player, target as any, message);
    }
  },
});

registerCommand({
  name: "trade",
  description: "Start or accept a trade with an online player in the same world",
  usage: "/trade <player>",
  cooldown: 1,
  execute(player, args) {
    if (!args.length) {
      return player.variants.sendOnConsoleMessage("`4Usage: /trade <player>``");
    }
    const targetName = args[0]!;
    const target = serverManager.getPlayerByName(targetName);
    if (!target) {
      return player.variants.sendOnConsoleMessage(`\`4Player \`o${targetName}\`4 is not online.\`\``);
    }
    tradeManager.invite(player, target);
  },
});

registerCommand({
  name: "event",
  aliases: ["events"],
  description: "View current active game event and time left",
  cooldown: 1,
  execute(player) {
    const current = eventManager.currentEvent;
    if (!eventManager.isActive) {
      player.variants.sendOnConsoleMessage("`oThere are no special game events active right now. Enjoy peaceful building!``");
      return;
    }

    const remainingMins = Math.ceil(eventManager.remainingSeconds / 60);
    player.variants.sendOnConsoleMessage(`\`2=== Active Event: \`$${current.title}\`2 ===\`\``);
    player.variants.sendOnConsoleMessage(`\`o${current.description}`);
    player.variants.sendOnConsoleMessage(`\`2Time Remaining: \`w${remainingMins} minute(s)\`\``);
  },
});

registerCommand({
  name: "startevent",
  aliases: ["setevent"],
  description: "Start or stop a server-wide event (pineapple, carnival, halloween, voucher, none)",
  usage: "/startevent <pineapple|carnival|halloween|voucher|none> [minutes]",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    if (!args.length) {
      return player.variants.sendOnConsoleMessage("`4Usage: /startevent <pineapple|carnival|halloween|voucher|none> [minutes]``");
    }

    const typeStr = args[0]!.toLowerCase().trim();
    const duration = args.length >= 2 ? Math.max(1, Number.parseInt(args[1]!, 10) || 60) : 60;

    let targetType: GameEventType;
    switch (typeStr) {
      case "pineapple":
        targetType = GameEventType.PINEAPPLE;
        break;
      case "carnival":
        targetType = GameEventType.CARNIVAL;
        break;
      case "halloween":
      case "ghost":
        targetType = GameEventType.HALLOWEEN;
        break;
      case "voucher":
        targetType = GameEventType.VOUCHER_DAYZ;
        break;
      case "none":
      case "stop":
      case "off":
        targetType = GameEventType.NONE;
        break;
      default:
        return player.variants.sendOnConsoleMessage("`4Invalid event type. Available: pineapple, carnival, halloween, voucher, none``");
    }

    eventManager.startEvent(targetType, duration);
    if (targetType === GameEventType.NONE) {
      player.variants.sendOnConsoleMessage("`2Event stopped successfully.``");
    } else {
      player.variants.sendOnConsoleMessage(`\`2Started event \`$${targetType}\`2 for \`w${duration} minutes\`2.\`\``);
    }
  },
});

registerCommand({
  name: "worldban",
  aliases: ["wban"],
  description: "Ban a player from the current world",
  role: PLAYER_ROLE.BASIC,
  async execute(player, args) {
    const world = player.world;
    if (!world) return;

    const isOwner = world.getOwnerPlayerId() === player.playerId;
    if (!isOwner && !player.isModerator && !player.isDeveloper) {
      player.variants.sendOnConsoleMessage("`4You must be the world owner or staff to ban players from this world!``");
      return;
    }

    if (!args[0]) {
      player.variants.sendOnConsoleMessage("`4Usage: /worldban <target> [minutes] [reason]``");
      return;
    }

    const target = await resolveTarget(args[0]);
    if (!target) {
      player.variants.sendOnConsoleMessage(`\`4Player '${args[0]}' not found.\`\``);
      return;
    }

    if (target.playerId === player.playerId) {
      player.variants.sendOnConsoleMessage("`4You cannot ban yourself from the world!``");
      return;
    }

    const duration = args[1] && !isNaN(Number(args[1])) ? Math.max(1, Number(args[1])) : 60;
    const reason = args.slice(isNaN(Number(args[1])) ? 1 : 2).join(" ") || "Violating world rules";

    world.banPlayer(target.playerId, duration, reason);

    if (target.online && target.online.world === world) {
      target.online.variants.sendOnConsoleMessage(`\`4You have been banned from \`w${world.name}\`4 for \`w${duration} minutes\`4! Reason: \`w${reason}\`\``);
      target.online.leaveWorld(true);
    }

    world.broadcastVariant(
      Variant.from(
        "OnConsoleMessage",
        `\`4[WORLDBAN]\`\` \`w${target.name}\`\` was banned from this world by \`w${player.displayName}\`\` for \`w${duration}\`\` minutes! Reason: \`w${reason}\`\``,
      ),
    );
  },
});

registerCommand({
  name: "worldunban",
  aliases: ["wunban"],
  description: "Unban a player from the current world",
  role: PLAYER_ROLE.BASIC,
  async execute(player, args) {
    const world = player.world;
    if (!world) return;

    const isOwner = world.getOwnerPlayerId() === player.playerId;
    if (!isOwner && !player.isModerator && !player.isDeveloper) {
      player.variants.sendOnConsoleMessage("`4You must be the world owner or staff to unban players from this world!``");
      return;
    }

    if (!args[0]) {
      player.variants.sendOnConsoleMessage("`4Usage: /worldunban <target>``");
      return;
    }

    const target = await resolveTarget(args[0], true);
    if (!target) {
      player.variants.sendOnConsoleMessage(`\`4Player '${args[0]}' not found.\`\``);
      return;
    }

    const removed = world.unbanPlayer(target.playerId);
    if (removed) {
      player.variants.sendOnConsoleMessage(`\`2Unbanned \`w${target.name}\`2 from \`w${world.name}\`2.\`\``);
    } else {
      player.variants.sendOnConsoleMessage(`\`4Player \`w${target.name}\`4 is not banned from this world.\`\``);
    }
  },
});

registerCommand({
  name: "worldbans",
  aliases: ["wbans"],
  description: "View banned players in the current world",
  role: PLAYER_ROLE.BASIC,
  execute(player) {
    const world = player.world;
    if (!world) return;

    if (world.bannedPlayers.size === 0) {
      player.variants.sendOnConsoleMessage("`2There are no players currently banned from this world.`");
      return;
    }

    player.variants.sendOnConsoleMessage(`\`o=== Banned Players in \`w${world.name}\`o ===\`\``);
    const now = Date.now();
    for (const [pId, info] of world.bannedPlayers) {
      const remaining = Math.max(0, Math.ceil((info.until - now) / 60000));
      player.variants.sendOnConsoleMessage(`\`4#${pId}\`o: \`w${remaining} min left\`o - Reason: \`w${info.reason}\`\``);
    }
  },
});

registerCommand({
  name: "banworld",
  aliases: ["lockworld"],
  description: "Ban/suspend a world server-wide (Admin/Developer)",
  role: PLAYER_ROLE.MODERATOR,
  execute(player, args) {
    const targetName = args[0] ? args[0].toUpperCase() : player.world?.name;
    if (!targetName) {
      player.variants.sendOnConsoleMessage("`4Usage: /banworld <world_name> [reason]``");
      return;
    }

    const reason = args.slice(1).join(" ") || "Inappropriate / prohibited world content";
    worldManager.banWorld(targetName, reason);

    const loadedWorld = worldManager.getLoaded(targetName);
    if (loadedWorld) {
      for (const p of loadedWorld.players) {
        if (!p.isDeveloper) {
          p.variants.sendOnConsoleMessage(`\`4World \`w${targetName}\`4 has been suspended by administrators! Reason: \`w${reason}\`\``);
          p.leaveWorld(true);
        }
      }
    }

    serverManager.broadcast(
      Variant.from("OnConsoleMessage", `\`4[SERVER ALERT]\`\` World \`w${targetName}\`\` has been suspended by staff! Reason: \`w${reason}\`\``),
    );
  },
});

registerCommand({
  name: "unbanworld",
  description: "Unban/unsuspend a world server-wide (Admin/Developer)",
  role: PLAYER_ROLE.MODERATOR,
  execute(player, args) {
    if (!args[0]) {
      player.variants.sendOnConsoleMessage("`4Usage: /unbanworld <world_name>``");
      return;
    }

    const targetName = args[0].toUpperCase();
    const removed = worldManager.unbanWorld(targetName);
    if (removed) {
      player.variants.sendOnConsoleMessage(`\`2Successfully unbanned world \`w${targetName}\`2.\`\``);
    } else {
      player.variants.sendOnConsoleMessage(`\`4World \`w${targetName}\`4 was not banned.\`\``);
    }
  },
});

registerCommand({
  name: "resetworld",
  aliases: ["templatereset", "cleartemplate"],
  description: "Completely reset the world back to pristine procedural template (Developer only)",
  role: PLAYER_ROLE.DEVELOPER,
  async execute(player, args) {
    const targetName = args[0] ? args[0].toUpperCase() : player.world?.name;
    if (!targetName) {
      player.variants.sendOnConsoleMessage("`4Usage: /resetworld [world_name]``");
      return;
    }

    const world = await worldManager.get(targetName);
    if (!world) {
      player.variants.sendOnConsoleMessage(`\`4World '${targetName}' could not be loaded.\`\``);
      return;
    }

    // Generate pristine procedural default template
    const template = generateDefaultWorld(world.name, world.width, world.height);
    world.data.blocks = template.blocks;
    world.data.dropped = { uid: 0, items: [] };
    delete world.data.worldLockIndex;
    world.data.weather = { id: WEATHER_CLEAR };
    world.markDirty();

    // Teleport all online players to main door and re-enter world cleanly
    const door = world.mainDoor;
    const doorX = door?.x ?? 0;
    const doorY = door?.y ?? 0;

    const playersInWorld = [...world.players];
    for (const p of playersInWorld) {
      world.leave(p);
      await world.enter(p, doorX, doorY);
      p.sendInventory();
      p.sendTextBubble("`2The world was reset to its original template!``", true);
      p.variants.sendOnConsoleMessage(`\`2World \`w${world.name}\`2 was regenerated to its clean procedural template.\`\``);
    }

    player.variants.sendOnConsoleMessage(`\`2World \`w${world.name}\`2 successfully reset to procedural template!\`\``);
  },
});

registerCommand({
  name: "immortal",
  aliases: ["immortals", "immortalset"],
  description: "Receive the full Immortal Collection (Katana, Da Vinci Wings, Pickaxe, Swordfish, and Giant Eye Head)",
  role: PLAYER_ROLE.BASIC,
  execute(player) {
    const immortalItems = [
      { id: 16428, name: "Immortal Sonic Buster Katana" },
      { id: 16262, name: "Immortal Da Vinci Wings" },
      { id: 16426, name: "Immortal Pickaxe" },
      { id: 16258, name: "Immortal Swordfish Sword" },
      { id: 16264, name: "Immortal Alaskan King Crab Crown" },
      { id: 16340, name: "Immortal Night Vision Goggles" },
      { id: 16430, name: "Immortal Title" },
      { id: 16432, name: "Immortal Puppy Leash" },
      { id: 8372, name: "Giant Eye Head (Immortal GEH Variant)" },
    ];
    for (const item of immortalItems) {
      if (!player.inventory.hasItem(item.id)) player.addItemInven(item.id, 1);
    }
    player.sendSfx("audio/thousandSlash.wav");
    player.sendTextBubble("`#Received Immortal Collection!``", true);
    player.variants.sendOnConsoleMessage("`#The celestial powers of the Immortal Collection are now yours! Equipped with Giant Eye Head!``");
  },
});

registerCommand({
  name: "eyes",
  aliases: ["burningeyes", "gianteye"],
  description: "Receive iconic eye cosmetics: Burning Eyes, Black Burning Eyes, and Giant Eye Head",
  role: PLAYER_ROLE.BASIC,
  execute(player) {
    const eyeItems = [
      { id: 2476, name: "Burning Eyes" },
      { id: 10336, name: "Black Burning Eyes" },
      { id: 1204, name: "Focused Eyes" },
      { id: 8372, name: "Giant Eye Head" },
    ];
    for (const item of eyeItems) {
      if (!player.inventory.hasItem(item.id)) player.addItemInven(item.id, 1);
    }
    player.sendSfx("audio/change_clothes.wav");
    player.sendTextBubble("`4Received iconic Eye items!``", true);
    player.variants.sendOnConsoleMessage("`4Received Burning Eyes, Black Burning Eyes, Focused Eyes, and Giant Eye Head!``");
  },
});

registerCommand({
  name: "hero",
  aliases: ["superhero", "herosuit", "assassin", "ezio"],
  description: "Transform into a legendary hero (Ezio Auditore or Superhero) without adding items to inventory",
  role: PLAYER_ROLE.BASIC,
  execute(player, args) {
    const choice = (args[0] ?? "").toLowerCase();

    // Revert/untransform check
    if (choice === "off" || choice === "revert" || choice === "normal" || choice === "remove" || (player.isHeroDisguised && !choice)) {
      if (player.heroOriginalClothes) {
        Object.assign(player.inventory.clothes, player.heroOriginalClothes);
        delete player.heroOriginalClothes;
      }
      player.isHeroDisguised = false;
      player.isTransformed = false;
      player.playMods?.remove?.("hero_suit");
      player.playMods?.remove?.("transformed");
      player.sendClothesToWorld?.();
      player.sendCharacterState?.();
      player.sendSfx?.("audio/change_clothes.wav");
      player.sendTextBubble?.("`5Returned to civilian appearance!``", true);
      player.variants?.sendOnConsoleMessage("`5You have stepped out of your hero disguise. Civilian appearance restored!``");
      return;
    }

    // Save previous civilian clothes if not already saved
    if (!player.heroOriginalClothes) {
      player.heroOriginalClothes = { ...player.inventory.clothes };
    }
    player.isHeroDisguised = true;

    if (choice === "super" || choice === "superhero") {
      player.isTransformed = false;
      player.inventory.clothes.hair = 0;
      player.inventory.clothes.mask = 2134; // Superhero Mask - Red
      player.inventory.clothes.shirt = 2170; // Superheroine Top - Red
      player.inventory.clothes.pants = 2098; // Heroic Tights - Red
      player.inventory.clothes.feet = 2122; // Heroic Boots - Red
      player.inventory.clothes.back = 350;  // Heroman Cape
      player.inventory.clothes.necklace = 0;

      player.playMods?.add?.("hero_suit");
      player.sendClothesToWorld?.();
      player.sendCharacterState?.();
      player.sendSfx?.("audio/change_clothes.wav");
      player.sendTextBubble?.("`5Up, up, and away! Superhero powers engaged!``", true);
      player.variants?.sendOnConsoleMessage("`5Transformed into Superhero! (Cosmetic disguise active - no items added to backpack). Type /hero off to revert.``");
      return;
    }

    // Hero registry: full-body hero skins equipped in the necklace slot (ClothTypes.NECKLACE)
    const heroMap: Record<string, { id: number; name: string }> = {
      ezio: { id: 11560, name: "Ezio Auditore" },
      altair: { id: 12646, name: "Altair Ibn-La'Ahad" },
      bayek: { id: 12650, name: "Bayek of Siwa" },
      connor: { id: 13894, name: "Connor Kenway" },
      kassandra: { id: 13896, name: "Kassandra" },
      basim: { id: 13892, name: "Basim" },
      eivor: { id: 12648, name: "Eivor" },
      bodvar: { id: 11554, name: "Bödvar" },
      val: { id: 11556, name: "Val" },
      sam: { id: 11558, name: "Sam Fisher" },
      fisher: { id: 11558, name: "Sam Fisher" },
      edward: { id: 15288, name: "Edward Kenway" },
      yasuke: { id: 15290, name: "Yasuke" },
    };

    const targetHero = heroMap[choice] ?? heroMap.ezio;
    const heroName = targetHero.name;
    player.isTransformed = true;

    // Equip the coordinated full-body suit components in inventory clothes
    const heroSuit = HERO_SUIT_SETS[targetHero.id];
    player.inventory.clothes.necklace = targetHero.id;
    if (heroSuit) {
      player.inventory.clothes.hair = heroSuit.hair ?? 0;
      player.inventory.clothes.shirt = heroSuit.shirt ?? 0;
      player.inventory.clothes.pants = heroSuit.pants ?? 0;
      player.inventory.clothes.feet = heroSuit.feet ?? 0;
      player.inventory.clothes.face = heroSuit.face ?? 0;
      player.inventory.clothes.hand = heroSuit.hand ?? 0;
      player.inventory.clothes.back = heroSuit.back ?? 0;
      player.inventory.clothes.mask = heroSuit.mask ?? 0;
    }

    player.playMods?.add?.("hero_suit");
    player.sendClothesToWorld?.();
    player.sendCharacterState?.();
    player.sendSfx?.("audio/change_clothes.wav");
    player.sendTextBubble?.(`\`5Nothing is true, everything is permitted! ${heroName} transformed!\`\``, true);
    player.variants?.sendOnConsoleMessage(`\`5Transformed into ${heroName}! (Cosmetic disguise active - no items added to backpack). Type /hero off to revert.\`\``);
    player.variants?.sendOnConsoleMessage("`oTip: Type /hero super for classic Superhero, /hero altair for Altair, /hero off to revert!``");
  },
});

registerCommand({
  name: "criminal",
  aliases: ["villain", "crime", "mastermind"],
  description: "Receive Crime Wave, Crime In Progress, Criminal Mastermind, and full deck of Superpower Cards",
  role: PLAYER_ROLE.DEVELOPER,
  execute(player) {
    // Spawners & Villains
    player.addItemInven(2382, 5);  // Crime Wave (consumable spawner)
    player.addItemInven(2302, 5);  // Crime In Progress block
    player.addItemInven(12276, 5); // Criminal Mastermind NPC block
    player.addItemInven(2360, 1);  // Dr. Destructo Portrait

    // Superhero Gear
    player.addItemInven(2142, 1);  // Superhero Mask - Black

    // Complete elemental deck of Superpower Cards
    const cards = [
      { id: 2292, count: 5 }, // Heat Vision (Fire)
      { id: 2294, count: 5 }, // Incinerate (Fire)
      { id: 2308, count: 5 }, // Ice Shards (Ice)
      { id: 2310, count: 5 }, // Frost Breath (Ice)
      { id: 2320, count: 5 }, // Super Strength (Muscle)
      { id: 2326, count: 5 }, // Crush (Muscle)
      { id: 2332, count: 5 }, // Shocking Fist (Lightning)
      { id: 2334, count: 5 }, // Thunderstorm (Lightning)
    ];

    for (const card of cards) {
      player.addItemInven(card.id, card.count);
    }

    player.equipClothes(2142);
    player.sendInventory();
    player.sendSfx("audio/alarm.wav");
    player.sendTextBubble("`4Villainous schemes in motion! Superhero cards ready!``", true);
    player.variants.sendOnConsoleMessage("`4[Crimefighting]: Received Crime Wave (#2382), Crime In Progress (#2302), Criminal Mastermind (#12276), and Superpower Cards!``");
    player.variants.sendOnConsoleMessage("`oTip: Place Criminal Mastermind or Crime in Progress and wrench or punch to battle! Counter elements for 3x critical damage! (Fire > Muscle > Lightning > Ice > Fire)``");
  },
});

registerCommand({
  name: "rift",
  aliases: ["riftcape", "riftwings", "configrift"],
  description: "Customize appearance and effects for Rift Cape (#10424) or Rift Wings (#11478)",
  usage: "/rift [cape|wings]",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  execute(player, args) {
    const sub = args[0]?.toLowerCase();
    const hasCape = player.effectiveClothes.back === 10424 || player.inventory.clothes.back === 10424 || player.inventory.hasItem(10424);
    const hasWings = player.effectiveClothes.back === 11478 || player.inventory.clothes.back === 11478 || player.inventory.hasItem(11478);
    const wearingCape = player.effectiveClothes.back === 10424 || player.inventory.clothes.back === 10424;
    const wearingWings = player.effectiveClothes.back === 11478 || player.inventory.clothes.back === 11478;

    if (sub === "wings" || (wearingWings && sub !== "cape")) {
      player.variants.sendOnDialogRequest(riftWingsDialog(player));
      return;
    }

    if (sub === "cape" || (wearingCape && sub !== "wings")) {
      player.variants.sendOnDialogRequest(riftCapeDialog(player));
      return;
    }

    if (hasWings && !hasCape) {
      player.variants.sendOnDialogRequest(riftWingsDialog(player));
      return;
    }

    if (hasCape && !hasWings) {
      player.variants.sendOnDialogRequest(riftCapeDialog(player));
      return;
    }

    if (hasCape && hasWings) {
      player.variants.sendOnDialogRequest(riftCapeDialog(player));
      player.variants.sendOnConsoleMessage("`oTip: Type \`/rift wings\`\` to customize your Rift Wings!``");
      return;
    }

    if (!hasCape && !hasWings) {
      if (player.isDeveloper) {
        player.addItemInven(10424, 1);
        player.addItemInven(11478, 1);
        player.sendInventory();
        player.variants.sendOnConsoleMessage("`2[Developer]: Added Rift Cape (#10424) and Rift Wings (#11478) to your inventory! Opening Rift Cape Customization...``");
        player.variants.sendOnDialogRequest(riftCapeDialog(player));
        return;
      }
      return player.variants.sendOnConsoleMessage("`4You need to own or equip a Rift Cape (#10424) or Rift Wings (#11478) to customize them.``");
    }
  },
});

registerCommand({
  name: "friends",
  aliases: ["friendlist", "fl"],
  description: "Open your Friends List",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  async execute(player) {
    await FriendManager.openFriendsDialog(player);
  },
});

registerCommand({
  name: "friend",
  aliases: ["addfriend"],
  description: "Send a friend request to a player",
  usage: "/friend <player name>",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  async execute(player, args) {
    const targetName = args[0]?.trim();
    if (!targetName) return player.variants.sendOnConsoleMessage("`4Usage: /friend <player name>``");
    const target = serverManager.getPlayerByName(targetName);
    if (!target) return player.variants.sendOnConsoleMessage("`4Player \"`$" + targetName + "`4\" is not online!``");
    await FriendManager.sendRequest(player, target);
  },
});

registerCommand({
  name: "unfriend",
  description: "Remove a friend from your Friends List",
  usage: "/unfriend <player name>",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  async execute(player, args) {
    const targetName = args[0]?.trim();
    if (!targetName) return player.variants.sendOnConsoleMessage("`4Usage: /unfriend <player name>``");
    const target = serverManager.getPlayerByName(targetName);
    if (target) {
      await FriendManager.removeFriend(player, target.playerId);
      return;
    }
    const record = await PlayerDB.findByName(targetName);
    if (!record) return player.variants.sendOnConsoleMessage("`4Player \"`$" + targetName + "`4\" not found!``");
    await FriendManager.removeFriend(player, record.id);
  },
});

registerCommand({
  name: "guild",
  aliases: ["g"],
  description: "Open Guild dashboard or manage your guild",
  usage: "/guild [create <name> <tag> | invite <name> | leave | kick <name> | disband]",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  async execute(player, args) {
    const sub = (args[0] ?? "").toLowerCase();
    if (!sub) {
      await GuildManager.openGuildDialog(player);
      return;
    }

    switch (sub) {
      case "create": {
        const name = args[1]?.trim();
        const tag = args[2]?.trim();
        if (!name || !tag) return player.variants.sendOnConsoleMessage("`4Usage: /guild create <name> <tag> (e.g. /guild create Legends LGND)``");
        await GuildManager.createGuild(player, name, tag);
        return;
      }
      case "invite": {
        const targetName = args[1]?.trim();
        if (!targetName) return player.variants.sendOnConsoleMessage("`4Usage: /guild invite <player name>``");
        const target = serverManager.getPlayerByName(targetName);
        if (!target) return player.variants.sendOnConsoleMessage("`4Player \"`$" + targetName + "`4\" is not online!``");
        await GuildManager.inviteMember(player, target);
        return;
      }
      case "leave": {
        await GuildManager.leaveGuild(player);
        return;
      }
      case "disband": {
        await GuildManager.disbandGuild(player);
        return;
      }
      case "kick": {
        const targetName = args[1]?.trim();
        if (!targetName) return player.variants.sendOnConsoleMessage("`4Usage: /guild kick <player name>``");
        const target = serverManager.getPlayerByName(targetName);
        if (target) {
          await GuildManager.kickMember(player, target.playerId);
          return;
        }
        const record = await PlayerDB.findByName(targetName);
        if (!record) return player.variants.sendOnConsoleMessage("`4Player \"`$" + targetName + "`4\" not found!``");
        await GuildManager.kickMember(player, record.id);
        return;
      }
      case "chat":
      case "msg": {
        const msg = args.slice(1).join(" ");
        if (!msg) return player.variants.sendOnConsoleMessage("`4Usage: /guild chat <message>``");
        GuildManager.sendGuildChat(player, msg);
        return;
      }
      default: {
        await GuildManager.openGuildDialog(player);
      }
    }
  },
});

registerCommand({
  name: "gc",
  aliases: ["guildchat"],
  description: "Send a message to your guild members",
  usage: "/gc <message>",
  role: PLAYER_ROLE.BASIC,
  cooldown: 1,
  execute(player, args) {
    const msg = args.join(" ");
    if (!msg) return player.variants.sendOnConsoleMessage("`4Usage: /gc <message>``");
    GuildManager.sendGuildChat(player, msg);
  },
});

registerCommand({
  name: "bot",
  aliases: ["bots"],
  description: "Manage simulated NPC bots across worlds",
  usage: "/bot <list|status|spawn|kick|say|respawn>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  async execute(player, args) {
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === "status" || sub === "list") {
      const activeBots = Array.from(botManager.bots.values());
      if (activeBots.length === 0) {
        return player.variants.sendOnConsoleMessage("`4No simulated bots are currently active.``");
      }
      player.variants.sendOnConsoleMessage(`\`2Active Simulated Bots (\`w${activeBots.length}\`2):`);
      for (const bot of activeBots) {
        const worldName = bot.world?.name ?? "NONE";
        const pos = `(${Math.floor(bot.x / 32)}, ${Math.floor(bot.y / 32)})`;
        player.variants.sendOnConsoleMessage(`\`$- \`w${bot.tankIDName}\`$ [\`2${worldName}\`$ @ \`o${pos}\`$] Role: \`3${bot.behaviorType}\`$`);
      }
      return;
    }

    if (sub === "respawn") {
      player.variants.sendOnConsoleMessage("`3Respawning all simulated bots...``");
      await botManager.respawnAll();
      player.variants.sendOnConsoleMessage(`\`2All bots respawned successfully! Total: \`w${botManager.bots.size}`);
      return;
    }

    if (sub === "kick" || sub === "remove" || sub === "despawn") {
      const botName = args[1];
      if (!botName) {
        return player.variants.sendOnConsoleMessage("`4Usage: /bot kick <bot_name>``");
      }
      const success = botManager.despawnBot(botName);
      if (success) {
        player.variants.sendOnConsoleMessage(`\`2Successfully despawned bot \`w${botName}\`2.`);
      } else {
        player.variants.sendOnConsoleMessage(`\`4Bot \`o${botName}\`4 not found.`);
      }
      return;
    }

    if (sub === "say") {
      const botName = args[1];
      const botMsg = args.slice(2).join(" ");
      if (!botName || !botMsg) {
        return player.variants.sendOnConsoleMessage("`4Usage: /bot say <bot_name> <message>``");
      }
      const bot = botManager.bots.get(botName.toLowerCase());
      if (!bot) {
        return player.variants.sendOnConsoleMessage(`\`4Bot \`o${botName}\`4 not found.`);
      }
      bot.say(botMsg);
      player.variants.sendOnConsoleMessage(`\`2[${bot.displayName}]: \`$${botMsg}`);
      return;
    }

    if (sub === "spawn") {
      const botName = args[1];
      const worldName = args[2] || player.world?.name || "START";
      const behavior = (args[3]?.toLowerCase() ?? "social") as any;

      if (!botName) {
        return player.variants.sendOnConsoleMessage("`4Usage: /bot spawn <name> [world] [social|farmer|casino_host|casino_gambler|trader]``");
      }

      try {
        const spawned = await botManager.spawnBot({
          name: botName,
          worldName,
          behavior,
          dialoguePool: [
            "Hey everyone! Having fun?",
            "GrowServer is pretty cool!",
            "Anyone want to trade or hang out?",
            "Nice world!",
          ],
        });
        player.variants.sendOnConsoleMessage(`\`2Successfully spawned bot \`w${spawned.displayName}\`2 in \`w${worldName}\`2!`);
      } catch (err: any) {
        player.variants.sendOnConsoleMessage(`\`4Failed to spawn bot: ${err?.message ?? err}`);
      }
      return;
    }

    player.variants.sendOnConsoleMessage("`4Usage: /bot <status|list|spawn|kick|say|respawn>``");
  },
});
