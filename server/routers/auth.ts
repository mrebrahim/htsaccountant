import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { schema } from "../db";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie } from "../auth";
import { PERMISSIONS } from "../../shared/constants";

const publicUser = (u: typeof schema.users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  permissions: u.role === "admin" ? [...PERMISSIONS] : u.permissions,
});

export const authRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const [{ count }] = await ctx.db.select({ count: sql<number>`count(*)::int` }).from(schema.users);
    return { needsSetup: count === 0, user: ctx.user ? publicUser(ctx.user) : null };
  }),

  // Creates the first administrator. Only allowed while the users table is empty.
  setup: publicProcedure
    .input(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const [{ count }] = await ctx.db.select({ count: sql<number>`count(*)::int` }).from(schema.users);
      if (count > 0) throw new TRPCError({ code: "FORBIDDEN", message: "تم إعداد النظام مسبقاً" });
      const [user] = await ctx.db
        .insert(schema.users)
        .values({
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash: await hashPassword(input.password),
          role: "admin",
          permissions: [...PERMISSIONS],
        })
        .returning();
      setSessionCookie(ctx.res, user.id);
      return publicUser(user);
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db.select().from(schema.users).where(eq(schema.users.email, input.email.toLowerCase()));
      if (!user || !user.active || !(await verifyPassword(input.password, user.passwordHash)))
        throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      setSessionCookie(ctx.res, user.id);
      return publicUser(user);
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.res);
    return { ok: true };
  }),

  changePassword: protectedProcedure
    .input(z.object({ current: z.string(), next: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await verifyPassword(input.current, ctx.user.passwordHash)))
        throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور الحالية غير صحيحة" });
      await ctx.db
        .update(schema.users)
        .set({ passwordHash: await hashPassword(input.next) })
        .where(eq(schema.users.id, ctx.user.id));
      return { ok: true };
    }),
});
