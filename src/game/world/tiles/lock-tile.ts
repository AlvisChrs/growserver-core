import type { ItemDefinition } from "grow-items";
import type { ExtendBuffer } from "../../../utils/extend-buffer";
import { DialogBuilder } from "../../../utils/dialog-builder";
import { PlayerDB } from "../../../database/services/player-db";
import { getItem } from "../../item/item-utils";
import type { Player } from "../../player";
import { Tile } from "../tile";
import { FloodFill } from "../flood-fill";
import { tileFrom, tileUpdateMultiple } from "./index";
import { ITEM_ID, LockPermission, LOCKS, TileExtraTypes, TileFlags, WORLD_DATA_VERSION, isAreaLock, isWorldLockItem, isRoyalLock } from "../constants";

/** One entry of `LOCKS`: an area lock and how many tiles it may own. */
type AreaLockMeta = (typeof LOCKS)[number];

/** Sound played when a lock is applied. */
const USE_LOCK_SOUND = "audio/use_lock.wav";

/** Bits of the settings byte in a lock's extra data. */
const enum LockSettings {
  IGNORE_EMPTY_AIR = 1 << 0,
  ALLOW_MUSIC = 1 << 1,
  ROYAL_RAINBOWS = 1 << 2,
  SILENCE_PEASANTS = 1 << 3,
  DISABLE_MUSIC = 1 << 4,
  INVISIBLE_MUSIC = 1 << 5,
  BUILD_ONLY = 1 << 6,
  ADMINS_LIMITED = 1 << 7,
}

/**
 * Area locks (small, big, huge, builder's) and the world lock.
 * Extra data: u8 type, u8 0, u32 owner, u32 admin count, u32 per admin, 8 zero bytes.
 */
export class LockTile extends Tile {
  public extraType = TileExtraTypes.LOCK;

  public override async onPlaceForeground(player: Player, itemMeta: ItemDefinition): Promise<boolean> {
    if (!player.inventory.hasItem(itemMeta.id ?? 0)) return false;
    if (!(await this.world.hasTilePermission(player, this.data, LockPermission.BUILD))) {
      await this.onPlaceFail(player);
      return false;
    }

    const worldOwnerId = this.world.getOwnerPlayerId();
    const areaLock = LOCKS.find((l) => l.id === itemMeta.id);

    if (worldOwnerId !== undefined) {
      if (worldOwnerId !== player.playerId && !player.isDeveloper) {
        await this.notifyNoLocksAllowed(player);
        return false;
      } else if (!areaLock) {
        this.notifyOnlyOneWorldLock(player, itemMeta.name ?? "World Lock");
        return false;
      }
    } else if (this.data.lockedBy) {
      const owningLock = this.world.getTileAt(this.data.lockedBy.parentX, this.data.lockedBy.parentY);
      if (owningLock?.lock?.ownerPlayerId !== player.playerId && !player.isDeveloper) {
        await this.notifyNoLocksAllowed(player);
        return false;
      }
    }

    if (this.data.x === 0 && this.data.y === 0) {
      player.sendTextBubble("You can't use a lock here. Don't ask why. [JOURNEYS.]", false);
      return false;
    }

    // a world lock cannot coexist with other players' area locks
    const othersAreaLock = this.world.data.blocks.find((tile) => tile.lock && tile.lock.ownerPlayerId !== player.playerId);
    if (othersAreaLock && !areaLock && !player.isDeveloper) {
      player.sendTextBubble(`Your \`$${itemMeta.name}\`\` can't be placed in this world unless everyone else's locks are removed.`, false);
      return false;
    }

    if (!(await super.onPlaceForeground(player, itemMeta))) return false;
    this.data.flags |= TileFlags.TILEEXTRA;

    if (areaLock) {
      this.handleAreaLock(player, areaLock);
    } else {
      await this.handleWorldLock(player, itemMeta);
    }

    this.world.playPositioned(USE_LOCK_SOUND, player.netID);
    return true;
  }

  public override async onDestroy(player: Player): Promise<void> {
    const itemMeta = getItem(this.data.fg);
    const lockName = itemMeta?.name ?? "World Lock";
    const removedWorldLock = !!this.data.worldLockData || isWorldLockItem(this.data.fg);
    const originalOwner = this.data.lock?.ownerPlayerId;
    await super.onDestroy(player);

    // A home world must not silently point at a world the player no longer owns.
    if (removedWorldLock && originalOwner === player.playerId && player.homeWorld === this.world.name) {
      player.setHomeWorld(null);
    }

    if (this.data.worldLockData || this.world.data.worldLockIndex === this.index) {
      this.notifyWorldLockRemove(lockName);
      delete this.world.data.worldLockIndex;
      delete this.data.worldLockData;
    } else if (this.data.lock) {
      const released: Tile[] = [];
      for (const index of this.data.lock.ownedTiles) {
        const tile = this.world.getTileByIndex(index);
        if (!tile?.lockedBy || tile.lockedBy.parentX !== this.data.x || tile.lockedBy.parentY !== this.data.y) continue;

        delete tile.lockedBy;
        tile.flags &= ~TileFlags.LOCKED;
        released.push(tileFrom(this.world, tile));
      }

      if (released.length > 0) tileUpdateMultiple(this.world, released);
    }

    delete this.data.lock;
    this.world.refreshNameColors();
  }

  public override async onPunchFail(player: Player): Promise<void> {
    await super.onPunchFail(player);
    if (!this.data.lock) return;

    const itemMeta = getItem(this.data.fg);
    const owner = await PlayerDB.getById(this.data.lock.ownerPlayerId);

    let accessStatus = "`4No Access``";
    if (this.data.lock.adminIds.includes(player.playerId)) {
      accessStatus = this.data.worldLockData ? "`2Access Granted``" : "Access Granted";
    } else if (this.data.flags & TileFlags.PUBLIC) {
      accessStatus = "Open To Public";
    }

    player.sendTextBubble(`${owner?.display_name ?? owner?.name}'s \`o${itemMeta?.name}\`\`. (${accessStatus})`, true);
  }

  public override async onWrench(player: Player): Promise<boolean> {
    const itemMeta = getItem(this.data.fg);
    if (!itemMeta) return false;

    if (!(await super.onWrench(player))) {
      // admins may only revoke their own access
      if (this.data.lock?.adminIds.includes(player.playerId)) {
        const owner = await PlayerDB.getById(this.data.lock.ownerPlayerId);
        const dialog = new DialogBuilder()
          .defaultColor("`o")
          .addLabelWithIcon(`\`wEdit ${itemMeta.name}\`\``, itemMeta.id ?? 0, "big")
          .embed("tilex", this.data.x)
          .embed("tiley", this.data.y)
          .addLabel(`This lock is owned by ${owner?.display_name ?? owner?.name}, but I have access on it.`)
          .endDialog("revoke_lock_access", "Cancel", "Remove My Access")
          .str();

        player.variants.sendOnDialogRequest(dialog);
        return true;
      }

      player.sendTextBubble("I'm `4unable`` to pick the lock.", true);
      return false;
    }

    const isRoyal = isRoyalLock(itemMeta.id ?? 0);
    const dialogTitle = isRoyal ? `\`wEdit Ye ${itemMeta.name}\`\`` : `\`wEdit ${itemMeta.name}\`\``;

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon(dialogTitle, itemMeta.id ?? 0, "big")
      .embed("tilex", this.data.x)
      .embed("tiley", this.data.y)
      .addLabel("Access list:")
      .addSpacer("small");

    const accessList = this.data.lock?.adminIds ?? [];
    if (accessList.length > 0) {
      for (const adminId of accessList) {
        const admin = await PlayerDB.getById(adminId);
        dialog.addCheckbox(`access_${adminId}`, admin?.display_name ?? admin?.name ?? `#${adminId}`, "selected");
      }
    } else {
      dialog.addTextBox("Currently, you're the only one with access.");
    }

    dialog.addPlayerPicker("playerNetID", "`wAdd``").addCheckbox("allow_break_build", "Allow anyone to Build and Break", this.data.flags & TileFlags.PUBLIC ? "selected" : "not_selected");

    if (!this.data.worldLockData) {
      dialog.addCheckbox("ignore_empty", "Ignore empty air", this.data.lock?.ignoreEmptyAir ? "selected" : "not_selected").addButton("reapply_lock", "`wRe-apply lock``");

      if (itemMeta.id === ITEM_ID.BUILDERS_LOCK) {
        dialog
          .addSmallText('This lock allows Building or Breaking.<CR>(ONLY if "Allow anyone to Build or Break" is checked above)!')
          .addSpacer("small")
          .addSmallText("Leaving this box unchecked only allows Breaking.")
          .addCheckbox("build_only", "Only Allow Building!", this.data.lock && this.data.lock.permission & LockPermission.BUILD ? "selected" : "not_selected")
          .addSmallText("People with lock access can both build and break unless you check below. The lock owner can always build and break.")
          .addCheckbox("limit_admin", "Admins Are Limited", this.data.lock?.adminLimited ? "selected" : "not_selected");
      }
    } else {
      const worldLock = this.data.worldLockData;
      dialog.addCheckbox("disable_music", "Disable Custom Music Blocks", worldLock.customMusicBlocksDisabled ? "selected" : "not_selected");
      if (!worldLock.customMusicBlocksDisabled) {
        dialog.addInputBox("tempo", "Music BPM", worldLock.bpm, 3);
      }
      dialog
        .addCheckbox("invisible_music", "Make Custom Music Block Invisible", worldLock.invisMusicBlocks ? "selected" : "not_selected")
        .addCheckbox("home_world", "Set as Home World", player.homeWorld === this.world.name ? "selected" : "not_selected")
        .addInputBox("minimum_level", "World Level:", worldLock.minLevel, 3)
        .addSmallText("Set minimum world entry level.");

      if (isRoyal) {
        dialog
          .addSpacer("small")
          .addSmallText("`e--- Ye Royal Options ---``")
          .addCheckbox("silence_peasants", "Silence, peasants! (Mute non-admins)", worldLock.silencePeasants ? "selected" : "not_selected")
          .addCheckbox("royal_rainbows", "Rainbows for the King! (Royal shimmer)", worldLock.royalRainbows ? "selected" : "not_selected")
          .addInputBox("royal_decree", "Royal Decree:", worldLock.royalDecree ?? "", 30)
          .addSmallText("Proclamation announced to visitors upon arrival.");
      }

      dialog
        .addButton("session_length", "Set World Timer (NOT IMPLEMENTED)")
        .addButton("set_category", "Category: None (NOT IMPLEMENTED)");
    }

    dialog.endDialog("area_lock_edit", "Cancel", "OK");
    player.variants.sendOnDialogRequest(dialog.str());
    return true;
  }

  /**
   * The settings byte of the lock's extra data; the client draws the
   * builder's lock with its build-only / break-only face from it.
   */
  private settingsFlags(): number {
    const lock = this.data.lock;
    let flags = 0;
    if (lock?.ignoreEmptyAir) flags |= LockSettings.IGNORE_EMPTY_AIR;
    if (this.data.fg === ITEM_ID.BUILDERS_LOCK) {
      if (lock && lock.permission & LockPermission.BUILD) flags |= LockSettings.BUILD_ONLY;
      if (lock?.adminLimited) flags |= LockSettings.ADMINS_LIMITED;
    }
    const worldLock = this.data.worldLockData;
    if (worldLock?.customMusicBlocksDisabled) flags |= LockSettings.DISABLE_MUSIC;
    if (worldLock?.invisMusicBlocks) flags |= LockSettings.INVISIBLE_MUSIC;
    if (isRoyalLock(this.data.fg)) {
      if (worldLock?.royalRainbows) flags |= LockSettings.ROYAL_RAINBOWS;
      if (worldLock?.silencePeasants) flags |= LockSettings.SILENCE_PEASANTS;
    }
    return flags;
  }

  public override serialize(buffer: ExtendBuffer): void {
    const lock = this.data.lock;
    const adminIds = lock?.adminIds ?? [];
    const viewerId = this.viewer?.playerId;
    // the client colors the lock for whoever reads the payload, and it finds
    // the reader in the access list
    const viewerHasAccess = viewerId !== undefined && viewerId !== lock?.ownerPlayerId && adminIds.includes(viewerId);

    buffer.writeU8(this.extraType);
    buffer.writeU8(this.settingsFlags());
    buffer.writeU32(lock?.ownerPlayerId ?? 0);
    // the access list starts with the music tempo, negated, which the
    // client uses to play the world's sheet music
    const bpm = this.data.worldLockData?.bpm ?? this.world.musicBpm;
    buffer.writeU32(adminIds.length + 1);
    buffer.writeI32(-bpm);
    if (viewerHasAccess) buffer.writeU32(viewerId);
    for (const adminId of adminIds) {
      if (viewerHasAccess && adminId === viewerId) continue;
      buffer.writeU32(adminId);
    }
    // newer world formats add two fields after the access list
    if (WORLD_DATA_VERSION >= 0x19) {
      // 5.6x: u8 minimum level, then seven reserved bytes that carry the
      // tempo as the last field
      buffer.writeU8(Math.min(this.data.worldLockData?.minLevel ?? 0, 0xff));
      buffer.writeU8(0);
      buffer.writeU16(0);
      buffer.writeU32(bpm);
    } else {
      if (WORLD_DATA_VERSION > 11) buffer.writeU32(this.data.worldLockData?.minLevel ?? 0);
      if (WORLD_DATA_VERSION > 12) buffer.writeU32(bpm);
    }
  }

  /** Claims the surrounding tiles for a freshly placed area lock. */
  private handleAreaLock(player: Player, lockMeta: AreaLockMeta): void {
    new FloodFill({
      world: this.world,
      lock: this.data,
      maxTiles: lockMeta.maxTiles,
      ignoreEmptyAir: false,
    })
      .exec()
      .apply(this.world, player);

    player.sendTextBubble("Area Locked.", true);
  }

  /** Turns this tile into the world lock and announces it. */
  private async handleWorldLock(player: Player, itemMeta: ItemDefinition): Promise<void> {
    const owner = await PlayerDB.getById(player.playerId);
    const ownerName = owner?.display_name ?? owner?.name ?? player.displayName;

    this.data.lock = {
      ownerPlayerId: player.playerId,
      permission: LockPermission.NONE,
      adminIds: [],
      adminLimited: false,
      ignoreEmptyAir: false,
      ownedTiles: [],
    };

    this.data.worldLockData = {
      bpm: 100,
      customMusicBlocksDisabled: false,
      invisMusicBlocks: false,
      minLevel: 1,
    };

    this.world.data.worldLockIndex = this.index;

    const lockName = itemMeta.name ?? "World Lock";
    const lockAction = lockName.endsWith("Lock") ? `${lockName.slice(0, -4).trim()} Locked` : `${lockName}ed`;
    const message = `\`5[\`w${this.world.name} \`ohas been \`$${lockAction}\`\` by ${ownerName}\`5]`;
    for (const other of this.world.players) {
      other.variants.sendOnTalkBubble(player.netID, message, false);
      other.variants.sendOnConsoleMessage(message);
    }

    // Immediately update world owner name tags to green/royal crown
    this.world.refreshNameColors();
    this.tileUpdate();
  }

  private notifyWorldLockRemove(lockName = "World Lock"): void {
    const message = `\`5[\`\`\`w${this.world.name}\`\` has had its \`$${lockName}\`\` removed!\`5]\`\``;
    for (const other of this.world.players) {
      other.variants.sendOnConsoleMessage(message);
    }
  }

  private notifyOnlyOneWorldLock(player: Player, lockName = "World Lock"): void {
    player.sendTextBubble(`Only one \`$${lockName}\`\` can be placed in a world, you'd have to remove the other one first.`, false);
  }

  private async notifyNoLocksAllowed(player: Player): Promise<void> {
    const ownerName = await this.world.getTileOwnerName(this.data);
    if (!ownerName) return;

    player.sendTextBubble(`\`w${ownerName}\`\` allows public building here, but no locks.`, false);
    this.sendLockSound(player);
  }
}
