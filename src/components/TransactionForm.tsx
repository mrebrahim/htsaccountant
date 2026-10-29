import { useEffect, useState } from "react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { todayISO } from "../lib/format";
import { CATEGORY_LABELS, TRANSACTION_TYPE_LABELS, categoriesForType, type TransactionCategory, type TransactionType } from "../../shared/constants";
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea } from "./ui";

type Tx = RouterOutputs["transactions"]["list"]["rows"][number];

export function TransactionForm({
  open,
  onClose,
  editing,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Tx | null;
  defaults?: { type?: TransactionType; customerId?: number };
}) {
  const utils = trpc.useUtils();
  const customers = trpc.customers.options.useQuery(undefined, { enabled: open });
  const campaigns = trpc.campaigns.options.useQuery(undefined, { enabled: open, retry: false });

  const [type, setType] = useState<TransactionType>("expense");
  const [category, setCategory] = useState<TransactionCategory>("fixed");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [campaignId, setCampaignId] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = editing?.type ?? defaults?.type ?? "expense";
    setType(t);
    setCategory((editing?.category as TransactionCategory) ?? categoriesForType(t)[0]);
    setAmount(editing ? String(editing.amount) : "");
    setDate(editing?.date ?? todayISO());
    setDescription(editing?.description ?? "");
    setCustomerId(String(editing?.customerId ?? defaults?.customerId ?? ""));
    setCampaignId(String(editing?.campaignId ?? ""));
  }, [open, editing, defaults?.type, defaults?.customerId]);

  const done = () => {
    utils.transactions.invalidate();
    utils.customers.invalidate();
    utils.dashboard.invalidate();
    utils.reports.invalidate();
    utils.campaigns.invalidate();
    onClose();
  };
  const create = trpc.transactions.create.useMutation({ onSuccess: done });
  const update = trpc.transactions.update.useMutation({ onSuccess: done });
  const m = editing ? update : create;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      type,
      category,
      amount: Number(amount),
      date,
      description: description || null,
      customerId: customerId ? Number(customerId) : null,
      campaignId: campaignId ? Number(campaignId) : null,
    };
    if (editing) update.mutate({ id: editing.id, data });
    else create.mutate(data);
  };

  const campaignOptions = (campaigns.data ?? []).filter((c) => !customerId || !c.customerId || String(c.customerId) === customerId);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "تعديل معاملة" : "إضافة معاملة جديدة"}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="نوع المعاملة">
          <div className="grid grid-cols-2 gap-2">
            {(["income", "expense"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => { setType(t); setCategory(categoriesForType(t)[0]); }}
                className={`rounded-lg border py-2 text-sm font-bold transition ${
                  type === t
                    ? t === "income" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-slate-300 text-slate-500"
                }`}
              >
                {TRANSACTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="التصنيف">
          <Select value={category} onChange={(e) => setCategory(e.target.value as TransactionCategory)}>
            {categoriesForType(type).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </Field>
        <Field label="المبلغ">
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="العميل (اختياري)">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">بدون عميل</option>
            {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="الحملة (اختياري)">
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">بدون حملة</option>
            {campaignOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="الوصف" className="sm:col-span-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="sm:col-span-2"><ErrorBox message={m.error?.message} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={m.isPending}>{editing ? "حفظ التعديلات" : "إضافة"}</Button>
        </div>
      </form>
    </Modal>
  );
}
