import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { albums, orderItems, orders, photos } from "@/db/schema";
import { createOrderAccessToken } from "@/lib/order-access";
import { setOrderCookie } from "@/lib/order-auth";
import { requireRuntimeValue } from "@/lib/runtime";
import { sha256 } from "@/lib/security";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CART_ITEMS = 100;
const MERCADO_PAGO_TIMEOUT_MS = 12_000;

export const maxDuration = 30;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") ?? "unknown";
  let createdOrderId = "";
  let itemCount = 0;
  try {
    const payload = (await request.json()) as { photoId?: string; photoIds?: unknown; email?: string };
    const requestedIds = Array.isArray(payload.photoIds)
      ? payload.photoIds
      : payload.photoId
        ? [payload.photoId]
        : [];
    const photoIds = [...new Set(requestedIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean))];
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!photoIds.length || !EMAIL.test(email)) {
      return Response.json({ error: "Ingresá un email válido." }, { status: 400 });
    }
    if (photoIds.length > MAX_CART_ITEMS) {
      return Response.json({ error: `El carrito admite hasta ${MAX_CART_ITEMS} fotos por compra.` }, { status: 400 });
    }

    const db = getDb();
    const availableRows = await db
      .select({
        id: photos.id,
        title: photos.title,
        priceCents: photos.priceCents,
      })
      .from(photos)
      .innerJoin(albums, eq(photos.albumId, albums.id))
      .where(and(inArray(photos.id, photoIds), eq(photos.published, true), eq(albums.published, true)));
    const availableById = new Map(availableRows.map((photo) => [photo.id, photo]));
    const selectedPhotos = photoIds.flatMap((id) => {
      const photo = availableById.get(id);
      return photo ? [photo] : [];
    });
    if (selectedPhotos.length !== photoIds.length) {
      return Response.json({ error: "Una de las fotos ya no está disponible. Quitala del carrito e intentá nuevamente." }, { status: 404 });
    }

    const amountCents = selectedPhotos.reduce((total, photo) => total + photo.priceCents, 0);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return Response.json({ error: "No pudimos calcular el total del carrito." }, { status: 400 });
    }

    const accessToken = requireRuntimeValue("MERCADO_PAGO_ACCESS_TOKEN");
    const baseUrl = requireRuntimeValue("PUBLIC_BASE_URL").replace(/\/$/, "");
    const orderId = crypto.randomUUID();
    createdOrderId = orderId;
    itemCount = selectedPhotos.length;
    const orderAccess = await createOrderAccessToken(orderId);
    const claimToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const claimHash = await sha256(claimToken);

    await db.transaction(async (transaction) => {
      await transaction.insert(orders).values({
        id: orderId,
        photoId: selectedPhotos[0].id,
        email,
        amountCents,
        status: "pending",
        claimHash,
        createdAt: new Date(),
      });
      await transaction.insert(orderItems).values(selectedPhotos.map((photo, index) => ({
        orderId,
        photoId: photo.id,
        title: photo.title,
        priceCents: photo.priceCents,
        sortOrder: index,
        createdAt: new Date(),
      })));
    });

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": orderId,
      },
      body: JSON.stringify({
        items: selectedPhotos.map((photo) => ({
            id: photo.id,
            title: photo.title,
            description: "Fotografía digital original en alta calidad, sin marca de agua",
            category_id: "art",
            currency_id: "ARS",
            quantity: 1,
            unit_price: photo.priceCents / 100,
          })),
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
      signal: AbortSignal.timeout(MERCADO_PAGO_TIMEOUT_MS),
    });

    const preference = (await preferenceResponse.json().catch(() => ({}))) as {
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
    console.log(JSON.stringify({
      level: "info",
      message: "checkout_created",
      route: "/api/checkout",
      requestId,
      orderIdSuffix: orderId.slice(-8),
      itemCount,
      durationMs: Date.now() - startedAt,
    }));
    return Response.json({ checkoutUrl, itemCount: selectedPhotos.length });
  } catch (error) {
    if (createdOrderId) {
      try {
        await getDb()
          .update(orders)
          .set({ status: "creation_failed" })
          .where(and(eq(orders.id, createdOrderId), eq(orders.status, "pending")));
      } catch {
        // El error original es el que debe informarse y registrarse.
      }
    }
    const message = error instanceof Error ? error.message : "No pudimos iniciar el pago.";
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error(JSON.stringify({
      level: "error",
      message: "checkout_failed",
      route: "/api/checkout",
      requestId,
      orderIdSuffix: createdOrderId.slice(-8),
      itemCount,
      error: message,
      timedOut,
      durationMs: Date.now() - startedAt,
    }));
    return Response.json({
      error: timedOut
        ? "Mercado Pago demoró demasiado. Intentá nuevamente; no se realizó ningún cobro."
        : message,
    }, { status: 503 });
  }
}
