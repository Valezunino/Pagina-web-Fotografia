import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, photos } from "@/db/schema";
import { verifyOrderCookie } from "@/lib/order-auth";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("order") ?? "";
  if (!orderId) return Response.json({ error: "Compra no encontrada." }, { status: 400 });

  try {
    const [row] = await getDb()
      .select({
        id: orders.id,
        status: orders.status,
        claimHash: orders.claimHash,
        title: photos.title,
      })
      .from(orders)
      .innerJoin(photos, eq(photos.id, orders.photoId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!row || !(await verifyOrderCookie(orderId, row.claimHash))) {
      return Response.json({ error: "No pudimos verificar esta compra." }, { status: 403 });
    }

    return Response.json({
      status: row.status,
      title: row.title,
      downloadUrl: row.status === "approved" ? `/api/download?order=${encodeURIComponent(orderId)}` : null,
    });
  } catch {
    return Response.json({ error: "No pudimos consultar el pago." }, { status: 503 });
  }
}
