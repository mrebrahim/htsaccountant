import { z } from "zod";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { router, permitted } from "../trpc.js";
import { schema } from "../db/index.js";
import { transactionFilter, transactionWhere } from "./transactions.js";
import { accountBalances } from "./adAccounts.js";

const t = schema.transactions;

export const reportsRouter = router({
  years: permitted("reports", "dashboard").query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ year: sql<number>`extract(year from ${t.date})::int` })
      .from(t)
      .orderBy(desc(sql`1`));
    const years = rows.map((r) => r.year);
    const current = new Date().getFullYear();
    if (!years.includes(current)) years.unshift(current);
    return years;
  }),

  /** Monthly P&L for a year, honoring the same filters as the transactions page. */
  yearly: permitted("reports")
    .input(transactionFilter.extend({ year: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const where = transactionWhere(input);
      const monthly = await ctx.db
        .select({
          month: sql<number>`extract(month from ${t.date})::int`,
          income: sql<number>`coalesce(sum(case when ${t.type} = 'income' then ${t.amount} end), 0)::float`,
          expense: sql<number>`coalesce(sum(case when ${t.type} = 'expense' then ${t.amount} end), 0)::float`,
          commissions: sql<number>`coalesce(sum(case when ${t.category} = 'commission' then ${t.amount} end), 0)::float`,
        })
        .from(t)
        .where(where)
        .groupBy(sql`1`);

      const byCategory = await ctx.db
        .select({
          type: t.type,
          category: t.category,
          total: sql<number>`sum(${t.amount})::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(t)
        .where(where)
        .groupBy(t.type, t.category)
        .orderBy(desc(sql`sum(${t.amount})`));

      // Advertising funds and spend, optionally scoped to a customer's ad accounts.
      const accountScope: SQL[] = [];
      if (input.customerId) accountScope.push(eq(schema.adAccounts.customerId, input.customerId));
      const ys = String(input.year);
      const funded = await ctx.db
        .select({
          month: sql<number>`extract(month from ${schema.adFundings.date})::int`,
          total: sql<number>`sum(${schema.adFundings.amount})::float`,
        })
        .from(schema.adFundings)
        .innerJoin(schema.adAccounts, eq(schema.adFundings.adAccountId, schema.adAccounts.id))
        .where(and(sql`extract(year from ${schema.adFundings.date}) = ${input.year}`, ...accountScope))
        .groupBy(sql`1`);
      const spend = await ctx.db
        .select({
          month: sql<number>`substring(${schema.adSpend.month}, 6, 2)::int`,
          total: sql<number>`sum(${schema.adSpend.spend})::float`,
        })
        .from(schema.adSpend)
        .innerJoin(schema.adAccounts, eq(schema.adSpend.adAccountId, schema.adAccounts.id))
        .where(and(sql`left(${schema.adSpend.month}, 4) = ${ys}`, ...accountScope))
        .groupBy(sql`1`);

      const selectedMonths = input.months?.length
        ? new Set(input.months.filter((m) => m.startsWith(ys)).map((m) => Number(m.slice(5))))
        : null;

      const months = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const tx = monthly.find((r) => r.month === m);
        const inScope = !selectedMonths || selectedMonths.has(m);
        const income = tx?.income ?? 0;
        const expense = tx?.expense ?? 0;
        return {
          month: m,
          income,
          expense,
          net: income - expense,
          commissions: tx?.commissions ?? 0,
          funded: inScope ? (funded.find((r) => r.month === m)?.total ?? 0) : 0,
          adSpend: inScope ? (spend.find((r) => r.month === m)?.total ?? 0) : 0,
        };
      });

      const sum = (k: keyof (typeof months)[number]) => months.reduce((s, r) => s + (r[k] as number), 0);
      return {
        months,
        byCategory,
        totals: {
          income: sum("income"),
          expense: sum("expense"),
          net: sum("net"),
          commissions: sum("commissions"),
          funded: sum("funded"),
          adSpend: sum("adSpend"),
        },
      };
    }),
});

export const dashboardRouter = router({
  overview: permitted("dashboard").query(async ({ ctx }) => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [all] = await ctx.db
      .select({
        income: sql<number>`coalesce(sum(case when ${t.type} = 'income' then ${t.amount} end), 0)::float`,
        expense: sql<number>`coalesce(sum(case when ${t.type} = 'expense' then ${t.amount} end), 0)::float`,
        commissions: sql<number>`coalesce(sum(case when ${t.category} = 'commission' then ${t.amount} end), 0)::float`,
        monthIncome: sql<number>`coalesce(sum(case when ${t.type} = 'income' and to_char(${t.date}, 'YYYY-MM') = ${ym} then ${t.amount} end), 0)::float`,
        monthExpense: sql<number>`coalesce(sum(case when ${t.type} = 'expense' and to_char(${t.date}, 'YYYY-MM') = ${ym} then ${t.amount} end), 0)::float`,
      })
      .from(t);

    // Last 12 months trend
    const trend = await ctx.db
      .select({
        month: sql<string>`to_char(${t.date}, 'YYYY-MM')`,
        income: sql<number>`coalesce(sum(case when ${t.type} = 'income' then ${t.amount} end), 0)::float`,
        expense: sql<number>`coalesce(sum(case when ${t.type} = 'expense' then ${t.amount} end), 0)::float`,
      })
      .from(t)
      .where(sql`${t.date} >= date_trunc('month', current_date) - interval '11 months'`)
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const accounts = await accountBalances(ctx.db);
    const funded = accounts.reduce((s, a) => s + a.funded, 0);
    const adSpend = accounts.reduce((s, a) => s + a.spend, 0);

    const customerBalances = await ctx.db
      .select({
        id: schema.customers.id,
        name: schema.customers.name,
        income: sql<number>`coalesce(sum(case when ${t.type} = 'income' then ${t.amount} end), 0)::float`,
        expense: sql<number>`coalesce(sum(case when ${t.type} = 'expense' then ${t.amount} end), 0)::float`,
      })
      .from(schema.customers)
      .leftJoin(t, eq(t.customerId, schema.customers.id))
      .groupBy(schema.customers.id, schema.customers.name)
      .orderBy(desc(sql`coalesce(sum(case when ${t.type} = 'income' then ${t.amount} end), 0)`))
      .limit(8);

    const recent = await ctx.db
      .select({
        id: t.id,
        type: t.type,
        category: t.category,
        amount: t.amount,
        date: t.date,
        description: t.description,
        customerName: schema.customers.name,
      })
      .from(t)
      .leftJoin(schema.customers, eq(t.customerId, schema.customers.id))
      .orderBy(desc(t.date), desc(t.id))
      .limit(8);

    const [counts] = await ctx.db.select({
      customers: sql<number>`(select count(*) from customers where active)::int`,
      employees: sql<number>`(select count(*) from employees where active)::int`,
      campaigns: sql<number>`(select count(*) from campaigns where status = 'ACTIVE')::int`,
      adAccounts: sql<number>`(select count(*) from ad_accounts)::int`,
    }).from(sql`(select 1) as one`);

    return {
      totals: { ...all, net: all.income - all.expense, monthNet: all.monthIncome - all.monthExpense, funded, adSpend, adBalance: funded - adSpend },
      trend,
      customerBalances: customerBalances.map((c) => ({ ...c, net: c.income - c.expense })),
      accounts: accounts.sort((a, b) => a.balance - b.balance).slice(0, 6),
      recent,
      counts,
    };
  }),
});
