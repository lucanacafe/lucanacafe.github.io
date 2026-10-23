import { AnimatePresence, motion } from "framer-motion";
import { useLive } from "@/hooks/useLive";
import { memberApi, type FeedItem } from "@/lib/api/member";
import { cn, timeAgo } from "@/lib/utils";

export function feedText(f: FeedItem) {
  if (f.type === "order") return <>{f.place} masasında <b className="text-gold-100">{f.detail}</b>{f.amount && f.amount > 1 ? ` (+${f.amount - 1})` : ""} söyledi</>;
  if (f.type === "join") return <>{f.place} masasına oturdu 👋</>;
  return <>bahçesinde <b className="text-emerald-300">{f.detail}</b> hasat etti 🧺 +{f.amount} ⭐</>;
}

/** Canlı akış: kim ne sipariş etti, kim ne kazandı */
export function LiveFeed({ limit = 8, className, compact }: { limit?: number; className?: string; compact?: boolean }) {
  const { data } = useLive(() => memberApi.feed(limit), { interval: 20000, topic: "lucana-staff" });
  const items = data ?? [];
  if (!items.length) return null;
  return (
    <ul className={cn("space-y-2", className)}>
      <AnimatePresence initial={false}>
        {items.slice(0, limit).map((f) => (
          <motion.li
            key={f.type + f.nickname + f.at}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={cn("flex items-center gap-3 rounded-2xl bg-white/[0.035] px-3.5", compact ? "py-2" : "py-3")}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night-700 text-lg">{f.avatar}</span>
            <span className="min-w-0 flex-1 text-sm leading-snug text-smoke-300">
              <b className="text-smoke-50">{f.nickname}</b> {feedText(f)}
            </span>
            <span className="shrink-0 text-[11px] text-smoke-500">{timeAgo(f.at)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
