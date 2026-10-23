import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BellRing, ClipboardList, Table2, TrendingUp, Wallet } from "lucide-react";
import { BarChart, RankBars, Stat } from "@/components/ui/charts";
import { Empty, PageLoader } from "@/components/ui";
import { useLive } from "@/hooks/useLive";
import { adminApi } from "@/lib/api/admin";
import { CALL, LEVEL, STATUS } from "@/lib/constants";
import { cn, fmtDay, money, timeAgo } from "@/lib/utils";
import { useAuth } from "../auth";
import { usePulse } from "../pulse";

export default function Dashboard() {
  const { user, can } = useAuth();
  const { orders, calls } = usePulse();
  const { data, loading } = useLive(adminApi.overview, { topic: "lucana-staff", interval: 30000 });

  if (loading && !data) return <PageLoader />;
  if (!data) return null;
  const money_ = can(LEVEL.CASHIER);
  const hour = new Date().getHours();
  const greet = hour < 5 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{fmtDay(data.biz_day)}</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">
          {greet}, <span className="text-gold">{user!.full_name.split(" ")[0]}</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {money_ ? (
          <Stat label="Bugünkü ciro" value={money(data.today.revenue)} hint={`Ort. adisyon ${money(data.today.avg_ticket)}`} icon={<Wallet className="h-5 w-5" />} />
        ) : (
          <Stat label="Bugün sipariş" value={data.today.orders} icon={<ClipboardList className="h-5 w-5" />} />
        )}
        <Stat
          label="Aktif sipariş"
          value={data.active.new + data.active.preparing + data.active.served}
          hint={`${data.active.new} yeni · ${data.active.preparing} hazırlanıyor · ${data.active.served} serviste`}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="ember"
        />
        <Stat
          label="Dolu masa"
          value={`${data.tables_busy}/${data.tables_total}`}
          hint={money_ ? `Açık hesap ${money(data.today.open_total)}` : undefined}
          icon={<Table2 className="h-5 w-5" />}
          tone="emerald"
        />
        <Stat
          label="Açık çağrı"
          value={data.calls_open}
          hint={`Bugün ${data.today.orders} sipariş · ${data.today.cancelled} iptal`}
          icon={<BellRing className="h-5 w-5" />}
          tone={data.calls_open ? "wine" : "gold"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {money_ && data.week && (
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <TrendingUp className="h-5 w-5 text-gold-300" /> Son 7 gün
                </h2>
                <Link to="/panel/rapor" className="text-sm text-gold-200 hover:underline">Detaylı rapor</Link>
              </div>
              <BarChart
                data={data.week.map((d) => ({ label: fmtDay(d.day).split(" ")[0], value: Number(d.revenue), sub: `${d.orders} sip.` }))}
                format={money}
              />
            </section>
          )}

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Canlı siparişler</h2>
              <Link to="/panel/siparisler" className="flex items-center gap-1 text-sm text-gold-200 hover:underline">
                Tümü <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {orders.length === 0 ? (
              <p className="py-6 text-center text-sm text-smoke-500">Şu an aktif sipariş yok.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {orders.slice(-8).reverse().map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-2.5">
                    <span className={cn("h-2 w-2 rounded-full", STATUS[o.status].dot)} />
                    <span className="w-12 font-semibold">#{o.no}</span>
                    <span className="flex-1 truncate text-sm text-smoke-300">
                      {o.table_label ?? "—"} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                    </span>
                    <span className="text-xs text-smoke-500">{timeAgo(o.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {calls.length > 0 && (
            <section className="card border-ember-500/30 p-5">
              <h2 className="mb-3 font-display text-xl font-semibold text-ember-300">Bekleyen çağrılar</h2>
              <ul className="space-y-2">
                {calls.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span>{CALL[c.type].emoji} {c.table_name} · {CALL[c.type].short}</span>
                    <span className="text-xs text-smoke-500">{timeAgo(c.created_at)}</span>
                  </li>
                ))}
              </ul>
              <Link to="/panel/masalar" className="mt-3 block text-sm text-gold-200 hover:underline">Masalara git →</Link>
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-4 font-display text-xl font-semibold">Bugün en çok satanlar</h2>
            {data.top_today.length ? (
              <RankBars rows={data.top_today.map((t) => ({ label: t.name, value: t.qty }))} format={(n) => `${n} adet`} />
            ) : (
              <p className="text-sm text-smoke-500">Henüz satış yok.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
              <AlertTriangle className="h-5 w-5 text-ember-400" /> Kritik stok
            </h2>
            {data.low_stock.length === 0 ? (
              <Empty title="Her şey yolunda" text="Kritik seviyede ürün yok." />
            ) : (
              <ul className="space-y-2">
                {data.low_stock.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{s.name}</span>
                    <span className={cn("shrink-0 font-semibold", Number(s.qty) <= 0 ? "text-wine-400" : "text-ember-300")}>
                      {Number(s.qty)} {s.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {can(LEVEL.WAITER) && (
              <Link to="/panel/stok" className="mt-3 block text-sm text-gold-200 hover:underline">Stoğa git →</Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
