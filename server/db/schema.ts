import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { Permission } from "../../shared/constants.js";

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).$type<"admin" | "user">().notNull().default("user"),
  permissions: jsonb("permissions").$type<Permission[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  company: varchar("company", { length: 160 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 190 }),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const adAccounts = pgTable("ad_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  // Facebook ad account id without the "act_" prefix
  fbAccountId: varchar("fb_account_id", { length: 40 }),
  ownership: varchar("ownership", { length: 20 }).$type<"owned" | "partner" | "client">().notNull().default("owned"),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  accountStatus: varchar("account_status", { length: 40 }),
  notes: text("notes"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Money transferred / funded into an ad account.
export const adFundings = pgTable(
  "ad_fundings",
  {
    id: serial("id").primaryKey(),
    adAccountId: integer("ad_account_id").notNull().references(() => adAccounts.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    date: date("date").notNull(),
    note: text("note"),
    transactionId: integer("transaction_id"),
    createdAt: createdAt(),
  },
  (t) => [index("ad_fundings_account_idx").on(t.adAccountId)],
);

// Actual spend per ad account per month (synced from Facebook or entered manually).
export const adSpend = pgTable(
  "ad_spend",
  {
    id: serial("id").primaryKey(),
    adAccountId: integer("ad_account_id").notNull().references(() => adAccounts.id, { onDelete: "cascade" }),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    spend: money("spend").notNull().default(0),
    source: varchar("source", { length: 10 }).$type<"facebook" | "manual">().notNull().default("manual"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ad_spend_account_month_uq").on(t.adAccountId, t.month)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    fbCampaignId: varchar("fb_campaign_id", { length: 40 }).unique(),
    adAccountId: integer("ad_account_id").references(() => adAccounts.id, { onDelete: "set null" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: varchar("status", { length: 30 }).notNull().default("ACTIVE"),
    objective: varchar("objective", { length: 60 }),
    budget: money("budget").notNull().default(0),
    spend: money("spend").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    results: integer("results").notNull().default(0),
    startDate: date("start_date"),
    endDate: date("end_date"),
    notes: text("notes"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("campaigns_customer_idx").on(t.customerId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 10 }).$type<"income" | "expense">().notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    amount: money("amount").notNull(),
    date: date("date").notNull(),
    description: text("description"),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    employeeId: integer("employee_id"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("transactions_date_idx").on(t.date), index("transactions_customer_idx").on(t.customerId)],
);

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  jobTitle: varchar("job_title", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 190 }),
  baseSalary: money("base_salary").notNull().default(0),
  hireDate: date("hire_date"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const employeePayments = pgTable(
  "employee_payments",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    amount: money("amount").notNull(),
    date: date("date").notNull(),
    month: varchar("month", { length: 7 }).notNull(), // payroll month YYYY-MM
    note: text("note"),
    transactionId: integer("transaction_id"),
    createdAt: createdAt(),
  },
  (t) => [index("employee_payments_employee_idx").on(t.employeeId)],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
