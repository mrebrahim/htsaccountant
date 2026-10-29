import { useState } from "react";
import { Lock } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button, ErrorBox, Field, Input } from "../components/ui";

export default function LoginPage({ needsSetup }: { needsSetup: boolean }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const onSuccess = () => utils.auth.status.invalidate();
  const login = trpc.auth.login.useMutation({ onSuccess });
  const setup = trpc.auth.setup.useMutation({ onSuccess });
  const m = needsSetup ? setup : login;

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white">H</div>
          <h1 className="text-2xl font-extrabold">HTS Media ERP</h1>
          <p className="mt-1 text-sm text-slate-500">
            {needsSetup ? "إعداد النظام لأول مرة — أنشئ حساب مدير النظام" : "تسجيل الدخول إلى نظام إدارة الموارد"}
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (needsSetup) setup.mutate({ name, email, password });
            else login.mutate({ email, password });
          }}
        >
          {needsSetup && (
            <Field label="الاسم">
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </Field>
          )}
          <Field label="البريد الإلكتروني">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </Field>
          <Field label="كلمة المرور" hint={needsSetup ? "8 أحرف على الأقل" : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={needsSetup ? 8 : 1}
              autoComplete={needsSetup ? "new-password" : "current-password"}
            />
          </Field>
          <ErrorBox message={m.error?.message} />
          <Button className="w-full" loading={m.isPending} icon={<Lock className="size-4" />}>
            {needsSetup ? "إنشاء حساب المدير" : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
