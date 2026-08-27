import { del, head } from "@vercel/blob";
import { getDb } from "@/db";
import { albums, photos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin-auth";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const payload = (await request.json().catch(() => null)) as {
    uploadId?: string; albumId?: string; title?: string; category?: string; price?: number;
    originalName?: string; contentType?: string; previewKey?: string; originalKey?: string;
  } | null;
  if (!payload || !ID.test(payload.uploadId ?? "")) return Response.json({ error: "Carga inválida." }, { status: 400 });
  const id = payload.uploadId!;
  const albumId = payload.albumId?.trim() ?? "";
  const title = payload.title?.trim() ?? "";
  const category = payload.category?.trim() || "Fotografía";
  const price = Number(payload.price);
  const contentType = payload.contentType ?? "";
  const previewKey = payload.previewKey ?? "";
  const originalKey = payload.originalKey ?? "";
  if (!albumId || !title || !Number.isFinite(price) || price <= 0 || !TYPES.has(contentType) ||
      previewKey !== `previews/${id}.jpg` || !originalKey.startsWith(`originals/${id}/`)) {
    return Response.json({ error: "Los datos de la fotografía no son válidos." }, { status: 400 });
  }
  try {
    const [album] = await getDb().select({ id: albums.id }).from(albums).where(eq(albums.id, albumId)).limit(1);
    if (!album) throw new Error("Elegí una carpeta válida.");
    const [preview, original] = await Promise.all([
      head(previewKey),
      head(originalKey),
    ]);
    if (preview.contentType !== "image/jpeg" || preview.size > 4 * 1024 * 1024 ||
        original.contentType !== contentType || original.size > 25 * 1024 * 1024) {
      throw new Error("Los archivos subidos no son válidos.");
    }
    await getDb().insert(photos).values({
      id, albumId, title, category, priceCents: Math.round(price * 100), previewKey, originalKey,
      originalName: payload.originalName?.slice(0, 240) || "fotografia-original",
      contentType, published: true, sortOrder: Math.floor(Date.now() / 1000),
    });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    await del([previewKey, originalKey]).catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "No pudimos registrar la fotografía." }, { status: 500 });
  }
}
