import { rpc } from "@/lib/supabase";
import type { CallType, MenuData, Order, Settings, TableInfo, Call } from "@/types";

const MENU_CACHE = "lucana.menu.v1";
const SETTINGS_CACHE = "lucana.settings.v1";

function cached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function store(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* kota dolu vb. */
  }
}

export const publicApi = {
  /** Önbellekteki son menü — çevrimdışıyken / ilk boyamada anında göstermek için */
  cachedMenu: () => cached<MenuData>(MENU_CACHE),
  cachedSettings: () => cached<Settings>(SETTINGS_CACHE),

  async menu() {
    const m = await rpc<MenuData>("pub_menu");
    store(MENU_CACHE, m);
    return m;
  },
  async settings() {
    const s = await rpc<Settings>("pub_settings");
    store(SETTINGS_CACHE, s);
    return s;
  },
  table: (code: string) => rpc<TableInfo | null>("pub_table", { p_code: code }),
  placeOrder: (
    code: string,
    device: string,
    items: { id: string; qty: number; note?: string }[],
    note?: string,
    discountTl = 0,
  ) =>
    rpc<{ id: string; no: number; total: number; subtotal: number; discount: number; points_spent: number }>("order_place", {
      p_code: code,
      p_device: device,
      p_items: items,
      p_note: note || null,
      p_discount_tl: discountTl,
    }),
  track: (code: string, device: string) =>
    rpc<{ orders: Order[]; calls: Call[] } | null>("order_track", { p_code: code, p_device: device }),
  cancelOwn: (code: string, device: string, orderId: string) =>
    rpc("order_cancel_own", { p_code: code, p_device: device, p_order: orderId }),
  call: (code: string, device: string, type: CallType, note?: string) =>
    rpc<{ id: string; duplicate: boolean }>("call_create", {
      p_code: code,
      p_device: device,
      p_type: type,
      p_note: note || null,
    }),
};
