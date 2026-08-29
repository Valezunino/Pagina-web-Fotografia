import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { albums, photos } from "@/db/schema";
import type { PublicPhoto } from "@/lib/photo-data";

export type PublicAlbum = {
  id: string;
  slug: string;
  title: string;
  description: string;
  photoCount: number;
  coverImage: string;
};

export async function getPublishedAlbums(): Promise<PublicAlbum[]> {
  try {
    const db = getDb();
    const albumRows = await db
      .select()
      .from(albums)
      .where(eq(albums.published, true))
      .orderBy(asc(albums.sortOrder), desc(albums.createdAt));

    if (!albumRows.length) return [];
    const photoRows = await db
      .select({ id: photos.id, albumId: photos.albumId })
      .from(photos)
      .where(and(inArray(photos.albumId, albumRows.map((album) => album.id)), eq(photos.published, true)))
      .orderBy(asc(photos.sortOrder), desc(photos.createdAt));

    return albumRows.flatMap((album) => {
      const albumPhotos = photoRows.filter((photo) => photo.albumId === album.id);
      if (!albumPhotos.length) return [];
      return [{
        id: album.id,
        slug: album.slug,
        title: album.title,
        description: album.description,
        photoCount: albumPhotos.length,
        coverImage: `/api/photos/${albumPhotos[0].id}/preview?wv=8`,
      }];
    });
  } catch {
    return [];
  }
}

export async function getPublishedAlbum(slug: string): Promise<{ album: PublicAlbum; photos: PublicPhoto[] } | null> {
  try {
    const db = getDb();
    const [album] = await db.select().from(albums)
      .where(and(eq(albums.slug, slug), eq(albums.published, true)))
      .limit(1);
    if (!album) return null;

    const rows = await db
      .select({
        id: photos.id,
        title: photos.title,
        category: photos.category,
        priceCents: photos.priceCents,
      })
      .from(photos)
      .where(and(eq(photos.albumId, album.id), eq(photos.published, true)))
      .orderBy(asc(photos.sortOrder), desc(photos.createdAt));
    if (!rows.length) return null;

    return {
      album: {
        id: album.id,
        slug: album.slug,
        title: album.title,
        description: album.description,
        photoCount: rows.length,
        coverImage: `/api/photos/${rows[0].id}/preview?wv=8`,
      },
      photos: rows.map((photo) => ({ ...photo, image: `/api/photos/${photo.id}/preview?wv=8` })),
    };
  } catch {
    return null;
  }
}
