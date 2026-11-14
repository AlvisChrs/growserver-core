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
export function computeEffectiveClothes(clothes: Readonly<PlayerClothes>, _isTransformed = false): PlayerClothes {
  return { ...clothes };
}
