import type { CallType, OrderStatus, PaymentMethod } from "@/types";

/** Sunucudaki yetki eşikleriyle birebir aynı (supabase/migrations/0003_admin.sql). */
export const LEVEL = {
  KITCHEN: 30,
  WAITER: 40,
  CASHIER: 60,
  MANAGER: 80,
  FOUNDER: 100,
} as const;

export const STATUS: Record<OrderStatus, { label: string; tone: string; dot: string }> = {
  new: { label: "Yeni", tone: "bg-ember-500/15 text-ember-300 border-ember-500/30", dot: "bg-ember-400" },
  preparing: { label: "Hazırlanıyor", tone: "bg-gold-400/15 text-gold-200 border-gold-400/30", dot: "bg-gold-300" },
  served: { label: "Servis edildi", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  paid: { label: "Ödendi", tone: "bg-sky-500/10 text-sky-300 border-sky-500/25", dot: "bg-sky-400" },
  cancelled: { label: "İptal", tone: "bg-wine-500/15 text-wine-400 border-wine-500/30", dot: "bg-wine-400" },
};

export const CALL: Record<CallType, { label: string; short: string; emoji: string }> = {
  waiter: { label: "Garson çağır", short: "Garson", emoji: "🙋" },
  coal: { label: "Köz değişimi", short: "Köz", emoji: "🔥" },
  bill: { label: "Hesap iste", short: "Hesap", emoji: "🧾" },
  other: { label: "Diğer", short: "Diğer", emoji: "💬" },
};

export const PAYMENT: Record<PaymentMethod, string> = {
  cash: "Nakit",
  card: "Kart",
  other: "Diğer",
};
