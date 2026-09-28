import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customerAccounts } from "@/db/schema";
import { hmac, safeEqual } from "@/lib/security";
import { requireRuntimeValue } from "@/lib/runtime";

export const CUSTOMER_COOKIE = "gallery_customer";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 210_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const encoder = new TextEncoder();
let customerTableReady: Promise<void> | undefined;

export function ensureCustomerAccountsTable() {
  customerTableReady ??= (async () => {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id text PRIMARY KEY NOT NULL,
        email text NOT NULL,
        password_hash text,
        clerk_user_id text,
        first_name text,
        last_name text,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`ALTER TABLE customer_accounts ALTER COLUMN password_hash DROP NOT NULL`);
    await db.execute(sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS clerk_user_id text`);
    await db.execute(sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS first_name text`);
    await db.execute(sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS last_name text`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_email_unique ON customer_accounts (email)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_clerk_user_unique ON customer_accounts (clerk_user_id) WHERE clerk_user_id IS NOT NULL`);
  })().catch((error) => {
    customerTableReady = undefined;
    throw error;
  });
  return customerTableReady;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) return new Uint8Array();
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validCustomerEmail(email: string) {
  return EMAIL.test(normalizeCustomerEmail(email));
}

export async function hashCustomerPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return `pbkdf2:${PASSWORD_ITERATIONS}:${toHex(salt)}:${hash}`;
}

export async function verifyCustomerPassword(password: string, stored: string) {
  const [algorithm, iterationsValue, saltValue, expected] = stored.split(":");
  const iterations = Number(iterationsValue);
  if (algorithm !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100_000 || !saltValue || !expected) return false;
  const salt = fromHex(saltValue);
  if (!salt.length) return false;
  return safeEqual(await derivePassword(password, salt, iterations), expected);
}

export type CustomerIdentity = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  eligible: boolean;
  accessIssue: "verified_email_required" | "name_required" | null;
};

export async function createCustomerSession(account: { id: string; email: string }) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${account.id}|${normalizeCustomerEmail(account.email)}|${expires}`;
  const signature = await hmac(payload, requireRuntimeValue("SESSION_SECRET"));
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, `${payload}|${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearCustomerSession() {
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCustomerSession() {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const [id, email, expiresValue, signature] = token.split("|");
  const expires = Number(expiresValue);
  if (!id || !email || !signature || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return null;
  const expected = await hmac(`${id}|${email}|${expiresValue}`, requireRuntimeValue("SESSION_SECRET"));
  if (!safeEqual(signature, expected)) return null;
  return { id, email };
}

export const getCurrentCustomer = cache(async function getCurrentCustomer() {
  const user = await currentUser();
  if (!user) return null;

  const primaryEmail = user.primaryEmailAddress;
  const email = normalizeCustomerEmail(primaryEmail?.emailAddress ?? "");
  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Cliente";
  const verified = primaryEmail?.verification?.status === "verified";

  if (!verified || !firstName || !lastName) {
    return {
      id: user.id,
      email,
      firstName,
      lastName,
      displayName,
      eligible: false,
      accessIssue: !verified ? "verified_email_required" : "name_required",
    } satisfies CustomerIdentity;
  }

  await ensureCustomerAccountsTable();
  await getDb().execute(sql`
    INSERT INTO customer_accounts (id, email, password_hash, clerk_user_id, first_name, last_name, created_at, updated_at)
    VALUES (${user.id}, ${email}, NULL, ${user.id}, ${firstName || null}, ${lastName || null}, now(), now())
    ON CONFLICT (email) DO UPDATE SET
      clerk_user_id = EXCLUDED.clerk_user_id,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      updated_at = now()
  `);
  const [account] = await getDb()
    .select({
      id: customerAccounts.id,
      email: customerAccounts.email,
      firstName: customerAccounts.firstName,
      lastName: customerAccounts.lastName,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.email, email))
    .limit(1);
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName ?? firstName,
    lastName: account.lastName ?? lastName,
    displayName,
    eligible: true,
    accessIssue: null,
  } satisfies CustomerIdentity;
});
