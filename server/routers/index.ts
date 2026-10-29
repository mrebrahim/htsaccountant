import { router } from "../trpc";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { customersRouter } from "./customers";
import { transactionsRouter } from "./transactions";
import { adAccountsRouter } from "./adAccounts";
import { campaignsRouter } from "./campaigns";
import { employeesRouter } from "./employees";
import { reportsRouter, dashboardRouter } from "./reports";
import { settingsRouter } from "./settings";

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
