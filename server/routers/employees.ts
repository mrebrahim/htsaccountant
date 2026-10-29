import { z } from "zod";
import { asc, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, permitted } from "../trpc.js";
import { schema } from "../db/index.js";
import { EMPLOYEE_PAYMENT_TYPES, EMPLOYEE_PAYMENT_LABELS, monthLabel, type EmployeePaymentType } from "../../shared/constants.js";

const e = schema.employees;
const p = schema.employeePayments;

const employeeInput = z.object({
  name: z.string().min(1).max(160),
  jobTitle: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  baseSalary: z.number().min(0),
  hireDate: z.string().optional().nullable(),
  userId: z.number().optional().nullable(),
  active: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

// Payment types that represent cash leaving the company and are recorded as expenses.
const CASH_OUT: readonly string[] = ["salary", "advance", "bonus"];

export const employeesRouter = router({
  list: permitted("employees").query(({ ctx }) =>
    ctx.db
      .select({
        employee: e,
        advances: sql<number>`coalesce((select sum(amount) from employee_payments where employee_id = ${e.id} and type = 'advance'), 0)::float`,
        paid: sql<number>`coalesce((select sum(amount) from employee_payments where employee_id = ${e.id} and type in ('salary','bonus')), 0)::float`,
      })
      .from(e)
      .orderBy(asc(e.name)),
  ),

  get: permitted("employees").input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [employee] = await ctx.db.select().from(e).where(eq(e.id, input.id));
    if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "الموظف غير موجود" });
    const payments = await ctx.db.select().from(p).where(eq(p.employeeId, input.id)).orderBy(desc(p.date), desc(p.id));

    // Payroll per month: base salary + bonuses + adjustments - deductions - advances = net due.
    type Totals = Record<EmployeePaymentType, number>;
    const months = new Map<string, Totals>();
    for (const pay of payments) {
      const m = months.get(pay.month) ?? { salary: 0, advance: 0, deduction: 0, bonus: 0, adjustment: 0 };
      m[pay.type as EmployeePaymentType] += pay.amount;
      months.set(pay.month, m);
    }
    const payroll = [...months.entries()]
      .sort(([x], [y]) => y.localeCompare(x))
      .map(([month, m]) => {
        const due = employee.baseSalary + m.bonus + m.adjustment - m.deduction - m.advance;
        return { month, ...m, due, remaining: due - m.salary };
      });
    return { employee, payments, payroll };
  }),

  create: permitted("employees").input(employeeInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.insert(e).values({ ...input, email: input.email || null }).returning();
    return row;
  }),

  update: permitted("employees")
    .input(z.object({ id: z.number(), data: employeeInput }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(e).set({ ...input.data, email: input.data.email || null }).where(eq(e.id, input.id));
      return { ok: true };
    }),

  delete: permitted("employees").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(e).where(eq(e.id, input.id));
    return { ok: true };
  }),

  addPayment: permitted("employees")
    .input(
      z.object({
        employeeId: z.number(),
        type: z.enum(EMPLOYEE_PAYMENT_TYPES),
        amount: z.number().positive(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        month: z.string().regex(/^\d{4}-\d{2}$/),
        note: z.string().optional().nullable(),
        recordExpense: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [emp] = await ctx.db.select().from(e).where(eq(e.id, input.employeeId));
      if (!emp) throw new TRPCError({ code: "NOT_FOUND", message: "الموظف غير موجود" });
      const { recordExpense, ...data } = input;
      return ctx.db.transaction(async (tx) => {
        let transactionId: number | null = null;
        if (recordExpense && CASH_OUT.includes(input.type)) {
          const [t] = await tx
            .insert(schema.transactions)
            .values({
              type: "expense",
              category: "salaries",
              amount: input.amount,
              date: input.date,
              description: `${EMPLOYEE_PAYMENT_LABELS[input.type]} - ${emp.name} (${monthLabel(input.month)})${input.note ? ` - ${input.note}` : ""}`,
              employeeId: emp.id,
              createdBy: ctx.user.id,
            })
            .returning({ id: schema.transactions.id });
          transactionId = t.id;
        }
        const [row] = await tx.insert(p).values({ ...data, transactionId }).returning();
        return row;
      });
    }),

  deletePayment: permitted("employees").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db.delete(p).where(eq(p.id, input.id)).returning();
    if (row?.transactionId) await ctx.db.delete(schema.transactions).where(eq(schema.transactions.id, row.transactionId));
    return { ok: true };
  }),
});
