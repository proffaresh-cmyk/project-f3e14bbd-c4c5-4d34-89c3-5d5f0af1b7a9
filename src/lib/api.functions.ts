import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireDashboardAuth } from "./auth.functions";
import { CATEGORY_NAMES } from "./constants";

const uuid = z.string().uuid();
const timeStr = z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function lib() {
  const db = await import("./db.server");
  const time = await import("./time");
  return { ...db, ...time };
}

// ---------- dashboard ----------
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireDashboardAuth])
  .handler(async () => {
    const { sb, getSettings, zonedNow, openTasksUpTo, habitsWithStreaks, activeProject, studyHoursBetween } = await lib();
    const s = await getSettings();
    const now = zonedNow(s.timezone);
    const open = await openTasksUpTo(now.date);
    const { data: doneRecent } = await sb
      .from("tasks")
      .select("*")
      .eq("status", "done")
      .gte("completed_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    const doneToday = (doneRecent ?? []).filter(
      (t) => t.completed_at && zonedNow(s.timezone, new Date(t.completed_at)).date === now.date,
    );
    const habits = (await habitsWithStreaks(now.date)).map(({ dates, ...h }) => ({ ...h, dates: dates.slice(-30) }));
    const { data: reminders } = await sb
      .from("reminders")
      .select("id,title,remind_time,days,kind,ack_date,last_sent_date,active")
      .eq("active", true)
      .order("remind_time");
    const study = (await studyHoursBetween(now.date, now.date))[now.date] ?? 0;
    return {
      today: now.date,
      dow: now.dow,
      time: now.time,
      goal: Number(s.study_goal_hours),
      study,
      tasks: [...open, ...doneToday],
      habits,
      project: await activeProject(),
      reminders: (reminders ?? []).filter((r) => r.days.includes(now.dow)),
    };
  });

// ---------- tasks ----------
export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireDashboardAuth])
  .handler(async () => {
    const { sb, sortTasks } = await lib();
    const { data, error } = await sb.from("tasks").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return sortTasks(data ?? []);
  });

const taskInput = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  category: z.string().refine((c) => CATEGORY_NAMES.includes(c)),
  priority: z.enum(["high", "med", "low"]),
  due_date: dateStr.nullable(),
  due_time: timeStr.nullable(),
  nag: z.boolean(),
});

export const saveTask = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: z.input<typeof taskInput>) => taskInput.parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { id, ...row } = data;
    if (id) {
      const { error } = await sb.from("tasks").update({ ...row, last_sent_at: null, snoozed_until: null }).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("tasks").insert(row);
      if (error) throw error;
    }
    return { ok: true };
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string; status: "todo" | "done" }) =>
    z.object({ id: uuid, status: z.enum(["todo", "done"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb
      .from("tasks")
      .update({
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
        snoozed_until: null,
        ...(data.status === "todo" ? { last_sent_at: null } : {}),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb.from("tasks").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- reminders ----------
export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireDashboardAuth])
  .handler(async () => {
    const { sb } = await lib();
    const [{ data, error }, { data: habits }] = await Promise.all([
      sb.from("reminders").select("*").order("remind_time"),
      sb.from("habits").select("id,name,emoji").eq("active", true),
    ]);
    if (error) throw error;
    return { reminders: data ?? [], habits: habits ?? [] };
  });

const reminderInput = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(120),
  message: z.string().max(500),
  remind_time: timeStr,
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  kind: z.enum(["custom", "study", "habit", "project", "morning", "evening"]),
  nag: z.boolean(),
  active: z.boolean(),
  habit_id: uuid.nullable(),
});

export const saveReminder = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: z.input<typeof reminderInput>) => reminderInput.parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { id, ...row } = data;
    const days = [...new Set(row.days)].sort();
    if (id) {
      const { error } = await sb.from("reminders").update({ ...row, days }).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("reminders").insert({ ...row, days });
      if (error) throw error;
    }
    return { ok: true };
  });

export const toggleReminder = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string; active: boolean }) => z.object({ id: uuid, active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb.from("reminders").update({ active: data.active }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb.from("reminders").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- habits ----------
export const listHabits = createServerFn({ method: "GET" })
  .middleware([requireDashboardAuth])
  .handler(async () => {
    const { getSettings, zonedNow, habitsWithStreaks } = await lib();
    const s = await getSettings();
    const now = zonedNow(s.timezone);
    return { today: now.date, habits: await habitsWithStreaks(now.date) };
  });

const habitInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(8),
  frequency: z.enum(["daily", "weekly"]),
});

export const saveHabit = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: z.input<typeof habitInput>) => habitInput.parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { id, ...row } = data;
    const { error } = id ? await sb.from("habits").update(row).eq("id", id) : await sb.from("habits").insert(row);
    if (error) throw error;
    return { ok: true };
  });

export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb.from("habits").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const toggleHabitLog = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { habit_id: string; date: string }) => z.object({ habit_id: uuid, date: dateStr }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { data: existing } = await sb
      .from("habit_logs")
      .select("id")
      .eq("habit_id", data.habit_id)
      .eq("log_date", data.date)
      .maybeSingle();
    if (existing) await sb.from("habit_logs").delete().eq("id", existing.id);
    else await sb.from("habit_logs").insert({ habit_id: data.habit_id, log_date: data.date });
    return { ok: true, logged: !existing };
  });

// ---------- study ----------
export const logStudy = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { hours: number; note?: string }) =>
    z.object({ hours: z.number().positive().max(24), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, getSettings, zonedNow, logHabit } = await lib();
    const s = await getSettings();
    const today = zonedNow(s.timezone).date;
    const { error } = await sb.from("study_logs").insert({ log_date: today, hours: data.hours, note: data.note || null });
    if (error) throw error;
    const { data: studyHabit } = await sb.from("habits").select("id").eq("name", "دراسة").maybeSingle();
    if (studyHabit) await logHabit(studyHabit.id, today);
    return { ok: true };
  });

export const deleteStudyLog = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb.from("study_logs").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- stats ----------
export const getStats = createServerFn({ method: "GET" })
  .middleware([requireDashboardAuth])
  .handler(async () => {
    const { sb, getSettings, zonedNow, lastNDates, studyHoursBetween, habitsWithStreaks } = await lib();
    const s = await getSettings();
    const now = zonedNow(s.timezone);
    const days = lastNDates(now.date, 7);
    const study = await studyHoursBetween(days[0], now.date);
    const { data: done } = await sb
      .from("tasks")
      .select("completed_at")
      .eq("status", "done")
      .gte("completed_at", new Date(Date.now() - 8 * 24 * 3600_000).toISOString());
    const doneBy: Record<string, number> = {};
    for (const t of done ?? []) {
      if (!t.completed_at) continue;
      const d = zonedNow(s.timezone, new Date(t.completed_at)).date;
      doneBy[d] = (doneBy[d] ?? 0) + 1;
    }
    const { data: logs } = await sb
      .from("study_logs")
      .select("*")
      .gte("log_date", days[0])
      .order("created_at", { ascending: false });
    const habits = await habitsWithStreaks(now.date);
    return {
      today: now.date,
      goal: Number(s.study_goal_hours),
      days: days.map((d) => ({ date: d, study: Math.round((study[d] ?? 0) * 100) / 100, done: doneBy[d] ?? 0 })),
      logs: logs ?? [],
      habits: habits.map((h) => ({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        frequency: h.frequency,
        streak: h.streak,
        week: h.dates.filter((d) => d >= days[0]).length,
      })),
    };
  });

// ---------- project ----------
export const toggleStep = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string; done: boolean }) => z.object({ id: uuid, done: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb
      .from("project_steps")
      .update({ done: data.done, done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const addStep = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { project_id: string; title: string }) =>
    z.object({ project_id: uuid, title: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { data: last } = await sb
      .from("project_steps")
      .select("sort")
      .eq("project_id", data.project_id)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await sb
      .from("project_steps")
      .insert({ project_id: data.project_id, title: data.title, sort: (last?.sort ?? 0) + 1 });
    if (error) throw error;
    return { ok: true };
  });

export const deleteStep = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb.from("project_steps").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: { id: string; status: "active" | "done" }) =>
    z.object({ id: uuid, status: z.enum(["active", "done"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb } = await lib();
    const { error } = await sb.from("projects").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- settings & bot ----------
export const getSettingsData = createServerFn({ method: "GET" })
  .middleware([requireDashboardAuth])
  .handler(async () => {
    const { getSettings, ownerChatId } = await lib();
    const s = await getSettings();
    let webhook: { url: string; pending: number; lastError: string | null } | null = null;
    const telegramConnected = Boolean(process.env["TELEGRAM_API_KEY"]);
    if (telegramConnected) {
      try {
        const { tg } = await import("./telegram.server");
        const info = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo", {});
        webhook = { url: info.url, pending: info.pending_update_count, lastError: info.last_error_message ?? null };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      timezone: s.timezone,
      nag_interval_min: s.nag_interval_min,
      wake_time: s.wake_time.slice(0, 5),
      sleep_time: s.sleep_time.slice(0, 5),
      study_goal_hours: Number(s.study_goal_hours),
      ownerLinked: ownerChatId(s) !== null,
      telegramConnected,
      webhook,
    };
  });

const settingsInput = z.object({
  timezone: z.string().min(1).max(64),
  nag_interval_min: z.number().int().min(5).max(240),
  wake_time: timeStr,
  sleep_time: timeStr,
  study_goal_hours: z.number().min(0).max(16),
});

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .inputValidator((d: z.input<typeof settingsInput>) => settingsInput.parse(d))
  .handler(async ({ data }) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: data.timezone });
    } catch {
      throw new Error("منطقة زمنية غير صالحة");
    }
    const { sb } = await lib();
    const { error } = await sb.from("settings").update({ ...data, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireDashboardAuth])
  .handler(async () => {
    const { getSettings, ownerChatId } = await lib();
    const s = await getSettings();
    const chat = ownerChatId(s);
    if (!chat) return { ok: false, error: "أرسل /start للبوت أولاً لربط حسابك" };
    const { sendMessage } = await import("./telegram.server");
    const { todayText } = await import("./reports.server");
    await sendMessage(chat, `👋 رسالة تجريبية من لوحة التحكم\n\n${await todayText(s)}`);
    return { ok: true };
  });
