import { z } from "zod";
import { and, desc, eq, inArray, sql, ilike, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, permitted } from "../trpc.js";
import { schema } from "../db/index.js";
import { TRANSACTION_CATEGORIES, TRANSACTION_TYPES, categoriesForType } from "../../shared/constants.js";

const t = schema.transactions;

export const transactionFilter = z.object({
  type: z.enum(TRANSACTION_TYPES).optional(),
  categories: z.array(z.enum(TRANSACTION_CATEGORIES)).optional(),
  customerId: z.number().optional(),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  year: z.number().int().optional(),
  search: z.string().optional(),
});
export type TransactionFilter = z.infer<typeof transactionFilter>;

export function transactionWhere(f: TransactionFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (f.type) conds.push(eq(t.type, f.type));
  if (f.categories?.length) conds.push(inArray(t.category, f.categories));
  if (f.customerId) conds.push(eq(t.customerId, f.customerId));
  if (f.months?.length) conds.push(inArray(sql`to_char(${t.date}, 'YYYY-MM')`, f.months));
  if (f.year) conds.push(sql`extract(year from ${t.date}) = ${f.year}`);
  if (f.search?.trim()) conds.push(ilike(t.description, `%${f.search.trim()}%`));
  return conds.length ? and(...conds) : undefined;
}

const txInput = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    category: z.enum(TRANSACTION_CATEGORIES),
    amount: z.number().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().max(2000).optional().nullable(),
    customerId: z.number().optional().nullable(),
    campaignId: z.number().optional().nullable(),
  })
  .refine((v) => categoriesForType(v.type).includes(v.category), {
    message: "التصنيف لا يتوافق مع نوع المعاملة",
    path: ["category"],
  });

export const transactionsRouter = router({
  list: permitted("transactions").input(transactionFilter).query(async ({ ctx, input }) => {
    const where = transactionWhere(input);
    const rows = await ctx.db
      .select({
        id: t.id,
        type: t.type,
        category: t.category,
        amount: t.amount,
        date: t.date,
        description: t.description,
        customerId: t.customerId,
        campaignId: t.campaignId,
        employeeId: t.employeeId,
        customerName: schema.customers.name,
        campaignName: schema.campaigns.name,
      })
      .from(t)
      .leftJoin(schema.customers, eq(t.customerId, schema.customers.id))
      .leftJoin(schema.campaigns, eq(t.campaignId, schema.campaigns.id))
      .where(where)
      .orderBy(desc(t.date), desc(t.id))
      .limit(5000);

    const [totals] = await ctx.db
      .select({
        income: sql<number>`coalesce(sum(case when ${t.type} = 'income' then ${t.amount} end), 0)::float`,
        expense: sql<number>`coalesce(sum(case when ${t.type} = 'expense' then ${t.amount} end), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(t)
      .where(where);

    return { rows, totals: { ...totals, net: totals.income - totals.expense } };
  }),

  /** Distinct months that have transactions, newest first, for the month multi-select. */
  months: permitted("transactions", "reports").query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ month: sql<string>`to_char(${t.date}, 'YYYY-MM')` })
      .from(t)
      .orderBy(desc(sql`1`));
    return rows.map((r) => r.month);
  }),

  create: permitted("transactions").input(txInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.insert(t).values({ ...input, createdBy: ctx.user.id }).returning();
    return row;
  }),

  update: permitted("transactions")
    .input(z.object({ id: z.number(), data: txInput }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(t).set(input.data).where(eq(t.id, input.id)).returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "المعاملة غير موجودة" });
      return row;
    }),

  delete: permitted("transactions").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    // Unlink any employee payment / ad funding that generated this transaction.
    await ctx.db.update(schema.employeePayments).set({ transactionId: null }).where(eq(schema.employeePayments.transactionId, input.id));
    await ctx.db.update(schema.adFundings).set({ transactionId: null }).where(eq(schema.adFundings.transactionId, input.id));
    await ctx.db.delete(t).where(eq(t.id, input.id));
    return { ok: true };
  }),
});
