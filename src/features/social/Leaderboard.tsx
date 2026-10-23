import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CustomerShell } from "@/components/customer/CustomerChrome";
import { LiveFeed } from "@/components/customer/LiveFeed";
import { Empty, PageLoader, Segmented } from "@/components/ui";
import { memberApi, type BoardRow } from "@/lib/api/member";
import { useMember } from "@/features/member/MemberContext";
import { cn } from "@/lib/utils";

type Board = "week" | "all" | "farm" | "blok";
const LABEL: Record<Board, { title: string; unit: string; hint: string }> = {
  week: { title: "Bu hafta", unit: "puan", hint: "Son 7 günde siparişlerle kazanılan puan" },
  all: { title: "Tüm zamanlar", unit: "puan", hint: "Toplam kazanılan sadakat puanı" },
  farm: { title: "Bahçe", unit: "XP", hint: "Lucana Bahçesi'nin en iyi çiftçileri (hasat XP)" },
  blok: { title: "Blok", unit: "skor", hint: "Lucana Blok haftalık en yüksek skor" },
};

export default function Leaderboard() {
  const { member } = useMember();
  const [board, setBoard] = useState<Board>("week");
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [me, setMe] = useState<{ rank: number; score: number } | null>(null);

  useEffect(() => {
    document.title = "Liderler · Lucana";
    setRows(null);
    if (board === "blok") {
      memberApi.blokBoard().then((b) => {
        setRows(b.map((x, i) => ({ rank: i + 1, nickname: x.nickname, avatar: x.avatar, score: x.score, me: x.me })));
        setMe(null);
      });
    } else {
      memberApi.leaderboard(board).then((r) => {
        setRows(r.rows);
        setMe(r.me);
      });
    }
  }, [board, member?.id]);

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];

  return (
    <CustomerShell>
      <main className="container max-w-lg pt-5">
        <p className="eyebrow">Lucana</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">
          Liderlik <span className="text-gold italic">tablosu</span>
        </h1>
        <Segmented
          className="mt-4 w-full justify-between"
          value={board}
          onChange={setBoard}
          options={(Object.keys(LABEL) as Board[]).map((k) => ({ value: k, label: LABEL[k].title }))}
        />
        <p className="mt-2 text-xs text-smoke-500">{LABEL[board].hint}</p>

        {!rows ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <div className="mt-6">
            <Empty title="Henüz kimse yok" text="İlk sen ol! 🏆" />
          </div>
        ) : (
          <>
            {/* kürsü */}
            <div className="mt-6 grid grid-cols-3 items-end gap-2">
              {[1, 0, 2].map((i) => {
                const p = podium[i];
                if (!p) return <div key={i} />;
                const h = i === 0 ? "h-28" : i === 1 ? "h-20" : "h-16";
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} className="text-center">
                    <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 text-3xl", i === 0 ? "border-gold-300 shadow-glow" : "border-white/15")}>
                      {p.avatar}
                    </div>
                    <p className={cn("mt-1 truncate text-sm font-semibold", p.me && "text-gold-200")}>{p.nickname}</p>
                    <p className="text-xs text-smoke-400">{p.score.toLocaleString("tr-TR")}</p>
                    <div className={cn("mt-2 flex items-start justify-center rounded-t-2xl pt-2 font-display text-3xl font-bold", h, i === 0 ? "bg-gold-sheen text-night-950" : "bg-night-700 text-smoke-200")}>
                      {i + 1}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {rest.length > 0 && (
              <ol className="card mt-4 divide-y divide-white/5">
                {rest.map((r) => (
                  <li key={r.rank + r.nickname} className={cn("flex items-center gap-3 px-4 py-3", r.me && "bg-gold-400/10")}>
                    <span className="w-7 text-center font-bold text-smoke-500">{r.rank}</span>
                    <span className="text-xl">{r.avatar}</span>
                    <span className="flex-1 truncate font-semibold">{r.nickname}{r.me && " (sen)"}</span>
                    <span className="font-bold text-gold-200">{r.score.toLocaleString("tr-TR")}</span>
                  </li>
                ))}
              </ol>
            )}
            {me && me.rank > 25 && (
              <p className="mt-3 rounded-2xl bg-gold-400/10 p-3 text-center text-sm text-gold-100">
                Sen: <b>{me.rank}.</b> sıradasın · {me.score.toLocaleString("tr-TR")} {LABEL[board].unit}
              </p>
            )}
          </>
        )}

        <section className="mt-8">
          <h2 className="eyebrow mb-3">Şu an Lucana'da</h2>
          <LiveFeed limit={10} />
        </section>
      </main>
    </CustomerShell>
  );
}
