// Telegram Bot API through the Lovable connector gateway (the gateway injects the bot token).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export type InlineKeyboard = { text: string; callback_data: string }[][];

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const telegramKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!telegramKey) throw new Error("TELEGRAM_API_KEY is not configured (connect Telegram)");

  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Telegram ${method} failed [${res.status}]: ${text}`);
    throw new Error(`Telegram ${method} failed [${res.status}]: ${text}`);
  }
  const json = JSON.parse(text) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method} error: ${json.description ?? text}`);
  return json.result;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard) {
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export async function answerCallback(id: string, text?: string) {
  try {
    await tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
  } catch (e) {
    console.error(e);
  }
}

/** Append a status line to a message and drop its buttons. */
export async function closeMessage(chatId: number, messageId: number, originalText: string, status: string) {
  try {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: `${originalText}\n\n${status}`,
    });
  } catch (e) {
    console.error(e);
  }
}

/** Secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token, derived from the connection key. */
export async function deriveWebhookSecret(): Promise<string> {
  const key = process.env["TELEGRAM_API_KEY"];
  if (!key) throw new Error("TELEGRAM_API_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const BOT_COMMANDS = [
  { command: "today", description: "مهام اليوم" },
  { command: "add", description: "إضافة مهمة" },
  { command: "done", description: "تأكيد إنجاز مهمة" },
  { command: "snooze", description: "تأجيل مهمة ساعة" },
  { command: "habits", description: "العادات والسلاسل" },
  { command: "study", description: "تسجيل ساعات الدراسة" },
  { command: "week", description: "تقرير الأسبوع" },
  { command: "reminders", description: "التذكيرات" },
  { command: "book", description: "مشروع بيع الكتاب" },
  { command: "cancel", description: "إلغاء العملية الحالية" },
];
