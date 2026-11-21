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
 * Simulates living multiplayer activity (chatting, farming, casino roulette, wide roaming, emotes, and commands).
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
      const targetX = config.targetTileX ?? world.mainDoor?.x ?? 50;
      const targetY = config.targetTileY ?? world.mainDoor?.y ?? 23;
      await world.enter(bot, targetX, targetY);
      bot.homeTileX = targetX;
      bot.homeTileY = targetY;
      logger.info({ bot: bot.tankIDName, world: world.name, x: targetX, y: targetY }, "bot entered world successfully");
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
        // 1. Shocked & Excited reaction when seeing a visible real player (non-invis)
        const visibleRealPlayers = bot.world.players.filter(
          (p) => !(p as any).isBot && !p.isInvisible && !p.state.isGhost,
        );

        if (visibleRealPlayers.length > 0) {
          for (const player of visibleRealPlayers) {
            const lastGreeted = bot.seenPlayersCooldown.get(player.playerId) ?? 0;
            // Cooldown of 45 seconds per player so it doesn't spam every second
            if (now - lastGreeted > 45_000) {
              bot.seenPlayersCooldown.set(player.playerId, now);

              // Turn to face the player and jump in surprise!
              const facingLeft = player.x < bot.state.x;
              bot.walkTo(bot.state.x, bot.state.y, facingLeft, true);
              bot.playEmote(Math.random() < 0.6 ? "omg" : "wave");

              const shockedLines = [
                `OMG! Is that \`w${player.displayName}\`\`?! :O`,
                `Whoa! The creator has appeared!! *gasp*`,
                `*gasp* OMG \`w${player.displayName}\`\`! Big fan!!`,
                `Yooo \`w${player.displayName}\`\` is here! Welcome to \`2${bot.world.name}\`\`! :D`,
                `Look everyone, it's \`w${player.displayName}\`\`! Can I get an autograph/trade please?! :O`,
                `*gasp* OMG he's not invisible anymore! Real legend right here!`,
              ];
              const line = shockedLines[Math.floor(Math.random() * shockedLines.length)]!;
              setTimeout(() => {
                if (bot.world && !bot.state.isMuted) {
                  bot.say(line);
                }
              }, 350);
              break;
            }
          }
        }

        // 2. Dialogue / Chatting
        if (now >= bot.nextChatAt && !bot.state.isMuted) {
          if (bot.dialoguePool.length > 0 && Math.random() < 0.6) {
            const index = Math.floor(Math.random() * bot.dialoguePool.length);
            const line = bot.dialoguePool[index];
            if (line) bot.say(line);
          }
          // Schedule next chat (every 14s to 28s with natural variance)
          bot.nextChatAt = now + 14000 + Math.random() * 14000;
        }

        // 3. Physical Action, Roaming & Command Execution
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

    // 15% chance to execute a regular player slash command or emote animation!
    if (Math.random() < 0.15 && !bot.state.isMuted) {
      const commandsPool = [
        "cheer",
        "dance",
        "dance2",
        "wave",
        "dab",
        "omg",
        "stats",
        "time",
        "rules",
        "me is having fun in GrowServer!",
        "me checks the trade market",
        "me jumps excitedly!",
      ];
      const cmd = commandsPool[Math.floor(Math.random() * commandsPool.length)]!;
      bot.runCommand(cmd).catch(() => {});
    }

    switch (bot.behaviorType) {
      case "farmer": {
        // Farmer rhythm: punch nearby block, then walk along farm corridor [minTileX, maxTileX]
        const currentTileX = Math.floor(bot.state.x / 32);
        const currentTileY = Math.floor(bot.state.y / 32);

        if (Math.random() < 0.65) {
          // Punch tile in front (left or right)
          const targetX = bot.state.rotatedLeft ? currentTileX - 1 : currentTileX + 1;
          bot.punchTile(targetX, currentTileY);
          if (Math.random() < 0.1) {
            bot.playEmote("cheer");
          }
          bot.nextActionAt = now + 1000 + Math.random() * 800;
        } else {
          // Step along the farming row within designated corridor
          const stepTiles = Math.floor(Math.random() * 3) + 1;
          const direction = Math.random() < 0.5 ? -1 : 1;
          const targetTile = Math.max(bot.minTileX, Math.min(bot.maxTileX, currentTileX + direction * stepTiles));
          const targetX = targetTile * 32;
          const facingLeft = targetX < bot.state.x;
          const jump = Math.random() < 0.3;
          bot.walkTo(targetX, bot.state.y, facingLeft, jump);
          bot.nextActionAt = now + 1800 + Math.random() * 1500;
        }
        break;
      }

      case "casino_host": {
        // Casino Host: spins roulette wheel every 18-25s with audio and announces numbers
        if (Math.random() < 0.35) {
          const number = Math.floor(Math.random() * 37); // 0-36
          const color = number === 0 ? "Green" : number % 2 === 0 ? "Black" : "Red";

          world.playPositioned("audio/roulette_spin.wav", bot.netID);
          bot.say(`[Roulette] The wheel stops at number \`w${number} \`$(${color})\`\`!`);

          // Synchronize reactions of nearby gamblers
          setTimeout(() => {
            for (const other of world.players) {
              if (other === bot || !(other as any).isBot) continue;
              const gBot = other as BotPlayer;
              if (gBot.behaviorType === "casino_gambler" && !gBot.state.isMuted) {
                if (Math.random() < 0.5) {
                  gBot.playEmote("cheer");
                  gBot.say("YESSS! I won this round! GG!");
                } else {
                  gBot.playEmote("sad");
                  gBot.say("Aww lost my bet! Rematch next round!");
                }
                break;
              }
            }
          }, 1200);

          bot.nextActionAt = now + 14000 + Math.random() * 8000;
        } else {
          // Host slight step around the table
          const faceLeft = Math.random() < 0.5;
          const deltaX = (Math.random() < 0.5 ? -1 : 1) * 16;
          const targetX = Math.max(bot.minTileX * 32, Math.min(bot.maxTileX * 32, bot.state.x + deltaX));
          bot.walkTo(targetX, bot.state.y, faceLeft, false);
          bot.nextActionAt = now + 3000 + Math.random() * 3000;
        }
        break;
      }

      case "casino_gambler": {
        // Gambler: reacts, bets, wanders along tables [minTileX, maxTileX]
        const currentTileX = Math.floor(bot.state.x / 32);
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 2) + 1);
        const targetTile = Math.max(bot.minTileX, Math.min(bot.maxTileX, currentTileX + step));
        const targetX = targetTile * 32;
        const facingLeft = targetX < bot.state.x;
        const jump = Math.random() < 0.35;
        bot.walkTo(targetX, bot.state.y, facingLeft, jump);

        if (Math.random() < 0.15) {
          bot.playEmote(Math.random() < 0.5 ? "cheer" : "dance");
        }
        bot.nextActionAt = now + 2500 + Math.random() * 3000;
        break;
      }

      case "social":
      case "trader":
      default: {
        // Social / Trader: roams widely across their designated street/corridor [minTileX, maxTileX]
        const currentTileX = Math.floor(bot.state.x / 32);
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 4) + 1);
        const targetTile = Math.max(bot.minTileX, Math.min(bot.maxTileX, currentTileX + step));
        const targetX = targetTile * 32;
        const facingLeft = targetX < bot.state.x;
        const jump = Math.random() < 0.3;
        bot.walkTo(targetX, bot.state.y, facingLeft, jump);

        if (Math.random() < 0.12) {
          const emotes = ["wave", "dance", "dance2", "dab", "smile", "love"];
          const emote = emotes[Math.floor(Math.random() * emotes.length)]!;
          bot.playEmote(emote);
        }
        bot.nextActionAt = now + 2500 + Math.random() * 3500;
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
      const isAddressed = lower.includes(botNameLower) || lower.includes("bot") || lower.includes("all") || lower.includes("halo") || lower.includes("hi");

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
