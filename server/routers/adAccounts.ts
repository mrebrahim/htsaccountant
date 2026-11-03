import { z } from "zod";
import { asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, permitted } from "../trpc";
import { schema, type DB } from "../db";
import { AD_ACCOUNT_OWNERSHIP } from "../../shared/constants";

const a = schema.adAccounts;

/** Ad accounts with funded total, actual spend and net balance (funded - spend). */
export async function accountBalances(db: DB, where?: SQL) {
  const rows = await db
    .select({
      id: a.id,
      name: a.name,
      fbAccountId: a.fbAccountId,
      ownership: a.ownership,
      customerId: a.customerId,
      customerName: schema.customers.name,
      currency: a.currency,
      accountStatus: a.accountStatus,
      notes: a.notes,
      lastSyncedAt: a.lastSyncedAt,
      funded: sql<number>`coalesce((select sum(amount) from ad_fundings f where f.ad_account_id = ${a.id}), 0)::float`,
      spend: sql<number>`coalesce((select sum(spend) from ad_spend s where s.ad_account_id = ${a.id}), 0)::float`,
    })
    .from(a)
    .leftJoin(schema.customers, eq(a.customerId, schema.customers.id))
    .where(where)
    .orderBy(asc(a.name));
  return rows.map((r) => ({ ...r, balance: r.funded - r.spend }));
}

const accountInput = z.object({
  name: z.string().min(1).max(160),
  fbAccountId: z
    .string()
    .trim()
    .transform((v) => v.replace(/^act_/, ""))
    .optional()
    .nullable(),
  ownership: z.enum(AD_ACCOUNT_OWNERSHIP),
  customerId: z.number().optional().nullable(),
  currency: z.string().min(1).max(10).default("USD"),
  notes: z.string().optional().nullable(),
});

export const adAccountsRouter = router({
  options: permitted("ad_accounts", "campaigns").query(({ ctx }) =>
    ctx.db.select({ id: a.id, name: a.name, customerId: a.customerId }).from(a).orderBy(asc(a.name)),
  ),

  list: permitted("ad_accounts").query(({ ctx }) => accountBalances(ctx.db)),

  get: permitted("ad_accounts").input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [account] = await accountBalances(ctx.db, eq(a.id, input.id));
    if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب الإعلاني غير موجود" });
    const fundings = await ctx.db
      .select()
      .from(schema.adFundings)
      .where(eq(schema.adFundings.adAccountId, input.id))
      .orderBy(desc(schema.adFundings.date), desc(schema.adFundings.id));
    const spend = await ctx.db
      .select()
      .from(schema.adSpend)
      .where(eq(schema.adSpend.adAccountId, input.id))
      .orderBy(desc(schema.adSpend.month));
    const campaigns = await ctx.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.adAccountId, input.id))
      .orderBy(desc(schema.campaigns.createdAt));
    return { account, fundings, spend, campaigns };
  }),

  create: permitted("ad_accounts").input(accountInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.insert(a).values({ ...input, fbAccountId: input.fbAccountId || null }).returning();
    return row;
  }),

  update: permitted("ad_accounts")
    .input(z.object({ id: z.number(), data: accountInput }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(a)
        .set({ ...input.data, fbAccountId: input.data.fbAccountId || null })
        .where(eq(a.id, input.id));
      return { ok: true };
    }),

  delete: permitted("ad_accounts").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(a).where(eq(a.id, input.id));
    return { ok: true };
  }),

  addFunding: permitted("ad_accounts")
    .input(
      z.object({
        adAccountId: z.number(),
        amount: z.number().positive(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().optional().nullable(),
        recordExpense: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [acc] = await ctx.db.select().from(a).where(eq(a.id, input.adAccountId));
      if (!acc) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب الإعلاني غير موجود" });
      return ctx.db.transaction(async (tx) => {
        let transactionId: number | null = null;
        if (input.recordExpense) {
          const [t] = await tx
            .insert(schema.transactions)
            .values({
              type: "expense",
              category: "ad_spend",
              amount: input.amount,
              date: input.date,
              description: `تمويل الحساب الإعلاني: ${acc.name}${input.note ? ` - ${input.note}` : ""}`,
              customerId: acc.customerId,
              createdBy: ctx.user.id,
            })
            .returning({ id: schema.transactions.id });
          transactionId = t.id;
        }
        const [row] = await tx
          .insert(schema.adFundings)
          .values({ adAccountId: input.adAccountId, amount: input.amount, date: input.date, note: input.note, transactionId })
          .returning();
        return row;
      });
    }),

  deleteFunding: permitted("ad_accounts").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.delete(schema.adFundings).where(eq(schema.adFundings.id, input.id)).returning();
    if (row?.transactionId) await ctx.db.delete(schema.transactions).where(eq(schema.transactions.id, row.transactionId));
    return { ok: true };
  }),

  /** Manually record actual spend for a month (for accounts without API access). */
  setSpend: permitted("ad_accounts")
    .input(z.object({ adAccountId: z.number(), month: z.string().regex(/^\d{4}-\d{2}$/), spend: z.number().min(0) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(schema.adSpend)
        .values({ ...input, source: "manual" })
        .onConflictDoUpdate({
          target: [schema.adSpend.adAccountId, schema.adSpend.month],
          set: { spend: input.spend, source: "manual", updatedAt: new Date() },
        });
      return { ok: true };
    }),

  deleteSpend: permitted("ad_accounts").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(schema.adSpend).where(eq(schema.adSpend.id, input.id));
    return { ok: true };
  }),
});
