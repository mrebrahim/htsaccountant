"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Spinner } from "./ui";
import Layout from "./Layout";
import LoginPage from "@/views/Login";
import type { Permission } from "@/shared/constants";

// Which section each route belongs to; "admin" routes are for administrators only.
const ROUTE_ACCESS: [prefix: string, access: Permission | "admin"][] = [
  ["/transactions", "transactions"],
  ["/customers", "customers"],
  ["/ad-accounts", "ad_accounts"],
  ["/campaigns", "campaigns"],
  ["/employees", "employees"],
  ["/reports", "reports"],
  ["/users", "admin"],
  ["/settings", "admin"],
];

const HOME_ORDER: [Permission, string][] = [
  ["dashboard", "/"],
  ["transactions", "/transactions"],
  ["customers", "/customers"],
  ["ad_accounts", "/ad-accounts"],
  ["campaigns", "/campaigns"],
  ["employees", "/employees"],
  ["reports", "/reports"],
];

const Denied = () => (
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
    ليس لديك صلاحية للوصول إلى هذه الصفحة. تواصل مع مدير النظام.
  </div>
);

function Guarded({ children }: { children: ReactNode }) {
  const { can, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === "/";
  const fallback = isHome && !can("dashboard") ? HOME_ORDER.find(([p]) => can(p))?.[1] : undefined;
  useEffect(() => {
    if (fallback) router.replace(fallback);
  }, [fallback, router]);

  if (isHome) return can("dashboard") ? <>{children}</> : fallback ? <Spinner /> : <Denied />;
  const rule = ROUTE_ACCESS.find(([prefix]) => pathname.startsWith(prefix));
  if (rule && (rule[1] === "admin" ? !isAdmin : !can(rule[1]))) return <Denied />;
  return <>{children}</>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const status = trpc.auth.status.useQuery();
  if (status.isLoading) return <Spinner />;
  if (status.error) return <div className="p-8 text-center text-rose-600">تعذر الاتصال بالخادم: {status.error.message}</div>;
  if (!status.data?.user) return <LoginPage needsSetup={status.data?.needsSetup ?? false} />;

  return (
    <AuthProvider user={status.data.user}>
      <Layout>
        <Guarded>{children}</Guarded>
      </Layout>
    </AuthProvider>
  );
}
