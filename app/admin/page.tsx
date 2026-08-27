import { Camera } from "lucide-react";
import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { getDb } from "@/db";
import { albums, photos } from "@/db/schema";
import { getAdminEmail } from "@/lib/admin-password";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdmin();
  const initialPhotos = authenticated
    ? await getDb().select().from(photos).orderBy(asc(photos.sortOrder), desc(photos.createdAt)).catch(() => [])
    : [];
  const initialAlbums = authenticated
    ? await getDb().select().from(albums).orderBy(asc(albums.sortOrder), desc(albums.createdAt)).catch(() => [])
    : [];
  const initialSettings = await getSiteSettings();
  const initialAdminEmail = authenticated ? await getAdminEmail() ?? "" : "";
  const configured = await adminConfigured();

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-[#f2eee7]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full border border-[#c6a56d]/60 text-[#c6a56d]">
              <Camera className="size-4" strokeWidth={1.5} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">Panel del fotógrafo</span>
          </Link>
          <Link href="/" className="text-xs text-white/50 transition-colors hover:text-white">Ver galería</Link>
        </div>
      </header>
      {authenticated ? (
        <AdminDashboard
          initialPhotos={initialPhotos}
          initialAlbums={initialAlbums}
          initialSettings={initialSettings}
          initialAdminEmail={initialAdminEmail}
        />
      ) : (
        <AdminLogin configured={configured} />
      )}
    </main>
  );
}
