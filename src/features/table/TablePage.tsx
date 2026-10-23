import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Copy, Minus, Plus, Receipt, ShoppingBag, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { Button, Modal, PageLoader } from "@/components/ui";
import { Logo } from "@/components/ui/brand";
import { useSite } from "@/app/SiteContext";
import { useLive } from "@/hooks/useLive";
import { publicApi } from "@/lib/api/public";
import { CALL, STATUS } from "@/lib/constants";
import { asset, cn, deviceId, fmtTime, money, telHref } from "@/lib/utils";
import type { CallType, MenuData, Order, TableInfo } from "@/types";
import { useCart } from "./useCart";

const STEPS: Order["status"][] = ["new", "preparing", "served"];

export default function TablePage() {
  const { code = "" } = useParams();
  const { settings } = useSite();
  const device = useMemo(() => deviceId(), []);
  const [table, setTable] = useState<TableInfo | null | undefined>(undefined);
  const [menu, setMenu] = useState<MenuData | null>(publicApi.cachedMenu());
  const cart = useCart(code);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState<CallType | null>(null);

  useEffect(() => {
    publicApi
      .table(code)
      .then((t) => {
        setTable(t);
        if (t) document.title = `${t.name} · Lucana`;
      })
      .catch(() => setTable(null));
    publicApi
      .menu()
      .then((m) => {
        setMenu(m);
        cart.sync(m.items);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const track = useLive(() => publicApi.track(code, device), {
    topic: table ? `lucana-t-${table.id}` : null,
    interval: 10000,
    enabled: !!table,
  });
  const orders = track.data?.orders ?? [];
  const openCalls = new Set((track.data?.calls ?? []).map((c) => c.type));
  const activeOrders = orders.filter((o) => ["new", "preparing", "served"].includes(o.status));

  // Durum değişince bildir
  const prevStatus = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const o of orders) {
      const before = prevStatus.current[o.id];
      if (before && before !== o.status) {
        const msg =
          o.status === "preparing" ? "Siparişiniz hazırlanıyor 👨‍🍳" :
          o.status === "served" ? "Siparişiniz servis edildi, afiyet olsun ✨" :
          o.status === "cancelled" ? "Siparişiniz iptal edildi" : null;
        if (msg) {
          toast(msg, { description: `Sipariş #${o.no}` });
          navigator.vibrate?.(150);
        }
      }
      prevStatus.current[o.id] = o.status;
    }
  }, [orders]);

  if (table === undefined) return <PageLoader />;
  if (table === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <Logo className="text-7xl" />
        <h1 className="font-display text-3xl">QR kod geçersiz</h1>
        <p className="max-w-sm text-smoke-400">
          Bu QR kodu artık kullanılmıyor olabilir. Lütfen masanızdaki güncel QR kodu tekrar okutun ya da garsonumuza seslenin.
        </p>
        <a href={telHref(settings.phone)} className="text-gold-200">{settings.phone}</a>
      </div>
    );
  }

  const canOrder = table.ordering_enabled;

  async function sendOrder() {
    if (!cart.lines.length) return;
    setSending(true);
    try {
      const res = await publicApi.placeOrder(
        code,
        device,
        cart.lines.map((l) => ({ id: l.id, qty: l.qty, note: l.note })),
        note,
      );
      cart.clear();
      setNote("");
      setCartOpen(false);
      toast.success(`Siparişiniz alındı! #${res.no}`, { description: "Mutfağa iletildi, durumunu buradan takip edebilirsiniz." });
      await track.reload();
      setOrdersOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
      publicApi.menu().then((m) => {
        setMenu(m);
        cart.sync(m.items);
      });
    } finally {
      setSending(false);
    }
  }

  async function call(type: CallType) {
    setCalling(type);
    try {
      const r = await publicApi.call(code, device, type);
      toast.success(r.duplicate ? "Talebiniz zaten iletildi, geliyoruz 🙏" : `${CALL[type].label} iletildi`, {
        description: "Personelimiz en kısa sürede masanızda.",
      });
      track.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCalling(null);
    }
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Başlık */}
      <header className="sticky top-0 z-40 glass border-x-0 border-t-0">
        <div className="container flex h-14 items-center justify-between gap-3">
          <span className="text-3xl"><Logo sub={false} /></span>
          <div className="flex items-center gap-2">
            {table.wifi_name && (
              <button onClick={() => setWifiOpen(true)} className="rounded-full border border-white/10 p-2 text-gold-200" aria-label="Wi-Fi">
                <Wifi className="h-4 w-4" />
              </button>
            )}
            <span className="rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-sm font-semibold text-gold-100">
              {table.name}
            </span>
          </div>
        </div>
      </header>

      <main className="container">
        {/* Karşılama + hızlı çağrılar */}
        <section className="pt-6">
          <p className="eyebrow">Hoş geldiniz</p>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-tight">
            Keyfiniz <span className="text-gold italic">bizden</span>
          </h1>
          {table.calls_enabled && (
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {(["waiter", "coal", "bill"] as CallType[]).map((t) => {
                const pending = openCalls.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => call(t)}
                    disabled={calling !== null}
                    className={cn(
                      "card relative flex flex-col items-center gap-1.5 px-2 py-4 text-center transition active:scale-95",
                      t === "coal" && "border-ember-500/25 bg-gradient-to-b from-ember-500/10 to-transparent",
                      pending && "border-emerald-400/40",
                    )}
                  >
                    <span className="text-2xl">{CALL[t].emoji}</span>
                    <span className="text-[13px] font-semibold leading-tight text-smoke-100">{CALL[t].label}</span>
                    {pending && (
                      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        <Check className="h-3 w-3" /> İletildi
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {activeOrders.length > 0 && (
            <button
              onClick={() => setOrdersOpen(true)}
              className="card mt-4 flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/10 text-gold-200">
                <Receipt className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse-ring rounded-full bg-ember-400" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Siparişlerim ({activeOrders.length})</span>
                <span className="text-sm text-smoke-400">
                  Son durum: {STATUS[activeOrders[0].status].label}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-smoke-500" />
            </button>
          )}
          {!canOrder && (
            <p className="mt-4 rounded-2xl border border-gold-400/20 bg-gold-400/5 p-4 text-sm text-gold-100">
              Şu an QR ile sipariş alınmıyor. Menüye göz atıp garsonumuzu çağırabilirsiniz.
            </p>
          )}
        </section>

        <div className="mt-6">
          {menu ? (
            <MenuBrowser
              menu={menu}
              stickyTop={56}
              qtyOf={cart.qtyOf}
              onAdd={
                canOrder
                  ? (item, qty, n) => {
                      cart.add(item, qty, n);
                      toast.success(`${item.name} sepete eklendi`, { duration: 1200 });
                      navigator.vibrate?.(30);
                    }
                  : undefined
              }
            />
          ) : (
            <PageLoader />
          )}
        </div>
      </main>

      {/* Alt sepet çubuğu */}
      <AnimatePresence>
        {cart.count > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed inset-x-0 bottom-0 z-40 p-3 pb-safe"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="container flex h-16 items-center gap-4 rounded-2xl bg-gold-sheen px-5 text-night-950 shadow-glow"
            >
              <span className="relative">
                <ShoppingBag className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-night-950 px-1 text-[11px] font-bold text-gold-200">
                  {cart.count}
                </span>
              </span>
              <span className="flex-1 text-left font-semibold">Sepeti görüntüle</span>
              <span className="text-lg font-bold">{money(cart.total)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sepet */}
      <Modal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Sepetiniz"
        footer={
          <div className="space-y-3">
            <div className="flex items-center justify-between text-lg">
              <span className="text-smoke-300">Toplam</span>
              <span className="font-bold text-gold-200">{money(cart.total)}</span>
            </div>
            <Button size="lg" className="w-full" loading={sending} onClick={sendOrder} disabled={!cart.count}>
              Siparişi gönder · {table.name}
            </Button>
            <p className="text-center text-xs text-smoke-500">Ödeme masada, garsonumuza yapılır.</p>
          </div>
        }
      >
        {cart.lines.length === 0 ? (
          <p className="py-10 text-center text-smoke-400">Sepetiniz boş.</p>
        ) : (
          <div className="space-y-3">
            {cart.lines.map((l, i) => (
              <div key={`${l.id}-${l.note}`} className="flex items-center gap-3 rounded-2xl border hairline p-3">
                {l.image_url ? (
                  <img src={asset(l.image_url)!} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-night-700" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.name}</p>
                  {l.note && <p className="truncate text-xs text-smoke-400">Not: {l.note}</p>}
                  <p className="text-sm text-gold-200">{money(l.price * l.qty)}</p>
                </div>
                <div className="flex items-center rounded-xl border border-white/10">
                  <button className="p-2" onClick={() => cart.setQty(i, l.qty - 1)} aria-label="Azalt">
                    {l.qty === 1 ? <Trash2 className="h-4 w-4 text-wine-400" /> : <Minus className="h-4 w-4" />}
                  </button>
                  <span className="w-6 text-center font-bold">{l.qty}</span>
                  <button className="p-2" onClick={() => cart.setQty(i, l.qty + 1)} aria-label="Arttır">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <label className="block pt-2">
              <span className="label">Sipariş notu</span>
              <textarea
                className="input"
                rows={2}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mutfağa iletmek istediğiniz bir not var mı?"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Sipariş takibi */}
      <Modal open={ordersOpen} onClose={() => setOrdersOpen(false)} title="Siparişlerim">
        {orders.length === 0 ? (
          <p className="py-10 text-center text-smoke-400">Henüz siparişiniz yok.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <OrderTrackCard
                key={o.id}
                order={o}
                onCancel={async () => {
                  try {
                    await publicApi.cancelOwn(code, device, o.id);
                    toast("Sipariş iptal edildi");
                    track.reload();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            ))}
            <p className="text-center text-xs text-smoke-500">Durumlar otomatik güncellenir.</p>
          </div>
        )}
      </Modal>

      {/* Wi-Fi */}
      <Modal open={wifiOpen} onClose={() => setWifiOpen(false)} title="Wi-Fi" size="sm">
        <div className="space-y-4 text-center">
          <Wifi className="mx-auto h-10 w-10 text-gold-300" />
          <div>
            <p className="label">Ağ adı</p>
            <p className="text-xl font-semibold">{table.wifi_name}</p>
          </div>
          {table.wifi_pass && (
            <div>
              <p className="label">Şifre</p>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 font-mono text-xl"
                onClick={() => {
                  navigator.clipboard?.writeText(table.wifi_pass!);
                  toast.success("Şifre kopyalandı");
                }}
              >
                {table.wifi_pass} <Copy className="h-4 w-4 text-smoke-400" />
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function OrderTrackCard({ order, onCancel }: { order: Order; onCancel: () => void }) {
  const st = STATUS[order.status];
  const stepIdx = STEPS.indexOf(order.status);
  const closed = order.status === "paid" || order.status === "cancelled";
  const canCancel = order.status === "new" && Date.now() - new Date(order.created_at).getTime() < 120000;
  return (
    <div className={cn("rounded-2xl border hairline p-4", closed && "opacity-60")}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-2xl font-semibold">#{order.no}</p>
          <p className="text-xs text-smoke-500">{fmtTime(order.created_at)}</p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>
      </div>
      {!closed && (
        <div className="mt-4 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={cn("h-1.5 rounded-full transition-all duration-700", i <= stepIdx ? "bg-gold-300" : "bg-white/10")} />
              <p className={cn("mt-1.5 text-[11px]", i <= stepIdx ? "text-gold-200" : "text-smoke-500")}>{STATUS[s].label}</p>
            </div>
          ))}
        </div>
      )}
      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3 text-smoke-300">
            <span>
              {it.qty}× {it.name}
              {it.note && <span className="text-smoke-500"> · {it.note}</span>}
            </span>
            <span>{money(it.qty * it.unit_price)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t hairline pt-3">
        {canCancel ? (
          <button onClick={onCancel} className="text-sm text-wine-400 hover:underline">Siparişi iptal et</button>
        ) : (
          <span />
        )}
        <span className="font-bold text-gold-200">{money(order.total)}</span>
      </div>
    </div>
  );
}
