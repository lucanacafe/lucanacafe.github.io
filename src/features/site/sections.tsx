import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Gamepad2, QrCode, Sparkles, Star, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { LiveFeed } from "@/components/customer/LiveFeed";
import { memberApi, type BoardRow } from "@/lib/api/member";
import { cn } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
} as const;

/** Sayaç animasyonu */
function Count({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1200);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v.toLocaleString("tr-TR")}</>;
}

export function StatsStrip() {
  const [s, setS] = useState<Awaited<ReturnType<typeof memberApi.stats>> | null>(null);
  useEffect(() => {
    memberApi.stats().then(setS).catch(() => {});
  }, []);
  if (!s) return null;
  const items = [
    { v: s.here_now, l: "şu an burada", e: "🔥", live: true },
    { v: s.orders_today, l: "bugün sipariş", e: "🛎️" },
    { v: s.members, l: "Lucana üyesi", e: "👥" },
    { v: s.points_given, l: "puan dağıtıldı", e: "⭐" },
  ];
  return (
    <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.l} className="glass rounded-2xl px-4 py-3">
          <p className="flex items-center gap-1.5 font-display text-3xl font-semibold text-gold-100">
            {i.e} <Count to={i.v} />
            {i.live && <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
          </p>
          <p className="text-xs text-smoke-400">{i.l}</p>
        </div>
      ))}
    </div>
  );
}

/** Canlı akış + liderlik önizlemesi */
export function LiveSection() {
  const [top, setTop] = useState<BoardRow[]>([]);
  useEffect(() => {
    memberApi.leaderboard("week").then((r) => setTop(r.rows.slice(0, 5))).catch(() => {});
  }, []);
  return (
    <section className="container py-20">
      <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Canlı
          </p>
          <h2 className="mt-3 font-display text-5xl font-semibold md:text-6xl">
            Şu an <span className="text-gold italic">Lucana'da</span>
          </h2>
        </div>
        <Link to="/liderler" className="group flex items-center gap-2 text-gold-200">
          Liderlik tablosu <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      </motion.div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <motion.div {...fadeUp} className="card p-4 md:p-5">
          <LiveFeed limit={7} />
          <EmptyFeedHint />
        </motion.div>
        <motion.div {...fadeUp} className="card p-5">
          <h3 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Trophy className="h-5 w-5 text-gold-300" /> Haftanın yıldızları
          </h3>
          {top.length === 0 ? (
            <p className="mt-6 text-sm text-smoke-400">Bu hafta liderlik boş — ilk siparişinle zirveye otur! 👑</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {top.map((r, i) => (
                <li key={r.nickname} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", i === 0 ? "bg-gold-400/15" : "bg-white/[0.03]")}>
                  <span className="w-6 text-center text-lg">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                  <span className="text-xl">{r.avatar}</span>
                  <span className="flex-1 truncate font-semibold">{r.nickname}</span>
                  <span className="text-sm font-bold text-gold-200">{r.score.toLocaleString("tr-TR")}</span>
                </li>
              ))}
            </ol>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function EmptyFeedHint() {
  return (
    <p className="mt-3 text-center text-xs text-smoke-600">
      Masadaki QR'ı okut, sen de akışta görün · istersen <Link to="/profil" className="underline">görünmez mod</Link>
    </p>
  );
}

/** Puan programı */
export function LoyaltySection() {
  const steps = [
    { i: QrCode, t: "QR'ı okut", d: "Tek dokunuşla hesabın açılır. Form yok, şifre yok." },
    { i: Star, t: "Puan topla", d: "Her 1 ₺'lik siparişe 10 puan. Ödeyince anında hesabında." },
    { i: Sparkles, t: "İndirime çevir", d: "100 puan = 1 ₺. Sepette kaydır, indirimi kap." },
    { i: Gamepad2, t: "Oyna, kazan", d: "Lucana Bahçesi'nde hasat et, Blok'ta rekor kır — ekstra puan topla." },
  ];
  return (
    <section className="border-y hairline bg-[linear-gradient(135deg,rgba(196,143,53,.08),transparent_50%,rgba(142,27,44,.08))]">
      <div className="container py-20">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Lucana Puan</p>
          <h2 className="mt-3 font-display text-5xl font-semibold md:text-6xl">
            Ye, iç, <span className="text-gold italic">puan topla</span>
          </h2>
          <p className="mt-4 text-smoke-300">Harcadığının %10'u puan olarak geri döner.</p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div key={s.t} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="card relative overflow-hidden p-6">
              <span className="absolute -right-2 -top-4 font-display text-8xl text-white/[0.04]">{i + 1}</span>
              <s.i className="h-8 w-8 text-gold-300" />
              <h3 className="mt-4 font-display text-2xl font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-smoke-400">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Oyun köşesi tanıtımı (şans oyunu yok) */
export function GamesTeaser() {
  const crops = ["🌿", "🍓", "🍋", "🍎", "🍈", "☕", "🫖", "🌱", "🧺"];
  return (
    <section className="container py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <p className="eyebrow text-emerald-300">Oyun köşesi</p>
          <h2 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
            Çayın demlenirken <br />
            <span className="text-gold italic">bahçeni büyüt.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg text-smoke-300">
            Lucana Bahçesi'nde nane, çilek, kahve, çay ek; hasat et, seviye atla. Masadaki arkadaşlarının bahçesini sula, birlikte büyüyün.
            Ya da Lucana Blok'ta haftanın rekorunu kır.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/oyun/bahce">
              <Button size="lg">
                <Gamepad2 className="h-5 w-5" /> Bahçeme git
              </Button>
            </Link>
            <Link to="/liderler">
              <Button size="lg" variant="outline">
                <Users className="h-5 w-5" /> Liderler
              </Button>
            </Link>
          </div>
        </motion.div>
        <motion.div {...fadeUp} className="card bg-gradient-to-br from-emerald-500/15 to-transparent p-5">
          <div className="grid grid-cols-3 gap-3">
            {crops.map((c, i) => (
              <div key={i} className="flex aspect-square items-center justify-center rounded-2xl border border-white/5 bg-[radial-gradient(circle_at_50%_70%,#4a3220,#2a1b11)]">
                <motion.span
                  className="text-4xl"
                  animate={{ scale: [0.85, 1.1, 0.85], y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.25 }}
                >
                  {c}
                </motion.span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-smoke-300">🧱 Lucana Blok · haftalık rekor</span>
            <Link to="/oyun/blok" className="font-semibold text-gold-200">Oyna →</Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
