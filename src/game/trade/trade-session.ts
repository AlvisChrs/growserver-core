import { Collection } from "../../utils/collection";
import { DialogBuilder } from "../../utils/dialog-builder";
import { getItem } from "../item/item-utils";
import type { Player } from "../player";

/**
 * An active two-player trade session with atomic item offer verification.
 */
export class TradeSession {
  public player1: Player;
  public player2: Player;
  public items1: Collection<number, number> = new Collection(); // itemId -> amount
  public items2: Collection<number, number> = new Collection();
  public locked1 = false;
  public locked2 = false;
  public accepted1 = false;
  public accepted2 = false;
  public isCompleted = false;

  constructor(player1: Player, player2: Player) {
    this.player1 = player1;
    this.player2 = player2;
  }

  public getOther(player: Player): Player {
    return player.playerId === this.player1.playerId ? this.player2 : this.player1;
  }

  public getItems(player: Player): Collection<number, number> {
    return player.playerId === this.player1.playerId ? this.items1 : this.items2;
  }

  public isLocked(player: Player): boolean {
    return player.playerId === this.player1.playerId ? this.locked1 : this.locked2;
  }

  public isAccepted(player: Player): boolean {
    return player.playerId === this.player1.playerId ? this.accepted1 : this.accepted2;
  }

  public resetLock(): void {
    this.locked1 = false;
    this.locked2 = false;
    this.accepted1 = false;
    this.accepted2 = false;
  }

  public buildDialog(viewer: Player): string {
    const isP1 = viewer.playerId === this.player1.playerId;
    const myItems = isP1 ? this.items1 : this.items2;
    const other = isP1 ? this.player2 : this.player1;
    const otherItems = isP1 ? this.items2 : this.items1;
    const myLocked = isP1 ? this.locked1 : this.locked2;
    const otherLocked = isP1 ? this.locked2 : this.locked1;
    const bothLocked = this.locked1 && this.locked2;

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabel(`\`wTrading with ${other.displayName}\`\``, "big")
      .addSpacer("small");

    // My Offer Section
    dialog.addTextBox(`\`wYour Offer ${myLocked ? "(`2LOCKED``)" : "(`4UNLOCKED``)"}:`);
    if (myItems.size === 0) {
      dialog.addSmallText("`oNo items offered yet.``");
    } else {
      for (const [id, count] of myItems) {
        const itemMeta = getItem(id);
        dialog.addLabelWithIcon(`\`w${itemMeta?.name ?? id} x${count}\`\``, id, "small");
      }
    }
    dialog.addSpacer("small");

    // Other's Offer Section
    dialog.addTextBox(`\`w${other.displayName}'s Offer ${otherLocked ? "(`2LOCKED``)" : "(`4UNLOCKED``)"}:`);
    if (otherItems.size === 0) {
      dialog.addSmallText("`oNo items offered yet.``");
    } else {
      for (const [id, count] of otherItems) {
        const itemMeta = getItem(id);
        dialog.addLabelWithIcon(`\`w${itemMeta?.name ?? id} x${count}\`\``, id, "small");
      }
    }
    dialog.addSpacer("small");

    // Action buttons
    if (!myLocked) {
      dialog.addButton("trade_add", "`2+ Add Item``");
      if (myItems.size > 0) dialog.addButton("trade_clear", "`4Clear Offer``");
      dialog.addButton("trade_lock", "`3Lock Offer``");
    } else {
      dialog.addButton("trade_unlock", "`4Unlock Offer``");
    }

    if (bothLocked) {
      dialog.addButton("trade_accept", "`2ACCEPT TRADE!``");
    }

    dialog
      .addSpacer("small")
      .endDialog("trade_menu", "Cancel Trade", bothLocked ? "Accept" : "Refresh");

    return dialog.str();
  }

  public syncDialogs(): void {
    if (this.isCompleted) return;
    this.player1.variants.sendOnDialogRequest(this.buildDialog(this.player1));
    this.player2.variants.sendOnDialogRequest(this.buildDialog(this.player2));
  }
}
