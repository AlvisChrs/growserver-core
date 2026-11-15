import { DialogBuilder } from "../../utils/dialog-builder";
import { ITEM_ID } from "../world/constants";
import { PlayerDB } from "../../database/services/player-db";
import { serverManager } from "../server/server-manager";
import type { Player } from "../player";
import { registerDialog } from "../network/dialog-handler";

export class FriendManager {
  /**
   * Sends a friend request from `sender` to `target`.
   */
  public static async sendRequest(sender: Player, target: Player): Promise<void> {
    if (sender.playerId === target.playerId) {
      sender.variants.sendOnConsoleMessage("`4You cannot add yourself as a friend!``");
      return;
    }

    if (sender.friends.has(target.playerId)) {
      sender.variants.sendOnConsoleMessage("`4You are already friends with `$" + target.displayName + "`4!``");
      return;
    }

    // Mutual request: if target already sent a request to sender, immediately accept!
    if (sender.incomingFriendRequests.has(target.playerId)) {
      await this.acceptRequest(sender, target.playerId);
      return;
    }

    if (target.incomingFriendRequests.has(sender.playerId)) {
      sender.variants.sendOnConsoleMessage("`oYou have already sent a friend request to `$" + target.displayName + "`o.``");
      return;
    }

    target.incomingFriendRequests.add(sender.playerId);
    sender.variants.sendOnConsoleMessage("`2Friend request sent to `$" + target.displayName + "`2!``");

    // Alert target with interactive request dialog and text bubble
    target.variants.sendOnConsoleMessage("`2`$" + sender.displayName + " `2wants to be your friend!``");
    target.sendTextBubble("`2Friend request from `$" + sender.displayName + "`2!``", true);
    target.sendSfx("audio/dialog_confirm.wav");

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Friend Request!", ITEM_ID.HEART, "big")
      .addTextBox("`$" + sender.displayName + "`` wants to be your friend!")
      .embed("targetPlayerId", sender.playerId)
      .embed("targetName", sender.displayName)
      .addButton("friend_accept_" + sender.playerId, "`2Accept Friend Request``")
      .addButton("friend_decline_" + sender.playerId, "`4Decline``")
      .addQuickExit()
      .endDialog("friend_request_resp", "", "Close")
      .str();

    target.variants.sendOnDialogRequest(dialog);
  }

  /**
   * Accepts an incoming friend request from `requesterId`.
   */
  public static async acceptRequest(player: Player, requesterId: number): Promise<boolean> {
    player.incomingFriendRequests.delete(requesterId);
    player.friends.add(requesterId);
    await player.saveToDatabase();

    const onlineRequester = [...serverManager.players.values()].find((p) => p.playerId === requesterId);
    if (onlineRequester) {
      onlineRequester.incomingFriendRequests.delete(player.playerId);
      onlineRequester.friends.add(player.playerId);
      await onlineRequester.saveToDatabase();

      onlineRequester.variants.sendOnConsoleMessage("`2`$" + player.displayName + " `2accepted your friend request! You are now friends.``");
      onlineRequester.sendTextBubble("`2Now friends with `$" + player.displayName + "`2!``", true);
      onlineRequester.sendSfx("audio/success.wav");
    } else {
      const requesterRecord = await PlayerDB.getById(requesterId);
      if (requesterRecord) {
        let existingFriends: number[] = [];
        let existingIncoming: number[] = [];
        if (requesterRecord.friends_data) {
          try {
            const parsed = JSON.parse(requesterRecord.friends_data);
            existingFriends = parsed.friends ?? [];
            existingIncoming = parsed.incoming ?? [];
          } catch {}
        }
        if (!existingFriends.includes(player.playerId)) existingFriends.push(player.playerId);
        existingIncoming = existingIncoming.filter((id) => id !== player.playerId);
        await PlayerDB.updateById(requesterId, {
          friends_data: JSON.stringify({ friends: existingFriends, incoming: existingIncoming }),
        });
      }
    }

    const requesterName = onlineRequester?.displayName ?? ("Player #" + requesterId);
    player.variants.sendOnConsoleMessage("`2You are now friends with `$" + requesterName + "`2!``");
    player.sendSfx("audio/success.wav");
    return true;
  }

  /**
   * Declines an incoming friend request.
   */
  public static declineRequest(player: Player, requesterId: number): void {
    player.incomingFriendRequests.delete(requesterId);
    player.variants.sendOnConsoleMessage("`4Friend request declined.``");
  }

  /**
   * Removes a friend by playerId.
   */
  public static async removeFriend(player: Player, friendId: number): Promise<boolean> {
    if (!player.friends.has(friendId)) {
      player.variants.sendOnConsoleMessage("`4That player is not in your friends list!``");
      return false;
    }

    player.friends.delete(friendId);
    await player.saveToDatabase();

    const onlineFriend = [...serverManager.players.values()].find((p) => p.playerId === friendId);
    if (onlineFriend) {
      onlineFriend.friends.delete(player.playerId);
      await onlineFriend.saveToDatabase();
      onlineFriend.variants.sendOnConsoleMessage("`4`$" + player.displayName + " `4removed you from their friends list.``");
    } else {
      const friendRecord = await PlayerDB.getById(friendId);
      if (friendRecord?.friends_data) {
        try {
          const parsed = JSON.parse(friendRecord.friends_data);
          const list = (parsed.friends ?? []).filter((id: number) => id !== player.playerId);
          await PlayerDB.updateById(friendId, {
            friends_data: JSON.stringify({ ...parsed, friends: list }),
          });
        } catch {}
      }
    }

    player.variants.sendOnConsoleMessage("`4Friend removed successfully.``");
    return true;
  }

  /**
   * Opens the full interactive Friends List dialog for `player`.
   */
  public static async openFriendsDialog(player: Player): Promise<void> {
    const friendIds = [...player.friends];
    const onlineMap = new Map<number, Player>();
    for (const p of serverManager.players.values()) {
      if (p.playerId > 0) onlineMap.set(p.playerId, p);
    }

    const onlineFriends: Player[] = [];
    const offlineFriendIds: number[] = [];

    for (const id of friendIds) {
      const online = onlineMap.get(id);
      if (online) onlineFriends.push(online);
      else offlineFriendIds.push(id);
    }

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("`wFriends List (`2" + onlineFriends.length + " Online`w / " + friendIds.length + " Total)", ITEM_ID.HEART, "big")
      .addSpacer("small");

    if (friendIds.length === 0) {
      dialog
        .addTextBox("`oYou don't have any friends yet!``")
        .addTextBox("`oWrench another player and tap `2Add as friend`o, or use `/friend <name>``.``")
        .addSpacer("small");
    } else {
      if (onlineFriends.length > 0) {
        dialog.addSmallText("`2Online Friends:``");
        for (const friend of onlineFriends) {
          const worldName = friend.world?.name ? ("`w" + friend.world.name + "``") : "`8Lobby``";
          dialog
            .addLabelWithIcon("`2" + friend.displayName + " `o(World: " + worldName + "`o)``", ITEM_ID.HEART, "small")
            .addButton("warp_to_friend_" + friend.netID, "`2Warp to " + friend.displayName + "``")
            .addButton("unfriend_action_" + friend.playerId, "`4Unfriend``")
            .addSpacer("small");
        }
      }

      if (offlineFriendIds.length > 0) {
        dialog.addSmallText("`8Offline Friends:``");
        for (const id of offlineFriendIds) {
          const record = await PlayerDB.getById(id);
          const name = record?.display_name || record?.name || ("Player #" + id);
          dialog
            .addLabelWithIcon("`8" + name + " `o(Offline)``", ITEM_ID.HEART, "small")
            .addButton("unfriend_action_" + id, "`4Unfriend``")
            .addSpacer("small");
        }
      }
    }

    dialog.addQuickExit().endDialog("friends_list_dialog", "", "Close");
    player.variants.sendOnDialogRequest(dialog.str());
  }
}

// Register Dialog Handlers
registerDialog("friend_request_resp", async (player, action) => {
  const button = action.get("buttonClicked");
  if (button.startsWith("friend_accept_")) {
    const requesterId = Number.parseInt(button.replace("friend_accept_", ""), 10);
    if (requesterId > 0) await FriendManager.acceptRequest(player, requesterId);
  } else if (button.startsWith("friend_decline_")) {
    const requesterId = Number.parseInt(button.replace("friend_decline_", ""), 10);
    if (requesterId > 0) FriendManager.declineRequest(player, requesterId);
  }
});

registerDialog("friends_list_dialog", async (player, action) => {
  const button = action.get("buttonClicked");
  if (button.startsWith("warp_to_friend_")) {
    const targetNetId = Number.parseInt(button.replace("warp_to_friend_", ""), 10);
    const target = [...serverManager.players.values()].find((p) => p.netID === targetNetId);
    if (!target || !target.world) {
      player.variants.sendOnConsoleMessage("`4That friend is no longer online or in a world!``");
      return;
    }
    player.variants.sendOnConsoleMessage("`2Warping to `$" + target.displayName + "`2 in `w" + target.world.name + "`2...``");
    player.sendSfx("audio/door_open.wav");
    player.warp(target.world.name);
  } else if (button.startsWith("unfriend_action_")) {
    const friendId = Number.parseInt(button.replace("unfriend_action_", ""), 10);
    if (friendId > 0) {
      await FriendManager.removeFriend(player, friendId);
      await FriendManager.openFriendsDialog(player);
    }
  }
});
