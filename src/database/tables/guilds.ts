import type { Generated, GeneratedAlways, Insertable, Selectable, Updateable } from "kysely";

export type GuildRole = "leader" | "co_leader" | "elder" | "member";

export interface GuildTable {
  id: GeneratedAlways<number>;
  name: string;
  tag: string;
  statement: Generated<string>;
  leader_id: number;
  level: Generated<number>;
  exp: Generated<number>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  deleted_at: string | null;
}

export type GuildRecord = Selectable<GuildTable>;
export type NewGuildRecord = Insertable<GuildTable>;
export type GuildRecordUpdate = Updateable<GuildTable>;
