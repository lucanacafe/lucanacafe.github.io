import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, MapPin, Menu as MenuIcon, Phone, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { useSite } from "@/app/SiteContext";
import { Button } from "@/components/ui";
import { InstagramIcon, Logo } from "@/components/ui/brand";
import { PointsChip } from "@/components/customer/CustomerChrome";
import { useMember } from "@/features/member/MemberContext";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { openState } from "@/lib/hours";
import { cn, telHref } from "@/lib/utils";

const LINKS = [
  { to: "/menu", label: "Menü" },
  { to: "/oyun", label: "Oyunlar" },
  { to: "/liderler", label: "Liderler" },
  { to: "/#galeri", label: "Galeri" },
  { to: "/#iletisim", label: "İletişim" },
];

export function AnnouncementBar() {
  const { settings } = useSite();
  if (!settings.announcement) return null;
  return (
    <div className="relative z-50 bg-gold-sheen px-4 py-2 text-center text-sm font-semibold text-night-950">
      {settings.announcement}
    </div>
  );
}

export function SiteNav({ solid = false }: { solid?: boolean }) {
  const { member } = useMember();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled || solid || open ? "glass border-x-0 border-t-0 py-2" : "py-4",
      )}
    >
      <div className="pt-safe" />
      <div className="container flex items-center justify-between gap-4">
        <Link to="/" className="text-[34px]" aria-label="Lucana ana sayfa" onClick={() => setOpen(false)}>
          <Logo sub={false} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-smoke-200 transition hover:text-gold-200"
            >
              {l.label}
            </NavLink>
          ))}
          {member ? (
            <PointsChip className="ml-2" />
          ) : (
            <Link to="/menu" className="ml-2">
              <Button size="sm">Menüyü Gör</Button>
            </Link>
          )}
        </nav>
        {member && <PointsChip className="md:hidden" />}
        <button
          className="rounded-xl p-2 text-smoke-100 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menüyü aç"
        >
          {open ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden md:hidden"
          >
            <div className="container flex flex-col gap-1 py-3">
              {LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 font-display text-2xl text-smoke-100 hover:bg-white/5"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

export function OpenBadge({ className }: { className?: string }) {
  const { settings } = useSite();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const st = openState(settings.hours);
  if (!st) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        st.isOpen ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-wine-400/30 bg-wine-500/10 text-wine-400",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", st.isOpen ? "animate-pulse bg-emerald-400" : "bg-wine-400")} />
      {st.isOpen ? `Şu an açık · ${st.closesAt}'e kadar` : `Kapalı · ${st.opensAt}'da açılıyor`}
    </span>
  );
}

export function SiteFooter() {
  const { settings } = useSite();
  const pwa = usePwaInstall();
  return (
    <footer className="relative border-t hairline bg-night-950">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo className="text-6xl" />
          <p className="mt-5 max-w-sm font-display text-xl italic text-smoke-300">“{settings.tagline}”</p>
          {pwa.canInstall && (
            <Button
              variant="outline"
              size="sm"
              className="mt-6"
              onClick={async () => {
                if (pwa.isIos) {
                  toast("iPhone'da: Paylaş simgesi → “Ana Ekrana Ekle”", { duration: 6000 });
                } else await pwa.install();
              }}
            >
              <Smartphone className="h-4 w-4" /> Uygulamayı yükle
            </Button>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">Ziyaret</p>
          <a href={settings.maps_url} target="_blank" rel="noreferrer" className="flex gap-2.5 text-smoke-300 hover:text-gold-200">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> {settings.address}
          </a>
          <p className="flex gap-2.5 text-smoke-300">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> Her gün {settings.hours}
          </p>
          <a href={telHref(settings.phone)} className="flex gap-2.5 text-smoke-300 hover:text-gold-200">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> {settings.phone}
          </a>
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">Keşfet</p>
          <Link to="/menu" className="block text-smoke-300 hover:text-gold-200">Menü</Link>
          <a
            href={`https://www.instagram.com/${settings.instagram}/`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-smoke-300 hover:text-gold-200"
          >
            <InstagramIcon className="h-4 w-4" /> @{settings.instagram}
          </a>
          <Link to="/oyun" className="block text-smoke-300 hover:text-gold-200">Oyunlar & Puan</Link>
          <Link to="/yasal/kvkk" className="block text-smoke-500 hover:text-smoke-300">KVKK & Koşullar</Link>
          <Link to="/panel" className="block text-smoke-500 hover:text-smoke-300">Personel girişi</Link>
        </div>
      </div>
      <div className="border-t hairline py-5 text-center text-xs text-smoke-500">
        © {new Date().getFullYear()} {settings.name} · Tüm hakları saklıdır
      </div>
    </footer>
  );
}
