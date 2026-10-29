import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc.js";
import { getSetting, setSetting, fbConfig, listFbAdAccounts } from "../facebook.js";

export const settingsRouter = router({
  /** Non-sensitive settings needed by every user (company name, currency). */
  general: protectedProcedure.query(async ({ ctx }) => ({
    companyName: (await getSetting(ctx.db, "company_name")) ?? "HTS Media",
    currency: (await getSetting(ctx.db, "currency")) ?? "EGP",
  })),

  get: adminProcedure.query(async ({ ctx }) => {
    const token = (await getSetting(ctx.db, "fb_access_token")) ?? "";
    return {
      companyName: (await getSetting(ctx.db, "company_name")) ?? "HTS Media",
      currency: (await getSetting(ctx.db, "currency")) ?? "EGP",
      fbApiVersion: (await getSetting(ctx.db, "fb_api_version")) ?? "v21.0",
      // Never send the token back; only show whether one is configured.
      fbTokenSet: !!token || !!process.env.FB_ACCESS_TOKEN,
      fbTokenHint: token ? `••••${token.slice(-4)}` : process.env.FB_ACCESS_TOKEN ? "من متغيرات البيئة" : "",
    };
  }),

  save: adminProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        currency: z.string().min(1).max(10),
        fbApiVersion: z.string().regex(/^v\d+\.\d+$/),
        fbAccessToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await setSetting(ctx.db, "company_name", input.companyName);
      await setSetting(ctx.db, "currency", input.currency);
      await setSetting(ctx.db, "fb_api_version", input.fbApiVersion);
      if (input.fbAccessToken?.trim()) await setSetting(ctx.db, "fb_access_token", input.fbAccessToken.trim());
      return { ok: true };
    }),

  testFacebook: adminProcedure.mutation(async ({ ctx }) => {
    const cfg = await fbConfig(ctx.db);
    const accounts = await listFbAdAccounts(cfg);
    return { accounts: accounts.length };
  }),
});
