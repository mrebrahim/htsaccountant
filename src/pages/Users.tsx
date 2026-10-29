import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { formatDate } from "../lib/format";
import { useAuth } from "../lib/auth";
import { PERMISSIONS, PERMISSION_LABELS, ROLES, ROLE_LABELS, type Permission, type Role } from "../../shared/constants";
import { Badge, Button, ConfirmDialog, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td } from "../components/ui";

type User = RouterOutputs["users"]["list"][number];

function UserForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: User | null }) {
  const utils = trpc.useUtils();
  const [f, setF] = useState({ name: "", email: "", password: "", role: "user" as Role, permissions: [] as Permission[], active: true });
  useEffect(() => {
    if (open)
      setF({
        name: editing?.name ?? "",
        email: editing?.email ?? "",
        password: "",
        role: editing?.role ?? "user",
        permissions: editing?.permissions ?? ["dashboard"],
        active: editing?.active ?? true,
      });
  }, [open, editing]);
  const done = () => { utils.users.invalidate(); onClose(); };
  const create = trpc.users.create.useMutation({ onSuccess: done });
  const update = trpc.users.update.useMutation({ onSuccess: done });
  const m = editing ? update : create;
  const toggle = (p: Permission) => setF({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] });

  return (
    <Modal open={open} onClose={onClose} title={editing ? "تعديل المستخدم" : "إضافة مستخدم"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (editing) update.mutate({ id: editing.id, ...f });
          else create.mutate(f);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="البريد الإلكتروني"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label={editing ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"} hint="8 أحرف على الأقل">
            <Input type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required={!editing} autoComplete="new-password" />
          </Field>
          <Field label="الدور">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
        </div>
        {f.role === "user" ? (
          <Field label="الأقسام المسموح بها">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3">
              {PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-brand-600" checked={f.permissions.includes(p)} onChange={() => toggle(p)} />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </Field>
        ) : (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">مدير النظام لديه صلاحية كاملة على جميع الأقسام، بما في ذلك إدارة المستخدمين وإعدادات فيسبوك.</p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          الحساب مفعّل
        </label>
        <ErrorBox message={m.error?.message} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={m.isPending}>حفظ</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const list = trpc.users.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const utils = trpc.useUtils();
  const del = trpc.users.delete.useMutation({ onSuccess: () => { setDeleting(null); utils.users.invalidate(); } });

  return (
    <div>
      <PageHeader
        title="المستخدمين والصلاحيات"
        subtitle="إدارة حسابات الدخول وتحديد الأقسام المتاحة لكل مستخدم"
        actions={<Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>مستخدم جديد</Button>}
      />
      <ErrorBox message={list.error?.message ?? del.error?.message} />
      {list.isLoading ? (
        <Spinner />
      ) : (
        <Table head={["المستخدم", "الدور", "الصلاحيات", "الحالة", "تاريخ الإنشاء", ""]} empty={!list.data?.length}>
          {list.data?.map((u) => (
            <tr key={u.id}>
              <Td>
                <span className="font-bold">{u.name}</span>
                {u.id === me.id && <span className="ms-1 text-xs text-slate-500">(أنت)</span>}
                <span className="ltr block text-xs text-slate-500">{u.email}</span>
              </Td>
              <Td><Badge tone={u.role === "admin" ? "violet" : "blue"}>{ROLE_LABELS[u.role]}</Badge></Td>
              <Td className="max-w-sm">
                {u.role === "admin" ? (
                  <span className="text-xs text-slate-500">كل الأقسام</span>
                ) : (
                  <div className="flex flex-wrap gap-1">{u.permissions.map((p) => <Badge key={p}>{PERMISSION_LABELS[p]}</Badge>)}</div>
                )}
              </Td>
              <Td><Badge tone={u.active ? "green" : "red"}>{u.active ? "مفعّل" : "معطّل"}</Badge></Td>
              <Td className="whitespace-nowrap">{formatDate(u.createdAt)}</Td>
              <Td className="whitespace-nowrap text-end">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(u); setFormOpen(true); }} aria-label="تعديل"><Pencil className="size-4" /></Button>
                {u.id !== me.id && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDeleting(u)} aria-label="حذف"><Trash2 className="size-4" /></Button>}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <UserForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate({ id: deleting.id })} loading={del.isPending} message={`هل أنت متأكد من حذف المستخدم "${deleting?.name}"؟`} />
    </div>
  );
}
