import { useCallback, useEffect, useState } from "react";
import type { CartLine, MenuItem } from "@/types";

/** Masa bazlı sepet — sayfa yenilense de localStorage'da kalır. */
export function useCart(code: string) {
  const key = `lucana.cart.${code}`;
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(lines));
    } catch {
      /* yok say */
    }
  }, [key, lines]);

  const add = useCallback((item: MenuItem, qty = 1, note?: string) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.id === item.id && (l.note ?? "") === (note ?? ""));
      if (i >= 0) {
        const copy = [...ls];
        copy[i] = { ...copy[i], qty: Math.min(20, copy[i].qty + qty) };
        return copy;
      }
      return [...ls, { id: item.id, name: item.name, price: Number(item.price), qty, note, image_url: item.image_url }];
    });
  }, []);

  const setQty = useCallback((index: number, qty: number) => {
    setLines((ls) => (qty <= 0 ? ls.filter((_, i) => i !== index) : ls.map((l, i) => (i === index ? { ...l, qty: Math.min(20, qty) } : l))));
  }, []);

  /** Menüden kalkan / fiyatı değişen ürünleri sepette güncelle */
  const sync = useCallback((items: MenuItem[]) => {
    const map = new Map(items.map((i) => [i.id, i]));
    setLines((ls) =>
      ls
        .filter((l) => map.has(l.id) && map.get(l.id)!.available !== false)
        .map((l) => ({ ...l, price: Number(map.get(l.id)!.price), name: map.get(l.id)!.name })),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const qtyOf = (id: string) => lines.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);

  return { lines, add, setQty, sync, clear, count, total, qtyOf };
}
