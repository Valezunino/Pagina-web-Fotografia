import { cookies } from "next/headers";
import { sha256, safeEqual } from "@/lib/security";

export const ORDER_COOKIE = "gallery_order";
const ORDER_COOKIE_PREFIX = "gallery_order_";

export async function setOrderCookie(orderId: string, claimToken: string) {
  const store = await cookies();
  store.set(ORDER_COOKIE, `${orderId}|${claimToken}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 2,
  });
  store.set(`${ORDER_COOKIE_PREFIX}${orderId}`, claimToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 2,
  });
}

export async function verifyOrderCookie(orderId: string, expectedHash: string) {
  const store = await cookies();
  const orderToken = store.get(`${ORDER_COOKIE_PREFIX}${orderId}`)?.value;
  if (orderToken) {
    const orderHash = await sha256(orderToken);
    if (safeEqual(orderHash, expectedHash)) return true;
  }

  const value = store.get(ORDER_COOKIE)?.value;
  if (!value) return false;
  const separator = value.indexOf("|");
  if (separator < 1) return false;
  const storedOrderId = value.slice(0, separator);
  const claimToken = value.slice(separator + 1);
  if (storedOrderId !== orderId || !claimToken) return false;
  const actualHash = await sha256(claimToken);
  return safeEqual(actualHash, expectedHash);
}
