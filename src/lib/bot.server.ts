import { CATEGORIES, DAY_NAMES, PRIORITIES, categoryEmoji, priorityIcon, priorityLabel } from "./constants";
import { activeProject, getSettings, habitsWithStreaks, logHabit, openTasksUpTo, ownerChatId, sb, studyHoursBetween, type Settings } from "./db.server";
import { parseFreeText } from "./parse.server";
import { todayText, weekText } from "./reports.server";
import { BOT_COMMANDS, answerCallback, closeMessage, escapeHtml, sendMessage, tg, type InlineKeyboard } from "./telegram.server";
import { addDays, hhmm, zonedNow } from "./time";

type TgMessage = { message_id: number; chat: { id: number }; text?: string; from?: { first_name?: string } };
type TgCallback = { id: string; data?: string; message?: TgMessage };
export type TgUpdate = { update_id: number; message?: TgMessage; edited_message?: TgMessage; callback_query?: TgCallback };

type AddDraft = { title?: string; category?: string; priority?: string; due_date?: string | null };
type BotState = { flow?: "add"; step?: "title" | "category" | "priority" | "due" | "time"; draft?: AddDraft };

const HELP = `أوامر البوت:
/today — مهام اليوم
/add — إضافة مهمة خطوة بخطوة
/done — تأكيد إنجاز مهمة
/snooze — تأجيل مهمة ساعة
/habits — العادات والسلاسل
/study 1.5 — تسجيل ساعات الدراسة
/week — تقرير الأسبوع
/reminders — عرض/حذف التذكيرات
/reminders add 18:00 نص — تذكير يومي
/book — مشروع بيع الكتاب

أو اكتب بحرية: «ذكرني بغسل الملابس غدا 18:00» أو «ذكرني كل سبت 10:00 بالتنظيف» أو «درست ساعتين».`;

const reminderButtons = (id: string): InlineKeyboard => [[
  { text: "✅ تم", callback_data: `r:d:${id}` },
  { text: "⏰ ساعة", callback_data: `r:s:${id}` },
  { text: "❌ تخطي اليوم", callback_data: `r:k:${id}` },
]];
const taskButtons = (id: string): InlineKeyboard => [[
  { text: "✅ تم", callback_data: `t:d:${id}` },
  { text: "⏰ ساعة", callback_data: `t:s:${id}` },
  { text: "❌ تخطي اليوم", callback_data: `t:k:${id}` },
]];
export { reminderButtons, taskButtons };

async function setState(state: BotState) {
  await sb.from("settings").update({ bot_state: state as never, updated_at: new Date().toISOString() }).eq("id", 1);
}

export async function handleUpdate(update: TgUpdate) {
  const s = await getSettings();
  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat.id ?? update.callback_query?.message?.chat.id;
  if (!chatId) return;

  let owner = ownerChatId(s);
  if (!owner) {
    if (msg?.text?.startsWith("/start")) {
      await sb.from("settings").update({ owner_chat_id: chatId }).eq("id", 1);
      owner = chatId;
    } else {
      await sendMessage(chatId, "أرسل /start لربط هذا البوت بحسابك.");
      return;
    }
  }
  if (chatId !== owner) {
    await sendMessage(chatId, "🔒 هذا بوت شخصي خاص.");
    return;
  }

  if (update.callback_query) return handleCallback(update.callback_query, s, chatId);
  if (msg?.text) return handleText(msg, s, chatId);
}

async function handleText(msg: TgMessage, s: Settings, chatId: number) {
  const text = msg.text!.trim();
  const now = zonedNow(s.timezone);
  const state = (s.bot_state ?? {}) as BotState;
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.startsWith("/") ? cmdRaw.split("@")[0].toLowerCase() : "";
  const args = rest.join(" ").trim();

  if (cmd === "/cancel") {
    await setState({});
    return sendMessage(chatId, "تم الإلغاء ✋");
  }

  // Guided /add flow consumes plain text
  if (!cmd && state.flow === "add") return continueAdd(state, text, chatId, now.date);

  switch (cmd) {
    case "/start": {
      try {
        await tg("setMyCommands", { commands: BOT_COMMANDS });
      } catch (e) {
        console.error(e);
      }
      return sendMessage(chatId, `أهلاً ${escapeHtml(msg.from?.first_name ?? "")} 👋\nأنا منظّم حياتك. سأذكّرك بمهامك وأتابعك حتى تنجزها.\n\n${HELP}`);
    }
    case "/help":
      return sendMessage(chatId, HELP);
    case "/today":
      return sendMessage(chatId, `${DAY_NAMES[now.dow]} ${now.date}\n\n${await todayText(s, now)}`);
    case "/add":
      if (args) return createFromFreeText(args, chatId, s);
      await setState({ flow: "add", step: "title", draft: {} });
      return sendMessage(chatId, "📝 ما عنوان المهمة؟\n(أرسل /cancel للإلغاء)");
    case "/done":
    case "/snooze":
      return listForAction(chatId, now.date, cmd === "/done" ? "d" : "s");
    case "/habits":
      return showHabits(chatId, now.date);
    case "/study":
      return studyCommand(chatId, args, s, now.date);
    case "/week":
      return sendMessage(chatId, await weekText());
    case "/reminders":
      return remindersCommand(chatId, args);
    case "/book":
      return showProject(chatId);
    default:
      if (cmd) return sendMessage(chatId, `أمر غير معروف.\n\n${HELP}`);
  }

  if (text === "اليوم") return sendMessage(chatId, await todayText(s, now));
  return createFromFreeText(text, chatId, s);
}

async function createFromFreeText(text: string, chatId: number, s: Settings) {
  const now = zonedNow(s.timezone);
  const p = await parseFreeText(text, now);
  if (!p) return sendMessage(chatId, "لم أفهم الرسالة 🤔 جرّب مثلاً: «ذكرني بغسل الملابس غدا 18:00» أو استعمل /add");

  if (p.intent === "task") {
    const { data, error } = await sb
      .from("tasks")
      .insert({
        title: p.title,
        category: p.category,
        priority: p.priority,
        due_date: p.date ?? (p.time ? now.date : null),
        due_time: p.time,
      })
      .select("*")
      .single();
    if (error) throw error;
    const when = [data.due_date === now.date ? "اليوم" : data.due_date === addDays(now.date, 1) ? "غداً" : data.due_date, hhmm(data.due_time)]
      .filter(Boolean)
      .join(" ");
    return sendMessage(
      chatId,
      `✅ أضفت المهمة: <b>${escapeHtml(data.title)}</b>\n${categoryEmoji(data.category)} ${data.category} · ${priorityIcon(data.priority)} ${priorityLabel(data.priority)}${when ? `\n📅 ${when}` : ""}${data.due_time ? "\nسأذكّرك في وقتها وأتابعك حتى تنجزها 🔁" : ""}`,
    );
  }
  if (p.intent === "reminder") {
    if (!p.time) return sendMessage(chatId, "في أي ساعة أذكّرك؟ أعد الرسالة مع الوقت مثل 18:00");
    const days = p.days.length ? p.days : [0, 1, 2, 3, 4, 5, 6];
    const { error } = await sb.from("reminders").insert({ title: p.title, message: p.title, remind_time: p.time, days });
    if (error) throw error;
    const dayText = days.length === 7 ? "كل يوم" : days.map((d) => DAY_NAMES[d]).join("، ");
    return sendMessage(chatId, `⏰ أضفت تذكيراً: <b>${escapeHtml(p.title)}</b>\n${dayText} الساعة ${p.time}`);
  }
  if (p.intent === "study" && p.hours && p.hours > 0) {
    return logStudy(chatId, p.hours, s, now.date, p.title);
  }
  return sendMessage(chatId, p.reply || "لم أفهم تماماً 🤔 استعمل /add لإضافة مهمة.");
}

// ---------- guided /add ----------
async function continueAdd(state: BotState, text: string, chatId: number, today: string) {
  const draft = state.draft ?? {};
  if (state.step === "title") {
    draft.title = text.slice(0, 200);
    await setState({ flow: "add", step: "category", draft });
    return sendMessage(chatId, "📂 اختر التصنيف:", [
      CATEGORIES.slice(0, 3).map((c, i) => ({ text: `${c.emoji} ${c.name}`, callback_data: `a:c:${i}` })),
      CATEGORIES.slice(3).map((c, i) => ({ text: `${c.emoji} ${c.name}`, callback_data: `a:c:${i + 3}` })),
    ]);
  }
  if (state.step === "due") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return sendMessage(chatId, "اكتب التاريخ بصيغة 2026-11-15 أو اختر من الأزرار.");
    draft.due_date = text;
    return askTime(draft, chatId);
  }
  if (state.step === "time") {
    if (!/^\d{1,2}:\d{2}$/.test(text)) return sendMessage(chatId, "اكتب الوقت بصيغة 18:00 أو اضغط «بدون وقت».");
    return finishAdd(draft, text, chatId, today);
  }
  return sendMessage(chatId, "اختر من الأزرار أعلاه أو أرسل /cancel");
}

async function askTime(draft: AddDraft, chatId: number) {
  await setState({ flow: "add", step: "time", draft });
  return sendMessage(chatId, "🕐 في أي ساعة أذكّرك؟ اكتب الوقت مثل 18:00", [[{ text: "بدون وقت", callback_data: "a:t:none" }]]);
}

async function finishAdd(draft: AddDraft, time: string | null, chatId: number, today: string) {
  const { data, error } = await sb
    .from("tasks")
    .insert({
      title: draft.title ?? "مهمة",
      category: draft.category ?? "شخصي",
      priority: draft.priority ?? "med",
      due_date: draft.due_date ?? (time ? today : null),
      due_time: time,
    })
    .select("*")
    .single();
  await setState({});
  if (error) throw error;
  return sendMessage(
    chatId,
    `✅ تمت الإضافة: <b>${escapeHtml(data.title)}</b>\n${categoryEmoji(data.category)} ${data.category} · ${priorityIcon(data.priority)} ${priorityLabel(data.priority)}${data.due_date ? `\n📅 ${data.due_date} ${hhmm(data.due_time)}` : ""}`,
  );
}

// ---------- lists ----------
async function listForAction(chatId: number, today: string, action: "d" | "s") {
  const tasks = (await openTasksUpTo(today)).slice(0, 12);
  const { data: rems } = await sb.from("reminders").select("id,title,ack_date,last_sent_date,kind,nag").eq("last_sent_date", today);
  const pending = (rems ?? []).filter((r) => r.nag && r.ack_date !== today && !["morning", "evening"].includes(r.kind));
  if (!tasks.length && !pending.length) return sendMessage(chatId, "لا يوجد شيء معلّق 🎉");
  const icon = action === "d" ? "✅" : "⏰";
  const kb: InlineKeyboard = [
    ...pending.map((r) => [{ text: `${icon} ${r.title}`, callback_data: `r:${action}:${r.id}` }]),
    ...tasks.map((t) => [{ text: `${icon} ${priorityIcon(t.priority)} ${t.title}`.slice(0, 60), callback_data: `t:${action}:${t.id}` }]),
  ];
  return sendMessage(chatId, action === "d" ? "اختر ما أنجزته:" : "اختر ما تريد تأجيله ساعة:", kb);
}

async function showHabits(chatId: number, today: string) {
  const habits = await habitsWithStreaks(today);
  if (!habits.length) return sendMessage(chatId, "لا توجد عادات بعد. أضفها من لوحة التحكم.");
  const lines = habits.map(
    (h) => `${h.emoji} <b>${escapeHtml(h.name)}</b> — 🔥 ${h.streak} ${h.frequency === "weekly" ? "أسبوع" : "يوم"} ${h.doneToday ? "✓ اليوم" : ""}`,
  );
  const kb: InlineKeyboard = habits
    .filter((h) => !h.doneToday)
    .map((h) => [{ text: `✅ سجّل ${h.emoji} ${h.name}`, callback_data: `h:l:${h.id}` }]);
  return sendMessage(chatId, `🔥 <b>العادات</b>\n\n${lines.join("\n")}`, kb.length ? kb : undefined);
}

async function studyCommand(chatId: number, args: string, s: Settings, today: string) {
  const m = args.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (m) {
    const hours = Number(m[1].replace(",", "."));
    if (hours > 0 && hours <= 24) return logStudy(chatId, hours, s, today, m[2] || null);
  }
  const h = (await studyHoursBetween(today, today))[today] ?? 0;
  const goal = Number(s.study_goal_hours);
  return sendMessage(chatId, `📚 درست اليوم ${h} / ${goal} ساعة.\nسجّل حصة: /study 1.5 أو اختر:`, [[
    { text: "30 د", callback_data: "s:h:0.5" },
    { text: "1 س", callback_data: "s:h:1" },
    { text: "1.5 س", callback_data: "s:h:1.5" },
    { text: "2 س", callback_data: "s:h:2" },
  ]]);
}

async function logStudy(chatId: number, hours: number, s: Settings, today: string, note: string | null) {
  const { error } = await sb.from("study_logs").insert({ log_date: today, hours, note });
  if (error) throw error;
  const total = (await studyHoursBetween(today, today))[today] ?? 0;
  const goal = Number(s.study_goal_hours);
  const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  const { data: studyHabit } = await sb.from("habits").select("id").eq("name", "دراسة").maybeSingle();
  if (studyHabit) await logHabit(studyHabit.id, today);
  return sendMessage(chatId, `📚 سجّلت ${hours} ساعة. المجموع اليوم: <b>${total}</b> / ${goal} (${pct}%)${total >= goal ? "\n🎉 حققت هدف اليوم!" : ""}`);
}

async function remindersCommand(chatId: number, args: string) {
  const add = args.match(/^add\s+(\d{1,2}:\d{2})\s+(.+)$/i) ?? args.match(/^اضف\s+(\d{1,2}:\d{2})\s+(.+)$/);
  if (add) {
    const { error } = await sb.from("reminders").insert({ title: add[2].slice(0, 120), message: add[2], remind_time: add[1] });
    if (error) throw error;
    return sendMessage(chatId, `⏰ أضفت تذكيراً يومياً الساعة ${add[1]}: ${escapeHtml(add[2])}`);
  }
  const { data } = await sb.from("reminders").select("*").order("remind_time");
  const list = data ?? [];
  if (!list.length) return sendMessage(chatId, "لا توجد تذكيرات.");
  const lines = list.map((r) => {
    const days = r.days.length === 7 ? "يومياً" : r.days.map((d) => DAY_NAMES[d]).join("، ");
    return `${r.active ? "🟢" : "⚪"} <b>${hhmm(r.remind_time)}</b> ${escapeHtml(r.title)} — <i>${days}</i>`;
  });
  const kb: InlineKeyboard = list.map((r) => [{ text: `🗑 حذف ${hhmm(r.remind_time)} ${r.title}`.slice(0, 60), callback_data: `rm:x:${r.id}` }]);
  return sendMessage(chatId, `⏰ <b>التذكيرات</b>\n\n${lines.join("\n")}\n\nلإضافة تذكير يومي: /reminders add 18:00 نص التذكير`, kb);
}

async function showProject(chatId: number) {
  const p = await activeProject();
  if (!p) return sendMessage(chatId, "لا يوجد مشروع.");
  if (p.status === "done") return sendMessage(chatId, `📖 ${escapeHtml(p.name)}: تم البيع 🎉`);
  const lines = p.steps.map((st) => `${st.done ? "✅" : "⬜"} ${escapeHtml(st.title)}`);
  const kb: InlineKeyboard = [
    ...p.steps.map((st) => [{ text: `${st.done ? "↩️" : "✅"} ${st.title}`.slice(0, 60), callback_data: `p:t:${st.id}` }]),
    [{ text: "🎉 تم البيع!", callback_data: `p:sold:${p.id}` }],
  ];
  return sendMessage(chatId, `📖 <b>${escapeHtml(p.name)}</b>\n\n${lines.join("\n")}`, kb);
}

// ---------- callbacks ----------
async function handleCallback(cq: TgCallback, s: Settings, chatId: number) {
  const data = cq.data ?? "";
  const [ns, action, id] = data.split(":");
  const now = zonedNow(s.timezone);
  const msgId = cq.message?.message_id;
  const original = cq.message?.text ?? "";
  // Picker lists (/done, /snooze) keep their buttons; reminder messages get closed.
  const isList = original.startsWith("اختر");
  const close = async (status: string) => {
    if (isList) await sendMessage(chatId, escapeHtml(status));
    else if (msgId) await closeMessage(chatId, msgId, original, status);
  };

  if (ns === "r") {
    const { data: r } = await sb.from("reminders").select("*").eq("id", id).maybeSingle();
    if (!r) return answerCallback(cq.id, "غير موجود");
    if (action === "d") {
      await sb.from("reminders").update({ ack_date: now.date, snoozed_until: null }).eq("id", id);
      if (r.habit_id) await logHabit(r.habit_id, now.date);
      await answerCallback(cq.id, "أحسنت! ✅");
      await close(`✅ تم: ${r.title}`);
      if (r.kind === "study") await studyCommand(chatId, "", s, now.date);
      return;
    }
    if (action === "s") {
      const until = new Date(Date.now() + 3600_000).toISOString();
      await sb.from("reminders").update({ snoozed_until: until, last_sent_date: now.date }).eq("id", id);
      await answerCallback(cq.id, "سأذكّرك بعد ساعة ⏰");
      return close(`⏰ مؤجل ساعة: ${r.title}`);
    }
    if (action === "k") {
      await sb.from("reminders").update({ ack_date: now.date, snoozed_until: null, last_sent_date: now.date }).eq("id", id);
      await answerCallback(cq.id, "تم التخطي لليوم");
      return close("❌ تم التخطي اليوم");
    }
  }

  if (ns === "t") {
    const { data: t } = await sb.from("tasks").select("*").eq("id", id).maybeSingle();
    if (!t) return answerCallback(cq.id, "غير موجودة");
    if (action === "d") {
      await sb.from("tasks").update({ status: "done", completed_at: new Date().toISOString(), snoozed_until: null }).eq("id", id);
      await answerCallback(cq.id, "أحسنت! ✅");
      return close(`✅ تم: ${t.title}`);
    }
    if (action === "s") {
      const until = new Date(Date.now() + 3600_000).toISOString();
      await sb.from("tasks").update({ status: "snoozed", snoozed_until: until, last_sent_at: t.last_sent_at ?? new Date().toISOString() }).eq("id", id);
      await answerCallback(cq.id, "سأذكّرك بعد ساعة ⏰");
      return close(`⏰ مؤجلة ساعة: ${t.title}`);
    }
    if (action === "k") {
      const base = t.due_date && t.due_date > now.date ? t.due_date : now.date;
      await sb.from("tasks").update({ status: "todo", due_date: addDays(base, 1), last_sent_at: null, snoozed_until: null }).eq("id", id);
      await answerCallback(cq.id, "نُقلت إلى الغد");
      return close(`❌ نُقلت إلى الغد: ${t.title}`);
    }
  }

  if (ns === "h" && action === "l") {
    await logHabit(id, now.date);
    await answerCallback(cq.id, "سُجّلت ✅");
    return showHabits(chatId, now.date);
  }

  if (ns === "s" && action === "h") {
    await answerCallback(cq.id);
    return logStudy(chatId, Number(id), s, now.date, null);
  }

  if (ns === "p") {
    if (action === "t") {
      const { data: st } = await sb.from("project_steps").select("*").eq("id", id).maybeSingle();
      if (st) await sb.from("project_steps").update({ done: !st.done, done_at: st.done ? null : new Date().toISOString() }).eq("id", id);
      await answerCallback(cq.id, "تم التحديث");
      return showProject(chatId);
    }
    if (action === "sold") {
      await sb.from("projects").update({ status: "done" }).eq("id", id);
      await answerCallback(cq.id, "مبروك! 🎉");
      return close("🎉 تم البيع! أوقفت التذكير اليومي.");
    }
  }

  if (ns === "rm" && action === "x") {
    await sb.from("reminders").delete().eq("id", id);
    await answerCallback(cq.id, "حُذف");
    return remindersCommand(chatId, "");
  }

  if (ns === "a") {
    const state = (s.bot_state ?? {}) as BotState;
    if (state.flow !== "add") return answerCallback(cq.id, "انتهت العملية، ابدأ بـ /add");
    const draft = state.draft ?? {};
    await answerCallback(cq.id);
    if (action === "c") {
      draft.category = CATEGORIES[Number(id)]?.name ?? "شخصي";
      await setState({ flow: "add", step: "priority", draft });
      return sendMessage(chatId, "⚡ الأولوية؟", [PRIORITIES.map((p) => ({ text: `${p.icon} ${p.label}`, callback_data: `a:p:${p.value}` }))]);
    }
    if (action === "p") {
      draft.priority = ["high", "med", "low"].includes(id) ? id : "med";
      await setState({ flow: "add", step: "due", draft });
      return sendMessage(chatId, "📅 متى؟ اختر أو اكتب تاريخاً (2026-11-15)", [[
        { text: "اليوم", callback_data: "a:d:today" },
        { text: "غداً", callback_data: "a:d:tomorrow" },
        { text: "بدون تاريخ", callback_data: "a:d:none" },
      ]]);
    }
    if (action === "d") {
      if (id === "none") {
        draft.due_date = null;
        return finishAdd(draft, null, chatId, now.date);
      }
      draft.due_date = id === "tomorrow" ? addDays(now.date, 1) : now.date;
      return askTime(draft, chatId);
    }
    if (action === "t") return finishAdd(draft, null, chatId, now.date);
  }

  return answerCallback(cq.id);
}
