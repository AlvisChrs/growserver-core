import { DialogBuilder } from "../../utils/dialog-builder";
import { getItem } from "../item/item-utils";
import { Variant } from "../packets/variants";
import type { Player } from "../player";
import { registerDialog } from "../network/dialog-handler";

export interface LegendaryQuestDef {
  id: string;
  name: string;
  rewardId: number;
  rewardName: string;
  iconId: number;
  description: string;
  steps: Array<{
    title: string;
    desc: string;
    requiredItemId: number;
    requiredCount: number;
    gemCost: number;
  }>;
}

export const LEGENDARY_QUESTS: readonly LegendaryQuestDef[] = [
  {
    id: "legendary_katana",
    name: "Quest for the Legendary Katana",
    rewardId: 2592,
    rewardName: "Legendary Katana",
    iconId: 2592,
    description: "Forge the legendary crescent blade that can slice through space and time itself!",
    steps: [
      { title: "Step 1: The Raw Steel", desc: "Gather 100 Iron Blocks to begin forging the blade core.", requiredItemId: 278, requiredCount: 100, gemCost: 5000 },
      { title: "Step 2: Ancient Sharpening Stones", desc: "Bring 50 Obsidian blocks to hone the razor-sharp edge.", requiredItemId: 1240, requiredCount: 50, gemCost: 10000 },
      { title: "Step 3: Dragon Breath Tempering", desc: "Bring 20 Dragon Gate seeds to infuse eternal flame.", requiredItemId: 1099, requiredCount: 20, gemCost: 15000 },
      { title: "Step 4: The Thousand Slashes", desc: "Bring 10 Diamond Locks to seal the ancient enchantment.", requiredItemId: 1796, requiredCount: 10, gemCost: 25000 },
    ],
  },
  {
    id: "legendary_dragon",
    name: "Quest for the Legendary Dragon",
    rewardId: 1782,
    rewardName: "Legendary Dragon",
    iconId: 1782,
    description: "Awaken the mythical dragon of antiquity to fly at your side!",
    steps: [
      { title: "Step 1: Nesting Embers", desc: "Provide 200 Lava blocks for the dragon's nest.", requiredItemId: 4, requiredCount: 200, gemCost: 5000 },
      { title: "Step 2: Mythic Food", desc: "Provide 50 Dragon Fruit seeds to nourish the dragon.", requiredItemId: 1097, requiredCount: 50, gemCost: 10000 },
      { title: "Step 3: Fiery Essence", desc: "Provide 25 Fireball items to kindle dragon breath.", requiredItemId: 1088, requiredCount: 25, gemCost: 15000 },
      { title: "Step 4: Crown of Kings", desc: "Offer 10 Diamond Locks to tame the dragon lord.", requiredItemId: 1796, requiredCount: 10, gemCost: 25000 },
    ],
  },
  {
    id: "legendary_wings",
    name: "Quest for the Legendary Wings",
    rewardId: 1784,
    rewardName: "Legendary Wings",
    iconId: 1784,
    description: "Weave the celestial wings of infinite flight and luminous majesty!",
    steps: [
      { title: "Step 1: Cloud Feathers", desc: "Gather 200 Cloud blocks from the highest heavens.", requiredItemId: 154, requiredCount: 200, gemCost: 5000 },
      { title: "Step 2: Angelic Resonance", desc: "Bring 50 Angel Wings seeds to capture celestial grace.", requiredItemId: 597, requiredCount: 50, gemCost: 10000 },
      { title: "Step 3: Prismatic Radiance", desc: "Bring 20 Rainbow blocks to illuminate the plumage.", requiredItemId: 1058, requiredCount: 20, gemCost: 15000 },
      { title: "Step 4: Breath of the Sky", desc: "Offer 10 Diamond Locks to complete the legendary ascension.", requiredItemId: 1796, requiredCount: 10, gemCost: 25000 },
    ],
  },
  {
    id: "legendary_wizard",
    name: "Quest for the Legendary Wizard Robes",
    rewardId: 600,
    rewardName: "Legendary Wizard Robe",
    iconId: 600,
    description: "Attain supreme mastery of the arcane and claim the Wizard's Vestments!",
    steps: [
      { title: "Step 1: Astral Cloth", desc: "Provide 100 Purple Block seeds to weave astral cloth.", requiredItemId: 37, requiredCount: 100, gemCost: 5000 },
      { title: "Step 2: Mystic Runes", desc: "Provide 50 Magic Bell seeds to enchant the weave.", requiredItemId: 1195, requiredCount: 50, gemCost: 10000 },
      { title: "Step 3: Sorcerer's Focus", desc: "Provide 25 Crystal blocks to channel boundless mana.", requiredItemId: 2072, requiredCount: 25, gemCost: 15000 },
      { title: "Step 4: Master's Sigil", desc: "Offer 10 Diamond Locks for the ultimate attunement.", requiredItemId: 1796, requiredCount: 10, gemCost: 25000 },
    ],
  },
];

/** Player active legendary quest state stored in memory. */
const activePlayerQuests = new Map<number, { questId: string; step: number }>();

export function legendaryWizardDialog(player: Player, tileX: number, tileY: number): string {
  const current = activePlayerQuests.get(player.playerId);
  const dialog = new DialogBuilder()
    .defaultColor("`o")
    .embed("tileX", tileX)
    .embed("tileY", tileY)
    .embed("netID", player.netID)
    .addLabelWithIcon("`9The Legendary Wizard's Sanctum``", 1790, "big")
    .addSpacer("small");

  if (!current) {
    dialog.addTextBox("`wGreetings, mortal seeker. I am the Legendary Wizard. Only the boldest champions may embark on the Legendary Quests of antiquity!``")
      .addSpacer("small")
      .addSmallText("`6Select a Legendary Quest to begin your journey:``")
      .addSpacer("small");

    for (const q of LEGENDARY_QUESTS) {
      dialog.addLabelWithIcon(`\`2${q.name}\`\``, q.iconId, "small");
      dialog.addSmallText(`\`o${q.description}\`\``);
      dialog.addButton(`start_${q.id}`, `Begin ${q.name}`);
      dialog.addSpacer("small");
    }
  } else {
    const quest = LEGENDARY_QUESTS.find(q => q.id === current.questId) ?? LEGENDARY_QUESTS[0];
    const totalSteps = quest.steps.length;
    const isCompleted = current.step > totalSteps;

    dialog.addLabelWithIcon(`\`2${quest.name}\`\``, quest.rewardId, "small");

    if (isCompleted) {
      dialog.addTextBox("`2Incredible! You have conquered all trials of the ancient arts! Claim your legendary destiny!``")
        .addSpacer("small")
        .addButton("claim_legendary_reward", `Claim ${quest.rewardName}!`);
    } else {
      const stepIdx = current.step - 1;
      const stepData = quest.steps[stepIdx];
      const itemName = getItem(stepData.requiredItemId)?.name ?? `Item #${stepData.requiredItemId}`;
      const hasItems = player.inventory.getAmount(stepData.requiredItemId) >= stepData.requiredCount;
      const hasGems = player.gems >= stepData.gemCost;

      dialog.addTextBox(`\`wCurrent Progress: Step ${current.step} of ${totalSteps}\`\``)
        .addTextBox(`\`9${stepData.title}\`\``)
        .addSmallText(`\`o${stepData.desc}\`\``)
        .addSpacer("small")
        .addSmallText(`\`6Required: \`w${stepData.requiredCount}x ${itemName} \`o(You have: ${player.inventory.getAmount(stepData.requiredItemId)})`)
        .addSmallText(`\`6Gem Cost: \`w${stepData.gemCost} gems \`o(You have: ${player.gems})`)
        .addSpacer("small");

      if (hasItems && hasGems) {
        dialog.addButton("submit_quest_step", `Deliver Materials & Advance Step ${current.step}`);
      } else {
        dialog.addSmallText("`4You do not have the required materials or gems yet. Return when prepared!``");
      }

      dialog.addSpacer("small");
      dialog.addButton("abandon_quest", "Abandon Quest & Pick Another");
    }
  }

  // Developer shortcut to instantly complete and test
  if (player.isDeveloper) {
    dialog.addSpacer("small");
    dialog.addCustomBreak();
    dialog.addButton("dev_instant_complete_lquest", "[Developer] Instant Complete Current Quest");
  }

  dialog.endDialog("legendary_wizard_end", "Farewell", "OK");
  return dialog.str();
}

registerDialog("legendary_wizard_end", (player, action) => {
  const button = action.get("buttonClicked");

  if (button.startsWith("start_")) {
    const qid = button.replace("start_", "");
    const qdef = LEGENDARY_QUESTS.find(q => q.id === qid);
    if (!qdef) return;

    activePlayerQuests.set(player.playerId, { questId: qid, step: 1 });
    player.sendTextBubble(`\`9You have embarked on the ${qdef.name}!\`\``, true);
    player.variants.sendOnConsoleMessage(`\`9The Legendary Wizard imparts his sacred quest upon you: \`w${qdef.name}\`\``);
    player.sendSfx("audio/magic_hit.wav");
    return;
  }

  if (button === "abandon_quest") {
    activePlayerQuests.delete(player.playerId);
    player.sendTextBubble("`4You have abandoned the quest.``", true);
    player.sendSfx("audio/power_down.wav");
    return;
  }

  if (button === "submit_quest_step") {
    const current = activePlayerQuests.get(player.playerId);
    if (!current) return;
    const quest = LEGENDARY_QUESTS.find(q => q.id === current.questId);
    if (!quest) return;

    const stepIdx = current.step - 1;
    const stepData = quest.steps[stepIdx];
    if (!stepData) return;

    if (player.inventory.getAmount(stepData.requiredItemId) < stepData.requiredCount || player.gems < stepData.gemCost) {
      player.sendTextBubble("`4You lack the required materials!``", true);
      return;
    }

    player.removeItemInven(stepData.requiredItemId, stepData.requiredCount);
    player.addGems(-stepData.gemCost);
    current.step++;

    player.sendSfx("audio/secret.wav");
    if (current.step > quest.steps.length) {
      player.sendTextBubble("`2All trials completed! Talk to the Wizard to claim your reward!``", true);
      player.variants.sendOnConsoleMessage(`\`2Congratulations! You have completed all trials for \`w${quest.name}\`2! Claim your prize!\`\``);
    } else {
      player.sendTextBubble(`\`2Step ${stepIdx + 1} completed! Proceed to Step ${current.step}!\`\``, true);
    }
    return;
  }

  if (button === "claim_legendary_reward" || button === "dev_instant_complete_lquest") {
    let current = activePlayerQuests.get(player.playerId);
    if (!current && player.isDeveloper) {
      current = { questId: "legendary_katana", step: 5 };
      activePlayerQuests.set(player.playerId, current);
    }
    if (!current) return;

    const quest = LEGENDARY_QUESTS.find(q => q.id === current.questId) ?? LEGENDARY_QUESTS[0];

    // Grant legendary reward
    player.addItemInven(quest.rewardId, 1);
    activePlayerQuests.delete(player.playerId);

    const world = player.world;
    if (world) {
      world.playPositioned("audio/thousandSlash.wav", player.netID);
      world.broadcastVariant(Variant.from("OnParticleEffect", 46, [player.state.x + 16, player.state.y + 16]));
      world.broadcastVariant(
        Variant.from("OnConsoleMessage", `\`5[LEGENDARY ACHIEVEMENT] \`w${player.displayName}\`\` has completed the \`w${quest.name}\`\` and obtained the \`#${quest.rewardName}\`\`!`),
      );
      world.broadcastVariant(
        Variant.from("OnTalkBubble", player.netID, `\`#I have obtained the ${quest.rewardName}!\`\``, 0),
      );
    }
    player.sendTextBubble(`\`#Claimed ${quest.rewardName}!\`\``, true);
    return;
  }
});
