import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, FileSpreadsheet, Search } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { formatMoney } from "../lib/format";
import { useCurrency } from "../lib/auth";
import { exportToExcel } from "../lib/excel";
import { Badge, Button, ConfirmDialog, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Table, Td, Textarea, moneyTone } from "../components/ui";

type Customer = RouterOutputs["customers"]["list"][number];

export function CustomerForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Partial<Customer> & { id: number; notes?: string | null } | null }) {
  const utils = trpc.useUtils();
  const [f, setF] = useState({ name: "", company: "", phone: "", email: "", commissionRate: "0", notes: "", active: true });
  useEffect(() => {
    if (open)
      setF({
        name: editing?.name ?? "",
        company: editing?.company ?? "",
        phone: editing?.phone ?? "",
        email: editing?.email ?? "",
        commissionRate: String(editing?.commissionRate ?? 0),
        notes: editing?.notes ?? "",
        active: editing?.active ?? true,
      });
  }, [open, editing]);
  const done = () => { utils.customers.invalidate(); onClose(); };
  const create = trpc.customers.create.useMutation({ onSuccess: done });
  const update = trpc.customers.update.useMutation({ onSuccess: done });
  const m = editing ? update : create;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const data = { ...f, commissionRate: Number(f.commissionRate) || 0, company: f.company || null, phone: f.phone || null, notes: f.notes || null };
          if (editing) update.mutate({ id: editing.id, data });
          else create.mutate(data);
        }}
      >
        <Field label="اسم العميل"><Input value={f.name} onChange={set("name")} required /></Field>
        <Field label="الشركة / النشاط"><Input value={f.company} onChange={set("company")} /></Field>
        <Field label="رقم الهاتف"><Input value={f.phone} onChange={set("phone")} dir="ltr" /></Field>
        <Field label="البريد الإلكتروني"><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="نسبة العمولة %"><Input type="number" min="0" max="100" step="0.01" value={f.commissionRate} onChange={set("commissionRate")} /></Field>
        <Field label="الحالة">
          <label className="flex h-[38px] items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="size-4 accent-brand-600" />
            عميل نشط
          </label>
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2"><Textarea value={f.notes} onChange={set("notes")} /></Field>
        <div className="sm:col-span-2"><ErrorBox message={m.error?.message} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={m.isPending}>حفظ</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CustomersPage() {
  const currency = useCurrency();
  const list = trpc.customers.list.useQuery();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const utils = trpc.useUtils();
  const del = trpc.customers.delete.useMutation({ onSuccess: () => { setDeleting(null); utils.customers.invalidate(); } });

  const rows = (list.data ?? []).filter((c) => !search || [c.name, c.company, c.phone, c.email].some((v) => v?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <PageHeader
        title="العملاء"
        subtitle="إدارة بيانات العملاء ومتابعة أرصدتهم"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              disabled={!rows.length}
              onClick={() =>
                exportToExcel(
                  rows.map((c) => ({ العميل: c.name, الشركة: c.company ?? "", الهاتف: c.phone ?? "", الإيرادات: c.income, المصروفات: c.expense, العمولات: c.commissions, الصافي: c.income - c.expense })),
                  "العملاء",
                )
              }
            >
              تصدير Excel
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>عميل جديد</Button>
          </>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute start-3 top-2.5 size-4 text-slate-400" />
        <Input className="ps-9" placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <ErrorBox message={list.error?.message} />
      {list.isLoading ? (
        <Spinner />
      ) : (
        <Table head={["العميل", "الهاتف", "الإيرادات", "المصروفات", "العمولات", "الصافي", "حسابات إعلانية", ""]} empty={!rows.length}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <Td>
                <Link to={`/customers/${c.id}`} className="font-bold text-brand-700 hover:underline">{c.name}</Link>
                {c.company && <span className="block text-xs text-slate-500">{c.company}</span>}
                {!c.active && <Badge tone="slate">غير نشط</Badge>}
              </Td>
              <Td><span className="ltr">{c.phone ?? "—"}</span></Td>
              <Td className="whitespace-nowrap text-emerald-600">{formatMoney(c.income, currency)}</Td>
              <Td className="whitespace-nowrap text-rose-600">{formatMoney(c.expense, currency)}</Td>
              <Td className="whitespace-nowrap">{formatMoney(c.commissions, currency)}</Td>
              <Td className={`whitespace-nowrap font-bold ${moneyTone(c.income - c.expense)}`}>{formatMoney(c.income - c.expense, currency)}</Td>
              <Td>{c.adAccounts}</Td>
              <Td className="whitespace-nowrap text-end">
                <Link to={`/customers/${c.id}`}><Button size="sm" variant="ghost" aria-label="عرض"><Eye className="size-4" /></Button></Link>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setFormOpen(true); }} aria-label="تعديل"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleting(c)} aria-label="حذف"><Trash2 className="size-4" /></Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        loading={del.isPending}
        message={`هل أنت متأكد من حذف العميل "${deleting?.name}"؟ ستبقى معاملاته المالية مسجلة بدون ربط بالعميل.`}
      />
    </div>
  );
}
