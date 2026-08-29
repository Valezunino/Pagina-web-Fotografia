import { del, head } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { photos } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as { previewKey?: string } | null;
  const previewKey = payload?.previewKey?.trim() ?? "";
  const replacementId = previewKey.split("/").at(-1)?.replace(/\.jpg$/i, "") ?? "";

  if (!ID.test(id) || !ID.test(replacementId) || previewKey !== `previews/${id}/${replacementId}.jpg`) {
    return Response.json({ error: "La vista protegida no es válida." }, { status: 400 });
  }

  try {
    const blob = await head(previewKey);
    if (blob.contentType !== "image/jpeg" || blob.size > 4 * 1024 * 1024) {
      throw new Error("La vista protegida no es válida.");
    }

    const db = getDb();
    const [photo] = await db.select({ previewKey: photos.previewKey }).from(photos).where(eq(photos.id, id)).limit(1);
    if (!photo) return Response.json({ error: "Foto no encontrada." }, { status: 404 });

    await db.update(photos).set({ previewKey }).where(eq(photos.id, id));
    if (photo.previewKey !== previewKey) await del(photo.previewKey).catch(() => undefined);
    return Response.json({ ok: true, previewKey });
  } catch (error) {
    await del(previewKey).catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "No pudimos actualizar la vista protegida." }, { status: 500 });
  }
}
