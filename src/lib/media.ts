/** Görseli tarayıcıda küçültüp WebP'ye çevirir (yükleme boyutu ~%90 düşer). */
export async function compressImage(file: File, maxSide = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Görsel işlenemedi"))), "image/webp", quality),
  );
}

let ctx: AudioContext | null = null;

/** Yeni sipariş/çağrı için kısa zil sesi (dosya gerektirmez). */
export function chime(kind: "order" | "call" = "order") {
  try {
    ctx ??= new AudioContext();
    const notes = kind === "order" ? [880, 1174.7, 1568] : [1318.5, 987.8, 1318.5];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx!.currentTime + i * 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.5);
    });
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* ses izni yok */
  }
}

/** Tarayıcının ses kilidini ilk kullanıcı etkileşiminde açar. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    /* yok say */
  }
}
