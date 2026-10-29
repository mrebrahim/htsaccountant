import { RotateCcw } from "lucide-react";
import { trpc } from "../lib/trpc";
import { CATEGORY_LABELS, TRANSACTION_TYPE_LABELS, TRANSACTION_CATEGORIES, categoriesForType, monthLabel, type TransactionCategory, type TransactionType } from "../../shared/constants";
import { Button, Input, MultiSelect, Select } from "./ui";

export type Filters = {
  type?: TransactionType;
  categories: TransactionCategory[];
  customerId?: number;
  months: string[];
  year?: number;
  search: string;
};
export const emptyFilters: Filters = { categories: [], months: [], search: "" };

/** Filter bar shared by the transactions and reports pages. */
export function TransactionFilters({ value, onChange, showYear, showSearch = true }: { value: Filters; onChange: (f: Filters) => void; showYear?: boolean; showSearch?: boolean }) {
  const customers = trpc.customers.options.useQuery();
  const months = trpc.transactions.months.useQuery();
  const years = trpc.reports.years.useQuery(undefined, { enabled: !!showYear });

  const categoryOptions = (value.type ? categoriesForType(value.type) : TRANSACTION_CATEGORIES).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
  const monthOptions = (months.data ?? [])
    .filter((m) => !value.year || m.startsWith(String(value.year)))
    .map((m) => ({ value: m, label: monthLabel(m) }));
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-6">
      {showYear && (
        <Select value={value.year ?? ""} onChange={(e) => set({ year: Number(e.target.value), months: [] })}>
          {years.data?.map((y) => <option key={y} value={y}>سنة {y}</option>)}
        </Select>
      )}
      <Select
        value={value.type ?? ""}
        onChange={(e) => {
          const type = (e.target.value || undefined) as TransactionType | undefined;
          set({ type, categories: type ? value.categories.filter((c) => categoriesForType(type).includes(c)) : value.categories });
        }}
      >
        <option value="">كل الأنواع</option>
        {(["income", "expense"] as const).map((t) => <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>)}
      </Select>
      <MultiSelect options={categoryOptions} value={value.categories} onChange={(categories) => set({ categories })} placeholder="كل التصنيفات" />
      <Select value={value.customerId ?? ""} onChange={(e) => set({ customerId: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">كل العملاء</option>
        {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <MultiSelect options={monthOptions} value={value.months} onChange={(m) => set({ months: m })} placeholder="كل الشهور" label={(s) => (s.length === 1 ? monthLabel(s[0]) : `${s.length} شهور`)} />
      {showSearch && <Input placeholder="بحث في الوصف..." value={value.search} onChange={(e) => set({ search: e.target.value })} />}
      <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => onChange({ ...emptyFilters, year: value.year })}>
        إعادة تعيين
      </Button>
    </div>
  );
}

export const toQuery = (f: Filters) => ({
  type: f.type,
  categories: f.categories.length ? f.categories : undefined,
  customerId: f.customerId,
  months: f.months.length ? f.months : undefined,
  year: f.year,
  search: f.search || undefined,
});
