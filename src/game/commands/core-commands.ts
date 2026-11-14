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
import { ActionTypes, ITEM_ID, LOCKS, LockPermission } from "../world/constants";
import { generateDefaultWorld } from "../world/generation/default";
import { worldManager } from "../world/world-manager";
import { SeedTile } from "../world/tiles/seed-tile";
import { ProviderTile } from "../world/tiles/provider-tile";
import { Collection } from "../../utils/collection";
import { canUseCommand, commands, registerCommand, roleRank, type ChatCommand } from "./registry";
import { tradeManager } from "../trade/trade-manager";
import { eventManager, GameEventType } from "../events/event-manager";

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
  description: "Shows available commands",
  usage: "/help [command]",
  cooldown: 2,
  execute(player, args) {
    const requested = args[0]?.replace(/^\//, "").toLowerCase();
    if (requested) {
      const command = commands.get(requested) ?? commands.find((entry) => (entry.aliases ?? []).includes(requested));
      if (!command) return player.variants.sendOnConsoleMessage("It seems that command doesn't exist.");

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

    const available = commands
      .toArray()
      .filter((command: ChatCommand) => canUseCommand(player, command))
      .map((command) => `/${command.name}`)
      .sort();
    player.variants.sendOnConsoleMessage(`Available commands: ${available.join(", ")}`);
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
  role: PLAYER_ROLE.SUPPORTER,
  cooldown: 2,
  execute(player) {
    player.state.isGhost = !player.state.isGhost;

    if (player.state.isGhost) {
      player.state.characterState |= GHOST_STATE;
      player.variants.sendOnConsoleMessage("`2Ghost mode enabled``. You can now walk through blocks!");
      // semi-transparent white appearance
      for (const other of player.world?.players ?? [player]) {
        other.variants.sendClothes(player.netID, player.effectiveClothes, 0xffffff80);
      }
    } else {
      player.state.characterState &= ~GHOST_STATE;
      player.variants.sendOnConsoleMessage("`4Ghost mode disabled``. You are back to normal.");
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
  description: "Change a player's role.",
  usage: "/giverole <target> <0 user|1 developer|2 moderator|3 supporter|4 owner|5 guardian>",
  role: PLAYER_ROLE.DEVELOPER,
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
      target.online.variants.sendOnConsoleMessage(`\`2Your role has been changed to \`o${ROLE_NAMES[role]}\`2 by an administrator!\`\``);
    }
    player.variants.sendOnConsoleMessage(`\`2Successfully changed role of \`o${target.name}\`2 to \`o${ROLE_NAMES[role]}\`2.\`\``);
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
  role: PLAYER_ROLE.BASIC,
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

    const target = await resolveTarget(rawTarget!);
    if (!target?.playerId) return player.variants.sendOnConsoleMessage(`\`4Player \`o${rawTarget}\`4 not found.\`\``);

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

    if (target.online.isDeveloper || roleRank(target.online.role) >= roleRank(player.role)) {
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

    if (target.online.isDeveloper || roleRank(target.online.role) >= roleRank(player.role)) {
      return player.variants.sendOnConsoleMessage("`4You cannot freeze equal or higher ranked staff.``");
    }

    target.online.state.characterState |= CHARACTER_STATE.IS_FROZEN;
    target.online.playMods.add("frozen");
    target.online.variants.sendOnSetFreezeState(target.online.netID, true);
    target.online.sendCharacterState();
    target.online.sendTextBubble("`4*Brrr! (You have been frozen)*``", true);
    target.online.variants.sendOnConsoleMessage(`\`4You have been frozen by ${player.displayName}.\`\``);
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

    if (target.online.isDeveloper || roleRank(target.online.role) >= roleRank(player.role)) {
      return player.variants.sendOnConsoleMessage("`4You cannot curse equal or higher ranked staff.``");
    }

    target.online.state.characterState |= CHARACTER_STATE.IS_CURSED;
    target.online.sendCharacterState();
    target.online.variants.sendOnConsoleMessage(`\`4You have been cursed by ${player.displayName}!\`\``);
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
      if (target.online.isDeveloper || roleRank(target.online.role) >= roleRank(player.role)) {
        return player.variants.sendOnConsoleMessage("`4You cannot ban an administrator or equal/higher rank staff member.``");
      }
    } else {
      const record = await PlayerDB.getByIdWithDeleted(target.playerId);
      if (record && roleRank(record.role_id) >= roleRank(player.role)) {
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
  description: "Restore the world from your manual /backup snapshot",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 2,
  execute(player) {
    const world = player.world;
    if (!world) return;
    const backup = manualWorldBackups.get(world.name);
    if (!backup) return player.variants.sendOnConsoleMessage("`4No manual snapshot found for this world. Use \`/backup\` first.\`\``");

    world.data.blocks = JSON.parse(backup);
    world.markDirty();
    for (const p of world.players) {
      p.leaveWorld();
    }
    player.variants.sendOnConsoleMessage(`\`2World \`o${world.name}\`2 restored to snapshot! Re-enter to view.\`\``);
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
  description: "Toggle invisibility",
  role: PLAYER_ROLE.MODERATOR,
  cooldown: 2,
  execute(player) {
    const isCurrentlyInvisible = (player.state.characterState & CHARACTER_STATE.IS_INVISIBLE) !== 0;
    if (isCurrentlyInvisible) {
      player.state.characterState &= ~CHARACTER_STATE.IS_INVISIBLE;
      player.variants.sendOnConsoleMessage("`4Invisibility disabled.``");
    } else {
      player.state.characterState |= CHARACTER_STATE.IS_INVISIBLE;
      player.variants.sendOnConsoleMessage("`2Invisibility enabled! You are now invisible.``");
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
  description: "Set custom run speed (e.g. /speed 2500, /speed reset)",
  usage: "/speed <number or reset>",
  role: PLAYER_ROLE.DEVELOPER,
  cooldown: 1,
  execute(player, args) {
    const input = args[0]?.toLowerCase().trim();
    if (!input || input === "reset" || input === "default") {
      player.customSpeed = undefined;
      player.sendCharacterState();
      return player.variants.sendOnConsoleMessage("`2Speed reset to normal (1200).``");
    }

    const val = Number.parseInt(input, 10);
    if (Number.isNaN(val) || val < 100 || val > 10000) {
      return player.variants.sendOnConsoleMessage("`4Usage: /speed <100-10000> or /speed reset (normal is 1200)``");
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
      { id: 242, count: 200 }, // World Lock
      { id: 1796, count: 200 }, // Diamond Lock
      { id: 7188, count: 200 }, // Blue Gem Lock
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
    player.variants.sendOnConsoleMessage("`2Received the \`$Ultimate Admin Starter Pack\`2 (Rayman, BGLs, DLs, Wings, Tools)!\`\``");
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
  name: "transform",
  aliases: ["morph", "growformer", "hero"],
  description: "Toggle vehicle or robot transform mode with transformable items",
  cooldown: 1,
  execute(player) {
    player.toggleTransform();
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
    player.variants.sendOnConsoleMessage("`2=== GrowServer Rules ===``");
    player.variants.sendOnConsoleMessage("`o1. Be respectful to other players. No harassment or hate speech.");
    player.variants.sendOnConsoleMessage("`o2. No scamming, duping, or exploiting bugs.");
    player.variants.sendOnConsoleMessage("`o3. Follow instructions from Moderators and Developers.");
    player.variants.sendOnConsoleMessage("`2Have fun building and exploring!``");
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
    delete world.data.weather;
    world.markDirty();

    // Teleport all online players to main door and resend world
    const door = world.mainDoor;
    const doorX = (door?.x ?? 0) * 32;
    const doorY = (door?.y ?? 0) * 32;

    for (const p of world.players) {
      p.state.x = doorX;
      p.state.y = doorY;
      p.sendWorld(world);
      p.sendInventory();
      p.sendTextBubble("`2The world was reset to its original template!``", true);
      p.variants.sendOnConsoleMessage(`\`2World \`w${world.name}\`2 was regenerated to its clean procedural template.\`\``);
    }

    player.variants.sendOnConsoleMessage(`\`2World \`w${world.name}\`2 successfully reset to procedural template!\`\``);
  },
});

registerCommand({
  name: "katana",
  aliases: ["lkat", "katanas"],
  description: "Give Legendary Katana and elemental katana series",
  role: PLAYER_ROLE.USER,
  execute(player) {
    const katanas = [
      { id: 2592, name: "Legendary Katana" },
      { id: 9058, name: "Cursed Katana" },
      { id: 11118, name: "Sonic Buster Katana" },
      { id: 13710, name: "Dark Magic Katana" },
      { id: 16428, name: "Immortal Sonic Buster Katana" },
    ];
    for (const k of katanas) {
      if (!player.inventory.hasItem(k.id)) player.addItemInven(k.id, 1);
    }
    // Auto-equip Legendary Katana
    player.equipClothes(2592);
    player.sendSfx("audio/thousandSlash.wav");
    player.sendTextBubble("`#SHING! Legendary Katana equipped!``", true);
    player.variants.sendOnConsoleMessage("`#You have unsheathed the Legendary Katana! Punch to unleash crescent slashes!``");
  },
});

registerCommand({
  name: "hero",
  aliases: ["superhero"],
  description: "Equip superhero suit and activate hero mode",
  role: PLAYER_ROLE.USER,
  execute(player) {
    const heroItems = [
      350, // Heroman Cape
      2134, // Superhero Mask - Red
      2098, // Heroic Tights - Red
      2122, // Heroic Boots - Red
      2170, // Superheroine Top - Red
      11560, // Ezio Full-Body Suit
    ];
    for (const id of heroItems) {
      if (!player.inventory.hasItem(id)) player.addItemInven(id, 1);
    }
    player.equipClothes(350);
    player.equipClothes(2134);
    player.equipClothes(2098);
    player.equipClothes(2122);
    player.equipClothes(2170);

    player.playMods.add("hero_suit");
    player.sendSfx("audio/change_clothes.wav");
    player.sendTextBubble("`5Up, up, and away! Superhero powers engaged!``", true);
    player.variants.sendOnConsoleMessage("`5Superhero powers activated! Double jump, increased speed, and heroic punch range unlocked!``");
  },
});

registerCommand({
  name: "criminal",
  aliases: ["villain", "crime"],
  description: "Receive Crime Wave consumable and Crime In Progress blocks",
  role: PLAYER_ROLE.USER,
  execute(player) {
    player.addItemInven(2382, 5); // Crime Wave
    player.addItemInven(2302, 5); // Crime In Progress
    player.addItemInven(2360, 1); // Dr. Destructo Portrait
    player.sendSfx("audio/alarm.wav");
    player.sendTextBubble("`4Villainous schemes in motion!``", true);
    player.variants.sendOnConsoleMessage("`4Received Crime Wave and Crime In Progress blocks! Use Crime Wave to summon villains!``");
  },
});

registerCommand({
  name: "fish",
  aliases: ["fishing", "angler"],
  description: "Receive fishing rods, baits, fish tank and port starter pack",
  role: PLAYER_ROLE.USER,
  execute(player) {
    const fishingPack = [
      { id: 2912, count: 1 }, // Fishing Rod
      { id: 3040, count: 1 }, // Goldenrod
      { id: 2914, count: 50 }, // Wiggly Worm
      { id: 3014, count: 25 }, // Salmon Eggs
      { id: 5528, count: 10 }, // Mega-Pellet Bait
      { id: 3004, count: 20 }, // Fish Tank (background)
      { id: 3002, count: 2 }, // Fish Tank Port
      { id: 5530, count: 2 }, // Training Port
    ];
    for (const item of fishingPack) {
      player.addItemInven(item.id, item.count);
    }
    // Auto-equip Fishing Rod
    player.equipClothes(2912);
    player.sendSfx("audio/splash.wav");
    player.sendTextBubble("`2Equipped Fishing Rod! Select bait and tap water to fish!``", true);
    player.variants.sendOnConsoleMessage("`2Received Fishing Starter Pack! Equip rod, select bait, and tap water to catch fish!``");
  },
});

registerCommand({
  name: "wizard",
  aliases: ["lquester", "legendarywizard"],
  description: "Get Legendary Wizard NPC block and interact with the wizard",
  role: PLAYER_ROLE.USER,
  execute(player) {
    player.addItemInven(1790, 1); // Legendary Wizard
    player.sendSfx("audio/magic_hit.wav");
    player.sendTextBubble("`9The Legendary Wizard answers your call!``", true);
    player.variants.sendOnConsoleMessage("`9Received Legendary Wizard block! Place it or interact to undertake Legendary Quests!``");
  },
});
