import { DialogBuilder } from "../../utils/dialog-builder";
import { logger } from "../../utils/logger";
import { getItem } from "../item/item-utils";
import { Variant } from "../packets/variants";
import type { Player } from "../player";
import { registerDialog } from "../network/dialog-handler";

/** The 13 legendary Carnival Rings awarded by The Ringmaster. */
export const CARNIVAL_RINGS: readonly number[] = [
  1874, // Ring Of Force
  1876, // Ring Of Winds
  1904, // The One Ring
  1932, // Fistful Of Rings
  1986, // Gemini Ring
  1996, // Ring of Wisdom
  2970, // Ring Of Water
  3140, // Ring Of Savings
  3174, // Ring Of Smithing
  6028, // Ring Of Shrinking
  6846, // Ring of Nature
  8962, // Ring of Night
  11094, // Ring of Range
];

export interface RingmasterTrial {
  step: number;
  title: string;
  desc: string;
  itemId: number;
  itemCount: number;
  gemCost: number;
}

export const RINGMASTER_TRIALS: readonly RingmasterTrial[] = [
  { step: 1, title: "Trial 1: The Foundation", desc: "Bring 200 Dirt to strengthen the circus grounds.", itemId: 2, itemCount: 200, gemCost: 500 },
  { step: 2, title: "Trial 2: Timber Works", desc: "Bring 100 Wood Blocks to build spectator stands.", itemId: 8, itemCount: 100, gemCost: 1000 },
  { step: 3, title: "Trial 3: Fresh Greens", desc: "Bring 50 Grass Seeds to decorate the ring.", itemId: 3, itemCount: 50, gemCost: 1500 },
  { step: 4, title: "Trial 4: Ring of Fire", desc: "Bring 20 Lava Seeds for the fire breathing stunt.", itemId: 5, itemCount: 20, gemCost: 2000 },
  { step: 5, title: "Trial 5: Golden Entry", desc: "Bring 5 Golden Tickets for the mid-show raffle.", itemId: 1898, itemCount: 5, gemCost: 2500 },
  { step: 6, title: "Trial 6: Secret Passages", desc: "Bring 30 Door Seeds for the hall of mirrors.", itemId: 7, itemCount: 30, gemCost: 3000 },
  { step: 7, title: "Trial 7: Floral Display", desc: "Bring 25 Rose Seeds for the acrobats' welcome.", itemId: 45, itemCount: 25, gemCost: 3500 },
  { step: 8, title: "Trial 8: Guiding Lights", desc: "Bring 20 Sign Seeds for the midway directions.", itemId: 13, itemCount: 20, gemCost: 4000 },
  { step: 9, title: "Trial 9: Carny Delicacy", desc: "Bring 10 Magic Bacon to feed the performers.", itemId: 1442, itemCount: 10, gemCost: 4500 },
  { step: 10, title: "Trial 10: The Grand Finale", desc: "Bring 10 Golden Tickets to summon the Carnival spirits!", itemId: 1898, itemCount: 10, gemCost: 5000 },
];

/**
 * Grants a random legendary Carnival Ring to the player.
 * Prioritizes rings the player does not have yet.
 */
export function grantCarnivalRing(player: Player): number {
  const missingRings = CARNIVAL_RINGS.filter((id) => !player.inventory.hasItem(id));
  const pool = missingRings.length > 0 ? missingRings : CARNIVAL_RINGS;
  const ringId = pool[Math.floor(Math.random() * pool.length)] ?? CARNIVAL_RINGS[0];

  player.addItemInven(ringId, 1);
  const ringName = getItem(ringId)?.name ?? `Ring #${ringId}`;
  const world = player.world;

  if (world) {
    world.broadcastVariant(Variant.from("OnParticleEffect", 44, [player.state.x + 10, player.state.y + 16]));
    world.broadcastVariant(Variant.from("OnTalkBubble", player.netID, `\`5[RINGMASTER]\`\` I earned the \`#${ringName}\`\`!`, 0, 0));
    world.broadcastVariant(
      Variant.from("OnConsoleMessage", `\`5[CARNIVAL]\`\` \`w${player.tankIDName}\`\` completed all 10 Ringmaster Trials and was awarded \`#${ringName}\`\`!`),
    );
    world.playPositioned("audio/success.wav", player.netID);
  }

  logger.info({ player: player.tankIDName, ringId, ringName }, "ringmaster granted carnival ring");
  return ringId;
}

/**
 * Delivers the current Ringmaster trial requirements.
 */
export function deliverRingmasterStep(player: Player, useGems = false): boolean {
  const currentStep = player.quests.ringmasterStep;
  if (currentStep <= 0 || currentStep > 10) return false;

  const trial = RINGMASTER_TRIALS[currentStep - 1];
  if (!trial) return false;

  const itemName = getItem(trial.itemId)?.name ?? `item #${trial.itemId}`;

  if (useGems) {
    if (player.currentGems < trial.gemCost) {
      player.sendTextBubble(`You need \`w${trial.gemCost}\`\` gems to buy out this trial.`, true);
      return false;
    }
    player.removeGems(trial.gemCost);
  } else {
    const count = player.inventory.getAmount(trial.itemId);
    if (count < trial.itemCount) {
      player.sendTextBubble(`You need \`w${trial.itemCount} ${itemName}\`\` (you have ${count}).`, true);
      return false;
    }
    player.removeItemInven(trial.itemId, trial.itemCount);
  }

  if (currentStep >= 10) {
    // Completed all 10 trials!
    grantCarnivalRing(player);
    player.quests.incrementRingmasterCompleted();
    player.sendTextBubble("`5[RINGMASTER] Astonishing! You conquered all 10 Carnival Trials! Take your Ring!``", true);
  } else {
    // Advance to next trial
    player.quests.ringmasterStep = currentStep + 1;
    player.sendTextBubble(`\`5[RINGMASTER] Trial ${currentStep} completed! Ready for Trial ${currentStep + 1}?\`\``, true);
    player.variants.sendOnConsoleMessage(`\`5[RINGMASTER]\`\` Completed \`2${trial.title}\`\`!`);
  }

  return true;
}

/**
 * Builds the Ringmaster conversation / quest dialog.
 */
export function ringmasterDialog(player: Player, tileX = 0, tileY = 0): string {
  const step = player.quests.ringmasterStep;
  const completedCount = player.quests.ringmasterCompletedCount;

  const dialog = new DialogBuilder()
    .defaultColor()
    .embed("tileX", tileX)
    .embed("tileY", tileY)
    .embed("netID", player.netID)
    .addLabelWithIcon("`5The Ringmaster's Big Top``", 1900, "big")
    .addSpacer("small");

  if (step === 0) {
    dialog
      .addTextBox("`oRoll up, roll up! Welcome to the greatest show in Growtopia!``")
      .addTextBox("`wI am The Ringmaster! Complete my 10 Carnival Trials, and I shall bestow upon you a legendary \`#Carnival Ring\`\`!``")
      .addSpacer("small");

    if (completedCount > 0) {
      dialog.addSmallText(`\`2You have previously conquered the Carnival \`w${completedCount}\`\` time(s)!`);
    }

    dialog
      .addSmallText("`oStarting the 10 Trials requires \`w10 Golden Tickets\`\` (or \`w1,000 Gems\`\`).")
      .addSpacer("small")
      .addButton("ringmaster_start_tickets", "`2Begin Trials (10 Golden Tickets)``")
      .addButton("ringmaster_start_gems", "`3Begin Trials (1,000 Gems)``");
  } else {
    const trial = RINGMASTER_TRIALS[step - 1];
    const itemName = getItem(trial.itemId)?.name ?? `item #${trial.itemId}`;
    const playerHas = player.inventory.getAmount(trial.itemId);

    dialog
      .addTextBox(`\`5${trial.title} \`o(Step ${step}/10)\`\``)
      .addTextBox(`\`w${trial.desc}\`\``)
      .addSpacer("small")
      .addSmallText(`\`oRequired: \`w${trial.itemCount} ${itemName}\`\` | In Backpack: \`w${playerHas}\`\``)
      .addSmallText(`\`oAlternative: Buyout for \`w${trial.gemCost} Gems\`\` (You have: \`w${player.currentGems}\`\`)`)
      .addSpacer("small");

    if (playerHas >= trial.itemCount) {
      dialog.addButton("ringmaster_deliver", `\`2Deliver ${trial.itemCount} ${itemName}\`\``);
    } else {
      dialog.addSmallText(`\`4You still need \`w${trial.itemCount - playerHas} more ${itemName}\`4 to deliver.\`\``);
    }

    if (player.currentGems >= trial.gemCost) {
      dialog.addButton("ringmaster_buyout", `\`3Pay ${trial.gemCost} Gems to Pass\`\``);
    }
  }

  // Developer testing shortcuts
  if (player.isDeveloper) {
    dialog
      .addSpacer("small")
      .addTextBox("`4[Staff / Developer Controls]``")
      .addButton("ringmaster_dev_advance", "`4[Dev] Instant Advance Trial``")
      .addButton("ringmaster_dev_ring", "`4[Dev] Grant Random Ring``")
      .addButton("ringmaster_dev_reset", "`4[Dev] Reset Trials``");
  }

  dialog.addQuickExit().endDialog("ringmaster_quest", "", "Close");
  return dialog.str();
}

// Dialog return handler
registerDialog("ringmaster_quest", async (player, action) => {
  const button = action.get("buttonClicked") ?? "";
  const tileX = Number.parseInt(action.get("tileX") ?? "0", 10);
  const tileY = Number.parseInt(action.get("tileY") ?? "0", 10);

  if (button === "ringmaster_start_tickets") {
    if (player.inventory.getAmount(1898) < 10) {
      player.sendTextBubble("You need 10 Golden Tickets to begin the trials!", true);
      return;
    }
    player.removeItemInven(1898, 10);
    player.quests.ringmasterStep = 1;
    player.variants.sendOnDialogRequest(ringmasterDialog(player, tileX, tileY));
    return;
  }

  if (button === "ringmaster_start_gems") {
    if (player.currentGems < 1000) {
      player.sendTextBubble("You need 1,000 gems to begin the trials!", true);
      return;
    }
    player.removeGems(1000);
    player.quests.ringmasterStep = 1;
    player.variants.sendOnDialogRequest(ringmasterDialog(player, tileX, tileY));
    return;
  }

  if (button === "ringmaster_deliver") {
    deliverRingmasterStep(player, false);
    player.variants.sendOnDialogRequest(ringmasterDialog(player, tileX, tileY));
    return;
  }

  if (button === "ringmaster_buyout") {
    deliverRingmasterStep(player, true);
    player.variants.sendOnDialogRequest(ringmasterDialog(player, tileX, tileY));
    return;
  }

  // Developer actions
  if (player.isDeveloper) {
    if (button === "ringmaster_dev_advance") {
      const step = player.quests.ringmasterStep;
      if (step < 10) {
        player.quests.ringmasterStep = step + 1;
        player.variants.sendOnConsoleMessage(`\`2[DEV] Advanced Ringmaster trial to step ${step + 1}.\`\``);
      } else {
        grantCarnivalRing(player);
        player.quests.incrementRingmasterCompleted();
      }
      player.variants.sendOnDialogRequest(ringmasterDialog(player, tileX, tileY));
      return;
    }

    if (button === "ringmaster_dev_ring") {
      grantCarnivalRing(player);
      player.variants.sendOnDialogRequest(ringmasterDialog(player, tileX, tileY));
      return;
    }

    if (button === "ringmaster_dev_reset") {
      player.quests.ringmasterStep = 0;
      player.variants.sendOnConsoleMessage("`2[DEV] Reset Ringmaster trials to 0.`");
      player.variants.sendOnDialogRequest(ringmasterDialog(player, tileX, tileY));
      return;
    }
  }
});
