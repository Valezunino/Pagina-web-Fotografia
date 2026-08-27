"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BuyDialogProps = {
  photo: { id: string; title: string; price: number };
  demo?: boolean;
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function BuyDialog({ photo, demo = false }: BuyDialogProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (demo) {
      setMessage("Esta es una foto de muestra. El fotógrafo podrá publicar las fotos reales desde su panel.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, email }),
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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="h-10 rounded-full bg-[#f0ece4] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black hover:bg-[#c6a56d]">
          Comprar <ArrowUpRight className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#111] p-0 text-[#f2eee7] sm:max-w-md">
        <div className="border-b border-white/10 p-6 pb-5">
          <DialogHeader>
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#c6a56d]">Compra digital</p>
            <DialogTitle className="font-serif text-3xl font-normal">{photo.title}</DialogTitle>
            <DialogDescription className="text-white/48">
              Archivo original en alta calidad, sin marca de agua.
            </DialogDescription>
          </DialogHeader>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-6 pt-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <span className="text-xs uppercase tracking-[0.16em] text-white/45">Total</span>
            <strong className="font-serif text-2xl font-normal">{currency.format(photo.price)}</strong>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`email-${photo.id}`} className="text-xs text-white/72">Email para recibir tu compra</Label>
            <Input
              id={`email-${photo.id}`}
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
            {loading ? <><LoaderCircle className="animate-spin" /> Preparando pago</> : "Pagar con Mercado Pago"}
          </Button>
          <p className="flex items-center justify-center gap-2 text-[11px] text-white/35">
            <ShieldCheck className="size-3.5" /> Pago protegido por Mercado Pago
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
