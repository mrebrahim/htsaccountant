import express from "express";
import cookieParser from "cookie-parser";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./trpc.js";
import { db } from "./db/index.js";
import { sql } from "drizzle-orm";

export const app = express();
app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ ok: true, db: true });
  } catch (e) {
    console.error("health: database unreachable", e);
    res.status(503).json({ ok: false, db: false });
  }
});
app.use("/api/trpc", trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ path, error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC ${path}:`, error.cause ?? error);
    },
  }));
