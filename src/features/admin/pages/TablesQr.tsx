import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Empty, Field, Modal, PageLoader, Switch } from "@/components/ui";
import { useLive } from "@/hooks/useLive";
import { adminApi, type TableRow } from "@/lib/api/admin";
import { cn, siteUrl } from "@/lib/utils";

const tableUrl = (code: string) => siteUrl(`m/${code}`);
const QR_OPTS = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: "#0c0907", light: "#ffffff" } };

function QrImg({ code, className }: { code: string; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(tableUrl(code), { ...QR_OPTS, width: 360 }).then(setSrc);
  }, [code]);
  return src ? <img src={src} alt="QR" className={cn("rounded-xl bg-white p-1", className)} /> : <div className={cn("rounded-xl bg-white/5", className)} />;
}

/** Masalar için yazdırılabilir QR kartları (A4'e 6 kart) */
async function printCards(tables: TableRow[]) {
  const cards = await Promise.all(
    tables.map(async (t) => {
      const svg = await QRCode.toString(tableUrl(t.code), { ...QR_OPTS, type: "svg", width: 260 });
      return `<div class="card"><div class="logo">Lucana</div><div class="sub">CAFE · NARGİLE · OKEY</div>
        <div class="qr">${svg}</div><div class="table">${t.name}</div>
        <div class="hint">Menü, sipariş ve garson çağırmak için<br/>kameranızla okutun</div></div>`;
    }),
  );
  const w = window.open("", "_blank");
  if (!w) return toast.error("Açılır pencere engellendi");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lucana QR Kartları</title>
  <link href="https://fonts.googleapis.com/css2?family=Lobster&family=Manrope:wght@500;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm; }
    body { margin:0; font-family: Manrope, sans-serif; }
    .grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
    .card { border: 1.5px solid #c48f35; border-radius: 6mm; padding: 6mm; text-align:center; break-inside: avoid; background: #0c0907; color: #f1e9dc; height: 85mm; display:flex; flex-direction:column; align-items:center; justify-content:center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .logo { font-family: Lobster, cursive; font-size: 30pt; color: #e8c170; line-height: 1; }
    .sub { font-size: 6.5pt; letter-spacing: .35em; color: #d9a94f; margin-top: 1mm; }
    .qr { width: 42mm; height: 42mm; margin: 4mm 0 3mm; background:#fff; border-radius: 3mm; padding: 1.5mm; }
    .qr svg { width: 100%; height: 100%; }
    .table { font-size: 16pt; font-weight: 700; color: #f6e7c1; }
    .hint { font-size: 7.5pt; color: #bfb19c; margin-top: 1.5mm; }
  </style></head><body><div class="grid">${cards.join("")}</div>
  <script>document.fonts.ready.then(() => setTimeout(() => print(), 300));</script></body></html>`);
  w.document.close();
}

export default function TablesQr() {
  const { data, loading, reload } = useLive(adminApi.tables, { interval: 120000 });
  const [edit, setEdit] = useState<Partial<TableRow> | null>(null);
  const [bulk, setBulk] = useState(false);
  const [preview, setPreview] = useState<TableRow | null>(null);

  if (loading && !data) return <PageLoader />;
  const tables = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto max-w-xl text-sm text-smoke-400">
          Her masanın QR kodu gizli bir kod içerir. Bir QR kopyalanırsa <b>“QR'ı yenile”</b> ile eskisini anında geçersiz kılabilirsiniz.
        </p>
        <Button variant="subtle" onClick={() => printCards(tables.filter((t) => t.is_active))} disabled={!tables.length}>
          <Printer className="h-4 w-4" /> Tümünü yazdır
        </Button>
        <Button variant="subtle" onClick={() => setBulk(true)}>Toplu ekle</Button>
        <Button onClick={() => setEdit({ area: "Salon", is_active: true })}>
          <Plus className="h-4 w-4" /> Masa ekle
        </Button>
      </div>

      {tables.length === 0 ? (
        <Empty title="Henüz masa yok" text="Masa ekleyip QR kartlarını yazdırın." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tables.map((t) => (
            <div key={t.id} className={cn("card flex flex-col items-center p-4 text-center", !t.is_active && "opacity-50")}>
              <button onClick={() => setPreview(t)} className="w-full">
                <QrImg code={t.code} className="mx-auto aspect-square w-full max-w-[150px]" />
              </button>
              <p className="mt-3 font-display text-xl font-semibold">{t.name}</p>
              <p className="text-xs text-smoke-500">{t.area}</p>
              {!t.is_active && <Badge className="mt-1 text-smoke-400">Pasif</Badge>}
              <div className="mt-3 flex gap-1">
                <button className="rounded-lg p-2 text-smoke-400 hover:bg-white/5 hover:text-gold-200" title="Düzenle" onClick={() => setEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="rounded-lg p-2 text-smoke-400 hover:bg-white/5 hover:text-gold-200" title="Yazdır" onClick={() => printCards([t])}>
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  className="rounded-lg p-2 text-smoke-400 hover:bg-white/5 hover:text-ember-300"
                  title="QR'ı yenile"
                  onClick={async () => {
                    if (!confirm(`${t.name} için yeni QR üretilsin mi? Eski QR çalışmaz, kartı yeniden basmanız gerekir.`)) return;
                    await adminApi.regenTable(t.id).catch((e) => toast.error(e.message));
                    toast.success("Yeni QR üretildi");
                    reload();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TableModal table={edit} onClose={() => setEdit(null)} onSaved={reload} />
      <BulkModal open={bulk} onClose={() => setBulk(false)} onSaved={reload} />

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} size="sm">
        {preview && (
          <div className="space-y-4 text-center">
            <QrImg code={preview.code} className="mx-auto w-64" />
            <a href={tableUrl(preview.code)} target="_blank" rel="noreferrer" className="block break-all text-xs text-gold-200 hover:underline">
              {tableUrl(preview.code)}
            </a>
            <Button
              variant="subtle"
              onClick={async () => {
                const url = await QRCode.toDataURL(tableUrl(preview.code), { ...QR_OPTS, width: 1024 });
                const a = document.createElement("a");
                a.href = url;
                a.download = `lucana-qr-${preview.name.replace(/\s+/g, "-").toLowerCase()}.png`;
                a.click();
              }}
            >
              <Download className="h-4 w-4" /> PNG indir
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TableModal({ table, onClose, onSaved }: { table: Partial<TableRow> | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<TableRow>>({});
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (table && key !== (table.id ?? "new")) {
    setF(table);
    setKey(table.id ?? "new");
  }
  if (!table && key !== null) setKey(null);

  return (
    <Modal
      open={!!table}
      onClose={onClose}
      title={table?.id ? "Masayı düzenle" : "Yeni masa"}
      size="sm"
      footer={
        <div className="flex gap-2">
          {table?.id && (
            <Button
              variant="ghost"
              className="mr-auto text-wine-400"
              onClick={async () => {
                if (!confirm(`${table.name} silinsin mi?`)) return;
                try {
                  await adminApi.deleteTable(table.id!);
                  onSaved();
                  onClose();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            className={cn(!table?.id && "ml-auto")}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await adminApi.saveTable(f);
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
      <div className="space-y-4">
        <Field label="Masa adı">
          <input className="input" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Masa 1" autoFocus />
        </Field>
        <Field label="Bölüm">
          <input className="input" list="areas" value={f.area ?? ""} onChange={(e) => setF({ ...f, area: e.target.value })} />
          <datalist id="areas">{["Salon", "Teras", "Bahçe", "Sedir", "VIP"].map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <label className="flex items-center justify-between rounded-2xl border hairline p-4">
          <span>
            <span className="block font-medium">Aktif</span>
            <span className="text-xs text-smoke-500">Pasif masanın QR'ı çalışmaz</span>
          </span>
          <Switch checked={f.is_active !== false} onChange={(v) => setF({ ...f, is_active: v })} />
        </label>
      </div>
    </Modal>
  );
}

function BulkModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [area, setArea] = useState("Teras");
  const [prefix, setPrefix] = useState("Teras");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(6);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Toplu masa ekle"
      size="sm"
      footer={
        <Button
          className="w-full"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await adminApi.bulkTables(area, prefix, from, to);
              toast.success(`${to - from + 1} masa eklendi`);
              onSaved();
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {Math.max(0, to - from + 1)} masa ekle
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bölüm" className="col-span-2">
          <input className="input" value={area} onChange={(e) => setArea(e.target.value)} />
        </Field>
        <Field label="İsim öneki" className="col-span-2" hint={`Örn: “${prefix} ${from}”, “${prefix} ${from + 1}”…`}>
          <input className="input" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </Field>
        <Field label="Başlangıç no">
          <input className="input" type="number" min={1} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
        </Field>
        <Field label="Bitiş no">
          <input className="input" type="number" min={from} value={to} onChange={(e) => setTo(Number(e.target.value))} />
        </Field>
      </div>
    </Modal>
  );
}
