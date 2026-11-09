import { redirect } from "@tanstack/react-router";
import { checkAuth } from "./auth.functions";

export async function requireAuth() {
  const { authed } = await checkAuth();
  if (!authed) throw redirect({ to: "/login" });
}
