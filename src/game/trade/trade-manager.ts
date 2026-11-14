import { Collection } from "../../utils/collection";
import { DialogBuilder } from "../../utils/dialog-builder";
import { getItem } from "../item/item-utils";
import type { Player } from "../player";
import { BlockFlags } from "../world/constants";
import { registerDialog } from "../network/dialog-handler";
import { TradeSession } from "./trade-session";

export class TradeManager {
  /** Pending invitations: "fromId:toId" -> expireTimestamp */
  public pendingInvites: Collection<string, number> = new Collection();
  /** Active session per player ID */
  public activeSessions: Collection<number, TradeSession> = new Collection();

  public getSession(player: Player): TradeSession | undefined {
    return this.activeSessions.get(player.playerId);
  }

  public isInTrade(player: Player): boolean {
    return this.activeSessions.has(player.playerId);
  }

  public invite(from: Player, to: Player): boolean {
    if (from.playerId === to.playerId) {
      from.variants.sendOnConsoleMessage("`4You cannot trade with yourself.``");
      return false;
    }

    if (from.world !== to.world || !from.world) {
      from.variants.sendOnConsoleMessage(`\`4\`$${to.displayName}\`4 is not in the same world.\`\``);
      return false;
    }

    if (this.isInTrade(from)) {
      from.variants.sendOnConsoleMessage("`4You are already in an active trade.``");
      return false;
    }

    if (this.isInTrade(to)) {
      from.variants.sendOnConsoleMessage(`\`4\`$${to.displayName}\`4 is currently trading with someone else.\`\``);
      return false;
    }

    // Check if `to` already invited `from` -> Start trade immediately!
    const reverseKey = `${to.playerId}:${from.playerId}`;
    const reverseExpiry = this.pendingInvites.get(reverseKey) ?? 0;
    if (reverseExpiry > Date.now()) {
      this.pendingInvites.delete(reverseKey);
      this.startTrade(from, to);
      return true;
    }

    // Store pending invite valid for 30s
    const inviteKey = `${from.playerId}:${to.playerId}`;
    this.pendingInvites.set(inviteKey, Date.now() + 30_000);

    from.variants.sendOnConsoleMessage(`\`2Trade invitation sent to \`$${to.displayName}\`2.\`\``);
    to.variants.sendOnConsoleMessage(`\`2\`$${from.displayName} \`2wants to trade with you! Type \`$/trade ${from.displayName}\`2 or wrench them to accept.\`\``);
    to.sendTextBubble(`\`2Trade request from \`$${from.displayName}\`2!\`\``, true);
    to.sendSfx("audio/dialog_confirm.wav");
    return true;
  }

  public startTrade(player1: Player, player2: Player): void {
    const session = new TradeSession(player1, player2);
    this.activeSessions.set(player1.playerId, session);
    this.activeSessions.set(player2.playerId, session);

    player1.sendSfx("audio/trade_open.wav");
    player2.sendSfx("audio/trade_open.wav");
    session.syncDialogs();
  }

  public cancel(player: Player, reason = "Trade canceled."): void {
    const session = this.activeSessions.get(player.playerId);
    if (!session) return;

    session.isCompleted = true;
    this.activeSessions.delete(session.player1.playerId);
    this.activeSessions.delete(session.player2.playerId);

    session.player1.variants.sendOnConsoleMessage(`\`4${reason}\`\``);
    session.player2.variants.sendOnConsoleMessage(`\`4${reason}\`\``);

    // Close dialogs
    const closeDialog = new DialogBuilder().defaultColor().addTextBox(reason).addQuickExit().endDialog("trade_end", "", "Ok").str();
    session.player1.variants.sendOnDialogRequest(closeDialog);
    session.player2.variants.sendOnDialogRequest(closeDialog);
  }

  public addItem(player: Player, itemId: number, amount: number): boolean {
    const session = this.activeSessions.get(player.playerId);
    if (!session || session.isLocked(player)) return false;

    const available = player.inventory.getAmount(itemId);
    if (available < amount || amount <= 0) {
      player.variants.sendOnConsoleMessage("`4You don't have enough of that item.``");
      return false;
    }

    const itemMeta = getItem(itemId);
    if ((itemMeta?.flags ?? 0) & BlockFlags.UNTRADEABLE) {
      player.variants.sendOnConsoleMessage("`4That item is untradeable.``");
      return false;
    }

    const myItems = session.getItems(player);
    if (myItems.size >= 4 && !myItems.has(itemId)) {
      player.variants.sendOnConsoleMessage("`4You can only offer up to 4 different items in a trade.``");
      return false;
    }

    myItems.set(itemId, amount);
    session.resetLock();
    session.syncDialogs();
    return true;
  }

  public clearItems(player: Player): void {
    const session = this.activeSessions.get(player.playerId);
    if (!session || session.isLocked(player)) return;

    session.getItems(player).clear();
    session.resetLock();
    session.syncDialogs();
  }

  public lock(player: Player): void {
    const session = this.activeSessions.get(player.playerId);
    if (!session) return;

    if (player.playerId === session.player1.playerId) session.locked1 = true;
    else session.locked2 = true;

    session.syncDialogs();
  }

  public unlock(player: Player): void {
    const session = this.activeSessions.get(player.playerId);
    if (!session) return;

    session.resetLock();
    session.syncDialogs();
  }

  public async acceptTrade(player: Player): Promise<boolean> {
    const session = this.activeSessions.get(player.playerId);
    if (!session || !session.locked1 || !session.locked2) return false;

    if (player.playerId === session.player1.playerId) session.accepted1 = true;
    else session.accepted2 = true;

    if (!session.accepted1 || !session.accepted2) {
      session.syncDialogs();
      return false;
    }

    // Both accepted: Execute atomic exchange!
    const p1 = session.player1;
    const p2 = session.player2;

    // Verify inventory quantities
    for (const [id, count] of session.items1) {
      if (p1.inventory.getAmount(id) < count) {
        this.cancel(p1, `Trade failed: ${p1.displayName} no longer has the offered items!`);
        return false;
      }
    }
    for (const [id, count] of session.items2) {
      if (p2.inventory.getAmount(id) < count) {
        this.cancel(p2, `Trade failed: ${p2.displayName} no longer has the offered items!`);
        return false;
      }
    }

    // Perform swap atomically
    for (const [id, count] of session.items1) {
      p1.removeItemInven(id, count, true);
      p2.addItemInven(id, count, true);
    }
    for (const [id, count] of session.items2) {
      p2.removeItemInven(id, count, true);
      p1.addItemInven(id, count, true);
    }

    await p1.saveToDatabase();
    await p2.saveToDatabase();

    session.isCompleted = true;
    this.activeSessions.delete(p1.playerId);
    this.activeSessions.delete(p2.playerId);

    const successMsg = "`2Trade completed successfully!\`\`";
    p1.variants.sendOnConsoleMessage(successMsg);
    p2.variants.sendOnConsoleMessage(successMsg);
    p1.sendSfx("audio/trade_success.wav");
    p2.sendSfx("audio/trade_success.wav");

    // Close trade dialogs
    const endDialog = new DialogBuilder().defaultColor().addTextBox("`2Trade Successful! Items exchanged.\`\`").addQuickExit().endDialog("trade_end", "", "Ok").str();
    p1.variants.sendOnDialogRequest(endDialog);
    p2.variants.sendOnDialogRequest(endDialog);
    return true;
  }
}

export const tradeManager = new TradeManager();

// Register Trade Dialog Returns
registerDialog("trade_menu", async (player, action) => {
  const button = action.get("buttonClicked");
  const session = tradeManager.getSession(player);
  if (!session) return;

  if (button === "trade_lock") {
    tradeManager.lock(player);
    return;
  }
  if (button === "trade_unlock") {
    tradeManager.unlock(player);
    return;
  }
  if (button === "trade_clear") {
    tradeManager.clearItems(player);
    return;
  }
  if (button === "trade_accept") {
    await tradeManager.acceptTrade(player);
    return;
  }
  if (button === "trade_add") {
    // Show item picker dialog
    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabel("Select an item to offer:", "big")
      .addSpacer("small");

    const items = player.inventory.items.toArray().filter((it) => it.id > 0 && it.amount > 0 && !((getItem(it.id)?.flags ?? 0) & BlockFlags.UNTRADEABLE));

    if (items.length === 0) {
      dialog.addTextBox("`oYou have no tradeable items in your backpack.``");
    } else {
      for (const item of items) {
        const itemMeta = getItem(item.id);
        dialog.addButton(`item_${item.id}`, `\`w${itemMeta?.name ?? item.id} (Have: ${item.amount})\`\``);
      }
    }
    dialog.addSpacer("small").endDialog("trade_item_picker", "Back", "Select");
    player.variants.sendOnDialogRequest(dialog.str());
    return;
  }

  // Cancel or dialog closed
  if (!button || button === "cancel") {
    tradeManager.cancel(player, `${player.displayName} canceled the trade.`);
  }
});

registerDialog("trade_item_picker", (player, action) => {
  const button = action.get("buttonClicked");
  if (!button || !button.startsWith("item_")) {
    // Back to trade menu
    const session = tradeManager.getSession(player);
    if (session) player.variants.sendOnDialogRequest(session.buildDialog(player));
    return;
  }

  const itemId = Number.parseInt(button.replace("item_", ""), 10);
  const max = player.inventory.getAmount(itemId);
  const itemMeta = getItem(itemId);

  const dialog = new DialogBuilder()
    .defaultColor()
    .addLabelWithIcon(`Offer ${itemMeta?.name ?? itemId}`, itemId, "big")
    .addInputBox("trade_amount", "Amount", String(Math.min(max, 1)), 5)
    .addSmallText(`You have ${max} available.`)
    .embed("offer_item_id", itemId)
    .endDialog("trade_amount_confirm", "Cancel", "Offer")
    .str();

  player.variants.sendOnDialogRequest(dialog);
});

registerDialog("trade_amount_confirm", (player, action) => {
  const itemId = action.getInt("offer_item_id", 0, 0);
  const rawAmount = action.get("trade_amount").trim();
  const amount = Number.parseInt(rawAmount, 10);

  if (itemId > 0 && !Number.isNaN(amount) && amount > 0) {
    tradeManager.addItem(player, itemId, amount);
  } else {
    const session = tradeManager.getSession(player);
    if (session) player.variants.sendOnDialogRequest(session.buildDialog(player));
  }
});

registerDialog("trade_end", () => {});
