import { BrandHomeLink } from "@/components/brand-home-link";
import { OrderStatus } from "@/components/order-status";

export const dynamic = "force-dynamic";

export default async function PurchasePage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    order?: string;
    payment_id?: string;
    collection_id?: string;
    external_reference?: string;
  }>;
}) {
  const params = await searchParams;
  const estado = params.estado ?? "pendiente";
  const order = params.order || params.external_reference || "";
  const paymentId = params.payment_id || params.collection_id || "";
  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-10 text-[#f2eee7] sm:px-8">
      <div className="mx-auto flex max-w-3xl">
        <BrandHomeLink />
      </div>
      <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-3xl place-items-center py-12">
        <OrderStatus orderId={order} initialState={estado} paymentId={paymentId} />
      </section>
    </main>
  );
}
