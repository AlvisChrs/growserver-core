import { db } from "../db";
import type { GuildRecord, GuildRecordUpdate, NewGuildRecord } from "../tables/guilds";
import type { PlayerRecord } from "../tables/players";

export class GuildDB {
  public static async findById(id: number): Promise<GuildRecord | undefined> {
    return await db
      .selectFrom("guilds")
      .selectAll()
      .where("id", "==", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
  }

  public static async findByName(name: string): Promise<GuildRecord | undefined> {
    return await db
      .selectFrom("guilds")
      .selectAll()
      .where((eb) => eb(eb.fn("lower", ["name"]), "==", name.toLowerCase()))
      .where("deleted_at", "is", null)
      .executeTakeFirst();
  }

  public static async create(guild: NewGuildRecord): Promise<GuildRecord> {
    return await db
      .insertInto("guilds")
      .values(guild)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  public static async updateById(id: number, update: GuildRecordUpdate): Promise<void> {
    await db
      .updateTable("guilds")
      .set({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .where("id", "==", id)
      .execute();
  }

  public static async deleteById(id: number): Promise<void> {
    await db
      .updateTable("guilds")
      .set({
        deleted_at: new Date().toISOString(),
      })
      .where("id", "==", id)
      .execute();
  }

  public static async listTopGuilds(limit = 15): Promise<GuildRecord[]> {
    return await db
      .selectFrom("guilds")
      .selectAll()
      .where("deleted_at", "is", null)
      .orderBy("level", "desc")
      .orderBy("exp", "desc")
      .limit(limit)
      .execute();
  }

  public static async getMembers(guildId: number): Promise<PlayerRecord[]> {
    return await db
      .selectFrom("players")
      .selectAll()
      .where("guild_id", "==", guildId)
      .where("deleted_at", "is", null)
      .execute();
  }
}
