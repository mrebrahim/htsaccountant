import { z } from "zod";
import { and, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { router, permitted, adminProcedure } from "../trpc";
import { schema } from "../db";
import { fbConfig, fbCampaigns } from "../facebook";

const c = schema.campaigns;

const campaignInput = z.object({
  name: z.string().min(1).max(200),
  adAccountId: z.number().optional().nullable(),
  customerId: z.number().optional().nullable(),
  status: z.string().default("ACTIVE"),
  objective: z.string().optional().nullable(),
  budget: z.number().min(0).default(0),
  spend: z.number().min(0).default(0),
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  results: z.number().int().min(0).default(0),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const campaignsRouter = router({
  options: permitted("campaigns", "transactions").query(({ ctx }) =>
    ctx.db.select({ id: c.id, name: c.name, customerId: c.customerId }).from(c).orderBy(desc(c.createdAt)),
  ),

  list: permitted("campaigns")
    .input(z.object({ customerId: z.number().optional(), adAccountId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const conds: SQL[] = [];
      if (input.customerId) conds.push(eq(c.customerId, input.customerId));
      if (input.adAccountId) conds.push(eq(c.adAccountId, input.adAccountId));
      if (input.status) conds.push(eq(c.status, input.status));
      return ctx.db
        .select({
          campaign: c,
          customerName: schema.customers.name,
          adAccountName: schema.adAccounts.name,
          currency: schema.adAccounts.currency,
          linkedIncome: sql<number>`coalesce((select sum(amount) from transactions t where t.campaign_id = ${c.id} and t.type = 'income'), 0)::float`,
          linkedExpense: sql<number>`coalesce((select sum(amount) from transactions t where t.campaign_id = ${c.id} and t.type = 'expense'), 0)::float`,
        })
        .from(c)
        .leftJoin(schema.customers, eq(c.customerId, schema.customers.id))
        .leftJoin(schema.adAccounts, eq(c.adAccountId, schema.adAccounts.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(c.createdAt));
    }),

  create: permitted("campaigns").input(campaignInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.insert(c).values(input).returning();
    return row;
  }),

  update: permitted("campaigns")
    .input(z.object({ id: z.number(), data: campaignInput }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(c).set(input.data).where(eq(c.id, input.id));
      return { ok: true };
    }),

  delete: permitted("campaigns").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(c).where(eq(c.id, input.id));
    return { ok: true };
  }),

  /** Pull campaigns + lifetime performance from Facebook for every linked ad account (admins only). */
  syncFromFacebook: adminProcedure
    .input(z.object({ adAccountId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const cfg = await fbConfig(ctx.db);
      const accounts = await ctx.db
        .select()
        .from(schema.adAccounts)
        .where(
          and(
            isNotNull(schema.adAccounts.fbAccountId),
            input.adAccountId ? eq(schema.adAccounts.id, input.adAccountId) : undefined,
          ),
        );
      let synced = 0;
      const errors: string[] = [];
      for (const acc of accounts) {
        try {
          const remote = await fbCampaigns(cfg, acc.fbAccountId!);
          for (const r of remote) {
            const now = new Date();
            await ctx.db
              .insert(c)
              .values({ ...r, adAccountId: acc.id, customerId: acc.customerId, lastSyncedAt: now })
              .onConflictDoUpdate({
                target: c.fbCampaignId,
                set: {
                  name: r.name,
                  status: r.status,
                  objective: r.objective,
                  budget: r.budget,
                  spend: r.spend,
                  impressions: r.impressions,
                  clicks: r.clicks,
                  results: r.results,
                  startDate: r.startDate,
                  endDate: r.endDate,
                  adAccountId: acc.id,
                  lastSyncedAt: now,
                },
              });
            synced++;
          }
        } catch (e) {
          errors.push(`${acc.name}: ${(e as Error).message}`);
        }
      }
      return { synced, accounts: accounts.length, errors };
    }),
});
