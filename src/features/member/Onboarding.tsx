import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Gamepad2, Sparkles, Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button, lockScroll } from "@/components/ui";
import { Logo, Smoke } from "@/components/ui/brand";
import { memberApi, type Member } from "@/lib/api/member";
import { LegalModal } from "@/features/legal/LegalModal";
import { cn } from "@/lib/utils";

/**
 * Tek dokunuşla üyelik. Zorunlu tek onay: 18+ ve metinler.
 * Kampanya bildirimleri ayrı ve isteğe bağlı (KVKK açık rıza).
 */
export function Onboarding({ onDone, onClose }: { onDone: (m: Member) => void; onClose: () => void }) {
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const [mode, setMode] = useState<"start" | "login">("start");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  useEffect(() => lockScroll(), []);

  async function start() {
    if (!agree) {
      toast.error("Devam etmek için onay kutusunu işaretleyin");
      return;
    }
    setBusy(true);
    try {
      const m = await memberApi.start(true, marketing);
      toast.success(`Hoş geldin ${m.avatar} ${m.nickname}!`, { description: "Takma adını profilinden değiştirebilirsin." });
      onDone(m);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    try {
      const m = await memberApi.login(u.trim().toLowerCase(), p);
      toast.success(`Tekrar hoş geldin ${m.avatar} ${m.nickname}`);
      onDone(m);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const link = (id: string, label: string) => (
    <button type="button" onClick={() => setDoc(id)} className="font-semibold text-gold-200 underline underline-offset-2">
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-night-950">
      <div className="absolute inset-0 bg-[radial-gradient(600px_400px_at_50%_0%,rgba(196,143,53,.18),transparent)]" />
      <Smoke />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-5 pb-safe pt-[calc(var(--safe-top)+1.5rem)]">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="rounded-full p-2 text-smoke-400" aria-label="Kapat">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-center">
          <Logo className="text-7xl" />
          <h1 className="mt-6 font-display text-3xl font-semibold">Masaya hoş geldin!</h1>
          <p className="mt-2 text-smoke-400">Tek dokunuşla hesabın hazır — form yok, şifre yok.</p>
        </motion.div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            { i: Star, t: "Her siparişte puan", c: "text-gold-200" },
            { i: Gamepad2, t: "Bahçe & oyunlar", c: "text-emerald-300" },
            { i: Trophy, t: "Liderlik tablosu", c: "text-ember-300" },
          ].map((x) => (
            <div key={x.t} className="card flex flex-col items-center gap-2 p-3 text-center">
              <x.i className={cn("h-6 w-6", x.c)} />
              <span className="text-xs font-semibold leading-tight text-smoke-200">{x.t}</span>
            </div>
          ))}
        </div>

        {mode === "start" ? (
          <div className="mt-6 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-night-850 p-4">
              <Box checked={agree} onChange={setAgree} />
              <span className="text-sm leading-relaxed text-smoke-200">
                <b>18 yaşından büyüğüm</b>; {link("kosullar", "Kullanım Koşulları")}, {link("kvkk", "KVKK Aydınlatma Metni")} ve{" "}
                {link("puan", "Puan & Oyun Koşulları")}'nı okudum, kabul ediyorum.
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/5 p-4">
              <Box checked={marketing} onChange={setMarketing} />
              <span className="text-sm leading-relaxed text-smoke-400">
                <span className="text-smoke-300">İsteğe bağlı:</span> Kampanya ve etkinlik bildirimleri almak için açık rıza veriyorum.
              </span>
            </label>
            <Button size="lg" className="w-full" loading={busy} onClick={start}>
              <Sparkles className="h-5 w-5" /> Başla
            </Button>
            <button onClick={() => setMode("login")} className="w-full py-2 text-center text-sm text-smoke-400">
              Zaten kayıtlı hesabın var mı? <span className="font-semibold text-gold-200">Giriş yap</span>
            </button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <input className="input" placeholder="Kullanıcı adı" autoCapitalize="none" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
            <input className="input" type="password" placeholder="Şifre" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} />
            <Button size="lg" className="w-full" type="submit" loading={busy}>
              Giriş yap
            </Button>
            <button type="button" onClick={() => setMode("start")} className="w-full py-2 text-center text-sm text-smoke-400">
              ← Yeni hesapla başla
            </button>
          </form>
        )}

        <p className="mt-auto pt-8 text-center text-xs text-smoke-600">
          Gerçek adın istenmez. Görünmez moda geçebilir, hesabını istediğin an silebilirsin.
        </p>
      </div>
      <LegalModal id={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

function Box({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onChange(!checked)}
      className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition",
        checked ? "border-gold-300 bg-gold-300 text-night-950" : "border-white/25",
      )}
    >
      {checked && <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
}
