import { useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { auth } from "@/lib/api/admin";
import { useAuth } from "../auth";
import { PushCard } from "../components/PushControls";

export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const [oldPw, setOld] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const weak = pw.length > 0 && (pw.length < 8 || !/\d/.test(pw) || !/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(pw));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw !== pw2) return toast.error("Yeni şifreler eşleşmiyor");
        if (weak) return toast.error("Şifre en az 8 karakter olmalı, harf ve rakam içermeli");
        setBusy(true);
        try {
          await auth.changePassword(oldPw, pw);
          toast.success("Şifreniz güncellendi");
          setOld("");
          setPw("");
          setPw2("");
          onDone?.();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Mevcut şifre">
        <input className="input" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOld(e.target.value)} required />
      </Field>
      <Field label="Yeni şifre" hint="En az 8 karakter; harf ve rakam içermeli">
        <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Field label="Yeni şifre (tekrar)">
        <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        Şifreyi değiştir
      </Button>
    </form>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  return (
    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
      <div className="card p-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/15 font-display text-2xl font-bold text-gold-200">
          {user!.full_name.charAt(0)}
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold">{user!.full_name}</h2>
        <p className="text-sm text-smoke-400">@{user!.username}</p>
        <p className="mt-4 flex items-center gap-2 text-sm text-smoke-300">
          <ShieldCheck className="h-4 w-4 text-gold-300" /> {user!.role_name} · Seviye {user!.level}
        </p>
        <Button variant="subtle" className="mt-6" onClick={logout}>
          <LogOut className="h-4 w-4" /> Çıkış yap
        </Button>
      </div>
      <div className="card p-6">
        <h3 className="mb-4 font-display text-xl font-semibold">Şifre değiştir</h3>
        <p className="mb-4 text-xs text-smoke-500">Şifre değişince diğer cihazlardaki oturumlarınız kapanır.</p>
        <PasswordForm />
      </div>
      <div className="md:col-span-2">
        <PushCard />
      </div>
    </div>
  );
}
