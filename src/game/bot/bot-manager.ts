import { Collection } from "../../utils/collection";
import { logger } from "../../utils/logger";
import { serverManager } from "../server/server-manager";
import { worldManager } from "../world/world-manager";
import { BotPlayer, type BotConfig } from "./bot-player";
import { DEFAULT_BOT_ROSTER } from "./bot-definitions";
import type { Player } from "../player";
import { CHARACTER_STATE } from "../../constants";
import { TileFlags } from "../world/constants";
import { getItem } from "../item/item-utils";
import { tradeManager } from "../trade/trade-manager";
import type { World } from "../world/world";

/**
 * Scans a column to find the tile Y where an avatar can stand firmly with solid ground underneath.
 */
export function findGroundTileY(world: World, tileX: number, startY: number = 23): number {
  const x = Math.max(0, Math.min(world.width - 1, tileX));

  for (let y = Math.max(0, startY); y < world.height - 1; y++) {
    const tile = world.getTileAt(x, y);
    if (tile && tile.fg !== 0) {
      const item = getItem(tile.fg);
      const coll = item?.collisionType ?? 0;
      if (coll === 1 || coll === 2 || ((coll === 3 || coll === 4) && (tile.flags & TileFlags.OPEN) === 0)) {
        return Math.max(0, y - 1);
      }
    }
  }

  for (let y = 1; y < world.height - 1; y++) {
    const tile = world.getTileAt(x, y);
    if (tile && tile.fg !== 0) {
      const item = getItem(tile.fg);
      const coll = item?.collisionType ?? 0;
      if (coll === 1 || coll === 2 || ((coll === 3 || coll === 4) && (tile.flags & TileFlags.OPEN) === 0)) {
        return Math.max(0, y - 1);
      }
    }
  }

  return 23;
}

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
      const targetY = findGroundTileY(world, targetX, config.targetTileY ?? 23);
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

    // Helper: moves the bot along solid ground, preventing floating or falling off cliffs
    const walkSafely = (targetTileX: number): boolean => {
      const curTileX = Math.floor(bot.state.x / 32);
      const curTileY = Math.floor(bot.state.y / 32);
      const clampedX = Math.max(bot.minTileX, Math.min(bot.maxTileX, targetTileX));
      const groundY = findGroundTileY(world, clampedX, Math.max(0, curTileY - 2));

      // Only move if target ground is within safe height (no bottomless cliff)
      if (Math.abs(groundY - curTileY) <= 4) {
        const targetX = clampedX * 32;
        const targetY = groundY * 32;
        const facingLeft = targetX < bot.state.x;
        const jump = groundY < curTileY || Math.random() < 0.25;
        bot.walkTo(targetX, targetY, facingLeft, jump);
        return true;
      } else {
        // Turn around when encountering empty abyss
        bot.walkTo(bot.state.x, bot.state.y, !bot.state.rotatedLeft, false);
        return false;
      }
    };

    // 15% chance to execute a regular player slash command or emote animation
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

    const currentTileX = Math.floor(bot.state.x / 32);
    const currentTileY = Math.floor(bot.state.y / 32);
    const frontTileX = bot.state.rotatedLeft ? currentTileX - 1 : currentTileX + 1;
    const frontTile = world.getTileAt(frontTileX, currentTileY);

    switch (bot.behaviorType) {
      case "farmer": {
        // Farmer activities: planting seeds, harvesting trees, rotating/punching blocks, and roaming
        const roll = Math.random();

        // 1. Check if front tile has a tree to harvest
        if (frontTile && frontTile.tree) {
          bot.harvestTree(frontTileX, currentTileY);
          bot.say("Harvest time! Look at all these gems and fruits! :D");
          bot.playEmote("cheer");
          bot.nextActionAt = now + 1600;
          return;
        }

        // 2. Check if front tile is empty with solid ground below to plant a seed
        const groundBelowFront = world.getTileAt(frontTileX, currentTileY + 1);
        if (frontTile && frontTile.fg === 0 && groundBelowFront && groundBelowFront.fg !== 0 && roll < 0.35) {
          bot.plantSeed(frontTileX, currentTileY, 3); // Dirt seed (grows in 5s)
          bot.say("Planting some fresh seeds! Time to grow!");
          bot.nextActionAt = now + 1500;
          return;
        }

        // 3. Rotate or punch front block
        if (frontTile && frontTile.fg !== 0 && roll < 0.65) {
          if (Math.random() < 0.4) {
            bot.rotateBlock(frontTileX, currentTileY);
            bot.say("Rotating this block! Looks better aligned now!");
          } else {
            bot.punchTile(frontTileX, currentTileY);
            if (Math.random() < 0.15) bot.playEmote("cheer");
          }
          bot.nextActionAt = now + 1200 + Math.random() * 800;
          return;
        }

        // 4. Roam along farm row safely on ground
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 3) + 1);
        walkSafely(currentTileX + step);
        bot.nextActionAt = now + 2000 + Math.random() * 1500;
        break;
      }

      case "casino_host": {
        // Casino Host: spins roulette wheel, rolls dice, rotates wheels/signs, paces along table
        const hostRoll = Math.random();

        if (hostRoll < 0.35) {
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
        } else if (hostRoll < 0.55 && frontTile && frontTile.fg !== 0) {
          // Roll dice or rotate wheel/signs
          if (Math.random() < 0.5) {
            bot.rollDice(frontTileX, currentTileY);
          } else {
            bot.rotateBlock(frontTileX, currentTileY);
            bot.say("Setting up the casino tables for high rollers!");
          }
          bot.nextActionAt = now + 3500;
        } else {
          // Host pacing around table safely on ground
          const step = Math.random() < 0.5 ? -1 : 1;
          walkSafely(currentTileX + step);
          bot.nextActionAt = now + 2500 + Math.random() * 2500;
        }
        break;
      }

      case "casino_gambler": {
        // Gambler: reacts, bets, rolls dice, roams safely along tables
        const gamblerRoll = Math.random();

        if (gamblerRoll < 0.25 && frontTile && frontTile.fg !== 0) {
          bot.rollDice(frontTileX, currentTileY);
          bot.nextActionAt = now + 3000;
          return;
        }

        if (gamblerRoll < 0.45) {
          const bets = [
            "Betting 1 World Lock on RED!",
            "Putting 500 Gems on Black 22!",
            "Double or nothing this spin!",
            "Lucky number 7, bring me fortune!",
            "Going all in on GREEN 0!",
          ];
          bot.say(bets[Math.floor(Math.random() * bets.length)]!);
          bot.playEmote(Math.random() < 0.5 ? "cheer" : "dance");
          bot.nextActionAt = now + 3500;
          return;
        }

        // Wander along tables safely on ground
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 2) + 1);
        walkSafely(currentTileX + step);

        if (Math.random() < 0.2) {
          bot.playEmote(Math.random() < 0.5 ? "cheer" : "dance");
        }
        bot.nextActionAt = now + 2500 + Math.random() * 2500;
        break;
      }

      case "trader": {
        // Trader: invites nearby players to trade, rotates displays/vending, advertises wares
        const traderRoll = Math.random();

        // 1. Proactively invite nearby visible player to trade!
        const nearbyPlayer = world.players.find(
          (p) => !(p as any).isBot && !p.isInvisible && !p.state.isGhost && Math.abs(p.x - bot.state.x) < 220,
        );
        if (nearbyPlayer && traderRoll < 0.35 && !tradeManager.isInTrade(nearbyPlayer) && !tradeManager.isInTrade(bot)) {
          tradeManager.invite(bot, nearbyPlayer);
          bot.say(`Hey \`w${nearbyPlayer.displayName}\`\`, trade me! Let's make a great deal! :D`);
          bot.playEmote("wave");
          bot.nextActionAt = now + 5000;
          return;
        }

        // 2. Rotate display block / vending machine
        if (frontTile && frontTile.fg !== 0 && traderRoll < 0.6) {
          bot.rotateBlock(frontTileX, currentTileY);
          bot.say("Adjusting vending machine prices! Wholesale bargains!");
          bot.nextActionAt = now + 3000;
          return;
        }

        // 3. Roam along trading corridor safely on ground
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 3) + 1);
        walkSafely(currentTileX + step);

        if (Math.random() < 0.15) {
          bot.playEmote("wave");
        }
        bot.nextActionAt = now + 2500 + Math.random() * 3000;
        break;
      }

      case "social":
      default: {
        // Social: rotates decorative blocks, interacts with players, emotes, roams safely on ground
        const socialRoll = Math.random();

        // 1. Rotate nearby block / sign
        if (frontTile && frontTile.fg !== 0 && socialRoll < 0.25) {
          bot.rotateBlock(frontTileX, currentTileY);
          bot.say("Let's turn this block around, looks much cooler this way!");
          bot.nextActionAt = now + 3000;
          return;
        }

        // 2. Roam widely across designated street safely on ground
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 4) + 1);
        walkSafely(currentTileX + step);

        if (Math.random() < 0.2) {
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
