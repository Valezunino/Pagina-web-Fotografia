"use client";

import { useEffect, useState } from "react";
import { Check, Download, LoaderCircle, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PurchaseState = {
  status?: string;
  title?: string;
  downloadUrl?: string | null;
  accessToken?: string;
  error?: string;
};

export function OrderStatus({
  orderId,
  initialState,
  paymentId,
  accessToken,
}: {
  orderId: string;
  initialState: string;
  paymentId?: string;
  accessToken?: string;
}) {
  const [purchase, setPurchase] = useState<PurchaseState>({ status: initialState === "aprobado" ? "pending" : initialState });
  const [verifiedAccess, setVerifiedAccess] = useState(accessToken ?? "");
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(0);

  async function checkPayment() {
    if (!orderId) return;
    setChecking(true);
    try {
      const query = new URLSearchParams({ order: orderId });
      if (paymentId) query.set("paymentId", paymentId);
      if (verifiedAccess) query.set("access", verifiedAccess);
      const response = await fetch(`/api/order-status?${query.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as PurchaseState;
      if (response.ok) {
        setPurchase(data);
        if (data.accessToken) setVerifiedAccess(data.accessToken);
      }
      else setPurchase((current) => ({ ...current, error: data.error ?? "No pudimos verificar el pago todavía." }));
    } catch {
      setPurchase((current) => ({ ...current, error: "La conexión demoró. Vamos a volver a verificar." }));
    } finally {
      setChecking(false);
      setChecks((current) => current + 1);
    }
  }

  useEffect(() => {
    if (!orderId || purchase.status === "approved") return;
    const initialCheck = window.setTimeout(() => void checkPayment(), 0);
    const timer = window.setInterval(() => void checkPayment(), 4000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
    };
    // El intervalo se reinicia solamente cuando cambia la compra o llega la aprobación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, paymentId, verifiedAccess, purchase.status]);

  const approved = purchase.status === "approved";
  const failed = ["error", "rejected", "cancelled", "refunded", "charged_back", "creation_failed"].includes(purchase.status ?? "");

  return (
    <div className="w-full max-w-xl border border-white/10 bg-[#111] p-7 text-center sm:p-10">
      <span className={`mx-auto grid size-14 place-items-center rounded-full ${
        approved ? "bg-emerald-400/12 text-emerald-300" : failed ? "bg-red-400/12 text-red-300" : "bg-[#c6a56d]/12 text-[#c6a56d]"
      }`}>
        {approved ? <Check className="size-6" /> : failed ? <X className="size-6" /> : <LoaderCircle className="size-6 animate-spin" />}
      </span>
      <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c6a56d]">
        {approved ? "Pago aprobado" : failed ? "Pago no completado" : "Confirmando pago"}
      </p>
      <h1 className="mt-3 font-serif text-4xl">
        {approved ? "Tu foto está lista." : failed ? "No se realizó la compra." : "Estamos preparando tu archivo."}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/48">
        {approved
          ? `${purchase.title ?? "La fotografía"} ya puede descargarse en su calidad original y sin marca de agua.`
          : failed
            ? "Podés volver a la galería e intentar nuevamente. No se habilitó ninguna descarga."
            : checks > 5
              ? "La confirmación está demorando más de lo habitual. Podés verificar nuevamente sin volver a pagar."
              : "Mercado Pago puede demorar unos segundos en confirmar la operación. Esta pantalla se actualiza automáticamente."}
      </p>
      {purchase.error ? <p className="mt-5 text-xs text-red-300">{purchase.error}</p> : null}
      <div className="mt-8">
        {approved && purchase.downloadUrl ? (
          <Button asChild className="h-12 rounded-full bg-[#c6a56d] px-7 text-black hover:bg-[#d5bb90]">
            <a href={purchase.downloadUrl} download><Download /> Descargar sin marca de agua</a>
          </Button>
        ) : failed ? (
          <Button asChild variant="outline" className="h-12 rounded-full border-white/15 bg-white/5 px-7 text-white hover:bg-white/10">
            <Link href="/#eventos"><RotateCcw /> Volver a los eventos</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full border-white/15 bg-white/5 px-7 text-white hover:bg-white/10"
            disabled={checking}
            onClick={() => void checkPayment()}
          >
            <RotateCcw className={checking ? "animate-spin" : ""} />
            {checking ? "Verificando…" : "Verificar pago ahora"}
          </Button>
        )}
      </div>
      {approved ? (
        <p className="mt-4 text-[11px] leading-5 text-white/35">
          En iPhone, el archivo se guarda en Archivos → Descargas.
        </p>
      ) : null}
    </div>
  );
}
