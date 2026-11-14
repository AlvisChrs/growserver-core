import { Variant } from "../packets/variants";
import { serverManager } from "../server/server-manager";
import { logger } from "../../utils/logger";

export enum GameEventType {
  NONE = "none",
  PINEAPPLE = "pineapple",
  CARNIVAL = "carnival",
  HALLOWEEN = "halloween",
  VOUCHER_DAYZ = "voucher",
}

export interface EventInfo {
  type: GameEventType;
  title: string;
  description: string;
  banner: string;
}

export const EVENT_DETAILS: Record<GameEventType, EventInfo> = {
  [GameEventType.NONE]: {
    type: GameEventType.NONE,
    title: "No Active Event",
    description: "Server is in standard mode.",
    banner: "No active event at the moment.",
  },
  [GameEventType.PINEAPPLE]: {
    type: GameEventType.PINEAPPLE,
    title: "Pineapple Week!",
    description: "Pineapples are in season! Extra gem bonuses and tropical vibes!",
    banner: "`#🍍 PINEAPPLE WEEK IS NOW ACTIVE! `2Enjoy sweet bonuses and floating pineapples everywhere!``",
  },
  [GameEventType.CARNIVAL]: {
    type: GameEventType.CARNIVAL,
    title: "The Carnival!",
    description: "The Ringmaster has pitched his tents! Celebrate games, quests, and prizes!",
    banner: "`6🎪 THE CARNIVAL HAS ARRIVED! `5Step right up and win magnificent prizes!``",
  },
  [GameEventType.HALLOWEEN]: {
    type: GameEventType.HALLOWEEN,
    title: "Halloween Ghost Hunt!",
    description: "Spooky spirits haunt the worlds! Catch ghosts and collect dark treasures!",
    banner: "`4🎃 HALLOWEEN HAS BEGUN! `oSpirits roam the worlds - grab your ghost gear and hunt!``",
  },
  [GameEventType.VOUCHER_DAYZ]: {
    type: GameEventType.VOUCHER_DAYZ,
    title: "Voucher Dayz!",
    description: "Extra store vouchers and special crate drops across all worlds!",
    banner: "`e🎟️ VOUCHER DAYZ ACTIVE! `3Earn bonus vouchers with every activity!``",
  },
};

export class EventManager {
  public activeEvent: GameEventType = GameEventType.NONE;
  public eventEndsAt: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  public get isActive(): boolean {
    return this.activeEvent !== GameEventType.NONE && Date.now() < this.eventEndsAt;
  }

  public get remainingSeconds(): number {
    if (!this.isActive) return 0;
    return Math.max(0, Math.floor((this.eventEndsAt - Date.now()) / 1000));
  }

  public get currentEvent(): EventInfo {
    return this.isActive ? EVENT_DETAILS[this.activeEvent] : EVENT_DETAILS[GameEventType.NONE];
  }

  public startEvent(type: GameEventType, durationMinutes: number = 60): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (type === GameEventType.NONE) {
      this.stopEvent();
      return;
    }

    this.activeEvent = type;
    this.eventEndsAt = Date.now() + durationMinutes * 60 * 1000;

    const info = EVENT_DETAILS[type];
    logger.info({ event: type, durationMinutes }, "global game event started");

    // Broadcast across all connected servers and worlds
    if (serverManager.players.size > 0) {
      try {
        const packet = Variant.from("OnConsoleMessage", info.banner).parsePacket();
        if (packet) serverManager.broadcast(packet);
      } catch (err) {
        logger.debug({ err }, "could not broadcast event banner");
      }
    }

    this.timer = setTimeout(() => {
      this.stopEvent();
    }, durationMinutes * 60 * 1000);
  }

  public stopEvent(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.activeEvent !== GameEventType.NONE) {
      const past = this.activeEvent;
      this.activeEvent = GameEventType.NONE;
      this.eventEndsAt = 0;
      logger.info({ pastEvent: past }, "global game event ended");
      if (serverManager.players.size > 0) {
        try {
          const packet = Variant.from("OnConsoleMessage", "`4[EVENT] The event has concluded. Normal server operations resumed.``").parsePacket();
          if (packet) serverManager.broadcast(packet);
        } catch (err) {
          logger.debug({ err }, "could not broadcast event end");
        }
      }
    }
  }
}

export const eventManager = new EventManager();
