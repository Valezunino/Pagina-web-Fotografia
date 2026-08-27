import { Camera } from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@/components/order-status";

export const dynamic = "force-dynamic";

export default async function PurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; order?: string }>;
}) {
  const { estado = "pendiente", order = "" } = await searchParams;
  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-10 text-[#f2eee7] sm:px-8">
      <Link href="/" className="mx-auto flex max-w-3xl items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full border border-[#c6a56d]/60 text-[#c6a56d]">
          <Camera className="size-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">Daniel / Justiniano</span>
      </Link>
      <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-3xl place-items-center py-12">
        <OrderStatus orderId={order} initialState={estado} />
      </section>
    </main>
  );
}
