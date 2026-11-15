import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Migration 06: Adds friends_data, guild_id, and guild_role to players table,
 * and creates the guilds table.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Alter players table to add friends_data, guild_id, guild_role
  try {
    await db.schema.alterTable("players").addColumn("friends_data", "text").execute();
  } catch {}

  try {
    await db.schema.alterTable("players").addColumn("guild_id", "integer").execute();
  } catch {}

  try {
    await db.schema.alterTable("players").addColumn("guild_role", "text").execute();
  } catch {}

  // Create guilds table
  try {
    await db.schema
      .createTable("guilds")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("name", "text", (col) => col.notNull().unique())
      .addColumn("tag", "text", (col) => col.notNull())
      .addColumn("statement", "text", (col) => col.notNull().defaultTo("Welcome to our Guild!"))
      .addColumn("leader_id", "integer", (col) => col.notNull())
      .addColumn("level", "integer", (col) => col.notNull().defaultTo(1))
      .addColumn("exp", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
      .addColumn("deleted_at", "text")
      .execute();
  } catch {}
}

export async function down(db: Kysely<unknown>): Promise<void> {
  try {
    await db.schema.dropTable("guilds").execute();
  } catch {}
  try {
    await db.schema.alterTable("players").dropColumn("guild_role").execute();
  } catch {}
  try {
    await db.schema.alterTable("players").dropColumn("guild_id").execute();
  } catch {}
  try {
    await db.schema.alterTable("players").dropColumn("friends_data").execute();
  } catch {}
}
