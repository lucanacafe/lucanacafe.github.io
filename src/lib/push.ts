import { rpc } from "@/lib/supabase";

/**
 * Web Push (VAPID) yardımcıları.
 * Personel: yeni sipariş + çağrı bildirimleri. Müşteri: kendi siparişinin durumu.
 * iPhone'da yalnızca "Ana Ekrana Ekle" ile yüklenmiş uygulamada çalışır (iOS 16.4+).
 */
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export function pushSupported() {
  return Boolean(VAPID) && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  // vite-plugin-pwa kaydeder; hazır olmasını bekle (en fazla 8 sn)
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Uygulama servisi hazır değil, sayfayı yenileyin")), 8000)),
  ]);
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribeRaw() {
  if (!pushSupported()) {
    throw new Error(isIos() && !isStandalone()
      ? "iPhone'da bildirim için önce Paylaş → “Ana Ekrana Ekle” ile uygulamayı yükleyin."
      : "Bu tarayıcı bildirimleri desteklemiyor.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.");
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  return j;
}

export async function subscribeStaff() {
  const s = await subscribeRaw();
  await rpc("staff_push_subscribe", { p_endpoint: s.endpoint, p_p256dh: s.keys.p256dh, p_auth: s.keys.auth });
}

/** Üye: masa kodu olmadan (profil/oyun sayfası) — sipariş durumu + puan bildirimleri */
export async function subscribeMember(device: string) {
  const s = await subscribeRaw();
  await rpc("mem_push_subscribe", {
    p_device: device,
    p_endpoint: s.endpoint,
    p_p256dh: s.keys.p256dh,
    p_auth: s.keys.auth,
  });
}

export async function subscribeCustomer(code: string, device: string) {
  const s = await subscribeRaw();
  await rpc("pub_push_subscribe", {
    p_code: code,
    p_device: device,
    p_endpoint: s.endpoint,
    p_p256dh: s.keys.p256dh,
    p_auth: s.keys.auth,
  });
}

/** Bu cihazın aboneliğini kaldırır (personel çıkışında da çağrılır). */
export async function unsubscribe() {
  if (!pushSupported()) return;
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await rpc("push_unsubscribe", { p_endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* yok say */
  }
}

export const testPush = () => rpc<{ devices: number }>("staff_push_test");
