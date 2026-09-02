"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle, ShieldCheck, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { clearCart, removeCartItem, useCartItems } from "@/lib/cart-store";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function CartExperience() {
  const pathname = usePathname();
  const items = useCartItems();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const total = items.reduce((sum, item) => sum + item.price, 0);

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || loading) return;
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: items.map((item) => item.id), email }),
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? "No pudimos iniciar el pago.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos iniciar el pago.");
    } finally {
      setLoading(false);
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/compra")) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          className="fixed bottom-5 right-5 z-40 h-14 rounded-full border border-[#d5bb90]/40 bg-[#c6a56d] px-5 font-semibold text-black shadow-2xl shadow-black/50 hover:bg-[#d5bb90] sm:bottom-7 sm:right-7"
          aria-label={`Abrir carrito, ${items.length} ${items.length === 1 ? "foto" : "fotos"}`}
        >
          <ShoppingBag className="size-5" />
          <span>Carrito</span>
          <span className="grid min-w-6 place-items-center rounded-full bg-black px-1.5 py-0.5 text-xs text-white" aria-live="polite">
            {items.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-white/10 bg-[#101010] text-[#f2eee7] sm:max-w-lg"
      >
        <SheetHeader className="relative border-b border-white/10 p-6 pr-16">
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#c6a56d]">Compra digital</p>
          <SheetTitle className="font-serif text-3xl font-normal text-[#f2eee7]">Tu selección</SheetTitle>
          <SheetDescription className="text-white/45">
            Elegí todas las fotos que quieras y pagalas juntas.
          </SheetDescription>
          <SheetClose asChild>
            <Button type="button" size="icon" variant="ghost" className="absolute right-5 top-5 rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cerrar carrito">
              <X className="size-5" />
            </Button>
          </SheetClose>
        </SheetHeader>

        {items.length ? (
          <form onSubmit={handleCheckout} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
              {items.map((item) => (
                <article key={item.id} className="flex gap-4 border border-white/10 bg-white/[0.025] p-3">
                  <Image src={item.image} alt="" width={96} height={72} unoptimized className="h-[72px] w-24 shrink-0 object-cover" />
                  <div className="min-w-0 flex-1 self-center">
                    <h3 className="truncate font-serif text-lg">{item.title}</h3>
                    <p className="mt-1 text-sm text-white/52">{currency.format(item.price)}</p>
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeCartItem(item.id)} className="self-center rounded-full text-white/45 hover:bg-red-400/10 hover:text-red-300" aria-label={`Quitar ${item.title}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </article>
              ))}
              <Button type="button" variant="ghost" onClick={clearCart} className="h-8 px-0 text-xs text-white/40 hover:bg-transparent hover:text-white">
                Vaciar carrito
              </Button>
            </div>

            <div className="space-y-5 border-t border-white/10 bg-[#111] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.16em] text-white/45">Total · {items.length} {items.length === 1 ? "foto" : "fotos"}</span>
                <strong className="font-serif text-2xl font-normal">{currency.format(total)}</strong>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cart-email" className="text-xs text-white/72">Email para recibir la compra</Label>
                <Input
                  id="cart-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  className="h-12 border-white/15 bg-white/5 placeholder:text-white/25 focus-visible:border-[#c6a56d] focus-visible:ring-[#c6a56d]/20"
                />
              </div>
              {message ? <p className="rounded-lg border border-[#c6a56d]/25 bg-[#c6a56d]/8 p-3 text-xs leading-5 text-[#dbc49f]">{message}</p> : null}
              <Button type="submit" disabled={loading} className="h-12 w-full bg-[#c6a56d] font-semibold text-black hover:bg-[#d5bb90]">
                {loading ? <><LoaderCircle className="animate-spin" /> Preparando pago</> : `Pagar ${currency.format(total)} con Mercado Pago`}
              </Button>
              <p className="flex items-center justify-center gap-2 text-[11px] text-white/35">
                <ShieldCheck className="size-3.5" /> Pago único y protegido por Mercado Pago
              </p>
            </div>
          </form>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full border border-white/10 bg-white/[0.025] text-[#c6a56d]">
                <ShoppingBag className="size-6" />
              </span>
              <h3 className="mt-6 font-serif text-2xl">Tu carrito está vacío</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/42">Agregá fotos desde cualquier evento. Tu selección se conservará mientras recorrés la galería.</p>
              <SheetClose asChild>
                <Button type="button" className="mt-6 rounded-full bg-[#c6a56d] px-6 text-black hover:bg-[#d5bb90]">Seguir mirando</Button>
              </SheetClose>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
