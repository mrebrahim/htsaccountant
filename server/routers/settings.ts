import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc";
import { getSetting, setSetting } from "../settingsStore";

export const settingsRouter = router({
  /** Company name and currency, needed by every signed-in user. */
  general: protectedProcedure.query(async ({ ctx }) => ({
    companyName: (await getSetting(ctx.db, "company_name")) ?? "HTS Media",
    currency: (await getSetting(ctx.db, "currency")) ?? "EGP",
  })),

  save: adminProcedure
    .input(z.object({ companyName: z.string().min(1), currency: z.string().min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      await setSetting(ctx.db, "company_name", input.companyName);
      await setSetting(ctx.db, "currency", input.currency);
      return { ok: true };
    }),
});
