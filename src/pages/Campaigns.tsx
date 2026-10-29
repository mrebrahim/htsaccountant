import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Megaphone, Target, MousePointerClick, Eye, FileSpreadsheet } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { formatDate, formatMoney, formatNumber } from "../lib/format";
import { useAuth } from "../lib/auth";
import { exportToExcel } from "../lib/excel";
import { Badge, Button, ConfirmDialog, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Table, Td, Textarea } from "../components/ui";

type Row = RouterOutputs["campaigns"]["list"][number];

const STATUS_LABELS: Record<string, string> = { ACTIVE: "نشطة", PAUSED: "متوقفة", ARCHIVED: "مؤرشفة", DELETED: "محذوفة", COMPLETED: "مكتملة" };
const statusTone = (s: string) => (s === "ACTIVE" ? "green" : s === "PAUSED" ? "amber" : "slate") as "green" | "amber" | "slate";

function CampaignForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Row | null }) {
  const utils = trpc.useUtils();
  const customers = trpc.customers.options.useQuery(undefined, { enabled: open });
  const accounts = trpc.adAccounts.options.useQuery(undefined, { enabled: open });
  const init = () => {
    const c = editing?.campaign;
    return {
      name: c?.name ?? "",
      adAccountId: String(c?.adAccountId ?? ""),
      customerId: String(c?.customerId ?? ""),
      status: c?.status ?? "ACTIVE",
      objective: c?.objective ?? "",
      budget: String(c?.budget ?? ""),
      spend: String(c?.spend ?? ""),
      impressions: String(c?.impressions ?? ""),
      clicks: String(c?.clicks ?? ""),
      results: String(c?.results ?? ""),
      startDate: c?.startDate ?? "",
      endDate: c?.endDate ?? "",
      notes: c?.notes ?? "",
    };
  };
  const [f, setF] = useState(init);
  useEffect(() => { if (open) setF(init()); }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = () => { utils.campaigns.invalidate(); utils.adAccounts.invalidate(); utils.customers.invalidate(); onClose(); };
  const create = trpc.campaigns.create.useMutation({ onSuccess: done });
  const update = trpc.campaigns.update.useMutation({ onSuccess: done });
  const m = editing ? update : create;
  const synced = !!editing?.campaign.fbCampaignId;
  const set = (k: keyof ReturnType<typeof init>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "تعديل الحملة" : "إضافة حملة"} wide>
      <form
        className="grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const n = (v: string) => Number(v) || 0;
          const data = {
            name: f.name,
            adAccountId: f.adAccountId ? Number(f.adAccountId) : null,
            customerId: f.customerId ? Number(f.customerId) : null,
            status: f.status,
            objective: f.objective || null,
            budget: n(f.budget),
            spend: n(f.spend),
            impressions: Math.round(n(f.impressions)),
            clicks: Math.round(n(f.clicks)),
            results: Math.round(n(f.results)),
            startDate: f.startDate || null,
            endDate: f.endDate || null,
            notes: f.notes || null,
          };
          if (editing) update.mutate({ id: editing.campaign.id, data });
          else create.mutate(data);
        }}
      >
        {synced && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 sm:col-span-3">هذه الحملة مرتبطة بفيسبوك، وسيتم تحديث بيانات الأداء تلقائياً عند المزامنة.</p>}
        <Field label="اسم الحملة" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} required /></Field>
        <Field label="الحالة">
          <Select value={f.status} onChange={set("status")}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="الحساب الإعلاني">
          <Select
            value={f.adAccountId}
            onChange={(e) => {
              const acc = accounts.data?.find((a) => String(a.id) === e.target.value);
              setF({ ...f, adAccountId: e.target.value, customerId: f.customerId || String(acc?.customerId ?? "") });
            }}
          >
            <option value="">بدون</option>
            {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="العميل">
          <Select value={f.customerId} onChange={set("customerId")}>
            <option value="">بدون</option>
            {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="الهدف"><Input value={f.objective} onChange={set("objective")} /></Field>
        <Field label="الميزانية"><Input type="number" step="0.01" min="0" value={f.budget} onChange={set("budget")} /></Field>
        <Field label="الصرف"><Input type="number" step="0.01" min="0" value={f.spend} onChange={set("spend")} /></Field>
        <Field label="النتائج"><Input type="number" min="0" value={f.results} onChange={set("results")} /></Field>
        <Field label="مرات الظهور"><Input type="number" min="0" value={f.impressions} onChange={set("impressions")} /></Field>
        <Field label="النقرات"><Input type="number" min="0" value={f.clicks} onChange={set("clicks")} /></Field>
        <div />
        <Field label="تاريخ البداية"><Input type="date" value={f.startDate} onChange={set("startDate")} /></Field>
        <Field label="تاريخ النهاية"><Input type="date" value={f.endDate} onChange={set("endDate")} /></Field>
        <div />
        <Field label="ملاحظات" className="sm:col-span-3"><Textarea value={f.notes} onChange={set("notes")} /></Field>
        <div className="sm:col-span-3"><ErrorBox message={m.error?.message} /></div>
        <div className="flex justify-end gap-2 sm:col-span-3">
          <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={m.isPending}>حفظ</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CampaignsPage() {
  const { isAdmin, can } = useAuth();
  const [filter, setFilter] = useState<{ customerId?: number; adAccountId?: number; status?: string }>({});
  const list = trpc.campaigns.list.useQuery(filter, { placeholderData: (p) => p });
  const customers = trpc.customers.options.useQuery();
  const accounts = trpc.adAccounts.options.useQuery(undefined, { enabled: can("ad_accounts") || can("campaigns") });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const utils = trpc.useUtils();
  const del = trpc.campaigns.delete.useMutation({ onSuccess: () => { setDeleting(null); utils.campaigns.invalidate(); } });
  const sync = trpc.campaigns.syncFromFacebook.useMutation({ onSuccess: () => utils.campaigns.invalidate() });

  const rows = list.data ?? [];
  const sum = (k: "spend" | "impressions" | "clicks" | "results") => rows.reduce((s, r) => s + r.campaign[k], 0);

  return (
    <div>
      <PageHeader
        title="الحملات الإعلانية"
        subtitle="متابعة أداء الحملات وربطها بالعملاء والحسابات الإعلانية"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              disabled={!rows.length}
              onClick={() =>
                exportToExcel(
                  rows.map((r) => ({ الحملة: r.campaign.name, الحالة: STATUS_LABELS[r.campaign.status] ?? r.campaign.status, العميل: r.customerName ?? "", الحساب: r.adAccountName ?? "", الميزانية: r.campaign.budget, الصرف: r.campaign.spend, "مرات الظهور": r.campaign.impressions, النقرات: r.campaign.clicks, النتائج: r.campaign.results, "إيرادات مرتبطة": r.linkedIncome, "مصروفات مرتبطة": r.linkedExpense })),
                  "الحملات",
                )
              }
            >
              تصدير Excel
            </Button>
            {isAdmin && (
              <Button variant="success" icon={<RefreshCw className="size-4" />} loading={sync.isPending} onClick={() => sync.mutate({})}>
                مزامنة من فيسبوك
              </Button>
            )}
            <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>حملة جديدة</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="عدد الحملات" value={formatNumber(rows.length)} icon={<Megaphone className="size-5" />} />
        <StatCard label="إجمالي الصرف" value={formatNumber(sum("spend"))} tone="red" icon={<Target className="size-5" />} />
        <StatCard label="مرات الظهور" value={formatNumber(sum("impressions"))} tone="violet" icon={<Eye className="size-5" />} />
        <StatCard label="النقرات / النتائج" value={`${formatNumber(sum("clicks"))} / ${formatNumber(sum("results"))}`} tone="green" icon={<MousePointerClick className="size-5" />} />
      </div>

      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <Select value={filter.customerId ?? ""} onChange={(e) => setFilter({ ...filter, customerId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">كل العملاء</option>
          {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={filter.adAccountId ?? ""} onChange={(e) => setFilter({ ...filter, adAccountId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">كل الحسابات</option>
          {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select value={filter.status ?? ""} onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <ErrorBox message={sync.error?.message ?? list.error?.message} />
      {sync.data && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          تمت مزامنة {sync.data.synced} حملة من {sync.data.accounts} حساب.
          {sync.data.errors.length > 0 && <span className="block text-rose-600">{sync.data.errors.join(" | ")}</span>}
        </div>
      )}

      {list.isLoading ? (
        <Spinner />
      ) : (
        <Table head={["الحملة", "الحالة", "العميل / الحساب", "الميزانية", "الصرف", "الظهور", "النقرات", "النتائج", "تكلفة النتيجة", "مالياً", ""]} empty={!rows.length}>
          {rows.map((r) => {
            const c = r.campaign;
            const cur = r.currency ?? "USD";
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td>
                  <span className="font-bold">{c.name}</span>
                  <span className="block text-xs text-slate-500">
                    {c.objective}{c.startDate && ` · ${formatDate(c.startDate)}`}{c.fbCampaignId && " · فيسبوك"}
                  </span>
                </Td>
                <Td><Badge tone={statusTone(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</Badge></Td>
                <Td className="text-xs">{r.customerName ?? "—"}<span className="block text-slate-500">{r.adAccountName}</span></Td>
                <Td className="whitespace-nowrap">{formatMoney(c.budget, cur)}</Td>
                <Td className="whitespace-nowrap font-bold text-rose-600">{formatMoney(c.spend, cur)}</Td>
                <Td>{formatNumber(c.impressions)}</Td>
                <Td>{formatNumber(c.clicks)}</Td>
                <Td>{formatNumber(c.results)}</Td>
                <Td className="whitespace-nowrap">{c.results ? formatMoney(c.spend / c.results, cur) : "—"}</Td>
                <Td className="whitespace-nowrap text-xs">
                  <span className="block text-emerald-600">+{formatNumber(r.linkedIncome)}</span>
                  <span className="block text-rose-600">−{formatNumber(r.linkedExpense)}</span>
                </Td>
                <Td className="whitespace-nowrap text-end">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setFormOpen(true); }} aria-label="تعديل"><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleting(r)} aria-label="حذف"><Trash2 className="size-4" /></Button>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      <CampaignForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.campaign.id })}
        loading={del.isPending}
        message={`هل أنت متأكد من حذف الحملة "${deleting?.campaign.name}"؟`}
      />
    </div>
  );
}
