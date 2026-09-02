CREATE TABLE IF NOT EXISTS "order_items" (
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "photo_id" text NOT NULL,
  "title" text NOT NULL,
  "price_cents" integer NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "download_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_items_order_id_photo_id_pk" PRIMARY KEY ("order_id", "photo_id")
);
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id", "sort_order");
CREATE INDEX IF NOT EXISTS "order_items_photo_idx" ON "order_items" ("photo_id");
