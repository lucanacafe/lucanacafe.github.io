import {
  Beer,
  CakeSlice,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dices,
  Flame,
  GlassWater,
  IceCreamCone,
  Leaf,
  Martini,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Sparkles,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Kategori ikonları — panelde seçilebilen set */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Flame,
  Coffee,
  GlassWater,
  CupSoda,
  CakeSlice,
  Sandwich,
  IceCreamCone,
  Cookie,
  Croissant,
  Citrus,
  Leaf,
  Martini,
  Wine,
  Beer,
  Pizza,
  Soup,
  Salad,
  UtensilsCrossed,
  Dices,
  Sparkles,
};

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const I = (name && CATEGORY_ICONS[name]) || UtensilsCrossed;
  return <I className={className} />;
}

/** Lucana yazı logosu — Instagram'daki altın script logodan */
export function Logo({ className, sub = true }: { className?: string; sub?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col items-center leading-none", className)}>
      <span className="text-gold font-script text-[1em] drop-shadow-[0_2px_12px_rgba(232,193,112,.25)]">Lucana</span>
      {sub && (
        <span className="mt-[0.15em] text-[0.18em] font-semibold uppercase tracking-[0.42em] text-gold-200/80">
          Cafe · Nargile · Okey
        </span>
      )}
    </span>
  );
}

export function Monogram({ className }: { className?: string }) {
  return <img src={import.meta.env.BASE_URL + "favicon.svg"} alt="" className={cn("h-9 w-9", className)} />;
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Hafif dumanlı arka plan efekti (nargile atmosferi) */
export function Smoke({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="absolute bottom-0 h-40 w-40 animate-smoke rounded-full bg-smoke-100/[0.06] blur-3xl"
          style={{ left: `${10 + i * 18}%`, animationDelay: `${i * 1.3}s`, animationDuration: `${7 + (i % 3)}s` }}
        />
      ))}
    </div>
  );
}

/** Görselsiz ürünler için şık yer tutucu */
export function ItemArt({ icon, className }: { icon?: string | null; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(232,193,112,.18),transparent_60%),linear-gradient(135deg,#221a14,#120d0a)]",
        className,
      )}
    >
      <CategoryIcon name={icon} className="h-8 w-8 text-gold-300/50" />
    </div>
  );
}
