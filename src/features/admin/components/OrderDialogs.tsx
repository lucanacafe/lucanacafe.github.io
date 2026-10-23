import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Minus, Plus, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Modal, Spinner } from "@/components/ui";
import { adminApi, type LiveTable } from "@/lib/api/admin";
import { cn, money, normalize } from "@/lib/utils";
import type { MenuItem, PaymentMethod } from "@/types";

export function PaymentPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  const opts: { v: PaymentMethod; label: string; icon: typeof Banknote }[] = [
    { v: "cash", label: "Nakit", icon: Banknote },
    { v: "card", label: "Kart", icon: CreditCard },
    { v: "other", label: "Diğer", icon: Wallet },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-semibold transition",
            value === o.v ? "border-gold-300 bg-gold-300/15 text-gold-100" : "border-white/10 text-smoke-300 hover:border-white/20",
          )}
        >
          <o.icon className="h-5 w-5" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ödeme al (tek sipariş veya masa hesabı) */
export function PayDialog({
  open,
  title,
  amount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  amount: number;
  onClose: () => void;
  onConfirm: (m: PaymentMethod) => Promise<void>;
}) {
  const [m, setM] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <Button
          className="w-full"
          size="lg"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(m);
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {money(amount)} tahsil et
        </Button>
      }
    >
      <p className="mb-4 text-center font-display text-5xl font-semibold text-gold">{money(amount)}</p>
      <PaymentPicker value={m} onChange={setM} />
    </Modal>
  );
}

export function CancelDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const quick = ["Müşteri vazgeçti", "Yanlış sipariş", "Ürün kalmadı", "Test"];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Siparişi iptal et"
      size="sm"
      footer={
        <Button
          variant="danger"
          className="w-full"
          loading={busy}
          disabled={reason.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(reason.trim());
              setReason("");
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          İptal et (stok iade edilir)
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {quick.map((q) => (
          <button key={q} onClick={() => setReason(q)} className="rounded-full border border-white/10 px-3 py-1 text-sm text-smoke-300 hover:border-gold-400/40">
            {q}
          </button>
        ))}
      </div>
      <Field label="İptal nedeni">
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
      </Field>
    </Modal>
  );
}

/** Personel panelden sipariş girer */
export function NewOrderModal({
  open,
  onClose,
  presetTable,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  presetTable?: string | null;
  onDone?: () => void;
}) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [tables, setTables] = useState<LiveTable[]>([]);
  const [table, setTable] = useState<string>("");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCart({});
    setNote("");
    setQ("");
    setTable(presetTable ?? "");
    adminApi.menu().then((m) => {
      const activeCats = new Set(m.categories.filter((c) => c.is_active !== false).map((c) => c.id));
      setItems(m.items.filter((i) => i.is_active && activeCats.has(i.category_id)));
    });
    adminApi.tablesLive().then(setTables);
  }, [open, presetTable]);

  const filtered = useMemo(() => {
    const n = normalize(q);
    return (items ?? []).filter((i) => !n || normalize(i.name).includes(n));
  }, [items, q]);
  const lines = Object.entries(cart).filter(([, n]) => n > 0);
  const total = lines.reduce((s, [id, n]) => s + n * Number(items?.find((i) => i.id === id)?.price ?? 0), 0);
  const inc = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(50, (c[id] ?? 0) + d)) }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yeni sipariş"
      size="lg"
      footer={
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-smoke-500">{lines.reduce((s, [, n]) => s + n, 0)} ürün</p>
            <p className="text-xl font-bold text-gold-200">{money(total)}</p>
          </div>
          <Button
            size="lg"
            loading={busy}
            disabled={!lines.length || !table}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await adminApi.createOrder(table, lines.map(([id, qty]) => ({ id, qty })), note);
                toast.success(`Sipariş #${r.no} oluşturuldu`);
                onDone?.();
                onClose();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Siparişi oluştur
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Masa">
          <select className="input" value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="">Masa seçin…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.area}
                {t.open_orders ? ` (açık: ${money(t.open_total)})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Not">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" />
        </Field>
      </div>
      <div className="relative mt-4">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke-500" />
        <input className="input pl-10" placeholder="Ürün ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!items ? (
        <div className="py-10 text-center"><Spinner /></div>
      ) : (
        <ul className="mt-3 divide-y divide-white/5">
          {filtered.map((i) => {
            const out = i.track_stock && (i.stock ?? 0) <= 0;
            return (
              <li key={i.id} className={cn("flex items-center gap-3 py-2", out && "opacity-40")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="text-xs text-smoke-500">
                    {money(i.price)}
                    {i.track_stock && ` · stok ${i.stock}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {(cart[i.id] ?? 0) > 0 && (
                    <>
                      <button className="rounded-lg bg-white/5 p-2" onClick={() => inc(i.id, -1)} aria-label="Azalt">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-7 text-center font-bold">{cart[i.id]}</span>
                    </>
                  )}
                  <button disabled={out} className="rounded-lg bg-gold-300 p-2 text-night-950" onClick={() => inc(i.id, 1)} aria-label="Ekle">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
