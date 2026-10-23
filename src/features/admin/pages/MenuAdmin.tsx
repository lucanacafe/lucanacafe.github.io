import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Empty, Field, Modal, PageLoader, Switch } from "@/components/ui";
import { CATEGORY_ICONS, CategoryIcon, ItemArt } from "@/components/ui/brand";
import { useLive } from "@/hooks/useLive";
import { adminApi } from "@/lib/api/admin";
import { LEVEL } from "@/lib/constants";
import { asset, cn, money, normalize } from "@/lib/utils";
import type { Category, MenuItem } from "@/types";
import { useAuth } from "../auth";
import { ImageInput } from "../components/ImageInput";

export default function MenuAdmin() {
  const { can } = useAuth();
  const manager = can(LEVEL.MANAGER);
  const { data, loading, reload, setData } = useLive(adminApi.menu, { interval: 60000 });
  const [cat, setCat] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const [editItem, setEditItem] = useState<Partial<MenuItem> | null>(null);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);

  const items = useMemo(() => {
    const n = normalize(q);
    return (data?.items ?? []).filter((i) => (cat === "all" || i.category_id === cat) && (!n || normalize(i.name).includes(n)));
  }, [data, cat, q]);

  if (loading && !data) return <PageLoader />;
  if (!data) return null;
  const cats = data.categories;
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "";

  async function toggle(it: MenuItem, field: "is_active" | "is_featured") {
    const value = !it[field];
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === it.id ? { ...x, [field]: value } : x)) });
    try {
      await adminApi.toggleItem(it.id, field, value);
    } catch (e) {
      toast.error((e as Error).message);
      reload();
    }
  }

  async function moveCat(i: number, d: -1 | 1) {
    const arr = [...cats];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setData((x) => x && { ...x, categories: arr });
    await adminApi.reorder("category", arr.map((c) => c.id)).catch((e) => toast.error(e.message));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Kategoriler */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Kategoriler</h2>
          {manager && (
            <button className="rounded-lg p-1.5 text-gold-200 hover:bg-white/5" onClick={() => setEditCat({ is_active: true, icon: "Coffee" })} title="Kategori ekle">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          <button
            onClick={() => setCat("all")}
            className={cn("shrink-0 rounded-xl px-3 py-2.5 text-left text-sm font-medium", cat === "all" ? "bg-gold-400/15 text-gold-100" : "text-smoke-300 hover:bg-white/5")}
          >
            Tümü <span className="text-smoke-500">({data.items.length})</span>
          </button>
          {cats.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                "group flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm",
                cat === c.id ? "bg-gold-400/15 text-gold-100" : "text-smoke-300 hover:bg-white/5",
                !c.is_active && "opacity-50",
              )}
            >
              <button className="flex flex-1 items-center gap-2 text-left font-medium" onClick={() => setCat(c.id)}>
                <CategoryIcon name={c.icon} className="h-4 w-4" />
                {c.name}
                <span className="text-smoke-500">({data.items.filter((x) => x.category_id === c.id).length})</span>
              </button>
              {manager && (
                <span className="hidden items-center gap-0.5 lg:flex lg:opacity-0 lg:group-hover:opacity-100">
                  <button onClick={() => moveCat(i, -1)} className="p-1 text-smoke-500 hover:text-smoke-100" aria-label="Yukarı"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveCat(i, 1)} className="p-1 text-smoke-500 hover:text-smoke-100" aria-label="Aşağı"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEditCat(c)} className="p-1 text-smoke-500 hover:text-gold-200" aria-label="Düzenle"><Pencil className="h-3.5 w-3.5" /></button>
                </span>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Ürünler */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke-500" />
            <input className="input pl-10" placeholder="Ürün ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {cat !== "all" && manager && (
            <Button variant="subtle" onClick={() => setEditCat(cats.find((c) => c.id === cat)!)}>
              <Pencil className="h-4 w-4" /> Kategori
            </Button>
          )}
          {manager && (
            <Button
              onClick={() =>
                setEditItem({ category_id: cat === "all" ? cats[0]?.id : cat, is_active: true, is_featured: false, track_stock: false, low_stock: 5, tags: [] })
              }
              disabled={!cats.length}
            >
              <Plus className="h-4 w-4" /> Ürün ekle
            </Button>
          )}
        </div>
        {!manager && (
          <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-smoke-400">
            Bir ürün bittiğinde göz simgesiyle menüden gizleyebilirsiniz. Fiyat/ürün düzenleme müdür yetkisi ister.
          </p>
        )}

        {items.length === 0 ? (
          <Empty title="Ürün bulunamadı" />
        ) : (
          <div className="card divide-y divide-white/5">
            {items.map((it) => {
              const low = it.track_stock && (it.stock ?? 0) <= (it.low_stock ?? 0);
              return (
                <div key={it.id} className={cn("flex items-center gap-3 p-3", !it.is_active && "opacity-50")}>
                  {it.image_url ? (
                    <img src={asset(it.image_url)!} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <ItemArt icon={cats.find((c) => c.id === it.category_id)?.icon} className="h-14 w-14 shrink-0 rounded-xl" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-semibold">
                      {it.name}
                      {it.is_featured && <Star className="h-3.5 w-3.5 fill-gold-300 text-gold-300" />}
                    </p>
                    <p className="text-xs text-smoke-500">
                      {cat === "all" && <>{catName(it.category_id)} · </>}
                      {it.track_stock ? (
                        <span className={cn(low && "font-semibold text-ember-300")}>Stok: {it.stock}</span>
                      ) : (
                        "Stok takibi yok"
                      )}
                      {!it.is_active && <Badge className="ml-2 border-wine-500/40 text-wine-400">Gizli</Badge>}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-gold-200">{money(it.price)}</span>
                  <div className="flex shrink-0 items-center">
                    {manager && (
                      <button onClick={() => toggle(it, "is_featured")} className="rounded-lg p-2 text-smoke-500 hover:text-gold-200" title="Öne çıkar">
                        <Star className={cn("h-4 w-4", it.is_featured && "fill-gold-300 text-gold-300")} />
                      </button>
                    )}
                    <button onClick={() => toggle(it, "is_active")} className="rounded-lg p-2 text-smoke-500 hover:text-smoke-100" title={it.is_active ? "Menüden gizle" : "Menüde göster"}>
                      {it.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    {manager && (
                      <button onClick={() => setEditItem(it)} className="rounded-lg p-2 text-smoke-500 hover:text-gold-200" title="Düzenle">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ItemModal item={editItem} cats={cats} onClose={() => setEditItem(null)} onSaved={reload} />
      <CategoryModal cat={editCat} onClose={() => setEditCat(null)} onSaved={reload} />
    </div>
  );
}

function ItemModal({ item, cats, onClose, onSaved }: { item: Partial<MenuItem> | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<MenuItem>>({});
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | undefined | null>(null);
  if (item && lastId !== (item.id ?? "new")) {
    setF(item);
    setTags((item.tags ?? []).join(", "));
    setLastId(item.id ?? "new");
  }
  if (!item && lastId !== null) setLastId(null);
  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      await adminApi.saveItem({ ...f, price: Number(f.price), tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
      toast.success("Ürün kaydedildi");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item?.id ? "Ürünü düzenle" : "Yeni ürün"}
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          {item?.id && (
            <Button
              variant="ghost"
              className="mr-auto text-wine-400"
              onClick={async () => {
                if (!confirm(`"${item.name}" silinsin mi? Geçmiş siparişler etkilenmez.`)) return;
                try {
                  await adminApi.deleteItem(item.id!);
                  toast("Ürün silindi");
                  onSaved();
                  onClose();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Sil
            </Button>
          )}
          <Button variant="subtle" className={cn(!item?.id && "ml-auto")} onClick={onClose}>Vazgeç</Button>
          <Button loading={busy} onClick={save}>Kaydet</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ürün adı" className="sm:col-span-2">
          <input className="input" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} autoFocus />
        </Field>
        <Field label="Kategori">
          <select className="input" value={f.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Fiyat (₺)">
          <input className="input" type="number" inputMode="decimal" min={0} step="0.5" value={f.price ?? ""} onChange={(e) => set("price", e.target.value as unknown as number)} />
        </Field>
        <Field label="Açıklama" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Etiketler" hint="Virgülle ayırın: popüler, yeni, vegan" className="sm:col-span-2">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <span className="label">Görsel</span>
          <ImageInput value={f.image_url} onChange={(u) => set("image_url", u)} />
        </div>
        <div className="space-y-3 rounded-2xl border hairline p-4 sm:col-span-2">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Menüde göster</span>
              <span className="text-xs text-smoke-500">Kapalıysa müşteriler göremez</span>
            </span>
            <Switch checked={!!f.is_active} onChange={(v) => set("is_active", v)} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Öne çıkan</span>
              <span className="text-xs text-smoke-500">Ana sayfada "Öne çıkanlar"da görünür</span>
            </span>
            <Switch checked={!!f.is_featured} onChange={(v) => set("is_featured", v)} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Stok takibi</span>
              <span className="text-xs text-smoke-500">Her siparişte otomatik düşer; bitince "Tükendi" görünür</span>
            </span>
            <Switch checked={!!f.track_stock} onChange={(v) => set("track_stock", v)} />
          </label>
          {f.track_stock && (
            <div className="grid grid-cols-2 gap-3">
              {!item?.id && (
                <Field label="Başlangıç stoğu">
                  <input className="input" type="number" min={0} value={f.stock ?? 0} onChange={(e) => set("stock", Number(e.target.value))} />
                </Field>
              )}
              <Field label="Kritik seviye">
                <input className="input" type="number" min={0} value={f.low_stock ?? 5} onChange={(e) => set("low_stock", Number(e.target.value))} />
              </Field>
              {item?.id && <p className="self-end pb-3 text-xs text-smoke-500">Stok miktarını Stok sayfasından değiştirin.</p>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CategoryModal({ cat, onClose, onSaved }: { cat: Partial<Category> | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Category>>({});
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (cat && lastId !== (cat.id ?? "new")) {
    setF(cat);
    setLastId(cat.id ?? "new");
  }
  if (!cat && lastId !== null) setLastId(null);

  return (
    <Modal
      open={!!cat}
      onClose={onClose}
      title={cat?.id ? "Kategoriyi düzenle" : "Yeni kategori"}
      footer={
        <div className="flex items-center gap-2">
          {cat?.id && (
            <Button
              variant="ghost"
              className="mr-auto text-wine-400"
              onClick={async () => {
                if (!confirm(`"${cat.name}" kategorisi silinsin mi?`)) return;
                try {
                  await adminApi.deleteCategory(cat.id!);
                  toast("Kategori silindi");
                  onSaved();
                  onClose();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Sil
            </Button>
          )}
          <Button variant="subtle" className={cn(!cat?.id && "ml-auto")} onClick={onClose}>Vazgeç</Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await adminApi.saveCategory(f);
                toast.success("Kategori kaydedildi");
                onSaved();
                onClose();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Kategori adı">
          <input className="input" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Açıklama">
          <input className="input" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div>
          <span className="label">İkon</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {Object.keys(CATEGORY_ICONS).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setF({ ...f, icon: k })}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border transition",
                  f.icon === k ? "border-gold-300 bg-gold-300/15 text-gold-100" : "border-white/10 text-smoke-400 hover:border-white/25",
                )}
                title={k}
              >
                <CategoryIcon name={k} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between rounded-2xl border hairline p-4">
          <span className="font-medium">Menüde göster</span>
          <Switch checked={f.is_active !== false} onChange={(v) => setF({ ...f, is_active: v })} />
        </label>
      </div>
    </Modal>
  );
}
