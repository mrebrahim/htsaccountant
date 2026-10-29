// Shared enums and Arabic labels used by both the server and the client.

export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "إيراد",
  expense: "مصروف",
};

export const EXPENSE_CATEGORIES = ["fixed", "variable", "petty_cash", "customer", "campaign", "salaries"] as const;
export const INCOME_CATEGORIES = ["customer_payment", "commission", "other_income"] as const;
export const TRANSACTION_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  fixed: "مصروفات ثابتة",
  variable: "مصروفات متغيرة",
  petty_cash: "نثريات",
  customer: "مصروفات عملاء",
  campaign: "مصروفات حملات",
  salaries: "رواتب وسلف",
  customer_payment: "دفعات عملاء",
  commission: "عمولات",
  other_income: "إيرادات أخرى",
};

export const categoriesForType = (type: TransactionType): readonly TransactionCategory[] =>
  type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

export const AD_ACCOUNT_OWNERSHIP = ["owned", "partner", "client"] as const;
export type AdAccountOwnership = (typeof AD_ACCOUNT_OWNERSHIP)[number];
export const OWNERSHIP_LABELS: Record<AdAccountOwnership, string> = {
  owned: "حساب مملوك",
  partner: "حساب شريك",
  client: "حساب عميل",
};

export const EMPLOYEE_PAYMENT_TYPES = ["salary", "advance", "deduction", "bonus", "adjustment"] as const;
export type EmployeePaymentType = (typeof EMPLOYEE_PAYMENT_TYPES)[number];
export const EMPLOYEE_PAYMENT_LABELS: Record<EmployeePaymentType, string> = {
  salary: "صرف راتب",
  advance: "سلفة",
  deduction: "خصم",
  bonus: "مكافأة",
  adjustment: "تعديل راتب",
};

// Sections a non-admin user can be granted. Admins implicitly have all of them,
// plus users, settings and Facebook API controls.
export const PERMISSIONS = [
  "dashboard",
  "transactions",
  "customers",
  "ad_accounts",
  "campaigns",
  "employees",
  "reports",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard: "لوحة التحكم",
  transactions: "الحسابات المالية",
  customers: "العملاء",
  ad_accounts: "ميزانيات الإعلانات",
  campaigns: "الحملات الإعلانية",
  employees: "الموظفين",
  reports: "التقارير",
};

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  user: "مستخدم",
};

export const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** "2026-03" -> "مارس 2026" */
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
};
