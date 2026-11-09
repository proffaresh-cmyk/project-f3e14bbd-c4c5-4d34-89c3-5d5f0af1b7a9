export const CATEGORIES = [
  { name: "دراسة", emoji: "📚" },
  { name: "رياضة", emoji: "🏃" },
  { name: "مهام منزلية", emoji: "🏠" },
  { name: "بيع الكتاب", emoji: "📖" },
  { name: "شخصي", emoji: "🙂" },
] as const;

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name) as string[];

export function categoryEmoji(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.emoji ?? "📌";
}

export const PRIORITIES = [
  { value: "high", label: "عالية", icon: "🔴" },
  { value: "med", label: "متوسطة", icon: "🟡" },
  { value: "low", label: "منخفضة", icon: "🟢" },
] as const;

export type Priority = "high" | "med" | "low";

export const PRIORITY_ORDER: Record<string, number> = { high: 0, med: 1, low: 2 };

export function priorityIcon(p: string): string {
  return PRIORITIES.find((x) => x.value === p)?.icon ?? "⚪";
}

export function priorityLabel(p: string): string {
  return PRIORITIES.find((x) => x.value === p)?.label ?? p;
}

// 0 = Sunday … 6 = Saturday
export const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const DAY_SHORT = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

export const REMINDER_KINDS: Record<string, string> = {
  custom: "تذكير",
  study: "دراسة",
  habit: "عادة",
  project: "مشروع",
  morning: "رسالة الصباح",
  evening: "ملخص المساء",
};

export const MOTIVATIONS = [
  "خطوة صغيرة كل يوم تصنع فرقاً كبيراً 🌱",
  "ابدأ بالأصعب، وسيصبح باقي اليوم أسهل 💪",
  "لا تنتظر الحماس، ابدأ وسيأتي الحماس 🔥",
  "التركيز ساعة أفضل من الانشغال يوماً كاملاً 🎯",
  "أنت أقرب لهدفك مما تظن، واصل ✨",
  "الانضباط هو أن تختار ما تريده أكثر على ما تريده الآن ⏳",
  "كل مهمة تنجزها اليوم هدية لنفسك غداً 🎁",
  "قليل دائم خير من كثير منقطع 📈",
  "اجعل اليوم يوماً تفخر به 🌟",
  "النجاح مجموع جهود صغيرة تتكرر يومياً 🧱",
];

export function motivationFor(date: string): string {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MOTIVATIONS[h % MOTIVATIONS.length];
}
