import { useEffect, useState } from "react";
import { Save, PlugZap, ShieldAlert } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner } from "../components/ui";
import { CURRENCY_SYMBOLS } from "../lib/format";

export default function SettingsPage() {
  const q = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const [f, setF] = useState({ companyName: "", currency: "EGP", fbApiVersion: "v21.0", fbAccessToken: "" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (q.data) setF({ companyName: q.data.companyName, currency: q.data.currency, fbApiVersion: q.data.fbApiVersion, fbAccessToken: "" });
  }, [q.data]);
  const save = trpc.settings.save.useMutation({
    onSuccess: () => {
      utils.settings.invalidate();
      setF((x) => ({ ...x, fbAccessToken: "" }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });
  const test = trpc.settings.testFacebook.useMutation();

  if (q.isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="إعدادات النظام" subtitle="هذه الصفحة متاحة لمدير النظام فقط" />
      <form
        className="grid gap-4 lg:grid-cols-2"
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
          </div>
        </Card>

        <Card title="ربط Facebook Ads API">
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <ShieldAlert className="size-4 shrink-0" />
              يُحفظ رمز الوصول في قاعدة البيانات ولا يُعرض مرة أخرى. استخدم رمز System User طويل المدة بصلاحية ads_read.
            </div>
            <Field label="رمز الوصول (Access Token)" hint={q.data?.fbTokenSet ? `الرمز الحالي: ${q.data.fbTokenHint} — اتركه فارغاً للإبقاء عليه` : "لم يتم إعداد رمز بعد"}>
              <Input type="password" dir="ltr" value={f.fbAccessToken} onChange={(e) => setF({ ...f, fbAccessToken: e.target.value })} autoComplete="off" placeholder="EAAG..." />
            </Field>
            <Field label="إصدار Graph API"><Input dir="ltr" value={f.fbApiVersion} onChange={(e) => setF({ ...f, fbApiVersion: e.target.value })} pattern="v\d+\.\d+" required /></Field>
            <Button type="button" variant="secondary" icon={<PlugZap className="size-4" />} loading={test.isPending} onClick={() => test.mutate()} disabled={!q.data?.fbTokenSet}>
              اختبار الاتصال
            </Button>
            {test.data && <p className="text-sm text-emerald-600">تم الاتصال بنجاح — {test.data.accounts} حساب إعلاني متاح.</p>}
            <ErrorBox message={test.error?.message} />
          </div>
        </Card>

        <div className="flex items-center gap-3 lg:col-span-2">
          <Button loading={save.isPending} icon={<Save className="size-4" />}>حفظ الإعدادات</Button>
          {saved && <span className="text-sm text-emerald-600">تم الحفظ</span>}
          <ErrorBox message={save.error?.message} />
        </div>
      </form>
    </div>
  );
}
