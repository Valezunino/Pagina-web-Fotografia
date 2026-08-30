import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { albums, orders, photos } from "@/db/schema";
import { createOrderAccessToken } from "@/lib/order-access";
import { setOrderCookie } from "@/lib/order-auth";
import { requireRuntimeValue } from "@/lib/runtime";
import { sha256 } from "@/lib/security";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { photoId?: string; email?: string };
    const photoId = payload.photoId?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!photoId || !EMAIL.test(email)) {
      return Response.json({ error: "Ingresá un email válido." }, { status: 400 });
    }

    const db = getDb();
    const [photo] = await db
      .select({
        id: photos.id,
        title: photos.title,
        priceCents: photos.priceCents,
        published: photos.published,
      })
      .from(photos)
      .innerJoin(albums, eq(photos.albumId, albums.id))
      .where(and(eq(photos.id, photoId), eq(albums.published, true)))
      .limit(1);
    if (!photo?.published) return Response.json({ error: "La foto ya no está disponible." }, { status: 404 });

    const accessToken = requireRuntimeValue("MERCADO_PAGO_ACCESS_TOKEN");
    const baseUrl = requireRuntimeValue("PUBLIC_BASE_URL").replace(/\/$/, "");
    const orderId = crypto.randomUUID();
    const orderAccess = await createOrderAccessToken(orderId);
    const claimToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const claimHash = await sha256(claimToken);

    await db.insert(orders).values({
      id: orderId,
      photoId: photo.id,
      email,
      amountCents: photo.priceCents,
      status: "pending",
      claimHash,
      createdAt: new Date(),
    });

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": orderId,
      },
      body: JSON.stringify({
        items: [
          {
            id: photo.id,
            title: photo.title,
            description: "Fotografía digital en alta calidad, sin marca de agua",
            category_id: "art",
            currency_id: "ARS",
            quantity: 1,
            unit_price: photo.priceCents / 100,
          },
        ],
        payer: { email },
        external_reference: orderId,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${baseUrl}/compra?estado=aprobado&order=${orderId}&access=${orderAccess}`,
          pending: `${baseUrl}/compra?estado=pendiente&order=${orderId}&access=${orderAccess}`,
          failure: `${baseUrl}/compra?estado=error&order=${orderId}&access=${orderAccess}`,
        },
        auto_return: "approved",
      }),
    });

    const preference = (await preferenceResponse.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      message?: string;
    };
    const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;
    if (!preferenceResponse.ok || !preference.id || !checkoutUrl) {
      await db.update(orders).set({ status: "creation_failed" }).where(eq(orders.id, orderId));
      throw new Error(preference.message ?? "Mercado Pago no pudo preparar el cobro.");
    }

    await db.update(orders).set({ preferenceId: preference.id }).where(eq(orders.id, orderId));
    await setOrderCookie(orderId, claimToken);
    return Response.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos iniciar el pago.";
    return Response.json({ error: message }, { status: 500 });
  }
}
