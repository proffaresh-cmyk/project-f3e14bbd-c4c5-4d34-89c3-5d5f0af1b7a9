import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AppShell, Panel } from "@/components/AppShell";
import { Chip, TaskDialog } from "@/components/TaskDialog";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/constants";
import { requireAuth } from "@/lib/guard";
import { tasksQuery } from "@/lib/queries";
import { zonedNow } from "@/lib/time";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "المهام — منظّمي" },
      { name: "description", content: "كل المهام حسب التصنيف والأولوية والحالة." },
      { property: "og:title", content: "المهام — منظّمي" },
      { property: "og:description", content: "كل المهام حسب التصنيف والأولوية والحالة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: requireAuth,
  loader: ({ context }) => context.queryClient.ensureQueryData(tasksQuery),
  component: TasksPage,
});

function TasksPage() {
  const { data } = useSuspenseQuery(tasksQuery);
  const [cat, setCat] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "done">("open");
  const today = zonedNow("Africa/Algiers").date;
  const filtered = data.filter((t) => (!cat || t.category === cat) && (tab === "done" ? t.status === "done" : t.status !== "done"));

  return (
    <AppShell
      title="المهام"
      subtitle={`${data.filter((t) => t.status !== "done").length} مفتوحة`}
      action={
        <TaskDialog
          trigger={
            <Button size="icon" className="rounded-full" aria-label="مهمة جديدة">
              <Plus />
            </Button>
          }
        />
      }
    >
      <div className="mb-3 flex rounded-full bg-muted p-1">
        {(["open", "done"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${tab === k ? "bg-paper text-foreground shadow-soft" : "text-muted-foreground"}`}
          >
            {k === "open" ? "المفتوحة" : "المنجزة"}
          </button>
        ))}
      </div>
      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip active={!cat} onClick={() => setCat(null)}>الكل</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.name} active={cat === c.name} onClick={() => setCat(c.name)}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <Panel className="text-center text-sm text-muted-foreground">لا توجد مهام هنا.</Panel>}
        {filtered.map((t) => (
          <TaskRow key={t.id} task={t} today={today} editable />
        ))}
      </div>
    </AppShell>
  );
}
