import { useEffect, useState } from "react";
import { BellOff, BellRing, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { pushState, subscribeStaff, testPush, unsubscribe, type PushState } from "@/lib/push";
import { cn } from "@/lib/utils";

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const refresh = () => pushState().then(setState);
  useEffect(() => {
    refresh();
  }, []);
  return { state, refresh };
}

const HINT: Record<PushState, string> = {
  on: "Bu cihaz yeni sipariş ve çağrılarda bildirim alıyor (telefon kilitliyken de).",
  off: "Uygulama kapalıyken de yeni sipariş ve çağrılardan haberdar olun.",
  denied: "Bildirim izni engellenmiş. Tarayıcı/site ayarlarından izin verin.",
  "needs-install": "iPhone'da bildirim için önce Paylaş → “Ana Ekrana Ekle” ile uygulamayı yükleyip oradan açın.",
  unsupported: "Bu tarayıcı Web Push bildirimlerini desteklemiyor.",
};

/** Hesabım sayfası: aç/kapat + test */
export function PushCard() {
  const { state, refresh } = usePushState();
  const [busy, setBusy] = useState(false);
  if (!state) return null;

  return (
    <div className="card p-6">
      <h3 className="flex items-center gap-2 font-display text-xl font-semibold">
        <BellRing className="h-5 w-5 text-gold-300" /> Bildirimler
      </h3>
      <p className="mt-2 text-sm text-smoke-400">{HINT[state]}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {state === "on" ? (
          <>
            <Button
              variant="subtle"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await testPush();
                  toast.success(`Test bildirimi gönderildi (${r.devices} cihaz)`);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Send className="h-4 w-4" /> Test gönder
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await unsubscribe();
                toast("Bu cihazda bildirimler kapatıldı");
                refresh();
              }}
            >
              <BellOff className="h-4 w-4" /> Kapat
            </Button>
          </>
        ) : state === "off" ? (
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await subscribeStaff();
                toast.success("Bildirimler açıldı");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
                refresh();
              }
            }}
          >
            <BellRing className="h-4 w-4" /> Bu cihazda aç
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Panel üstünde: bildirim kapalıysa bir kez hatırlatır */
export function PushBanner() {
  const { state, refresh } = usePushState();
  const KEY = "lucana.push.banner.dismissed";
  const [hidden, setHidden] = useState(() => localStorage.getItem(KEY) === "1");
  const [busy, setBusy] = useState(false);
  if (hidden || !state || state === "on" || state === "unsupported" || state === "denied") return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-gold-400/25 bg-gold-400/[0.07] p-4">
      <BellRing className="h-5 w-5 shrink-0 text-gold-300" />
      <p className="min-w-[200px] flex-1 text-sm text-smoke-200">{HINT[state]}</p>
      {state === "off" && (
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await subscribeStaff();
              toast.success("Bildirimler açıldı");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
              refresh();
            }
          }}
        >
          Bildirimleri aç
        </Button>
      )}
      <button
        className={cn("rounded-lg p-1.5 text-smoke-500 hover:text-smoke-200")}
        onClick={() => {
          localStorage.setItem(KEY, "1");
          setHidden(true);
        }}
        aria-label="Kapat"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
