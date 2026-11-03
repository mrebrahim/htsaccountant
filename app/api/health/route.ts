import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: true });
  } catch (e) {
    console.error("health: database unreachable", e);
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
