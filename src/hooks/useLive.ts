import { useCallback, useEffect, useRef, useState } from "react";
import { onPing } from "@/lib/realtime";

const TIMEOUT_MS = 15000;

/**
 * Veri çeker ve canlı tutar:
 *  - Supabase Realtime "ping" kanalı (veri taşımaz, yalnızca "yenile" sinyali)
 *  - Yedek olarak periyodik yenileme (realtime koparsa da çalışır)
 *  - Sekmeye / ağa geri dönüldüğünde anında yenileme
 * Aynı anda tek istek; istek sürerken gelen sinyaller bir sonraki tura ertelenir.
 */
export function useLive<T>(
  fetcher: () => Promise<T>,
  opts: { topic?: string | null; interval?: number; enabled?: boolean; initial?: T | null } = {},
) {
  const { topic, interval = 15000, enabled = true, initial = null } = opts;
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initial == null);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const inflight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const alive = useRef(true);

  const reload = useCallback((): Promise<void> => {
    if (inflight.current) {
      queued.current = true;
      return inflight.current;
    }
    const run = (async () => {
      try {
        const d = await Promise.race([
          fetchRef.current(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Zaman aşımı")), TIMEOUT_MS)),
        ]);
        if (alive.current) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (alive.current) setError((e as Error).message);
      } finally {
        inflight.current = null;
        if (alive.current) setLoading(false);
        if (queued.current && alive.current) {
          queued.current = false;
          void reload();
        }
      }
    })();
    inflight.current = run;
    return run;
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    void reload();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, interval);
    const onVis = () => document.visibilityState === "visible" && void reload();
    const onOnline = () => void reload();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    const off = topic ? onPing(topic, () => void reload()) : null;
    return () => {
      alive.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      off?.();
    };
  }, [enabled, interval, topic, reload]);

  return { data, setData, error, loading, reload };
}
