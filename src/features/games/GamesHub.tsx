import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { CustomerShell } from "@/components/customer/CustomerChrome";
import { useMember, useRequireMember } from "@/features/member/MemberContext";
import { fmt, PoolBadge, useGameInfo } from "./shared";

const GAMES = [
  {
    to: "/oyun/bahce",
    emoji: "🌱",
    title: "Lucana Bahçesi",
    desc: "Buğday, çilek, üzüm, kahve… Ek, büyüt, hasat et. Komşularını sula, birlikte büyüyün!",
    tag: "Herkes birlikte",
    grad: "from-emerald-500/30 via-night-800",
  },
  {
    to: "/oyun/blok",
    emoji: "🧱",
    title: "Lucana Blok",
    desc: "Klasik blok oyunu. Satır temizle, haftanın en yüksek skoruna oyna.",
    tag: "Beceri",
    grad: "from-violet-500/25 via-night-800",
  },
];

export default function GamesHub() {
  useRequireMember();
  const { member } = useMember();
  const { info } = useGameInfo();
  useEffect(() => {
    document.title = "Oyunlar · Lucana";
  }, []);

  return (
    <CustomerShell>
      <main className="container max-w-lg pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Masada vakit geçir</p>
            <h1 className="mt-1 font-display text-4xl font-semibold">
              Oyun <span className="text-gold italic">köşesi</span>
            </h1>
          </div>
          <PoolBadge info={info} />
        </div>
        {member && (
          <p className="mt-2 text-sm text-smoke-400">
            Bakiyen <b className="text-gold-200">⭐ {fmt(member.points)}</b> · Oyunlardan kazandığın puanlar siparişte indirim olur.
          </p>
        )}
        {info && !info.enabled && (
          <p className="mt-4 rounded-2xl bg-wine-600/15 p-4 text-sm text-wine-400">Oyunlar şu an kapalı. Daha sonra tekrar uğra!</p>
        )}

        <div className="mt-5 grid gap-3">
          {GAMES.map((g, i) => (
            <motion.div key={g.to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link to={g.to} className={`card flex items-center gap-4 bg-gradient-to-r ${g.grad} to-transparent p-5 transition active:scale-[0.99]`}>
                <motion.span
                  className="text-6xl drop-shadow-lg"
                  animate={{ rotate: [-4, 4, -4] }}
                  transition={{ repeat: Infinity, duration: 3, delay: i }}
                >
                  {g.emoji}
                </motion.span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-2xl font-semibold">{g.title}</span>
                    <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold text-gold-100">{g.tag}</span>
                  </span>
                  <span className="mt-1 block text-sm text-smoke-300">{g.desc}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-smoke-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Lucana'da şans oyunu ve bahis yoktur. Oyunlar beceri ya da süreye dayalıdır; kazanılacak puan baştan bellidir ve günlük tavanla
          sınırlıdır. Puanlar satın alınamaz, nakde çevrilemez. <Link to="/yasal/puan" className="underline">Koşullar</Link>
        </p>
      </main>
    </CustomerShell>
  );
}
