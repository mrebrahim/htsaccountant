import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// prepare: false is required for Supabase's transaction pooler (port 6543).
const options = { prepare: false as const, max: process.env.VERCEL ? 1 : 10 };

/**
 * Supabase's pooler hostname differs per project (aws-0-…, aws-1-…). When DATABASE_URL
 * still has the literal placeholder "HOST", probe the regional poolers and use the first
 * one that accepts the credentials.
 */
async function resolveDatabaseUrl(raw: string) {
  const url = new URL(raw);
  if (url.hostname !== "HOST") return raw;
  const region = process.env.SUPABASE_REGION ?? "eu-west-1";
  for (const n of [0, 1, 2]) {
    url.hostname = `aws-${n}-${region}.pooler.supabase.com`;
    const probe = postgres(url.toString(), { ...options, max: 1, connect_timeout: 5 });
    try {
      await probe`select 1`;
      console.log(`Database pooler resolved to ${url.hostname}`);
      return url.toString();
    } catch {
      // wrong cluster ("Tenant or user not found") or unreachable — try the next one
    } finally {
      await probe.end({ timeout: 1 });
    }
  }
  throw new Error(`Could not find a Supabase pooler in ${region} accepting these credentials`);
}

function connect() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  return resolveDatabaseUrl(raw).then((url) => drizzle(postgres(url, options), { schema }));
}

export type DB = Awaited<ReturnType<typeof connect>>;

// One connection pool per server instance, created on first use.
let pending: Promise<DB> | undefined;
export function getDb() {
  pending ??= connect().catch((e) => {
    pending = undefined;
    throw e;
  });
  return pending;
}

export { schema };
