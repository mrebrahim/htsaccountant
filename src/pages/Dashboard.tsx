import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Scale, Wallet, Target, Percent, Users, UserCog, Megaphone, CalendarDays, Plus, BarChart3 } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { trpc } from "../lib/trpc";
import { formatDate, formatMoney, formatNumber } from "../lib/format";
import { useAuth } from "../lib/auth";
import { CATEGORY_LABELS, TRANSACTION_TYPE_LABELS, monthLabel, type TransactionCategory } from "../../shared/constants";
import { Badge, Card, ErrorBox, PageHeader, Spinner, StatCard, moneyTone, EmptyState } from "../components/ui";

export default function DashboardPage() {
  const { settings, can, user } = useAuth();
  const cur = settings.currency;
  const q = trpc.dashboard.overview.useQuery();

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox message={q.error.message} />;
  const { totals, trend, customerBalances, accounts, recent, counts } = q.data!;

  const chart = trend.map((t) => ({ name: monthLabel(t.month), الإيرادات: t.income, المصروفات: t.expense, الصافي: t.income - t.expense }));

  const quick = [
    { to: "/transactions", label: "معاملة جديدة", icon: Plus, perm: "transactions" as const },
    { to: "/customers", label: "العملاء", icon: Users, perm: "customers" as const },
    { to: "/employees", label: "الموظفين", icon: UserCog, perm: "employees" as const },
    { to: "/campaigns", label: "الحملات", icon: Megaphone, perm: "campaigns" as const },
    { to: "/ad-accounts", label: "ميزانيات الإعلانات", icon: Target, perm: "ad_accounts" as const },
    { to: "/reports", label: "التقارير", icon: BarChart3, perm: "reports" as const },
  ].filter((x) => can(x.perm));

  return (
    <div>
      <PageHeader title={`أهلاً، ${user.name}`} subtitle="نظرة عامة على الأداء المالي للشركة" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي الإيرادات" value={formatMoney(totals.income, cur)} tone="green" icon={<TrendingUp className="size-5" />} />
        <StatCard label="إجمالي المصروفات" value={formatMoney(totals.expense, cur)} tone="red" icon={<TrendingDown className="size-5" />} />
        <StatCard label="صافي الربح" value={<span className={moneyTone(totals.net)}>{formatMoney(totals.net, cur)}</span>} tone="blue" icon={<Scale className="size-5" />} />
        <StatCard
          label="صافي الشهر الحالي"
          value={<span className={moneyTone(totals.monthNet)}>{formatMoney(totals.monthNet, cur)}</span>}
          tone="violet"
          icon={<CalendarDays className="size-5" />}
          sub={`إيرادات ${formatNumber(totals.monthIncome)} · مصروفات ${formatNumber(totals.monthExpense)}`}
        />
        <StatCard label="العمولات" value={formatMoney(totals.commissions, cur)} tone="violet" icon={<Percent className="size-5" />} />
        <StatCard label="المبالغ الممولة للإعلانات" value={formatNumber(totals.funded)} tone="amber" icon={<Wallet className="size-5" />} />
        <StatCard label="الصرف الإعلاني الفعلي" value={formatNumber(totals.adSpend)} tone="red" icon={<Target className="size-5" />} />
        <StatCard label="رصيد الإعلانات المتبقي" value={<span className={moneyTone(totals.adBalance)}>{formatNumber(totals.adBalance)}</span>} tone="green" icon={<Scale className="size-5" />} />
      </div>

      {quick.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {quick.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-500 hover:text-brand-700">
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="الأداء المالي - آخر 12 شهر" className="lg:col-span-2">
          {chart.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" reversed tick={{ fontSize: 11 }} />
                  <YAxis orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} width={70} />
                  <Tooltip formatter={(v) => formatMoney(Number(v), cur)} />
                  <Legend />
                  <Bar dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المصروفات" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Line dataKey="الصافي" stroke="#2554e8" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text="لا توجد معاملات خلال آخر 12 شهر" />
          )}
        </Card>

        <Card title="مؤشرات سريعة">
          <dl className="space-y-3 text-sm">
            {[
              ["العملاء النشطين", counts.customers],
              ["الموظفين النشطين", counts.employees],
              ["الحملات النشطة", counts.campaigns],
              ["الحسابات الإعلانية", counts.adAccounts],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                <dt className="text-slate-600">{k}</dt>
                <dd className="text-lg font-extrabold">{formatNumber(v as number)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <dt className="text-slate-600">هامش الربح</dt>
              <dd className={`text-lg font-extrabold ${moneyTone(totals.net)}`}>{totals.income ? `${formatNumber((totals.net / totals.income) * 100)}%` : "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card title="أرصدة العملاء">
          {customerBalances.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {customerBalances.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  {can("customers") ? <Link to={`/customers/${c.id}`} className="font-semibold hover:text-brand-700">{c.name}</Link> : <span className="font-semibold">{c.name}</span>}
                  <span className={`font-bold ${moneyTone(c.net)}`}>{formatMoney(c.net, cur)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState />}
        </Card>

        <Card title="أرصدة الحسابات الإعلانية">
          {accounts.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{a.name}</span>
                    <span className="text-xs text-slate-500">ممول {formatNumber(a.funded)} · صرف {formatNumber(a.spend)}</span>
                  </span>
                  <span className={`whitespace-nowrap font-bold ${moneyTone(a.balance)}`}>{formatMoney(a.balance, a.currency)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState />}
        </Card>

        <Card title="أحدث المعاملات">
          {recent.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.description || CATEGORY_LABELS[r.category as TransactionCategory]}</span>
                    <span className="text-xs text-slate-500">{formatDate(r.date)}{r.customerName && ` · ${r.customerName}`}</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className={`whitespace-nowrap font-bold ${r.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(r.amount, cur)}</span>
                    <Badge tone={r.type === "income" ? "green" : "red"}>{TRANSACTION_TYPE_LABELS[r.type]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : <EmptyState />}
        </Card>
      </div>
    </div>
  );
}
