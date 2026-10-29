import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { DB } from "./db/index.js";
import { schema } from "./db/index.js";

const DEFAULT_VERSION = "v21.0";

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

export async function fbConfig(db: DB) {
  const token = (await getSetting(db, "fb_access_token")) || process.env.FB_ACCESS_TOKEN || "";
  const version = (await getSetting(db, "fb_api_version")) || DEFAULT_VERSION;
  if (!token)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "لم يتم إعداد رمز الوصول لفيسبوك. يرجى إضافته من صفحة الإعدادات",
    });
  return { token, version };
}

type Paged<T> = { data: T[]; paging?: { next?: string } };

async function fbFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || body.error)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `خطأ من Facebook API: ${body.error?.message ?? res.statusText}`,
    });
  return body;
}

async function fbGetAll<T>(cfg: { token: string; version: string }, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, access_token: cfg.token, limit: "200" });
  let url: string | undefined = `https://graph.facebook.com/${cfg.version}/${path}?${qs}`;
  const out: T[] = [];
  for (let i = 0; url && i < 50; i++) {
    const page: Paged<T> = await fbFetch<Paged<T>>(url);
    out.push(...page.data);
    url = page.paging?.next;
  }
  return out;
}

const actId = (id: string) => (id.startsWith("act_") ? id : `act_${id}`);

export type FbAdAccount = {
  account_id: string;
  name: string;
  currency: string;
  account_status: number;
  amount_spent: string;
};

export function listFbAdAccounts(cfg: { token: string; version: string }) {
  return fbGetAll<FbAdAccount>(cfg, "me/adaccounts", {
    fields: "account_id,name,currency,account_status,amount_spent",
  });
}

/** Actual spend for an ad account split by calendar month (YYYY-MM -> amount). */
export async function fbMonthlySpend(cfg: { token: string; version: string }, accountId: string) {
  const rows = await fbGetAll<{ spend: string; date_start: string }>(cfg, `${actId(accountId)}/insights`, {
    fields: "spend",
    time_increment: "monthly",
    date_preset: "maximum",
  });
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const m = r.date_start.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + Number(r.spend || 0));
  }
  return byMonth;
}

export async function fbAccountInfo(cfg: { token: string; version: string }, accountId: string) {
  const qs = new URLSearchParams({ fields: "name,currency,account_status", access_token: cfg.token });
  return fbFetch<{ name: string; currency: string; account_status: number }>(
    `https://graph.facebook.com/${cfg.version}/${actId(accountId)}?${qs}`,
  );
}

type FbCampaign = {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  insights?: {
    data: { spend?: string; impressions?: string; clicks?: string; actions?: { action_type: string; value: string }[] }[];
  };
};

const RESULT_ACTIONS = [
  "purchase",
  "lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "complete_registration",
  "link_click",
];

export async function fbCampaigns(cfg: { token: string; version: string }, accountId: string) {
  const rows = await fbGetAll<FbCampaign>(cfg, `${actId(accountId)}/campaigns`, {
    fields:
      "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights.date_preset(maximum){spend,impressions,clicks,actions}",
  });
  return rows.map((c) => {
    const ins = c.insights?.data?.[0];
    const actions = ins?.actions ?? [];
    const result = RESULT_ACTIONS.map((t) => actions.find((a) => a.action_type === t)).find(Boolean);
    return {
      fbCampaignId: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective ?? null,
      // Budgets are returned in the account currency's minor unit.
      budget: Number(c.lifetime_budget || c.daily_budget || 0) / 100,
      spend: Number(ins?.spend ?? 0),
      impressions: Number(ins?.impressions ?? 0),
      clicks: Number(ins?.clicks ?? 0),
      results: Number(result?.value ?? 0),
      startDate: c.start_time ? c.start_time.slice(0, 10) : null,
      endDate: c.stop_time ? c.stop_time.slice(0, 10) : null,
    };
  });
}

export const FB_STATUS: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
};
