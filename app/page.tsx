import Link from "next/link";
import { ArrowDown, ArrowUpRight, Camera, FolderOpen, LockKeyhole } from "lucide-react";
import { getPublishedAlbums } from "@/lib/album-data";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [publishedAlbums, settings] = await Promise.all([getPublishedAlbums(), getSiteSettings()]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0b0b] text-[#f2eee7]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#0b0b0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#inicio" className="group flex items-center gap-3" aria-label="Ir al inicio">
            <span className="grid size-8 place-items-center rounded-full border border-[#c6a56d]/60 text-[#c6a56d] transition-colors group-hover:bg-[#c6a56d] group-hover:text-black">
              <Camera className="size-4" strokeWidth={1.5} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">
              Daniel <span className="text-[#c6a56d]">/</span> Justiniano
            </span>
          </a>
          <nav className="flex items-center gap-5 text-xs text-white/60 sm:gap-8" aria-label="Navegación principal">
            <a href="#eventos" className="hidden transition-colors hover:text-white sm:block">Eventos</a>
            <a href="#compra" className="hidden transition-colors hover:text-white sm:block">Cómo comprar</a>
            <a href="/admin" className="flex items-center gap-2 transition-colors hover:text-white">
              <LockKeyhole className="size-3.5" />
              Fotógrafo
            </a>
          </nav>
        </div>
      </header>

      <section id="inicio" className="relative mx-auto flex min-h-[86vh] max-w-[1440px] items-end px-5 pb-16 pt-36 sm:px-8 sm:pb-20 lg:px-12">
        <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-[#c6a56d]/8 blur-[120px]" />
        <div className="relative grid w-full items-end gap-12 lg:grid-cols-[1fr_0.62fr]">
          <div>
            <p className="mb-7 flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.38em] text-[#c6a56d]">
              <span className="h-px w-10 bg-[#c6a56d]" />
              {settings.heroKicker}
            </p>
            <h1 className="sr-only">Daniel Justiniano Fotografía</h1>
            <img
              src="/brand/daniel-fotografia-color.png"
              alt="Daniel Fotografía"
              className="h-auto w-full max-w-[720px] object-contain object-left"
            />
          </div>
          <div className="max-w-md border-l border-white/15 pl-6 lg:mb-3 lg:justify-self-end">
            <p className="text-base leading-7 text-white/62">
              {settings.heroDescription}
            </p>
            <a href="#eventos" className="mt-8 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:text-[#c6a56d]">
              Explorar eventos <ArrowDown className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <section id="eventos" className="border-t border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#c6a56d]">{settings.galleryEyebrow}</p>
              <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">{settings.galleryTitle}</h2>
            </div>
            <p className="hidden max-w-xs text-right text-sm leading-6 text-white/45 sm:block">
              Elegí un evento para ver sus fotografías protegidas y comprar el original que quieras.
            </p>
          </div>

          {publishedAlbums.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {publishedAlbums.map((album, index) => (
                <Link key={album.id} href={`/colecciones/${album.slug}`} className="group overflow-hidden border border-white/10 bg-[#111] transition hover:border-[#c6a56d]/45">
                  <div className="protected-photo relative aspect-[16/10] overflow-hidden bg-[#161616]">
                    <img src={album.coverImage} alt={`Portada de ${album.title}`} loading={index === 0 ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035] group-hover:brightness-75" />
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
                      <FolderOpen className="size-3.5 text-[#c6a56d]" /> {album.photoCount} {album.photoCount === 1 ? "foto" : "fotos"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-5 p-5 sm:p-6">
                    <div>
                      <h3 className="font-serif text-2xl leading-tight sm:text-3xl">{album.title}</h3>
                      {album.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">{album.description}</p> : null}
                    </div>
                    <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full border border-white/15 text-[#c6a56d] transition group-hover:border-[#c6a56d] group-hover:bg-[#c6a56d] group-hover:text-black">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center border border-dashed border-white/15 bg-white/[0.015] p-8 text-center">
              <div>
                <FolderOpen className="mx-auto size-8 text-[#c6a56d]" />
                <p className="mt-5 font-serif text-3xl">Próximamente nuevos eventos</p>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/42">Daniel está preparando las próximas colecciones. Las carpetas aparecerán acá cuando tengan fotografías publicadas.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="compra" className="border-y border-white/10 bg-[#101010] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.7fr_1fr] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#c6a56d]">Proceso simple</p>
            <h2 className="mt-5 max-w-lg font-serif text-4xl leading-tight sm:text-6xl">De la galería a tus manos.</h2>
          </div>
          <ol className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            {[
              ["01", "Elegí", "Seleccioná la foto que querés comprar."],
              ["02", "Pagá", "Completá el pago seguro con Mercado Pago."],
              ["03", "Descargá", "Recibí el original sin marca de agua."],
            ].map(([number, title, text]) => (
              <li key={number} className="bg-[#101010] p-6 sm:min-h-48">
                <span className="font-serif text-3xl italic text-[#c6a56d]">{number}</span>
                <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.18em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/48">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-10 text-xs text-white/40 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <span>© {new Date().getFullYear()} Daniel Justiniano Fotografía</span>
            <span className="hidden text-white/15 sm:inline" aria-hidden="true">•</span>
            <span>{settings.footerText}</span>
          </div>
          <div className="w-full max-w-xl border-t border-white/10 pt-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-white/30">Sitio diseñado y desarrollado por</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/65">Valentín Tomás Zunino Ruiz</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
