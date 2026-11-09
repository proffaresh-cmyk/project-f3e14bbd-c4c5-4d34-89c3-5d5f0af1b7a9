import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkAuth, login } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "الدخول — منظّمي" },
      { name: "description", content: "الدخول إلى لوحة منظّمي الشخصية." },
      { property: "og:title", content: "الدخول — منظّمي" },
      { property: "og:description", content: "الدخول إلى لوحة منظّمي الشخصية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const r = await checkAuth();
    if (r.authed) throw redirect({ to: "/" });
    return { configured: r.configured };
  },
  component: LoginPage,
});

function LoginPage() {
  const { configured } = Route.useRouteContext();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-hero text-3xl shadow-soft">🗓️</div>
          <h1 className="text-4xl font-semibold text-foreground">منظّمي</h1>
          <p className="mt-2 text-muted-foreground">مساعدك الشخصي لتنظيم اليوم</p>
        </div>
        <form
          className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const r = await login({ data: { password } });
            setBusy(false);
            if (r.ok) router.navigate({ to: "/" });
            else setError(r.error ?? "خطأ");
          }}
        >
          <label htmlFor="pw" className="text-sm font-medium text-foreground">كلمة المرور</label>
          <Input id="pw" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!configured && <p className="text-xs text-muted-foreground">لم تُضبط كلمة مرور اللوحة بعد.</p>}
          <Button type="submit" className="h-11 w-full" disabled={busy || !password}>
            {busy ? "…" : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
