import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const albums = pgTable("albums", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("albums_slug_unique").on(table.slug),
  index("albums_published_order_idx").on(table.published, table.sortOrder),
]);

export const photos = pgTable("photos", {
  id: text("id").primaryKey(),
  albumId: text("album_id").references(() => albums.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("Fotografía"),
  priceCents: integer("price_cents").notNull(),
  previewKey: text("preview_key").notNull(),
  originalKey: text("original_key").notNull(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("photos_published_created_idx").on(table.published, table.createdAt),
  index("photos_album_order_idx").on(table.albumId, table.sortOrder),
]);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminCredentials = pgTable("admin_credentials", {
  email: text("email").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  photoId: text("photo_id").notNull().references(() => photos.id),
  email: text("email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"),
  preferenceId: text("preference_id"),
  paymentId: text("payment_id"),
  claimHash: text("claim_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  downloadCount: integer("download_count").notNull().default(0),
}, (table) => [
  index("orders_photo_idx").on(table.photoId),
  index("orders_payment_idx").on(table.paymentId),
  index("orders_email_created_idx").on(table.email, table.createdAt),
]);
