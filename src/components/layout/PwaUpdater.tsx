import { useRegisterSW } from "virtual:pwa-register/react";

/** Service worker'ı kaydeder; yeni sürüm yayınlanınca otomatik güncellenir (saatlik kontrol). */
export function PwaUpdater() {
  useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000);
    },
  });
  return null;
}
