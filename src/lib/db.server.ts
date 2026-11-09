import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Tables } from "@/integrations/supabase/types";
import { PRIORITY_ORDER } from "./constants";
import { streakFor } from "./streaks";
import { addDays } from "./time";

export const sb = supabaseAdmin;
export type Settings = Tables<"settings">;
export type Task = Tables<"tasks">;
export type Reminder = Tables<"reminders">;
export type Habit = Tables<"habits">;

export async function getSettings(): Promise<Settings> {
  const { data, error } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: e2 } = await sb.from("settings").insert({ id: 1 }).select("*").single();
  if (e2) throw e2;
  return created;
}

export function ownerChatId(s: Settings): number | null {
  const env = process.env["TELEGRAM_CHAT_ID"];
  if (env && /^-?\d+$/.test(env.trim())) return Number(env.trim());
  return s.owner_chat_id ?? null;
}

export function sortTasks<T extends Pick<Task, "priority" | "due_time" | "due_date">>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      (a.due_time ?? "99").localeCompare(b.due_time ?? "99"),
  );
}

/** Open tasks due today, overdue, or undated. */
export async function openTasksUpTo(date: string): Promise<Task[]> {
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .in("status", ["todo", "snoozed"])
    .or(`due_date.is.null,due_date.lte.${date}`);
  if (error) throw error;
  return sortTasks(data ?? []);
}

export async function studyHoursBetween(from: string, to: string) {
  const { data, error } = await sb
    .from("study_logs")
    .select("log_date, hours")
    .gte("log_date", from)
    .lte("log_date", to);
  if (error) throw error;
  const byDate: Record<string, number> = {};
  for (const r of data ?? []) byDate[r.log_date] = (byDate[r.log_date] ?? 0) + Number(r.hours);
  return byDate;
}

export async function habitsWithStreaks(today: string) {
  const { data: habits, error } = await sb.from("habits").select("*").eq("active", true).order("created_at");
  if (error) throw error;
  const since = addDays(today, -120);
  const { data: logs, error: e2 } = await sb
    .from("habit_logs")
    .select("habit_id, log_date")
    .gte("log_date", since);
  if (e2) throw e2;
  return (habits ?? []).map((h) => {
    const dates = (logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.log_date);
    return { ...h, dates, streak: streakFor(h.frequency, dates, today), doneToday: dates.includes(today) };
  });
}

export async function activeProject() {
  const { data: project } = await sb
    .from("projects")
    .select("*")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!project) return null;
  const { data: steps } = await sb
    .from("project_steps")
    .select("*")
    .eq("project_id", project.id)
    .order("sort");
  return { ...project, steps: steps ?? [] };
}

export async function logHabit(habitId: string, date: string) {
  const { error } = await sb
    .from("habit_logs")
    .upsert({ habit_id: habitId, log_date: date }, { onConflict: "habit_id,log_date", ignoreDuplicates: true });
  if (error) throw error;
}
