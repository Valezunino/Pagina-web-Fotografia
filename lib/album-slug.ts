import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { albums } from "@/db/schema";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "evento";
}

export async function uniqueAlbumSlug(title: string, currentId?: string) {
  const base = slugify(title);
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const [existing] = await getDb().select({ id: albums.id }).from(albums).where(eq(albums.slug, slug)).limit(1);
    if (!existing || existing.id === currentId) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
