import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { photos } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { readStoredAsset } from "@/lib/stored-assets";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("No autorizado", { status: 401 });
  try {
    const { id } = await params;
    const [photo] = await getDb()
      .select({ originalKey: photos.originalKey, contentType: photos.contentType })
      .from(photos)
      .where(eq(photos.id, id))
      .limit(1);
    if (!photo) return new Response("Foto no encontrada", { status: 404 });
    const asset = await readStoredAsset(photo.originalKey);
    if (!asset || asset.statusCode === 304 || !asset.stream) return new Response("Archivo no encontrado", { status: 404 });
    return new Response(asset.stream, { headers: {
      "content-type": photo.contentType,
      "content-length": String(asset.blob.size),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    }});
  } catch {
    return new Response("El original no está disponible", { status: 503 });
  }
}
