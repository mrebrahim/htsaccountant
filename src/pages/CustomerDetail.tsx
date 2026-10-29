import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Pencil, Plus, TrendingUp, TrendingDown, Percent, Wallet, Target, Scale, FileSpreadsheet } from "lucide-react";
import { trpc } from "../lib/trpc";
import { formatDate, formatMoney, formatNumber } from "../lib/format";
import { useAuth } from "../lib/auth";
import { exportToExcel } from "../lib/excel";
import { CATEGORY_LABELS, OWNERSHIP_LABELS, TRANSACTION_TYPE_LABELS, type TransactionCategory } from "../../shared/constants";
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner, StatCard, Table, Td, Tabs, moneyTone } from "../components/ui";
import { TransactionForm } from "../components/TransactionForm";
import { CustomerForm } from "./Customers";

export default function CustomerDetailPage() {
  const id = Number(useParams().id);
  const { settings, can } = useAuth();
  const currency = settings.currency;
  const q = trpc.customers.get.useQuery({ id });
  const [tab, setTab] = useState<"tx" | "ads" | "campaigns">("tx");
  const [txOpen, setTxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox message={q.error.message} />;
  const { customer, transactions, adAccounts, campaigns, summary } = q.data!;

  return (
    <div>
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowRight className="size-4" /> العودة للعملاء
      </Link>
      <PageHeader
        title={customer.name}
        subtitle={[customer.company, customer.phone, customer.email].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)}>تعديل</Button>
            {can("transactions") && <Button icon={<Plus className="size-4" />} onClick={() => setTxOpen(true)}>معاملة للعميل</Button>}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="الإيرادات" value={formatMoney(summary.income, currency)} tone="green" icon={<TrendingUp className="size-5" />} />
        <StatCard label="المصروفات" value={formatMoney(summary.expense, currency)} tone="red" icon={<TrendingDown className="size-5" />} />
        <StatCard label="العمولات" value={formatMoney(summary.commissions, currency)} tone="violet" icon={<Percent className="size-5" />} sub={`نسبة العمولة ${customer.commissionRate}%`} />
        <StatCard label="صافي الرصيد" value={<span className={moneyTone(summary.net)}>{formatMoney(summary.net, currency)}</span>} tone="blue" icon={<Scale className="size-5" />} />
        <StatCard label="المبالغ الممولة للإعلانات" value={formatNumber(summary.funded)} tone="amber" icon={<Wallet className="size-5" />} />
        <StatCard label="الصرف الفعلي (فيسبوك)" value={formatNumber(summary.spend)} tone="red" icon={<Target className="size-5" />} />
        <StatCard label="رصيد الإعلانات المتبقي" value={<span className={moneyTone(summary.adBalance)}>{formatNumber(summary.adBalance)}</span>} tone="green" icon={<Scale className="size-5" />} sub="الممول − الصرف الفعلي" />
      </div>

      {customer.notes && <Card className="mb-4"><p className="whitespace-pre-wrap text-sm text-slate-600">{customer.notes}</p></Card>}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "tx", label: `السجل المالي (${transactions.length})` },
          { value: "ads", label: `الحسابات الإعلانية (${adAccounts.length})` },
          { value: "campaigns", label: `الحملات (${campaigns.length})` },
        ]}
      />

      {tab === "tx" && (
        <>
          <div className="mb-2 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              disabled={!transactions.length}
              onClick={() =>
                exportToExcel(
                  transactions.map((t) => ({ التاريخ: t.date, النوع: TRANSACTION_TYPE_LABELS[t.type], التصنيف: CATEGORY_LABELS[t.category as TransactionCategory] ?? t.category, المبلغ: t.amount, الوصف: t.description ?? "" })),
                  `كشف-حساب-${customer.name}`,
                )
              }
            >
              تصدير كشف الحساب
            </Button>
          </div>
          <Table head={["التاريخ", "النوع", "التصنيف", "المبلغ", "الوصف"]} empty={!transactions.length}>
            {transactions.map((t) => (
              <tr key={t.id}>
                <Td className="whitespace-nowrap">{formatDate(t.date)}</Td>
                <Td><Badge tone={t.type === "income" ? "green" : "red"}>{TRANSACTION_TYPE_LABELS[t.type]}</Badge></Td>
                <Td>{CATEGORY_LABELS[t.category as TransactionCategory] ?? t.category}</Td>
                <Td className={`whitespace-nowrap font-bold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(t.amount, currency)}</Td>
                <Td className="text-slate-600">{t.description}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {tab === "ads" && (
        <Table head={["الحساب", "النوع", "الممول", "الصرف الفعلي", "الرصيد المتبقي"]} empty={!adAccounts.length}>
          {adAccounts.map((a) => (
            <tr key={a.id}>
              <Td>
                {can("ad_accounts") ? <Link className="font-bold text-brand-700 hover:underline" to={`/ad-accounts/${a.id}`}>{a.name}</Link> : a.name}
                {a.fbAccountId && <span className="ltr block text-xs text-slate-500">act_{a.fbAccountId}</span>}
              </Td>
              <Td><Badge tone="blue">{OWNERSHIP_LABELS[a.ownership]}</Badge></Td>
              <Td className="whitespace-nowrap">{formatMoney(a.funded, a.currency)}</Td>
              <Td className="whitespace-nowrap text-rose-600">{formatMoney(a.spend, a.currency)}</Td>
              <Td className={`whitespace-nowrap font-bold ${moneyTone(a.balance)}`}>{formatMoney(a.balance, a.currency)}</Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "campaigns" && (
        <Table head={["الحملة", "الحالة", "الميزانية", "الصرف", "النتائج", "النقرات"]} empty={!campaigns.length}>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <Td className="font-semibold">{c.name}</Td>
              <Td><Badge tone={c.status === "ACTIVE" ? "green" : "slate"}>{c.status}</Badge></Td>
              <Td>{formatNumber(c.budget)}</Td>
              <Td className="text-rose-600">{formatNumber(c.spend)}</Td>
              <Td>{formatNumber(c.results)}</Td>
              <Td>{formatNumber(c.clicks)}</Td>
            </tr>
          ))}
        </Table>
      )}

      <TransactionForm open={txOpen} onClose={() => setTxOpen(false)} defaults={{ type: "income", customerId: id }} />
      <CustomerForm open={editOpen} onClose={() => setEditOpen(false)} editing={customer} />
    </div>
  );
}
