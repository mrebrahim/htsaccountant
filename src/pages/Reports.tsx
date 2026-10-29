import { useDeferredValue, useState } from "react";
import { FileSpreadsheet, TrendingUp, TrendingDown, Scale, Percent, Wallet, Target } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { trpc } from "../lib/trpc";
import { formatMoney, formatNumber } from "../lib/format";
import { useAuth } from "../lib/auth";
import { exportToExcel } from "../lib/excel";
import { CATEGORY_LABELS, MONTH_NAMES, TRANSACTION_TYPE_LABELS, type TransactionCategory } from "../../shared/constants";
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner, StatCard, Table, Td, moneyTone } from "../components/ui";
import { TransactionFilters, emptyFilters, toQuery, type Filters } from "../components/TransactionFilters";

export default function ReportsPage() {
  const { settings } = useAuth();
  const cur = settings.currency;
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, year: new Date().getFullYear() });
  const query = useDeferredValue({ ...toQuery(filters), year: filters.year ?? new Date().getFullYear() });
  const q = trpc.reports.yearly.useQuery(query, { placeholderData: (p) => p });

  const data = q.data;
  const chart = (data?.months ?? []).map((m) => ({
    name: MONTH_NAMES[m.month - 1],
    الإيرادات: m.income,
    المصروفات: m.expense,
    "صافي الربح": m.net,
    العمولات: m.commissions,
    "المبالغ الممولة": m.funded,
    "الصرف الإعلاني": m.adSpend,
  }));

  const doExport = () => {
    if (!data) return;
    const rows: Record<string, unknown>[] = data.months.map((m) => ({
      الشهر: `${MONTH_NAMES[m.month - 1]} ${query.year}`,
      الإيرادات: m.income,
      المصروفات: m.expense,
      "صافي الربح / الخسارة": m.net,
      العمولات: m.commissions,
      "المبالغ الممولة": m.funded,
      "الصرف الإعلاني": m.adSpend,
    }));
    rows.push({
      الشهر: "الإجمالي",
      الإيرادات: data.totals.income,
      المصروفات: data.totals.expense,
      "صافي الربح / الخسارة": data.totals.net,
      العمولات: data.totals.commissions,
      "المبالغ الممولة": data.totals.funded,
      "الصرف الإعلاني": data.totals.adSpend,
    });
    exportToExcel(rows, `تقرير-الأرباح-والخسائر-${query.year}`, `تقرير ${query.year}`);
  };

  const fmt = (v: unknown) => formatMoney(Number(v), cur);

  return (
    <div>
      <PageHeader
        title="التقارير والتحليلات"
        subtitle={`تقرير الأرباح والخسائر لسنة ${query.year}`}
        actions={<Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} onClick={doExport} disabled={!data}>تصدير Excel</Button>}
      />
      <TransactionFilters value={filters} onChange={setFilters} showYear showSearch={false} />
      <ErrorBox message={q.error?.message} />
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="الإيرادات" value={formatMoney(data.totals.income, cur)} tone="green" icon={<TrendingUp className="size-5" />} />
            <StatCard label="المصروفات" value={formatMoney(data.totals.expense, cur)} tone="red" icon={<TrendingDown className="size-5" />} />
            <StatCard label={data.totals.net >= 0 ? "صافي الربح" : "صافي الخسارة"} value={<span className={moneyTone(data.totals.net)}>{formatMoney(data.totals.net, cur)}</span>} tone="blue" icon={<Scale className="size-5" />} />
            <StatCard label="العمولات" value={formatMoney(data.totals.commissions, cur)} tone="violet" icon={<Percent className="size-5" />} />
            <StatCard label="المبالغ الممولة" value={formatNumber(data.totals.funded)} tone="amber" icon={<Wallet className="size-5" />} />
            <StatCard label="الصرف الإعلاني" value={formatNumber(data.totals.adSpend)} tone="red" icon={<Target className="size-5" />} />
          </div>

          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <Card title="الإيرادات والمصروفات الشهرية">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" reversed tick={{ fontSize: 11 }} />
                    <YAxis orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} width={70} />
                    <Tooltip formatter={fmt} />
                    <Legend />
                    <Bar dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="المصروفات" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="منحنى الأرباح والخسائر السنوي">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" reversed tick={{ fontSize: 11 }} />
                    <YAxis orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} width={70} />
                    <Tooltip formatter={fmt} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <Line dataKey="صافي الربح" stroke="#2554e8" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line dataKey="العمولات" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="التمويل الإعلاني مقابل الصرف الفعلي" className="xl:col-span-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" reversed tick={{ fontSize: 11 }} />
                    <YAxis orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} width={70} />
                    <Tooltip formatter={(v) => formatNumber(Number(v))} />
                    <Legend />
                    <Bar dataKey="المبالغ الممولة" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="الصرف الإعلاني" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Table
                head={["الشهر", "الإيرادات", "المصروفات", "صافي الربح", "العمولات", "الممول", "الصرف الإعلاني"]}
                footer={
                  <tr>
                    <Td>الإجمالي</Td>
                    <Td className="text-emerald-600">{formatNumber(data.totals.income)}</Td>
                    <Td className="text-rose-600">{formatNumber(data.totals.expense)}</Td>
                    <Td className={moneyTone(data.totals.net)}>{formatNumber(data.totals.net)}</Td>
                    <Td>{formatNumber(data.totals.commissions)}</Td>
                    <Td>{formatNumber(data.totals.funded)}</Td>
                    <Td>{formatNumber(data.totals.adSpend)}</Td>
                  </tr>
                }
              >
                {data.months.map((m) => (
                  <tr key={m.month}>
                    <Td className="font-semibold">{MONTH_NAMES[m.month - 1]}</Td>
                    <Td className="text-emerald-600">{formatNumber(m.income)}</Td>
                    <Td className="text-rose-600">{formatNumber(m.expense)}</Td>
                    <Td className={`font-bold ${moneyTone(m.net)}`}>{formatNumber(m.net)}</Td>
                    <Td>{formatNumber(m.commissions)}</Td>
                    <Td>{formatNumber(m.funded)}</Td>
                    <Td>{formatNumber(m.adSpend)}</Td>
                  </tr>
                ))}
              </Table>
            </div>
            <Card title="التوزيع حسب التصنيف">
              <ul className="space-y-2 text-sm">
                {data.byCategory.map((c) => {
                  const base = c.type === "income" ? data.totals.income : data.totals.expense;
                  const pct = base ? (c.total / base) * 100 : 0;
                  return (
                    <li key={`${c.type}-${c.category}`}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Badge tone={c.type === "income" ? "green" : "red"}>{TRANSACTION_TYPE_LABELS[c.type]}</Badge>
                          {CATEGORY_LABELS[c.category as TransactionCategory] ?? c.category}
                        </span>
                        <span className="font-bold">{formatMoney(c.total, cur)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${c.type === "income" ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
                {!data.byCategory.length && <li className="text-slate-400">لا توجد بيانات</li>}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
