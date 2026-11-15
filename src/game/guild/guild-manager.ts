import { DialogBuilder } from "../../utils/dialog-builder";
import { db } from "../../database/db";
import { GuildDB } from "../../database/services/guild-db";
import { PlayerDB } from "../../database/services/player-db";
import { serverManager } from "../server/server-manager";
import type { Player } from "../player";
import type { GuildRecord } from "../../database/tables/guilds";
import { registerDialog } from "../network/dialog-handler";

const GUILD_LOCK_ID = 5814;
const GUILD_CREATION_FEE_GEMS = 10_000;

export class GuildManager {
  /**
   * Creates a new guild.
   */
  public static async createGuild(leader: Player, rawName: string, rawTag: string): Promise<GuildRecord | null> {
    if (leader.guildId) {
      leader.variants.sendOnConsoleMessage("`4You are already in a guild! Leave your current guild first.``");
      return null;
    }

    const name = rawName.trim();
    const tag = rawTag.trim().toUpperCase();

    if (!/^[a-zA-Z0-9 ]{3,18}$/.test(name)) {
      leader.variants.sendOnConsoleMessage("`4Invalid Guild Name! Must be 3-18 alphanumeric characters.``");
      return null;
    }

    if (!/^[a-zA-Z0-9]{2,4}$/.test(tag)) {
      leader.variants.sendOnConsoleMessage("`4Invalid Guild Tag! Must be 2-4 alphanumeric characters (e.g. LGND, PRO, HERO).``");
      return null;
    }

    const existing = await GuildDB.findByName(name);
    if (existing) {
      leader.variants.sendOnConsoleMessage("`4A guild named \"`$" + name + "`4\" already exists!``");
      return null;
    }

    if (!leader.isDeveloper && !leader.isModerator) {
      if (leader.gems < GUILD_CREATION_FEE_GEMS) {
        leader.variants.sendOnConsoleMessage("`4Creating a Guild costs `o" + GUILD_CREATION_FEE_GEMS.toLocaleString() + "`4 Gems. You have `o" + leader.gems.toLocaleString() + "`4 Gems.``");
        return null;
      }
      leader.setGems(leader.gems - GUILD_CREATION_FEE_GEMS);
    }

    const guild = await GuildDB.create({
      name,
      tag,
      statement: "Welcome to our Guild!",
      leader_id: leader.playerId,
      level: 1,
      exp: 0,
    });

    leader.guildId = guild.id;
    leader.guildRole = "leader";
    await leader.saveToDatabase();

    leader.variants.sendOnConsoleMessage("`2Congratulations! You founded the Guild `6" + guild.name + " [" + guild.tag + "]`2!``");
    leader.sendSfx("audio/level_up.wav");
    leader.world?.sendParticleEffect?.(46, leader.state.x + 10, leader.state.y + 16);

    return guild;
  }

  /**
   * Invites another player to the guild.
   */
  public static async inviteMember(inviter: Player, target: Player): Promise<void> {
    if (!inviter.guildId) {
      inviter.variants.sendOnConsoleMessage("`4You are not in a guild!``");
      return;
    }

    if (inviter.guildRole !== "leader" && inviter.guildRole !== "co_leader" && inviter.guildRole !== "elder") {
      inviter.variants.sendOnConsoleMessage("`4Only Guild Leaders, Co-Leaders, and Elders can invite new members.``");
      return;
    }

    if (target.guildId) {
      inviter.variants.sendOnConsoleMessage("`4`$" + target.displayName + "`4 is already in a guild!``");
      return;
    }

    const guild = await GuildDB.findById(inviter.guildId);
    if (!guild) return;

    inviter.variants.sendOnConsoleMessage("`2Guild invitation sent to `$" + target.displayName + "`2!``");

    target.variants.sendOnConsoleMessage("`2`$" + inviter.displayName + " `2invited you to join `6" + guild.name + " [" + guild.tag + "]`2!``");
    target.sendTextBubble("`2Guild invite to `6" + guild.tag + "`2!``", true);
    target.sendSfx("audio/dialog_confirm.wav");

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Guild Invitation", GUILD_LOCK_ID, "big")
      .addTextBox("`$" + inviter.displayName + "`` has invited you to join `6" + guild.name + " [" + guild.tag + "]``!")
      .addSpacer("small")
      .addButton("guild_accept_" + guild.id, "`2Accept & Join Guild``")
      .addButton("guild_decline_" + guild.id, "`4Decline``")
      .addQuickExit()
      .endDialog("guild_invite_resp", "", "Close")
      .str();

    target.variants.sendOnDialogRequest(dialog);
  }

  /**
   * Player joins guild.
   */
  public static async joinGuild(player: Player, guildId: number): Promise<boolean> {
    if (player.guildId) {
      player.variants.sendOnConsoleMessage("`4You are already in a guild!``");
      return false;
    }

    const guild = await GuildDB.findById(guildId);
    if (!guild) {
      player.variants.sendOnConsoleMessage("`4Guild not found or disbanded.``");
      return false;
    }

    player.guildId = guild.id;
    player.guildRole = "member";
    await player.saveToDatabase();

    player.variants.sendOnConsoleMessage("`2You have joined `6" + guild.name + " [" + guild.tag + "]`2!``");
    player.sendSfx("audio/success.wav");
    player.world?.sendParticleEffect?.(46, player.state.x + 10, player.state.y + 16);

    this.broadcastGuild(guild.id, "`6[GUILD] `2`$" + player.displayName + " `2has joined the guild!``");
    return true;
  }

  /**
   * Player leaves guild.
   */
  public static async leaveGuild(player: Player): Promise<boolean> {
    if (!player.guildId) {
      player.variants.sendOnConsoleMessage("`4You are not in a guild!``");
      return false;
    }

    const guildId = player.guildId;
    const guild = await GuildDB.findById(guildId);

    if (player.guildRole === "leader") {
      const members = await GuildDB.getMembers(guildId);
      const otherMembers = members.filter((m) => m.id !== player.playerId);
      if (otherMembers.length > 0) {
        player.variants.sendOnConsoleMessage("`4As Guild Leader, you must promote another member to Leader or disband the guild before leaving!``");
        return false;
      }
      return await this.disbandGuild(player);
    }

    player.guildId = null;
    player.guildRole = null;
    await player.saveToDatabase();

    player.variants.sendOnConsoleMessage("`4You left the guild.``");
    if (guild) {
      this.broadcastGuild(guildId, "`6[GUILD] `4`$" + player.displayName + " `4has left the guild.``");
    }
    return true;
  }

  /**
   * Disbands guild completely.
   */
  public static async disbandGuild(leader: Player): Promise<boolean> {
    if (!leader.guildId || leader.guildRole !== "leader") {
      leader.variants.sendOnConsoleMessage("`4Only the Guild Leader can disband the guild!``");
      return false;
    }

    const guildId = leader.guildId;
    const guild = await GuildDB.findById(guildId);
    await GuildDB.deleteById(guildId);
    await db.updateTable("players").set({ guild_id: null, guild_role: null }).where("guild_id", "==", guildId).execute();

    for (const p of serverManager.players.values()) {
      if (p.guildId === guildId) {
        p.guildId = null;
        p.guildRole = null;
        p.variants.sendOnConsoleMessage("`4The guild `6" + (guild?.name ?? "Guild") + "`4 has been disbanded.``");
        p.saveToDatabase().catch(() => {});
      }
    }

    leader.guildId = null;
    leader.guildRole = null;
    await leader.saveToDatabase();
    leader.variants.sendOnConsoleMessage("`4Your guild has been disbanded.``");
    return true;
  }

  /**
   * Kicks a member from guild.
   */
  public static async kickMember(actor: Player, targetPlayerId: number): Promise<boolean> {
    if (!actor.guildId) return false;
    if (actor.guildRole !== "leader" && actor.guildRole !== "co_leader") {
      actor.variants.sendOnConsoleMessage("`4Only Leaders and Co-Leaders can kick members!``");
      return false;
    }

    if (actor.playerId === targetPlayerId) {
      actor.variants.sendOnConsoleMessage("`4You cannot kick yourself! Use `/guild leave`` instead.``");
      return false;
    }

    const targetRecord = await PlayerDB.getById(targetPlayerId);
    if (!targetRecord || targetRecord.guild_id !== actor.guildId) {
      actor.variants.sendOnConsoleMessage("`4Player is not in your guild!``");
      return false;
    }

    if (actor.guildRole === "co_leader" && (targetRecord.guild_role === "leader" || targetRecord.guild_role === "co_leader")) {
      actor.variants.sendOnConsoleMessage("`4Co-Leaders cannot kick Leaders or other Co-Leaders!``");
      return false;
    }

    const onlineTarget = [...serverManager.players.values()].find((p) => p.playerId === targetPlayerId);
    if (onlineTarget) {
      onlineTarget.guildId = null;
      onlineTarget.guildRole = null;
      await onlineTarget.saveToDatabase();
      onlineTarget.variants.sendOnConsoleMessage("`4You have been kicked from the guild.``");
    } else {
      await PlayerDB.updateById(targetPlayerId, { guild_id: null, guild_role: null });
    }

    const targetName = targetRecord.display_name || targetRecord.name;
    this.broadcastGuild(actor.guildId, "`6[GUILD] `4`$" + targetName + " `4was kicked from the guild by `$" + actor.displayName + "`4.``");
    return true;
  }

  /**
   * Updates guild statement.
   */
  public static async setStatement(actor: Player, statement: string): Promise<boolean> {
    if (!actor.guildId || (actor.guildRole !== "leader" && actor.guildRole !== "co_leader")) {
      actor.variants.sendOnConsoleMessage("`4Only Leaders and Co-Leaders can edit the Guild Statement!``");
      return false;
    }

    const clean = statement.trim().slice(0, 100);
    await GuildDB.updateById(actor.guildId, { statement: clean });
    actor.variants.sendOnConsoleMessage("`2Guild statement updated to: \"`o" + clean + "`2\"``");
    return true;
  }

  /**
   * Broadcasts a chat message to all online guild members.
   */
  public static broadcastGuild(guildId: number, message: string): void {
    for (const player of serverManager.players.values()) {
      if (player.guildId === guildId) {
        player.variants.sendOnConsoleMessage(message);
      }
    }
  }

  /**
   * Sends guild chat from a player.
   */
  public static sendGuildChat(player: Player, text: string): void {
    if (!player.guildId) {
      player.variants.sendOnConsoleMessage("`4You are not in a guild! Use `/guild`` to create or join one.``");
      return;
    }

    const message = text.trim();
    if (!message) return;

    const formatted = "`#[GUILD] `w" + player.displayName + ": `#" + message + "``";
    this.broadcastGuild(player.guildId, formatted);
  }

  /**
   * Opens the main Guild Dashboard dialog for `player`.
   */
  public static async openGuildDialog(player: Player): Promise<void> {
    if (!player.guildId) {
      const topGuilds = await GuildDB.listTopGuilds(10);
      const dialog = new DialogBuilder()
        .defaultColor()
        .addLabelWithIcon("Growtopia Guilds", GUILD_LOCK_ID, "big")
        .addTextBox("`oYou are not a member of any Guild. Form your own brotherhood or join an existing guild!``")
        .addSpacer("small")
        .addButton("guild_menu_create", "`2Create a Guild (10,000 Gems)``")
        .addSpacer("small")
        .addSmallText("`6Top Active Guilds:``");

      if (topGuilds.length === 0) {
        dialog.addTextBox("`8No guilds formed yet. Be the first to create one!``");
      } else {
        for (const g of topGuilds) {
          dialog.addLabelWithIcon("`6" + g.name + " [" + g.tag + "] `o(Level " + g.level + ") - `i\"" + g.statement + "\"``", GUILD_LOCK_ID, "small");
        }
      }

      dialog.addQuickExit().endDialog("guild_guest_menu", "", "Close");
      player.variants.sendOnDialogRequest(dialog.str());
      return;
    }

    const guild = await GuildDB.findById(player.guildId);
    if (!guild) {
      player.guildId = null;
      player.guildRole = null;
      await player.saveToDatabase();
      player.variants.sendOnConsoleMessage("`4Guild not found. Your guild status has been cleared.``");
      return;
    }

    const members = await GuildDB.getMembers(guild.id);
    const onlineMap = new Map<number, Player>();
    for (const p of serverManager.players.values()) {
      if (p.playerId > 0) onlineMap.set(p.playerId, p);
    }

    const leaderRecord = members.find((m) => m.id === guild.leader_id);
    const leaderName = leaderRecord?.display_name || leaderRecord?.name || ("Player #" + guild.leader_id);

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Guild: " + guild.name + " [" + guild.tag + "]", GUILD_LOCK_ID, "big")
      .addSmallText("`2Level: `w" + guild.level + "  `2EXP: `w" + guild.exp + "  `2Leader: `w" + leaderName + "``")
      .addSmallText("`oStatement: `i\"" + guild.statement + "\"``")
      .addSpacer("small")
      .addButton("guild_open_chat", "`#Guild Chat``")
      .addButton("guild_invite_prompt", "`2Invite Player``");

    if (player.guildRole === "leader" || player.guildRole === "co_leader") {
      dialog.addButton("guild_edit_statement", "`wEdit Statement``");
    }
    if (player.guildRole === "leader") {
      dialog.addButton("guild_disband_confirm", "`4Disband Guild``");
    } else {
      dialog.addButton("guild_leave_confirm", "`4Leave Guild``");
    }

    dialog.addSpacer("small").addSmallText("`6Guild Roster (" + members.length + " Members):``");

    for (const member of members) {
      const isOnline = onlineMap.has(member.id);
      const onlinePlayer = onlineMap.get(member.id);
      const statusText = isOnline ? ("`2Online (`w" + (onlinePlayer?.world?.name ?? "Lobby") + "`2)``") : "`8Offline``";
      const roleTag = member.guild_role ? ("`3[" + member.guild_role.toUpperCase() + "]``") : "`8[MEMBER]``";
      const name = member.display_name || member.name;

      dialog.addLabelWithIcon(roleTag + " `w" + name + "`` - " + statusText, GUILD_LOCK_ID, "small");
      if (player.guildRole === "leader" && member.id !== player.playerId) {
        dialog.addButton("guild_kick_" + member.id, "`4Kick " + name + "``");
      }
    }

    dialog.addQuickExit().endDialog("guild_main_dashboard", "", "Close");
    player.variants.sendOnDialogRequest(dialog.str());
  }
}

// Dialog Handlers
registerDialog("guild_guest_menu", (player, action) => {
  const button = action.get("buttonClicked");
  if (button === "guild_menu_create") {
    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Create a Guild", GUILD_LOCK_ID, "big")
      .addTextBox("`oCost: `210,000 Gems`o. Enter the name and 2-4 letter tag for your guild.``")
      .addInputBox("guild_name", "Guild Name", "", 18)
      .addInputBox("guild_tag", "Guild Tag (e.g. LGND)", "", 4)
      .addQuickExit()
      .endDialog("guild_create_submit", "Cancel", "Create")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  }
});

registerDialog("guild_create_submit", async (player, action) => {
  const name = action.get("guild_name");
  const tag = action.get("guild_tag");
  if (!name || !tag) return;
  await GuildManager.createGuild(player, name, tag);
});

registerDialog("guild_invite_resp", async (player, action) => {
  const button = action.get("buttonClicked");
  if (button.startsWith("guild_accept_")) {
    const guildId = Number.parseInt(button.replace("guild_accept_", ""), 10);
    if (guildId > 0) await GuildManager.joinGuild(player, guildId);
  } else if (button.startsWith("guild_decline_")) {
    player.variants.sendOnConsoleMessage("`4Guild invitation declined.``");
  }
});

registerDialog("guild_main_dashboard", async (player, action) => {
  const button = action.get("buttonClicked");
  if (button === "guild_open_chat") {
    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Guild Chat", GUILD_LOCK_ID, "big")
      .addInputBox("guild_chat_text", "Message", "", 120)
      .addQuickExit()
      .endDialog("guild_chat_submit", "Cancel", "Send")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  } else if (button === "guild_invite_prompt") {
    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Invite Player to Guild", GUILD_LOCK_ID, "big")
      .addInputBox("invite_target_name", "Player GrowID", "", 24)
      .addQuickExit()
      .endDialog("guild_invite_submit", "Cancel", "Invite")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  } else if (button === "guild_edit_statement") {
    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Edit Guild Statement", GUILD_LOCK_ID, "big")
      .addInputBox("statement_text", "New Statement", "", 100)
      .addQuickExit()
      .endDialog("guild_statement_submit", "Cancel", "Save")
      .str();
    player.variants.sendOnDialogRequest(dialog);
  } else if (button === "guild_leave_confirm") {
    await GuildManager.leaveGuild(player);
  } else if (button === "guild_disband_confirm") {
    await GuildManager.disbandGuild(player);
  } else if (button.startsWith("guild_kick_")) {
    const targetId = Number.parseInt(button.replace("guild_kick_", ""), 10);
    if (targetId > 0) {
      await GuildManager.kickMember(player, targetId);
      await GuildManager.openGuildDialog(player);
    }
  }
});

registerDialog("guild_chat_submit", (player, action) => {
  const text = action.get("guild_chat_text");
  if (text) GuildManager.sendGuildChat(player, text);
});

registerDialog("guild_invite_submit", (player, action) => {
  const name = action.get("invite_target_name");
  if (!name) return;
  const target = serverManager.getPlayerByName(name);
  if (!target) {
    player.variants.sendOnConsoleMessage("`4Player \"`$" + name + "`4\" is not online!``");
    return;
  }
  GuildManager.inviteMember(player, target);
});

registerDialog("guild_statement_submit", async (player, action) => {
  const statement = action.get("statement_text");
  if (statement) await GuildManager.setStatement(player, statement);
});
