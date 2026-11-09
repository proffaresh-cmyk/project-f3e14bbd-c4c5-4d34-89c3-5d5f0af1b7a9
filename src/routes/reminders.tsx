import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/AppShell";
import { Chip } from "@/components/TaskDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteReminder, saveReminder, toggleReminder } from "@/lib/api.functions";
import { DAY_NAMES, DAY_SHORT, REMINDER_KINDS } from "@/lib/constants";
import { requireAuth } from "@/lib/guard";
import { remindersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "التذكيرات — منظّمي" },
      { name: "description", content: "التذكيرات المتكررة بأوقاتها وأيامها." },
      { property: "og:title", content: "التذكيرات — منظّمي" },
      { property: "og:description", content: "التذكيرات المتكررة بأوقاتها وأيامها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: requireAuth,
  loader: ({ context }) => context.queryClient.ensureQueryData(remindersQuery),
  component: RemindersPage,
});

type Kind = "custom" | "study" | "habit" | "project" | "morning" | "evening";
type Form = {
  id?: string;
  title: string;
  message: string;
  remind_time: string;
  days: number[];
  kind: Kind;
  nag: boolean;
  active: boolean;
  habit_id: string | null;
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function daysLabel(days: number[]) {
  if (days.length === 7) return "يومياً";
  return days.map((d) => DAY_NAMES[d]).join("، ");
}

function RemindersPage() {
  const { data } = useSuspenseQuery(remindersQuery);
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleReminder({ data: v }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteReminder({ data: { id } }),
    onSuccess: () => {
      toast.success("حُذف التذكير");
      qc.invalidateQueries();
    },
  });

  return (
    <AppShell
      title="التذكيرات"
      subtitle={`${data.reminders.filter((r) => r.active).length} مفعّلة`}
      action={
        <ReminderDialog
          habits={data.habits}
          trigger={
            <Button size="icon" className="rounded-full" aria-label="تذكير جديد">
              <Plus />
            </Button>
          }
        />
      }
    >
      <div className="space-y-2">
        {data.reminders.length === 0 && <Panel className="text-center text-sm text-muted-foreground">لا توجد تذكيرات بعد.</Panel>}
        {data.reminders.map((r) => (
          <div key={r.id} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", !r.active && "opacity-55")}>
            <div className="w-14 text-center">
              <p className="font-display text-xl text-primary">{r.remind_time.slice(0, 5)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{r.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {REMINDER_KINDS[r.kind]} · {daysLabel(r.days)}
                {r.nag ? " · 🔁" : ""}
              </p>
            </div>
            <Switch checked={r.active} onCheckedChange={(c) => toggle.mutate({ id: r.id, active: c })} aria-label="تفعيل" />
            <ReminderDialog
              habits={data.habits}
              initial={{
                id: r.id,
                title: r.title,
                message: r.message,
                remind_time: r.remind_time.slice(0, 5),
                days: r.days,
                kind: r.kind as Kind,
                nag: r.nag,
                active: r.active,
                habit_id: r.habit_id,
              }}
              trigger={
                <Button variant="ghost" size="icon" aria-label="تعديل">
                  <Pencil />
                </Button>
              }
            />
            <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => confirm("حذف التذكير؟") && del.mutate(r.id)}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        لا تُرسل التذكيرات أثناء ساعات النوم، ما عدا رسالة الصباح. 🔁 = يعيد الإرسال حتى تؤكد.
      </p>
    </AppShell>
  );
}

function ReminderDialog({ trigger, initial, habits }: { trigger: ReactNode; initial?: Form; habits: { id: string; name: string; emoji: string }[] }) {
  const blank: Form = { title: "", message: "", remind_time: "18:00", days: ALL_DAYS, kind: "custom", nag: true, active: true, habit_id: null };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Form>(initial ?? blank);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (f: Form) => saveReminder({ data: { ...f, habit_id: f.kind === "habit" ? f.habit_id : null } }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries();
      setOpen(false);
    },
    onError: () => toast.error("تعذّر الحفظ"),
  });
  const toggleDay = (d: number) =>
    setV({ ...v, days: v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d].sort() });

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
          <DialogTitle className="text-right font-display">{initial ? "تعديل التذكير" : "تذكير جديد"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.title.trim() && v.days.length) m.mutate(v);
          }}
        >
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-title">العنوان</Label>
              <Input id="r-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-time">الوقت</Label>
              <Input id="r-time" type="time" value={v.remind_time} onChange={(e) => setV({ ...v, remind_time: e.target.value })} className="w-28" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-msg">الرسالة</Label>
            <Textarea id="r-msg" rows={2} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label>الأيام</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((d) => (
                <Chip key={d} active={v.days.includes(d)} onClick={() => toggleDay(d)}>
                  {DAY_SHORT[d]}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>النوع</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(REMINDER_KINDS) as Kind[]).map((k) => (
                <Chip key={k} active={v.kind === k} onClick={() => setV({ ...v, kind: k, nag: k === "morning" || k === "evening" ? false : v.nag })}>
                  {REMINDER_KINDS[k]}
                </Chip>
              ))}
            </div>
          </div>
          {v.kind === "habit" && (
            <div className="space-y-1.5">
              <Label>العادة المرتبطة (تُسجَّل عند ✅)</Label>
              <div className="flex flex-wrap gap-1.5">
                {habits.map((h) => (
                  <Chip key={h.id} active={v.habit_id === h.id} onClick={() => setV({ ...v, habit_id: h.id })}>
                    {h.emoji} {h.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
            <Label htmlFor="r-nag" className="text-sm">إعادة الإرسال حتى التأكيد 🔁</Label>
            <Switch id="r-nag" checked={v.nag} onCheckedChange={(c) => setV({ ...v, nag: c })} />
          </div>
          <Button type="submit" className="w-full" disabled={m.isPending || !v.title.trim() || !v.days.length}>
            {m.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
