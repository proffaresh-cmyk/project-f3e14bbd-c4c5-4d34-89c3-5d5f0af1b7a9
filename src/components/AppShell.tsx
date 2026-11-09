import { Link, useRouter } from "@tanstack/react-router";
import { BarChart3, Bell, CalendarCheck, Flame, ListTodo, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { logout } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "اليوم", icon: CalendarCheck },
  { to: "/tasks", label: "المهام", icon: ListTodo },
  { to: "/reminders", label: "التذكيرات", icon: Bell },
  { to: "/habits", label: "العادات", icon: Flame },
  { to: "/stats", label: "الإحصاء", icon: BarChart3 },
] as const;

export function AppShell({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="mx-auto flex max-w-xl items-end justify-between gap-3 px-5 pt-6 pb-4">
        <div>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {action}
          <Button variant="ghost" size="icon" asChild aria-label="الإعدادات">
            <Link to="/settings">
              <Settings />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="تسجيل الخروج"
            onClick={async () => {
              await logout();
              router.navigate({ to: "/login" });
            }}
          >
            <LogOut />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-paper/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: true }}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-4 shadow-soft ${className}`}>{children}</div>;
}
