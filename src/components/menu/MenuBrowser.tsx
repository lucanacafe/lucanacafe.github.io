import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, Search, X } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { CategoryIcon, ItemArt } from "@/components/ui/brand";
import { asset, cn, money, normalize } from "@/lib/utils";
import type { MenuData, MenuItem } from "@/types";

interface Props {
  menu: MenuData;
  /** Verilirse sepete ekleme açılır (QR masa modu) */
  onAdd?: (item: MenuItem, qty: number, note?: string) => void;
  qtyOf?: (id: string) => number;
  /** Yapışkan başlığın üst boşluğu (px) */
  stickyTop?: number;
}

export function MenuBrowser({ menu, onAdd, qtyOf, stickyTop = 0 }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(menu.categories[0]?.id ?? null);
  const [detail, setDetail] = useState<MenuItem | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const lockSpy = useRef(false);

  const byCat = useMemo(() => {
    const nq = normalize(q.trim());
    const map = new Map<string, MenuItem[]>();
    for (const c of menu.categories) map.set(c.id, []);
    for (const it of menu.items) {
      if (nq && !normalize(`${it.name} ${it.description ?? ""} ${it.tags.join(" ")}`).includes(nq)) continue;
      map.get(it.category_id)?.push(it);
    }
    return map;
  }, [menu, q]);

  const visibleCats = useMemo(() => menu.categories.filter((c) => (byCat.get(c.id)?.length ?? 0) > 0), [menu, byCat]);

  // Kaydırdıkça aktif kategoriyi işaretle: başlığın altına ulaşmış son bölüm aktiftir
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (lockSpy.current) return;
        let current: string | null = null;
        for (const c of visibleCats) {
          const el = sectionRefs.current[c.id];
          if (el && el.getBoundingClientRect().top <= stickyTop + 150) current = c.id;
        }
        setActive(current ?? visibleCats[0]?.id ?? null);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [visibleCats, stickyTop]);

  // Aktif sekmeyi görünür tut
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  const jump = (id: string) => {
    setActive(id);
    lockSpy.current = true;
    const el = sectionRefs.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - stickyTop - 110, behavior: "smooth" });
    setTimeout(() => (lockSpy.current = false), 800);
  };

  return (
    <div>
      <div className="sticky z-30 -mx-4 bg-night-950/90 px-4 pb-3 pt-3 backdrop-blur-xl" style={{ top: stickyTop }}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Menüde ara… (çay, nargile, tatlı)"
            className="input pl-10 pr-10"
            enterKeyHint="search"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke-400" aria-label="Temizle">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div ref={tabsRef} className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {visibleCats.map((c) => (
            <button
              key={c.id}
              data-tab={c.id}
              onClick={() => jump(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                active === c.id
                  ? "border-gold-300 bg-gold-300 text-night-950"
                  : "border-white/10 bg-night-800 text-smoke-200 hover:border-gold-400/40",
              )}
            >
              <CategoryIcon name={c.icon} className="h-4 w-4" />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {visibleCats.length === 0 && (
        <p className="py-20 text-center text-smoke-400">“{q}” için sonuç bulunamadı.</p>
      )}

      <div className="space-y-12 pt-4">
        {visibleCats.map((c) => (
          <section
            key={c.id}
            data-cat={c.id}
            ref={(el) => {
              sectionRefs.current[c.id] = el;
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-200">
                <CategoryIcon name={c.icon} className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-3xl font-semibold leading-none text-smoke-50">{c.name}</h2>
                {c.description && <p className="mt-1 text-sm text-smoke-400">{c.description}</p>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byCat.get(c.id)!.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  icon={c.icon}
                  qty={qtyOf?.(it.id) ?? 0}
                  onOpen={() => setDetail(it)}
                  onAdd={onAdd ? () => onAdd(it, 1) : undefined}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ItemDetail
        item={detail}
        icon={menu.categories.find((c) => c.id === detail?.category_id)?.icon}
        onClose={() => setDetail(null)}
        onAdd={onAdd}
      />
    </div>
  );
}

function ItemCard({
  item,
  icon,
  qty,
  onOpen,
  onAdd,
}: {
  item: MenuItem;
  icon?: string | null;
  qty: number;
  onOpen: () => void;
  onAdd?: () => void;
}) {
  const soldOut = item.available === false;
  return (
    <motion.div
      layout
      className={cn(
        "card group flex cursor-pointer gap-4 overflow-hidden p-3 transition hover:border-gold-400/25",
        soldOut && "opacity-55",
      )}
      onClick={onOpen}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
        {item.image_url ? (
          <img src={asset(item.image_url)!} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <ItemArt icon={icon} className="h-full w-full" />
        )}
        {qty > 0 && (
          <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-gold-300 px-1.5 text-xs font-bold text-night-950">
            {qty}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 font-display text-[1.35rem] font-semibold leading-tight text-smoke-50">{item.name}</h3>
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-smoke-400">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-bold text-gold-200">{money(item.price)}</span>
            {soldOut ? (
              <Badge className="border-wine-500/40 text-wine-400">Tükendi</Badge>
            ) : (
              item.tags.slice(0, 1).map((t) => (
                <Badge key={t} className="border-gold-400/25 capitalize text-gold-200/90">{t}</Badge>
              ))
            )}
          </div>
          {onAdd && !soldOut && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-300 text-night-950 shadow-glow transition active:scale-90"
              aria-label={`${item.name} sepete ekle`}
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ItemDetail({
  item,
  icon,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  icon?: string | null;
  onClose: () => void;
  onAdd?: (item: MenuItem, qty: number, note?: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  useEffect(() => {
    setQty(1);
    setNote("");
  }, [item?.id]);
  const soldOut = item?.available === false;

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      footer={
        item && onAdd && !soldOut ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-white/10">
              <button className="p-3 text-smoke-200" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Azalt">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-lg font-bold">{qty}</span>
              <button className="p-3 text-smoke-200" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Arttır">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              className="flex-1"
              onClick={() => {
                onAdd(item, qty, note.trim() || undefined);
                onClose();
              }}
            >
              Sepete ekle · {money(item.price * qty)}
            </Button>
          </div>
        ) : undefined
      }
    >
      {item && (
        <div>
          <div className="-mx-5 -mt-4 mb-5 overflow-hidden">
            {item.image_url ? (
              <img src={asset(item.image_url)!} alt={item.name} className="max-h-[45vh] w-full object-cover" />
            ) : (
              <ItemArt icon={icon} className="h-48 w-full" />
            )}
          </div>
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-display text-3xl font-semibold leading-tight">{item.name}</h3>
            <span className="shrink-0 text-2xl font-bold text-gold-200">{money(item.price)}</span>
          </div>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <Badge key={t} className="border-gold-400/25 capitalize text-gold-200/90">{t}</Badge>
              ))}
            </div>
          )}
          {item.description && <p className="mt-3 text-smoke-300">{item.description}</p>}
          {soldOut && <p className="mt-4 rounded-xl bg-wine-600/15 p-3 text-sm text-wine-400">Bu ürün şu an tükendi.</p>}
          {onAdd && !soldOut && (
            <label className="mt-5 block">
              <span className="label">Not (isteğe bağlı)</span>
              <input
                className="input"
                maxLength={150}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Örn: az şekerli, buzsuz…"
              />
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
