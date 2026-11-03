"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (count, err) =>
              !(err instanceof TRPCClientError && ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(err.data?.code)) && count < 2,
          },
        },
      }),
  );
  const [client] = useState(() => trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] }));
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppShell>{children}</AppShell>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
