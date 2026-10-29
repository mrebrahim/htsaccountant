import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Pencil, Plus, Trash2, Banknote, HandCoins, MinusCircle, Gift } from "lucide-react";
import { trpc } from "../lib/trpc";
import { currentMonth, formatDate, formatMoney, todayISO } from "../lib/format";
import { useAuth } from "../lib/auth";
import { EMPLOYEE_PAYMENT_LABELS, EMPLOYEE_PAYMENT_TYPES, monthLabel, type EmployeePaymentType } from "../../shared/constants";
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Td, moneyTone, type Tone } from "../components/ui";
import { EmployeeForm } from "./Employees";

const TYPE_TONES: Record<EmployeePaymentType, Tone> = { salary: "blue", advance: "amber", deduction: "red", bonus: "green", adjustment: "violet" };

export default function EmployeeDetailPage() {
  const id = Number(useParams().id);
  const { settings } = useAuth();
  const cur = settings.currency;
  const q = trpc.employees.get.useQuery({ id });
  const utils = trpc.useUtils();
  const refresh = () => { utils.employees.invalidate(); utils.transactions.invalidate(); utils.dashboard.invalidate(); utils.reports.invalidate(); };
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [p, setP] = useState({ type: "salary" as EmployeePaymentType, amount: "", date: todayISO(), month: currentMonth(), note: "", recordExpense: true });
  const add = trpc.employees.addPayment.useMutation({ onSuccess: () => { refresh(); setPayOpen(false); } });
  const del = trpc.employees.deletePayment.useMutation({ onSuccess: refresh });

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox message={q.error.message} />;
  const { employee, payments, payroll } = q.data!;
  const total = (t: EmployeePaymentType) => payments.filter((x) => x.type === t).reduce((s, x) => s + x.amount, 0);
  const cashOut = p.type === "salary" || p.type === "advance" || p.type === "bonus";

  const openPay = (type: EmployeePaymentType) => {
    setP({ type, amount: type === "salary" ? String(employee.baseSalary) : "", date: todayISO(), month: currentMonth(), note: "", recordExpense: true });
    setPayOpen(true);
  };

  return (
    <div>
      <Link to="/employees" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowRight className="size-4" /> العودة للموظفين
      </Link>
      <PageHeader
        title={employee.name}
        subtitle={[employee.jobTitle, `الراتب الأساسي: ${formatMoney(employee.baseSalary, cur)}`, employee.hireDate && `منذ ${formatDate(employee.hireDate)}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)}>تعديل</Button>
            <Button icon={<Plus className="size-4" />} onClick={() => openPay("salary")}>تسجيل دفعة / حركة</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="الرواتب المصروفة" value={formatMoney(total("salary"), cur)} icon={<Banknote className="size-5" />} />
        <StatCard label="السلف" value={formatMoney(total("advance"), cur)} tone="amber" icon={<HandCoins className="size-5" />} />
        <StatCard label="الخصومات" value={formatMoney(total("deduction"), cur)} tone="red" icon={<MinusCircle className="size-5" />} />
        <StatCard label="المكافآت" value={formatMoney(total("bonus"), cur)} tone="green" icon={<Gift className="size-5" />} />
      </div>

      <Card title="كشف الرواتب الشهري" className="mb-4">
        <p className="mb-3 text-xs text-slate-500">المستحق = الراتب الأساسي + المكافآت + التعديلات − الخصومات − السلف · المتبقي = المستحق − المصروف</p>
        <Table head={["الشهر", "الأساسي", "مكافآت", "تعديلات", "خصومات", "سلف", "المستحق", "المصروف", "المتبقي"]} empty={!payroll.length}>
          {payroll.map((r) => (
            <tr key={r.month}>
              <Td className="font-semibold">{monthLabel(r.month)}</Td>
              <Td>{formatMoney(employee.baseSalary, cur)}</Td>
              <Td className="text-emerald-600">{formatMoney(r.bonus, cur)}</Td>
              <Td>{formatMoney(r.adjustment, cur)}</Td>
              <Td className="text-rose-600">{formatMoney(r.deduction, cur)}</Td>
              <Td className="text-amber-600">{formatMoney(r.advance, cur)}</Td>
              <Td className="font-bold">{formatMoney(r.due, cur)}</Td>
              <Td>{formatMoney(r.salary, cur)}</Td>
              <Td className={`font-bold ${moneyTone(r.remaining)}`}>{formatMoney(r.remaining, cur)}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="سجل الحركات">
        <Table head={["التاريخ", "النوع", "عن شهر", "المبلغ", "ملاحظة", ""]} empty={!payments.length}>
          {payments.map((x) => (
            <tr key={x.id}>
              <Td className="whitespace-nowrap">{formatDate(x.date)}</Td>
              <Td><Badge tone={TYPE_TONES[x.type as EmployeePaymentType]}>{EMPLOYEE_PAYMENT_LABELS[x.type as EmployeePaymentType]}</Badge></Td>
              <Td>{monthLabel(x.month)}</Td>
              <Td className="whitespace-nowrap font-bold">{formatMoney(x.amount, cur)}</Td>
              <Td className="text-slate-600">{x.note}{x.transactionId && <Badge tone="violet">مسجل كمصروف</Badge>}</Td>
              <Td className="text-end">
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => confirm("حذف هذه الحركة؟ سيتم حذف المصروف المرتبط بها أيضاً.") && del.mutate({ id: x.id })}>
                  <Trash2 className="size-4" />
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <EmployeeForm open={editOpen} onClose={() => setEditOpen(false)} editing={employee} />
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="تسجيل حركة للموظف">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ employeeId: id, type: p.type, amount: Number(p.amount), date: p.date, month: p.month, note: p.note || null, recordExpense: p.recordExpense });
          }}
        >
          <Field label="نوع الحركة">
            <Select value={p.type} onChange={(e) => setP({ ...p, type: e.target.value as EmployeePaymentType, amount: e.target.value === "salary" ? String(employee.baseSalary) : p.amount })}>
              {EMPLOYEE_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYEE_PAYMENT_LABELS[t]}</option>)}
            </Select>
          </Field>
          <Field label="المبلغ"><Input type="number" step="0.01" min="0.01" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} required /></Field>
          <Field label="تاريخ الحركة"><Input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} required /></Field>
          <Field label="عن شهر"><Input type="month" value={p.month} onChange={(e) => setP({ ...p, month: e.target.value })} required /></Field>
          <Field label="ملاحظة" className="sm:col-span-2"><Input value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} /></Field>
          {cashOut && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-brand-600" checked={p.recordExpense} onChange={(e) => setP({ ...p, recordExpense: e.target.checked })} />
              تسجيلها كمصروف (رواتب وسلف) في الحسابات المالية
            </label>
          )}
          <div className="sm:col-span-2"><ErrorBox message={add.error?.message} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setPayOpen(false)}>إلغاء</Button>
            <Button loading={add.isPending}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
