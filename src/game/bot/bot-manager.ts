import { Collection } from "../../utils/collection";
import { logger } from "../../utils/logger";
import { serverManager } from "../server/server-manager";
import { worldManager } from "../world/world-manager";
import { BotPlayer, type BotConfig } from "./bot-player";
import { DEFAULT_BOT_ROSTER } from "./bot-definitions";
import type { Player } from "../player";
import { CHARACTER_STATE } from "../../constants";

/**
 * Manages all simulated NPC bots across worlds.
 * Simulates living multiplayer activity (chatting, farming, casino roulette, wandering).
 */
export class BotManager {
  private static instance: BotManager;
  public bots: Collection<string, BotPlayer> = new Collection();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private nextPeerId = 90001;

  private constructor() {}

  public static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  /**
   * Initializes and deploys the default bot roster across designated worlds.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info({ totalBots: DEFAULT_BOT_ROSTER.length }, "deploying simulated bot roster");

    for (const config of DEFAULT_BOT_ROSTER) {
      try {
        await this.spawnBot(config);
      } catch (err) {
        logger.error({ err, bot: config.name, world: config.worldName }, "failed to spawn bot");
      }
    }

    this.startBehaviorTicker();
    logger.info({ activeBots: this.bots.size }, "simulated bot manager started successfully");
  }

  /**
   * Shuts down all active bots and cleans up ticker intervals.
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    for (const bot of this.bots.values()) {
      try {
        if (bot.world) {
          bot.leaveWorld(false);
        }
        serverManager.unregisterPlayer(bot);
      } catch {}
    }

    this.bots.clear();
    logger.info("all simulated bots despawned");
  }

  /**
   * Spawns a single bot into its designated world and registers it into the server manager.
   */
  public async spawnBot(config: BotConfig): Promise<BotPlayer> {
    const peerId = this.nextPeerId++;
    const bot = new BotPlayer(peerId, config);

    // Register into central server manager so /online, /who, and moderation commands discover the bot
    serverManager.registerPlayer(bot);
    this.bots.set(bot.tankIDName.toLowerCase(), bot);

    const world = await worldManager.get(config.worldName);
    if (world) {
      await world.enter(bot, config.targetTileX, config.targetTileY);
      bot.homeTileX = Math.floor(bot.state.x / 32);
      bot.homeTileY = Math.floor(bot.state.y / 32);
      logger.info({ bot: bot.tankIDName, world: world.name }, "bot entered world successfully");
    }

    return bot;
  }

  /**
   * Despawns and unregisters a specific bot by name.
   */
  public despawnBot(name: string): boolean {
    const lower = name.toLowerCase();
    const bot = this.bots.get(lower);
    if (!bot) return false;

    if (bot.world) {
      bot.leaveWorld(false);
    }
    serverManager.unregisterPlayer(bot);
    this.bots.delete(lower);
    logger.info({ bot: name }, "bot despawned");
    return true;
  }

  /**
   * Resets and respawns all default bots.
   */
  public async respawnAll(): Promise<void> {
    this.stop();
    await this.start();
  }

  /**
   * Starts the 1-second behavior evaluation ticker.
   */
  private startBehaviorTicker(): void {
    if (this.tickInterval) return;

    this.tickInterval = setInterval(() => {
      this.tickBehaviors();
    }, 1000);
  }

  /**
   * Drives active behaviors for each connected bot.
   */
  private tickBehaviors(): void {
    const now = Date.now();

    for (const bot of this.bots.values()) {
      if (!bot.world) continue;
      // Frozen bots cannot move or punch
      if ((bot.state.characterState & CHARACTER_STATE.IS_FROZEN) !== 0) continue;

      try {
        // 1. Dialogue / Chatting
        if (now >= bot.nextChatAt && !bot.state.isMuted) {
          if (bot.dialoguePool.length > 0 && Math.random() < 0.6) {
            const index = Math.floor(Math.random() * bot.dialoguePool.length);
            const line = bot.dialoguePool[index];
            if (line) bot.say(line);
          }
          // Schedule next chat (every 14s to 28s with natural variance)
          bot.nextChatAt = now + 14000 + Math.random() * 14000;
        }

        // 2. Physical Action & Movement
        if (now >= bot.nextActionAt) {
          this.executeBehaviorAction(bot, now);
        }
      } catch (err) {
        logger.error({ err, bot: bot.tankIDName }, "error during bot behavior tick");
      }
    }
  }

  /**
   * Executes behavior action specific to the bot's assigned role.
   */
  private executeBehaviorAction(bot: BotPlayer, now: number): void {
    const world = bot.world;
    if (!world) return;

    switch (bot.behaviorType) {
      case "farmer": {
        // Farmer rhythm: punch nearby block, then occasionally take a step along the row
        const currentTileX = Math.floor(bot.state.x / 32);
        const currentTileY = Math.floor(bot.state.y / 32);

        if (Math.random() < 0.7) {
          // Punch tile in front (left or right)
          const targetX = bot.state.rotatedLeft ? currentTileX - 1 : currentTileX + 1;
          bot.punchTile(targetX, currentTileY);
          bot.nextActionAt = now + 1200 + Math.random() * 1000;
        } else {
          // Step along the row (+/- 1-2 tiles)
          const step = (Math.random() < 0.5 ? -1 : 1) * 32;
          const nextX = Math.max(32, Math.min(world.width * 32 - 64, bot.state.x + step));
          bot.walkTo(nextX, bot.state.y, step < 0, false);
          bot.nextActionAt = now + 2000 + Math.random() * 1500;
        }
        break;
      }

      case "casino_host": {
        // Casino Host: spins roulette wheel every 20-30s with audio and announces numbers
        if (Math.random() < 0.35) {
          const number = Math.floor(Math.random() * 37); // 0-36
          const color = number === 0 ? "Green" : number % 2 === 0 ? "Black" : "Red";

          world.playPositioned("audio/roulette_spin.wav", bot.netID);
          bot.say(`[Roulette] The wheel stops at number \`w${number} \`$(${color})\`\`!`);
          bot.nextActionAt = now + 12000 + Math.random() * 10000;
        } else {
          // Idle turn left/right or slight step
          const faceLeft = Math.random() < 0.5;
          bot.walkTo(bot.state.x, bot.state.y, faceLeft, false);
          bot.nextActionAt = now + 3000 + Math.random() * 4000;
        }
        break;
      }

      case "casino_gambler": {
        // Gambler: reacts to spins, places bets, moves between tables
        if (Math.random() < 0.4) {
          const deltaX = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.floor(Math.random() * 48));
          const targetX = Math.max(32, Math.min(world.width * 32 - 64, bot.homeTileX * 32 + deltaX));
          bot.walkTo(targetX, bot.state.y, deltaX < 0, Math.random() < 0.2);
        }
        bot.nextActionAt = now + 2500 + Math.random() * 3500;
        break;
      }

      case "social":
      case "trader":
      default: {
        // Social / Trader: wanders smoothly near home position, turns around, occasionally jumps
        if (Math.random() < 0.5) {
          const offsetTiles = Math.floor(Math.random() * 5) - 2; // -2 to +2 tiles
          const targetX = Math.max(32, Math.min(world.width * 32 - 64, (bot.homeTileX + offsetTiles) * 32));
          const facingLeft = targetX < bot.state.x;
          const jump = Math.random() < 0.25;
          bot.walkTo(targetX, bot.state.y, facingLeft, jump);
        }
        bot.nextActionAt = now + 3000 + Math.random() * 4000;
        break;
      }
    }
  }

  /**
   * Dispatches intelligent conversational reaction when a real player speaks in the same world.
   */
  public onPlayerChat(player: Player, rawMessage: string): void {
    if (!player.world) return;
    const lower = rawMessage.toLowerCase();

    for (const bot of this.bots.values()) {
      if (bot.world !== player.world || bot.state.isMuted) continue;

      // Check if player mentioned bot name or greeting
      const botNameLower = bot.tankIDName.toLowerCase();
      const isAddressed = lower.includes(botNameLower) || lower.includes("bot") || lower.includes("all");

      if (isAddressed) {
        setTimeout(() => {
          if (!bot.world || bot.state.isMuted) return;
          if (lower.includes("hi") || lower.includes("halo") || lower.includes("hello") || lower.includes("hey")) {
            bot.say(`Hey \`w${player.displayName}\`\`! Nice to see you! :D`);
          } else if (lower.includes("trade") || lower.includes("sell") || lower.includes("buy")) {
            bot.say(`Trade me \`w${player.displayName}\`\`, let's see what you have!`);
          } else if (lower.includes("wl") || lower.includes("gems") || lower.includes("dl")) {
            bot.say(`Keep grinding and farming \`w${player.displayName}\`\`, wealth will come!`);
          } else if (lower.includes("help") || lower.includes("cara")) {
            bot.say("Type /? to check all available commands and guides!");
          } else {
            bot.say(`What's up \`w${player.displayName}\`\`? Enjoying GrowServer?`);
          }
        }, 1200 + Math.random() * 800);
        break;
      }
    }
  }

  /**
   * Responds when a real player whispers to a bot via /msg.
   */
  public onPlayerWhisper(player: Player, bot: BotPlayer, rawMessage: string): void {
    if (bot.state.isMuted) return;
    const lower = rawMessage.toLowerCase();

    setTimeout(() => {
      if (bot.state.isMuted) return;
      let reply = `Hey ${player.displayName}! Thanks for the message!`;

      if (lower.includes("hi") || lower.includes("halo") || lower.includes("hello")) {
        reply = `Hello ${player.displayName}! Having fun on the server?`;
      } else if (lower.includes("trade") || lower.includes("buy") || lower.includes("sell")) {
        reply = `I'm holding onto my stock for now, but thanks for the offer!`;
      } else if (lower.includes("bot")) {
        reply = `Haha yes, I'm keeping the world lively while you play!`;
      }

      bot.replyPrivately(player, reply);
    }, 1500);
  }
}

export const botManager = BotManager.getInstance();
