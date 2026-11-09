import { reminderButtons, taskButtons } from "./bot.server";
import { categoryEmoji, priorityIcon } from "./constants";
import { activeProject, getSettings, ownerChatId, sb, type Reminder } from "./db.server";
import { eveningText, morningText } from "./reports.server";
import { inSleepHours, isNagDue, shouldFireReminder } from "./schedule-rules";
import { escapeHtml, sendMessage } from "./telegram.server";
import { hhmm, timeToMinutes, zonedNow } from "./time";

/** Runs every minute: fires due reminders, re-sends pending ones, and nags open timed tasks. */
export async function runTick() {
  const s = await getSettings();
  const chatId = ownerChatId(s);
  if (!chatId) return { skipped: "no owner chat yet (send /start to the bot)" };

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const now = zonedNow(s.timezone, nowDate);
  const sleepCfg = { sleepTime: s.sleep_time, wakeTime: s.wake_time };
  const sleeping = inSleepHours(now.minutes, s.sleep_time, s.wake_time);
  const interval = Math.max(5, s.nag_interval_min);
  const sent: string[] = [];

  const { data: reminders, error } = await sb.from("reminders").select("*").eq("active", true);
  if (error) throw error;
  const project = await activeProject();
  const projectActive = (r: Reminder) => !r.project_id || (project?.id === r.project_id && project.status === "active");

  // 1) First send of today's scheduled reminders (atomic claim prevents duplicates)
  for (const r of reminders ?? []) {
    if (!shouldFireReminder(r, now, sleepCfg)) continue;
    const { data: claimed } = await sb
      .from("reminders")
      .update({ last_sent_date: now.date, last_sent_at: nowIso, snoozed_until: null })
      .eq("id", r.id)
      .or(`last_sent_date.is.null,last_sent_date.neq.${now.date}`)
      .select("id");
    if (!claimed?.length) continue;

    try {
      if (r.kind === "morning") {
        await sendMessage(chatId, await morningText(s, now));
      } else if (r.kind === "evening") {
        await sendMessage(chatId, await eveningText(s, now));
      } else if (!projectActive(r)) {
        await sb.from("reminders").update({ ack_date: now.date }).eq("id", r.id);
        continue;
      } else {
        if (r.habit_id) {
          const { data: logged } = await sb.from("habit_logs").select("id").eq("habit_id", r.habit_id).eq("log_date", now.date).maybeSingle();
          if (logged) {
            await sb.from("reminders").update({ ack_date: now.date }).eq("id", r.id);
            continue;
          }
        }
        await sendMessage(chatId, reminderText(r, project, false), reminderButtons(r.id));
      }
      sent.push(`reminder:${r.title}`);
    } catch (e) {
      console.error("send reminder failed", r.id, e);
    }
  }

  if (sleeping) return { sleeping: true, sent };

  // 2) Nag reminders sent today that are not done/skipped yet
  for (const r of reminders ?? []) {
    if (!r.nag || ["morning", "evening"].includes(r.kind)) continue;
    if (r.last_sent_date !== now.date || r.ack_date === now.date) continue;
    if (!projectActive(r)) continue;
    if (!isNagDue(r.last_sent_at, r.snoozed_until, interval, nowDate)) continue;
    let q = sb.from("reminders").update({ last_sent_at: nowIso, snoozed_until: null }).eq("id", r.id);
    q = r.last_sent_at ? q.eq("last_sent_at", r.last_sent_at) : q.is("last_sent_at", null);
    const { data: claimed } = await q.select("id");
    if (!claimed?.length) continue;
    try {
      await sendMessage(chatId, reminderText(r, project, true), reminderButtons(r.id));
      sent.push(`nag:${r.title}`);
    } catch (e) {
      console.error("nag failed", r.id, e);
    }
  }

  // 3) Timed tasks: first alert at due time, then nag until done/snoozed
  const { data: tasks } = await sb
    .from("tasks")
    .select("*")
    .in("status", ["todo", "snoozed"])
    .eq("nag", true)
    .not("due_time", "is", null)
    .lte("due_date", now.date);
  for (const t of tasks ?? []) {
    const isToday = t.due_date === now.date;
    let due = false;
    if (!t.last_sent_at) {
      // first alert: today once the time is reached (overdue days fire right away)
      due = !isToday || timeToMinutes(t.due_time) <= now.minutes;
    } else {
      due = isNagDue(t.last_sent_at, t.status === "snoozed" ? t.snoozed_until : null, interval, nowDate);
    }
    if (!due) continue;
    let q = sb.from("tasks").update({ last_sent_at: nowIso, status: "todo", snoozed_until: null }).eq("id", t.id);
    q = t.last_sent_at ? q.eq("last_sent_at", t.last_sent_at) : q.is("last_sent_at", null);
    const { data: claimed } = await q.select("id");
    if (!claimed?.length) continue;
    try {
      const head = t.last_sent_at ? "🔁 <b>ما زالت تنتظرك</b>" : "⏰ <b>حان وقت المهمة</b>";
      await sendMessage(
        chatId,
        `${head}\n${priorityIcon(t.priority)} ${escapeHtml(t.title)}\n<i>${categoryEmoji(t.category)} ${t.category} · ${hhmm(t.due_time)}${isToday ? "" : " · متأخرة"}</i>`,
        taskButtons(t.id),
      );
      sent.push(`task:${t.title}`);
    } catch (e) {
      console.error("task alert failed", t.id, e);
    }
  }

  return { sent };
}

function reminderText(
  r: Reminder,
  project: Awaited<ReturnType<typeof activeProject>>,
  isNag: boolean,
): string {
  const head = isNag ? `🔁 <b>تذكير: ${escapeHtml(r.title)}</b>` : `⏰ <b>${escapeHtml(r.title)}</b>`;
  const lines = [head];
  if (r.message && r.message !== r.title) lines.push(escapeHtml(r.message));
  if (r.kind === "project" && project) {
    const next = project.steps.find((st) => !st.done);
    lines.push(next ? `الخطوة التالية: <b>${escapeHtml(next.title)}</b>` : "كل الخطوات منجزة — هل تم البيع؟ /book");
  }
  if (isNag) lines.push("<i>لم تؤكد بعد — اضغط ✅ عند الانتهاء</i>");
  return lines.join("\n");
}
