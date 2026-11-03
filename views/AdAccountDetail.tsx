"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Plus, RefreshCw, Trash2, Wallet, Target, Scale } from "lucide-react";
import { trpc } from "../lib/trpc";
import { currentMonth, formatDate, formatMoney, formatNumber, todayISO } from "../lib/format";
import { useAuth } from "../lib/auth";
import { OWNERSHIP_LABELS, monthLabel } from "@/shared/constants";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Spinner, StatCard, Table, Td, moneyTone } from "../components/ui";
import { AccountForm } from "./AdAccounts";

export default function AdAccountDetailPage({ id }: { id: number }) {
  const q = trpc.adAccounts.get.useQuery({ id });
  const utils = trpc.useUtils();
  const refresh = () => { utils.adAccounts.invalidate(); utils.dashboard.invalidate(); utils.reports.invalidate(); utils.customers.invalidate(); utils.transactions.invalidate(); };

  const [editOpen, setEditOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [fund, setFund] = useState({ amount: "", date: todayISO(), note: "", recordExpense: false });
  const [spend, setSpend] = useState({ month: currentMonth(), spend: "" });

  const addFunding = trpc.adAccounts.addFunding.useMutation({ onSuccess: () => { refresh(); setFundOpen(false); setFund({ amount: "", date: todayISO(), note: "", recordExpense: false }); } });
  const delFunding = trpc.adAccounts.deleteFunding.useMutation({ onSuccess: refresh });
  const setSpendM = trpc.adAccounts.setSpend.useMutation({ onSuccess: () => { refresh(); setSpendOpen(false); } });
  const delSpend = trpc.adAccounts.deleteSpend.useMutation({ onSuccess: refresh });

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox message={q.error.message} />;
  const { account, fundings, spend: spendRows, campaigns } = q.data!;
  const cur = account.currency;

  return (
    <div>
      <Link href="/ad-accounts" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowRight className="size-4" /> العودة للحسابات الإعلانية
      </Link>
      <PageHeader
        title={account.name}
        subtitle={[OWNERSHIP_LABELS[account.ownership], account.customerName && `العميل: ${account.customerName}`, account.fbAccountId && `رقم الحساب ${account.fbAccountId}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)}>تعديل</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="المبلغ الممول" value={formatMoney(account.funded, cur)} tone="amber" icon={<Wallet className="size-5" />} />
        <StatCard label="الصرف الفعلي" value={formatMoney(account.spend, cur)} tone="red" icon={<Target className="size-5" />} sub="حسب الإدخال الشهري" />
        <StatCard label="صافي الرصيد" value={<span className={moneyTone(account.balance)}>{formatMoney(account.balance, cur)}</span>} tone="green" icon={<Scale className="size-5" />} sub="الممول − الصرف الفعلي" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="سجل التمويل والتحويلات" actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setFundOpen(true)}>إضافة تمويل</Button>}>
          <Table head={["التاريخ", "المبلغ", "ملاحظة", ""]} empty={!fundings.length}>
            {fundings.map((f) => (
              <tr key={f.id}>
                <Td className="whitespace-nowrap">{formatDate(f.date)}</Td>
                <Td className="whitespace-nowrap font-bold">{formatMoney(f.amount, cur)}</Td>
                <Td className="text-slate-600">{f.note}{f.transactionId && <Badge tone="violet">مسجل كمصروف</Badge>}</Td>
                <Td className="text-end">
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => confirm("حذف هذا التمويل؟") && delFunding.mutate({ id: f.id })}><Trash2 className="size-4" /></Button>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="الصرف الفعلي الشهري" actions={<Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setSpendOpen(true)}>تسجيل صرف شهر</Button>}>
          <Table head={["الشهر", "الصرف", ""]} empty={!spendRows.length}>
            {spendRows.map((s) => (
              <tr key={s.id}>
                <Td>{monthLabel(s.month)}</Td>
                <Td className="whitespace-nowrap font-bold text-rose-600">{formatMoney(s.spend, cur)}</Td>
                <Td className="text-end">
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => confirm("حذف سجل هذا الشهر؟") && delSpend.mutate({ id: s.id })}><Trash2 className="size-4" /></Button>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card title="الحملات على هذا الحساب" className="mt-4">
        <Table head={["الحملة", "الحالة", "الميزانية", "الصرف", "مرات الظهور", "النقرات", "النتائج"]} empty={!campaigns.length}>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <Td className="font-semibold">{c.name}</Td>
              <Td><Badge tone={c.status === "ACTIVE" ? "green" : "slate"}>{c.status}</Badge></Td>
              <Td>{formatMoney(c.budget, cur)}</Td>
              <Td className="text-rose-600">{formatMoney(c.spend, cur)}</Td>
              <Td>{formatNumber(c.impressions)}</Td>
              <Td>{formatNumber(c.clicks)}</Td>
              <Td>{formatNumber(c.results)}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <AccountForm open={editOpen} onClose={() => setEditOpen(false)} editing={account} />

      <Modal open={fundOpen} onClose={() => setFundOpen(false)} title="إضافة تمويل للحساب">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); addFunding.mutate({ adAccountId: id, amount: Number(fund.amount), date: fund.date, note: fund.note || null, recordExpense: fund.recordExpense }); }}>
          <Field label={`المبلغ (${cur})`}><Input type="number" step="0.01" min="0.01" value={fund.amount} onChange={(e) => setFund({ ...fund, amount: e.target.value })} required /></Field>
          <Field label="التاريخ"><Input type="date" value={fund.date} onChange={(e) => setFund({ ...fund, date: e.target.value })} required /></Field>
          <Field label="ملاحظة"><Input value={fund.note} onChange={(e) => setFund({ ...fund, note: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand-600" checked={fund.recordExpense} onChange={(e) => setFund({ ...fund, recordExpense: e.target.checked })} />
            تسجيله أيضاً كمصروف (صرف إعلانات) في الحسابات المالية
          </label>
          <ErrorBox message={addFunding.error?.message} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFundOpen(false)}>إلغاء</Button>
            <Button loading={addFunding.isPending}>حفظ</Button>
          </div>
        </form>
      </Modal>

      <Modal open={spendOpen} onClose={() => setSpendOpen(false)} title="تسجيل الصرف الفعلي لشهر">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSpendM.mutate({ adAccountId: id, month: spend.month, spend: Number(spend.spend) }); }}>
          <Field label="الشهر"><Input type="month" value={spend.month} onChange={(e) => setSpend({ ...spend, month: e.target.value })} required /></Field>
          <Field label={`إجمالي الصرف في الشهر (${cur})`} hint="سيستبدل أي قيمة مسجلة لنفس الشهر"><Input type="number" step="0.01" min="0" value={spend.spend} onChange={(e) => setSpend({ ...spend, spend: e.target.value })} required /></Field>
          <ErrorBox message={setSpendM.error?.message} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSpendOpen(false)}>إلغاء</Button>
            <Button loading={setSpendM.isPending}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
