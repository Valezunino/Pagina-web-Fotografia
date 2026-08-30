import { requireRuntimeValue } from "@/lib/runtime";
import { hmac, safeEqual } from "@/lib/security";

const ORDER_ACCESS_PURPOSE = "gallery-order-access-v1";

export async function createOrderAccessToken(orderId: string) {
  const secret = requireRuntimeValue("SESSION_SECRET");
  return hmac(`${ORDER_ACCESS_PURPOSE}:${orderId}`, secret);
}

export async function verifyOrderAccessToken(orderId: string, accessToken?: string) {
  if (!accessToken || !/^[a-f0-9]{64}$/i.test(accessToken)) return false;
  const expected = await createOrderAccessToken(orderId);
  return safeEqual(expected, accessToken.toLowerCase());
}
