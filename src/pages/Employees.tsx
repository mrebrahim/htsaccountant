import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Users, Banknote, HandCoins } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { formatDate, formatMoney, formatNumber } from "../lib/format";
import { useAuth } from "../lib/auth";
import { Badge, Button, ConfirmDialog, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Td, Textarea } from "../components/ui";

type Employee = RouterOutputs["employees"]["get"]["employee"];

export function EmployeeForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Employee | null }) {
  const utils = trpc.useUtils();
  const { isAdmin } = useAuth();
  const users = trpc.users.list.useQuery(undefined, { enabled: open && isAdmin });
  const init = () => ({
    name: editing?.name ?? "",
    jobTitle: editing?.jobTitle ?? "",
    phone: editing?.phone ?? "",
    email: editing?.email ?? "",
    baseSalary: String(editing?.baseSalary ?? ""),
    hireDate: editing?.hireDate ?? "",
    userId: String(editing?.userId ?? ""),
    active: editing?.active ?? true,
    notes: editing?.notes ?? "",
  });
  const [f, setF] = useState(init);
  useEffect(() => { if (open) setF(init()); }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = () => { utils.employees.invalidate(); onClose(); };
  const create = trpc.employees.create.useMutation({ onSuccess: done });
  const update = trpc.employees.update.useMutation({ onSuccess: done });
  const m = editing ? update : create;
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "تعديل بيانات الموظف" : "إضافة موظف"}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const data = {
            ...f,
            baseSalary: Number(f.baseSalary) || 0,
            hireDate: f.hireDate || null,
            userId: f.userId ? Number(f.userId) : editing?.userId ?? null,
            jobTitle: f.jobTitle || null,
            phone: f.phone || null,
            notes: f.notes || null,
          };
          if (editing) update.mutate({ id: editing.id, data });
          else create.mutate(data);
        }}
      >
        <Field label="اسم الموظف"><Input value={f.name} onChange={set("name")} required /></Field>
        <Field label="المسمى الوظيفي"><Input value={f.jobTitle} onChange={set("jobTitle")} /></Field>
        <Field label="رقم الهاتف"><Input dir="ltr" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="البريد الإلكتروني"><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="الراتب الأساسي"><Input type="number" step="0.01" min="0" value={f.baseSalary} onChange={set("baseSalary")} required /></Field>
        <Field label="تاريخ التعيين"><Input type="date" value={f.hireDate} onChange={set("hireDate")} /></Field>
        {isAdmin && (
          <Field label="حساب المستخدم في النظام" hint="لربط الموظف بحساب دخول وصلاحيات">
            <Select value={f.userId} onChange={set("userId")}>
              <option value="">بدون حساب</option>
              {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </Select>
          </Field>
        )}
        <Field label="الحالة">
          <label className="flex h-[38px] items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            على رأس العمل
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

export default function EmployeesPage() {
  const { settings } = useAuth();
  const list = trpc.employees.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const utils = trpc.useUtils();
  const del = trpc.employees.delete.useMutation({ onSuccess: () => { setDeleting(null); utils.employees.invalidate(); } });
  const rows = list.data ?? [];
  const active = rows.filter((r) => r.employee.active);

  return (
    <div>
      <PageHeader
        title="الموظفين"
        subtitle="إدارة بيانات الموظفين والرواتب والسلف والخصومات"
        actions={<Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>موظف جديد</Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="الموظفين النشطين" value={formatNumber(active.length)} icon={<Users className="size-5" />} />
        <StatCard label="إجمالي الرواتب الشهرية" value={formatMoney(active.reduce((s, r) => s + r.employee.baseSalary, 0), settings.currency)} tone="amber" icon={<Banknote className="size-5" />} />
        <StatCard label="إجمالي السلف" value={formatMoney(rows.reduce((s, r) => s + r.advances, 0), settings.currency)} tone="red" icon={<HandCoins className="size-5" />} />
      </div>
      <ErrorBox message={list.error?.message} />
      {list.isLoading ? (
        <Spinner />
      ) : (
        <Table head={["الموظف", "المسمى", "الراتب الأساسي", "تاريخ التعيين", "إجمالي المصروف", "السلف", "الحالة", ""]} empty={!rows.length}>
          {rows.map(({ employee: e, advances, paid }) => (
            <tr key={e.id} className="hover:bg-slate-50">
              <Td>
                <Link to={`/employees/${e.id}`} className="font-bold text-brand-700 hover:underline">{e.name}</Link>
                {e.phone && <span className="ltr block text-xs text-slate-500">{e.phone}</span>}
              </Td>
              <Td>{e.jobTitle ?? "—"}</Td>
              <Td className="whitespace-nowrap font-semibold">{formatMoney(e.baseSalary, settings.currency)}</Td>
              <Td className="whitespace-nowrap">{formatDate(e.hireDate)}</Td>
              <Td className="whitespace-nowrap">{formatMoney(paid, settings.currency)}</Td>
              <Td className="whitespace-nowrap text-rose-600">{formatMoney(advances, settings.currency)}</Td>
              <Td><Badge tone={e.active ? "green" : "slate"}>{e.active ? "نشط" : "غير نشط"}</Badge></Td>
              <Td className="whitespace-nowrap text-end">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setFormOpen(true); }} aria-label="تعديل"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleting(e)} aria-label="حذف"><Trash2 className="size-4" /></Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <EmployeeForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        loading={del.isPending}
        message={`هل أنت متأكد من حذف الموظف "${deleting?.name}"؟ سيتم حذف سجل مدفوعاته (تبقى المصروفات المسجلة في الحسابات).`}
      />
    </div>
  );
}
