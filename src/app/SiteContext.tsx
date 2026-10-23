import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { publicApi } from "@/lib/api/public";
import type { Settings } from "@/types";

export const DEFAULT_SETTINGS: Settings = {
  name: "Lucana Cafe & Lounge",
  tagline: "Her Fincanda Bir Hikaye, Her Köşede Bir Huzur Var",
  about: "",
  phone: "+90 532 699 70 62",
  address: "Çağlayan, Vatan Caddesi No:57, Kağıthane / İstanbul",
  hours: "10:00 – 04:00",
  instagram: "lucana.cafe",
  maps_url: "https://www.google.com/maps/search/?api=1&query=Lucana+Cafe+%C3%87a%C4%9Flayan+Vatan+Caddesi+57",
  announcement: "",
  ordering_enabled: true,
  calls_enabled: true,
  currency: "₺",
};

const Ctx = createContext<{ settings: Settings; refresh: () => void }>({ settings: DEFAULT_SETTINGS, refresh: () => {} });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...(publicApi.cachedSettings() ?? {}) }));
  const refresh = () =>
    publicApi
      .settings()
      .then((s) => s && setSettings({ ...DEFAULT_SETTINGS, ...s }))
      .catch(() => {});
  useEffect(() => {
    refresh();
  }, []);
  return <Ctx.Provider value={{ settings, refresh }}>{children}</Ctx.Provider>;
}

export const useSite = () => useContext(Ctx);
