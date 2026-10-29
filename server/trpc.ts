import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { readSession, SESSION_COOKIE } from "./auth";
import type { Permission } from "../shared/constants";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const session = token ? readSession(token) : null;
  let user: typeof schema.users.$inferSelect | null = null;
  if (session) {
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId));
    if (row?.active) user = row;
  }
  return { req, res, db, user };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول أولاً" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "هذا القسم متاح لمدير النظام فقط" });
  return next();
});

export const hasPermission = (user: { role: string; permissions: Permission[] }, p: Permission) =>
  user.role === "admin" || user.permissions.includes(p);

/** Procedure gated on a section permission (admins always pass). */
export const permitted = (...perms: Permission[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!perms.some((p) => hasPermission(ctx.user, p)))
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية للوصول إلى هذا القسم" });
    return next();
  });
