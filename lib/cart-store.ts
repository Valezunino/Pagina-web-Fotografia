"use client";

import { useSyncExternalStore } from "react";

export type CartItem = {
  id: string;
  title: string;
  price: number;
  image: string;
};

const STORAGE_KEY = "daniel-justiniano-cart-v1";
const CHANGE_EVENT = "gallery-cart-change";
const EMPTY_CART: CartItem[] = [];
let memoryCart: CartItem[] | null = null;

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.image === "string"
    && typeof item.price === "number"
    && Number.isFinite(item.price)
    && item.price > 0;
}

function readCart() {
  if (typeof window === "undefined") return EMPTY_CART;
  if (memoryCart) return memoryCart;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    memoryCart = Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    memoryCart = [];
  }
  return memoryCart;
}

function writeCart(items: CartItem[]) {
  memoryCart = items;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // El carrito sigue funcionando durante esta visita si el navegador bloquea el almacenamiento.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void) {
  const onChange = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    memoryCart = null;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCartItems() {
  return useSyncExternalStore(subscribe, readCart, () => EMPTY_CART);
}

export function addCartItem(item: CartItem) {
  const current = readCart();
  if (current.some((stored) => stored.id === item.id)) return;
  writeCart([...current, item]);
}

export function removeCartItem(photoId: string) {
  writeCart(readCart().filter((item) => item.id !== photoId));
}

export function removeCartItems(photoIds: string[]) {
  const purchased = new Set(photoIds);
  writeCart(readCart().filter((item) => !purchased.has(item.id)));
}

export function clearCart() {
  writeCart([]);
}
