import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { albums, photos } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { readStoredAsset } from "@/lib/stored-assets";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [photo] = await getDb().select({
      previewKey: photos.previewKey,
      photoPublished: photos.published,
      albumPublished: albums.published,
    }).from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(eq(photos.id, id)).limit(1);
    if (!photo) return new Response("Imagen no encontrada", { status: 404 });
    if ((!photo.photoPublished || !photo.albumPublished) && !(await isAdmin())) {
      return new Response("Imagen no encontrada", { status: 404 });
    }
    const asset = await readStoredAsset(photo.previewKey);
    if (!asset || asset.statusCode === 304 || !asset.stream) return new Response("Imagen no encontrada", { status: 404 });
    return new Response(asset.stream, { headers: {
      "content-type": asset.blob.contentType,
      "content-length": String(asset.blob.size),
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    }});
  } catch {
    return new Response("Imagen no disponible", { status: 503 });
  }
}
