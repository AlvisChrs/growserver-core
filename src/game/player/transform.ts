import type { PlayerClothes } from "./inventory";

/**
 * Known Full-Body Hero Suits (equipped in the necklace slot).
 * In Growtopia, equipping these suppresses conflicting visible clothes
 * (hair, shirt, pants, feet, face, mask) so the complete hero sprite
 * displays cleanly without clashing. They also grant hero stats (double jump,
 * increased punch reach, and speed boost).
 */
export const FULL_BODY_SUITS: ReadonlySet<number> = new Set([
  11554, // Bodvar
  11556, // Val
  11558, // Sam Fisher
  11560, // Ezio
  12646, // Altair
  12648, // Eivor
  12650, // Bayek
  13196, // Rabbid Buddy
  13892, // Basim
  13894, // Connor
  13896, // Kassandra
  15284, // Nix
  15288, // Edward
  15290, // Yasuke
  16048, // Orion
]);

/**
 * Items that provide transformation/morph mechanisms (e.g. Go-Go-Growformer!,
 * Growformer PowerKey, Space Rabbit, etc.).
 */
export const MORPH_ITEMS: ReadonlySet<number> = new Set([
  7384, // Go-Go-Growformer! (Feet)
  7480, // Growformer PowerKey
  10960, // Space Rabbit
  12014, // Dal's Phasers
  12018, // Rok's Fists
  13196, // Rabbid Buddy
]);

/**
 * Computes the visually effective clothes sent to clients via `OnSetClothing`.
 * Preserves all worn items so avatars never become invisible and clothes unequip cleanly.
 */
export function computeEffectiveClothes(clothes: Readonly<PlayerClothes>, isTransformed = false): PlayerClothes {
  const effective: PlayerClothes = { ...clothes };

  if (isTransformed) {
    if (clothes.necklace === 11560) {
      // Full-body Ezio Auditore: hooded assassin cowl, vest, cape, trousers, armguards, beard, boots
      effective.hair = 7080;
      effective.shirt = 7082;
      effective.back = 7084;
      effective.pants = 7086;
      effective.hand = 7088;
      effective.face = 7090;
      effective.feet = 7094;
      effective.mask = 0;
    } else if (clothes.necklace === 12646) {
      // Full-body Altair: Mentor hood, vest, cape, trousers, armguards, boots
      effective.hair = 12740;
      effective.shirt = 12742;
      effective.back = 11016;
      effective.pants = 12744;
      effective.hand = 11020;
      effective.feet = 12746;
      effective.face = 0;
      effective.mask = 0;
    } else if (clothes.necklace === 12650) {
      // Full-body Bayek of Siwa
      effective.hair = 0;
      effective.mask = 12748;
      effective.shirt = 12750;
      effective.back = 11016;
      effective.pants = 12752;
      effective.hand = 11020;
      effective.feet = 12754;
      effective.face = 0;
    } else if (clothes.feet === 7384) {
      // Growformer Robot Automaton: Legendbot chassis, robot legs, wings, and helmet
      effective.shirt = 1780;  // Legendbot-009
      effective.pants = 6384;  // Robot Legs
      effective.hair = 16132;  // Robotic Helmet
      effective.back = 7582;   // Robotic MK.IV Wings
      effective.face = 0;
      effective.mask = 0;
    }
  }

  return effective;
}
