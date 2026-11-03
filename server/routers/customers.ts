import { z } from "zod";
import { asc, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, permitted } from "../trpc";
import { schema } from "../db";
import { accountBalances } from "./adAccounts";

const c = schema.customers;
const t = schema.transactions;

const customerInput = z.object({
  name: z.string().min(1).max(160),
  company: z.string().max(160).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  commissionRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export const customersRouter = router({
  /** Lightweight list for dropdowns; available to anyone who can link records to customers. */
  options: permitted("customers", "transactions", "ad_accounts", "campaigns", "reports").query(({ ctx }) =>
    ctx.db.select({ id: c.id, name: c.name }).from(c).orderBy(asc(c.name)),
  ),

  list: permitted("customers").query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: c.id,
        name: c.name,
        company: c.company,
        phone: c.phone,
        email: c.email,
        commissionRate: c.commissionRate,
        active: c.active,
        income: sql<number>`coalesce((select sum(amount) from transactions where customer_id = ${c.id} and type = 'income'), 0)::float`,
        expense: sql<number>`coalesce((select sum(amount) from transactions where customer_id = ${c.id} and type = 'expense'), 0)::float`,
        commissions: sql<number>`coalesce((select sum(amount) from transactions where customer_id = ${c.id} and category = 'commission'), 0)::float`,
        adAccounts: sql<number>`(select count(*) from ad_accounts where customer_id = ${c.id})::int`,
      })
      .from(c)
      .orderBy(asc(c.name));
  }),

  get: permitted("customers").input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [customer] = await ctx.db.select().from(c).where(eq(c.id, input.id));
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "العميل غير موجود" });

    const txs = await ctx.db
      .select()
      .from(t)
      .where(eq(t.customerId, input.id))
      .orderBy(desc(t.date), desc(t.id));

    const accounts = await accountBalances(ctx.db, eq(schema.adAccounts.customerId, input.id));

    const campaigns = await ctx.db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.customerId, input.id))
      .orderBy(desc(schema.campaigns.createdAt));

    const income = txs.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
    const expense = txs.filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
    const commissions = txs.filter((x) => x.category === "commission").reduce((s, x) => s + x.amount, 0);
    const funded = accounts.reduce((s, a) => s + a.funded, 0);
    const spend = accounts.reduce((s, a) => s + a.spend, 0);

    return {
      customer,
      transactions: txs,
      adAccounts: accounts,
      campaigns,
      summary: { income, expense, commissions, net: income - expense, funded, spend, adBalance: funded - spend },
    };
  }),

  create: permitted("customers").input(customerInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.insert(c).values({ ...input, email: input.email || null }).returning();
    return row;
  }),

  update: permitted("customers")
    .input(z.object({ id: z.number(), data: customerInput }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(c).set({ ...input.data, email: input.data.email || null }).where(eq(c.id, input.id));
      return { ok: true };
    }),

  delete: permitted("customers").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(c).where(eq(c.id, input.id));
    return { ok: true };
  }),
});
