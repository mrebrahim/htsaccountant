import { eq } from "drizzle-orm";
import { schema, type DB } from "./db";

export async function getSetting(db: DB, key: string) {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? null;
}

export async function setSetting(db: DB, key: string, value: string) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}
