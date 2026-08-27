import { cookies } from "next/headers";
import { hmac, safeEqual } from "@/lib/security";
import { runtime } from "@/lib/runtime";

export const ADMIN_COOKIE = "gallery_admin";
const MAX_AGE = 60 * 60 * 12;

export function adminConfigured() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET } = runtime();
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && SESSION_SECRET);
}

export async function createAdminCookie(email: string) {
  const { SESSION_SECRET } = runtime();
  if (!SESSION_SECRET) throw new Error("El acceso del fotógrafo todavía no está configurado.");
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${email.toLowerCase()}|${expires}`;
  const signature = await hmac(payload, SESSION_SECRET);
  return {
    name: ADMIN_COOKIE,
    value: `${payload}|${signature}`,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "strict" as const,
      path: "/",
      maxAge: MAX_AGE,
    },
  };
}

export async function isAdmin() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  const { ADMIN_EMAIL, SESSION_SECRET } = runtime();
  if (!token || !ADMIN_EMAIL || !SESSION_SECRET) return false;

  const [email, expiresValue, signature] = token.split("|");
  const expires = Number(expiresValue);
  if (!email || !expires || !signature || expires < Math.floor(Date.now() / 1000)) return false;
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;

  const expected = await hmac(`${email}|${expiresValue}`, SESSION_SECRET);
  return safeEqual(signature, expected);
}
