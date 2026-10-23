import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Droplets, Lock, Plus, Sprout, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Modal, PageLoader } from "@/components/ui";
import { useMember } from "@/features/member/MemberContext";
import { farmApi, type Crop, type Farm, type Neighbor, type Plot } from "@/lib/api/member";
import { cn } from "@/lib/utils";
import { fmt, GamePage, useGameInfo, useSyncPoints } from "./shared";
import { CropSprite, stageCol, tileBg } from "./farmArt";

function dur(secs: number) {
  if (secs <= 0) return "hazır";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h) return m ? `${h} sa ${m} dk` : `${h} sa`;
  if (m) return s ? `${m} dk ${s.toString().padStart(2, "0")} sn` : `${m} dk`;
  return `${s} sn`;
}

export default function FarmGame() {
  const { owner } = useParams();
  const { member } = useMember();
  const sync = useSyncPoints();
  const { info, reload: reloadInfo } = useGameInfo();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [planting, setPlanting] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, tick] = useState(0);
  const offset = useRef(0);
  const visiting = Boolean(owner && owner !== member?.id);

  const apply = useCallback((f: Farm) => {
    offset.current = Date.now() - new Date(f.server_now).getTime();
    setFarm(f);
  }, []);

  const load = useCallback(() => {
    if (!member) return;
    farmApi.state(visiting ? owner : undefined).then(apply).catch((e) => toast.error(e.message));
    if (!visiting) farmApi.neighbors().then(setNeighbors).catch(() => {});
  }, [member, owner, visiting, apply]);

  useEffect(() => {
    farmApi.crops().then(setCrops).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now() - offset.current;
  const cropOf = useMemo(() => Object.fromEntries(crops.map((c) => [c.key, c])), [crops]);
  const readyCount = farm?.plots.filter((p) => p.crop && p.ready_at && new Date(p.ready_at).getTime() <= now).length ?? 0;

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function harvest(idx?: number) {
    const r = await run(`h${idx ?? "all"}`, () => farmApi.harvest(idx));
    if (!r) return;
    apply(r.farm);
    sync(r.points);
    reloadInfo();
    toast.success(r.points_gained ? `+${fmt(r.points_gained)} ⭐ hasat ettin!` : "Hasat edildi (bugünkü ödül tavanı doldu)", {
      description: r.level_up ? `🎉 Seviye atladın! Artık seviye ${r.level}` : undefined,
    });
    navigator.vibrate?.(r.level_up ? [80, 50, 80, 50, 160] : 60);
  }

  async function plant(crop: Crop) {
    if (planting === null) return;
    const r = await run(`p${crop.key}`, () => farmApi.plant(planting, crop.key));
    if (!r) return;
    apply(r);
    setPlanting(null);
    if (crop.cost) sync((member?.points ?? 0) - crop.cost);
    toast.success(`${crop.name} ekildi 🌱`, { description: `${dur(crop.grow_secs)} sonra ${crop.yield} ⭐` });
  }

  async function water(p: Plot) {
    if (!farm) return;
    const r = await run(`w${p.idx}`, () => farmApi.water(farm.owner.id, p.idx));
    if (!r) return;
    apply(r.farm);
    sync(r.points);
    reloadInfo();
    toast.success(r.reward ? `💧 Suladın! +${r.reward} ⭐ teşekkür` : "💧 Suladın! (bugünkü teşekkür tavanı doldu)");
  }

  async function buyPlot() {
    if (!farm?.plot_price) return;
    if (!confirm(`Yeni tarla ${fmt(farm.plot_price)} puan. Alınsın mı?`)) return;
    const r = await run("buy", () => farmApi.buyPlot());
    if (!r) return;
    apply(r);
    sync((member?.points ?? 0) - (farm.plot_price ?? 0));
    toast.success("🌱 Yeni tarla açıldı!");
  }

  const o = farm?.owner;
  const prevLevelXp = o ? Math.pow(o.level - 1, 2) * 100 : 0;
  const pct = o ? Math.min(100, ((o.xp - prevLevelXp) / Math.max(1, o.next_level_xp - prevLevelXp)) * 100) : 0;

  return (
    <GamePage
      title={visiting && o ? `${o.nickname}'in bahçesi` : "Lucana Bahçesi"}
      emoji="🌱"
      back={visiting ? "/oyun/bahce" : "/oyun"}
      rules={
        <>
          <b>Şans yok, bahis yok.</b> Tohum ek, süre dolunca hasat et — ne kadar puan alacağın baştan belli. Bazı tohumlar ücretsiz
          (Buğday), bazıları puanla alınır ve hasatta fazlasıyla döner. Komşularının büyüyen ürünlerini <b>sula</b>: onların ürünü %15
          hızlanır, sana teşekkür puanı gelir. Hasat ettikçe seviye atlar, yeni ürünlerin kilidini açarsın.
          {info && ` Günlük hasat kârı tavanı: ${fmt(info.farm_cap)} puan.`}
        </>
      }
    >
      {!farm ? (
        <PageLoader />
      ) : (
        <>
          {/* sahip kartı */}
          <div className="card flex items-center gap-4 bg-gradient-to-r from-emerald-500/15 to-transparent p-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-night-800 text-3xl">{o!.avatar}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200">Seviye {o!.level}</span>
                <span className="truncate text-sm text-smoke-400">{fmt(o!.xp)} / {fmt(o!.next_level_xp)} XP</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-gold-300" animate={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {!visiting && readyCount > 0 && (
            <Button size="lg" className="mt-3 w-full" loading={busy === "hall"} onClick={() => harvest()}>
              🧺 Hepsini topla ({readyCount})
            </Button>
          )}

          {/* tarlalar */}
          <div
            className="mt-4 grid grid-cols-3 gap-2.5 rounded-3xl border-4 border-[#5a3b22] p-3 shadow-[inset_0_0_0_2px_rgba(0,0,0,.35)]"
            style={tileBg("grass", 40)}
          >
            {farm.plots.map((p) => (
              <PlotTile
                key={p.idx}
                plot={p}
                crop={p.crop ? cropOf[p.crop] : undefined}
                now={now}
                visiting={visiting}
                busy={busy}
                onPlant={() => setPlanting(p.idx)}
                onHarvest={() => harvest(p.idx)}
                onWater={() => water(p)}
              />
            ))}
            {!visiting && farm.plot_price && (
              <button
                onClick={buyPlot}
                disabled={busy === "buy"}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/40 bg-black/25 text-white hover:bg-black/35"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-semibold">Yeni tarla</span>
                <span className="text-[11px] text-gold-200">{fmt(farm.plot_price)} ⭐</span>
              </button>
            )}
          </div>

          {/* komşular */}
          {!visiting && (
            <section className="mt-6">
              <h2 className="eyebrow mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" /> Komşular — sula, puan kazan
              </h2>
              {info && (
                <p className="mb-2 text-xs text-smoke-500">
                  Bugünkü teşekkür puanın: {fmt(info.help_today)} / {fmt(info.help_cap)}
                </p>
              )}
              {neighbors.length === 0 ? (
                <p className="card p-4 text-center text-sm text-smoke-500">Henüz komşu yok. Masadakileri bahçe kurmaya davet et! 🌱</p>
              ) : (
                <ul className="card divide-y divide-white/5">
                  {neighbors.map((n) => (
                    <li key={n.id}>
                      <Link to={`/oyun/bahce/${n.id}`} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-2xl">{n.avatar}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{n.nickname}</span>
                          <span className="text-xs text-smoke-500">
                            Seviye {n.level}
                            {n.at_table && <span className="text-emerald-300"> · şu an {n.at_table}</span>}
                          </span>
                        </span>
                        {n.waterable > 0 ? (
                          <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-200">
                            <Droplets className="h-3.5 w-3.5" /> {n.waterable}
                          </span>
                        ) : (
                          <span className="text-xs text-smoke-600">ziyaret et</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {visiting && (
            <p className="mt-5 text-center text-sm text-smoke-500">
              💧 işaretli ürünleri sula; komşun daha erken hasat eder, sen de teşekkür puanı alırsın.
            </p>
          )}
        </>
      )}

      {/* ekim menüsü */}
      <Modal open={planting !== null} onClose={() => setPlanting(null)} title="Ne ekelim?">
        <div className="space-y-2">
          {crops.map((c) => {
            const locked = (o?.level ?? 1) < c.min_level;
            const poor = (member?.points ?? 0) < c.cost;
            return (
              <button
                key={c.key}
                disabled={locked || poor || busy !== null}
                onClick={() => plant(c)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                  locked || poor ? "border-white/5 opacity-50" : "border-white/10 hover:border-emerald-400/40",
                )}
              >
                <CropSprite row={c.sprite_row} col={0} className="h-12 w-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-semibold">{c.name}</span>
                  <span className="text-xs text-smoke-400">
                    ⏱ {dur(c.grow_secs)} · {c.cost ? `${c.cost} ⭐ → ` : "Ücretsiz → "}
                    <b className="text-emerald-300">{c.yield} ⭐</b>
                  </span>
                </span>
                {locked ? (
                  <span className="flex items-center gap-1 text-xs text-smoke-500">
                    <Lock className="h-3.5 w-3.5" /> Sv.{c.min_level}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-200">+{c.yield - c.cost}</span>
                )}
              </button>
            );
          })}
          <p className="pt-2 text-center text-xs text-smoke-500">Bakiye: ⭐ {fmt(member?.points ?? 0)}</p>
        </div>
      </Modal>
    </GamePage>
  );
}

function PlotTile({
  plot,
  crop,
  now,
  visiting,
  busy,
  onPlant,
  onHarvest,
  onWater,
}: {
  plot: Plot;
  crop?: Crop;
  now: number;
  visiting: boolean;
  busy: string | null;
  onPlant: () => void;
  onHarvest: () => void;
  onWater: () => void;
}) {
  const frame = "relative flex aspect-square flex-col items-center justify-end overflow-hidden rounded-xl border-2 border-[#3d2716] shadow-[0_3px_0_#2a1b11]";
  if (!plot.crop || !crop) {
    return (
      <button disabled={visiting} onClick={onPlant} className={cn(frame, "justify-center", !visiting && "hover:brightness-110")} style={tileBg("soil", 36)}>
        {!visiting && (
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold text-white">
            <Sprout className="h-3.5 w-3.5 text-emerald-300" /> Ek
          </span>
        )}
      </button>
    );
  }
  const ready = new Date(plot.ready_at!).getTime();
  const total = (plot.grow_secs ?? 1) * 1000;
  const left = Math.max(0, (ready - now) / 1000);
  const progress = Math.min(1, Math.max(0, 1 - (left * 1000) / total));
  const isReady = left <= 0;
  const canWater = visiting && !isReady && !plot.watered_by_me && plot.waters < 5;
  const row = crop.sprite_row;

  return (
    <motion.button
      layout
      onClick={isReady && !visiting ? onHarvest : canWater ? onWater : undefined}
      className={cn(frame, isReady && "ring-2 ring-gold-300 ring-offset-2 ring-offset-transparent")}
      style={tileBg(plot.waters > 0 ? "soil-wet" : "soil", 36)}
    >
      <motion.span
        key={stageCol(progress, isReady)}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={isReady ? { scale: [1, 1.08, 1], y: [0, -3, 0], opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={isReady ? { repeat: Infinity, duration: 1.4 } : { duration: 0.35 }}
        className="absolute inset-[8%]"
      >
        <CropSprite row={row} col={stageCol(progress, isReady)} className="h-full w-full drop-shadow-[0_2px_0_rgba(0,0,0,.35)]" />
      </motion.span>
      <span
        className={cn(
          "relative mb-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
          isReady ? "bg-gold-300 text-night-950" : "bg-black/55 text-white",
        )}
      >
        {isReady ? (visiting ? "Hazır" : busy === `h${plot.idx}` ? "…" : "Topla!") : dur(left)}
      </span>
      {!isReady && (
        <span className="absolute inset-x-1.5 bottom-0.5 h-1 overflow-hidden rounded-full bg-black/50">
          <span className="block h-full bg-emerald-400" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
      {plot.waters > 0 && (
        <span className="absolute right-1 top-1 rounded-full bg-sky-600/80 px-1.5 text-[10px] font-bold text-white">💧{plot.waters}</span>
      )}
      {canWater && (
        <span className="absolute left-1 top-1 animate-pulse rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">
          {busy === `w${plot.idx}` ? "…" : "Sula"}
        </span>
      )}
    </motion.button>
  );
}
