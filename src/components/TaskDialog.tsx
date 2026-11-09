import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveTask } from "@/lib/api.functions";
import { CATEGORIES, PRIORITIES, type Priority } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type TaskFormValue = {
  id?: string;
  title: string;
  category: string;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  nag: boolean;
};

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-paper text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

export function TaskDialog({ trigger, initial, defaultDate }: { trigger: ReactNode; initial?: TaskFormValue; defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  const blank: TaskFormValue = { title: "", category: "شخصي", priority: "med", due_date: defaultDate ?? null, due_time: null, nag: true };
  const [v, setV] = useState<TaskFormValue>(initial ?? blank);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (data: TaskFormValue) => saveTask({ data: { ...data, due_time: data.due_time || null, due_date: data.due_date || null } }),
    onSuccess: () => {
      toast.success(initial ? "تم حفظ التعديلات" : "تمت إضافة المهمة");
      qc.invalidateQueries();
      setOpen(false);
      if (!initial) setV(blank);
    },
    onError: () => toast.error("تعذّر الحفظ"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setV(initial ?? blank);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right font-display">{initial ? "تعديل المهمة" : "مهمة جديدة"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!v.title.trim()) return;
            m.mutate(v);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="t-title">العنوان</Label>
            <Input id="t-title" autoFocus value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="مثلاً: مراجعة الفصل الثالث" maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>التصنيف</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c.name} active={v.category === c.name} onClick={() => setV({ ...v, category: c.name })}>
                  {c.emoji} {c.name}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>الأولوية</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <Chip key={p.value} active={v.priority === p.value} onClick={() => setV({ ...v, priority: p.value })}>
                  {p.icon} {p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-date">التاريخ</Label>
              <Input id="t-date" type="date" value={v.due_date ?? ""} onChange={(e) => setV({ ...v, due_date: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-time">وقت التذكير</Label>
              <Input id="t-time" type="time" value={v.due_time?.slice(0, 5) ?? ""} onChange={(e) => setV({ ...v, due_time: e.target.value || null })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
            <Label htmlFor="t-nag" className="text-sm">إلحاح حتى الإنجاز 🔁</Label>
            <Switch id="t-nag" checked={v.nag} onCheckedChange={(c) => setV({ ...v, nag: c })} />
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending || !v.title.trim()}>
            {m.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
