import { createContext, useContext, type ReactNode } from "react";
import { trpc, type RouterOutputs } from "./trpc";
import type { Permission } from "../../shared/constants";

type User = NonNullable<RouterOutputs["auth"]["status"]["user"]>;
type Settings = RouterOutputs["settings"]["general"];

const AuthCtx = createContext<{ user: User; settings: Settings; can: (p: Permission) => boolean; isAdmin: boolean } | null>(null);

export function AuthProvider({ user, children }: { user: User; children: ReactNode }) {
  const settings = trpc.settings.general.useQuery(undefined, { staleTime: 60_000 });
  const isAdmin = user.role === "admin";
  const can = (p: Permission) => isAdmin || user.permissions.includes(p);
  return (
    <AuthCtx.Provider value={{ user, settings: settings.data ?? { companyName: "HTS Media", currency: "EGP" }, can, isAdmin }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** Formats money in the company's configured currency. */
export { formatMoney } from "./format";
export const useCurrency = () => useAuth().settings.currency;
