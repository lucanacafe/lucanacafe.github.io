import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const moneyFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const money = (n: number | string | null | undefined) => `${moneyFmt.format(Number(n ?? 0))} ₺`;

/** Göreli yolları (public/images/...) base URL ile çözer; tam URL'leri olduğu gibi bırakır. */
export function asset(path: string | null | undefined) {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}

/** Sitenin yayın adresi (QR linkleri için). Özel domain alındığında .env'den değişir. */
export function siteUrl(path = "") {
  const base = (import.meta.env.VITE_SITE_URL as string) || window.location.origin + import.meta.env.BASE_URL;
  return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "az önce";
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const fmtDay = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" });

/** İstanbul saatine göre iş günü (gün 05:00'te döner) — sunucudaki _biz_day ile aynı. */
export function bizDay(date = new Date()) {
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  ist.setHours(ist.getHours() - 5);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ist.getFullYear()}-${p(ist.getMonth() + 1)}-${p(ist.getDate())}`;
}

export function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Müşteri cihazı için kalıcı anonim kimlik (sipariş takibi + kötüye kullanım sınırı). */
export function deviceId() {
  const KEY = "lucana.device";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function normalize(s: string) {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function telHref(phone: string) {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

export function waHref(phone: string, text = "") {
  return `https://wa.me/${phone.replace(/\D/g, "")}${text ? "?text=" + encodeURIComponent(text) : ""}`;
}
