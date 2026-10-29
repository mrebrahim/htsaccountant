import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard,
  Wallet,
  Users,
  Megaphone,
  Target,
  UserCog,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../lib/auth";
import { ROLE_LABELS, type Permission } from "../../shared/constants";
import { Button, ErrorBox, Field, Input, Modal } from "./ui";

const NAV: { to: string; label: string; icon: typeof Wallet; perm?: Permission; admin?: boolean }[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, perm: "dashboard" },
  { to: "/transactions", label: "الحسابات المالية", icon: Wallet, perm: "transactions" },
  { to: "/customers", label: "العملاء", icon: Users, perm: "customers" },
  { to: "/ad-accounts", label: "ميزانيات الإعلانات", icon: Target, perm: "ad_accounts" },
  { to: "/campaigns", label: "الحملات الإعلانية", icon: Megaphone, perm: "campaigns" },
  { to: "/employees", label: "الموظفين", icon: UserCog, perm: "employees" },
  { to: "/reports", label: "التقارير والتحليلات", icon: BarChart3, perm: "reports" },
  { to: "/users", label: "المستخدمين والصلاحيات", icon: ShieldCheck, admin: true },
  { to: "/settings", label: "إعدادات النظام", icon: Settings, admin: true },
];

function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const m = trpc.auth.changePassword.useMutation({ onSuccess: () => { setCurrent(""); setNext(""); onClose(); } });
  return (
    <Modal open={open} onClose={onClose} title="تغيير كلمة المرور">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate({ current, next }); }}>
        <Field label="كلمة المرور الحالية"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
        <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل"><Input type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <ErrorBox message={m.error?.message} />
        <div className="flex justify-end"><Button loading={m.isPending}>حفظ</Button></div>
      </form>
    </Modal>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, can, isAdmin, settings } = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const location = useLocation();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => utils.invalidate() });

  const items = NAV.filter((n) => (n.admin ? isAdmin : n.perm ? can(n.perm) : true));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white">H</div>
        <div>
          <p className="font-extrabold leading-tight text-white">{settings.companyName}</p>
          <p className="text-xs text-slate-400">نظام إدارة الموارد</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                isActive ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-bold text-white">{user.name}</p>
        <p className="truncate text-xs text-slate-400">{ROLE_LABELS[user.role]} · <span className="ltr">{user.email}</span></p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setPw(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-xs text-slate-300 hover:bg-white/10">
            <KeyRound className="size-4" /> كلمة المرور
          </button>
          <button onClick={() => logout.mutate()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-xs text-slate-300 hover:bg-rose-600 hover:text-white">
            <LogOut className="size-4" /> خروج
          </button>
        </div>
      </div>
    </div>
  );

  const current = NAV.find((n) => (n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)));

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar (on the right in RTL) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 bg-slate-900 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-slate-900 shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute end-3 top-5 text-slate-400" aria-label="إغلاق">
              <X className="size-6" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ms-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="القائمة">
            <Menu className="size-6" />
          </button>
          <p className="font-bold">{current?.label ?? settings.companyName}</p>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
      <ChangePassword open={pw} onClose={() => setPw(false)} />
    </div>
  );
}
