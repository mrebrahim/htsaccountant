import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { trpc } from "./lib/trpc";
import { AuthProvider, useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import TransactionsPage from "./pages/Transactions";
import CustomersPage from "./pages/Customers";
import CustomerDetailPage from "./pages/CustomerDetail";
import AdAccountsPage from "./pages/AdAccounts";
import AdAccountDetailPage from "./pages/AdAccountDetail";
import CampaignsPage from "./pages/Campaigns";
import EmployeesPage from "./pages/Employees";
import EmployeeDetailPage from "./pages/EmployeeDetail";
import ReportsPage from "./pages/Reports";
import UsersPage from "./pages/Users";
import SettingsPage from "./pages/Settings";
import type { Permission } from "../shared/constants";

function Guard({ perm, admin, children }: { perm?: Permission; admin?: boolean; children: ReactNode }) {
  const { can, isAdmin } = useAuth();
  if ((admin && !isAdmin) || (perm && !can(perm)))
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        ليس لديك صلاحية للوصول إلى هذه الصفحة. تواصل مع مدير النظام.
      </div>
    );
  return <>{children}</>;
}

function Home() {
  const { can } = useAuth();
  const order: [Permission, string][] = [
    ["dashboard", "/"],
    ["transactions", "/transactions"],
    ["customers", "/customers"],
    ["ad_accounts", "/ad-accounts"],
    ["campaigns", "/campaigns"],
    ["employees", "/employees"],
    ["reports", "/reports"],
  ];
  if (can("dashboard")) return <DashboardPage />;
  const first = order.find(([p]) => can(p));
  return first ? <Navigate to={first[1]} replace /> : <Guard perm="dashboard">{null}</Guard>;
}

export default function App() {
  const status = trpc.auth.status.useQuery();
  if (status.isLoading) return <Spinner />;
  if (status.error) return <div className="p-8 text-center text-rose-600">تعذر الاتصال بالخادم: {status.error.message}</div>;
  if (!status.data?.user) return <LoginPage needsSetup={status.data?.needsSetup ?? false} />;

  return (
    <AuthProvider user={status.data.user}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/transactions" element={<Guard perm="transactions"><TransactionsPage /></Guard>} />
          <Route path="/customers" element={<Guard perm="customers"><CustomersPage /></Guard>} />
          <Route path="/customers/:id" element={<Guard perm="customers"><CustomerDetailPage /></Guard>} />
          <Route path="/ad-accounts" element={<Guard perm="ad_accounts"><AdAccountsPage /></Guard>} />
          <Route path="/ad-accounts/:id" element={<Guard perm="ad_accounts"><AdAccountDetailPage /></Guard>} />
          <Route path="/campaigns" element={<Guard perm="campaigns"><CampaignsPage /></Guard>} />
          <Route path="/employees" element={<Guard perm="employees"><EmployeesPage /></Guard>} />
          <Route path="/employees/:id" element={<Guard perm="employees"><EmployeeDetailPage /></Guard>} />
          <Route path="/reports" element={<Guard perm="reports"><ReportsPage /></Guard>} />
          <Route path="/users" element={<Guard admin><UsersPage /></Guard>} />
          <Route path="/settings" element={<Guard admin><SettingsPage /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
