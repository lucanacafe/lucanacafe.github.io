import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Konu başına TEK realtime kanalı (referans sayımlı).
 * Aynı konuya birden çok bileşen abone olsa da kanal bir kez açılır;
 * son dinleyici ayrılınca kapanır. Sunucu yalnızca "changed" ping'i yollar.
 */
const registry = new Map<string, { channel: RealtimeChannel; listeners: Set<() => void> }>();

export function onPing(topic: string, cb: () => void) {
  let entry = registry.get(topic);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "changed" }, () => listeners.forEach((l) => l()))
      .subscribe();
    entry = { channel, listeners };
    registry.set(topic, entry);
  }
  entry.listeners.add(cb);

  return () => {
    const e = registry.get(topic);
    if (!e) return;
    e.listeners.delete(cb);
    if (e.listeners.size === 0) {
      registry.delete(topic);
      supabase.removeChannel(e.channel);
    }
  };
}
