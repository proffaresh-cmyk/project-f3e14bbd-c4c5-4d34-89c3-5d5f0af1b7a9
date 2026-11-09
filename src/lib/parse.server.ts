import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";
import { CATEGORY_NAMES, DAY_NAMES } from "./constants";
import type { ZonedNow } from "./time";
import { addDays } from "./time";

export type ParsedIntent = {
  intent: "task" | "reminder" | "study" | "unknown";
  title: string;
  category: string;
  priority: "high" | "med" | "low";
  date: string | null;
  time: string | null;
  days: number[];
  hours: number | null;
  reply: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["task", "reminder", "study", "unknown"] },
    title: { type: "string" },
    category: { type: "string", enum: CATEGORY_NAMES },
    priority: { type: "string", enum: ["high", "med", "low"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    time: { type: ["string", "null"], description: "HH:MM 24h" },
    days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
    hours: { type: ["number", "null"] },
    reply: { type: "string" },
  },
  required: ["intent", "title", "category", "priority", "date", "time", "days", "hours", "reply"],
} as const;

function extractText(res: unknown): string {
  const out = (res as { output?: unknown[] }).output ?? [];
  for (const item of out) {
    const it = item as { type?: string; content?: { type?: string; text?: string }[] };
    if (it.type === "message") {
      for (const c of it.content ?? []) if (c.type === "output_text" && c.text) return c.text;
    }
  }
  return "";
}

export async function parseFreeText(text: string, now: ZonedNow): Promise<ParsedIntent | null> {
  const instructions = `أنت مساعد يحوّل رسائل عربية (فصحى أو دارجة جزائرية) إلى بيانات منظمة لتطبيق تنظيم الحياة.
اليوم: ${DAY_NAMES[now.dow]} ${now.date}، الساعة الآن ${now.time} (توقيت الجزائر). غداً = ${addDays(now.date, 1)}.
القواعد:
- طلب تذكير لمرة واحدة أو مهمة (مثل "ذكرني بغسل الملابس غدا 18:00") => intent "task" مع date و time إن وُجدا. إذا ذُكر وقت بدون تاريخ: اليوم إن لم يمضِ الوقت، وإلا غداً.
- تذكير متكرر ("كل يوم"، "كل سبت"، "يوميا") => intent "reminder" مع time و days (0=الأحد … 6=السبت؛ يومياً = [0,1,2,3,4,5,6]).
- تسجيل دراسة ("درست ساعتين") => intent "study" مع hours.
- غير ذلك => intent "unknown" مع رد قصير مفيد.
- title: عنوان قصير وواضح بدون كلمة "ذكرني". category من القائمة فقط. priority: high إذا كان مستعجلاً/مهماً، وإلا med.
- days تكون [] إن لم يكن تذكيراً متكرراً. reply: جملة تأكيد قصيرة بالعربية.`;

  try {
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      reasoning: { effort: "low" },
      instructions,
      input: [{ role: "user", content: text }],
      text: { format: { type: "json_schema", name: "life_item", strict: true, schema: schema as unknown as Record<string, unknown> } },
    });
    const raw = extractText(res);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParsedIntent;
    if (parsed.time && !/^\d{1,2}:\d{2}$/.test(parsed.time)) parsed.time = null;
    if (parsed.date && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) parsed.date = null;
    return parsed;
  } catch (e) {
    if (e instanceof GatewayError) console.error("AI parse failed", e.code, e.httpStatus, e.message);
    else console.error("AI parse failed", e);
    return null;
  }
}
