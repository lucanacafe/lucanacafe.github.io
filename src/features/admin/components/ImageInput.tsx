import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { compressImage } from "@/lib/media";
import { asset } from "@/lib/utils";

/** Görsel seç → tarayıcıda WebP'ye sıkıştır → Edge Function ile Storage'a yükle */
export function ImageInput({ value, onChange, folder = "menu" }: { value: string | null | undefined; onChange: (url: string | null) => void; folder?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Lütfen bir görsel seçin");
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const url = await adminApi.uploadImage(blob, folder);
      onChange(url);
      toast.success("Görsel yüklendi");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-night-900 text-smoke-500 hover:border-gold-400/40"
      >
        {busy ? <Spinner /> : value ? <img src={asset(value)!} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7" />}
      </button>
      <div className="space-y-2 text-sm">
        <button type="button" className="block text-gold-200 hover:underline" onClick={() => ref.current?.click()}>
          {value ? "Görseli değiştir" : "Görsel yükle"}
        </button>
        {value && (
          <button type="button" className="flex items-center gap-1 text-smoke-500 hover:text-wine-400" onClick={() => onChange(null)}>
            <Trash2 className="h-3.5 w-3.5" /> Kaldır
          </button>
        )}
        <p className="text-xs text-smoke-600">Otomatik küçültülür (WebP)</p>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
