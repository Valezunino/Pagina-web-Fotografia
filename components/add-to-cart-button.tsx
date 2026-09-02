"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addCartItem, removeCartItem, useCartItems, type CartItem } from "@/lib/cart-store";

export function AddToCartButton({ photo }: { photo: CartItem }) {
  const items = useCartItems();
  const selected = items.some((item) => item.id === photo.id);

  return (
    <Button
      type="button"
      aria-pressed={selected}
      aria-label={selected ? `Quitar ${photo.title} del carrito` : `Agregar ${photo.title} al carrito`}
      onClick={() => selected ? removeCartItem(photo.id) : addCartItem(photo)}
      className={selected
        ? "h-10 rounded-full border border-[#c6a56d] bg-[#c6a56d] px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-black hover:bg-[#d5bb90]"
        : "h-10 rounded-full bg-[#f0ece4] px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-black hover:bg-[#c6a56d]"}
    >
      {selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      <span className="hidden xl:inline">{selected ? "Agregada" : "Agregar"}</span>
    </Button>
  );
}
