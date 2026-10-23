import { useState } from "react";
import { AlertTriangle, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Empty, Field, Modal, PageLoader, Segmented } from "@/components/ui";
import { useLive } from "@/hooks/useLive";
import { adminApi, type InventoryItem } from "@/lib/api/admin";
import { LEVEL } from "@/lib/constants";
import { cn, fmtDateTime } from "@/lib/utils";
import type { MenuItem } from "@/types";
import { useAuth } from "../auth";

type Tab = "depo" | "menu" | "hareket";

export default function Stock() {
  const [tab, setTab] = useState<Tab>("depo");
  return (
    <div className="space-y-5">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "depo", label: "Depo" },
          { value: "menu", label: "Menü stoğu" },
          { value: "hareket", label: "Hareketler" },
        ]}
      />
      {tab === "depo" && <Inventory />}
      {tab === "menu" && <MenuStock />}
      {tab === "hareket" && <Moves />}
    </div>
  );
}

function Level({ qty, critical }: { qty: number; critical: number }) {
  const pct = Math.min(100, critical > 0 ? (qty / (critical * 3)) * 100 : 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div
        className={cn("h-full rounded-full", qty <= 0 ? "bg-wine-500" : qty <= critical ? "bg-ember-500" : "bg-emerald-500/70")}
        style={{ width: `${Math.max(qty > 0 ? 4 : 0, pct)}%` }}
      />
    </div>
  );
}

function Inventory() {
  const { can } = useAuth();
  const { data, loading, reload } = useLive(adminApi.inventory, { interval: 60000 });
  const [move, setMove] = useState<{ item: InventoryItem; dir: 1 | -1 } | null>(null);
  const [edit, setEdit] = useState<Partial<InventoryItem> | null>(null);

  if (loading && !data) return <PageLoader />;
  const list = data ?? [];
  const groups = [...new Set(list.map((i) => i.category))];
  const lows = list.filter((i) => Number(i.qty) <= Number(i.critical));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {lows.length > 0 && (
          <span className="flex items-center gap-2 rounded-xl bg-ember-500/10 px-3 py-2 text-sm text-ember-200">
            <AlertTriangle className="h-4 w-4" /> {lows.length} kalem kritik seviyede
          </span>
        )}
        {can(LEVEL.MANAGER) && (
          <Button className="ml-auto" onClick={() => setEdit({ unit: "adet", category: "Genel", qty: 0, critical: 0 })}>
            <Plus className="h-4 w-4" /> Kalem ekle
          </Button>
        )}
      </div>
      {list.length === 0 && <Empty title="Depo boş" text="Kömür, tütün, süt gibi malzemeleri ekleyerek takip edin." />}
      {groups.map((g) => (
        <section key={g}>
          <h3 className="eyebrow mb-2">{g}</h3>
          <div className="card divide-y divide-white/5">
            {list
              .filter((i) => i.category === g)
              .map((i) => (
                <div key={i.id} className="flex items-center gap-4 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{i.name}</p>
                      <p className={cn("shrink-0 font-bold", Number(i.qty) <= Number(i.critical) ? "text-ember-300" : "text-smoke-50")}>
                        {Number(i.qty)} <span className="text-xs font-normal text-smoke-400">{i.unit}</span>
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Level qty={Number(i.qty)} critical={Number(i.critical)} />
                      <span className="shrink-0 text-[11px] text-smoke-500">kritik {Number(i.critical)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button className="rounded-lg bg-white/5 p-2 hover:bg-wine-500/20" onClick={() => setMove({ item: i, dir: -1 })} aria-label="Çıkış">
                      <Minus className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg bg-white/5 p-2 hover:bg-emerald-500/20" onClick={() => setMove({ item: i, dir: 1 })} aria-label="Giriş">
                      <Plus className="h-4 w-4" />
                    </button>
                    {can(LEVEL.MANAGER) && (
                      <button className="rounded-lg p-2 text-smoke-500 hover:text-gold-200" onClick={() => setEdit(i)} aria-label="Düzenle">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}

      <MoveModal
        state={move}
        onClose={() => setMove(null)}
        onSubmit={async (amount, reason) => {
          await adminApi.moveInventory(move!.item.id, amount * move!.dir, reason);
          toast.success("Stok güncellendi");
          reload();
        }}
      />
      <InventoryModal item={edit} onClose={() => setEdit(null)} onSaved={reload} />
    </div>
  );
}

function MoveModal({
  state,
  onClose,
  onSubmit,
}: {
  state: { item: { name: string; unit?: string }; dir: 1 | -1 } | null;
  onClose: () => void;
  onSubmit: (amount: number, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const inbound = state?.dir === 1;
  const quick = inbound ? ["Satın alma", "Sayım düzeltme"] : ["Kullanım", "Fire / bozulma", "Sayım düzeltme"];
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      size="sm"
      title={`${state?.item.name} · ${inbound ? "Giriş" : "Çıkış"}`}
      footer={
        <Button
          className="w-full"
          variant={inbound ? "gold" : "danger"}
          loading={busy}
          onClick={async () => {
            const n = Number(amount.replace(",", "."));
            if (!(n > 0)) return toast.error("Geçerli bir miktar girin");
            setBusy(true);
            try {
              await onSubmit(n, reason);
              setAmount("1");
              setReason("");
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {inbound ? "Stoğa ekle" : "Stoktan düş"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={`Miktar${state?.item.unit ? ` (${state.item.unit})` : ""}`}>
          <input className="input text-center text-2xl font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button key={q} onClick={() => setReason(q)} className={cn("rounded-full border px-3 py-1 text-sm", reason === q ? "border-gold-300 text-gold-100" : "border-white/10 text-smoke-300")}>
              {q}
            </button>
          ))}
        </div>
        <Field label="Açıklama">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function InventoryModal({ item, onClose, onSaved }: { item: Partial<InventoryItem> | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<InventoryItem>>({});
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (item && key !== (item.id ?? "new")) {
    setF(item);
    setKey(item.id ?? "new");
  }
  if (!item && key !== null) setKey(null);

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item?.id ? "Kalemi düzenle" : "Yeni depo kalemi"}
      footer={
        <div className="flex gap-2">
          {item?.id && (
            <Button
              variant="ghost"
              className="mr-auto text-wine-400"
              onClick={async () => {
                if (!confirm(`"${item.name}" silinsin mi?`)) return;
                await adminApi.deleteInventory(item.id!).catch((e) => toast.error(e.message));
                onSaved();
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> Sil
            </Button>
          )}
          <Button variant="subtle" className={cn(!item?.id && "ml-auto")} onClick={onClose}>Vazgeç</Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await adminApi.saveInventory(f);
                toast.success("Kaydedildi");
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad" className="sm:col-span-2">
          <input className="input" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Kategori">
          <input className="input" list="inv-cats" value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <datalist id="inv-cats">
            {["Nargile", "Bar", "Mutfak", "Sarf", "Temizlik", "Genel"].map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Birim">
          <input className="input" list="inv-units" value={f.unit ?? ""} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <datalist id="inv-units">
            {["adet", "kg", "gr", "lt", "paket", "kutu", "rulo"].map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        {!item?.id && (
          <Field label="Mevcut miktar">
            <input className="input" type="number" min={0} step="any" value={f.qty ?? 0} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Kritik seviye" hint="Bu miktarın altına düşünce uyarı verir">
          <input className="input" type="number" min={0} step="any" value={f.critical ?? 0} onChange={(e) => setF({ ...f, critical: Number(e.target.value) })} />
        </Field>
        <Field label="Not" className="sm:col-span-2">
          <input className="input" value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function MenuStock() {
  const { data, loading, reload } = useLive(adminApi.menu, { interval: 30000 });
  const [move, setMove] = useState<{ item: MenuItem; dir: 1 | -1 } | null>(null);
  if (loading && !data) return <PageLoader />;
  const tracked = (data?.items ?? []).filter((i) => i.track_stock);

  return (
    <div className="space-y-4">
      <p className="text-sm text-smoke-400">
        Stok takibi açık ürünler siparişte otomatik düşer, iptal edilince geri yüklenir. Ürünü takibe almak için Menü → ürün düzenle → "Stok takibi".
      </p>
      {tracked.length === 0 ? (
        <Empty title="Stok takibi yapılan ürün yok" />
      ) : (
        <div className="card divide-y divide-white/5">
          {tracked.map((i) => (
            <div key={i.id} className="flex items-center gap-4 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className={cn("font-bold", (i.stock ?? 0) <= (i.low_stock ?? 0) ? "text-ember-300" : "")}>{i.stock} adet</p>
                </div>
                <div className="mt-2"><Level qty={i.stock ?? 0} critical={i.low_stock ?? 0} /></div>
              </div>
              <button className="rounded-lg bg-white/5 p-2" onClick={() => setMove({ item: i, dir: -1 })} aria-label="Düş"><Minus className="h-4 w-4" /></button>
              <button className="rounded-lg bg-white/5 p-2" onClick={() => setMove({ item: i, dir: 1 })} aria-label="Ekle"><Plus className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <MoveModal
        state={move ? { item: { name: move.item.name, unit: "adet" }, dir: move.dir } : null}
        onClose={() => setMove(null)}
        onSubmit={async (n, reason) => {
          await adminApi.itemStock(move!.item.id, "add", Math.round(n) * move!.dir, reason);
          toast.success("Stok güncellendi");
          reload();
        }}
      />
    </div>
  );
}

function Moves() {
  const { data, loading } = useLive(() => adminApi.stockMoves(undefined, 200), { interval: 60000 });
  if (loading && !data) return <PageLoader />;
  if (!data?.length) return <Empty title="Henüz stok hareketi yok" />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-night-900/60 text-left text-xs uppercase tracking-wider text-smoke-500">
          <tr>
            <th className="px-4 py-3">Zaman</th>
            <th className="px-4 py-3">Kalem</th>
            <th className="px-4 py-3 text-right">Miktar</th>
            <th className="px-4 py-3">Neden</th>
            <th className="px-4 py-3">Personel</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2.5 text-smoke-400">{fmtDateTime(m.at)}</td>
              <td className="px-4 py-2.5">
                {m.ref_name} <span className="text-xs text-smoke-600">{m.kind === "menu" ? "menü" : "depo"}</span>
              </td>
              <td className={cn("px-4 py-2.5 text-right font-semibold", Number(m.delta) > 0 ? "text-emerald-300" : "text-ember-300")}>
                {Number(m.delta) > 0 ? "+" : ""}
                {Number(m.delta)}
              </td>
              <td className="px-4 py-2.5 text-smoke-300">{m.reason}</td>
              <td className="px-4 py-2.5 text-smoke-400">{m.staff ?? "Sistem"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
