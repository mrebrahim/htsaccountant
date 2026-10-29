import { useDeferredValue, useState } from "react";
import { Plus, Pencil, Trash2, FileSpreadsheet, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { formatDate, formatMoney } from "../lib/format";
import { useCurrency } from "../lib/auth";
import { exportToExcel } from "../lib/excel";
import { CATEGORY_LABELS, TRANSACTION_TYPE_LABELS, type TransactionCategory } from "../../shared/constants";
import { Badge, Button, ConfirmDialog, PageHeader, Spinner, StatCard, Table, Td, moneyTone, ErrorBox } from "../components/ui";
import { TransactionForm } from "../components/TransactionForm";
import { TransactionFilters, emptyFilters, toQuery, type Filters } from "../components/TransactionFilters";

type Tx = RouterOutputs["transactions"]["list"]["rows"][number];

export default function TransactionsPage() {
  const currency = useCurrency();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const query = useDeferredValue(toQuery(filters));
  const list = trpc.transactions.list.useQuery(query, { placeholderData: (p) => p });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [deleting, setDeleting] = useState<Tx | null>(null);
  const utils = trpc.useUtils();
  const del = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      setDeleting(null);
      utils.transactions.invalidate();
      utils.dashboard.invalidate();
      utils.customers.invalidate();
      utils.reports.invalidate();
    },
  });

  const totals = list.data?.totals;

  const doExport = () => {
    const rows = (list.data?.rows ?? []).map((r) => ({
      التاريخ: r.date,
      النوع: TRANSACTION_TYPE_LABELS[r.type],
      التصنيف: CATEGORY_LABELS[r.category as TransactionCategory] ?? r.category,
      المبلغ: r.amount,
      العميل: r.customerName ?? "",
      الحملة: r.campaignName ?? "",
      الوصف: r.description ?? "",
    }));
    if (totals) {
      rows.push({ التاريخ: "", النوع: "", التصنيف: "إجمالي الإيرادات", المبلغ: totals.income, العميل: "", الحملة: "", الوصف: "" });
      rows.push({ التاريخ: "", النوع: "", التصنيف: "إجمالي المصروفات", المبلغ: totals.expense, العميل: "", الحملة: "", الوصف: "" });
      rows.push({ التاريخ: "", النوع: "", التصنيف: "الصافي", المبلغ: totals.net, العميل: "", الحملة: "", الوصف: "" });
    }
    exportToExcel(rows, `المعاملات-المالية-${new Date().toISOString().slice(0, 10)}`, "المعاملات");
  };

  return (
    <div>
      <PageHeader
        title="الحسابات المالية"
        subtitle="تسجيل وإدارة الإيرادات والمصروفات"
        actions={
          <>
            <Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} onClick={doExport} disabled={!list.data?.rows.length}>
              تصدير Excel
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              معاملة جديدة
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="إجمالي الإيرادات" value={formatMoney(totals?.income, currency)} tone="green" icon={<TrendingUp className="size-5" />} />
        <StatCard label="إجمالي المصروفات" value={formatMoney(totals?.expense, currency)} tone="red" icon={<TrendingDown className="size-5" />} />
        <StatCard
          label="صافي الرصيد"
          value={<span className={moneyTone(totals?.net ?? 0)}>{formatMoney(totals?.net, currency)}</span>}
          tone="blue"
          icon={<Scale className="size-5" />}
          sub={`${totals?.count ?? 0} معاملة`}
        />
      </div>

      <TransactionFilters value={filters} onChange={setFilters} />
      <ErrorBox message={list.error?.message} />

      {list.isLoading ? (
        <Spinner />
      ) : (
        <Table head={["التاريخ", "النوع", "التصنيف", "المبلغ", "العميل", "الوصف", ""]} empty={!list.data?.rows.length}>
          {list.data?.rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td className="whitespace-nowrap">{formatDate(r.date)}</Td>
              <Td><Badge tone={r.type === "income" ? "green" : "red"}>{TRANSACTION_TYPE_LABELS[r.type]}</Badge></Td>
              <Td className="whitespace-nowrap">{CATEGORY_LABELS[r.category as TransactionCategory] ?? r.category}</Td>
              <Td className={`whitespace-nowrap font-bold ${r.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                {r.type === "income" ? "+" : "−"} {formatMoney(r.amount, currency)}
              </Td>
              <Td>{r.customerName ?? <span className="text-slate-400">—</span>}</Td>
              <Td className="max-w-xs truncate text-slate-600" >
                {r.description}
                {r.campaignName && <span className="block text-xs text-violet-600">حملة: {r.campaignName}</span>}
              </Td>
              <Td className="whitespace-nowrap text-end">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setFormOpen(true); }} aria-label="تعديل"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleting(r)} aria-label="حذف"><Trash2 className="size-4" /></Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        loading={del.isPending}
        message={`هل أنت متأكد من حذف هذه المعاملة بقيمة ${formatMoney(deleting?.amount, currency)}؟`}
      />
    </div>
  );
}
