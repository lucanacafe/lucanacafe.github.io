import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Gamepad2, Home, Smartphone, Trophy, UserRound, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/ui/brand";
import { Button } from "@/components/ui";
import { useMember } from "@/features/member/MemberContext";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { getLastTable } from "@/lib/lastTable";
import { pushState, subscribeMember, type PushState } from "@/lib/push";
import { cn, deviceId } from "@/lib/utils";

/** Puan rozeti (profil bağlantısı) */
export function PointsChip({ className }: { className?: string }) {
  const { member } = useMember();
  if (!member) return null;
  return (
    <Link
      to="/profil"
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 py-1 pl-1.5 pr-3 text-sm font-bold text-gold-100",
        className,
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-night-800 text-sm">{member.avatar}</span>
      ⭐ {member.points.toLocaleString("tr-TR")}
    </Link>
  );
}

/** Müşteri sayfalarının üst barı (iPhone çentiğine uyumlu) */
export function CustomerHeader({ right, title }: { right?: ReactNode; title?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 glass border-x-0 border-t-0 pt-safe">
      <div className="container flex h-14 items-center justify-between gap-3">
        <Link to="/" className="text-3xl" aria-label="Ana sayfa">
          <Logo sub={false} />
        </Link>
        {title && <div className="min-w-0 flex-1 truncate text-center font-display text-lg font-semibold">{title}</div>}
        <div className="flex items-center gap-2">
          {right}
          <PointsChip />
        </div>
      </div>
    </header>
  );
}

/** Alt sekme çubuğu */
export function CustomerNav() {
  const table = getLastTable();
  const { pathname } = useLocation();
  const tabs = [
    { to: "/", label: "Ana sayfa", icon: Home, end: true },
    { to: table ? `/m/${table.code}` : "/menu", label: table ? "Masam" : "Menü", icon: UtensilsCrossed, match: ["/m/", "/menu"] },
    { to: "/oyun", label: "Oyunlar", icon: Gamepad2 },
    { to: "/liderler", label: "Liderler", icon: Trophy },
    { to: "/profil", label: "Profil", icon: UserRound },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-night-900/95 pb-[var(--safe-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((t) => {
          const active = t.match ? t.match.some((m) => pathname.startsWith(m)) : t.end ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <NavLink
              key={t.label}
              to={t.to}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                active ? "text-gold-200" : "text-smoke-400",
              )}
            >
              {active && <motion.span layoutId="cnav" className="absolute top-0 h-0.5 w-8 rounded-full bg-gold-300" />}
              <t.icon className="h-5 w-5" />
              {t.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/** Ana sayfada: aktif masa oturumu varsa "Masana dön" */
export function BackToTable() {
  const t = getLastTable();
  if (!t) return null;
  return (
    <Link
      to={`/m/${t.code}`}
      className="fixed bottom-[calc(var(--safe-bottom)+1rem)] right-4 z-40 flex items-center gap-2 rounded-full bg-gold-sheen px-5 py-3 font-semibold text-night-950 shadow-glow"
    >
      <UtensilsCrossed className="h-4 w-4" /> Masana dön · {t.name}
    </Link>
  );
}

/**
 * Üyelikten sonra bir kez: "Uygulamayı yükle" ve "Bildirimleri aç" önerileri.
 * Kapatılınca bir daha gösterilmez (7 gün).
 */
export function AppPrompts() {
  const { member } = useMember();
  const pwa = usePwaInstall();
  const [push, setPush] = useState<PushState | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("lucana.prompts") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (member) pushState().then(setPush);
  }, [member]);
  if (!member) return null;

  const hide = (k: string) => {
    const d = { ...dismissed, [k]: Date.now() };
    setDismissed(d);
    try {
      localStorage.setItem("lucana.prompts", JSON.stringify(d));
    } catch {
      /* yok say */
    }
  };
  const recent = (k: string) => dismissed[k] && Date.now() - dismissed[k] < 7 * 86400000;

  let card: { key: string; icon: ReactNode; title: string; text: string; action?: ReactNode } | null = null;
  if (push === "off" && !recent("push")) {
    card = {
      key: "push",
      icon: <BellRing className="h-5 w-5" />,
      title: "Bildirimleri aç",
      text: "Siparişin hazır olunca ve puan kazanınca haber verelim.",
      action: (
        <Button
          size="sm"
          onClick={async () => {
            try {
              await subscribeMember(deviceId());
              toast.success("Bildirimler açıldı 🔔");
              setPush("on");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Aç
        </Button>
      ),
    };
  } else if (push === "needs-install" && !recent("ios")) {
    card = {
      key: "ios",
      icon: <Smartphone className="h-5 w-5" />,
      title: "Uygulamayı ana ekrana ekle",
      text: "Safari'de Paylaş simgesi → “Ana Ekrana Ekle”. Bildirimler ve tam ekran deneyim için.",
    };
  } else if (pwa.canInstall && !pwa.isIos && !recent("install")) {
    card = {
      key: "install",
      icon: <Smartphone className="h-5 w-5" />,
      title: "Lucana uygulamasını yükle",
      text: "Tek dokunuşla ana ekranına ekle; menü, puan ve oyunlar hep elinin altında.",
      action: (
        <Button size="sm" onClick={async () => (await pwa.install()) && hide("install")}>
          Yükle
        </Button>
      ),
    };
  }

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          key={card.key}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+4.75rem)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gold-400/25 bg-night-800/95 p-3.5 shadow-2xl backdrop-blur-xl"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">{card.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{card.title}</p>
            <p className="text-xs text-smoke-400">{card.text}</p>
          </div>
          {card.action}
          <button onClick={() => hide(card!.key)} className="p-1 text-smoke-500" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Müşteri sayfaları için ortak iskelet */
export function CustomerShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="min-h-screen pb-[calc(var(--safe-bottom)+5rem)]">
      {header ?? <CustomerHeader />}
      {children}
      <AppPrompts />
      <CustomerNav />
    </div>
  );
}
