import { rpc, sessionToken, supabase } from "@/lib/supabase";
import type { Call, Category, MenuItem, Order, OrderStatus, PaymentMethod, Settings, StaffUser } from "@/types";

export interface Overview {
  biz_day: string;
  today: { orders: number; cancelled: number; revenue: number | null; open_total: number | null; avg_ticket: number | null };
  active: { new: number; preparing: number; served: number };
  calls_open: number;
  tables_busy: number;
  tables_total: number;
  low_stock: { kind: "menu" | "inventory"; id: string; name: string; qty: number; critical: number; unit: string }[];
  week: { day: string; revenue: number; orders: number }[] | null;
  top_today: { name: string; qty: number }[];
}

export interface LiveTable {
  id: string;
  name: string;
  area: string;
  open_orders: number;
  open_total: number;
  since: string | null;
  calls: number;
  people_count: number;
  people: { id: string; nickname: string; avatar: string; points: number; since: string }[];
}

export interface MemberRow {
  id: string;
  nickname: string;
  avatar: string;
  username: string | null;
  points: number;
  lifetime_earned: number;
  is_hidden: boolean;
  is_banned: boolean;
  marketing_ok: boolean;
  created_at: string;
  last_seen_at: string;
  orders_paid: number;
  spent: number;
  game_net: number;
  at_table: string | null;
}

export interface PoolStats {
  seeds: number;
  harvest: number;
  help: number;
  blok: number;
  plots: number;
  players: number;
}

export interface PoolInfo {
  balance: number;
  today: PoolStats;
  week: PoolStats;
  growing: number;
  farmers: number;
  ledger: { delta: number; reason: string; balance_after: number; at: string; staff: string | null }[];
  recent: { kind: string; delta: number; note: string | null; at: string; nickname: string; avatar: string }[];
}

export interface TableRow {
  id: string;
  name: string;
  area: string;
  code: string;
  is_active: boolean;
  sort: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  critical: number;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface StockMove {
  id: number;
  kind: "menu" | "inventory";
  ref_id: string;
  ref_name: string;
  delta: number;
  reason: string | null;
  at: string;
  staff: string | null;
}

export interface Report {
  totals: {
    revenue: number;
    paid: number;
    cancelled: number;
    cancelled_total: number;
    open: number;
    avg_ticket: number;
    qr_share: number;
  };
  by_day: { day: string; revenue: number; orders: number }[];
  by_method: { method: PaymentMethod; revenue: number; orders: number }[];
  by_hour: { hour: number; orders: number; revenue: number | null }[];
  top_items: { name: string; qty: number; revenue: number }[];
  by_category: { name: string; qty: number; revenue: number }[];
}

export interface Role {
  id: string;
  key: string;
  name: string;
  level: number;
  color: string;
}

export interface StaffRow {
  id: string;
  username: string;
  full_name: string;
  role_id: string;
  role_name: string;
  role_key: string;
  level: number;
  color: string;
  is_active: boolean;
  must_change_pw: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AuditRow {
  id: number;
  staff_label: string | null;
  action: string;
  entity: string;
  summary: string;
  at: string;
}

export const auth = {
  async login(username: string, password: string) {
    const res = await rpc<{ token: string; user: StaffUser }>("staff_login", {
      p_username: username,
      p_password: password,
    });
    sessionToken.set(res.token);
    return res.user;
  },
  me: () => rpc<StaffUser | null>("staff_me"),
  async logout() {
    try {
      await rpc("staff_logout");
    } finally {
      sessionToken.set(null);
    }
  },
  changePassword: (oldPw: string, newPw: string) => rpc("staff_change_password", { p_old: oldPw, p_new: newPw }),
};

export const adminApi = {
  overview: () => rpc<Overview>("adm_overview"),

  orders: (scope: "active" | "day", day?: string) => rpc<Order[]>("adm_orders", { p_scope: scope, p_day: day ?? null }),
  setStatus: (id: string, status: OrderStatus, payment?: PaymentMethod, reason?: string) =>
    rpc("adm_order_status", { p_id: id, p_status: status, p_payment: payment ?? null, p_reason: reason ?? null }),
  createOrder: (tableId: string | null, items: { id: string; qty: number; note?: string }[], note?: string) =>
    rpc<{ id: string; no: number; total: number }>("adm_order_create", {
      p_table: tableId,
      p_items: items,
      p_note: note || null,
    }),

  tablesLive: () => rpc<LiveTable[]>("adm_tables_live"),
  closeTable: (tableId: string, payment: PaymentMethod) =>
    rpc<{ orders: number; total: number }>("adm_table_close", { p_table: tableId, p_payment: payment }),

  calls: () => rpc<Call[]>("adm_calls"),
  callDone: (id: string) => rpc("adm_call_done", { p_id: id }),

  menu: () => rpc<{ categories: Category[]; items: MenuItem[] }>("adm_menu"),
  saveCategory: (p: Partial<Category>) => rpc<{ id: string }>("adm_category_save", { p }),
  deleteCategory: (id: string) => rpc("adm_category_delete", { p_id: id }),
  saveItem: (p: Partial<MenuItem>) => rpc<{ id: string }>("adm_item_save", { p }),
  deleteItem: (id: string) => rpc("adm_item_delete", { p_id: id }),
  toggleItem: (id: string, field: "is_active" | "is_featured", value: boolean) =>
    rpc("adm_item_toggle", { p_id: id, p_field: field, p_value: value }),
  itemStock: (id: string, mode: "add" | "set", value: number, reason?: string) =>
    rpc<{ stock: number }>("adm_item_stock", { p_id: id, p_mode: mode, p_value: value, p_reason: reason ?? null }),
  reorder: (kind: "category" | "item", ids: string[]) => rpc("adm_menu_reorder", { p_kind: kind, p_ids: ids }),

  inventory: () => rpc<InventoryItem[]>("adm_inventory"),
  saveInventory: (p: Partial<InventoryItem>) => rpc<{ id: string }>("adm_inventory_save", { p }),
  deleteInventory: (id: string) => rpc("adm_inventory_delete", { p_id: id }),
  moveInventory: (id: string, delta: number, reason?: string) =>
    rpc<{ qty: number }>("adm_inventory_move", { p_id: id, p_delta: delta, p_reason: reason ?? null }),
  stockMoves: (ref?: string, limit = 100) => rpc<StockMove[]>("adm_stock_moves", { p_ref: ref ?? null, p_limit: limit }),

  tables: () => rpc<TableRow[]>("adm_tables"),
  saveTable: (p: Partial<TableRow>) => rpc<{ id: string }>("adm_table_save", { p }),
  bulkTables: (area: string, prefix: string, from: number, to: number) =>
    rpc("adm_tables_bulk", { p_area: area, p_prefix: prefix, p_from: from, p_to: to }),
  deleteTable: (id: string) => rpc("adm_table_delete", { p_id: id }),
  regenTable: (id: string) => rpc<{ code: string }>("adm_table_regen", { p_id: id }),

  settings: () => rpc<Settings>("adm_settings"),
  saveSettings: (p: Partial<Settings>) => rpc<Settings>("adm_settings_save", { p }),

  report: (from: string, to: string) => rpc<Report>("adm_report", { p_from: from, p_to: to }),

  roles: () => rpc<Role[]>("adm_roles"),
  staff: () => rpc<StaffRow[]>("adm_staff_list"),
  saveStaff: (p: Partial<StaffRow> & { password?: string }) => rpc<{ id: string }>("adm_staff_save", { p }),
  kickStaff: (id: string) => rpc("adm_staff_kick", { p_id: id }),

  members: (q?: string) => rpc<MemberRow[]>("adm_members", { p_q: q ?? null, p_limit: 300 }),
  memberDetail: (id: string) =>
    rpc<{
      member: import("./member").Member;
      ledger: { delta: number; kind: string; note: string | null; balance_after: number | null; at: string; staff: string | null }[];
    }>("adm_member_detail", { p_member: id }),
  memberPoints: (id: string, delta: number, reason: string) =>
    rpc("adm_member_points", { p_member: id, p_delta: delta, p_reason: reason }),
  memberBan: (id: string, banned: boolean) => rpc("adm_member_ban", { p_member: id, p_banned: banned }),

  pool: () => rpc<PoolInfo>("adm_pool"),
  poolAdjust: (delta: number, reason: string) => rpc<{ balance: number }>("adm_pool_adjust", { p_delta: delta, p_reason: reason }),

  audit: (limit = 100, offset = 0, q?: string) =>
    rpc<AuditRow[]>("adm_audit", { p_limit: limit, p_offset: offset, p_q: q ?? null }),

  /** Görseli Edge Function üzerinden Storage'a yükler (yetki sunucuda doğrulanır). */
  async uploadImage(file: Blob, folder = "menu") {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lucana-upload?folder=${folder}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-session-token": sessionToken.get() ?? "",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": file.type || "image/webp",
      },
      body: file,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Görsel yüklenemedi");
    return json.url as string;
  },
};

export { supabase };
