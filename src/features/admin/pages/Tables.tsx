import { useState } from "react";
import { Check, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button, Empty, Modal, PageLoader } from "@/components/ui";
import { useLive } from "@/hooks/useLive";
import { adminApi, type LiveTable } from "@/lib/api/admin";
import { CALL, LEVEL, PAYMENT } from "@/lib/constants";
import { cn, minutesSince, money, timeAgo } from "@/lib/utils";
import { useAuth } from "../auth";
import { usePulse } from "../pulse";
import { NewOrderModal, PayDialog } from "../components/OrderDialogs";
import { OrderCard } from "./Orders";

export default function Tables() {
  const { calls, orders, reload: reloadPulse } = usePulse();
  const live = useLive(adminApi.tablesLive, { topic: "lucana-staff", interval: 15000 });
  const [sel, setSel] = useState<LiveTable | null>(null);

  if (live.loading && !live.data) return <PageLoader />;
  const tables = live.data ?? [];
  const areas = [...new Set(tables.map((t) => t.area))];
  const callsOf = (id: string) => calls.filter((c) => c.table_id === id);

  return (
    <div className="space-y-6">
      {calls.length > 0 && (
        <section className="card border-ember-500/30 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold text-ember-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ember-400" /> Bekleyen çağrılar
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {calls.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-night-900/60 p-3">
                <span className="text-2xl">{CALL[c.type].emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.table_name} · {CALL[c.type].short}</p>
                  <p className={cn("text-xs", minutesSince(c.created_at) >= 3 ? "text-wine-400" : "text-smoke-500")}>{timeAgo(c.created_at)}</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await adminApi.callDone(c.id).catch((e) => toast.error(e.message));
                    reloadPulse();
                  }}
                >
                  <Check className="h-4 w-4" /> Tamam
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tables.length === 0 && <Empty title="Henüz masa yok" text="Masa & QR sayfasından masa ekleyin." />}

      {areas.map((area) => (
        <section key={area}>
          <h2 className="eyebrow mb-3">{area}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tables
              .filter((t) => t.area === area)
              .map((t) => {
                const busy = t.open_orders > 0;
                const tc = callsOf(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSel(t)}
                    className={cn(
                      "card relative flex min-h-[112px] flex-col p-4 text-left transition hover:border-gold-400/30",
                      busy && "border-gold-400/30 bg-gradient-to-br from-gold-400/10 to-transparent",
                      tc.length > 0 && "border-ember-500/50",
                    )}
                  >
                    <span className="font-display text-2xl font-semibold">{t.name}</span>
                    {t.people_count > 0 && (
                      <span className="mt-1 flex items-center gap-1 text-xs text-emerald-300">
                        <span className="flex -space-x-1.5">
                          {t.people.slice(0, 4).map((p) => (
                            <span key={p.id} className="flex h-5 w-5 items-center justify-center rounded-full bg-night-700 text-[11px] ring-1 ring-night-800">{p.avatar}</span>
                          ))}
                        </span>
                        {t.people_count} kişi
                      </span>
                    )}
                    {busy ? (
                      <>
                        <span className="mt-auto text-lg font-bold text-gold-200">{money(t.open_total)}</span>
                        <span className="text-xs text-smoke-400">{t.open_orders} sipariş · {t.since && timeAgo(t.since)}</span>
                      </>
                    ) : (
                      <span className="mt-auto text-sm text-smoke-500">Boş</span>
                    )}
                    {tc.length > 0 && (
                      <span className="absolute right-3 top-3 flex gap-0.5 text-lg">
                        {tc.map((c) => <span key={c.id}>{CALL[c.type].emoji}</span>)}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </section>
      ))}

      {sel && (
        <TableDetail
          table={sel}
          onClose={() => setSel(null)}
          orders={orders.filter((o) => o.table_id === sel.id)}
          onChanged={() => {
            live.reload();
            reloadPulse();
          }}
        />
      )}
    </div>
  );
}

function TableDetail({
  table,
  orders,
  onClose,
  onChanged,
}: {
  table: LiveTable;
  orders: ReturnType<typeof usePulse>["orders"];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const { calls } = usePulse();
  const [payOpen, setPayOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const total = orders.reduce((s, o) => s + Number(o.total), 0);
  const tc = calls.filter((c) => c.table_id === table.id);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`${table.name} · ${table.area}`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-lg">
              Açık hesap: <b className="text-gold-200">{money(total)}</b>
            </span>
            {can(LEVEL.WAITER) && (
              <Button variant="subtle" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4" /> Sipariş ekle
              </Button>
            )}
            {can(LEVEL.CASHIER) && orders.length > 0 && (
              <Button onClick={() => setPayOpen(true)}>
                <Receipt className="h-4 w-4" /> Hesabı kapat
              </Button>
            )}
          </div>
        }
      >
        {tc.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tc.map((c) => (
              <span key={c.id} className="rounded-full bg-ember-500/15 px-3 py-1 text-sm text-ember-200">
                {CALL[c.type].emoji} {CALL[c.type].label} · {timeAgo(c.created_at)}
              </span>
            ))}
          </div>
        )}
        {table.people_count > 0 && (
          <div className="mb-4 rounded-2xl border hairline p-3">
            <p className="label">Masadakiler ({table.people_count})</p>
            <div className="flex flex-wrap gap-2">
              {table.people.map((p) => (
                <span key={p.id} className="rounded-full bg-white/5 px-3 py-1 text-sm">
                  {p.avatar} {p.nickname} <span className="text-xs text-gold-200">⭐{p.points}</span>
                  <span className="ml-1 text-xs text-smoke-500">{timeAgo(p.since)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {orders.length === 0 ? (
          <Empty title="Açık sipariş yok" text="Masa şu an boş görünüyor." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </Modal>
      <PayDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`${table.name} hesabı`}
        amount={total}
        onConfirm={async (m) => {
          const r = await adminApi.closeTable(table.id, m);
          toast.success(`${table.name} kapatıldı: ${money(r.total)} (${PAYMENT[m]})`);
          onChanged();
          onClose();
        }}
      />
      <NewOrderModal open={newOpen} onClose={() => setNewOpen(false)} presetTable={table.id} onDone={onChanged} />
    </>
  );
}
