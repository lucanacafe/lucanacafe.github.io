import { useState } from "react";
import { Ban, Download, QrCode, Receipt, Wallet } from "lucide-react";
import { Button, PageLoader, Segmented } from "@/components/ui";
import { BarChart, RankBars, Stat } from "@/components/ui/charts";
import { useLive } from "@/hooks/useLive";
import { adminApi, type Report } from "@/lib/api/admin";
import { PAYMENT } from "@/lib/constants";
import { addDays, bizDay, fmtDay, money } from "@/lib/utils";

type Range = "today" | "7" | "30" | "custom";

function rangeOf(r: Range, custom: { from: string; to: string }) {
  const today = bizDay();
  if (r === "today") return { from: today, to: today };
  if (r === "7") return { from: addDays(today, -6), to: today };
  if (r === "30") return { from: addDays(today, -29), to: today };
  return custom;
}

function exportCsv(rep: Report, from: string, to: string) {
  const rows = [
    ["Gün", "Ciro (TL)", "Ödenen sipariş"],
    ...rep.by_day.map((d) => [d.day, String(d.revenue), String(d.orders)]),
    [],
    ["Ürün", "Adet", "Ciro (TL)"],
    ...rep.top_items.map((i) => [i.name, String(i.qty), String(i.revenue)]),
  ];
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `lucana-rapor-${from}_${to}.csv`;
  a.click();
}

export default function Reports() {
  const [range, setRange] = useState<Range>("7");
  const [custom, setCustom] = useState({ from: addDays(bizDay(), -6), to: bizDay() });
  const { from, to } = rangeOf(range, custom);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Bugün" },
            { value: "7", label: "7 gün" },
            { value: "30", label: "30 gün" },
            { value: "custom", label: "Özel" },
          ]}
        />
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" className="input h-9 w-auto" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <span className="text-smoke-500">–</span>
            <input type="date" className="input h-9 w-auto" value={custom.to} min={custom.from} max={bizDay()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
      </div>
      {/* key: aralık değişince bileşen yeniden kurulur ve veri yeniden çekilir */}
      <ReportBody key={`${from}_${to}`} from={from} to={to} />
    </div>
  );
}

function ReportBody({ from, to }: { from: string; to: string }) {
  const { data: rep, loading } = useLive(() => adminApi.report(from, to), { interval: 60000 });
  if (loading && !rep) return <PageLoader />;
  if (!rep) return null;
  const t = rep.totals;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-smoke-500">
          {fmtDay(from)}
          {from !== to && ` – ${fmtDay(to)}`} · iş günü 05:00'te başlar
        </p>
        <Button variant="subtle" size="sm" onClick={() => exportCsv(rep, from, to)}>
          <Download className="h-4 w-4" /> Excel (CSV)
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ciro" value={money(t.revenue)} hint={`${t.paid} ödenen sipariş`} icon={<Wallet className="h-5 w-5" />} />
        <Stat label="Ortalama adisyon" value={money(t.avg_ticket)} icon={<Receipt className="h-5 w-5" />} tone="emerald" />
        <Stat label="QR sipariş payı" value={`%${t.qr_share}`} hint={t.open ? `${t.open} açık sipariş` : undefined} icon={<QrCode className="h-5 w-5" />} tone="ember" />
        <Stat label="İptal" value={t.cancelled} hint={money(t.cancelled_total)} icon={<Ban className="h-5 w-5" />} tone="wine" />
      </div>

      {rep.by_day.length > 1 && (
        <section className="card p-5">
          <h2 className="mb-4 font-display text-xl font-semibold">Günlük ciro</h2>
          <BarChart
            data={rep.by_day.map((d) => ({
              label: rep.by_day.length > 14 ? d.day.slice(8) : fmtDay(d.day).split(" ").slice(0, 2).join(" "),
              value: Number(d.revenue),
              sub: `${d.orders} sip.`,
            }))}
            format={money}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-display text-xl font-semibold">En çok kazandıran ürünler</h2>
          {rep.top_items.length ? (
            <RankBars rows={rep.top_items.map((i) => ({ label: i.name, value: Number(i.revenue), extra: `${i.qty} adet` }))} format={money} />
          ) : (
            <p className="text-sm text-smoke-500">Veri yok.</p>
          )}
        </section>
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 font-display text-xl font-semibold">Kategoriler</h2>
            {rep.by_category.length ? (
              <RankBars rows={rep.by_category.map((c) => ({ label: c.name, value: Number(c.revenue), extra: `${c.qty} adet` }))} format={money} />
            ) : (
              <p className="text-sm text-smoke-500">Veri yok.</p>
            )}
          </section>
          <section className="card p-5">
            <h2 className="mb-4 font-display text-xl font-semibold">Ödeme yöntemi</h2>
            {rep.by_method.length ? (
              <RankBars rows={rep.by_method.map((m) => ({ label: PAYMENT[m.method] ?? m.method, value: Number(m.revenue), extra: `${m.orders} sip.` }))} format={money} />
            ) : (
              <p className="text-sm text-smoke-500">Veri yok.</p>
            )}
          </section>
        </div>
      </div>

      {rep.by_hour.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 font-display text-xl font-semibold">Saatlere göre yoğunluk</h2>
          <BarChart
            highlightLast={false}
            data={Array.from({ length: 24 }, (_, i) => (i + 10) % 24)
              .filter((h) => h >= 10 || h < 5)
              .map((h) => ({ label: String(h).padStart(2, "0"), value: rep.by_hour.find((x) => x.hour === h)?.orders ?? 0 }))}
            format={(n) => `${n} sipariş`}
            height={120}
          />
        </section>
      )}
    </>
  );
}
