import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Info, Gift } from "lucide-react";
import { CustomerHeader, CustomerShell } from "@/components/customer/CustomerChrome";
import { useMember, useRequireMember } from "@/features/member/MemberContext";
import { gameApi, type GameInfo } from "@/lib/api/member";

export const fmt = (n: number) => Math.floor(n).toLocaleString("tr-TR");

export function useGameInfo() {
  const [info, setInfo] = useState<GameInfo | null>(null);
  const reload = useCallback(() => gameApi.info().then(setInfo).catch(() => {}), []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { info, reload };
}

/** Oyun sonrası bakiyeyi üye bağlamına yansıt (sunucunun döndürdüğü değerle) */
export function useSyncPoints() {
  const { member, setMember } = useMember();
  return (points: number | undefined) => {
    if (member && typeof points === "number")
      setMember({ ...member, points, discount_value: Math.floor((points / member.rates.redeem) * 100) / 100 });
  };
}

export function GamePage({ title, emoji, children, rules, back = "/oyun" }: { title: ReactNode; emoji: string; children: ReactNode; rules?: ReactNode; back?: string }) {
  const member = useRequireMember();
  const [showRules, setShowRules] = useState(false);
  return (
    <CustomerShell header={<CustomerHeader />}>
      <main className="container max-w-lg pt-4">
        <div className="flex items-center gap-2">
          <Link to={back} className="rounded-full p-1.5 text-smoke-400 hover:bg-white/5" aria-label="Geri">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 truncate font-display text-3xl font-semibold">
            {emoji} {title}
          </h1>
          {rules && (
            <button onClick={() => setShowRules((s) => !s)} className="rounded-full p-2 text-smoke-400 hover:bg-white/5" aria-label="Nasıl oynanır">
              <Info className="h-5 w-5" />
            </button>
          )}
        </div>
        {showRules && <div className="mt-3 rounded-2xl bg-white/[0.04] p-4 text-sm leading-relaxed text-smoke-300">{rules}</div>}
        {member ? <div className="mt-4">{children}</div> : <p className="py-16 text-center text-smoke-400">Oynamak için önce başla 👆</p>}
      </main>
    </CustomerShell>
  );
}

export function PoolBadge({ info }: { info: GameInfo | null }) {
  if (!info) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">
      <Gift className="h-3.5 w-3.5" /> Ödül havuzu: {fmt(info.pool)}
    </span>
  );
}
