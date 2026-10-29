import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, RefreshCw, Download, Wallet, Target, Scale, FileSpreadsheet } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { formatDate, formatMoney, formatNumber } from "../lib/format";
import { useAuth } from "../lib/auth";
import { exportToExcel } from "../lib/excel";
import { AD_ACCOUNT_OWNERSHIP, OWNERSHIP_LABELS, type AdAccountOwnership } from "../../shared/constants";
import { Badge, Button, ConfirmDialog, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Td, Textarea, moneyTone } from "../components/ui";

type Account = RouterOutputs["adAccounts"]["list"][number];

export function AccountForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Account | null }) {
  const utils = trpc.useUtils();
  const customers = trpc.customers.options.useQuery(undefined, { enabled: open });
  const [f, setF] = useState({ name: "", fbAccountId: "", ownership: "owned" as AdAccountOwnership, customerId: "", currency: "USD", notes: "" });
  useEffect(() => {
    if (open)
      setF({
        name: editing?.name ?? "",
        fbAccountId: editing?.fbAccountId ?? "",
        ownership: editing?.ownership ?? "owned",
        customerId: String(editing?.customerId ?? ""),
        currency: editing?.currency ?? "USD",
        notes: editing?.notes ?? "",
      });
  }, [open, editing]);
  const done = () => { utils.adAccounts.invalidate(); utils.customers.invalidate(); onClose(); };
  const create = trpc.adAccounts.create.useMutation({ onSuccess: done });
  const update = trpc.adAccounts.update.useMutation({ onSuccess: done });
  const m = editing ? update : create;

  return (
    <Modal open={open} onClose={onClose} title={editing ? "تعديل الحساب الإعلاني" : "إضافة حساب إعلاني"}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const data = { ...f, customerId: f.customerId ? Number(f.customerId) : null, fbAccountId: f.fbAccountId || null, notes: f.notes || null };
          if (editing) update.mutate({ id: editing.id, data });
          else create.mutate(data);
        }}
      >
        <Field label="اسم الحساب"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="معرّف حساب فيسبوك" hint="مثال: act_123456789"><Input dir="ltr" value={f.fbAccountId} onChange={(e) => setF({ ...f, fbAccountId: e.target.value })} /></Field>
        <Field label="نوع الحساب">
          <Select value={f.ownership} onChange={(e) => setF({ ...f, ownership: e.target.value as AdAccountOwnership })}>
            {AD_ACCOUNT_OWNERSHIP.map((o) => <option key={o} value={o}>{OWNERSHIP_LABELS[o]}</option>)}
          </Select>
        </Field>
        <Field label="العميل المرتبط">
          <Select value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}>
            <option value="">بدون عميل</option>
            {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="العملة"><Input dir="ltr" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} required /></Field>
        <Field label="ملاحظات" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="sm:col-span-2"><ErrorBox message={m.error?.message} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={m.isPending}>حفظ</Button>
        </div>
      </form>
    </Modal>
  );
}

function ImportFromFacebook({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.adAccounts.fbAvailable.useQuery(undefined, { enabled: open, retry: false });
  const [selected, setSelected] = useState<string[]>([]);
  const imp = trpc.adAccounts.fbImport.useMutation({ onSuccess: () => { utils.adAccounts.invalidate(); setSelected([]); onClose(); } });
  return (
    <Modal open={open} onClose={onClose} title="استيراد الحسابات من فيسبوك" wide>
      {q.isLoading && <Spinner />}
      <ErrorBox message={q.error?.message} />
      {q.data && (
        <>
          <Table head={["", "الحساب", "المعرف", "العملة", "الحالة", "إجمالي الصرف"]} empty={!q.data.length}>
            {q.data.map((a) => (
              <tr key={a.fbAccountId} className={a.imported ? "opacity-50" : ""}>
                <Td>
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-600"
                    disabled={a.imported}
                    checked={a.imported || selected.includes(a.fbAccountId)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, a.fbAccountId] : selected.filter((x) => x !== a.fbAccountId))}
                  />
                </Td>
                <Td className="font-semibold">{a.name}{a.imported && <span className="ms-2 text-xs text-slate-500">(مضاف)</span>}</Td>
                <Td><span className="ltr">act_{a.fbAccountId}</span></Td>
                <Td>{a.currency}</Td>
                <Td>{a.status}</Td>
                <Td>{formatMoney(a.amountSpent, a.currency)}</Td>
              </tr>
            ))}
          </Table>
          <ErrorBox message={imp.error?.message} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>إلغاء</Button>
            <Button
              disabled={!selected.length}
              loading={imp.isPending}
              onClick={() => imp.mutate({ accounts: q.data!.filter((a) => selected.includes(a.fbAccountId)).map(({ fbAccountId, name, currency }) => ({ fbAccountId, name, currency })) })}
            >
              استيراد ({selected.length})
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function AdAccountsPage() {
  const { isAdmin } = useAuth();
  const list = trpc.adAccounts.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const utils = trpc.useUtils();
  const del = trpc.adAccounts.delete.useMutation({ onSuccess: () => { setDeleting(null); utils.adAccounts.invalidate(); } });
  const syncAll = trpc.adAccounts.syncAll.useMutation({
    onSuccess: (r) => {
      utils.adAccounts.invalidate();
      utils.dashboard.invalidate();
      const failed = r.filter((x) => !x.ok);
      setSyncMsg(`تمت مزامنة ${r.length - failed.length} حساب${failed.length ? ` — فشل: ${failed.map((f) => `${f.name} (${f.error})`).join("، ")}` : ""}`);
    },
  });

  const rows = list.data ?? [];
  // Totals are only meaningful per currency, so group them.
  const byCurrency = Object.entries(
    rows.reduce<Record<string, { funded: number; spend: number }>>((acc, a) => {
      acc[a.currency] ??= { funded: 0, spend: 0 };
      acc[a.currency].funded += a.funded;
      acc[a.currency].spend += a.spend;
      return acc;
    }, {}),
  );

  return (
    <div>
      <PageHeader
        title="ميزانيات الإعلانات"
        subtitle="صافي الرصيد = المبلغ الممول − الصرف الفعلي"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              disabled={!rows.length}
              onClick={() =>
                exportToExcel(
                  rows.map((a) => ({ الحساب: a.name, المعرف: a.fbAccountId ?? "", النوع: OWNERSHIP_LABELS[a.ownership], العميل: a.customerName ?? "", العملة: a.currency, الممول: a.funded, "الصرف الفعلي": a.spend, "الرصيد المتبقي": a.balance })),
                  "الحسابات-الإعلانية",
                )
              }
            >
              تصدير Excel
            </Button>
            {isAdmin && (
              <>
                <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => setImportOpen(true)}>استيراد من فيسبوك</Button>
                <Button variant="success" icon={<RefreshCw className="size-4" />} loading={syncAll.isPending} onClick={() => syncAll.mutate()}>مزامنة الصرف</Button>
              </>
            )}
            <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>حساب جديد</Button>
          </>
        }
      />

      {byCurrency.map(([cur, t]) => (
        <div key={cur} className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatCard label={`إجمالي الممول (${cur})`} value={formatMoney(t.funded, cur)} tone="amber" icon={<Wallet className="size-5" />} />
          <StatCard label={`الصرف الفعلي (${cur})`} value={formatMoney(t.spend, cur)} tone="red" icon={<Target className="size-5" />} />
          <StatCard label={`الرصيد المتبقي (${cur})`} value={<span className={moneyTone(t.funded - t.spend)}>{formatMoney(t.funded - t.spend, cur)}</span>} tone="green" icon={<Scale className="size-5" />} />
        </div>
      ))}

      {syncMsg && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{syncMsg}</div>}
      <ErrorBox message={syncAll.error?.message ?? list.error?.message} />

      {list.isLoading ? (
        <Spinner />
      ) : (
        <Table head={["الحساب", "النوع", "العميل", "الممول", "الصرف الفعلي", "الرصيد المتبقي", "آخر مزامنة", ""]} empty={!rows.length}>
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <Td>
                <Link to={`/ad-accounts/${a.id}`} className="font-bold text-brand-700 hover:underline">{a.name}</Link>
                {a.fbAccountId && <span className="ltr block text-xs text-slate-500">act_{a.fbAccountId}</span>}
              </Td>
              <Td><Badge tone={a.ownership === "owned" ? "blue" : a.ownership === "partner" ? "violet" : "amber"}>{OWNERSHIP_LABELS[a.ownership]}</Badge></Td>
              <Td>{a.customerName ?? <span className="text-slate-400">—</span>}</Td>
              <Td className="whitespace-nowrap">{formatMoney(a.funded, a.currency)}</Td>
              <Td className="whitespace-nowrap text-rose-600">{formatMoney(a.spend, a.currency)}</Td>
              <Td className={`whitespace-nowrap font-bold ${moneyTone(a.balance)}`}>{formatMoney(a.balance, a.currency)}</Td>
              <Td className="whitespace-nowrap text-xs text-slate-500">{a.lastSyncedAt ? formatDate(a.lastSyncedAt) : "يدوي"}</Td>
              <Td className="whitespace-nowrap text-end">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setFormOpen(true); }} aria-label="تعديل"><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleting(a)} aria-label="حذف"><Trash2 className="size-4" /></Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-2 text-xs text-slate-500">{formatNumber(rows.length)} حساب إعلاني</p>

      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      {isAdmin && <ImportFromFacebook open={importOpen} onClose={() => setImportOpen(false)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        loading={del.isPending}
        message={`هل أنت متأكد من حذف الحساب "${deleting?.name}"؟ سيتم حذف سجل التمويل والصرف الخاص به.`}
      />
    </div>
  );
}
