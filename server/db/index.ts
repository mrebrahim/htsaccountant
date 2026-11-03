import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// prepare: false keeps queries compatible with Supabase's pooler. Short idle_timeout closes
// connections before a serverless instance is frozen, so the pooler never holds half-sent queries.
const options = {
  prepare: false as const,
  max: process.env.VERCEL ? 1 : 10,
  connect_timeout: 10,
  idle_timeout: 20,
};

const PROBE_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

/** Rejects unless this URL accepts the credentials and answers a query within the time limit. */
async function probe(url: string) {
  const sql = postgres(url, { ...options, max: 1 });
  try {
    await withTimeout(sql`select 1`, PROBE_TIMEOUT_MS);
    return url;
  } finally {
    sql.end({ timeout: 0 }).catch(() => {});
  }
}

/**
 * Supabase's pooler hostname differs per project (aws-0-…, aws-1-…). When DATABASE_URL
 * still has the literal placeholder "HOST", probe the regional poolers in parallel and use
 * the one that accepts the credentials. Session mode (port 5432) is used for the probed
 * host: transaction mode (6543) was leaving queries stuck mid-statement.
 */
async function resolveDatabaseUrl(raw: string) {
  const url = new URL(raw);
  if (url.hostname !== "HOST") return raw;
  const region = process.env.SUPABASE_REGION ?? "eu-west-1";
  const candidates = [0, 1, 2].map((n) => {
    const u = new URL(url);
    u.hostname = `aws-${n}-${region}.pooler.supabase.com`;
    u.port = "5432";
    return u.toString();
  });
  try {
    return await Promise.any(candidates.map(probe));
  } catch {
    throw new Error(`Could not find a Supabase pooler in ${region} accepting these credentials`);
  }
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
