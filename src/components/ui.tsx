import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Loader2, X, Inbox, ChevronDown, Check } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  ghost: "text-slate-600 hover:bg-slate-100",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Field({ label, error, children, className, hint }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100";

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...rest} className={clsx(inputCls, className)} />
);
export const Textarea = ({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...rest} className={clsx(inputCls, className)} />
);
export const Select = ({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className={clsx("relative", className)}>
    <select {...rest} className={clsx(inputCls, "appearance-none pe-8")}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
  </div>
);

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="font-bold text-slate-800">{title}</h3>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

const tones = {
  blue: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
};
export type Tone = keyof typeof tones;

export function StatCard({ label, value, icon, tone = "blue", sub }: { label: string; value: ReactNode; icon?: ReactNode; tone?: Tone; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-extrabold text-slate-900 sm:text-2xl">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {icon && <div className={clsx("rounded-lg p-2.5", tones[tone])}>{icon}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={clsx("max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, message, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; message: string; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="تأكيد الحذف">
      <p className="text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>حذف</Button>
      </div>
    </Modal>
  );
}

export function Table({ head, children, empty, footer }: { head: ReactNode[]; children: ReactNode; empty?: boolean; footer?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-start font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
        {footer && <tfoot className="bg-slate-50 font-bold">{footer}</tfoot>}
      </table>
      {empty && <EmptyState />}
    </div>
  );
}

export const Td = ({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={clsx("px-3 py-2.5 align-middle", className)}>{children}</td>
);

export function EmptyState({ text = "لا توجد بيانات لعرضها" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
      <Inbox className="size-8" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export const Spinner = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="size-8 animate-spin text-brand-600" />
  </div>
);

export function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div>;
}

/** Dropdown with checkboxes for picking multiple values (months, categories...). */
export function MultiSelect<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  label,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  placeholder: string;
  label?: (selected: T[]) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const text = value.length === 0 ? placeholder : label ? label(value) : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? "" : `${value.length} محدد`;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={clsx(inputCls, "flex items-center justify-between gap-2 text-start")}>
        <span className={clsx("truncate", value.length === 0 && "text-slate-400")}>{text}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full min-w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-full rounded px-2 py-1.5 text-start text-xs font-semibold text-brand-600 hover:bg-slate-50">
              مسح التحديد
            </button>
          )}
          {options.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">لا توجد خيارات</p>}
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => toggle(o.value)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-slate-50"
            >
              <span className={clsx("flex size-4 items-center justify-center rounded border", value.includes(o.value) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300")}>
                {value.includes(o.value) && <Check className="size-3" />}
              </span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx("whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition", value === t.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const moneyTone = (n: number) => (n > 0 ? "text-emerald-600" : n < 0 ? "text-rose-600" : "text-slate-600");
