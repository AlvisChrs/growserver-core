import { Tile } from "../tile";
import type { Player } from "../../player";
import type { World } from "../world";
import type { TileData } from "../types";
import { TileExtraTypes, TileFlags } from "../constants";
import { TANK_PACKET_TYPE } from "../../../constants";
import { GameUpdatePacket } from "../../packets/game-packet";
import { Variant } from "../../packets/variants";
import type { ExtendBuffer } from "../../../utils/extend-buffer";
import { DialogBuilder } from "../../../utils/dialog-builder";
import { registerDialog, tileFromDialog } from "../../network/dialog-handler";

/**
 * Villain Portraits awarded when defeating a Crime In Progress or Criminal Mastermind.
 */
export const VILLAIN_PORTRAITS: readonly number[] = [
  2344, // The Firebug
  2346, // Jimmy Snow
  2348, // Big Bertha
  2350, // Shockinator
  2352, // Generic Thug #17
  2354, // Kat 5
  2356, // Professor Pummel
  2358, // Dragon Hand
  2360, // Dr. Destructo
  2362, // Ms. Terry
  2364, // Z. Everett Koop
];

export interface VillainInfo {
  name: string;
  portrait: number;
  element: "fire" | "ice" | "muscle" | "lightning";
  maxHp: number;
  taunt: string;
}

/** Masterminds (tier encountered on Criminal Mastermind #12276). */
export const MASTERMIND_VILLAINS: readonly VillainInfo[] = [
  { name: "Professor Pummel", portrait: 2356, element: "muscle", maxHp: 10, taunt: "You're no match for my raw brute power!" },
  { name: "Generic Thug #17", portrait: 2352, element: "fire", maxHp: 10, taunt: "Out of my way, cape! I'm burning this town down!" },
  { name: "Kat 5", portrait: 2354, element: "lightning", maxHp: 10, taunt: "Feel the electrical surge of category 5!" },
  { name: "Dragon Hand", portrait: 2358, element: "ice", maxHp: 10, taunt: "My icy grip will freeze you in your tracks!" },
  { name: "Dr. Destructo", portrait: 2360, element: "fire", maxHp: 12, taunt: "Tremble before my master plan of total destruction!" },
];

/** Standard villains (tier encountered on Crime In Progress #2302). */
export const REGULAR_VILLAINS: readonly VillainInfo[] = [
  { name: "The Firebug", portrait: 2344, element: "fire", maxHp: 8, taunt: "Everything looks better in flames!" },
  { name: "Jimmy Snow", portrait: 2346, element: "ice", maxHp: 8, taunt: "Stay frosty, hero!" },
  { name: "Big Bertha", portrait: 2348, element: "muscle", maxHp: 8, taunt: "I crush heroes for breakfast!" },
  { name: "Shockinator", portrait: 2350, element: "lightning", maxHp: 8, taunt: "100,000 volts straight to your heart!" },
];

/** Elemental Superpower Cards table. */
export const SUPERPOWER_CARDS: Record<number, { element: "fire" | "ice" | "muscle" | "lightning"; name: string }> = {
  // Fire cards (beats Muscle, weak to Ice)
  2292: { element: "fire", name: "Heat Vision" },
  2294: { element: "fire", name: "Incinerate" },
  2296: { element: "fire", name: "Flame On!" },
  2300: { element: "fire", name: "Overheat" },
  2304: { element: "fire", name: "Death Ray" },
  // Ice cards (beats Fire, weak to Lightning)
  2308: { element: "ice", name: "Ice Shards" },
  2310: { element: "ice", name: "Frost Breath" },
  2312: { element: "ice", name: "Ice Barrier" },
  2314: { element: "ice", name: "Puddle" },
  2316: { element: "ice", name: "Frozen Mirror" },
  // Muscle cards (beats Lightning, weak to Fire)
  2320: { element: "muscle", name: "Super Strength" },
  2322: { element: "muscle", name: "Super Speed" },
  2324: { element: "muscle", name: "Enrage" },
  2326: { element: "muscle", name: "Crush" },
  2328: { element: "muscle", name: "Regeneration" },
  // Lightning cards (beats Ice, weak to Muscle)
  2332: { element: "lightning", name: "Shocking Fist" },
  2334: { element: "lightning", name: "Thunderstorm" },
  2336: { element: "lightning", name: "Overcharge" },
  2338: { element: "lightning", name: "Megawatt Pulse" },
  2340: { element: "lightning", name: "Resuscitate" },
};

/** Deterministically identifies the villain at a specific coordinate. */
export function getVillainAt(blockId: number, x: number, y: number): VillainInfo {
  const isMastermind = blockId === 12276;
  const list = isMastermind ? MASTERMIND_VILLAINS : REGULAR_VILLAINS;
  const index = Math.abs(x * 73 + y * 37) % list.length;
  return list[index] ?? list[0]!;
}

/** Check if attacker element counters target element. */
export function isCounterElement(attacker: string, target: string): boolean {
  return (
    (attacker === "fire" && target === "muscle") ||
    (attacker === "muscle" && target === "lightning") ||
    (attacker === "lightning" && target === "ice") ||
    (attacker === "ice" && target === "fire")
  );
}

/**
 * Builds and sends the interactive Crimefighting Battle Dialog.
 */
export function sendCrimeBattleDialog(
  player: Player,
  world: World,
  tileX: number,
  tileY: number,
  blockId: number,
  damage: number,
  lastActionMessage?: string,
): void {
  const villain = getVillainAt(blockId, tileX, tileY);
  const currentHp = Math.max(0, villain.maxHp - damage);
  const isMastermind = blockId === 12276;
  const tierName = isMastermind ? "CRIMINAL MASTERMIND" : "CRIME IN PROGRESS";

  const elementIcon =
    villain.element === "fire"
      ? "🔥 FIRE"
      : villain.element === "ice"
        ? "❄️ ICE"
        : villain.element === "muscle"
          ? "💪 MUSCLE"
          : "⚡ LIGHTNING";

  const weakness =
    villain.element === "fire"
      ? "❄️ ICE"
      : villain.element === "ice"
        ? "⚡ LIGHTNING"
        : villain.element === "muscle"
          ? "🔥 FIRE"
          : "💪 MUSCLE";

  const hpBar = "█".repeat(Math.max(0, currentHp)) + "░".repeat(Math.max(0, villain.maxHp - currentHp));

  const dialog = new DialogBuilder()
    .defaultColor()
    .embed("tilex", tileX)
    .embed("tiley", tileY)
    .addLabelWithIcon(`\`4${villain.name}\`\``, villain.portrait, "big")
    .addSpacer("small")
    .addSmallText(`\`oTier: \`w[${tierName}]\`\` | Element: \`w${elementIcon}\`\``)
    .addSmallText(`\`oHealth: \`4[${hpBar}] \`w(${currentHp}/${villain.maxHp} HP)\`\``)
    .addSmallText(`\`eElemental Weakness: \`2${weakness} \`o(Deals 3x Critical Damage!)\`\``)
    .addSpacer("small")
    .addTextBox(`"${villain.taunt}"`)
    .addSpacer("small");

  if (lastActionMessage) {
    dialog.addSmallText(`\`3${lastActionMessage}\`\``);
    dialog.addSpacer("small");
  }

  // Melee Strike
  dialog.addButton("crime_strike", "🤜 Heroic Strike (Melee)");
  dialog.addSpacer("small");

  // Check for Superpower Cards in backpack
  const availableCards: { id: number; name: string; element: string; count: number }[] = [];
  for (const [idStr, info] of Object.entries(SUPERPOWER_CARDS)) {
    const cardId = Number(idStr);
    const count = player.inventory.getAmount(cardId);
    if (count > 0) {
      availableCards.push({ id: cardId, name: info.name, element: info.element, count });
    }
  }

  if (availableCards.length > 0) {
    dialog.addSmallText("`#Select Superpower Card to Play:``");
    for (const card of availableCards) {
      const elUpper = card.element.toUpperCase();
      const isCounter = isCounterElement(card.element, villain.element);
      const label = isCounter ? `\`2★ ${card.name} (${elUpper})\`\`` : `\`$${card.name} (${elUpper})\`\``;
      dialog.addButtonWithIcon(`crime_card_${card.id}`, card.id, label, "left", card.count);
    }
  } else {
    dialog.addSmallText("`4No Superpower Cards in backpack! Use /criminal to obtain cards or use Heroic Strike!``");
  }

  dialog.addSpacer("small");
  dialog.addButton("crime_flee", "Flee Battle");
  dialog.addQuickExit();
  dialog.endDialog("crime_battle", "", "Ok");

  player.variants.sendOnDialogRequest(dialog.str());
}

/**
 * Burglar / Crime In Progress (#2302) and Criminal Mastermind (#12276) combat tile.
 * Supports both direct punch melee combat and strategic turn-based card battle dialogs.
 */
export class BurglarTile extends Tile {
  public extraType = TileExtraTypes.BURGLAR;

  public constructor(world: World, data: TileData) {
    super(world, data);
  }

  public override async onWrench(player: Player): Promise<boolean> {
    if (this.data.fg !== 2302 && this.data.fg !== 12276) return true;
    sendCrimeBattleDialog(player, this.world, this.data.x, this.data.y, this.data.fg, this.data.damage ?? 0);
    return true;
  }

  public override async onPunch(player: Player): Promise<boolean> {
    if (this.data.fg !== 2302 && this.data.fg !== 12276) return true;

    const villain = getVillainAt(this.data.fg, this.data.x, this.data.y);

    // Audio and visual strike effects
    this.world.playPositioned("audio/hitman.wav", player.netID);
    this.world.broadcastVariant(Variant.from("OnParticleEffect", 34, [this.data.x * 32 + 16, this.data.y * 32 + 16]));

    // Superheroes and Katana wielders deal extra melee damage
    const isHero = player.playMods.has("hero_suit") || player.playMods.has("transformed");
    const isKatana =
      player.inventory.clothes.hand === 2592 ||
      player.inventory.clothes.hand === 9058 ||
      player.inventory.clothes.hand === 11118 ||
      player.inventory.clothes.hand === 13710 ||
      player.inventory.clothes.hand === 16428;

    let hitDamage = isHero || isKatana ? 2 : 1;

    // Check if player holds a Superpower Card in hand when punching
    const heldId = player.inventory.clothes.hand;
    const cardInfo = SUPERPOWER_CARDS[heldId];
    if (cardInfo && player.inventory.hasItem(heldId)) {
      player.removeItemInven(heldId, 1, true);
      if (isCounterElement(cardInfo.element, villain.element)) {
        hitDamage = 3;
        player.sendTextBubble("`2CRITICAL ELEMENTAL COUNTER! -3 HP``", true);
      } else {
        hitDamage = 2;
        player.sendTextBubble(`\`3${cardInfo.name} attack! -2 HP\`\``, true);
      }
    }

    this.data.damage = (this.data.damage ?? 0) + hitDamage;
    const remainingHp = Math.max(0, villain.maxHp - this.data.damage);

    if (this.data.damage >= villain.maxHp) {
      await this.onDestroy(player);
    } else {
      player.sendTextBubble(`\`4${villain.name}: ${remainingHp}/${villain.maxHp} HP\`\``, true);
      player.variants.sendOnConsoleMessage(`\`4[Combat]: Hit \`w${villain.name}\`4 for \`2${hitDamage} damage\`4! (${remainingHp}/${villain.maxHp} HP remaining)`);
      this.world.broadcast(
        GameUpdatePacket.create({
          type: TANK_PACKET_TYPE.TILE_APPLY_DAMAGE,
          netID: player.netID,
          tileX: this.data.x,
          tileY: this.data.y,
          flags: 0,
        }).parse()!,
      );
    }

    return true;
  }

  public override async onDestroy(player: Player): Promise<void> {
    const tileX = this.data.x;
    const tileY = this.data.y;
    const blockId = this.data.fg;
    const isMastermind = blockId === 12276;
    const villain = getVillainAt(blockId, tileX, tileY);

    this.data.fg = 0;
    this.data.damage = 0;
    this.data.flags &= ~(TileFlags.TILEEXTRA | TileFlags.OPEN);

    // Audio and visual celebrations
    this.world.playPositioned("audio/cheer.wav", player.netID);
    this.world.broadcastVariant(Variant.from("OnParticleEffect", 46, [tileX * 32 + 16, tileY * 32 + 16]));
    this.world.broadcastVariant(
      Variant.from(
        "OnConsoleMessage",
        `\`5[CRIME STOPPED] \`w${player.displayName}\`\` defeated \`4${villain.name}\`\` and saved the day! Justice reigns!`,
      ),
    );
    player.sendTextBubble(`\`5You defeated ${villain.name} and saved the day!\`\``, true);

    // Bounty gems: Masterminds give 1,500-3,000 gems; regular villains give 500-1,500 gems
    const gemsAwarded = isMastermind
      ? Math.floor(Math.random() * 1500) + 1500
      : Math.floor(Math.random() * 1000) + 500;
    player.addGems(gemsAwarded);
    player.variants.sendOnConsoleMessage(`\`2Received \`$${gemsAwarded} gems\`\` for apprehending \`w${villain.name}\`2!`);

    // Reward 1: Specific or random Villain Portrait
    const portraitId = villain.portrait || (VILLAIN_PORTRAITS[Math.floor(Math.random() * VILLAIN_PORTRAITS.length)] ?? 2360);
    if (player.inventory.canAddItem(portraitId)) {
      player.addItemInven(portraitId, 1);
    } else {
      this.world.drop(player, tileX * 32, tileY * 32, portraitId, 1);
    }

    // Reward 2: Random Superpower Card loot
    const cardKeys = Object.keys(SUPERPOWER_CARDS);
    const randomCardId = Number(cardKeys[Math.floor(Math.random() * cardKeys.length)] ?? 2292);
    if (player.inventory.canAddItem(randomCardId)) {
      player.addItemInven(randomCardId, isMastermind ? 3 : 1);
    } else {
      this.world.drop(player, tileX * 32, tileY * 32, randomCardId, isMastermind ? 3 : 1);
    }

    this.world.broadcast(
      GameUpdatePacket.create({
        type: TANK_PACKET_TYPE.TILE_CHANGE_REQUEST,
        netID: player.netID,
        itemID: 0,
        tileX,
        tileY,
      }).parse()!,
    );

    this.tileUpdate();
    this.world.markDirty();
  }

  public override serialize(buffer: ExtendBuffer): void {
    buffer.writeU8(this.extraType);
    buffer.writeU16(0); // name (empty string)
    buffer.writeU32(0); // target item ID
    buffer.writeU8(0);  // progress byte
  }
}

// Dialog return handler for interactive Crimefighting Card Battle
registerDialog("crime_battle", async (player, action) => {
  const button = action.get("buttonClicked") ?? "";
  if (button === "crime_flee" || button === "Cancel" || !button) return;

  const target = tileFromDialog(player, action);
  if (!target) return;
  const { world, block } = target;
  if (block.fg !== 2302 && block.fg !== 12276) return;

  const tileX = action.getInt("tilex", 0, -1);
  const tileY = action.getInt("tiley", 0, -1);
  const villain = getVillainAt(block.fg, tileX, tileY);

  if (button === "crime_strike") {
    // Melee Heroic Strike
    const isHero = player.playMods.has("hero_suit") || player.playMods.has("transformed");
    const hitDamage = isHero ? 2 : 1;
    block.damage = (block.damage ?? 0) + hitDamage;

    world.playPositioned("audio/hitman.wav", player.netID);
    world.broadcastVariant(Variant.from("OnParticleEffect", 34, [tileX * 32 + 16, tileY * 32 + 16]));

    if (block.damage >= villain.maxHp) {
      const tile = new BurglarTile(world, block);
      await tile.onDestroy(player);
    } else {
      const msg = `You struck ${villain.name} for ${hitDamage} damage! The villain retaliates!`;
      sendCrimeBattleDialog(player, world, tileX, tileY, block.fg, block.damage, msg);
    }
    return;
  }

  if (button.startsWith("crime_card_")) {
    const cardId = Number(button.replace("crime_card_", ""));
    const cardInfo = SUPERPOWER_CARDS[cardId];
    if (!cardInfo || !player.inventory.hasItem(cardId)) {
      player.sendTextBubble("You don't have that card!", true);
      sendCrimeBattleDialog(player, world, tileX, tileY, block.fg, block.damage ?? 0, "Card is missing from backpack!");
      return;
    }

    // Consume the played card
    player.removeItemInven(cardId, 1, true);

    const isCounter = isCounterElement(cardInfo.element, villain.element);
    const damageDealt = isCounter ? 3 : 1;
    block.damage = (block.damage ?? 0) + damageDealt;

    world.playPositioned("audio/hitman.wav", player.netID);
    world.broadcastVariant(Variant.from("OnParticleEffect", isCounter ? 46 : 34, [tileX * 32 + 16, tileY * 32 + 16]));

    if (block.damage >= villain.maxHp) {
      const tile = new BurglarTile(world, block);
      await tile.onDestroy(player);
    } else {
      const msg = isCounter
        ? `CRITICAL COUNTER! ${cardInfo.name} (${cardInfo.element.toUpperCase()}) dealt 3 damage against ${villain.element.toUpperCase()}!`
        : `Your ${cardInfo.name} dealt 1 damage! ${villain.name} snickers at your weak move!`;
      sendCrimeBattleDialog(player, world, tileX, tileY, block.fg, block.damage, msg);
    }
  }
});
