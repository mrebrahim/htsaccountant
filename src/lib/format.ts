const numberFmt = new Intl.NumberFormat("ar-EG-u-nu-latn", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EGP: "ج.م",
  USD: "$",
  SAR: "ر.س",
  AED: "د.إ",
  KWD: "د.ك",
  EUR: "€",
};

export const formatNumber = (n: number | null | undefined) => numberFmt.format(Number(n ?? 0));

export const formatMoney = (n: number | null | undefined, currency = "EGP") =>
  `${formatNumber(n)} ${CURRENCY_SYMBOLS[currency] ?? currency}`;

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d;
  return date.toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "short", day: "numeric" });
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const currentMonth = () => todayISO().slice(0, 7);
