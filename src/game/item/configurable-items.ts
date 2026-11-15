import { DialogBuilder } from "../../utils/dialog-builder";
import type { Player } from "../player";
import { registerDialog } from "../network/dialog-handler";
import { Variant } from "../packets/variants";

export interface RiftCapeConfig {
  capeRgb: [number, number, number];
  collarRgb: [number, number, number];
  collarUp: boolean;
  cycleTimeSeconds: number;
  particleTrail: boolean;
}

export interface RiftWingsConfig {
  wingsRgb: [number, number, number];
  particleTrail: boolean;
}

export const DEFAULT_RIFT_CAPE_CONFIG: Readonly<RiftCapeConfig> = {
  capeRgb: [140, 20, 255], // Cosmic Purple
  collarRgb: [255, 255, 255], // Pure White
  collarUp: true,
  cycleTimeSeconds: 0,
  particleTrail: true,
};

export const DEFAULT_RIFT_WINGS_CONFIG: Readonly<RiftWingsConfig> = {
  wingsRgb: [180, 50, 255], // Dimensional Purple
  particleTrail: true,
};

const COLOR_PRESETS: Record<string, { name: string; cape: [number, number, number]; collar: [number, number, number] }> = {
  purple: { name: "Cosmic Purple", cape: [140, 20, 255], collar: [255, 255, 255] },
  crimson: { name: "Crimson Void", cape: [230, 25, 45], collar: [255, 200, 200] },
  cyan: { name: "Cyber Cyan", cape: [0, 220, 255], collar: [220, 255, 255] },
  gold: { name: "Solar Gold", cape: [255, 200, 0], collar: [255, 240, 180] },
  emerald: { name: "Astral Emerald", cape: [30, 230, 120], collar: [200, 255, 220] },
  white: { name: "Phantom White", cape: [240, 240, 255], collar: [255, 255, 255] },
  black: { name: "Abyss Shadow", cape: [25, 25, 35], collar: [90, 90, 110] },
};

function parseRgb(input: string, fallback: [number, number, number]): [number, number, number] {
  if (!input) return fallback;
  const parts = input.split(",").map((s) => Number.parseInt(s.trim(), 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return fallback;
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

/**
 * Builds the Rift Cape Customization dialog for the given player.
 */
export function riftCapeDialog(player: Player): string {
  const config = player.riftCapeConfig ?? { ...DEFAULT_RIFT_CAPE_CONFIG };
  const capeStr = config.capeRgb.join(",");
  const collarStr = config.collarRgb.join(",");

  const dialog = new DialogBuilder()
    .defaultColor()
    .addLabelWithIcon("`5Rift Cape Customization``", 10424, "big")
    .addSpacer("small")
    .addTextBox("`oTune dimensional frequencies and styling for your \`5Rift Cape\`o:``")
    .addSpacer("small")
    .addInputBox("cape_rgb", "Cape Color (R,G,B):", capeStr, 15)
    .addInputBox("collar_rgb", "Collar Color (R,G,B):", collarStr, 15)
    .addSpacer("small")
    .addCheckbox("collar_up", "Collar Raised / Flared", config.collarUp ? "selected" : "not_selected")
    .addCheckbox("particles", "A rift in time, here I come! (Sparkles)", config.particleTrail ? "selected" : "not_selected")
    .addSpacer("small")
    .addTextBox("`oQuick Color Presets:``")
    .addButton("preset_purple", "`5Cosmic Purple``")
    .addButton("preset_crimson", "`4Crimson Void``")
    .addButton("preset_cyan", "`1Cyber Cyan``")
    .addButton("preset_gold", "`eSolar Gold``")
    .addButton("preset_emerald", "`2Astral Emerald``")
    .addButton("preset_black", "`bAbyss Shadow``")
    .addSpacer("small")
    .addQuickExit()
    .endDialog("rift_cape_config", "Cancel", "Save Matrix");

  return dialog.str();
}

/**
 * Builds the Rift Wings Customization dialog for the given player.
 */
export function riftWingsDialog(player: Player): string {
  const config = player.riftWingsConfig ?? { ...DEFAULT_RIFT_WINGS_CONFIG };
  const wingsStr = config.wingsRgb.join(",");

  const dialog = new DialogBuilder()
    .defaultColor()
    .addLabelWithIcon("`5Rift Wings Customization``", 11478, "big")
    .addSpacer("small")
    .addTextBox("`oTune cosmic resonance and flutter trails for your \`5Rift Wings\`o:``")
    .addSpacer("small")
    .addInputBox("wings_rgb", "Wings Color (R,G,B):", wingsStr, 15)
    .addSpacer("small")
    .addCheckbox("particles", "Dimensional Sparkle Trail", config.particleTrail ? "selected" : "not_selected")
    .addSpacer("small")
    .addTextBox("`oQuick Color Presets:``")
    .addButton("wpreset_purple", "`5Cosmic Purple``")
    .addButton("wpreset_crimson", "`4Crimson Void``")
    .addButton("wpreset_cyan", "`1Cyber Cyan``")
    .addButton("wpreset_gold", "`eSolar Gold``")
    .addButton("wpreset_emerald", "`2Astral Emerald``")
    .addButton("wpreset_black", "`bAbyss Shadow``")
    .addSpacer("small")
    .addQuickExit()
    .endDialog("rift_wings_config", "Cancel", "Apply Resonance");

  return dialog.str();
}

// Register Dialog Handlers
registerDialog("rift_cape_config", (player, action) => {
  const clicked = action.get("buttonClicked");

  // Handle Preset Buttons
  if (clicked?.startsWith("preset_")) {
    const key = clicked.replace("preset_", "");
    const preset = COLOR_PRESETS[key];
    if (preset) {
      player.riftCapeConfig = {
        capeRgb: [...preset.cape],
        collarRgb: [...preset.collar],
        collarUp: player.riftCapeConfig?.collarUp ?? true,
        cycleTimeSeconds: player.riftCapeConfig?.cycleTimeSeconds ?? 0,
        particleTrail: player.riftCapeConfig?.particleTrail ?? true,
      };

      triggerRiftEffect(player, `Applied preset: \`5${preset.name}\`\``);
      player.variants.sendOnDialogRequest(riftCapeDialog(player));
      return;
    }
  }

  // Handle "Save Matrix" (dialog submission)
  const capeRgb = parseRgb(action.get("cape_rgb"), player.riftCapeConfig?.capeRgb ?? DEFAULT_RIFT_CAPE_CONFIG.capeRgb);
  const collarRgb = parseRgb(action.get("collar_rgb"), player.riftCapeConfig?.collarRgb ?? DEFAULT_RIFT_CAPE_CONFIG.collarRgb);
  const collarUp = action.get("collar_up") === "1";
  const particleTrail = action.get("particles") === "1";

  player.riftCapeConfig = {
    capeRgb,
    collarRgb,
    collarUp,
    cycleTimeSeconds: 0,
    particleTrail,
  };

  triggerRiftEffect(player, `Collar: \`w${collarUp ? "Raised" : "Down"}\`\`, Color: \`5RGB(${capeRgb.join(",")})\`\``);
});

registerDialog("rift_wings_config", (player, action) => {
  const clicked = action.get("buttonClicked");

  // Handle Preset Buttons
  if (clicked?.startsWith("wpreset_")) {
    const key = clicked.replace("wpreset_", "");
    const preset = COLOR_PRESETS[key];
    if (preset) {
      player.riftWingsConfig = {
        wingsRgb: [...preset.cape],
        particleTrail: player.riftWingsConfig?.particleTrail ?? true,
      };

      triggerRiftEffect(player, `Applied preset: \`5${preset.name}\`\``);
      player.variants.sendOnDialogRequest(riftWingsDialog(player));
      return;
    }
  }

  // Handle "Apply Resonance" (dialog submission)
  const wingsRgb = parseRgb(action.get("wings_rgb"), player.riftWingsConfig?.wingsRgb ?? DEFAULT_RIFT_WINGS_CONFIG.wingsRgb);
  const particleTrail = action.get("particles") === "1";

  player.riftWingsConfig = {
    wingsRgb,
    particleTrail,
  };

  triggerRiftEffect(player, `Wings Color: \`5RGB(${wingsRgb.join(",")})\`\`, Trail: \`w${particleTrail ? "Active" : "Off"}\`\``);
});

function triggerRiftEffect(player: Player, summary: string): void {
  const world = player.world;
  const px = player.state.x + 10;
  const py = player.state.y + 16;

  if (world) {
    world.broadcastVariant(Variant.from("OnParticleEffect", 12, [px, py]));
    world.playPositioned("audio/magic_hit.wav", player.netID);
  }

  player.sendClothesToWorld();
  player.sendCharacterState();
  player.sendTextBubble("`5[Rift Matrix Configured!]``", true);
  player.variants.sendOnConsoleMessage(`\`5[Rift Matrix] Configuration updated! ${summary}\`\``);
}
