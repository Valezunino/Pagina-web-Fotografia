CREATE TABLE IF NOT EXISTS "photos" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "category" text DEFAULT 'Fotografía' NOT NULL,
  "price_cents" integer NOT NULL,
  "preview_key" text NOT NULL,
  "original_key" text NOT NULL,
  "original_name" text NOT NULL,
  "content_type" text NOT NULL,
  "published" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "admin_credentials" (
  "email" text PRIMARY KEY NOT NULL,
  "password_hash" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "photo_id" text NOT NULL REFERENCES "photos"("id"),
  "email" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "preference_id" text,
  "payment_id" text,
  "claim_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  "download_count" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "photos_published_created_idx" ON "photos" ("published", "created_at");
CREATE INDEX IF NOT EXISTS "orders_photo_idx" ON "orders" ("photo_id");
CREATE INDEX IF NOT EXISTS "orders_payment_idx" ON "orders" ("payment_id");
CREATE INDEX IF NOT EXISTS "orders_email_created_idx" ON "orders" ("email", "created_at");
