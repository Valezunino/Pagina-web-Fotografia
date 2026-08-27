CREATE TABLE IF NOT EXISTS "albums" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "published" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "albums_slug_unique" ON "albums" ("slug");
CREATE INDEX IF NOT EXISTS "albums_published_order_idx" ON "albums" ("published", "sort_order");
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "album_id" text REFERENCES "albums"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "photos_album_order_idx" ON "photos" ("album_id", "sort_order");
UPDATE "site_settings" SET "value" = 'Galerías por evento', "updated_at" = now() WHERE "key" = 'galleryEyebrow' AND "value" = 'Selección reciente';
UPDATE "site_settings" SET "value" = 'Eventos y colecciones', "updated_at" = now() WHERE "key" = 'galleryTitle' AND "value" = 'La colección';
