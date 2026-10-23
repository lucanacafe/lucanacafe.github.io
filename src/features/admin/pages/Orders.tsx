import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Ban, ChefHat, Clock, Plus, QrCode, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Empty, PageLoader, Segmented } from "@/components/ui";
import { useLive } from "@/hooks/useLive";
import { adminApi } from "@/lib/api/admin";
import { LEVEL, PAYMENT, STATUS } from "@/lib/constants";
import { addDays, bizDay, cn, fmtDay, fmtTime, minutesSince, money } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";
import { useAuth } from "../auth";
import { usePulse } from "../pulse";
import { CancelDialog, NewOrderModal, PayDialog } from "../components/OrderDialogs";

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "new", title: "Yeni" },
  { status: "preparing", title: "Hazırlanıyor" },
  { status: "served", title: "Servis edildi" },
];

export default function Orders() {
  const [tab, setTab] = useState<"live" | "day">("live");
  const [newOpen, setNewOpen] = useState(false);
  const { can } = useAuth();
  const pulse = usePulse();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "live", label: "Canlı" },
            { value: "day", label: "Gün geçmişi" },
          ]}
        />
        {can(LEVEL.WAITER) && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni sipariş
          </Button>
        )}
      </div>

      {tab === "live" ? <LiveBoard /> : <DayHistory />}

      <NewOrderModal open={newOpen} onClose={() => setNewOpen(false)} onDone={pulse.reload} />
    </div>
  );
}

function LiveBoard() {
  const { orders, loading } = usePulse();
  if (loading && !orders.length) return <PageLoader />;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = orders.filter((o) => o.status === col.status);
        return (
          <section key={col.status} className="rounded-2xl border hairline bg-night-900/40 p-3">
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS[col.status].dot)} />
              <h2 className="font-display text-xl font-semibold">{col.title}</h2>
              <span className="ml-auto rounded-full bg-white/5 px-2 text-sm text-smoke-400">{list.length}</span>
            </header>
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {list.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </AnimatePresence>
              {list.length === 0 && <p className="py-8 text-center text-sm text-smoke-600">Boş</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function OrderCard({ order, compact }: { order: Order; compact?: boolean }) {
  const { can } = useAuth();
  const { reload } = usePulse();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const mins = minutesSince(order.created_at);
  const late = order.status !== "served" && mins >= 15;
  const next: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
    new: { to: "preparing", label: "Hazırlamaya al" },
    preparing: { to: "served", label: "Servis edildi" },
  };
  const step = next[order.status];

  async function move(to: OrderStatus) {
    setBusy(true);
    try {
      await adminApi.setStatus(order.id, to);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn("card p-4", order.status === "new" && "border-ember-500/35 shadow-ember")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold">#{order.no}</span>
            <span className="rounded-lg bg-gold-400/10 px-2 py-0.5 text-sm font-semibold text-gold-100">{order.table_label ?? "—"}</span>
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-smoke-500">
            {order.source === "qr" ? <QrCode className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {order.source === "qr" ? "QR" : order.created_by}
            <span>·</span>
            <Clock className="h-3 w-3" /> {fmtTime(order.created_at)}
          </p>
        </div>
        <span className={cn("rounded-lg px-2 py-1 text-xs font-bold", late ? "bg-wine-500/20 text-wine-400" : "bg-white/5 text-smoke-300")}>
          {mins} dk
        </span>
      </div>
      <ul className="mt-3 space-y-1">
        {order.items.map((it) => (
          <li key={it.id ?? it.name} className="text-[15px]">
            <span className="font-bold text-gold-200">{it.qty}×</span> {it.name}
            {it.note && <span className="block pl-6 text-xs text-ember-300">↳ {it.note}</span>}
          </li>
        ))}
      </ul>
      {order.note && <p className="mt-2 rounded-lg bg-ember-500/10 px-2.5 py-1.5 text-sm text-ember-200">📝 {order.note}</p>}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t hairline pt-3">
          <span className="mr-auto whitespace-nowrap font-bold text-gold-100">{money(order.total)}</span>
          {can(LEVEL.CASHIER) && (
            <>
              <button onClick={() => setCancelOpen(true)} className="rounded-lg p-2 text-smoke-500 hover:bg-wine-500/10 hover:text-wine-400" title="İptal">
                <Ban className="h-4 w-4" />
              </button>
              <Button size="sm" variant="subtle" onClick={() => setPayOpen(true)}>
                <Wallet className="h-4 w-4" /> Öde
              </Button>
            </>
          )}
          {step && (
            <Button size="sm" className="w-full" loading={busy} onClick={() => move(step.to)} variant={order.status === "new" ? "ember" : "gold"}>
              {order.status === "new" ? <ChefHat className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {step.label}
            </Button>
          )}
        </div>
      )}
      <PayDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Sipariş #${order.no} ödemesi`}
        amount={Number(order.total)}
        onConfirm={async (m) => {
          await adminApi.setStatus(order.id, "paid", m);
          toast.success(`#${order.no} ödendi (${PAYMENT[m]})`);
          await reload();
        }}
      />
      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (r) => {
          await adminApi.setStatus(order.id, "cancelled", undefined, r);
          toast(`#${order.no} iptal edildi`);
          await reload();
        }}
      />
    </motion.article>
  );
}

function DayHistory() {
  const [day, setDay] = useState(bizDay());
  const { can } = useAuth();
  const { data, loading } = useLive(() => adminApi.orders("day", day), { interval: 30000 });
  const list = data ?? [];
  const paid = list.filter((o) => o.status === "paid");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="subtle" size="sm" onClick={() => setDay(addDays(day, -1))}>← Önceki</Button>
        <input type="date" className="input h-9 w-auto" value={day} max={bizDay()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <Button variant="subtle" size="sm" disabled={day >= bizDay()} onClick={() => setDay(addDays(day, 1))}>Sonraki →</Button>
        <span className="ml-auto text-sm text-smoke-400">
          {fmtDay(day)} · {list.length} sipariş
          {can(LEVEL.CASHIER) && <> · tahsilat <b className="text-gold-200">{money(paid.reduce((s, o) => s + Number(o.total), 0))}</b></>}
        </span>
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : list.length === 0 ? (
        <Empty title="Bu gün için sipariş yok" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-night-900/60 text-left text-xs uppercase tracking-wider text-smoke-500">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Saat</th>
                  <th className="px-4 py-3">Masa</th>
                  <th className="px-4 py-3">Ürünler</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.map((o) => (
                  <tr key={o.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold">#{o.no}</td>
                    <td className="px-4 py-3 text-smoke-400">{fmtTime(o.created_at)}</td>
                    <td className="px-4 py-3">{o.table_label ?? "—"}</td>
                    <td className="max-w-xs px-4 py-3 text-smoke-300">
                      <span className="line-clamp-2">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span>
                      {o.cancel_reason && <span className="text-xs text-wine-400">İptal: {o.cancel_reason}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                      {o.payment_method && <span className="ml-1 text-xs text-smoke-500">{PAYMENT[o.payment_method]}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
