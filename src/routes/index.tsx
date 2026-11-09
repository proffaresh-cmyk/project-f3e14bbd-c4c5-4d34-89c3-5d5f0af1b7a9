import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Panel, Section } from "@/components/AppShell";
import { TaskDialog } from "@/components/TaskDialog";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { addStep, deleteStep, logStudy, setProjectStatus, toggleHabitLog, toggleStep } from "@/lib/api.functions";
import { DAY_NAMES, REMINDER_KINDS } from "@/lib/constants";
import { requireAuth } from "@/lib/guard";
import { dashboardQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "اليوم — منظّمي" },
      { name: "description", content: "مهام اليوم، العادات، الدراسة وتذكيرات اليوم في مكان واحد." },
      { property: "og:title", content: "اليوم — منظّمي" },
      { property: "og:description", content: "مهام اليوم، العادات، الدراسة وتذكيرات اليوم في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: requireAuth,
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: TodayPage,
});

function TodayPage() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries();

  const study = useMutation({
    mutationFn: (hours: number) => logStudy({ data: { hours } }),
    onSuccess: (_r, h) => {
      toast.success(`سُجّلت ${h} ساعة دراسة 📚`);
      invalidate();
    },
  });
  const habit = useMutation({
    mutationFn: (habit_id: string) => toggleHabitLog({ data: { habit_id, date: data.today } }),
    onSuccess: invalidate,
  });

  const open = data.tasks.filter((t) => t.status !== "done");
  const done = data.tasks.filter((t) => t.status === "done");
  const pct = data.goal > 0 ? Math.min(100, Math.round((data.study / data.goal) * 100)) : 0;

  return (
    <AppShell title="اليوم" subtitle={`${DAY_NAMES[data.dow]} · ${data.today}`}>
      <div className="mb-6 rounded-3xl bg-hero p-5 text-primary-foreground shadow-soft">
        <div className="flex items-baseline justify-between">
          <p className="text-sm opacity-80">📚 الدراسة اليوم</p>
          <p className="font-display text-2xl">
            {data.study} <span className="text-base opacity-70">/ {data.goal} س</span>
          </p>
        </div>
        <Progress value={pct} className="mt-3 h-2 bg-primary-foreground/20 [&>div]:bg-accent" />
        <div className="mt-4 flex gap-2">
          {[0.5, 1, 1.5, 2].map((h) => (
            <Button key={h} variant="hero" size="sm" className="flex-1 rounded-full" disabled={study.isPending} onClick={() => study.mutate(h)}>
              +{h}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-sm opacity-90">
          <span>✅ {done.length} منجزة</span>
          <span>📋 {open.length} متبقية</span>
        </div>
      </div>

      <Section
        title="مهام اليوم"
        action={
          <TaskDialog
            defaultDate={data.today}
            trigger={
              <Button variant="soft" size="sm" className="rounded-full">
                <Plus /> مهمة
              </Button>
            }
          />
        }
      >
        <div className="space-y-2">
          {open.length === 0 && done.length === 0 && (
            <Panel className="text-center text-sm text-muted-foreground">لا توجد مهام لليوم. أضف واحدة أو أرسلها للبوت ✨</Panel>
          )}
          {open.map((t) => (
            <TaskRow key={t.id} task={t} today={data.today} />
          ))}
          {done.map((t) => (
            <TaskRow key={t.id} task={t} today={data.today} />
          ))}
        </div>
      </Section>

      {data.habits.length > 0 && (
        <Section title="العادات">
          <div className="grid grid-cols-2 gap-2">
            {data.habits.map((h) => (
              <button
                key={h.id}
                onClick={() => habit.mutate(h.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                  h.doneToday ? "border-success bg-success/10" : "bg-card hover:bg-secondary",
                )}
              >
                <span className="text-2xl">{h.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{h.name}</span>
                  <span className="text-xs text-muted-foreground">
                    🔥 {h.streak} {h.frequency === "weekly" ? "أسبوع" : "يوم"}
                  </span>
                </span>
                {h.doneToday && <Check className="size-4 text-success" />}
              </button>
            ))}
          </div>
        </Section>
      )}

      {data.project && <ProjectCard project={data.project} />}

      {data.reminders.length > 0 && (
        <Section title="تذكيرات اليوم">
          <Panel className="p-0">
            <ol className="divide-y">
              {data.reminders.map((r) => {
                const acked = r.ack_date === data.today;
                const sent = r.last_sent_date === data.today;
                const passed = r.remind_time.slice(0, 5) <= data.time;
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-12 font-display text-sm text-primary">{r.remind_time.slice(0, 5)}</span>
                    <span className="flex-1 truncate text-sm text-foreground">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {acked ? "✅" : sent ? (["morning", "evening"].includes(r.kind) ? "📨" : "⏳") : passed ? "—" : REMINDER_KINDS[r.kind]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </Section>
      )}
    </AppShell>
  );
}

type Project = {
  id: string;
  name: string;
  status: string;
  steps: { id: string; title: string; done: boolean }[];
};

function ProjectCard({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const inv = () => qc.invalidateQueries();
  const toggle = useMutation({ mutationFn: (s: { id: string; done: boolean }) => toggleStep({ data: s }), onSuccess: inv });
  const add = useMutation({
    mutationFn: () => addStep({ data: { project_id: project.id, title } }),
    onSuccess: () => {
      setTitle("");
      inv();
    },
  });
  const del = useMutation({ mutationFn: (id: string) => deleteStep({ data: { id } }), onSuccess: inv });
  const status = useMutation({
    mutationFn: (s: "active" | "done") => setProjectStatus({ data: { id: project.id, status: s } }),
    onSuccess: (_r, s) => {
      if (s === "done") toast.success("مبروك البيع! 🎉 أوقفت التذكير اليومي");
      inv();
    },
  });
  const doneCount = project.steps.filter((s) => s.done).length;
  const sold = project.status === "done";

  return (
    <Section title={`📖 ${project.name}`} action={<span className="text-sm text-muted-foreground">{sold ? "تم البيع 🎉" : `${doneCount}/${project.steps.length}`}</span>}>
      <Panel>
        {sold ? (
          <div className="flex items-center justify-between">
            <p className="text-foreground">تم بيع الكتاب. أحسنت! 🎉</p>
            <Button variant="ghost" size="sm" onClick={() => status.mutate("active")}>إعادة التفعيل</Button>
          </div>
        ) : (
          <>
            <Progress value={project.steps.length ? (doneCount / project.steps.length) * 100 : 0} className="mb-3 h-1.5" />
            <ul className="space-y-1">
              {project.steps.map((s) => (
                <li key={s.id} className="group flex items-center gap-3 rounded-lg px-1 py-1.5">
                  <Checkbox checked={s.done} onCheckedChange={(c) => toggle.mutate({ id: s.id, done: c === true })} />
                  <span className={cn("flex-1 text-sm text-foreground", s.done && "text-muted-foreground line-through")}>{s.title}</span>
                  <button className="text-muted-foreground opacity-50 hover:opacity-100" aria-label="حذف الخطوة" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) add.mutate();
              }}
            >
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="خطوة جديدة…" className="h-9" />
              <Button type="submit" variant="soft" size="sm" className="h-9" disabled={!title.trim()}>
                إضافة
              </Button>
            </form>
            <Button variant="accent" className="mt-3 w-full" onClick={() => status.mutate("done")}>
              🎉 تم البيع
            </Button>
          </>
        )}
      </Panel>
    </Section>
  );
}
