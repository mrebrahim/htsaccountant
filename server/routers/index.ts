import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { usersRouter } from "./users.js";
import { customersRouter } from "./customers.js";
import { transactionsRouter } from "./transactions.js";
import { adAccountsRouter } from "./adAccounts.js";
import { campaignsRouter } from "./campaigns.js";
import { employeesRouter } from "./employees.js";
import { reportsRouter, dashboardRouter } from "./reports.js";
import { settingsRouter } from "./settings.js";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  customers: customersRouter,
  transactions: transactionsRouter,
  adAccounts: adAccountsRouter,
  campaigns: campaignsRouter,
  employees: employeesRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
