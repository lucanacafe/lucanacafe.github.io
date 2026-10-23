import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, Clock, Flame, MapPin, Navigation, Phone, QrCode, ShoppingBag, X } from "lucide-react";
import { useSite } from "@/app/SiteContext";
import { Button } from "@/components/ui";
import { InstagramIcon, ItemArt, Logo, Smoke } from "@/components/ui/brand";
import { AnnouncementBar, OpenBadge, SiteFooter, SiteNav } from "@/components/layout/SiteChrome";
import { publicApi } from "@/lib/api/public";
import { asset, money, telHref, waHref } from "@/lib/utils";
import type { MenuData } from "@/types";

const img = (n: string) => asset(`images/${n}.webp`)!;

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
} as const;

const PILLARS = [
  {
    title: "Cafe",
    text: "İnce belli bardakta demli çay, köpüklü Türk kahvesi, bol köpüklü milkshake'ler ve kahvenin yanına tatlı bir eşlik.",
    image: "milkshake",
    eyebrow: "Fincanda hikaye",
  },
  {
    title: "Nargile",
    text: "Premium tütünler, yoğun duman, özenle hazırlanmış lüleler. Köz bitmeden masadan tek dokunuşla değişim.",
    image: "nargile-masa",
    eyebrow: "Nargileni seç, keyfini sür",
  },
  {
    title: "Okey & Sohbet",
    text: "Kalabalık masalar, okey taşlarının sesi, sıcacık bir aile ortamı. Gece 04:00'e kadar sohbet bitmez.",
    image: "salon-kalabalik",
    eyebrow: "Köşede huzur",
  },
];

const GALLERY = [
  { n: "nargile-gece", alt: "Gece ışıkları eşliğinde nargile", cls: "row-span-2" },
  { n: "salon-gunduz", alt: "Lucana salonu, gün ışığı", cls: "row-span-2" },
  { n: "milkshake", alt: "Çilekli milkshake", cls: "row-span-2" },
  { n: "salon-kalabalik", alt: "Kalabalık bir akşam", cls: "" },
  { n: "nargile-pirinc", alt: "Pirinç nargile", cls: "row-span-2" },
  { n: "salon-sedir", alt: "Sedir köşesi", cls: "" },
  { n: "kampanya-250", alt: "Tüm nargile çeşitleri tek fiyat", cls: "" },
  { n: "poster-lucana", alt: "Lucana Cafe afişi", cls: "row-span-2" },
];

export default function Landing() {
  const { settings } = useSite();
  const [menu, setMenu] = useState<MenuData | null>(publicApi.cachedMenu());
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { hash } = useLocation();

  useEffect(() => {
    publicApi.menu().then(setMenu).catch(() => {});
  }, []);

  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [hash]);

  const featured = (menu?.items ?? []).filter((i) => i.is_featured).slice(0, 8);
  const catIcon = (cid: string) => menu?.categories.find((c) => c.id === cid)?.icon;
  const nargileCat = menu?.categories.find((c) => c.name.toLowerCase().includes("nargile"));
  const nargilePrice = nargileCat
    ? Math.min(...(menu?.items.filter((i) => i.category_id === nargileCat.id).map((i) => Number(i.price)) ?? [Infinity]))
    : null;

  return (
    <div className="overflow-x-clip">
      <AnnouncementBar />
      <SiteNav />

      {/* ---------------------------------------------------------- HERO */}
      <section className="relative flex min-h-[100svh] items-end pb-16 pt-28 md:items-center md:pb-0">
        <div className="absolute inset-0">
          <img src={img("nargile-gece")} alt="" className="h-full w-full object-cover object-center opacity-60" {...{ fetchpriority: "high" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-night-950 via-night-950/80 to-night-950/20" />
          <div className="absolute inset-0 bg-night-fade" />
        </div>
        <Smoke />
        <div className="container relative">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
            <OpenBadge />
            <p className="eyebrow mt-6">Çağlayan · Kağıthane · İstanbul</p>
            <h1 className="mt-3 text-[clamp(5rem,17vw,11rem)] leading-[0.95]">
              <Logo className="items-start" sub={false} />
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.5em] text-gold-200/90 md:text-base">
              Cafe · Nargile · Okey
            </p>
            <p className="mt-6 max-w-xl font-display text-[1.7rem] italic leading-snug text-smoke-100 md:text-4xl">
              {settings.tagline}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/menu">
                <Button size="lg">
                  Menüyü İncele <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href={settings.maps_url} target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline">
                  <Navigation className="h-5 w-5" /> Yol Tarifi
                </Button>
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-smoke-300">
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-gold-300" /> Her gün {settings.hours}</span>
              <a href={telHref(settings.phone)} className="flex items-center gap-2 hover:text-gold-200">
                <Phone className="h-4 w-4 text-gold-300" /> {settings.phone}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- MARQUEE */}
      <div className="relative border-y hairline bg-night-900/80 py-4">
        <div className="flex overflow-hidden">
          <motion.div
            className="flex shrink-0 gap-10 pr-10"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 28, ease: "linear", repeat: Infinity }}
          >
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ["Demli Çay", "Türk Kahvesi", "Premium Nargile", "Milkshake", "Okey Masaları", "Aile Ortamı", "04:00'e Kadar Açık", "QR ile Sipariş"].map(
                (t) => (
                  <span key={`${k}-${t}`} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl italic text-smoke-300">
                    {t} <span className="text-gold-400">✦</span>
                  </span>
                ),
              ),
            )}
          </motion.div>
        </div>
      </div>

      {/* ---------------------------------------------------------- DENEYİM */}
      <section id="deneyim" className="container scroll-mt-20 py-24 md:py-32">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Lucana deneyimi</p>
          <h2 className="mt-3 font-display text-5xl font-semibold text-smoke-50 md:text-6xl">
            Üç keyif, <span className="text-gold italic">tek adres</span>
          </h2>
        </motion.div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <motion.article
              key={p.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.12 }}
              className="group relative overflow-hidden rounded-3xl border hairline"
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={img(p.image)}
                  alt={p.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/60 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="eyebrow">{p.eyebrow}</p>
                <h3 className="mt-2 font-script text-5xl text-gold">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-smoke-200">{p.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- KAMPANYA */}
      <section className="relative overflow-hidden border-y hairline">
        <div className="absolute inset-0">
          <img src={img("poster-lucana")} alt="" loading="lazy" className="h-full w-full object-cover opacity-25 blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-r from-night-950 via-night-950/85 to-night-950/60" />
        </div>
        <div className="container relative grid items-center gap-10 py-20 md:grid-cols-[1.2fr_1fr]">
          <motion.div {...fadeUp}>
            <p className="eyebrow text-ember-300">Keyfin adresi</p>
            <h2 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
              Tüm nargile çeşitleri
              <br />
              <span className="text-gold">tek fiyat{nargilePrice && isFinite(nargilePrice) ? ` · ${money(nargilePrice)}` : ""}</span>
            </h2>
            <p className="mt-5 max-w-lg text-lg text-smoke-300">
              Lucana Special'dan klasik çift elmaya, istediğini seç — fiyat değişmez. Köz bitince masadaki QR'dan tek dokunuşla çağır.
            </p>
            <Link to="/menu" className="mt-8 inline-block">
              <Button variant="ember" size="lg">
                <Flame className="h-5 w-5" /> Nargile menüsü
              </Button>
            </Link>
          </motion.div>
          <motion.img
            {...fadeUp}
            src={img("poster-lucana")}
            alt="Lucana Cafe nargile afişi"
            loading="lazy"
            className="mx-auto w-full max-w-sm rotate-2 rounded-3xl border border-gold-400/20 shadow-glow"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- ÖNE ÇIKANLAR */}
      {featured.length > 0 && (
        <section className="container py-24 md:py-32">
          <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Menüden</p>
              <h2 className="mt-3 font-display text-5xl font-semibold md:text-6xl">
                Öne <span className="text-gold italic">çıkanlar</span>
              </h2>
            </div>
            <Link to="/menu" className="group flex items-center gap-2 text-gold-200 hover:text-gold-100">
              Tüm menü <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </motion.div>
          <div className="no-scrollbar -mx-4 mt-12 flex snap-x gap-5 overflow-x-auto px-4 pb-4">
            {featured.map((it, i) => (
              <motion.div
                key={it.id}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.06 }}
                className="card w-60 shrink-0 snap-start overflow-hidden"
              >
                {it.image_url ? (
                  <img src={asset(it.image_url)!} alt={it.name} loading="lazy" className="aspect-square w-full object-cover" />
                ) : (
                  <ItemArt icon={catIcon(it.category_id)} className="aspect-square w-full" />
                )}
                <div className="p-4">
                  <p className="font-display text-xl font-semibold leading-tight">{it.name}</p>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-smoke-400">{it.description}</p>
                  <p className="mt-3 text-lg font-bold text-gold-200">{money(it.price)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- QR */}
      <section className="border-y hairline bg-night-900/60">
        <div className="container py-24">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Masadan sipariş</p>
            <h2 className="mt-3 font-display text-5xl font-semibold md:text-6xl">
              QR'ı okut, <span className="text-gold italic">gerisini bize bırak</span>
            </h2>
          </motion.div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              { icon: QrCode, t: "Okut", d: "Masandaki QR kodu telefon kameranla okut — uygulama indirmene gerek yok." },
              { icon: ShoppingBag, t: "Sipariş ver", d: "Menüye göz at, sepetine ekle, tek dokunuşla siparişini mutfağa ilet." },
              { icon: Bell, t: "Çağır", d: "Garson, köz değişimi ya da hesap — hepsi tek dokunuş. Siparişini canlı takip et." },
            ].map((s, i) => (
              <motion.div key={s.t} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }} className="card p-7">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-200">
                    <s.icon className="h-6 w-6" />
                  </span>
                  <span className="font-display text-5xl text-white/10">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-display text-3xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-smoke-300">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- HAKKIMIZDA */}
      {settings.about && (
        <section className="container grid items-center gap-12 py-24 md:grid-cols-2 md:py-32">
          <motion.div {...fadeUp} className="relative">
            <img src={img("salon-gunduz")} alt="Lucana salonu" loading="lazy" className="w-4/5 rounded-3xl border hairline object-cover" />
            <img
              src={img("salon-sedir")}
              alt="Sedir köşesi"
              loading="lazy"
              className="absolute -bottom-10 right-0 w-1/2 rounded-3xl border-4 border-night-950 object-cover shadow-2xl"
            />
          </motion.div>
          <motion.div {...fadeUp}>
            <p className="eyebrow">Hikayemiz</p>
            <h2 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
              Sıcacık bir <span className="text-gold italic">aile ortamı</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-smoke-300">{settings.about}</p>
            <div className="ornament mt-10 text-sm">✦</div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              {[
                ["Her gün", "açığız"],
                ["04:00", "'e kadar"],
                ["QR", "masadan sipariş"],
              ].map(([a, b]) => (
                <div key={a}>
                  <p className="font-display text-4xl font-semibold text-gold">{a}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-smoke-400">{b}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ---------------------------------------------------------- GALERİ */}
      <section id="galeri" className="container scroll-mt-20 py-24">
        <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Galeri</p>
            <h2 className="mt-3 font-display text-5xl font-semibold md:text-6xl">
              Lucana'dan <span className="text-gold italic">kareler</span>
            </h2>
          </div>
          <a
            href={`https://www.instagram.com/${settings.instagram}/`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-gold-200 hover:text-gold-100"
          >
            <InstagramIcon className="h-5 w-5" /> @{settings.instagram}
          </a>
        </motion.div>
        <div className="mt-12 grid auto-rows-[160px] grid-cols-2 gap-3 md:auto-rows-[220px] md:grid-cols-4 md:gap-4">
          {GALLERY.map((g, i) => (
            <motion.button
              key={g.n}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: (i % 4) * 0.08 }}
              onClick={() => setLightbox(i)}
              className={`group relative overflow-hidden rounded-2xl border hairline ${g.cls}`}
            >
              <img
                src={img(g.n)}
                alt={g.alt}
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />
              <span className="absolute inset-0 bg-night-950/0 transition group-hover:bg-night-950/20" />
            </motion.button>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- İLETİŞİM */}
      <section id="iletisim" className="container scroll-mt-20 pb-24">
        <div className="grid overflow-hidden rounded-3xl border hairline md:grid-cols-2">
          <div className="bg-night-850 p-8 md:p-12">
            <p className="eyebrow">Bizi ziyaret edin</p>
            <h2 className="mt-3 font-display text-5xl font-semibold">
              Kapımız <span className="text-gold italic">açık</span>
            </h2>
            <OpenBadge className="mt-5" />
            <dl className="mt-8 space-y-6">
              <div className="flex gap-4">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-gold-300" />
                <div>
                  <dt className="text-xs uppercase tracking-wider text-smoke-500">Adres</dt>
                  <dd className="mt-1 text-lg">{settings.address}</dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock className="mt-1 h-5 w-5 shrink-0 text-gold-300" />
                <div>
                  <dt className="text-xs uppercase tracking-wider text-smoke-500">Çalışma saatleri</dt>
                  <dd className="mt-1 text-lg">Her gün {settings.hours}</dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Phone className="mt-1 h-5 w-5 shrink-0 text-gold-300" />
                <div>
                  <dt className="text-xs uppercase tracking-wider text-smoke-500">Rezervasyon & bilgi</dt>
                  <dd className="mt-1 text-lg">
                    <a href={telHref(settings.phone)} className="hover:text-gold-200">{settings.phone}</a>
                  </dd>
                </div>
              </div>
            </dl>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={settings.maps_url} target="_blank" rel="noreferrer">
                <Button><Navigation className="h-4 w-4" /> Yol tarifi</Button>
              </a>
              <a href={waHref(settings.phone, "Merhaba, rezervasyon yapmak istiyorum.")} target="_blank" rel="noreferrer">
                <Button variant="outline">WhatsApp</Button>
              </a>
            </div>
          </div>
          <div className="relative min-h-[360px] bg-night-800">
            <iframe
              title="Lucana konumu"
              src={`https://maps.google.com/maps?q=${encodeURIComponent("Vatan Caddesi 57, Çağlayan, Kağıthane, İstanbul")}&z=16&output=embed`}
              className="absolute inset-0 h-full w-full grayscale-[0.6] invert-[0.92] hue-rotate-180"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* ---------------------------------------------------------- LIGHTBOX */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2" aria-label="Kapat">
              <X className="h-6 w-6" />
            </button>
            <motion.img
              key={lightbox}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={img(GALLERY[lightbox].n)}
              alt={GALLERY[lightbox].alt}
              className="max-h-[88vh] max-w-full rounded-2xl"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((lightbox + 1) % GALLERY.length);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
