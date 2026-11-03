import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers";
import { createContext } from "@/server/trpc";

// Fail fast instead of leaving the UI on a spinner if the database stalls.
export const maxDuration = 30;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ path, error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC ${path}:`, error.cause ?? error);
    },
  });

export { handler as GET, handler as POST };
