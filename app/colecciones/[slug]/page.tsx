import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { BrandHomeLink } from "@/components/brand-home-link";
import { BuyDialog } from "@/components/buy-dialog";
import { getPublishedAlbum } from "@/lib/album-data";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedAlbum(slug);
  return result
    ? { title: `${result.album.title} | Daniel Justiniano`, description: result.album.description || `${result.album.photoCount} fotografías del evento.` }
    : { title: "Colección | Daniel Justiniano" };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublishedAlbum(slug);
  if (!result) notFound();
  const { album, photos } = result;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-[#f2eee7]">
      <header className="border-b border-white/10 bg-[#0b0b0b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <BrandHomeLink label="Volver al inicio" />
          <Link href="/admin" className="flex items-center gap-2 text-xs text-white/50 transition-colors hover:text-white"><LockKeyhole className="size-3.5" /> Fotógrafo</Link>
        </div>
      </header>

      <section className="border-b border-white/10 px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <Link href="/#eventos" className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c6a56d] transition hover:text-white"><ArrowLeft className="size-3.5" /> Todos los eventos</Link>
          <div className="mt-10 grid gap-7 lg:grid-cols-[1fr_0.45fr] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#c6a56d]">Colección fotográfica</p>
              <h1 className="mt-4 max-w-5xl font-serif text-4xl leading-tight sm:text-6xl lg:text-7xl">{album.title}</h1>
            </div>
            <div className="border-l border-white/15 pl-5 text-sm leading-6 text-white/48">
              {album.description ? <p>{album.description}</p> : null}
              <p className={album.description ? "mt-3" : ""}>{album.photoCount} {album.photoCount === 1 ? "fotografía disponible" : "fotografías disponibles"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto grid max-w-[1440px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <article key={photo.id} className="group overflow-hidden border border-white/10 bg-[#111]">
              <div className="protected-photo aspect-[4/3] overflow-hidden bg-black">
                <img src={photo.image} alt={photo.title} loading={index < 3 ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025] group-hover:brightness-90" />
              </div>
              <div className="flex items-end justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#c6a56d]">{photo.category}</p>
                  <h2 className="mt-2 truncate font-serif text-2xl">{photo.title}</h2>
                  <p className="mt-2 text-sm text-white/55">{currency.format(photo.priceCents / 100)}</p>
                </div>
                <BuyDialog photo={{ id: photo.id, title: photo.title, price: photo.priceCents / 100 }} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
