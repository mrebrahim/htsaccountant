import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { router, adminProcedure } from "../trpc";
import { schema } from "../db";
import { hashPassword } from "../auth";
import { PERMISSIONS, ROLES } from "../../shared/constants";

const userInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(PERMISSIONS)),
  active: z.boolean(),
});

const columns = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
  role: schema.users.role,
  permissions: schema.users.permissions,
  active: schema.users.active,
  createdAt: schema.users.createdAt,
};

export const usersRouter = router({
  list: adminProcedure.query(({ ctx }) => ctx.db.select(columns).from(schema.users).orderBy(asc(schema.users.id))),

  create: adminProcedure
    .input(userInput.extend({ password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();
      const [exists] = await ctx.db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني مستخدم بالفعل" });
      const { password, ...rest } = input;
      const [row] = await ctx.db
        .insert(schema.users)
        .values({ ...rest, email, passwordHash: await hashPassword(password) })
        .returning(columns);
      return row;
    }),

  update: adminProcedure
    .input(userInput.extend({ id: z.number(), password: z.string().min(8).optional().or(z.literal("")) }))
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...rest } = input;
      const email = rest.email.toLowerCase();
      const [dup] = await ctx.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.email, email), ne(schema.users.id, id)));
      if (dup) throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني مستخدم بالفعل" });
      if (id === ctx.user.id && (rest.role !== "admin" || !rest.active))
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك إزالة صلاحية المدير أو تعطيل حسابك" });
      await ctx.db
        .update(schema.users)
        .set({ ...rest, email, ...(password ? { passwordHash: await hashPassword(password) } : {}) })
        .where(eq(schema.users.id, id));
      return { ok: true };
    }),

  delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك حذف حسابك" });
    const [{ admins }] = await ctx.db
      .select({ admins: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(and(eq(schema.users.role, "admin"), ne(schema.users.id, input.id)));
    if (admins === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن يبقى مدير واحد على الأقل" });
    await ctx.db.delete(schema.users).where(eq(schema.users.id, input.id));
    return { ok: true };
  }),
});
