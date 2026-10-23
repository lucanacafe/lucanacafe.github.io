import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  QrCode,
  ScrollText,
  Settings,
  Gamepad2,
  Star,
  Table2,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/ui/brand";
import { LEVEL } from "@/lib/constants";
import { unlockAudio } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth";
import { PulseProvider, usePulse } from "./pulse";
import { PushBanner } from "./components/PushControls";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  min: number;
  badge?: "orders" | "calls";
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { to: "/panel", label: "Özet", icon: LayoutDashboard, min: 0, mobile: true },
  { to: "/panel/siparisler", label: "Siparişler", icon: ClipboardList, min: 0, badge: "orders", mobile: true },
  { to: "/panel/masalar", label: "Masalar", icon: Table2, min: 0, badge: "calls", mobile: true },
  { to: "/panel/menu", label: "Menü", icon: BookOpen, min: 0, mobile: true },
  { to: "/panel/stok", label: "Stok", icon: Boxes, min: LEVEL.WAITER },
  { to: "/panel/qr", label: "Masa & QR", icon: QrCode, min: LEVEL.MANAGER },
  { to: "/panel/uyeler", label: "Üyeler & Puan", icon: Star, min: LEVEL.CASHIER },
  { to: "/panel/oyun", label: "Oyunlar & Havuz", icon: Gamepad2, min: LEVEL.CASHIER },
  { to: "/panel/rapor", label: "Raporlar", icon: BarChart3, min: LEVEL.CASHIER },
  { to: "/panel/personel", label: "Personel", icon: Users, min: LEVEL.MANAGER },
  { to: "/panel/gecmis", label: "İşlem geçmişi", icon: ScrollText, min: LEVEL.MANAGER },
  { to: "/panel/ayarlar", label: "Ayarlar", icon: Settings, min: LEVEL.CASHIER },
  { to: "/panel/hesap", label: "Hesabım", icon: UserRound, min: 0 },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PulseProvider>
      <Inner>{children}</Inner>
    </PulseProvider>
  );
}

function Inner({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();
  const { orders, calls, sound, setSound } = usePulse();
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const items = NAV.filter((n) => can(n.min));
  const newCount = orders.filter((o) => o.status === "new").length;
  const badge = (b?: NavItem["badge"]) => (b === "orders" ? newCount : b === "calls" ? calls.length : 0);

  const link = (n: NavItem, onClick?: () => void) => {
    const count = badge(n.badge);
    return (
      <NavLink
        key={n.to}
        to={n.to}
        end={n.to === "/panel"}
        onClick={onClick}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            isActive ? "bg-gold-400/10 text-gold-100" : "text-smoke-300 hover:bg-white/5 hover:text-smoke-50",
          )
        }
      >
        <n.icon className="h-[18px] w-[18px]" />
        <span className="flex-1">{n.label}</span>
        {count > 0 && (
          <span className="rounded-full bg-ember-500 px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>
        )}
      </NavLink>
    );
  };

  const sidebar = (onClick?: () => void) => (
    <div className="flex h-full flex-col pt-safe pb-safe">
      <Link to="/panel" className="flex items-center gap-3 px-3 py-5" onClick={onClick}>
        <span className="text-4xl"><Logo sub={false} /></span>
        <span className="mt-2 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-smoke-400">
          Panel
        </span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">{items.map((n) => link(n, onClick))}</nav>
      <div className="border-t hairline p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/15 font-bold text-gold-200">
            {user!.full_name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user!.full_name}</p>
            <p className="text-xs text-smoke-500">{user!.role_name}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-smoke-400 hover:bg-white/5 hover:text-wine-400" title="Çıkış">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 px-3 py-1.5 text-xs text-smoke-500 hover:text-smoke-300">
          <ExternalLink className="h-3.5 w-3.5" /> Siteyi görüntüle
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64" onPointerDown={unlockAudio}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r hairline bg-night-900/95 lg:block">{sidebar()}</aside>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 border-r hairline bg-night-900"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <button className="absolute right-3 mt-[var(--safe-top)] top-5 p-1 text-smoke-400" onClick={() => setDrawer(false)} aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
              {sidebar(() => setDrawer(false))}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-20 border-b hairline bg-night-950/85 pt-safe backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
        <button className="rounded-lg p-1.5 lg:hidden" onClick={() => setDrawer(true)} aria-label="Menü">
          <MenuIcon className="h-5 w-5" />
        </button>
        <p className="flex-1 truncate font-display text-xl font-semibold">
          {items.find((n) => (n.to === "/panel" ? pathname === "/panel" : pathname.startsWith(n.to)))?.label ?? "Panel"}
        </p>
        {calls.length > 0 && (
          <Link to="/panel/masalar" className="flex items-center gap-1.5 rounded-full bg-ember-500/15 px-3 py-1 text-xs font-bold text-ember-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember-400" /> {calls.length} çağrı
          </Link>
        )}
        <button
          onClick={() => setSound(!sound)}
          className="rounded-lg p-2 text-smoke-400 hover:bg-white/5 hover:text-smoke-50"
          title={sound ? "Sesi kapat" : "Sesi aç"}
        >
          {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
        <PushBanner />
        {children}
      </main>

      {/* Mobil alt gezinme */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t hairline bg-night-900/95 pb-safe backdrop-blur-xl lg:hidden">
        {NAV.filter((n) => n.mobile && can(n.min)).map((n) => {
          const count = badge(n.badge);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/panel"}
              className={({ isActive }) =>
                cn("relative flex flex-col items-center gap-1 pt-2.5 text-[11px] font-medium", isActive ? "text-gold-200" : "text-smoke-400")
              }
            >
              <n.icon className="h-5 w-5" />
              {n.label}
              {count > 0 && (
                <span className="absolute right-[calc(50%-22px)] top-1 rounded-full bg-ember-500 px-1.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
