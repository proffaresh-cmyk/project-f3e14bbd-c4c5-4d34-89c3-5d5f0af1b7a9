import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { deleteTask, setTaskStatus } from "@/lib/api.functions";
import { categoryEmoji } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TaskDialog, type TaskFormValue } from "./TaskDialog";

type T = {
  id: string;
  title: string;
  category: string;
  priority: string;
  due_date: string | null;
  due_time: string | null;
  status: string;
  nag: boolean;
};

const PRIO_BAR: Record<string, string> = {
  high: "bg-prio-high",
  med: "bg-prio-med",
  low: "bg-prio-low",
};

export function TaskRow({ task, today, editable = false }: { task: T; today: string; editable?: boolean }) {
  const qc = useQueryClient();
  const done = task.status === "done";
  const toggle = useMutation({
    mutationFn: () => setTaskStatus({ data: { id: task.id, status: done ? "todo" : "done" } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const del = useMutation({
    mutationFn: () => deleteTask({ data: { id: task.id } }),
    onSuccess: () => {
      toast.success("حُذفت المهمة");
      qc.invalidateQueries();
    },
  });
  const overdue = !done && task.due_date && task.due_date < today;
  const meta = [
    `${categoryEmoji(task.category)} ${task.category}`,
    task.due_date && task.due_date !== today ? task.due_date : null,
    task.due_time ? task.due_time.slice(0, 5) : null,
    task.status === "snoozed" ? "⏰ مؤجلة" : null,
  ].filter(Boolean);

  return (
    <div className={cn("group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card py-3 pe-2 ps-4", done && "opacity-60")}>
      <span className={cn("absolute inset-y-0 right-0 w-1", PRIO_BAR[task.priority])} aria-hidden />
      <Checkbox
        checked={done}
        onCheckedChange={() => toggle.mutate()}
        disabled={toggle.isPending}
        className="size-5 rounded-full"
        aria-label={done ? "إلغاء الإنجاز" : "تم"}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium text-foreground", done && "line-through")}>{task.title}</p>
        <p className={cn("mt-0.5 text-xs text-muted-foreground", overdue && "text-destructive")}>
          {meta.join(" · ")}
          {overdue ? " · متأخرة" : ""}
        </p>
      </div>
      {editable && (
        <div className="flex items-center">
          <TaskDialog
            initial={{
              id: task.id,
              title: task.title,
              category: task.category,
              priority: task.priority as TaskFormValue["priority"],
              due_date: task.due_date,
              due_time: task.due_time,
              nag: task.nag,
            }}
            trigger={
              <Button variant="ghost" size="icon" aria-label="تعديل">
                <Pencil />
              </Button>
            }
          />
          <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => confirm("حذف المهمة؟") && del.mutate()}>
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  );
}
