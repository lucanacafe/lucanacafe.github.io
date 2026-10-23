import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useSite } from "@/app/SiteContext";
import { Button, Field, PageLoader, Switch } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { LEVEL } from "@/lib/constants";
import type { Settings } from "@/types";
import { useAuth } from "../auth";

export default function SettingsPage() {
  const { can } = useAuth();
  const site = useSite();
  const editable = can(LEVEL.MANAGER);
  const [f, setF] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.settings().then(setF).catch((e) => toast.error(e.message));
  }, []);

  if (!f) return <PageLoader />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF({ ...f, [k]: v });

  async function save(patch?: Partial<Settings>) {
    setBusy(true);
    try {
      const saved = await adminApi.saveSettings(patch ?? f!);
      setF(saved);
      site.refresh();
      toast.success("Ayarlar kaydedildi");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (k: "ordering_enabled" | "calls_enabled", v: boolean) => {
    set(k, v);
    save({ [k]: v });
  };

  return (
    <fieldset disabled={!editable || busy} className="max-w-4xl space-y-6">
      {!editable && <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-smoke-400">Ayarları değiştirmek için müdür yetkisi gerekir.</p>}

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">QR sipariş sistemi</h2>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium">Masadan sipariş</span>
            <span className="text-sm text-smoke-500">Kapalıyken müşteriler menüyü görür ama sipariş veremez (yoğunluk, kapanış vb.)</span>
          </span>
          <Switch checked={f.ordering_enabled} onChange={(v) => toggle("ordering_enabled", v)} disabled={!editable} />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium">Garson / köz / hesap çağırma</span>
            <span className="text-sm text-smoke-500">Masadaki hızlı çağrı butonları</span>
          </span>
          <Switch checked={f.calls_enabled} onChange={(v) => toggle("calls_enabled", v)} disabled={!editable} />
        </label>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-display text-xl font-semibold sm:col-span-2">Sadakat puanı</h2>
        <Field label="Kazanma: 1 ₺ = ? puan" hint="Ödenen NET tutar üzerinden">
          <input className="input" type="number" min={0} value={f.points_per_tl ?? 10} onChange={(e) => set("points_per_tl", Number(e.target.value))} />
        </Field>
        <Field label="Harcama: kaç puan = 1 ₺ indirim">
          <input className="input" type="number" min={1} value={f.redeem_points_per_tl ?? 100} onChange={(e) => set("redeem_points_per_tl", Number(e.target.value))} />
        </Field>
        <Field label="Sepetin en fazla %'si puanla" hint="0 = puanla indirim kapalı">
          <input className="input" type="number" min={0} max={100} value={f.max_discount_pct ?? 50} onChange={(e) => set("max_discount_pct", Number(e.target.value))} />
        </Field>
        <div className="self-end rounded-xl bg-white/[0.04] p-3 text-sm text-smoke-300">
          Etkin iade oranı:{" "}
          <b className="text-gold-100">%{(((f.points_per_tl ?? 10) / (f.redeem_points_per_tl ?? 100)) * 100).toFixed(1)}</b>
          <span className="block text-xs text-smoke-500">100 ₺ harcayan {((f.points_per_tl ?? 10) * 100).toLocaleString("tr-TR")} puan kazanır</span>
        </div>
        <label className="flex items-center justify-between gap-4 sm:col-span-2">
          <span>
            <span className="block font-medium">Canlı sosyal akış</span>
            <span className="text-sm text-smoke-500">“Kim ne sipariş etti / kim kazandı” akışı (görünmez moddakiler hariç)</span>
          </span>
          <Switch checked={f.social_feed_enabled !== false} onChange={(v) => set("social_feed_enabled", v)} disabled={!editable} />
        </label>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-display text-xl font-semibold sm:col-span-2">Oyunlar (Bahçe & Blok)</h2>
        <label className="flex items-center justify-between gap-4 sm:col-span-2">
          <span>
            <span className="block font-medium">Oyunlar açık</span>
            <span className="text-sm text-smoke-500">Şans oyunu yoktur. Kapatınca yeni ekim / oyun başlatılamaz, hasat yapılabilir.</span>
          </span>
          <Switch checked={f.games_enabled !== false} onChange={(v) => { set("games_enabled", v); save({ games_enabled: v }); }} disabled={!editable} />
        </label>
        <Field label="Bahçe: günlük hasat kârı tavanı" hint="Kişi başı 24 saatte hasattan en fazla bu kadar KÂR (tohum bedeli hep geri döner)">
          <input className="input" type="number" min={0} value={f.farm_daily_cap ?? 300} onChange={(e) => set("farm_daily_cap", Number(e.target.value))} />
        </Field>
        <Field label="Bahçe: günlük sulama teşekkürü tavanı" hint="Komşu sulayarak 24 saatte en fazla">
          <input className="input" type="number" min={0} value={f.help_daily_cap ?? 30} onChange={(e) => set("help_daily_cap", Number(e.target.value))} />
        </Field>
        <Field label="Blok (Tetris) günlük ödül tavanı" hint="Beceri oyunundan kişi başı 24 saatte en fazla">
          <input className="input" type="number" min={0} value={f.skill_daily_cap ?? 150} onChange={(e) => set("skill_daily_cap", Number(e.target.value))} />
        </Field>
        <p className="self-end text-xs text-smoke-500">Ödül havuzu bakiyesi ve oyun istatistikleri: Oyunlar & Havuz sayfası.</p>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-display text-xl font-semibold sm:col-span-2">İşletme bilgileri</h2>
        <Field label="İşletme adı"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Telefon"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Slogan" className="sm:col-span-2"><input className="input" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
        <Field label="Adres" className="sm:col-span-2"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Çalışma saatleri" hint="Biçim: 10:00 – 04:00 (açık/kapalı rozeti buna göre)"><input className="input" value={f.hours} onChange={(e) => set("hours", e.target.value)} /></Field>
        <Field label="Instagram kullanıcı adı"><input className="input" value={f.instagram} onChange={(e) => set("instagram", e.target.value.replace("@", ""))} /></Field>
        <Field label="Google Maps bağlantısı" className="sm:col-span-2"><input className="input" value={f.maps_url} onChange={(e) => set("maps_url", e.target.value)} /></Field>
        <Field label="Hakkımızda metni" className="sm:col-span-2">
          <textarea className="input" rows={4} value={f.about} onChange={(e) => set("about", e.target.value)} />
        </Field>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-display text-xl font-semibold sm:col-span-2">Duyuru & Wi-Fi</h2>
        <Field label="Site üstü duyuru" hint="Boş bırakılırsa gösterilmez. Örn: Bu akşam canlı maç yayını!" className="sm:col-span-2">
          <input className="input" value={f.announcement} onChange={(e) => set("announcement", e.target.value)} maxLength={140} />
        </Field>
        <Field label="Wi-Fi ağ adı" hint="Yalnızca masadaki QR'ı okutanlara gösterilir">
          <input className="input" value={f.wifi_name ?? ""} onChange={(e) => set("wifi_name", e.target.value)} />
        </Field>
        <Field label="Wi-Fi şifresi">
          <input className="input" value={f.wifi_pass ?? ""} onChange={(e) => set("wifi_pass", e.target.value)} />
        </Field>
      </section>

      {editable && (
        <div className="sticky bottom-20 flex justify-end lg:bottom-4">
          <Button size="lg" loading={busy} onClick={() => save()} className="shadow-2xl">
            <Save className="h-4 w-4" /> Kaydet
          </Button>
        </div>
      )}
    </fieldset>
  );
}
