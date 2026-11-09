import { DAY_NAMES, categoryEmoji, motivationFor, priorityIcon } from "./constants";
import {
  activeProject,
  getSettings,
  habitsWithStreaks,
  openTasksUpTo,
  sb,
  sortTasks,
  studyHoursBetween,
  type Settings,
} from "./db.server";
import { escapeHtml } from "./telegram.server";
import { addDays, hhmm, lastNDates, zonedNow, type ZonedNow } from "./time";

function taskLine(t: { title: string; category: string; priority: string; due_time: string | null; due_date: string | null }, today: string) {
  const parts = [`${priorityIcon(t.priority)} ${escapeHtml(t.title)}`];
  const meta = [categoryEmoji(t.category)];
  if (t.due_time) meta.push(hhmm(t.due_time));
  if (t.due_date && t.due_date < today) meta.push("متأخرة");
  return `${parts.join("")} <i>${meta.join(" · ")}</i>`;
}

function fmtHours(h: number) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

export async function todayText(s?: Settings, now?: ZonedNow): Promise<string> {
  s = s ?? (await getSettings());
  now = now ?? zonedNow(s.timezone);
  const tasks = await openTasksUpTo(now.date);
  const { data: reminders } = await sb
    .from("reminders")
    .select("title, remind_time, days, kind")
    .eq("active", true)
    .order("remind_time");
  const todays = (reminders ?? []).filter((r) => r.days.includes(now!.dow) && !["morning", "evening"].includes(r.kind));
  const study = (await studyHoursBetween(now.date, now.date))[now.date] ?? 0;
  const project = await activeProject();

  const lines: string[] = [];
  lines.push(`📋 <b>مهام اليوم</b> (${tasks.length})`);
  if (tasks.length === 0) lines.push("لا توجد مهام مفتوحة — أضف مهمة بـ /add");
  else tasks.slice(0, 15).forEach((t) => lines.push(taskLine(t, now!.date)));
  if (todays.length) {
    lines.push("");
    lines.push(`⏰ <b>تذكيرات اليوم:</b> ${todays.map((r) => hhmm(r.remind_time)).join(" · ")}`);
  }
  lines.push("");
  lines.push(`📚 الدراسة: ${fmtHours(study)} / ${fmtHours(Number(s.study_goal_hours))} ساعة`);
  if (project && project.status === "active") {
    const next = project.steps.find((st) => !st.done);
    lines.push(`📖 ${escapeHtml(project.name)}: ${next ? `الخطوة التالية — ${escapeHtml(next.title)}` : "كل الخطوات منجزة، بقي البيع!"}`);
  }
  return lines.join("\n");
}

export async function morningText(s: Settings, now: ZonedNow): Promise<string> {
  const body = await todayText(s, now);
  return `☀️ <b>صباح الخير!</b> ${DAY_NAMES[now.dow]} ${now.date}\n\n${body}\n\n💬 ${motivationFor(now.date)}`;
}

export async function eveningText(s: Settings, now: ZonedNow): Promise<string> {
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const startUtc = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data: doneRecent } = await sb
    .from("tasks")
    .select("title, completed_at")
    .eq("status", "done")
    .gte("completed_at", startUtc);
  const doneToday = (doneRecent ?? []).filter(
    (t) => t.completed_at && zonedNow(s.timezone, new Date(t.completed_at)).date === today,
  );

  const open = await openTasksUpTo(today);
  const missedTasks = open.filter((t) => t.due_date && t.due_date <= today);

  const { data: rem } = await sb
    .from("reminders")
    .select("title, kind, nag, ack_date, last_sent_date")
    .eq("last_sent_date", today);
  const ackedReminders = (rem ?? []).filter((r) => r.ack_date === today && !["morning", "evening"].includes(r.kind));
  const missedReminders = (rem ?? []).filter((r) => r.nag && r.ack_date !== today && !["morning", "evening"].includes(r.kind));

  const study = (await studyHoursBetween(today, today))[today] ?? 0;
  const habits = await habitsWithStreaks(today);

  const { data: upcoming } = await sb
    .from("tasks")
    .select("*")
    .in("status", ["todo", "snoozed"])
    .or(`due_date.is.null,due_date.lte.${tomorrow}`);
  const top3 = sortTasks(upcoming ?? []).slice(0, 3);

  const L: string[] = [`🌙 <b>ملخص اليوم</b> — ${DAY_NAMES[now.dow]}`, ""];
  const doneCount = doneToday.length + ackedReminders.length;
  L.push(`✅ <b>أنجزت (${doneCount})</b>`);
  doneToday.forEach((t) => L.push(`• ${escapeHtml(t.title)}`));
  ackedReminders.forEach((r) => L.push(`• ${escapeHtml(r.title)}`));
  if (doneCount === 0) L.push("• لا شيء بعد — غداً بداية جديدة");
  L.push("");
  const missedCount = missedTasks.length + missedReminders.length;
  L.push(`❌ <b>لم تُنجز (${missedCount})</b>`);
  missedTasks.forEach((t) => L.push(`• ${escapeHtml(t.title)}`));
  missedReminders.forEach((r) => L.push(`• ${escapeHtml(r.title)}`));
  if (missedCount === 0) L.push("• ممتاز! لم يفتك شيء 🎉");
  L.push("");
  L.push(`📚 الدراسة: ${fmtHours(study)} / ${fmtHours(Number(s.study_goal_hours))} ساعة`);
  if (habits.length) {
    L.push(`🔥 العادات: ${habits.map((h) => `${h.emoji} ${escapeHtml(h.name)} ${h.doneToday ? "✓" : "✗"}`).join(" · ")}`);
  }
  L.push("");
  L.push("🎯 <b>أهم 3 لغد</b>");
  if (top3.length === 0) L.push("لا توجد مهام بعد — أضف بـ /add");
  top3.forEach((t, i) => L.push(`${i + 1}. ${priorityIcon(t.priority)} ${escapeHtml(t.title)}`));
  L.push("");
  L.push("تصبح على خير 😴");
  return L.join("\n");
}

export async function weekText(): Promise<string> {
  const s = await getSettings();
  const now = zonedNow(s.timezone);
  const days = lastNDates(now.date, 7);
  const from = days[0];
  const study = await studyHoursBetween(from, now.date);
  const total = days.reduce((a, d) => a + (study[d] ?? 0), 0);
  const goal = Number(s.study_goal_hours);

  const { data: done } = await sb
    .from("tasks")
    .select("id")
    .eq("status", "done")
    .gte("completed_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString());

  const habits = await habitsWithStreaks(now.date);
  const project = await activeProject();

  const L: string[] = [`📊 <b>تقرير الأسبوع</b>`, `${from} ← ${now.date}`, ""];
  L.push(`✅ مهام منجزة: <b>${done?.length ?? 0}</b>`);
  L.push("");
  L.push(`📚 <b>الدراسة:</b> ${fmtHours(total)} / ${fmtHours(goal * 7)} ساعة`);
  for (const d of days) {
    const h = study[d] ?? 0;
    const filled = goal > 0 ? Math.min(8, Math.round((h / goal) * 8)) : 0;
    L.push(`<code>${"█".repeat(filled)}${"░".repeat(8 - filled)}</code> ${DAY_NAMES[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${fmtHours(h)}`);
  }
  if (habits.length) {
    L.push("");
    L.push("🔥 <b>العادات</b>");
    for (const h of habits) {
      const count = h.dates.filter((d) => d >= from).length;
      const unit = h.frequency === "weekly" ? "أسبوع" : "يوم";
      L.push(`${h.emoji} ${escapeHtml(h.name)} — ${count}/${h.frequency === "weekly" ? 1 : 7} · سلسلة ${h.streak} ${unit}`);
    }
  }
  if (project) {
    const doneSteps = project.steps.filter((x) => x.done).length;
    L.push("");
    L.push(`📖 ${escapeHtml(project.name)}: ${project.status === "done" ? "تم البيع 🎉" : `${doneSteps}/${project.steps.length} خطوات`}`);
  }
  return L.join("\n");
}
