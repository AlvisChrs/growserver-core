import { Variant } from "../packets/variants";
import type { World } from "../world/world";

/**
 * Spawns a dramatic, organic ghost swarm over randomized periods and wide perimeter.
 * No fixed geometric pattern — randomized angles, distances (12-100px), and ghost counts.
 */
export function spawnInvisGhostSwarm(world: World, px: number, py: number, netID?: number): void {
  // Wave 0: Initial burst + rift (0ms)
  world.sendParticleEffect?.(12, px, py);
  world.broadcastVariant?.(Variant.from("OnParticleEffect", 12, [px, py]));
  if (netID) world.playPositioned?.("audio/spooky.wav", netID);

  const spawnRandomGhostWave = (count: number, minDist: number, maxDist: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const dist = minDist + Math.random() * (maxDist - minDist);
      const gx = Math.round(px + Math.cos(angle) * dist);
      const gy = Math.round(py + Math.sin(angle) * dist);
      world.sendParticleEffect?.(3, gx, gy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 3, [gx, gy]));
    }
  };

  // Immediate wave (4-6 ghosts close around avatar)
  spawnRandomGhostWave(Math.floor(Math.random() * 3) + 4, 10, 32);

  // Period 1 (~100ms): 4-7 ghosts expanding to mid range
  const delay1 = 90 + Math.floor(Math.random() * 50);
  setTimeout(() => {
    if (!world) return;
    spawnRandomGhostWave(Math.floor(Math.random() * 4) + 4, 25, 55);
  }, delay1);

  // Period 2 (~220ms): 5-8 ghosts expanding further
  const delay2 = 210 + Math.floor(Math.random() * 60);
  setTimeout(() => {
    if (!world) return;
    spawnRandomGhostWave(Math.floor(Math.random() * 4) + 5, 40, 75);
    if (netID) world.playPositioned?.("audio/haunt.wav", netID);
  }, delay2);

  // Period 3 (~360ms): 6-9 ghosts in wide perimeter
  const delay3 = 350 + Math.floor(Math.random() * 80);
  setTimeout(() => {
    if (!world) return;
    spawnRandomGhostWave(Math.floor(Math.random() * 4) + 6, 50, 95);
  }, delay3);

  // Period 4 (~520ms): 5-8 ghosts swirling along outer edge
  const delay4 = 500 + Math.floor(Math.random() * 90);
  setTimeout(() => {
    if (!world) return;
    spawnRandomGhostWave(Math.floor(Math.random() * 4) + 5, 60, 105);
    if (netID) world.playPositioned?.("audio/spooky.wav", netID);
  }, delay4);

  // Period 5 (~700ms): 4-6 lingering spirits at maximum range
  const delay5 = 680 + Math.floor(Math.random() * 100);
  setTimeout(() => {
    if (!world) return;
    spawnRandomGhostWave(Math.floor(Math.random() * 3) + 4, 65, 115);
  }, delay5);
}

/**
 * Spawns a grand, majestic dark flame eruption ("api hitam yang megah")
 * when reappearing from invisibility.
 * Combines dark rifts (12), dark matter sparks (44), and flame bursts (36)
 * across expanding multi-stage hellfire shockwaves.
 */
export function spawnInvisReappearDarkFlames(world: World, px: number, py: number, netID?: number): void {
  // Wave 0 (0ms): Dense dark flame eruption at core
  const coreOffsets = [
    [0, 0],
    [-10, -10], [10, -10],
    [-10, 10], [10, 10],
  ];
  for (const [ox, oy] of coreOffsets) {
    world.sendParticleEffect?.(12, px + ox, py + oy);
    world.broadcastVariant?.(Variant.from("OnParticleEffect", 12, [px + ox, py + oy]));
    world.sendParticleEffect?.(44, px + ox, py + oy);
    world.broadcastVariant?.(Variant.from("OnParticleEffect", 44, [px + ox, py + oy]));
    world.sendParticleEffect?.(36, px + ox, py + oy);
    world.broadcastVariant?.(Variant.from("OnParticleEffect", 36, [px + ox, py + oy]));
  }
  if (netID) {
    world.playPositioned?.("audio/thousandSlash.wav", netID);
    world.playPositioned?.("audio/magic_hit.wav", netID);
    world.playPositioned?.("audio/teleport.wav", netID);
  }

  // Wave 1 (100ms): 8-point expanding ring of dark flames
  setTimeout(() => {
    if (!world) return;
    const ring1 = [
      [0, -32], [0, 32],
      [-32, 0], [32, 0],
      [-22, -22], [22, -22],
      [-22, 22], [22, 22],
    ];
    for (const [ox, oy] of ring1) {
      world.sendParticleEffect?.(12, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 12, [px + ox, py + oy]));
      world.sendParticleEffect?.(44, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 44, [px + ox, py + oy]));
      world.sendParticleEffect?.(36, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 36, [px + ox, py + oy]));
    }
  }, 100);

  // Wave 2 (220ms): 12-point colossal dark flame perimeter + sound boom
  setTimeout(() => {
    if (!world) return;
    const count = 12;
    const radius = 56;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const ox = Math.round(Math.cos(angle) * radius);
      const oy = Math.round(Math.sin(angle) * radius);
      world.sendParticleEffect?.(12, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 12, [px + ox, py + oy]));
      world.sendParticleEffect?.(44, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 44, [px + ox, py + oy]));
      world.sendParticleEffect?.(36, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 36, [px + ox, py + oy]));
    }
    if (netID) world.playPositioned?.("audio/resurrect.wav", netID);
  }, 220);

  // Wave 3 (360ms): Dissipating outer shadow shockwave (16 dark flares)
  setTimeout(() => {
    if (!world) return;
    const count = 16;
    const radius = 80;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const ox = Math.round(Math.cos(angle) * radius);
      const oy = Math.round(Math.sin(angle) * radius);
      world.sendParticleEffect?.(12, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 12, [px + ox, py + oy]));
      world.sendParticleEffect?.(44, px + ox, py + oy);
      world.broadcastVariant?.(Variant.from("OnParticleEffect", 44, [px + ox, py + oy]));
    }
  }, 360);
}
