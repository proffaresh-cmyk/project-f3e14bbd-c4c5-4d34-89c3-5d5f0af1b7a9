import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { deriveWebhookSecret } = await import("@/lib/telegram.server");
        const expected = await deriveWebhookSecret();
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        let update: unknown;
        try {
          update = await request.json();
        } catch {
          return Response.json({ ok: true, ignored: true });
        }
        if (!update || typeof update !== "object" || typeof (update as { update_id?: unknown }).update_id !== "number") {
          return Response.json({ ok: true, ignored: true });
        }
        try {
          const { handleUpdate } = await import("@/lib/bot.server");
          await handleUpdate(update as Parameters<typeof handleUpdate>[0]);
        } catch (e) {
          // Always 200 so Telegram doesn't retry the same update forever
          console.error("telegram update failed", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
