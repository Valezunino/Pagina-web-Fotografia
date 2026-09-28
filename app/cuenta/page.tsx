import { and, desc, eq } from "drizzle-orm";
import { Images, ShoppingBag } from "lucide-react";
import { AccountAccessForm } from "@/components/account-access-form";
import { AccountDownloadButton } from "@/components/account-downloads";
import { AccountLogoutButton } from "@/components/account-logout-button";
import { AccountNameForm } from "@/components/account-name-form";
import { BrandHomeLink } from "@/components/brand-home-link";
import { getDb } from "@/db";
import { orders, photos } from "@/db/schema";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getOrderItemsOrEmpty } from "@/lib/order-items";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer || !customer.eligible) {
    return (
      <main className="min-h-screen bg-[#0b0b0b] px-5 py-8 text-[#f2eee7] sm:px-8">
        <div className="mx-auto flex max-w-5xl"><BrandHomeLink /></div>
        <section className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-5xl place-items-center py-12">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_0.72fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#c6a56d]">Tu espacio personal</p>
              <h1 className="mt-5 max-w-xl font-serif text-5xl leading-tight sm:text-6xl">Todas tus fotos, siempre disponibles.</h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/48">Ingresá con Google o registrate con tu email. Usá el mismo correo con el que pagás para encontrar juntas tus compras anteriores y las próximas.</p>
            </div>
            <div>
              {customer?.accessIssue === "name_required" ? (
                <AccountNameForm initialFirstName={customer.firstName} initialLastName={customer.lastName} />
              ) : customer?.accessIssue === "verified_email_required" ? (
                <div className="mb-4 border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100/80">
                  El email todavía no está verificado. Completá la verificación recibida por correo o ingresá con otra cuenta.
                  <div className="mt-3"><AccountLogoutButton /></div>
                </div>
              ) : null}
              {!customer ? <AccountAccessForm /> : null}
            </div>
          </div>
        </section>
      </main>
    );
  }

  const purchasedOrders = await getDb()
    .select({ id: orders.id, photoId: orders.photoId, title: photos.title, paidAt: orders.paidAt, createdAt: orders.createdAt })
    .from(orders)
    .innerJoin(photos, eq(photos.id, orders.photoId))
    .where(and(eq(orders.email, customer.email), eq(orders.status, "approved")))
    .orderBy(desc(orders.paidAt), desc(orders.createdAt));
  const purchases = await Promise.all(purchasedOrders.map(async (order) => {
    const stored = await getOrderItemsOrEmpty(order.id);
    const items = stored.length ? stored.map((item) => ({ id: item.photoId, title: item.title })) : [{ id: order.photoId, title: order.title }];
    return { ...order, items };
  }));
  const totalPhotos = purchases.reduce((total, purchase) => total + purchase.items.length, 0);

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-[#f2eee7]">
      <header className="border-b border-white/10 bg-[#0b0b0b]/90">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 sm:px-8"><BrandHomeLink /><AccountLogoutButton /></div>
      </header>
      <section className="border-b border-white/10 px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#c6a56d]">Mi cuenta</p>
            <h1 className="mt-4 font-serif text-5xl sm:text-6xl">Mis fotos</h1>
            <p className="mt-4 text-sm text-white/45">Hola, {customer.displayName}. Estas son las compras aprobadas de tu cuenta.</p>
          </div>
          <div className="flex gap-3 text-xs text-white/55">
            <span className="flex items-center gap-2 border border-white/10 bg-white/[0.025] px-4 py-3"><ShoppingBag className="size-4 text-[#c6a56d]" /> {purchases.length} compras</span>
            <span className="flex items-center gap-2 border border-white/10 bg-white/[0.025] px-4 py-3"><Images className="size-4 text-[#c6a56d]" /> {totalPhotos} fotos</span>
          </div>
        </div>
      </section>
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-[1280px] gap-6">
          {purchases.length ? purchases.map((purchase) => (
            <article key={purchase.id} className="border border-white/10 bg-[#111] p-5 sm:p-7">
              <div className="mb-5 flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-serif text-2xl">{purchase.items.length === 1 ? purchase.items[0].title : `${purchase.items.length} fotografías`}</h2>
                <p className="text-xs text-white/38">Pagada el {date.format(purchase.paidAt ?? purchase.createdAt)}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {purchase.items.map((item, index) => {
                  const query = new URLSearchParams({ order: purchase.id, photo: item.id });
                  const view = new URLSearchParams(query); view.set("view", "1");
                  const preview = new URLSearchParams(query); preview.set("preview", "1");
                  return (
                    <div key={`${purchase.id}-${item.id}`} className="grid overflow-hidden border border-white/10 bg-black/20">
                      <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-black">
                        {/* La URL es privada y necesita las cookies del navegador; por eso no pasa por el optimizador de imágenes. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/download?${preview}`} alt={`Vista previa de ${item.title}`} loading="lazy" className="h-full w-full object-contain" />
                      </div>
                      <div className="grid gap-4 p-4">
                        <div><p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#c6a56d]">Foto {index + 1}</p><h3 className="mt-2 truncate font-serif text-xl">{item.title}</h3></div>
                      <AccountDownloadButton item={{ key: `${purchase.id}-${item.id}`, title: item.title, downloadUrl: `/api/download?${query}`, viewUrl: `/api/download?${view}` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )) : (
            <div className="grid min-h-72 place-items-center border border-dashed border-white/15 bg-white/[0.015] p-8 text-center">
              <div><Images className="mx-auto size-8 text-[#c6a56d]" /><h2 className="mt-5 font-serif text-3xl">Todavía no hay compras aprobadas</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/42">Cuando pagues una foto con este email, aparecerá automáticamente acá.</p></div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
