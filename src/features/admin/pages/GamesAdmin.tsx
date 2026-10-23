import { useState } from "react";
import { Gift, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Badge, Button, Field, Modal, PageLoader } from "@/components/ui";
import { Stat } from "@/components/ui/charts";
import { useLive } from "@/hooks/useLive";
import { adminApi } from "@/lib/api/admin";
import { LEVEL } from "@/lib/constants";
import { cn, fmtDateTime, timeAgo } from "@/lib/utils";
import { useAuth } from "../auth";

const n = (x: number) => Number(x).toLocaleString("tr-TR");
const KIND: Record<string, string> = {
  farm_harvest: "Hasat",
  farm_help: "Sulama",
  skill_reward: "Blok",
  farm_plot: "Tarla aldı",
};

export default function GamesAdmin() {
  const { can } = useAuth();
  const { data, loading, reload } = useLive(adminApi.pool, { interval: 20000 });
  const [adj, setAdj] = useState<1 | -1 | null>(null);

  if (loading && !data) return <PageLoader />;
  if (!data) return null;
  // Oyunların net dağıttığı puan = ödenen − tohum/tarla olarak geri alınan
  const net = (s: typeof data.today) => s.harvest + s.help + s.blok - s.seeds - s.plots;

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center gap-5 bg-gradient-to-r from-emerald-500/15 to-transparent p-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-200">
          <Gift className="h-7 w-7" />
        </span>
        <div className="flex-1">
          <p className="eyebrow">Ödül havuzu</p>
          <p className="font-display text-5xl font-semibold text-gold">{n(data.balance)} <span className="text-2xl">puan</span></p>
          <p className="max-w-xl text-xs text-smoke-500">
            Oyunların (Bahçe hasadı, sulama teşekkürü, Blok ödülü) dağıttığı tüm puan bu havuzdan çıkar; tohum ve tarla bedelleri havuza
            döner. Havuz boşalınca oyunlar yalnızca tohum bedelini geri verir — böylece dağıtılan puanı siz kontrol edersiniz. Şans oyunu yoktur.
          </p>
        </div>
        {can(LEVEL.MANAGER) && (
          <div className="flex gap-2">
            <Button onClick={() => setAdj(1)}><Plus className="h-4 w-4" /> Havuza ekle</Button>
            <Button variant="subtle" onClick={() => setAdj(-1)}><Minus className="h-4 w-4" /> Çek</Button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Şu an büyüyen ürün" value={n(data.growing)} hint={`${data.farmers} çiftçi`} tone="emerald" />
        <Stat label="24 saat oyuncu" value={n(data.today.players)} hint={`hasat ${n(data.today.harvest)} · blok ${n(data.today.blok)}`} />
        <Stat label="24 saat net dağıtılan" value={n(net(data.today))} hint={`sulama ${n(data.today.help)} · tohum ${n(data.today.seeds)}`} tone="ember" />
        <Stat label="7 gün net dağıtılan" value={n(net(data.week))} hint={`${data.week.players} oyuncu`} />
      </div>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Son oyun hareketleri</h2>
          <Link to="/panel/ayarlar" className="text-sm text-gold-200 hover:underline">Günlük tavanlar → Ayarlar</Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-smoke-500">Henüz hareket yok.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto">
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-center gap-2 py-2 text-sm">
                <span>{r.avatar}</span>
                <span className="min-w-0 flex-1 truncate">
                  <b>{r.nickname}</b> <span className="text-smoke-500">{r.note ?? KIND[r.kind]}</span>
                </span>
                <Badge className="text-smoke-400">{KIND[r.kind] ?? r.kind}</Badge>
                <span className={cn("w-16 text-right font-semibold", r.delta > 0 ? "text-emerald-300" : "text-wine-400")}>
                  {r.delta > 0 ? "+" : ""}
                  {n(r.delta)}
                </span>
                <span className="w-14 text-right text-[11px] text-smoke-600">{timeAgo(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.ledger.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-display text-xl font-semibold">Havuz hareketleri (personel)</h2>
          <ul className="divide-y divide-white/5 text-sm">
            {data.ledger.map((l, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="w-32 text-xs text-smoke-500">{fmtDateTime(l.at)}</span>
                <span className="flex-1">{l.reason} <span className="text-xs text-smoke-500">{l.staff}</span></span>
                <Badge className={l.delta > 0 ? "text-emerald-300" : "text-wine-400"}>{l.delta > 0 ? "+" : ""}{n(l.delta)}</Badge>
                <span className="w-20 text-right text-xs text-smoke-500">{n(l.balance_after)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PoolModal dir={adj} onClose={() => setAdj(null)} onDone={reload} max={data.balance} />
    </div>
  );
}

function PoolModal({ dir, onClose, onDone, max }: { dir: 1 | -1 | null; onClose: () => void; onDone: () => void; max: number }) {
  const [amount, setAmount] = useState("10000");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={dir !== null}
      onClose={onClose}
      size="sm"
      title={dir === 1 ? "Ödül havuzuna puan ekle" : "Havuzdan puan çek"}
      footer={
        <Button
          className="w-full"
          loading={busy}
          onClick={async () => {
            const v = parseInt(amount, 10);
            if (!(v > 0)) return toast.error("Geçerli miktar girin");
            setBusy(true);
            try {
              const r = await adminApi.poolAdjust(v * (dir ?? 1), reason);
              toast.success(`Havuz: ${n(r.balance)} puan`);
              onDone();
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {dir === 1 ? "Ekle" : "Çek"}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[5000, 10000, 25000, 50000].map((v) => (
            <button key={v} onClick={() => setAmount(String(v))} className={cn("rounded-full border px-3 py-1 text-sm", amount === String(v) ? "border-gold-300 text-gold-100" : "border-white/10 text-smoke-300")}>
              {n(v)}
            </button>
          ))}
        </div>
        <Field label="Miktar (puan)" hint={dir === -1 ? `Çekilebilir: ${n(max)}` : "100 puan = 1 ₺ indirim değerindedir (varsayılan oranla)"}>
          <input className="input text-xl font-bold" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Açıklama">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Ekim ayı oyun bütçesi" />
        </Field>
      </div>
    </Modal>
  );
}
