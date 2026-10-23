import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLive } from "@/hooks/useLive";
import { adminApi } from "@/lib/api/admin";
import { CALL } from "@/lib/constants";
import { chime } from "@/lib/media";
import type { Call, Order } from "@/types";

/**
 * Panelin "nabzı": aktif siparişler + açık çağrılar.
 * Tek bir realtime kanalından beslenir, tüm sayfalar paylaşır.
 * Yeni sipariş/çağrı gelince zil çalar ve bildirim gösterir.
 */
interface Pulse {
  orders: Order[];
  calls: Call[];
  loading: boolean;
  reload: () => Promise<void>;
  sound: boolean;
  setSound: (v: boolean) => void;
}

const Ctx = createContext<Pulse | null>(null);
const SOUND_KEY = "lucana.panel.sound";

export function PulseProvider({ children }: { children: ReactNode }) {
  const [sound, setSoundState] = useState(() => localStorage.getItem(SOUND_KEY) !== "0");
  const setSound = (v: boolean) => {
    setSoundState(v);
    localStorage.setItem(SOUND_KEY, v ? "1" : "0");
  };

  const live = useLive(
    async () => {
      const [orders, calls] = await Promise.all([adminApi.orders("active"), adminApi.calls()]);
      return { orders, calls };
    },
    { topic: "lucana-staff", interval: 12000 },
  );

  const seen = useRef<{ orders: Set<string>; calls: Set<string> } | null>(null);
  useEffect(() => {
    if (!live.data) return;
    const { orders, calls } = live.data;
    if (seen.current) {
      const newOrders = orders.filter((o) => o.status === "new" && !seen.current!.orders.has(o.id));
      const newCalls = calls.filter((c) => !seen.current!.calls.has(c.id));
      if (newOrders.length) {
        if (sound) chime("order");
        newOrders.forEach((o) =>
          toast(`Yeni sipariş #${o.no} · ${o.table_label ?? "Paket"}`, {
            description: o.items.map((i) => `${i.qty}× ${i.name}`).join(", "),
          }),
        );
      }
      if (newCalls.length) {
        if (sound) chime("call");
        newCalls.forEach((c) => toast(`${CALL[c.type].emoji} ${c.table_name}: ${CALL[c.type].label}`));
      }
    }
    seen.current = { orders: new Set(orders.map((o) => o.id)), calls: new Set(calls.map((c) => c.id)) };
  }, [live.data, sound]);

  return (
    <Ctx.Provider
      value={{
        orders: live.data?.orders ?? [],
        calls: live.data?.calls ?? [],
        loading: live.loading,
        reload: live.reload,
        sound,
        setSound,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePulse() {
  const c = useContext(Ctx);
  if (!c) throw new Error("PulseProvider eksik");
  return c;
}
