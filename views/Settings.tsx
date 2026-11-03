"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { CURRENCY_SYMBOLS } from "@/lib/format";

export default function SettingsPage() {
  const q = trpc.settings.general.useQuery();
  const utils = trpc.useUtils();
  const [f, setF] = useState({ companyName: "", currency: "EGP" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (q.data) setF(q.data);
  }, [q.data]);
  const save = trpc.settings.save.useMutation({
    onSuccess: () => {
      utils.settings.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (q.isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="إعدادات النظام" subtitle="هذه الصفحة متاحة لمدير النظام فقط" />
      <form
        className="max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(f);
        }}
      >
        <Card title="الإعدادات العامة">
          <div className="space-y-4">
            <Field label="اسم الشركة"><Input value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} required /></Field>
            <Field label="العملة الأساسية للحسابات">
              <Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
                {Object.entries(CURRENCY_SYMBOLS).map(([k, v]) => <option key={k} value={k}>{k} ({v})</option>)}
              </Select>
            </Field>
            <div className="flex items-center gap-3">
              <Button loading={save.isPending} icon={<Save className="size-4" />}>حفظ الإعدادات</Button>
              {saved && <span className="text-sm text-emerald-600">تم الحفظ</span>}
            </div>
            <ErrorBox message={save.error?.message} />
          </div>
        </Card>
      </form>
    </div>
  );
}
