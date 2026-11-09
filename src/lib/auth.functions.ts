import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

const COOKIE = "lo_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function hmac(value: string): Promise<string> {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(`session:${exp}`));
}

export const requireDashboardAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  if (!(await isValidSession(getCookie(COOKIE)))) throw new Error("UNAUTHORIZED");
  return next();
});

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  return { authed: await isValidSession(getCookie(COOKIE)), configured: Boolean(process.env["DASHBOARD_PASSWORD"]) };
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["DASHBOARD_PASSWORD"];
    if (!expected) return { ok: false, error: "لم يتم ضبط كلمة المرور بعد" };
    // Compare HMACs so timing doesn't leak the password length
    const ok = safeEqual(await hmac(`pw:${data.password}`), await hmac(`pw:${expected}`));
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600));
      return { ok: false, error: "كلمة المرور غير صحيحة" };
    }
    const exp = String(Date.now() + MAX_AGE * 1000);
    setCookie(COOKIE, `${exp}.${await hmac(`session:${exp}`)}`, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(COOKIE, { path: "/" });
  return { ok: true };
});
